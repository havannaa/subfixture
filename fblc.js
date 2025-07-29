// fblc.js
const { ApiPromise, WsProvider } = require('@polkadot/api');
const fs = require('fs');
const path = require('path');

async function fetchBlock(api, blockNumber) {
    const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const allRecords = await api.query.system.events.at(blockHash);

    return {
        blockNumber,
        hash: blockHash.toHex(),
        parentHash: signedBlock.block.header.parentHash.toHex(),
        stateRoot: signedBlock.block.header.stateRoot.toHex(),
        extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
        digestLogs: signedBlock.block.header.digest.logs.map(log => log.toHuman()),
        extrinsics: signedBlock.block.extrinsics.map((ex, index) => {
            const { method, signer, args, tip } = ex;
            return {
                index,
                method: `${method.section}.${method.method}`,
                signer: signer?.toString() || null,
                tip: tip?.toString() || null,
                args: args.map(a => a.toString())
            };
        }),
        events: allRecords.map(({ event, phase }, index) => ({
            index,
            section: event.section,
            method: event.method,
            phase: phase.toString(),
            data: event.data.map(d => d.toString())
        }))
    };
}

async function main() {
    const startBlock = parseInt(process.argv[2], 10);
    const endBlock = parseInt(process.argv[3], 10);

    if (isNaN(startBlock) || isNaN(endBlock) || startBlock > endBlock) {
        console.error("❌ Usage: node fblc.js <startBlock> <endBlock>");
        process.exit(1);
    }

    const wsProvider = new WsProvider('wss://7a4102269d7d.ngrok-free.app'); // Change if needed
    const api = await ApiPromise.create({ provider: wsProvider });

    let results = [];
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        console.log(`📦 Fetching block ${blockNumber}...`);
        const blockData = await fetchBlock(api, blockNumber);
        results.push(blockData);
    }

    await api.disconnect();

    // Create file name with range and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `blocks_${startBlock}_${endBlock}_${timestamp}.json`;
    const filePath = path.join(__dirname, fileName);

    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));

    console.log(`✅ Saved ${results.length} blocks to ${filePath}`);
}

main().catch(console.error);

