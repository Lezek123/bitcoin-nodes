const
    { tryToConnectAndFetchAddrs, newConnectionPossible, noOpenConnections } = require('./helpers/connections'),
    { getAddressesBatch, getNodesCount } = require('./helpers/db');

const DB_NODE_FETCH_BATCH_SIZE = 10000;

const main = async () => {

    let nodesCount = await getNodesCount();
    console.log('Total node count:', nodesCount);

    let batchesCount = Math.ceil(nodesCount / DB_NODE_FETCH_BATCH_SIZE);

    for (let i = 0; i < batchesCount; ++i) {
        let nodeAddrs = await getAddressesBatch(i, DB_NODE_FETCH_BATCH_SIZE);
        console.log(`Fetched batch of ${ nodeAddrs.length } node addresses...`);
        for (let addr of nodeAddrs) {
            // If we already reached MAX_OPEN_CONNS - wait before continuing...
            await newConnectionPossible();
            tryToConnectAndFetchAddrs(addr);
        }
    }

    // Wait until we have 0 open connections before finishing
    await noOpenConnections();

    console.log('FINISHED!');
};

main().then(() => process.exit());