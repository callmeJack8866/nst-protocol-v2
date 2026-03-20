/**
 * deploy-split-contracts.ts
 *
 * 部署拆分后的 OptionsCore + OptionsSettlement 合约
 * 并配置互相授权：
 *   - OptionsSettlement 获得 OptionsCore 的 SETTLEMENT_ROLE
 *   - FeedEngine 钱包获得 OptionsCore 的 FEED_PROTOCOL_ROLE
 *
 * 用法: npx hardhat run scripts/deploy-split-contracts.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying with account:", deployer.address);

    // 现有合约地址
    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";
    const ADMIN_ADDRESS = deployer.address;

    // FeedEngine 后端钱包（用于 FEED_PROTOCOL_ROLE）
    const FEED_ENGINE_WALLET = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";

    // ==================== 1. 部署 OptionsCore ====================
    console.log("\n=== 部署 OptionsCore (精简版，含 FeedRequestEmitted) ===");
    const OptionsCoreFactory = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCoreFactory.deploy(
        CONFIG_ADDRESS,
        VAULT_MANAGER_ADDRESS,
        USDT_ADDRESS,
        ADMIN_ADDRESS
    );
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();
    console.log("✅ OptionsCore deployed:", optionsCoreAddress);

    // ==================== 2. 部署 OptionsSettlement ====================
    console.log("\n=== 部署 OptionsSettlement (结算/保证金/仲裁) ===");
    const OptionsSettlementFactory = await ethers.getContractFactory("OptionsSettlement");
    const optionsSettlement = await OptionsSettlementFactory.deploy(
        optionsCoreAddress,
        CONFIG_ADDRESS,
        VAULT_MANAGER_ADDRESS,
        USDT_ADDRESS,
        ADMIN_ADDRESS
    );
    await optionsSettlement.waitForDeployment();
    const settlementAddress = await optionsSettlement.getAddress();
    console.log("✅ OptionsSettlement deployed:", settlementAddress);

    // ==================== 3. 授予角色 ====================
    console.log("\n=== 配置角色授权 ===");

    // 3a. SETTLEMENT_ROLE → OptionsSettlement 合约
    const SETTLEMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
    const tx1 = await optionsCore.grantRole(SETTLEMENT_ROLE, settlementAddress);
    await tx1.wait();
    console.log("✅ SETTLEMENT_ROLE granted to OptionsSettlement");

    // 3b. FEED_PROTOCOL_ROLE → FeedEngine 钱包
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const tx2 = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_WALLET);
    await tx2.wait();
    console.log("✅ FEED_PROTOCOL_ROLE granted to FeedEngine:", FEED_ENGINE_WALLET);

    // ==================== 4. 验证 ====================
    console.log("\n=== 验证角色 ===");
    const hasSettlement = await optionsCore.hasRole(SETTLEMENT_ROLE, settlementAddress);
    const hasFeed = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_WALLET);
    console.log("Settlement role verified:", hasSettlement ? "✅" : "❌");
    console.log("Feed protocol role verified:", hasFeed ? "✅" : "❌");

    // ==================== 5. 输出配置 ====================
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              部署完成 — 更新以下配置文件                      ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║ OptionsCore:       ${optionsCoreAddress}  ║`);
    console.log(`║ OptionsSettlement: ${settlementAddress}  ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  1. NST frontend/src/contracts/config.ts:                    ║");
    console.log(`║     OptionsCore: '${optionsCoreAddress}'       ║`);
    console.log(`║     OptionsSettlement: '${settlementAddress}'  ║`);
    console.log("║                                                              ║");
    console.log("║  2. FeedEngine .env:                                         ║");
    console.log(`║     NST_OPTIONS_CORE_CONTRACT=${optionsCoreAddress}           ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
