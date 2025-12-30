import { ethers, network } from "hardhat";

/**
 * 配置更新脚本
 * 用于更新已部署合约的参数
 */

// 在此填入已部署的合约地址
const DEPLOYED_ADDRESSES = {
    config: "",
    vaultManager: "",
    feedProtocol: "",
    seatManager: "",
    pointsManager: "",
    optionsCore: "",
};

async function main() {
    const [admin] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options MVP - Configuration Update");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Admin: ${admin.address}`);

    if (!DEPLOYED_ADDRESSES.config) {
        console.error("❌ Please fill in DEPLOYED_ADDRESSES first!");
        process.exit(1);
    }

    const config = await ethers.getContractAt("Config", DEPLOYED_ADDRESSES.config);

    // Example: Update fee parameters
    console.log("\n📝 Updating configuration...");

    // Uncomment and modify as needed:

    // await config.setCreationFee(ethers.parseUnits("1", 18));
    // console.log("   - Creation fee set to 1 USDT");

    // await config.setTradingFeeRate(10);
    // console.log("   - Trading fee rate set to 0.1%");

    // await config.setMinMarginRate(1000);
    // console.log("   - Min margin rate set to 10%");

    console.log("\n✅ Configuration update completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
