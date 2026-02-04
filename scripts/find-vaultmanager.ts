/**
 * find-correct-vaultmanager.ts
 * 
 * 查找正确的 VaultManager 地址
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";

    // 获取 OptionsCore 中的 VaultManager 地址
    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const vmAddress = await optionsCore.vaultManager();
    console.log("\n=== VaultManager in OptionsCore ===");
    console.log("Address:", vmAddress);

    // 尝试与这个地址交互
    try {
        const vm = await ethers.getContractAt("VaultManager", vmAddress);
        const usdtAddr = await vm.usdt();
        console.log("VaultManager USDT address:", usdtAddr);
        console.log("✓ VaultManager is working!");

        // 检查 OptionsCore 是否有权限
        const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
        const hasRole = await vm.hasRole(OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        console.log("OptionsCore has OPERATOR_ROLE:", hasRole);

        if (!hasRole) {
            console.log("\n=== Granting OPERATOR_ROLE ===");
            const tx = await vm.grantRole(OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
            await tx.wait();
            console.log("✓ Granted!");
        }
    } catch (e: any) {
        console.log("Error:", e.message?.slice(0, 300));
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
