/**
 * createFinalFeedRequest.ts
 * 
 * 手动创建期末喂价请求
 * 用法: npx hardhat run scripts/createFinalFeedRequest.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // 新合约地址
    const FEED_PROTOCOL_ADDRESS = "0x5D89Bf9daae4B361315AE7d2dADf6091342B9858";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";

    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    // 参数
    const orderId = 1;
    const feedType = 1; // 1 = Final
    const tier = 0; // FeedTier.Tier_5_3

    // 获取费用
    const fee = await feedProtocol.getFeedFee(tier);
    console.log("Feed Fee:", ethers.formatUnits(fee, 18), "USDT");

    // 检查余额和授权
    const balance = await usdt.balanceOf(deployer.address);
    console.log("USDT Balance:", ethers.formatUnits(balance, 18));

    const allowance = await usdt.allowance(deployer.address, FEED_PROTOCOL_ADDRESS);
    console.log("Current Allowance:", ethers.formatUnits(allowance, 18));

    // 授权 USDT
    if (allowance < fee) {
        console.log("\nApproving USDT...");
        const approveTx = await usdt.approve(FEED_PROTOCOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        console.log("✓ USDT approved");
    }

    // 创建期末喂价请求
    console.log(`\nCreating FINAL feed request for Order ${orderId}...`);
    const tx = await feedProtocol.requestFeedPublic(orderId, feedType, tier);
    console.log("TX sent:", tx.hash);
    await tx.wait();
    console.log("✓ Final feed request created!");

    // 验证
    const nextRequestId = await feedProtocol.nextRequestId();
    console.log("\nNew Request ID:", (Number(nextRequestId) - 1));

    const request = await feedProtocol.feedRequests(Number(nextRequestId) - 1);
    console.log("Request details:");
    console.log("  Order ID:", Number(request[1]));
    console.log("  Feed Type:", Number(request[2]) === 1 ? "Final" : "Initial");
    console.log("  Finalized:", request[9]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
