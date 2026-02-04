/**
 * checkCallbackEvents.ts - 检查回调事件
 */

import { ethers } from "hardhat";

async function main() {
    const FEED_PROTOCOL_ADDRESS = "0x5D89Bf9daae4B361315AE7d2dADf6091342B9858";
    const OPTIONS_CORE_ADDRESS = "0x46c6E8d8C979Aab21B0DA03a872F9DBc8EcC1DFb";

    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    console.log("=== Checking FeedProtocol Events ===");

    // 检查 CallbackFailed 事件
    const callbackFailedFilter = feedProtocol.filters.CallbackFailed();
    const callbackFailedEvents = await feedProtocol.queryFilter(callbackFailedFilter, -1000);
    console.log("\nCallbackFailed events:", callbackFailedEvents.length);
    for (const event of callbackFailedEvents) {
        console.log("  - Request ID:", event.args[0].toString());
        console.log("    Order ID:", event.args[1].toString());
        console.log("    Reason:", event.args[2]);
        console.log("    Block:", event.blockNumber);
    }

    // 检查 FeedFinalized 事件
    const feedFinalizedFilter = feedProtocol.filters.FeedFinalized();
    const feedFinalizedEvents = await feedProtocol.queryFilter(feedFinalizedFilter, -1000);
    console.log("\nFeedFinalized events:", feedFinalizedEvents.length);
    for (const event of feedFinalizedEvents) {
        console.log("  - Request ID:", event.args[0].toString());
        console.log("    Final Price:", ethers.formatUnits(event.args[1], 18));
        console.log("    Block:", event.blockNumber);
    }

    // 检查 OptionsCore 的 OrderStatusChanged 事件
    console.log("\n=== Checking OptionsCore Events ===");
    const statusChangedFilter = optionsCore.filters.OrderStatusChanged();
    const statusChangedEvents = await optionsCore.queryFilter(statusChangedFilter, -1000);
    console.log("\nOrderStatusChanged events:", statusChangedEvents.length);
    for (const event of statusChangedEvents) {
        console.log(`  - Order ${event.args[0]}: ${event.args[1]} -> ${event.args[2]}`);
        console.log(`    Reason: ${event.args[3]}`);
        console.log(`    Block: ${event.blockNumber}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
