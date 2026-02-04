/**
 * debug-create-order.ts
 * 
 * 详细调试创建订单功能
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // 合约地址
    const OPTIONS_CORE_ADDRESS = "0x758e843E2e052Ddb65B92e0a7b8Fa84D1a70e4a2";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";
    const CONFIG_ADDRESS = "0xf8d98e07d6d6ded08a0ef2abbe4bde64bec32a38";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);
    const config = await ethers.getContractAt("Config", CONFIG_ADDRESS);

    console.log("\n=== Checking Config ===");
    try {
        const tradingFeeRate = await config.tradingFeeRate();
        console.log("tradingFeeRate:", tradingFeeRate.toString());
    } catch (e) {
        console.log("Error getting tradingFeeRate:", e);
    }

    console.log("\n=== Checking USDT Balance ===");
    const balance = await usdt.balanceOf(deployer.address);
    console.log("USDT Balance:", ethers.formatUnits(balance, 6));

    console.log("\n=== Checking USDT Allowance ===");
    const allowance = await usdt.allowance(deployer.address, OPTIONS_CORE_ADDRESS);
    console.log("USDT Allowance to OptionsCore:", ethers.formatUnits(allowance, 6));

    console.log("\n=== Checking Contract State ===");
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("nextOrderId:", nextOrderId.toString());

    // 检查 VaultManager
    const vmAddress = await optionsCore.vaultManager();
    console.log("VaultManager:", vmAddress);

    // 尝试调用 createBuyerRFQ（静态调用，不实际执行）
    console.log("\n=== Testing createBuyerRFQ (static call) ===");

    const testParams = {
        underlyingName: "茅台",
        underlyingCode: "600519",
        market: "A股",
        country: "CN",
        refPrice: "1800",
        direction: 0, // Call
        notionalUSDT: ethers.parseUnits("100", 6), // 100 USDT
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
        premiumRate: 500, // 5%
        marginRate: 2000, // 20%
        minMarginRate: 1000, // 10%
        arbitrationWindow: 86400, // 1 day
        marginCallDeadline: 3600, // 1 hour
        dividendAdjustment: false,
        liquidationRule: 0, // NoLiquidation
        consecutiveDays: 0,
        dailyLimitPercent: 0,
        feedRule: 0, // NormalFeed
    };

    try {
        const result = await optionsCore.createBuyerRFQ.staticCall(
            testParams.underlyingName,
            testParams.underlyingCode,
            testParams.market,
            testParams.country,
            testParams.refPrice,
            testParams.direction,
            testParams.notionalUSDT,
            testParams.expiryTimestamp,
            testParams.premiumRate,
            testParams.marginRate,
            testParams.minMarginRate,
            testParams.arbitrationWindow,
            testParams.marginCallDeadline,
            testParams.dividendAdjustment,
            testParams.liquidationRule,
            testParams.consecutiveDays,
            testParams.dailyLimitPercent,
            testParams.feedRule
        );
        console.log("✓ Static call succeeded! Would create order:", result.toString());
    } catch (e: any) {
        console.log("✗ Static call failed!");
        console.log("Error message:", e.message);
        if (e.data) {
            console.log("Error data:", e.data);
        }
        // 尝试解码错误
        if (e.reason) {
            console.log("Revert reason:", e.reason);
        }
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
