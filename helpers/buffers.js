const crypto = require('crypto'); // For hashing purposes

const composeBuffer = (valuesArr, dump = false) => {
    let buff = Buffer.alloc(0);

    valuesArr
        .map(({ val, type }) => {
            let subBuff = Buffer.alloc(0);
            if (type === 'uint16_be') {
                subBuff = Buffer.alloc(2);
                subBuff.writeUInt16BE(val);
            }
            if (type === 'int32') {
                subBuff = Buffer.alloc(4);
                subBuff.writeInt32LE(val);
            }
            if (type === 'uint32') {
                subBuff = Buffer.alloc(4);
                subBuff.writeUInt32LE(val);
            }
            if (type === 'uint64') {
                subBuff = Buffer.alloc(8);
                subBuff.writeBigUInt64LE(BigInt(val));
            }
            if (type === 'int64') {
                subBuff = Buffer.alloc(8);
                subBuff.writeBigInt64LE(BigInt(val));
            }
            if (type === 'bytes') {
                subBuff = Buffer.from(val);
            }
            if (type === 'networkAddr') {
                subBuff = composeBuffer([
                    { type: 'uint64', val: val.services }, // Services
                    { type: 'bytes', val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xFF, 0xFF, ...val.ip.split('.')] }, // IP
                    { type: 'uint16_be', val: val.port }, // Port (we must must BE order)
                ]);
            }
            if (type === 'buffer') {
                return val;
            }

            return subBuff;
        })
        .forEach(subBuff => {
            if (dump) console.log(subBuff);
            buff = Buffer.concat([buff, subBuff])
        });

    return buff;
};
    
const getVarIntBytesLength = (buffer, offset) => {
    let firstByte = buffer[offset];
    let firstByteToLength = { 0xfd: 3, 0xfe: 5, 0xff: 9 };
    return firstByteToLength[firstByte] || 1;
};

const readVarInt = (buffer, offset) => {
    const firstByte = buffer[offset];
    if (firstByte <= 0xfd) return firstByte;
    if (firstByte === 0xfd) return buffer.readUInt16LE(offset + 1);
    if (firstByte === 0xfe) return buffer.readUInt32LE(offset + 1);
    if (firstByte === 0xff) return buffer.readBigUInt64LE(offset + 1);
};

const readVarString = (buffer, offset) => {
    const stringLength = readVarInt(buffer, offset);
    const stringOffset = offset + getVarIntBytesLength(buffer, offset);
    if (!stringLength) return '';

    return buffer
        .slice(stringOffset, stringOffset + stringLength)
        .toString();
};

const sha256 = (val) => crypto.createHash('sha256').update(val).digest();

module.exports = { composeBuffer, getVarIntBytesLength, readVarInt, readVarString, sha256 };