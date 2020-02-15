const
    config = require('../config/config.js'),
    mongoose = require('mongoose');

// Init Node model
mongoose.connect(config.mongoURI);
require('../models/Node');
const Node = mongoose.model('node');

const updatePriority = async (updatedNode) => {
    let lastSuccessfulConnTs = updatedNode.lastSuccessfulConnDate ?
        Math.floor(updatedNode.lastSuccessfulConnDate.getTime() / 1000)
        : 0;
    let lastSuccessfulConnHourTs = Math.floor(lastSuccessfulConnTs / 3600);
    let priority =
        lastSuccessfulConnHourTs * 10000 * 10000 // First priority - last successfull connection (hour "timestamp")
        + updatedNode.successfulConnsCount * 10000 // Second priority - successful connections count
        + updatedNode.recievedCount; // Third priority - how many times we recieved given node address

    await Node.findOneAndUpdate(
        { address: updatedNode.address },
        { $set: {
            priority: priority
        } }
    );
}

const updateAddressesDb = async (newAddresses) => {
    for (addr of newAddresses) {
        if (addr.address.match(/^0\./)) continue;
        let updatedNode = await Node.findOneAndUpdate(
            { address: addr.address },
            {
                $set: {
                    lastRecieved: Date.now()
                },
                $inc: {
                    recievedCount: 1
                }
            },
            { upsert: true, new: true }
        );
        await updatePriority(updatedNode);
    }
};

const getNodesToConnBatch = async (batchSize, previousBatchLastNode) => {
    const query = previousBatchLastNode ?
        {
            $or: [
                { priority: { $lt: previousBatchLastNode.priority } },
                { priority: previousBatchLastNode.priority, address: { $lt: previousBatchLastNode.address } }
            ]
        }
        :
        {};

    const batch = await Node
        .find(query)
        .sort({ priority: -1, address: -1 })
        .limit(batchSize)
        .select('address priority')
        .lean();

    return batch;
};

const getNodesCount = async () => {
    return (await Node.countDocuments());
};

const saveSuccessfulConnInfo = async(nodeAddr, version) => {
    let updatedNode = await Node.findOneAndUpdate(
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
        },
        { new: true }
    );

    await updatePriority(updatedNode);
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

module.exports = { updateAddressesDb, getNodesToConnBatch, getNodesCount, saveSuccessfulConnInfo, saveFailedConnInfo };