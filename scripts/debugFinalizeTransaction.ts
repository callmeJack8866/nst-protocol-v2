/**
 * debugFinalizeTransaction.ts - 检查 Request 2 的 finalize 交易记录
 */

import { ethers } from "hardhat";

async function main() {
    const FEED_PROTOCOL_ADDRESS = "0x5D89Bf9daae4B361315AE7d2dADf6091342B9858";
    const OPTIONS_CORE_ADDRESS = "0x46c6E8d8C979Aab21B0DA03a872F9DBc8EcC1DFb";

    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    // 获取 Request 2 的 FeedFinalized 事件交易
    const feedFinalizedFilter = feedProtocol.filters.FeedFinalized(2);
    const events = await feedProtocol.queryFilter(feedFinalizedFilter)

    if (events.length > 0) {
        const event = events[0];
        console.log("=== FeedFinalized Event for Request 2 ===");
        console.log("TX Hash:", event.transactionHash);
        console.log("Block:", event.blockNumber);

        // 获取交易收据查看所有事件
        const receipt = await ethers.provider.getTransactionReceipt(event.transactionHash);
        console.log("\n=== Transaction Receipt ===");
        console.log("Status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
        console.log("Gas Used:", receipt?.gasUsed.toString());
        console.log("Logs count:", receipt?.logs.length);

        // 解析所有日志
        console.log("\n=== All Logs ===");
        for (const log of receipt?.logs || []) {
            console.log(`Log #${log.index}:`);
            console.log(`  Address: ${log.address}`);
            console.log(`  Topics[0]: ${log.topics[0]?.slice(0, 20)}...`);
        }
    } else {
        console.log("No FeedFinalized event found for Request 2");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
