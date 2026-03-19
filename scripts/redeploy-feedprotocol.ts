import { ethers, network } from "hardhat";

/**
 * 重新部署 FeedProtocol 合约 (修复喂价费用精度)
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options - Redeploy FeedProtocol");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);

    // 现有合约地址 (2026-01-25 部署)
    const CONFIG_ADDRESS = "0x5d660E670c943498176A50ebE8Ce11864962cA4c";
    const USDT_ADDRESS = "0x9f2140319726F9b851073a303415f13EC0cdA269";
    const OPTIONS_CORE_ADDRESS = "0x3eF66aFCe1DD7598460A0fE6AEeF18cbF3c92964";

    // 自动检测 USDT 精度
    let decimals = 18;
    try {
        const usdtFull = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        decimals = Number(await usdtFull.decimals());
    } catch { /* fallback 18 */ }

    // 1. 部署新的 FeedProtocol
    console.log("\n1️⃣ Deploying new FeedProtocol...");
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(CONFIG_ADDRESS, USDT_ADDRESS, deployer.address);
    await feedProtocol.waitForDeployment();
    const feedProtocolAddress = await feedProtocol.getAddress();
    console.log(`   ✅ FeedProtocol deployed: ${feedProtocolAddress}`);

    // 2. 更新 Config 中的 FeedProtocol 地址
    console.log("\n2️⃣ Updating Config...");
    const ConfigABI = [
        "function setFeedProtocolAddress(address _address)",
    ];
    const config = new ethers.Contract(CONFIG_ADDRESS, ConfigABI, deployer);
    await config.setFeedProtocolAddress(feedProtocolAddress);
    console.log("   ✅ Config updated with new FeedProtocol address");

    // 3. 授予 OptionsCore PROTOCOL_ROLE
    console.log("\n3️⃣ Granting PROTOCOL_ROLE to OptionsCore...");
    const PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE"));
    await feedProtocol.grantRole(PROTOCOL_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("   ✅ PROTOCOL_ROLE granted to OptionsCore");

    // 4. 验证配置
    console.log("\n4️⃣ Verifying tier configs...");
    const tier0 = await feedProtocol.tierConfigs(0);
    console.log(`   Tier 5-3: totalFee = ${ethers.formatUnits(tier0.totalFee, decimals)} USDT`);

    const tier1 = await feedProtocol.tierConfigs(1);
    console.log(`   Tier 7-5: totalFee = ${ethers.formatUnits(tier1.totalFee, decimals)} USDT`);

    const tier2 = await feedProtocol.tierConfigs(2);
    console.log(`   Tier 10-7: totalFee = ${ethers.formatUnits(tier2.totalFee, decimals)} USDT`);

    console.log("\n" + "=".repeat(60));
    console.log("📋 NEW CONTRACT ADDRESS:");
    console.log(`   FeedProtocol: ${feedProtocolAddress}`);
    console.log("=".repeat(60));
    console.log("✅ Redeployment completed!");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
