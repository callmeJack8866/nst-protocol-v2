/**
 * redeploy-config-and-optionscore.ts
 * 
 * 重部署 Config + OptionsCore（Config 新增了 minArbitrationWindow 等校验参数）
 * 
 * 步骤：
 * 1. 部署新 Config
 * 2. 设置 Config 中的合约地址
 * 3. 部署新 OptionsCore（使用新 Config）
 * 4. 配置所有跨合约角色
 * 5. 更新 FeedProtocol/OptionsSettlement/VaultManager 的 Config 引用
 * 6. 更新 deployed-addresses.json
 * 7. 验证
 * 
 * 用法: npx hardhat run scripts/redeploy-config-and-optionscore.ts --network bscTestnet
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("  NST - Config + OptionsCore 联合重部署");
    console.log("=".repeat(60));
    console.log(`  Network:  ${network.name}`);
    console.log(`  Deployer: ${deployer.address}\n`);

    const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    const VAULT_MANAGER = addresses.VaultManager;
    const USDT = addresses.USDT;
    const FEED_PROTOCOL = addresses.FeedProtocol;
    const SETTLEMENT = addresses.OptionsSettlement;
    const OLD_OPTIONS_CORE = addresses.OptionsCore;
    const OLD_CONFIG = addresses.Config;
    const SEAT_MANAGER = addresses.SeatManager;
    const POINTS_MANAGER = addresses.PointsManager;

    // ==================== 1. 部署新 Config ====================
    console.log("1. 部署新 Config...");
    const ConfigFactory = await ethers.getContractFactory("Config");
    const newConfig = await ConfigFactory.deploy(deployer.address);
    await newConfig.waitForDeployment();
    const newConfigAddr = await newConfig.getAddress();
    console.log(`   OK: ${newConfigAddr}`);

    // ==================== 2. 设置 Config 中的合约地址 ====================
    console.log("\n2. 设置 Config 合约地址...");
    await (await newConfig.setUsdtAddress(USDT)).wait();
    await (await newConfig.setVaultManagerAddress(VAULT_MANAGER)).wait();
    await (await newConfig.setFeedProtocolAddress(FEED_PROTOCOL)).wait();
    await (await newConfig.setSeatManagerAddress(SEAT_MANAGER)).wait();
    await (await newConfig.setPointsManagerAddress(POINTS_MANAGER)).wait();
    console.log("   OK: USDT/VaultManager/FeedProtocol/SeatManager/PointsManager 已设置");

    // ==================== 3. 部署新 OptionsCore ====================
    console.log("\n3. 部署新 OptionsCore...");
    const OptionsCoreFactory = await ethers.getContractFactory("OptionsCore");
    const newOptionsCore = await OptionsCoreFactory.deploy(
        newConfigAddr,
        VAULT_MANAGER,
        USDT,
        deployer.address
    );
    await newOptionsCore.waitForDeployment();
    const newOCAddr = await newOptionsCore.getAddress();
    console.log(`   OK: ${newOCAddr}`);

    // 更新 Config 中的 OptionsCore 地址
    await (await newConfig.setOptionsCoreAddress(newOCAddr)).wait();
    console.log("   Config.optionsCoreAddress 已更新");

    // ==================== 4. 配置角色 ====================
    console.log("\n4. 配置跨合约角色...");
    
    // 4a. VaultManager → 新 OptionsCore VAULT_OPERATOR_ROLE
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER);
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    await (await vaultManager.grantRole(VAULT_OPERATOR_ROLE, newOCAddr)).wait();
    console.log("   a. VaultManager → OptionsCore VAULT_OPERATOR_ROLE: OK");

    // 4b. 新 OptionsCore → FeedProtocol FEED_PROTOCOL_ROLE
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    await (await newOptionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL)).wait();
    console.log("   b. OptionsCore → FeedProtocol FEED_PROTOCOL_ROLE: OK");

    // 4c. 新 OptionsCore → OptionsSettlement SETTLEMENT_ROLE
    const SETTLEMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
    await (await newOptionsCore.grantRole(SETTLEMENT_ROLE, SETTLEMENT)).wait();
    console.log("   c. OptionsCore → Settlement SETTLEMENT_ROLE: OK");

    // 4d. FeedProtocol → 新 OptionsCore PROTOCOL_ROLE
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL);
    const PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE"));
    await (await feedProtocol.grantRole(PROTOCOL_ROLE, newOCAddr)).wait();
    console.log("   d. FeedProtocol → OptionsCore PROTOCOL_ROLE: OK");

    // ==================== 5. 更新跨合约引用 ====================
    console.log("\n5. 更新跨合约引用...");

    // 5a. FeedProtocol.setOptionsCore
    await (await feedProtocol.setOptionsCore(newOCAddr)).wait();
    console.log("   a. FeedProtocol.optionsCore → " + await feedProtocol.optionsCore());

    // 5b. OptionsSettlement.setOptionsCore + setConfig
    const settlement = await ethers.getContractAt("OptionsSettlement", SETTLEMENT);
    await (await settlement.setOptionsCore(newOCAddr)).wait();
    await (await settlement.setConfig(newConfigAddr)).wait();
    console.log("   b. Settlement.optionsCore → " + await settlement.optionsCore());
    console.log("   b. Settlement.config → " + newConfigAddr);

    // 5c. VaultManager.setConfig
    await (await vaultManager.setConfig(newConfigAddr)).wait();
    console.log("   c. VaultManager.config → " + newConfigAddr);

    // ==================== 6. FeedProtocol Tier 配置 ====================
    console.log("\n6. 设置测试网 Tier 配置...");
    await (await feedProtocol.setTierConfig(
        0, 1, 1,
        ethers.parseEther("0.3"),
        ethers.parseEther("2.7"),
        ethers.parseEther("3")
    )).wait();
    console.log("   Tier_5_3: 1人即可喂价");

    // ==================== 7. 撤销旧角色 ====================
    console.log("\n7. 撤销旧合约角色...");
    try {
        const oldHas = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OLD_OPTIONS_CORE);
        if (oldHas) {
            await (await vaultManager.revokeRole(VAULT_OPERATOR_ROLE, OLD_OPTIONS_CORE)).wait();
            console.log("   旧 OptionsCore VAULT_OPERATOR_ROLE 已撤销");
        }
    } catch {}

    // ==================== 8. 更新 deployed-addresses.json ====================
    console.log("\n8. 更新 deployed-addresses.json...");
    addresses.Config = newConfigAddr;
    addresses.OptionsCore = newOCAddr;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("   已更新");

    // ==================== 9. 验证 ====================
    console.log("\n9. 验证...");
    // 验证 Config 新增参数
    console.log("   Config.minArbitrationWindow:", (await newConfig.minArbitrationWindow()).toString());
    console.log("   Config.maxArbitrationWindow:", (await newConfig.maxArbitrationWindow()).toString());
    console.log("   Config.minMarginCallDeadline:", (await newConfig.minMarginCallDeadline()).toString());
    console.log("   Config.maxMarginCallDeadline:", (await newConfig.maxMarginCallDeadline()).toString());
    console.log("   Config.maxConsecutiveDays:", (await newConfig.maxConsecutiveDays()).toString());
    console.log("   Config.creationFee:", ethers.formatEther(await newConfig.creationFee()));

    // 验证角色
    console.log("   VAULT_OPERATOR_ROLE:", await vaultManager.hasRole(VAULT_OPERATOR_ROLE, newOCAddr));
    console.log("   FEED_PROTOCOL_ROLE:", await newOptionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL));
    console.log("   SETTLEMENT_ROLE:", await newOptionsCore.hasRole(SETTLEMENT_ROLE, SETTLEMENT));
    console.log("   PROTOCOL_ROLE:", await feedProtocol.hasRole(PROTOCOL_ROLE, newOCAddr));

    console.log("\n" + "=".repeat(60));
    console.log("  部署完成!");
    console.log("=".repeat(60));
    console.log(`  新 Config:      ${newConfigAddr}`);
    console.log(`  新 OptionsCore: ${newOCAddr}`);
    console.log("\n  请手动替换以下文件中的地址：");
    console.log(`  1. frontend/src/contracts/config.ts`);
    console.log(`  2. scripts/keeper/utils.ts`);
    console.log(`  3. scripts/test-full-flow.ts`);
    console.log(`  4. scripts/integration-test.ts`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("部署失败:", error);
        process.exit(1);
    });
