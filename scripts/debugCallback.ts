/**
 * debugCallback.ts - 调试回调机制
 */

import { ethers } from "hardhat";

async function main() {
    const FEED_PROTOCOL_ADDRESS = "0x5D89Bf9daae4B361315AE7d2dADf6091342B9858";
    const OPTIONS_CORE_ADDRESS = "0x46c6E8d8C979Aab21B0DA03a872F9DBc8EcC1DFb";

    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    console.log("=== Verifying Configuration ===");

    // 1. 检查 FeedProtocol 中配置的 OptionsCore 地址
    const optionsCoreInFeed = await feedProtocol.optionsCore();
    console.log("OptionsCore in FeedProtocol:", optionsCoreInFeed);
    console.log("Expected OptionsCore:", OPTIONS_CORE_ADDRESS);
    console.log("Match:", optionsCoreInFeed.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase());

    // 2. 检查 OptionsCore 是否授予了 FEED_PROTOCOL_ROLE 给 FeedProtocol
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const hasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
    console.log("\nFEED_PROTOCOL_ROLE granted to FeedProtocol:", hasRole);

    // 3. 检查订单状态
    const order = await optionsCore.getOrder(1);
    console.log("\n=== Order 1 Status ===");
    console.log("Status:", Number(order.status));
    console.log("Expected for PENDING_SETTLEMENT:", 6);
    console.log("Expected for WAITING_FINAL_FEED:", 5);

    // 4. 手动尝试调用 processFeedCallback 来测试
    console.log("\n=== Testing processFeedCallback ===");
    try {
        // 以 admin 身份调用
        const [signer] = await ethers.getSigners();

        // 先检查 signer 是否有权限模拟 FeedProtocol
        console.log("Signer:", signer.address);

        // 尝试直接调用 processFeedCallback（作为 FeedProtocol）
        // 需要用 FeedProtocol 的角色来调用
        console.log("Trying to call processFeedCallback with FeedType=Final...");

        // 获取 feedType=1 (Final)
        // 由于我们的账户没有 FEED_PROTOCOL_ROLE，这会失败
        // 但如果失败原因是 "not in valid state" 则说明角色权限没问题

        // 或者我们可以直接调用 processFinalFeedResult（需要 admin 角色）
        console.log("Calling processFinalFeedResult directly...");
        const tx = await optionsCore.processFinalFeedResult(1, ethers.parseUnits("12", 18));
        console.log("TX sent:", tx.hash);
        await tx.wait();
        console.log("✓ Order status updated to PENDING_SETTLEMENT!");

    } catch (err: any) {
        console.log("Error:", err.message || err);
    }

    // 5. 重新检查订单状态
    const orderAfter = await optionsCore.getOrder(1);
    console.log("\n=== Order 1 Status After ===");
    console.log("Status:", Number(orderAfter.status));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
