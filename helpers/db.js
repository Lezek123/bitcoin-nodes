const
    config = require('../config/config.js'),
    mongoose = require('mongoose');

// Init Node model
mongoose.connect(config.mongoURI);
require('../models/Node');
const Node = mongoose.model('node');

const updateAddressesDb = async (newAddresses) => {
    for (addr of newAddresses) {
        if (addr.address.match(/^0\.0\.0/)) continue;
        await Node.findOneAndUpdate(
            { address: addr.address },
            {
                $set: {
                    lastRecieved: Date.now()
                },
                $inc: {
                    recievedCount: 1
                }
            },
            { upsert: true }
        );
    }
};

const getAddressesBatch = async (batchNumber, batchSize) => {
    const batch = await Node.find({})
        .sort({ lastSuccessfulConnDate: -1, successfulConnsCount: -1, recievedCount: -1 })
        .skip(batchNumber * batchSize)
        .limit(batchSize);

    return batch.map(node => node.address);
};

const getNodesCount = async () => {
    return (await Node.countDocuments());
};

const saveSuccessfulConnInfo = async(nodeAddr, version) => {
    await Node.findOneAndUpdate(
        { address: nodeAddr },
        {
            $set: {
                lastSuccessfulConnDate: Date.now(),
                nodeVer: version.version,
                nodeUserAgent: version.userAgent,
                versionHex: version.originalBuff
            },
            $inc: {
                successfulConnsCount: 1
            }
        }
    );
};

const saveFailedConnInfo = async(nodeAddr, exception) => {
    await Node.findOneAndUpdate(
        { address: nodeAddr },
        {
            $set: {
                lastFailedConnDate: Date.now(),
                lastFailedConnError: JSON.stringify(exception),
            },
            $inc: {
                failedConnsCount: 1
            }
        }
    );
};

module.exports = { updateAddressesDb, getAddressesBatch, getNodesCount, saveSuccessfulConnInfo, saveFailedConnInfo };