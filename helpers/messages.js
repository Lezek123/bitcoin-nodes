const { composeBuffer, readVarString, sha256 } = require('./buffers');
const MAGIC_BYTES_MAINNET = [ 0xf9, 0xbe, 0xb4, 0xd9 ];

const composeMessageToNode = (command, payload = [], dump = false) => {
    if (dump) console.log('Sending command:', command);

    // Command bytes as array of fixed 12-byte length
    let commandBytes = command.split('').map(c => c.charCodeAt(0));
    while (commandBytes.length < 12) commandBytes.push(0x00);

    if (dump) console.log('\n\nPAYLOAD:');

    let
        payloadBuff = composeBuffer(payload, dump),
        payloadLength = payloadBuff.length,
        payloadSign = sha256(sha256(payloadBuff)).slice(0, 4);
    
    if (dump) console.log('\n\nMESSAGE:');

    return composeBuffer(
        [
            { type: 'bytes', val: MAGIC_BYTES_MAINNET }, // Mainnet network id
            { type: 'bytes', val: commandBytes }, // Command
            { type: 'uint32', val: payloadLength }, // Payload length
            { type: 'buffer', val: payloadSign }, // First 4 bytes of sha256(sha256(payload))
            { type: 'buffer', val: payloadBuff } // Actual payload
        ],
        dump
    );
};

const versionMessage = () => {
    return composeMessageToNode('version', [
        { type: 'int32', val: 80003 }, // Version
        { type: 'uint64', val: 1 }, // Services
        { type: 'int64', val: Math.floor(Date.now() / 1000) }, // Timestamp
        { type: 'networkAddr', val: { services: 1, ip: '0.0.0.0', port: 0 } }, // Recipitent address
        { type: 'networkAddr', val: { services: 1, ip: '0.0.0.0', port: 0 } }, // Sender address
        { type: 'uint64', val: Math.floor(Math.random() * Math.pow(2, 64)) }, // Node id (random)
        { type: 'bytes', val: [0] }, // User-agent (not required?)
        { type: 'int32', val: 0 }, // Last block the node has
        { type: 'bytes', val: [0] } // Whether the remote peer should announce relayed transactions or not
    ]);
};

// PARSING

const parseRecievedData = (recievedData) => {
    // We need at least 24 bytes (message header) to start parsing
    if (recievedData.buffer.length < 24) return;

    // Data buffer should start with magic bytes
    if (recievedData.buffer.indexOf(Buffer.from(MAGIC_BYTES_MAINNET)) !== 0) {
        throw 'Invalid data buffer';
    }

    let payloadLength = recievedData.buffer.readUInt32LE(16);

    // We wait until we get full message
    if (recievedData.buffer.length < 24 + payloadLength) return;

    let messageBuffer = recievedData.buffer.slice(0, 24 + payloadLength);
    recievedData.buffer = recievedData.buffer.slice(24 + payloadLength); // Remove data that was alread read

    recievedData.normalized.push({
        command: messageBuffer.slice(4, 16).filter(b => b !== 0x00).toString(),
        payloadLength: payloadLength,
        payload: messageBuffer.slice(24)
    });
};

const parseAddrPayload = (payload) => {
    let addrs = [];

    let begin = payload.length % 30; // it's either 30*x + 1 or 30*x + 3, so it should work
    payload = payload.slice(begin);

    while(payload.length) {
        let ip = payload.slice(24, 28).join('.');
        let port = payload.readUInt16BE(28); // NOTICE PORTS ARE BE, NOT LE ORDER!

        addrs.push({
            address: ip + ':' + port,
            originalBuff: payload.slice(0, 30)
        });
        
        payload = payload.slice(30);
    }

    return addrs;
};

const parseVersionPayload = (payload) => {
    return {
        version: payload.readUInt32LE(),
        userAgent: readVarString(payload, 80),
        originalBuff: payload.toString('hex')
    };
};

module.exports = { composeMessageToNode, versionMessage, parseRecievedData, parseAddrPayload, parseVersionPayload };