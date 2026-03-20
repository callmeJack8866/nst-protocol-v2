/**
 * upgrade-feedprotocol.ts
 * 
 * 重新部署 FeedProtocol 合约（1人即可完成喂价）
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 现有合约地址
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";
    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const OPTIONS_CORE_ADDRESS = "0x758e843E2e052Ddb65B92e0a7b8Fa84D1a70e4a2";

    console.log("\n=== Deploying New FeedProtocol (1人即可完成) ===");

    // 部署新的 FeedProtocol (config, usdt, admin)
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(
        CONFIG_ADDRESS,
        USDT_ADDRESS,
        deployer.address  // admin
    );
    await feedProtocol.waitForDeployment();
    const feedProtocolAddress = await feedProtocol.getAddress();
    console.log("New FeedProtocol deployed at:", feedProtocolAddress);

    console.log("\n=== Configuring Cross-Contract Permissions ===");

    // 1. FeedProtocol 设置 OptionsCore 地址（用于自动回调）
    console.log("Setting OptionsCore in FeedProtocol...");
    const tx1 = await feedProtocol.setOptionsCore(OPTIONS_CORE_ADDRESS);
    await tx1.wait();
    console.log("✓ FeedProtocol.setOptionsCore done");

    // 2. OptionsCore 授权新 FeedProtocol 调用回调函数
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    console.log("Granting FEED_PROTOCOL_ROLE to new FeedProtocol...");
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const tx2 = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, feedProtocolAddress);
    await tx2.wait();
    console.log("✓ OptionsCore.grantRole(FEED_PROTOCOL_ROLE) done");

    // 验证 Tier 配置
    console.log("\n=== Verifying Tier Configuration ===");
    const tierConfig = await feedProtocol.tierConfigs(0); // Tier_5_3
    console.log("Tier_5_3 config:");
    console.log("  totalFeeders:", tierConfig.totalFeeders.toString());
    console.log("  effectiveFeeds:", tierConfig.effectiveFeeds.toString());

    console.log("\n=== Update Required ===");
    console.log("Update these files with the new address:");
    console.log("1. frontend/src/contracts/config.ts");
    console.log("   FeedProtocol:", feedProtocolAddress);
    console.log("   VolumeBasedFeed:", feedProtocolAddress);
    console.log("2. scripts/keeper/utils.ts");
    console.log("   FeedProtocol:", feedProtocolAddress);

    console.log("\n✅ Deployment complete! 现在 1 次喂价即可完成!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
