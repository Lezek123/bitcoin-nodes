const
    net = require('net'),
    { saveSuccessfulConnInfo, saveFailedConnInfo, updateAddressesDb } = require('./db'),
    { composeMessageToNode, versionMessage, parseRecievedData, parseVersionPayload, parseAddrPayload } = require('./messages');

const NO_HANDSHAKE_TIMEOUT = 120 * 1000;
const NO_DATA_TIMEOUT = 3600 * 1000;

const fetchDataFromNode = (peerAddr) => new Promise((resolve, reject) => {
    var client = new net.Socket();
    let
        recievedData = {
            buffer: Buffer.alloc(0),
            normalized: [],
            normalizedPayload: {},
        };
    let handshakeSteps = 0; // === 2: just handshaked, > 2 - handshaked + executing/executed post handshake actions

    let [ peerIp, peerPort ] = peerAddr.split(':');

    client.connect(peerPort, peerIp, function() {
        // Send version message
        let message = versionMessage();
        client.write(message);
    });

    client.on('error', function(error) {
        client.destroy();
        reject({ timeout: false, error: error });
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

const tryToConnectAndFetchAddrs = async (addr, connectionsStatus) => {
    let fetchedData = null;
    
    try {
        ++connectionsStatus.open;
        fetchedData = await fetchDataFromNode(addr);
        ++connectionsStatus.successful;
    } catch (e) {
        ++connectionsStatus.failed;
        await saveFailedConnInfo(addr, e);
    }

    --connectionsStatus.open;

    if (fetchedData) {
        await saveSuccessfulConnInfo(addr, fetchedData.version);
        await updateAddressesDb(fetchedData.addresses);
    }

    console.log('CONNECTIONS STATUS: ', connectionsStatus);
};

module.exports = { fetchDataFromNode, tryToConnectAndFetchAddrs };