/**
 * deploy-feedengine-integration.ts
 *
 * 联调部署脚本：重新部署 OptionsCore（含 requestFeed + processFeedCallback）
 * 并授权 FeedEngine 后端钱包 FEED_PROTOCOL_ROLE
 *
 * 用法: npx hardhat run scripts/deploy-feedengine-integration.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying with account:", deployer.address);

    // ==================== 已有合约地址（不变） ====================
    const CONFIG_ADDRESS = "0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea";
    const VAULT_MANAGER_ADDRESS = "0xa81cCaE9b7aBfb2a24982A8FcA1A8Dd54dD49E54";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";

    // ==================== FeedEngine 后端钱包地址 ====================
    // ⚠️ 部署前请替换为 FeedEngine 后端 .env 中 BACKEND_PRIVATE_KEY 对应的钱包地址
    const FEED_ENGINE_BACKEND_WALLET = process.env.FEED_ENGINE_WALLET || "";
    if (!FEED_ENGINE_BACKEND_WALLET) {
        console.error("❌ 请设置 FEED_ENGINE_WALLET 环境变量（FeedEngine 后端钱包地址）");
        console.log("   用法: FEED_ENGINE_WALLET=0x... npx hardhat run scripts/deploy-feedengine-integration.ts --network bscTestnet");
        process.exit(1);
    }

    // ==================== 1. 部署新 OptionsCore ====================
    console.log("\n=== 部署新版 OptionsCore (含 FeedEngine 集成) ===");
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        CONFIG_ADDRESS,
        VAULT_MANAGER_ADDRESS,
        USDT_ADDRESS,
        deployer.address // admin
    );
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();
    console.log("✅ OptionsCore deployed to:", optionsCoreAddress);

    // ==================== 2. 授权 FeedEngine 后端钱包 ====================
    console.log("\n=== 授权 FeedEngine 后端钱包 FEED_PROTOCOL_ROLE ===");
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const tx = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_BACKEND_WALLET);
    await tx.wait();
    console.log("✅ FEED_PROTOCOL_ROLE 已授予:", FEED_ENGINE_BACKEND_WALLET);

    // ==================== 3. 输出配置信息 ====================
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║              联调部署完成 — 请更新以下配置                   ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║ OptionsCore:  ${optionsCoreAddress}  ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║                                                              ║");
    console.log("║  1. NST 前端:                                                ║");
    console.log("║     frontend/src/contracts/config.ts                          ║");
    console.log("║                                                              ║");
    console.log("║  2. NST Keeper 脚本:                                         ║");
    console.log("║     scripts/keeper/utils.ts                                   ║");
    console.log("║                                                              ║");
    console.log("║  3. FeedEngine 后端 .env:                                     ║");
    console.log(`║     NST_OPTIONS_CORE_CONTRACT=${optionsCoreAddress}            ║`);
    console.log("║                                                              ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
