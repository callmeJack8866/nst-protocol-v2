import { ethers, run, network } from "hardhat";

/**
 * NST Options MVP - OptionsCore 升级部署脚本
 * 
 * 用于升级 OptionsCore 合约，包含新增的功能：
 * - resolveArbitration (§15.4)
 * - recordDividend (§7.2)
 */

// 已部署的 BSC Testnet 合约地址 (2026-02-02 当前版本)
const BSC_TESTNET_CONFIG = {
    Config: '0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea',
    VaultManager: '0xa81cCaE9b7aBfb2a24982A8FcA1A8Dd54dD49E54',
    USDT: '0x6ae0833E637D1d99F3FCB6204860386f6a6713C0',
};

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options MVP - OptionsCore Upgrade Deployment");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
    console.log("=".repeat(60));

    // 部署新的 OptionsCore
    console.log("\n🚀 Deploying upgraded OptionsCore...");
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        BSC_TESTNET_CONFIG.Config,
        BSC_TESTNET_CONFIG.VaultManager,
        BSC_TESTNET_CONFIG.USDT,
        deployer.address
    );
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();
    console.log(`✅ OptionsCore deployed: ${optionsCoreAddress}`);

    // 授予 VaultManager 操作权限
    console.log("\n🔧 Granting VAULT_OPERATOR_ROLE to OptionsCore...");
    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = VaultManager.attach(BSC_TESTNET_CONFIG.VaultManager);
    try {
        const tx = await vaultManager.grantOperatorRole(optionsCoreAddress);
        await tx.wait();
        console.log("✅ VAULT_OPERATOR_ROLE granted to OptionsCore");
    } catch (error: any) {
        console.log("⚠️ Could not grant role (may already be granted or need admin):", error.message);
    }

    // 验证合约
    if (network.name === "bscTestnet" || network.name === "bscMainnet") {
        console.log("\n⏳ Waiting for block confirmations...");
        await optionsCore.deploymentTransaction()?.wait(5);

        console.log("\n🔍 Verifying contract on BSCScan...");
        try {
            await run("verify:verify", {
                address: optionsCoreAddress,
                constructorArguments: [
                    BSC_TESTNET_CONFIG.Config,
                    BSC_TESTNET_CONFIG.VaultManager,
                    BSC_TESTNET_CONFIG.USDT,
                    deployer.address
                ],
            });
            console.log("✅ Contract verified!");
        } catch (error: any) {
            if (error.message.includes("Already Verified")) {
                console.log("ℹ️ Contract already verified");
            } else {
                console.error("❌ Verification failed:", error.message);
            }
        }
    }

    // 输出配置更新提示
    console.log("\n" + "=".repeat(60));
    console.log("📋 Update frontend/src/contracts/config.ts:");
    console.log("=".repeat(60));
    console.log(`OptionsCore: '${optionsCoreAddress}',`);
    console.log("=".repeat(60));

    console.log("\n📋 New features in this upgrade:");
    console.log("  - resolveArbitration() - 仲裁解决 (§15.4)");
    console.log("  - recordDividend() - 分红记录 (§7.2)");
    console.log("  - ArbitrationResolved event");
    console.log("  - DividendRecorded event");
    console.log("  - Dividend-adjusted settlement logic");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
