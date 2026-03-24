import { ethers } from "hardhat";

/**
 * 重新部署 OptionsSettlement（修复 Order struct 字段偏移 bug）
 * 
 * 原因：OptionsCore 的 Order struct 新增了 finalFeedRequestedAt 字段，
 * 但 OptionsSettlement 编译时用的是旧版 struct（无此字段），
 * 导致 lastFeedPrice 字段读取偏移为 0（实际读到了 finalFeedRequestedAt）。
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=".repeat(60));
    console.log("Redeploy OptionsSettlement (fix Order struct field offset)");
    console.log("=".repeat(60));
    console.log("Deployer:", deployer.address);

    const OC = "0x78F4600D6963044cCE956DC2322A92cB58142129";
    const CONFIG = "0x9f839C36146c0c8867c2E36E33EA5A024be38e31";
    const VM = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";

    // 1. Deploy new OptionsSettlement
    console.log("\n1️⃣ Deploying new OptionsSettlement...");
    const OS = await ethers.getContractFactory("OptionsSettlement");
    const os = await OS.deploy(OC, CONFIG, VM, USDT, deployer.address);
    await os.waitForDeployment();
    const osAddr = await os.getAddress();
    console.log("   ✅ Deployed:", osAddr);

    // 2. Grant SETTLEMENT_ROLE on OptionsCore to new OptionsSettlement
    console.log("\n2️⃣ Granting SETTLEMENT_ROLE on OptionsCore...");
    const SETTLEMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
    const ocABI = ["function grantRole(bytes32,address) external", "function hasRole(bytes32,address) view returns (bool)"];
    const oc = new ethers.Contract(OC, ocABI, deployer);
    await (await oc.grantRole(SETTLEMENT_ROLE, osAddr)).wait();
    console.log("   ✅ SETTLEMENT_ROLE granted");

    // 3. Grant SETTLEMENT_ROLE for VaultManager
    console.log("\n3️⃣ Granting SETTLEMENT_ROLE on VaultManager...");
    const vmABI = ["function grantRole(bytes32,address) external"];
    const vm = new ethers.Contract(VM, vmABI, deployer);
    try {
        await (await vm.grantRole(SETTLEMENT_ROLE, osAddr)).wait();
        console.log("   ✅ SETTLEMENT_ROLE granted on VaultManager");
    } catch (e: any) {
        console.log("   ⚠️ VaultManager grant failed, trying other roles...");
        // Try PROTOCOL_ROLE and DEFAULT_ADMIN_ROLE
        for (const roleName of ["PROTOCOL_ROLE", "MINTER_ROLE", "OPERATOR_ROLE"]) {
            try {
                const role = ethers.keccak256(ethers.toUtf8Bytes(roleName));
                await (await vm.grantRole(role, osAddr)).wait();
                console.log(`   ✅ ${roleName} granted on VaultManager`);
            } catch { /* skip */ }
        }
    }

    // 4. Update Config with new OptionsSettlement
    console.log("\n4️⃣ Updating Config...");
    const cfgABI = ["function setOptionsSettlementAddress(address) external"];
    const cfg = new ethers.Contract(CONFIG, cfgABI, deployer);
    try {
        await (await cfg.setOptionsSettlementAddress(osAddr)).wait();
        console.log("   ✅ Config updated");
    } catch (e: any) {
        console.log("   ⚠️ Config update failed:", (e as any).reason);
    }

    // 5. Grant FeedProtocol roles on new OptionsSettlement
    console.log("\n5️⃣ Granting roles to FeedProtocol...");
    const FP = "0x3ADc2a24943d3B9ADd5570A7ad2035Ef547c6E45";
    const roles = ["PROTOCOL_ROLE", "FEED_PROTOCOL_ROLE", "FEED_ROLE"];
    for (const roleName of roles) {
        try {
            const role = ethers.keccak256(ethers.toUtf8Bytes(roleName));
            await (await os.grantRole(role, FP)).wait();
            console.log(`   ✅ ${roleName} granted to FeedProtocol`);
        } catch { /* role may not exist */ }
    }

    // 6. Verify settle would succeed
    console.log("\n6️⃣ Verifying settle(18) would succeed...");
    try {
        await os.settle.staticCall(18, { from: "0xFF486124612662E74F3055a71f45EAD3451d1CD9" });
        console.log("   ✅ settle(18) staticCall SUCCESS");
    } catch (e: any) {
        console.log("   ❌ settle(18) still fails:", (e as any).reason || (e as any).message?.slice(0, 100));
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 NEW ADDRESS:");
    console.log("   OptionsSettlement:", osAddr);
    console.log("=".repeat(60));
    console.log("⚠️  Update frontend config.ts: OptionsSettlement address");
    console.log("=".repeat(60));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
