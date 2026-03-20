/**
 * setup-testnet-tier.ts
 * 
 * 测试网专用：将 FeedProtocol 的 Tier 配置降低为 1 人即可喂价
 * （生产环境不应使用此脚本）
 * 
 * 用法: npx hardhat run scripts/setup-testnet-tier.ts --network bscTestnet
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const addresses = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"), "utf8")
    );

    const fp = await ethers.getContractAt("FeedProtocol", addresses.FeedProtocol);
    console.log("FeedProtocol:", addresses.FeedProtocol);

    // 读取当前配置
    const before = await fp.tierConfigs(0);
    console.log("Before Tier_5_3:", {
        totalFeeders: before.totalFeeders,
        effectiveFeeds: before.effectiveFeeds,
        totalFee: ethers.formatEther(before.totalFee),
    });

    // 设置测试网 Tier 配置：1 人即可
    console.log("\nSetting Tier_5_3 to 1 feeder...");
    await (await fp.setTierConfig(
        0,                          // Tier_5_3
        1,                          // totalFeeders = 1
        1,                          // effectiveFeeds = 1
        ethers.parseEther("0.3"),   // platformFee
        ethers.parseEther("2.7"),   // feederReward
        ethers.parseEther("3")      // totalFee = 3 USDT
    )).wait();

    const after = await fp.tierConfigs(0);
    console.log("After Tier_5_3:", {
        totalFeeders: after.totalFeeders,
        effectiveFeeds: after.effectiveFeeds,
        totalFee: ethers.formatEther(after.totalFee),
    });

    console.log("\n✅ 测试网 Tier 配置已就绪（1 人即可喂价）");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
