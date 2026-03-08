/**
 * grant-vault-operator.ts
 * 
 * 在 VaultManager 上授予 VAULT_OPERATOR_ROLE 给 OptionsSettlement 合约
 * 用法: npx hardhat run scripts/grant-vault-operator.ts --network bscTestnet
 */
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Executing with:", deployer.address);

    const VAULT_MANAGER = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const OPTIONS_SETTLEMENT = "0x8DF881593368FD8be3F40722fcb9f555593a8257";
    const OPTIONS_CORE = "0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a";

    const vaultABI = [
        'function grantOperatorRole(address _operator) external',
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function VAULT_OPERATOR_ROLE() view returns (bytes32)',
    ];

    const vault = new ethers.Contract(VAULT_MANAGER, vaultABI, deployer);
    const ROLE = await vault.VAULT_OPERATOR_ROLE();

    // 1. 检查现有权限
    const hasSettlement = await vault.hasRole(ROLE, OPTIONS_SETTLEMENT);
    const hasCore = await vault.hasRole(ROLE, OPTIONS_CORE);
    console.log(`OptionsSettlement has VAULT_OPERATOR_ROLE: ${hasSettlement}`);
    console.log(`OptionsCore has VAULT_OPERATOR_ROLE: ${hasCore}`);

    // 2. 授予 OptionsSettlement
    if (!hasSettlement) {
        console.log("\n>>> Granting VAULT_OPERATOR_ROLE to OptionsSettlement...");
        const tx1 = await vault.grantOperatorRole(OPTIONS_SETTLEMENT);
        await tx1.wait();
        console.log("✅ OptionsSettlement granted");
    } else {
        console.log("✅ OptionsSettlement already has role");
    }

    // 3. 授予 OptionsCore (如果没有)
    if (!hasCore) {
        console.log("\n>>> Granting VAULT_OPERATOR_ROLE to OptionsCore...");
        const tx2 = await vault.grantOperatorRole(OPTIONS_CORE);
        await tx2.wait();
        console.log("✅ OptionsCore granted");
    } else {
        console.log("✅ OptionsCore already has role");
    }

    // 4. 验证
    const verify1 = await vault.hasRole(ROLE, OPTIONS_SETTLEMENT);
    const verify2 = await vault.hasRole(ROLE, OPTIONS_CORE);
    console.log("\n=== 验证 ===");
    console.log(`OptionsSettlement: ${verify1 ? "✅" : "❌"}`);
    console.log(`OptionsCore: ${verify2 ? "✅" : "❌"}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
