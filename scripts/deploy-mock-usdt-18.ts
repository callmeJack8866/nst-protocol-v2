import { ethers, network } from "hardhat";

/**
 * 部署 18 位小数的 Mock USDT 并铸造测试代币
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("部署 18 位 Mock USDT");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
    console.log("=".repeat(60));

    // 部署 MockERC20 (18 decimals)
    console.log("\n1️⃣ 部署 Mock USDT (18 decimals)...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUsdt = await MockERC20.deploy("Mock USDT", "USDT", 18);
    await mockUsdt.waitForDeployment();
    const usdtAddress = await mockUsdt.getAddress();
    console.log(`   ✅ Mock USDT 部署地址: ${usdtAddress}`);

    // 铸造测试代币
    console.log("\n2️⃣ 铸造测试代币...");
    const mintAmount = ethers.parseUnits("1000000", 18); // 1,000,000 USDT
    await mockUsdt.mint(deployer.address, mintAmount);
    console.log(`   ✅ 已铸造 1,000,000 USDT 给 ${deployer.address}`);

    // 检查余额
    const balance = await mockUsdt.balanceOf(deployer.address);
    console.log(`   📊 当前余额: ${ethers.formatUnits(balance, 18)} USDT`);

    console.log("\n" + "=".repeat(60));
    console.log("📋 请更新以下配置:");
    console.log("=".repeat(60));
    console.log(`USDT 地址: ${usdtAddress}`);
    console.log("\n请在 frontend/src/contracts/config.ts 中更新 USDT 地址");
    console.log("然后重新部署 OptionsCore 等合约使用这个新 USDT");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
