/**
 * deep-debug-create-order.ts
 * 
 * 深入调试创建订单功能，检查每个可能的失败点
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    console.log("\n=== Step 1: Check OptionsCore State ===");
    try {
        const nextOrderId = await optionsCore.nextOrderId();
        console.log("✓ nextOrderId:", nextOrderId.toString());
    } catch (e: any) {
        console.log("✗ Error getting nextOrderId:", e.message?.slice(0, 200));
    }

    console.log("\n=== Step 2: Check Config in OptionsCore ===");
    try {
        const configAddr = await optionsCore.config();
        console.log("✓ Config address:", configAddr);

        const config = await ethers.getContractAt("Config", configAddr);
        const tradingFeeRate = await config.tradingFeeRate();
        console.log("✓ tradingFeeRate:", tradingFeeRate.toString());
    } catch (e: any) {
        console.log("✗ Error with Config:", e.message?.slice(0, 200));
    }

    console.log("\n=== Step 3: Check VaultManager in OptionsCore ===");
    try {
        const vmAddr = await optionsCore.vaultManager();
        console.log("✓ VaultManager address:", vmAddr);

        // 检查 VAULT_OPERATOR_ROLE
        const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const vmContract = await ethers.getContractAt("VaultManager", vmAddr);
        const hasRole = await vmContract.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
        console.log("✓ OptionsCore has VAULT_OPERATOR_ROLE:", hasRole);
    } catch (e: any) {
        console.log("✗ Error with VaultManager:", e.message?.slice(0, 200));
    }

    console.log("\n=== Step 4: Check USDT balance and allowance ===");
    const balance = await usdt.balanceOf(deployer.address);
    console.log("USDT Balance:", ethers.formatUnits(balance, 6));

    const allowance = await usdt.allowance(deployer.address, OPTIONS_CORE_ADDRESS);
    console.log("USDT Allowance to OptionsCore:", ethers.formatUnits(allowance, 6));

    // 如果 allowance 不够，先 approve
    const requiredAmount = ethers.parseUnits("100", 6);
    if (allowance < requiredAmount) {
        console.log("\nApproving USDT...");
        const approveTx = await usdt.approve(OPTIONS_CORE_ADDRESS, ethers.parseUnits("1000000", 6));
        await approveTx.wait();
        console.log("✓ USDT approved");
    }

    console.log("\n=== Step 5: Try createBuyerRFQ with staticCall ===");

    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + 86400 * 30; // 30 days from now

    try {
        const orderId = await optionsCore.createBuyerRFQ.staticCall(
            "茅台",              // underlyingName
            "600519",           // underlyingCode  
            "A股",              // market
            "CN",               // country
            "1800",             // refPrice
            0,                  // direction (Call)
            ethers.parseUnits("100", 6),  // notionalUSDT
            expiryTimestamp,    // expiryTimestamp
            500,                // premiumRate (5%)
            2000,               // marginRate (20%)
            1000,               // minMarginRate (10%)
            86400,              // arbitrationWindow
            3600,               // marginCallDeadline
            false,              // dividendAdjustment
            0,                  // liquidationRule
            0,                  // consecutiveDays
            0,                  // dailyLimitPercent
            0                   // feedRule
        );
        console.log("✓ staticCall succeeded! Would create order:", orderId.toString());

        // 如果静态调用成功，实际执行
        console.log("\n=== Step 6: Execute createBuyerRFQ ===");
        const tx = await optionsCore.createBuyerRFQ(
            "茅台",
            "600519",
            "A股",
            "CN",
            "1800",
            0,
            ethers.parseUnits("100", 6),
            expiryTimestamp,
            500,
            2000,
            1000,
            86400,
            3600,
            false,
            0,
            0,
            0,
            0
        );
        const receipt = await tx.wait();
        console.log("✓ Order created! TX:", receipt?.hash);

    } catch (e: any) {
        console.log("✗ createBuyerRFQ failed!");
        console.log("Error:", e.message?.slice(0, 500));

        if (e.reason) {
            console.log("Revert reason:", e.reason);
        }
        if (e.data) {
            console.log("Error data:", e.data);
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
