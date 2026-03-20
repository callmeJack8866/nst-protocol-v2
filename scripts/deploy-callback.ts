/**
 * deploy-callback.ts
 * 
 * 部署支持自动回调的新版 OptionsCore 和 FeedProtocol 合约
 * 用法: npx hardhat run scripts/deploy-callback.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 现有合约地址（不需要重新部署）
    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const VAULT_MANAGER_ADDRESS = "0xa81cCaE9b7aBfb2a24982A8FcA1A8Dd54dD49E54";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";

    console.log("\n=== Deploying New OptionsCore ===");
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        CONFIG_ADDRESS,
        VAULT_MANAGER_ADDRESS,
        USDT_ADDRESS,
        deployer.address
    );
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();
    console.log("OptionsCore deployed to:", optionsCoreAddress);

    console.log("\n=== Deploying New FeedProtocol ===");
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(
        CONFIG_ADDRESS,
        USDT_ADDRESS,
        deployer.address
    );
    await feedProtocol.waitForDeployment();
    const feedProtocolAddress = await feedProtocol.getAddress();
    console.log("FeedProtocol deployed to:", feedProtocolAddress);

    console.log("\n=== Configuring Cross-Contract Permissions ===");

    // 1. FeedProtocol 设置 OptionsCore 地址（用于自动回调）
    console.log("Setting OptionsCore in FeedProtocol...");
    const tx1 = await feedProtocol.setOptionsCore(optionsCoreAddress);
    await tx1.wait();
    console.log("✓ FeedProtocol.setOptionsCore done");

    // 2. OptionsCore 授权 FeedProtocol 调用回调函数
    console.log("Granting FEED_PROTOCOL_ROLE to FeedProtocol...");
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const tx2 = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, feedProtocolAddress);
    await tx2.wait();
    console.log("✓ OptionsCore.grantRole(FEED_PROTOCOL_ROLE) done");

    console.log("\n=== Deployment Complete ===");
    console.log("OptionsCore:", optionsCoreAddress);
    console.log("FeedProtocol:", feedProtocolAddress);
    console.log("\n请更新以下文件中的合约地址:");
    console.log("1. frontend/src/contracts/config.ts");
    console.log("2. scripts/keeper/utils.ts");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
