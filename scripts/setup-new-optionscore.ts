/**
 * setup-new-optionscore.ts
 * 
 * 配置新部署的 OptionsCore 合约权限
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring with account:", deployer.address);

    // 合约地址
    const OPTIONS_CORE_ADDRESS = "0x758e843E2e052Ddb65B92e0a7b8Fa84D1a70e4a2";
    const VAULT_MANAGER_ADDRESS = "0xa81ccae9b7abfb2a24982a8fca1a8dd54dd49e54";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    console.log("\n=== Checking OptionsCore Configuration ===");

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);

    // 检查 VaultManager 地址
    const vmAddress = await optionsCore.vaultManager();
    console.log("VaultManager in OptionsCore:", vmAddress);
    console.log("Expected VaultManager:", VAULT_MANAGER_ADDRESS);
    console.log("Match:", vmAddress.toLowerCase() === VAULT_MANAGER_ADDRESS.toLowerCase());

    // 检查 Config 地址
    const configAddress = await optionsCore.config();
    console.log("Config in OptionsCore:", configAddress);

    // 检查 USDT 地址
    const usdtAddress = await optionsCore.usdt();
    console.log("USDT in OptionsCore:", usdtAddress);

    // 检查 VaultManager 是否授权 OptionsCore
    console.log("\n=== Checking VaultManager Permissions ===");
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const hasOperatorRole = await vaultManager.hasRole(OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("OptionsCore has OPERATOR_ROLE in VaultManager:", hasOperatorRole);

    if (!hasOperatorRole) {
        console.log("\n=== Granting OPERATOR_ROLE to OptionsCore ===");
        const tx = await vaultManager.grantRole(OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        await tx.wait();
        console.log("✓ VaultManager.grantRole(OPERATOR_ROLE) done");
    }

    console.log("\n✅ Configuration check complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
