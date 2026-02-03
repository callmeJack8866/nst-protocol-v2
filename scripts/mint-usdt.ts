import { ethers } from "hardhat";

async function main() {
    // 测试网 USDT 地址
    const USDT_ADDRESS = "0x9f2140319726F9b851073a303415f13EC0cdA269";

    // 目标钱包地址
    const TARGET_WALLET = "0xeadd55cf2ecaa09f2667d5a53dd1e825f05777a0";

    // 铸造数量: 100,000 USDT (18位精度)
    const MINT_AMOUNT = ethers.parseUnits("100000", 18);

    console.log("🪙 Minting USDT to:", TARGET_WALLET);
    console.log("📊 Amount:", ethers.formatUnits(MINT_AMOUNT, 18), "USDT");

    // 获取 USDT 合约
    const usdt = await ethers.getContractAt("MockERC20", USDT_ADDRESS);

    // 获取当前余额
    const balanceBefore = await usdt.balanceOf(TARGET_WALLET);
    console.log("💰 Balance before:", ethers.formatUnits(balanceBefore, 18), "USDT");

    // 铸造代币
    console.log("⏳ Minting...");
    const tx = await usdt.mint(TARGET_WALLET, MINT_AMOUNT);
    await tx.wait();
    console.log("✅ Transaction confirmed:", tx.hash);

    // 获取新余额
    const balanceAfter = await usdt.balanceOf(TARGET_WALLET);
    console.log("💰 Balance after:", ethers.formatUnits(balanceAfter, 18), "USDT");

    console.log("🎉 Done! USDT minted successfully.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
