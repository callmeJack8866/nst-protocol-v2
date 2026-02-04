/**
 * grant-vault-operator.ts
 * 
 * 授予新 OptionsCore 在 VaultManager 中的 VAULT_OPERATOR_ROLE
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const VAULT_MANAGER_ADDRESS = "0xF73CD5f50E7F0ce0A6FE8b08C8d1e671b9A5Bb59";

    // 使用简化的 ABI
    const VAULT_ABI = [
        "function grantRole(bytes32 role, address account) external",
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "function grantOperatorRole(address _operator) external",
        "function VAULT_OPERATOR_ROLE() view returns (bytes32)"
    ];

    const vm = new ethers.Contract(VAULT_MANAGER_ADDRESS, VAULT_ABI, deployer);

    console.log("\n=== Checking VaultManager ===");

    try {
        // 尝试获取 VAULT_OPERATOR_ROLE
        const VAULT_OPERATOR_ROLE = await vm.VAULT_OPERATOR_ROLE();
        console.log("VAULT_OPERATOR_ROLE:", VAULT_OPERATOR_ROLE);

        const hasRole = await vm.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        console.log("OptionsCore has role:", hasRole);

        if (!hasRole) {
            console.log("\n=== Granting VAULT_OPERATOR_ROLE ===");
            const tx = await vm.grantRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
            await tx.wait();
            console.log("✓ Granted via grantRole!");
        }
    } catch (e: any) {
        console.log("grantRole failed, trying grantOperatorRole...");
        try {
            const tx = await vm.grantOperatorRole(OPTIONS_CORE_ADDRESS);
            await tx.wait();
            console.log("✓ Granted via grantOperatorRole!");
        } catch (e2: any) {
            console.log("Both methods failed:");
            console.log("Error 1:", e.message?.slice(0, 200));
            console.log("Error 2:", e2.message?.slice(0, 200));
        }
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
