import { ethers } from "hardhat";

/**
 * 将所有 Tier 的 totalFeeders 设为 1（测试环境，只有 1 个 feeder）
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const FP_ADDR = "0x3ADc2a24943d3B9ADd5570A7ad2035Ef547c6E45";
    const abi = [
        "function setTierConfig(uint8 tier, uint8 totalFeeders, uint8 effectiveFeeds, uint256 platformFee, uint256 feederReward, uint256 totalFee) external",
        "function tierConfigs(uint8) view returns (uint256 totalFeeders, uint256 effectiveFeeds, uint256 totalFee, uint256 platformFee, uint256 feederReward)",
    ];
    const fp = new ethers.Contract(FP_ADDR, abi, deployer);

    const tiers = [
        { tier: 0, totalFeeders: 1, effectiveFeeds: 1, platformFee: ethers.parseUnits("0.1", 18), feederReward: ethers.parseUnits("0.2", 18), totalFee: ethers.parseUnits("0.3", 18) },
        { tier: 1, totalFeeders: 1, effectiveFeeds: 1, platformFee: ethers.parseUnits("0.15", 18), feederReward: ethers.parseUnits("0.35", 18), totalFee: ethers.parseUnits("0.5", 18) },
        { tier: 2, totalFeeders: 1, effectiveFeeds: 1, platformFee: ethers.parseUnits("0.2", 18), feederReward: ethers.parseUnits("0.6", 18), totalFee: ethers.parseUnits("0.8", 18) },
    ];

    for (const t of tiers) {
        console.log(`Setting Tier ${t.tier}...`);
        const tx = await fp.setTierConfig(t.tier, t.totalFeeders, t.effectiveFeeds, t.platformFee, t.feederReward, t.totalFee);
        await tx.wait();
        console.log(`  ✅ Tier ${t.tier} set to 1 feeder`);
    }

    // Verify
    for (let i = 0; i < 3; i++) {
        const cfg = await fp.tierConfigs(i);
        console.log(`Tier ${i}: totalFeeders=${cfg.totalFeeders}, effectiveFeeds=${cfg.effectiveFeeds}`);
    }

    console.log("\n✅ All tiers configured for single-feeder testing!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
