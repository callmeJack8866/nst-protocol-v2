/**
 * deploy-feedprotocol-only.ts
 * 
 * 仅部署 FeedProtocol 合约（OptionsCore 不变）
 * 部署后自动配置 setOptionsCore 和 FEED_PROTOCOL_ROLE
 * 
 * 用法: npx hardhat run scripts/deploy-feedprotocol-only.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "BNB");

    // 现有合约地址（不变）
    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";
    const OPTIONS_CORE_ADDRESS = "0x78F4600D6963044cCE956DC2322A92cB58142129";

    console.log("\n=== Deploying New FeedProtocol ===");
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(
        CONFIG_ADDRESS,
        USDT_ADDRESS,
        deployer.address
    );
    await feedProtocol.waitForDeployment();
    const feedProtocolAddress = await feedProtocol.getAddress();
    console.log("✅ FeedProtocol deployed to:", feedProtocolAddress);

    console.log("\n=== Configuring Cross-Contract Permissions ===");

    // 1. FeedProtocol 设置 OptionsCore 地址（用于自动回调 + getOrder 读取）
    console.log("Setting OptionsCore in FeedProtocol...");
    const tx1 = await feedProtocol.setOptionsCore(OPTIONS_CORE_ADDRESS);
    await tx1.wait();
    console.log("✓ FeedProtocol.setOptionsCore done");

    // 2. OptionsCore 授权 FeedProtocol 调用回调函数
    console.log("Granting FEED_PROTOCOL_ROLE to new FeedProtocol...");
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const tx2 = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, feedProtocolAddress);
    await tx2.wait();
    console.log("✓ OptionsCore.grantRole(FEED_PROTOCOL_ROLE) done");

    console.log("\n=== Deployment Complete ===");
    console.log("New FeedProtocol:", feedProtocolAddress);
    console.log("OptionsCore (unchanged):", OPTIONS_CORE_ADDRESS);
    console.log("\n⚠️ 请更新以下文件中的 FeedProtocol 地址:");
    console.log("1. frontend/src/contracts/config.ts");
    console.log("2. scripts/keeper/utils.ts");
    console.log("3. deployed-addresses.json");
    console.log("4. FeedEngine .env (NST_FEED_PROTOCOL_CONTRACT)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
