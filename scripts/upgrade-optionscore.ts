/**
 * upgrade-optionscore.ts
 * 
 * 只重新部署 OptionsCore 合约并更新跨合约配置
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 现有合约地址 (小写避免 checksum 问题)
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";
    const VAULT_MANAGER_ADDRESS = "0x3e7eef51edfb64d03738801c2d2174e3cb1400f7";
    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";  // 正确的 Config
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2d56902f91e92cade54993f45b4376979c7";

    console.log("\n=== Deploying New OptionsCore ===");

    // 部署新的 OptionsCore
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        CONFIG_ADDRESS,
        VAULT_MANAGER_ADDRESS,
        USDT_ADDRESS,
        deployer.address  // admin
    );
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();
    console.log("New OptionsCore deployed at:", optionsCoreAddress);

    console.log("\n=== Configuring Cross-Contract Permissions ===");

    // 1. FeedProtocol 设置新的 OptionsCore 地址
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    console.log("Setting OptionsCore in FeedProtocol...");
    const tx1 = await feedProtocol.setOptionsCore(optionsCoreAddress);
    await tx1.wait();
    console.log("✓ FeedProtocol.setOptionsCore done");

    // 2. OptionsCore 授权 FeedProtocol 调用回调函数
    console.log("Granting FEED_PROTOCOL_ROLE to FeedProtocol...");
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const tx2 = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
    await tx2.wait();
    console.log("✓ OptionsCore.grantRole(FEED_PROTOCOL_ROLE) done");

    console.log("\n=== Update Required ===");
    console.log("Update these files with the new address:");
    console.log("1. frontend/src/contracts/config.ts");
    console.log("   OptionsCore:", optionsCoreAddress);
    console.log("2. scripts/keeper/utils.ts");
    console.log("   OPTIONS_CORE_ADDRESS:", optionsCoreAddress);

    console.log("\n✅ Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
