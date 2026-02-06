/**
 * test-full-flow.ts
 * 
 * 在新合约上测试完整的订单→喂价→回调→settle 流程
 * 验证回调自动化是否正常工作
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    console.log("\n=== Step 1: Create Test Order ===");

    // Approve USDT
    const approveAmount = ethers.parseUnits("1000", 6);
    await (await usdt.approve(OPTIONS_CORE_ADDRESS, approveAmount)).wait();
    await (await usdt.approve(FEED_PROTOCOL_ADDRESS, approveAmount)).wait();
    console.log("✓ USDT approved");

    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + 86400 * 30; // 30 days

    // 创建卖方订单（deployer 同时作为卖方）
    try {
        const tx = await optionsCore.createSellerOrder(
            "测试标的",          // underlyingName
            "TEST001",          // underlyingCode
            "A股",              // market
            "CN",               // country
            "100",              // refPrice - 字符串格式
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
    } catch (e: any) {
        console.log("Error creating order:", e.message?.slice(0, 300));
        return;
    }

    const orderId = (await optionsCore.nextOrderId()) - 1n;
    console.log("Order ID:", orderId.toString());

    // 检查订单状态
    let order = await optionsCore.getOrder(orderId);
    console.log("Order status:", order.status.toString());

    console.log("\n=== Step 2: Match Order (deployer as buyer) ===");
    try {
        await (await optionsCore.matchOrder(orderId)).wait();
        console.log("✓ Order matched");
        order = await optionsCore.getOrder(orderId);
        console.log("Order status after match:", order.status.toString());
    } catch (e: any) {
        console.log("Error matching:", e.message?.slice(0, 200));
    }

    console.log("\n=== Step 3: Set VaultManager Balance for Seller ===");
    const marginAmount = order.currentMargin + ethers.parseUnits("5", 6);
    await (await vaultManager.adminSetMarginBalance(order.seller, USDT_ADDRESS, marginAmount)).wait();
    console.log("✓ Seller margin set:", ethers.formatUnits(marginAmount, 6), "USDT");

    console.log("\n=== Step 4: Create Initial Feed Request ===");
    const feedFee = await feedProtocol.getFeedFee(0); // Tier 0
    console.log("Feed fee:", ethers.formatUnits(feedFee, 6), "USDT");

    // 注册为喂价员（如果还没注册）
    try {
        const feeder = await feedProtocol.getFeeder(deployer.address);
        if (!feeder.isActive) {
            console.log("Registering as feeder...");
            const stakeAmount = ethers.parseUnits("100", 6);
            await (await feedProtocol.registerFeeder(stakeAmount)).wait();
            console.log("✓ Registered as feeder");
        } else {
            console.log("Already registered as feeder");
        }
    } catch (e: any) {
        console.log("Feeder check error:", e.message?.slice(0, 100));
    }

    // 创建期初喂价请求
    let requestId;
    try {
        const tx = await feedProtocol.createPublicFeedRequest(orderId, 0, 0); // feedType=Initial, tier=0
        const receipt = await tx.wait();
        requestId = (await feedProtocol.nextRequestId()) - 1n;
        console.log("✓ Initial feed request created, ID:", requestId.toString());
    } catch (e: any) {
        console.log("Error creating feed request:", e.message?.slice(0, 200));
        return;
    }

    console.log("\n=== Step 5: Submit Initial Feed ===");
    const initialPrice = ethers.parseUnits("100", 18); // 100 USD
    try {
        await (await feedProtocol.submitFeed(requestId, initialPrice)).wait();
        console.log("✓ Initial feed submitted");

        order = await optionsCore.getOrder(orderId);
        console.log("Order status after initial feed:", order.status.toString());
        console.log("Expected: 4 (LIVE)");
    } catch (e: any) {
        console.log("Error submitting initial feed:", e.message?.slice(0, 200));
    }

    console.log("\n=== Step 6: Create Final Feed Request ===");
    try {
        await (await feedProtocol.createPublicFeedRequest(orderId, 1, 0)).wait(); // feedType=Final
        requestId = (await feedProtocol.nextRequestId()) - 1n;
        console.log("✓ Final feed request created, ID:", requestId.toString());
    } catch (e: any) {
        console.log("Error creating final feed request:", e.message?.slice(0, 200));
        return;
    }

    console.log("\n=== Step 7: Submit Final Feed ===");
    const finalPrice = ethers.parseUnits("105", 18); // 105 USD (5% profit for buyer)
    try {
        await (await feedProtocol.submitFeed(requestId, finalPrice)).wait();
        console.log("✓ Final feed submitted");

        order = await optionsCore.getOrder(orderId);
        console.log("Order status after final feed:", order.status.toString());
        console.log("Expected: 6 (PENDING_SETTLEMENT)");

        if (Number(order.status) === 6) {
            console.log("\n🎉 CALLBACK WORKS! Status auto-updated to PENDING_SETTLEMENT");
        } else {
            console.log("\n⚠️ Callback did not update status. Current:", order.status.toString());

            // 检查 CallbackFailed 事件
            const filter = feedProtocol.filters.CallbackFailed();
            const events = await feedProtocol.queryFilter(filter, -1000);
            if (events.length > 0) {
                console.log("CallbackFailed events found:");
                for (const event of events) {
                    console.log("  Reason:", event.args?.[2]);
                }
            }
        }
    } catch (e: any) {
        console.log("Error submitting final feed:", e.message?.slice(0, 300));
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
