import { ethers, network } from "hardhat";

/**
 * 更新 Config 合约参数以匹配 USDT 6 位小数
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options - Update Config for USDT 6 Decimals");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);

    // Config 合约地址 (2026-01-25 部署)
    const CONFIG_ADDRESS = "0x5d660E670c943498176A50ebE8Ce11864962cA4c";

    const ConfigABI = [
        "function minFeederStake() view returns (uint256)",
        "function setMinFeederStake(uint256 _value)",
        "function creationFee() view returns (uint256)",
        "function setCreationFee(uint256 _value)",
        "function arbitrationFee() view returns (uint256)",
        "function setArbitrationFee(uint256 _value)",
        "function feedFee_5_3() view returns (uint256)",
        "function feedFee_7_5() view returns (uint256)",
        "function feedFee_10_7() view returns (uint256)",
    ];

    const config = new ethers.Contract(CONFIG_ADDRESS, ConfigABI, deployer);

    console.log("\n📋 当前配置:");
    console.log(`   minFeederStake: ${ethers.formatUnits(await config.minFeederStake(), 18)} (18 decimals)`);
    console.log(`   creationFee: ${ethers.formatUnits(await config.creationFee(), 18)} (18 decimals)`);
    console.log(`   arbitrationFee: ${ethers.formatUnits(await config.arbitrationFee(), 18)} (18 decimals)`);

    // 更新为 6 位小数
    const USDT_DECIMALS = 6;
    const newMinFeederStake = ethers.parseUnits("100", USDT_DECIMALS); // 100 USDT
    const newCreationFee = ethers.parseUnits("1", USDT_DECIMALS);       // 1 USDT
    const newArbitrationFee = ethers.parseUnits("30", USDT_DECIMALS);   // 30 USDT

    console.log("\n🔧 更新配置...");

    console.log("   设置 minFeederStake = 100 USDT (6 decimals)...");
    const tx1 = await config.setMinFeederStake(newMinFeederStake);
    await tx1.wait();
    console.log("   ✅ minFeederStake 已更新");

    console.log("   设置 creationFee = 1 USDT (6 decimals)...");
    const tx2 = await config.setCreationFee(newCreationFee);
    await tx2.wait();
    console.log("   ✅ creationFee 已更新");

    console.log("   设置 arbitrationFee = 30 USDT (6 decimals)...");
    const tx3 = await config.setArbitrationFee(newArbitrationFee);
    await tx3.wait();
    console.log("   ✅ arbitrationFee 已更新");

    console.log("\n📋 更新后配置:");
    console.log(`   minFeederStake: ${ethers.formatUnits(await config.minFeederStake(), USDT_DECIMALS)} USDT`);
    console.log(`   creationFee: ${ethers.formatUnits(await config.creationFee(), USDT_DECIMALS)} USDT`);
    console.log(`   arbitrationFee: ${ethers.formatUnits(await config.arbitrationFee(), USDT_DECIMALS)} USDT`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ 配置更新完成!");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
