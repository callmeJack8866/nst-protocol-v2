/**
 * full-redeploy-and-setup.ts
 * 
 * 完整重新部署 VaultManager 和 OptionsCore，并设置正确的保证金
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const CONFIG_ADDRESS = "0x63ae7d11ed0d939dee6fc67e8be89de79610c4ea";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";
    const SELLER_ADDRESS = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";

    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    console.log("\n=== Step 1: Deploy New VaultManager ===");
    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = await VaultManager.deploy(CONFIG_ADDRESS, deployer.address);
    await vaultManager.waitForDeployment();
    const vmAddress = await vaultManager.getAddress();
    console.log("New VaultManager:", vmAddress);

    console.log("\n=== Step 2: Deploy New OptionsCore ===");
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        CONFIG_ADDRESS,
        vmAddress,
        USDT_ADDRESS,
        deployer.address
    );
    await optionsCore.waitForDeployment();
    const ocAddress = await optionsCore.getAddress();
    console.log("New OptionsCore:", ocAddress);

    console.log("\n=== Step 3: Grant Permissions ===");

    // 授予 OptionsCore 在 VaultManager 中的角色
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    await (await vaultManager.grantRole(VAULT_OPERATOR_ROLE, ocAddress)).wait();
    console.log("✓ OptionsCore has VAULT_OPERATOR_ROLE in VaultManager");

    // 授予 FeedProtocol 在 OptionsCore 中的角色
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    await (await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS)).wait();
    console.log("✓ FeedProtocol has FEED_PROTOCOL_ROLE in OptionsCore");

    // 更新 FeedProtocol 指向新 OptionsCore
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    await (await feedProtocol.setOptionsCore(ocAddress)).wait();
    console.log("✓ FeedProtocol.setOptionsCore done");

    console.log("\n=== Step 4: Transfer USDT to VaultManager ===");
    // 转入一些 USDT 到 VaultManager 用于保证金操作
    const fundAmount = ethers.parseUnits("100", 6); // 100 USDT
    await (await usdt.transfer(vmAddress, fundAmount)).wait();
    console.log("✓ Transferred 100 USDT to VaultManager");

    console.log("\n=== Summary ===");
    console.log("VaultManager:", vmAddress);
    console.log("OptionsCore:", ocAddress);
    console.log("\nUpdate frontend/src/contracts/config.ts:");
    console.log(`  VaultManager: '${vmAddress}',`);
    console.log(`  OptionsCore: '${ocAddress}',`);
    console.log("\nUpdate scripts/keeper/utils.ts:");
    console.log(`  OptionsCore: '${ocAddress}',`);

    console.log("\n✅ Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
