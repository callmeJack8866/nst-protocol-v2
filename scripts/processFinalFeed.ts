/**
 * processFinalFeed.ts
 * 
 * 专门处理期末喂价 - 将 LIVE 订单更新为 PENDING_SETTLEMENT
 * 用法: npx hardhat run scripts/processFinalFeed.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    // 合约地址 - 与 frontend/src/contracts/config.ts 同步 (2026-02-02 部署)
    const FEED_PROTOCOL_ADDRESS = "0xb618341Ce5a762891f0Ffddee7cFc2a4b29D7F36";
    const OPTIONS_CORE_ADDRESS = "0xC03f94273008525950c51052F6AB026823Cb4015";

    // 获取合约实例
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    // 查询订单 1 的当前状态
    console.log("=== Checking Order 1 ===");
    const order1 = await optionsCore.getOrder(1);
    console.log("Order 1 Status:", Number(order1.status));
    console.log("Order 1 exercised:", order1.exercised);
    console.log("Order 1 refPrice:", order1.refPrice);
    console.log("Order 1 lastFeedPrice:", ethers.formatUnits(order1.lastFeedPrice, 18));

    // 查询所有期末喂价请求
    const nextRequestId = await feedProtocol.nextRequestId();
    console.log("\n=== Checking Final Feed Requests ===");
    console.log("Total Requests:", Number(nextRequestId) - 1);

    for (let i = 1; i < Number(nextRequestId); i++) {
        const request = await feedProtocol.feedRequests(i);
        const orderId = Number(request[1]);
        const feedType = Number(request[2]); // 0=Initial, 1=Final
        const finalPrice = request[8];
        const finalized = request[9];

        if (feedType === 1 && finalized && finalPrice > 0n) {
            console.log(`\nRequest ${i}: Final Feed for Order ${orderId}`);
            console.log(`  Final Price: ${ethers.formatUnits(finalPrice, 18)}`);

            // 获取当前订单状态
            const order = await optionsCore.getOrder(orderId);
            const status = Number(order.status);
            console.log(`  Current Order Status: ${status}`);
            console.log(`  Order exercised: ${order.exercised}`);

            // 状态说明: 
            // 2 = MATCHED, 4 = LIVE, 5 = WAITING_FINAL_FEED, 6 = PENDING_SETTLEMENT
            if (status === 4 || status === 5) {
                console.log(`  -> Attempting to process Final feed...`);
                try {
                    const tx = await optionsCore.processFinalFeedResult(orderId, finalPrice);
                    await tx.wait();
                    console.log(`  ✅ Order ${orderId} updated! TX: ${tx.hash}`);

                    // 读取新状态
                    const newOrder = await optionsCore.getOrder(orderId);
                    console.log(`  New Status: ${Number(newOrder.status)}`);
                } catch (err: any) {
                    console.log(`  ❌ Failed:`, err.reason || err.message);
                }
            } else {
                console.log(`  -> Skipping: Order status ${status} not eligible`);
            }
        }
    }

    console.log("\n--- Done ---");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
