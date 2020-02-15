const
    net = require('net'),
    { saveSuccessfulConnInfo, saveFailedConnInfo, updateAddressesDb } = require('./db'),
    { composeMessageToNode, versionMessage, parseRecievedData, parseVersionPayload, parseAddrPayload } = require('./messages');

const NO_CONNECTION_TIMEOUT = 10 * 1000;
const NO_HANDSHAKE_TIMEOUT = 120 * 1000;
const NO_DATA_TIMEOUT = 3600 * 1000;

const MAX_OPEN_CONNS = 100; // pending + open, since pending may become open

// Object containing current connections status infomation
let connectionsStatus = {
    tried: 0,
    pending: 0,
    open: 0,
    handshaked: 0,
    successful: 0,
    failed: 0,
}

const getCurrentConnectionsStatus = () => ( {...connectionsStatus} );

// Usage: await newConnectionPossible();
const newConnectionPossible = async () => {
    while (
        connectionsStatus.open + connectionsStatus.pending >= MAX_OPEN_CONNS
    ) {
        await new Promise(r => setTimeout(r, 10));
    }
}

// Usage: await noOpenConnections();
const noOpenConnections = async () => {
    while (connectionsStatus.open > 0) {
        await new Promise(r => setTimeout(r, 10));
    }
}

const fetchDataFromNode = (peerAddr) => new Promise((resolve, reject) => {
    var client = new net.Socket();
    let
        recievedData = {
            buffer: Buffer.alloc(0),
            normalized: [],
            normalizedPayload: {},
        },
        connected = false,
        handshakeSteps = 0; // === 2: just handshaked, > 2 - handshaked + executing/executed post handshake actions

    let [ peerIp, peerPort ] = peerAddr.split(':');

    client.connect(peerPort, peerIp, function() {
        connected = true;
        --connectionsStatus.pending;
        ++connectionsStatus.open;
        // Send version message
        let message = versionMessage();
        client.write(message);
    });

    client.on('error', function(error) {
        client.destroy();
        reject({ timeout: false, error: error });
    });

    client.on('close', function(hasError) {
        if (connected) --connectionsStatus.open;
        else --connectionsStatus.pending;
    });
    
    client.on('data', function(data) {
        recievedData.buffer = Buffer.concat([ recievedData.buffer, data ]);
        try {
            parseRecievedData(recievedData);
        } catch (e) {
            client.destroy();
            reject({ timeout: false, error: e });
        }

        while (recievedData.normalized.length) {
            let currentMsg = recievedData.normalized[0];
            if (currentMsg.command === 'version') {
                recievedData.normalizedPayload.version = parseVersionPayload(currentMsg.payload);
                // Send verack
                client.write(composeMessageToNode('verack'));
                ++handshakeSteps;
            }
            if (currentMsg.command === 'verack') {
                ++handshakeSteps;
            }
            if (handshakeSteps === 2) {
                ++handshakeSteps; // Avoid running this statement infinitely
                ++connectionsStatus.handshaked;
                // Send getaddr
                client.write(composeMessageToNode('getaddr'));
            }
            if (currentMsg.command === 'addr') {
                recievedData.normalizedPayload.addresses = parseAddrPayload(currentMsg.payload);
                client.destroy();
                // Resolve after recieving addresses
                resolve(recievedData.normalizedPayload);
            }
            // Remove handled command
            recievedData.normalized.splice(0, 1);
        }
    });

    // TIMEOUTS:
    setTimeout(() => {
        if (!connected) {
            client.destroy();
            reject({ timeout: true, msg: `Timeout - no connections after ${ NO_CONNECTION_TIMEOUT } ms` });
        }
    }, NO_CONNECTION_TIMEOUT);

    setTimeout(() => {
        if (handshakeSteps < 2) {
            client.destroy();
            reject({ timeout: true, msg: `Timeout - no handshake after ${ NO_HANDSHAKE_TIMEOUT } ms` });
        }
    }, NO_HANDSHAKE_TIMEOUT);

    setTimeout(() => {
        client.destroy();
        reject({ timeout: true, msg: `Timeout - no data after ${ NO_DATA_TIMEOUT }` });
    }, NO_DATA_TIMEOUT);
});

const tryToConnectAndFetchAddrs = async (addr) => {
    let fetchedData = null;
    try {
        ++connectionsStatus.tried;
        ++connectionsStatus.pending;
        fetchedData = await fetchDataFromNode(addr, connectionsStatus);
        ++connectionsStatus.successful;
    } catch (e) {
        ++connectionsStatus.failed;
        await saveFailedConnInfo(addr, e);
    }

    if (fetchedData) {
        await saveSuccessfulConnInfo(addr, fetchedData.version);
        await updateAddressesDb(fetchedData.addresses);
    }

    console.log('CONNECTIONS STATUS: ', connectionsStatus);
};

module.exports = { fetchDataFromNode, tryToConnectAndFetchAddrs, getCurrentConnectionsStatus, newConnectionPossible, noOpenConnections };