import { ethers } from "hardhat";

async function main() {
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";
    const [signer] = await ethers.getSigners();

    const usdtABI = [
        "function mint(address to, uint256 amount) external",
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
    ];

    const usdt = new ethers.Contract(USDT_ADDRESS, usdtABI, signer);

    console.log("📊 Mock USDT Info:");
    const decimals = await usdt.decimals();
    console.log(`   Decimals: ${decimals}`);
    // 目标地址列表
    const targetAddresses = [
        "0x3EC123a28c41c778106b925B567628D2e8cdBaE0",
        "0xc008409A0e8ABb733762A2A0F6Eff9A8C1761507",
        "0x99aA9AaAd70a582bb33D3b026cBCaeEC1Dd734FF",
    ];

    // 铸造 100万 USDT 给每个地址
    const mintAmount = ethers.parseUnits("1000000", 18);

    for (const targetAddress of targetAddresses) {
        const currentBalance = await usdt.balanceOf(targetAddress);
        console.log(`\n📊 ${targetAddress.slice(0, 10)}... 当前余额: ${ethers.formatUnits(currentBalance, decimals)} USDT`);

        console.log(`⏳ 铸造 1,000,000 USDT...`);
        const tx = await usdt.mint(targetAddress, mintAmount);
        await tx.wait();

        const newBalance = await usdt.balanceOf(targetAddress);
        console.log(`✅ 铸造完成！新余额: ${ethers.formatUnits(newBalance, decimals)} USDT`);
    }

    console.log("\n🎉 所有地址铸造完成！");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
