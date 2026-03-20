/**
 * deploy-vaultmanager.ts
 * 
 * 部署新的 VaultManager 并配置权限
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    console.log("\n=== Deploying New VaultManager ===");

    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = await VaultManager.deploy(
        CONFIG_ADDRESS,
        deployer.address  // admin
    );
    await vaultManager.waitForDeployment();
    const vmAddress = await vaultManager.getAddress();
    console.log("New VaultManager deployed at:", vmAddress);

    console.log("\n=== Granting VAULT_OPERATOR_ROLE to OptionsCore ===");
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    await vaultManager.grantRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("✓ Role granted to OptionsCore");

    // 验证
    const hasRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("OptionsCore has VAULT_OPERATOR_ROLE:", hasRole);

    console.log("\n=== IMPORTANT: OptionsCore needs to be redeployed ===");
    console.log("The new VaultManager address is:", vmAddress);
    console.log("You need to redeploy OptionsCore with this new VaultManager address.");

    console.log("\n=== Update scripts/upgrade-optionscore.ts ===");
    console.log("VAULT_MANAGER_ADDRESS =", vmAddress);

    console.log("\n✅ VaultManager deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
