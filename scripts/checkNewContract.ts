/**
 * checkNewContract.ts
 * 
 * 检查新部署的合约状态
 */

import { ethers } from "hardhat";

async function main() {
    // 新合约地址
    const OPTIONS_CORE_ADDRESS = "0x46c6E8d8C979Aab21B0DA03a872F9DBc8EcC1DFb";
    const FEED_PROTOCOL_ADDRESS = "0x5D89Bf9daae4B361315AE7d2dADf6091342B9858";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    // 检查喂价请求
    const nextRequestId = await feedProtocol.nextRequestId();
    console.log("=== FeedProtocol Status ===");
    console.log("Next Request ID:", nextRequestId.toString());
    console.log("");

    // 检查 OptionsCore 配置
    const optionsCoreInFeed = await feedProtocol.optionsCore();
    console.log("OptionsCore in FeedProtocol:", optionsCoreInFeed);
    console.log("Expected OptionsCore:", OPTIONS_CORE_ADDRESS);
    console.log("Match:", optionsCoreInFeed.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase());
    console.log("");

    // 检查订单
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("=== OptionsCore Status ===");
    console.log("Next Order ID:", nextOrderId.toString());

    for (let i = 1; i < Number(nextOrderId); i++) {
        const order = await optionsCore.getOrder(i);
        console.log(`\nOrder ${i}:`);
        console.log(`  Buyer: ${order.buyer}`);
        console.log(`  Status: ${Number(order.status)}`);
        console.log(`  Underlying: ${order.underlyingName}`);
        console.log(`  Last Feed Price: ${ethers.formatUnits(order.lastFeedPrice, 18)}`);
    }

    // 检查喂价请求详情
    console.log("\n=== Feed Requests ===");
    for (let i = 1; i < Number(nextRequestId); i++) {
        const request = await feedProtocol.feedRequests(i);
        console.log(`\nRequest ${i}:`);
        console.log(`  Order ID: ${request[1]}`);
        console.log(`  Feed Type: ${Number(request[2]) === 0 ? 'Initial' : 'Final'}`);
        console.log(`  Final Price: ${ethers.formatUnits(request[8], 18)}`);
        console.log(`  Finalized: ${request[9]}`);
        console.log(`  Submitted Count: ${request[7]}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
