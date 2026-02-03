import { ethers } from "hardhat";

async function main() {
    // Config 合约地址 (2026-02-02 部署)
    const CONFIG_ADDRESS = "0xaE29A224c82d9aDD134A769E56CaFcEAD8aF0304";

    console.log("📋 Updating Config for 6-decimal USDT...");

    // 获取 Config 合约
    const configABI = [
        "function setCreationFee(uint256 _value) external",
        "function setArbitrationFee(uint256 _value) external",
        "function setMinFeederStake(uint256 _value) external",
        "function creationFee() view returns (uint256)",
        "function arbitrationFee() view returns (uint256)",
        "function minFeederStake() view returns (uint256)",
    ];

    const [signer] = await ethers.getSigners();
    const config = new ethers.Contract(CONFIG_ADDRESS, configABI, signer);

    // 查看当前值
    console.log("📊 Current values:");
    console.log("  - creationFee:", ethers.formatUnits(await config.creationFee(), 18), "(should be 1 USDT)");
    console.log("  - arbitrationFee:", ethers.formatUnits(await config.arbitrationFee(), 18), "(should be 30 USDT)");
    console.log("  - minFeederStake:", ethers.formatUnits(await config.minFeederStake(), 18), "(should be 100 USDT)");

    // 6位精度的值
    const creationFee_6decimals = 1_000_000n;          // 1 USDT (6 decimals)
    const arbitrationFee_6decimals = 30_000_000n;      // 30 USDT (6 decimals)
    const minFeederStake_6decimals = 100_000_000n;     // 100 USDT (6 decimals)

    console.log("\n⏳ Updating creationFee to 1 USDT (1e6)...");
    let tx = await config.setCreationFee(creationFee_6decimals);
    await tx.wait();
    console.log("✅ creationFee updated");

    console.log("⏳ Updating arbitrationFee to 30 USDT (30e6)...");
    tx = await config.setArbitrationFee(arbitrationFee_6decimals);
    await tx.wait();
    console.log("✅ arbitrationFee updated");

    console.log("⏳ Updating minFeederStake to 100 USDT (100e6)...");
    tx = await config.setMinFeederStake(minFeederStake_6decimals);
    await tx.wait();
    console.log("✅ minFeederStake updated");

    // 验证新值
    console.log("\n📊 New values:");
    console.log("  - creationFee:", (await config.creationFee()).toString(), "=", Number(await config.creationFee()) / 1e6, "USDT");
    console.log("  - arbitrationFee:", (await config.arbitrationFee()).toString(), "=", Number(await config.arbitrationFee()) / 1e6, "USDT");
    console.log("  - minFeederStake:", (await config.minFeederStake()).toString(), "=", Number(await config.minFeederStake()) / 1e6, "USDT");

    console.log("\n🎉 Config updated successfully for 6-decimal USDT!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
