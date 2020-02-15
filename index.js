const
    { tryToConnectAndFetchAddrs } = require('./helpers/connections'),
    { getAddressesBatch, getNodesCount } = require('./helpers/db');

let connectionsStatus = {
    open: 0,
    successful: 0,
    failed: 0
}

const DB_NODE_FETCH_BATCH_SIZE = 10000;
const MAX_OPEN_CONNS = 1000;

const main = async () => {

    let nodesCount = await getNodesCount();
    console.log('Total node count:', nodesCount);

    let batchesCount = Math.ceil(nodesCount / DB_NODE_FETCH_BATCH_SIZE);

    for (let i = 0; i < batchesCount; ++i) {
        let nodeAddrs = await getAddressesBatch(i, DB_NODE_FETCH_BATCH_SIZE);
        console.log(`Fetched batch of ${ nodeAddrs.length } node addresses...`);
        for (let addr of nodeAddrs) {
            // If we already reaced MAX_OPEN_CONNS - wait before continuing...
            while (connectionsStatus.open > MAX_OPEN_CONNS) await new Promise(r => setTimeout(r, 10));
            tryToConnectAndFetchAddrs(addr, connectionsStatus);
        }
    }

    // Wait until we have 0 open connections before finishing
    while (connectionsStatus.open > 0) await new Promise(r => setTimeout(r, 10));

    console.log('FINISHED!');
};

main().then(() => process.exit());