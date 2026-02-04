/**
 * grant-all-permissions.ts
 * 
 * 授予所有必要权限
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0";
    const VAULT_MANAGER_ADDRESS = "0x3e7eEf51EdFb64D03738801c2d2174E3cB1400F7";

    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);

    console.log("\n=== Granting VAULT_OPERATOR_ROLE to OptionsCore ===");
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));

    const hasRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("Already has role:", hasRole);

    if (!hasRole) {
        const tx = await vaultManager.grantRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        await tx.wait();
        console.log("✓ Role granted!");
    }

    // 验证
    const verifyRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("OptionsCore has VAULT_OPERATOR_ROLE:", verifyRole);

    console.log("\n✅ All permissions configured!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
