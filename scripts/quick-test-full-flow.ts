/**
 * quick-test-full-flow.ts
 * 
 * 快速测试完整的订单流程（创建→喂价→结算）
 * 用于单喂价测试模式
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";
    const VAULT_MANAGER_ADDRESS = "0x3e7eEf51EdFb64D03738801c2d2174E3cB1400F7";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    console.log("\n=== Step 1: Check Current State ===");
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("Next Order ID:", nextOrderId.toString());

    const usdtBalance = await usdt.balanceOf(deployer.address);
    console.log("Deployer USDT Balance:", ethers.formatUnits(usdtBalance, 6));

    // 检查 VaultManager USDT 余额
    const vmBalance = await usdt.balanceOf(VAULT_MANAGER_ADDRESS);
    console.log("VaultManager USDT Balance:", ethers.formatUnits(vmBalance, 6));

    console.log("\n=== Step 2: Create Seller Order (Deployer as Seller) ===");

    // 先 approve
    const approveAmount = ethers.parseUnits("100", 6);
    console.log("Approving USDT...");
    await (await usdt.approve(OPTIONS_CORE_ADDRESS, approveAmount)).wait();
    console.log("✓ USDT approved");

    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + 86400 * 30; // 30 days

    try {
        const tx = await optionsCore.createSellerOrder(
            "测试标的",          // underlyingName
            "TEST001",          // underlyingCode
            "A股",              // market
            "CN",               // country
            "100",              // refPrice
            0,                  // direction (Call)
            ethers.parseUnits("10", 6),  // notionalUSDT (10 USDT)
            expiryTimestamp,    // expiryTimestamp
            500,                // premiumRate (5%)
            2000,               // marginRate (20%)
            0,                  // liquidationRule
            0,                  // consecutiveDays
            0,                  // dailyLimitPercent
            86400,              // arbitrationWindow (1 day)
            false,              // dividendAdjustment
            0,                  // exerciseDelay
            0                   // feedRule
        );
        const receipt = await tx.wait();
        console.log("✓ Seller order created! TX:", receipt?.hash);

        const newOrderId = await optionsCore.nextOrderId() - 1n;
        console.log("New Order ID:", newOrderId.toString());

    } catch (e: any) {
        console.log("Error creating order:", e.message?.slice(0, 500));
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
