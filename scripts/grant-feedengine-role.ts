/**
 * grant-feedengine-role.ts
 *
 * 在现有 OptionsCore 合约上授权 FeedEngine 后端钱包 FEED_PROTOCOL_ROLE
 * 无需重新部署合约
 *
 * 用法: npx hardhat run scripts/grant-feedengine-role.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔑 Using account:", deployer.address);

    // 现有 OptionsCore 合约地址
    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";

    // FeedEngine 后端钱包地址
    const FEED_ENGINE_WALLET = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";

    // 连接到现有合约
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    console.log("📋 OptionsCore:", OPTIONS_CORE_ADDRESS);

    // 计算 FEED_PROTOCOL_ROLE
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    console.log("🔐 FEED_PROTOCOL_ROLE:", FEED_PROTOCOL_ROLE);

    // 检查是否已授权
    const hasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_WALLET);
    if (hasRole) {
        console.log("✅ FeedEngine 钱包已拥有 FEED_PROTOCOL_ROLE，无需重复授权");
        return;
    }

    // 授权
    console.log(`\n授权 FEED_PROTOCOL_ROLE 给 FeedEngine 钱包: ${FEED_ENGINE_WALLET}`);
    const tx = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_WALLET);
    console.log("⏳ 交易已提交:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ 授权成功! Block:", receipt?.blockNumber);

    // 验证
    const verified = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_WALLET);
    console.log("🔍 验证:", verified ? "✅ 角色已确认" : "❌ 角色授权失败");

    console.log("\n╔═══════════════════════════════════════════════════╗");
    console.log("║         授权完成 — FeedEngine 联调就绪              ║");
    console.log("╠═══════════════════════════════════════════════════╣");
    console.log(`║ OptionsCore:  ${OPTIONS_CORE_ADDRESS}  ║`);
    console.log(`║ FeedEngine:   ${FEED_ENGINE_WALLET}  ║`);
    console.log("╠═══════════════════════════════════════════════════╣");
    console.log("║  更新 FeedEngine .env:                             ║");
    console.log(`║  NST_OPTIONS_CORE_CONTRACT=${OPTIONS_CORE_ADDRESS} ║`);
    console.log("╚═══════════════════════════════════════════════════╝");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
