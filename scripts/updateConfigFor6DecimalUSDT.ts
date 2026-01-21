import { ethers, network } from "hardhat";

/**
 * 更新 Config 合约参数以支持 6 位小数的 USDT
 * 
 * 原参数：1 ether (18位小数) = 1,000,000,000,000,000,000
 * 新参数：1_000_000 (6位小数) = 1,000,000
 */

const CONFIG_ADDRESS = "0xaB09cEAd1288a2941354247Cd27365A3817F4661";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("Updating Config Contract for 6-Decimal USDT");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Config Address: ${CONFIG_ADDRESS}`);
    console.log("=".repeat(60));

    // 获取 Config 合约
    const config = await ethers.getContractAt("Config", CONFIG_ADDRESS);

    // 读取当前值
    const currentCreationFee = await config.creationFee();
    const currentArbitrationFee = await config.arbitrationFee();

    console.log(`\n📊 Current Values:`);
    console.log(`   creationFee: ${ethers.formatUnits(currentCreationFee, 18)} (18-dec)`);
    console.log(`   arbitrationFee: ${ethers.formatUnits(currentArbitrationFee, 18)} (18-dec)`);

    // 新值（6位小数格式）
    const newCreationFee = 1_000_000n;        // 1 USDT (6 decimals)
    const newArbitrationFee = 30_000_000n;    // 30 USDT (6 decimals)

    console.log(`\n🔄 Updating to 6-Decimal Format:`);
    console.log(`   New creationFee: ${newCreationFee} (= 1 USDT)`);
    console.log(`   New arbitrationFee: ${newArbitrationFee} (= 30 USDT)`);

    // 更新 creationFee
    console.log(`\n1️⃣ Updating creationFee...`);
    const tx1 = await config.setCreationFee(newCreationFee);
    await tx1.wait();
    console.log(`   ✅ creationFee updated!`);

    // 更新 arbitrationFee
    console.log(`\n2️⃣ Updating arbitrationFee...`);
    const tx2 = await config.setArbitrationFee(newArbitrationFee);
    await tx2.wait();
    console.log(`   ✅ arbitrationFee updated!`);

    // 验证更新
    const verifyCreationFee = await config.creationFee();
    const verifyArbitrationFee = await config.arbitrationFee();

    console.log(`\n✅ Verification:`);
    console.log(`   creationFee: ${verifyCreationFee} (${Number(verifyCreationFee) / 1_000_000} USDT)`);
    console.log(`   arbitrationFee: ${verifyArbitrationFee} (${Number(verifyArbitrationFee) / 1_000_000} USDT)`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Config updated successfully!");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
