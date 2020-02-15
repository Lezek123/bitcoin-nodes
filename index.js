const
    { tryToConnectAndFetchAddrs, newConnectionPossible, noOpenConnections } = require('./helpers/connections'),
    { getNodesToConnBatch, getNodesCount } = require('./helpers/db');

const DB_NODE_FETCH_BATCH_SIZE = 1000;

const main = async () => {

    let nodesCount = await getNodesCount();
    console.log('Total node count:', nodesCount);

    let previousBatchLastNode = null;
    let batchNumber = 0;
    let nodes = [];

    while ((nodes = await getNodesToConnBatch(DB_NODE_FETCH_BATCH_SIZE, previousBatchLastNode)).length) {
        console.log(`Fetched batch of ${ nodes.length } nodes (batch nr ${ ++batchNumber })...`);
        for (let node of nodes) {
            // If we already reached MAX_OPEN_CONNS - wait before continuing...
            await newConnectionPossible();
            // Sleep for 10 ms before each connection to allow some other async operations to execute
            await new Promise(r => setTimeout(r, 10));
            tryToConnectAndFetchAddrs(node.address);
        }
        previousBatchLastNode = nodes[nodes.length - 1];
    }

    // Wait until we have 0 open connections before finishing
    await noOpenConnections();
};

main()
    .then(() => {
        console.log('FINISHED!');
        process.exit();
    })
    .catch(e => {
        console.log(e);
        process.exit();
    });