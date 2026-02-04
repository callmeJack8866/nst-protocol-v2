/**
 * grant-vault-role.ts
 * 
 * 授予新 OptionsCore 在 VaultManager 中的 OPERATOR_ROLE
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const VAULT_MANAGER_ADDRESS = "0xf73cd5f50e7f0ce0a6fe8b08c8d1e671b9a5bb59";

    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);

    console.log("\n=== Granting OPERATOR_ROLE to OptionsCore ===");
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

    const hasRole = await vaultManager.hasRole(OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("Already has role:", hasRole);

    if (!hasRole) {
        const tx = await vaultManager.grantRole(OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        await tx.wait();
        console.log("✓ VaultManager.grantRole(OPERATOR_ROLE) done");
    }

    console.log("\n✅ Done!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
