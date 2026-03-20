/**
 * redeploy-optionscore.ts
 * 
 * 一键重部署 OptionsCore（修复 onFeedRequested / processFeedCallback 缺失）
 * 
 * 步骤：
 * 1. 部署新 OptionsCore（最新源码）
 * 2. VaultManager 授予新 OptionsCore VAULT_OPERATOR_ROLE
 * 3. 新 OptionsCore 授予 FeedProtocol FEED_PROTOCOL_ROLE
 * 4. 新 OptionsCore 授予 OptionsSettlement SETTLEMENT_ROLE
 * 5. FeedProtocol.setOptionsCore → 新 OptionsCore
 * 6. OptionsSettlement.setOptionsCore → 新 OptionsCore
 * 7. FeedProtocol 授予 OptionsCore PROTOCOL_ROLE（允许 requestFeed 调用）
 * 8. 设置测试网 tier 配置（1 人即可喂价）
 * 9. (可选) 撤销旧 OptionsCore 在 VaultManager 的角色
 * 10. 自动更新 deployed-addresses.json
 * 11. 验证所有角色
 * 
 * 用法: npx hardhat run scripts/redeploy-optionscore.ts --network bscTestnet
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("═".repeat(60));
    console.log("  NST - OptionsCore 重部署（含 onFeedRequested 修复）");
    console.log("═".repeat(60));
    console.log(`  Network:  ${network.name}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log("");

    // ==================== 地址配置 ====================
    const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    const CONFIG_ADDRESS = addresses.Config;
    const VAULT_MANAGER_ADDRESS = addresses.VaultManager;
    const USDT_ADDRESS = addresses.USDT;
    const OPTIONS_SETTLEMENT_ADDRESS = addresses.OptionsSettlement;
    const FEED_PROTOCOL_ADDRESS = addresses.FeedProtocol;
    const OLD_OPTIONS_CORE = addresses.OptionsCore;

    console.log("  现有地址:");
    console.log(`    Config:             ${CONFIG_ADDRESS}`);
    console.log(`    VaultManager:       ${VAULT_MANAGER_ADDRESS}`);
    console.log(`    USDT:               ${USDT_ADDRESS}`);
    console.log(`    OptionsSettlement:  ${OPTIONS_SETTLEMENT_ADDRESS}`);
    console.log(`    FeedProtocol:       ${FEED_PROTOCOL_ADDRESS}`);
    console.log(`    旧 OptionsCore:     ${OLD_OPTIONS_CORE}`);
    console.log("");

    // ==================== Step 1: 部署新 OptionsCore ====================
    console.log("1️⃣  部署新 OptionsCore...");
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        CONFIG_ADDRESS,
        VAULT_MANAGER_ADDRESS,
        USDT_ADDRESS,
        deployer.address
    );
    await optionsCore.waitForDeployment();
    const newAddress = await optionsCore.getAddress();
    console.log(`   ✅ 新 OptionsCore 已部署: ${newAddress}`);

    // ==================== Step 2: VaultManager 授予 VAULT_OPERATOR_ROLE ====================
    console.log("\n2️⃣  VaultManager 授予新 OptionsCore VAULT_OPERATOR_ROLE...");
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    await (await vaultManager.grantRole(VAULT_OPERATOR_ROLE, newAddress)).wait();
    const hasVM = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, newAddress);
    console.log(`   ✅ 新 OptionsCore has VAULT_OPERATOR_ROLE: ${hasVM}`);

    // ==================== Step 3: 授予 FeedProtocol FEED_PROTOCOL_ROLE ====================
    console.log("\n3️⃣  新 OptionsCore 授予 FeedProtocol FEED_PROTOCOL_ROLE...");
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    await (await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS)).wait();
    const hasFPR = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
    console.log(`   ✅ FeedProtocol has FEED_PROTOCOL_ROLE: ${hasFPR}`);

    // 同时授予 FeedEngine 后端钱包（keeper 后备路径）
    const FEED_ENGINE_WALLET = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";
    try {
        await (await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_ENGINE_WALLET)).wait();
        console.log(`   ✅ FeedEngine 钱包 also has FEED_PROTOCOL_ROLE`);
    } catch (e: any) {
        console.log(`   ⚠  FeedEngine 钱包授权失败 (非致命): ${e.message?.slice(0, 80)}`);
    }

    // ==================== Step 4: 授予 OptionsSettlement SETTLEMENT_ROLE ====================
    console.log("\n4️⃣  新 OptionsCore 授予 OptionsSettlement SETTLEMENT_ROLE...");
    const SETTLEMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
    await (await optionsCore.grantRole(SETTLEMENT_ROLE, OPTIONS_SETTLEMENT_ADDRESS)).wait();
    const hasSR = await optionsCore.hasRole(SETTLEMENT_ROLE, OPTIONS_SETTLEMENT_ADDRESS);
    console.log(`   ✅ OptionsSettlement has SETTLEMENT_ROLE: ${hasSR}`);

    // ==================== Step 5: FeedProtocol.setOptionsCore ====================
    console.log("\n5️⃣  FeedProtocol.setOptionsCore → 新 OptionsCore...");
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    await (await feedProtocol.setOptionsCore(newAddress)).wait();
    const fpOC = await feedProtocol.optionsCore();
    console.log(`   ✅ FeedProtocol.optionsCore() = ${fpOC}`);

    // ==================== Step 6: OptionsSettlement.setOptionsCore ====================
    console.log("\n6️⃣  OptionsSettlement.setOptionsCore → 新 OptionsCore...");
    const optionsSettlement = await ethers.getContractAt("OptionsSettlement", OPTIONS_SETTLEMENT_ADDRESS);
    await (await optionsSettlement.setOptionsCore(newAddress)).wait();
    const osOC = await optionsSettlement.optionsCore();
    console.log(`   ✅ OptionsSettlement.optionsCore() = ${osOC}`);

    // ==================== Step 7: FeedProtocol 授予 OptionsCore PROTOCOL_ROLE ====================
    console.log("\n7️⃣  FeedProtocol 授予新 OptionsCore PROTOCOL_ROLE...");
    const PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE"));
    await (await feedProtocol.grantRole(PROTOCOL_ROLE, newAddress)).wait();
    const hasPR = await feedProtocol.hasRole(PROTOCOL_ROLE, newAddress);
    console.log(`   ✅ 新 OptionsCore has PROTOCOL_ROLE on FeedProtocol: ${hasPR}`);

    // ==================== Step 8: 设置测试网 tier 配置 ====================
    console.log("\n8️⃣  设置测试网 Tier 配置（1 人即可喂价）...");
    await (await feedProtocol.setTierConfig(
        0,                          // Tier_5_3
        1,                          // totalFeeders = 1
        1,                          // effectiveFeeds = 1
        ethers.parseEther("0.3"),   // platformFee
        ethers.parseEther("2.7"),   // feederReward
        ethers.parseEther("3")      // totalFee = 3 USDT
    )).wait();
    const tier0 = await feedProtocol.tierConfigs(0);
    console.log(`   ✅ Tier_5_3: totalFeeders=${tier0.totalFeeders}, effectiveFeeds=${tier0.effectiveFeeds}`);

    // ==================== Step 9: 撤销旧 OptionsCore 角色 ====================
    console.log("\n9️⃣  撤销旧 OptionsCore 的角色...");
    try {
        const oldHasVM = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OLD_OPTIONS_CORE);
        if (oldHasVM) {
            await (await vaultManager.revokeRole(VAULT_OPERATOR_ROLE, OLD_OPTIONS_CORE)).wait();
            console.log(`   ✅ 旧 OptionsCore VAULT_OPERATOR_ROLE 已撤销`);
        } else {
            console.log(`   ⏭  旧 OptionsCore 本就没有 VAULT_OPERATOR_ROLE`);
        }
    } catch (e: any) {
        console.log(`   ⚠  撤销失败 (非致命): ${e.message?.slice(0, 100)}`);
    }

    // ==================== Step 10: 更新 deployed-addresses.json ====================
    console.log("\n🔟  更新 deployed-addresses.json...");
    addresses.OptionsCore = newAddress;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`   ✅ deployed-addresses.json 已更新`);

    // ==================== Step 11: 角色验证汇总 ====================
    console.log("\n📋  角色验证汇总:");
    console.log(`   VaultManager → 新OptionsCore VAULT_OPERATOR_ROLE: ${await vaultManager.hasRole(VAULT_OPERATOR_ROLE, newAddress)}`);
    console.log(`   新OptionsCore → FeedProtocol FEED_PROTOCOL_ROLE:  ${await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS)}`);
    console.log(`   新OptionsCore → Settlement   SETTLEMENT_ROLE:     ${await optionsCore.hasRole(SETTLEMENT_ROLE, OPTIONS_SETTLEMENT_ADDRESS)}`);
    console.log(`   FeedProtocol → 新OptionsCore PROTOCOL_ROLE:       ${await feedProtocol.hasRole(PROTOCOL_ROLE, newAddress)}`);
    console.log(`   FeedProtocol.optionsCore() = ${await feedProtocol.optionsCore()}`);
    console.log(`   Settlement.optionsCore()   = ${await optionsSettlement.optionsCore()}`);

    // ==================== 完成 ====================
    console.log("\n" + "═".repeat(60));
    console.log("  ✅ OptionsCore 重部署完成!");
    console.log("═".repeat(60));
    console.log(`  新地址: ${newAddress}`);
    console.log("");
    console.log("  ⚠  请手动更新以下文件中的 OptionsCore 地址：");
    console.log(`  1. frontend/src/contracts/config.ts`);
    console.log(`     OptionsCore: '${newAddress}',`);
    console.log(`  2. scripts/keeper/utils.ts`);
    console.log(`     OptionsCore: '${newAddress}',`);
    console.log(`  3. scripts/test-full-flow.ts`);
    console.log(`     OPTIONS_CORE_ADDRESS = '${newAddress}'`);
    console.log(`  4. scripts/integration-test.ts`);
    console.log(`     OptionsCore: '${newAddress}',`);
    console.log("═".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    });
