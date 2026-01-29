import { ethers, run, network } from "hardhat";

/**
 * NST Options MVP - VolumeBasedFeed 单独部署脚本
 * 
 * 用于在已部署的系统中添加 VolumeBasedFeed 合约
 */

// 已部署的 BSC Testnet 合约地址
const BSC_TESTNET_CONFIG = {
    Config: '0x751C17032D38b0b877171cB96039678710b3c76F',
    USDT: '0x9f2140319726F9b851073a303415f13EC0cdA269',
};

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options MVP - VolumeBasedFeed Deployment");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
    console.log("=".repeat(60));

    // 部署 VolumeBasedFeed
    console.log("\n🚀 Deploying VolumeBasedFeed...");
    const VolumeBasedFeed = await ethers.getContractFactory("VolumeBasedFeed");
    const volumeBasedFeed = await VolumeBasedFeed.deploy(
        BSC_TESTNET_CONFIG.Config,
        BSC_TESTNET_CONFIG.USDT,
        deployer.address
    );
    await volumeBasedFeed.waitForDeployment();
    const volumeBasedFeedAddress = await volumeBasedFeed.getAddress();
    console.log(`✅ VolumeBasedFeed deployed: ${volumeBasedFeedAddress}`);

    // 验证合约
    if (network.name === "bscTestnet" || network.name === "bscMainnet") {
        console.log("\n⏳ Waiting for block confirmations...");
        await volumeBasedFeed.deploymentTransaction()?.wait(5);

        console.log("\n🔍 Verifying contract on BSCScan...");
        try {
            await run("verify:verify", {
                address: volumeBasedFeedAddress,
                constructorArguments: [
                    BSC_TESTNET_CONFIG.Config,
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
    console.log(`VolumeBasedFeed: '${volumeBasedFeedAddress}',`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
