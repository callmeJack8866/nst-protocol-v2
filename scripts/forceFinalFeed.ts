/**
 * forceFinalFeed.ts
 * 
 * 强制处理期末喂价 - 直接将 LIVE/WAITING_FINAL_FEED 订单更新为 PENDING_SETTLEMENT
 * 用法: npx hardhat run scripts/forceFinalFeed.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    // 合约地址 - 与 frontend/src/contracts/config.ts 同步 (2026-02-02 部署)
    const OPTIONS_CORE_ADDRESS = "0xC03f94273008525950c51052F6AB026823Cb4015";

    // 获取合约实例
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    // 订单 ID 和期末喂价价格（从 FeedProtocol Request 5 获取）
    const orderId = 1;
    const finalPrice = ethers.parseUnits("333", 18); // Request 5 的 Final Price

    // 查询订单当前状态
    console.log(`=== Processing Order ${orderId} ===`);
    const orderBefore = await optionsCore.getOrder(orderId);
    console.log(`Current Status: ${Number(orderBefore.status)}`);
    console.log(`Last Feed Price: ${ethers.formatUnits(orderBefore.lastFeedPrice, 18)}`);

    // 尝试调用 processFinalFeedResult
    // 注意: 需要 DEFAULT_ADMIN_ROLE 权限
    console.log(`\nCalling processFinalFeedResult(${orderId}, ${ethers.formatUnits(finalPrice, 18)})...`);

    try {
        const tx = await optionsCore.processFinalFeedResult(orderId, finalPrice);
        console.log(`TX sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Transaction confirmed!`);

        // 查询新状态
        const orderAfter = await optionsCore.getOrder(orderId);
        console.log(`\nNew Status: ${Number(orderAfter.status)}`);
        console.log(`Last Feed Price: ${ethers.formatUnits(orderAfter.lastFeedPrice, 18)}`);
    } catch (err: any) {
        console.log(`❌ Failed: ${err.reason || err.message}`);

        // 如果是权限问题，提示用户
        if (err.message.includes("AccessControl")) {
            console.log("\n⚠️ 当前账户没有 DEFAULT_ADMIN_ROLE 权限!");
            console.log("请确保 .env 中的 PRIVATE_KEY 是合约部署者的私钥。");
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
