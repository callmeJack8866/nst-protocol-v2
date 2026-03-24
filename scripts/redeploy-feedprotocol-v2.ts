import { ethers, network } from "hardhat";

/**
 * 重新部署 FeedProtocol 合约 (修复 _requireNoActiveFeedRequest 过期请求阻塞问题)
 * 
 * 修复内容：过期但未 finalized 的请求不再阻塞新请求创建
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options - Redeploy FeedProtocol v2 (fix expired request blocking)");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);

    // 当前合约地址 (2026-03-11 部署)
    const CONFIG_ADDRESS = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";
    const OPTIONS_CORE_ADDRESS = "0x78F4600D6963044cCE956DC2322A92cB58142129";
    const OPTIONS_SETTLEMENT_ADDRESS = "0x8DF881593368FD8be3F40722fcb9f555593a8257";

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

    // 4. 授予 OptionsSettlement PROTOCOL_ROLE (用于 cancelOrderDueToFeedTimeout)
    console.log("\n4️⃣ Granting PROTOCOL_ROLE to OptionsSettlement...");
    await feedProtocol.grantRole(PROTOCOL_ROLE, OPTIONS_SETTLEMENT_ADDRESS);
    console.log("   ✅ PROTOCOL_ROLE granted to OptionsSettlement");

    // 5. 注册 FeedEngine submitter 为活跃喂价员
    console.log("\n5️⃣ Registering FeedEngine submitter as feeder...");
    const SUBMITTER_ADDRESS = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";
    const SUBMITTER_KEY = "fbb24f682d7fd3fdd46337d72d8b1b2b8170848f5558885b8c5e076e637ca8ec";
    const submitter = new ethers.Wallet(SUBMITTER_KEY, deployer.provider);
    
    const minStake = ethers.parseUnits("100", 18);
    const usdtABI = [
        "function approve(address,uint256) returns (bool)",
        "function balanceOf(address) view returns (uint256)",
    ];
    const usdt = new ethers.Contract(USDT_ADDRESS, usdtABI, submitter);
    const bal = await usdt.balanceOf(SUBMITTER_ADDRESS);
    console.log(`   Submitter USDT balance: ${ethers.formatUnits(bal, 18)}`);
    
    if (bal >= minStake) {
        await usdt.approve(feedProtocolAddress, minStake);
        const fpWithSubmitter = feedProtocol.connect(submitter);
        await fpWithSubmitter.registerFeeder(minStake);
        console.log(`   ✅ Feeder registered: ${SUBMITTER_ADDRESS}`);
    } else {
        console.log(`   ⚠️ Insufficient USDT for feeder registration (need 100)`);
    }

    // 6. 验证
    console.log("\n6️⃣ Verifying...");
    const tier0 = await feedProtocol.tierConfigs(0);
    console.log(`   Tier 0 totalFee: ${ethers.formatUnits(tier0.totalFee, 18)} USDT`);

    const feederInfo = await feedProtocol.feeders(SUBMITTER_ADDRESS);
    console.log(`   Feeder isActive: ${feederInfo.isActive}`);

    console.log("\n" + "=".repeat(60));
    console.log("📋 NEW CONTRACT ADDRESS:");
    console.log(`   FeedProtocol: ${feedProtocolAddress}`);
    console.log("=".repeat(60));
    console.log("⚠️  Remember to update:");
    console.log("   1. frontend/src/contracts/config.ts (FeedProtocol address)");
    console.log("   2. feed-engine-backend .env (NST_FEED_PROTOCOL_ADDRESS)");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
