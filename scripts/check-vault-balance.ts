/**
 * check-vault-balance.ts
 * 
 * 直接检查 VaultManager 状态
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const VAULT_MANAGER_ADDRESS = "0xF73CD5f50E7F0ce0A6FE8b08C8d1e671b9A5Bb59";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    // 订单信息
    const SELLER_ADDRESS = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";
    const BUYER_ADDRESS = "0xeaDD55Cf2eCaA09f2667d5a53DD1e825F05777a0";

    console.log("\n=== Checking VaultManager Contract ===");

    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    // 检查 VaultManager 的 USDT 余额
    const vmUsdtBalance = await usdt.balanceOf(VAULT_MANAGER_ADDRESS);
    console.log("VaultManager USDT balance:", ethers.formatUnits(vmUsdtBalance, 6), "USDT");

    try {
        // 检查卖方在 VaultManager 中的保证金
        const sellerMargin = await vaultManager.userMarginBalance(SELLER_ADDRESS, USDT_ADDRESS);
        console.log("Seller margin in VM:", ethers.formatUnits(sellerMargin, 6), "USDT");
    } catch (e: any) {
        console.log("Error reading seller margin:", e.message?.slice(0, 200));
    }

    // 检查 OptionsCore 是否有 VAULT_OPERATOR_ROLE
    console.log("\n=== Checking OptionsCore Role in VaultManager ===");
    try {
        const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const hasRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        console.log("OptionsCore has VAULT_OPERATOR_ROLE:", hasRole);

        if (!hasRole) {
            console.log("\n⚠️ OptionsCore does NOT have VAULT_OPERATOR_ROLE! Granting...");
            const tx = await vaultManager.grantRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
            await tx.wait();
            console.log("✓ Role granted!");
        }
    } catch (e: any) {
        console.log("Error checking/granting role:", e.message?.slice(0, 200));
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
