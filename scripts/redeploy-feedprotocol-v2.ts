/**
 * redeploy-feedprotocol-v2.ts
 * 
 * 一键重部署 FeedProtocol 合约（修复 onFeedRequested 回调缺失问题）
 * 
 * 步骤：
 * 1. 部署新 FeedProtocol（使用最新源码，包含 onFeedRequested 回调）
 * 2. 在新 FeedProtocol 上 setOptionsCore
 * 3. 在新 FeedProtocol 上 grantProtocolRole 给 OptionsCore（让 OptionsCore.requestFeed 能调用 createFeedRequest）
 * 4. 在 OptionsCore 上 grantRole(FEED_PROTOCOL_ROLE) 给新 FeedProtocol（让新 FeedProtocol 能调用 onFeedRequested / processFeedCallback）
 * 5. (可选) 撤销旧 FeedProtocol 的 FEED_PROTOCOL_ROLE
 * 6. 自动更新 deployed-addresses.json
 * 7. 打印需要手动更新的文件列表
 * 
 * 用法: npx hardhat run scripts/redeploy-feedprotocol-v2.ts --network bscTestnet
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("═".repeat(60));
    console.log("  NST - FeedProtocol 重部署（含 onFeedRequested 回调修复）");
    console.log("═".repeat(60));
    console.log(`  Network:  ${network.name}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log("");

    // ==================== 地址配置 ====================
    const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    const CONFIG_ADDRESS = addresses.Config;
    const USDT_ADDRESS = addresses.USDT;
    const OPTIONS_CORE_ADDRESS = addresses.OptionsCore;
    const OLD_FEED_PROTOCOL = addresses.FeedProtocol;

    console.log("  现有地址:");
    console.log(`    Config:           ${CONFIG_ADDRESS}`);
    console.log(`    USDT:             ${USDT_ADDRESS}`);
    console.log(`    OptionsCore:      ${OPTIONS_CORE_ADDRESS}`);
    console.log(`    旧 FeedProtocol:  ${OLD_FEED_PROTOCOL}`);
    console.log("");

    // ==================== Step 1: 部署新 FeedProtocol ====================
    console.log("1️⃣  部署新 FeedProtocol...");
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(CONFIG_ADDRESS, USDT_ADDRESS, deployer.address);
    await feedProtocol.waitForDeployment();
    const newAddress = await feedProtocol.getAddress();
    console.log(`   ✅ 新 FeedProtocol 已部署: ${newAddress}`);

    // ==================== Step 2: setOptionsCore ====================
    console.log("\n2️⃣  设置 OptionsCore 引用...");
    await (await feedProtocol.setOptionsCore(OPTIONS_CORE_ADDRESS)).wait();
    // 验证
    const storedOC = await feedProtocol.optionsCore();
    if (storedOC.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase()) {
        console.log(`   ✅ feedProtocol.optionsCore() = ${storedOC}`);
    } else {
        console.log(`   ❌ 验证失败! 期望 ${OPTIONS_CORE_ADDRESS}, 实际 ${storedOC}`);
        return;
    }

    // ==================== Step 3: 授予 OptionsCore PROTOCOL_ROLE ====================
    console.log("\n3️⃣  授予 OptionsCore PROTOCOL_ROLE (允许 OptionsCore.requestFeed 调用 createFeedRequest)...");
    const PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE"));
    await (await feedProtocol.grantRole(PROTOCOL_ROLE, OPTIONS_CORE_ADDRESS)).wait();
    const hasPR = await feedProtocol.hasRole(PROTOCOL_ROLE, OPTIONS_CORE_ADDRESS);
    console.log(`   ✅ OptionsCore has PROTOCOL_ROLE: ${hasPR}`);

    // ==================== Step 4: 授予新 FeedProtocol FEED_PROTOCOL_ROLE ====================
    console.log("\n4️⃣  在 OptionsCore 上授予新 FeedProtocol FEED_PROTOCOL_ROLE...");
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    await (await optionsCore.grantRole(FEED_PROTOCOL_ROLE, newAddress)).wait();
    const hasFPR = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, newAddress);
    console.log(`   ✅ 新 FeedProtocol has FEED_PROTOCOL_ROLE: ${hasFPR}`);

    // ==================== Step 5: 撤销旧 FeedProtocol 的角色 ====================
    console.log("\n5️⃣  撤销旧 FeedProtocol 的 FEED_PROTOCOL_ROLE...");
    try {
        const oldHasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, OLD_FEED_PROTOCOL);
        if (oldHasRole) {
            await (await optionsCore.revokeRole(FEED_PROTOCOL_ROLE, OLD_FEED_PROTOCOL)).wait();
            console.log(`   ✅ 旧 FeedProtocol (${OLD_FEED_PROTOCOL}) 角色已撤销`);
        } else {
            console.log(`   ⏭  旧 FeedProtocol 本就没有 FEED_PROTOCOL_ROLE，跳过`);
        }
    } catch (e: any) {
        console.log(`   ⚠  撤销失败 (非致命): ${e.message?.slice(0, 100)}`);
    }

    // ==================== Step 6: 验证 tier configs ====================
    console.log("\n6️⃣  验证 Tier 配置...");
    // 自动检测 USDT 精度
    let decimals = 18;
    try {
        const usdtFull = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        decimals = Number(await usdtFull.decimals());
    } catch { /* fallback 18 */ }

    const tier0 = await feedProtocol.tierConfigs(0);
    console.log(`   Tier 5-3: totalFee = ${ethers.formatUnits(tier0.totalFee, decimals)} USDT`);
    const tier1 = await feedProtocol.tierConfigs(1);
    console.log(`   Tier 7-5: totalFee = ${ethers.formatUnits(tier1.totalFee, decimals)} USDT`);
    const tier2 = await feedProtocol.tierConfigs(2);
    console.log(`   Tier 10-7: totalFee = ${ethers.formatUnits(tier2.totalFee, decimals)} USDT`);

    // ==================== Step 7: 更新 deployed-addresses.json ====================
    console.log("\n7️⃣  更新 deployed-addresses.json...");
    addresses.FeedProtocol = newAddress;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`   ✅ deployed-addresses.json 已更新`);

    // ==================== 完成 ====================
    console.log("\n" + "═".repeat(60));
    console.log("  ✅ FeedProtocol 重部署完成!");
    console.log("═".repeat(60));
    console.log(`  新地址: ${newAddress}`);
    console.log("");
    console.log("  ⚠  请手动更新以下文件中的 FeedProtocol 地址：");
    console.log(`  1. frontend/src/contracts/config.ts (第 24 行)`);
    console.log(`     FeedProtocol: '${newAddress}',`);
    console.log(`  2. scripts/keeper/utils.ts (第 15 行)`);
    console.log(`     FeedProtocol: '${newAddress}',`);
    console.log(`  3. scripts/integration-test.ts (第 25 行)`);
    console.log(`     FeedProtocol: '${newAddress}',`);
    console.log(`  4. scripts/test-full-flow.ts (第 47 行)`);
    console.log(`     FEED_PROTOCOL_ADDRESS = '${newAddress}'`);
    console.log("═".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    });
