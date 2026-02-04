/**
 * processOrder.ts
 * 
 * 手动处理指定订单的喂价结果
 * 用法: npx hardhat run scripts/processOrder.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    // 合约地址 - 与 frontend/src/contracts/config.ts 同步 (2026-02-02 部署)
    const FEED_PROTOCOL_ADDRESS = "0xb618341Ce5a762891f0Ffddee7cFc2a4b29D7F36";
    const OPTIONS_CORE_ADDRESS = "0xC03f94273008525950c51052F6AB026823Cb4015";

    // 获取合约实例
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    // 查询下一个请求 ID (用于判断当前有多少请求)
    const nextRequestId = await feedProtocol.nextRequestId();
    console.log("Next Feed Request ID:", nextRequestId.toString());

    // 遍历所有喂价请求，查找已完成但未处理的
    for (let i = 1; i < Number(nextRequestId); i++) {
        try {
            const request = await feedProtocol.feedRequests(i);
            const requestId = Number(request[0]);
            const orderId = Number(request[1]);
            const feedType = Number(request[2]); // 0=Initial, 1=Final
            const finalPrice = request[8];
            const finalized = request[9];

            if (requestId === 0) continue; // 空请求

            console.log(`\nRequest ${i}:`);
            console.log(`  Order ID: ${orderId}`);
            console.log(`  Feed Type: ${feedType === 0 ? 'Initial' : 'Final'}`);
            console.log(`  Final Price: ${ethers.formatUnits(finalPrice, 18)}`);
            console.log(`  Finalized: ${finalized}`);

            if (finalized && finalPrice > 0n) {
                // 检查订单状态
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                console.log(`  Order Status: ${status}`);

                // Status 2 = MATCHED (需要 Initial feed)
                // Status 4 = LIVE (需要 Final feed)
                if (feedType === 0 && status === 2) {
                    console.log(`  -> Processing INITIAL feed for order ${orderId}...`);
                    const tx = await optionsCore.processInitialFeedResult(orderId, finalPrice);
                    await tx.wait();
                    console.log(`  ✅ Order ${orderId} updated to LIVE! TX: ${tx.hash}`);
                } else if (feedType === 1 && status === 4) {
                    console.log(`  -> Processing FINAL feed for order ${orderId}...`);
                    const tx = await optionsCore.processFinalFeedResult(orderId, finalPrice);
                    await tx.wait();
                    console.log(`  ✅ Order ${orderId} updated to PENDING_SETTLEMENT! TX: ${tx.hash}`);
                } else {
                    console.log(`  -> Skipping: already processed or wrong state`);
                }
            }
        } catch (err: any) {
            console.log(`  Error processing request ${i}:`, err.message);
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
