/**
 * fix-and-test-settle.ts
 * 
 * 手动更新订单状态并测试 settle 是否可以工作
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Operating with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    console.log("\n=== Step 1: Check Order 1 Status ===");
    const order = await optionsCore.getOrder(1);
    console.log("Current status:", order.status.toString());
    console.log("LastFeedPrice:", order.lastFeedPrice.toString());
    console.log("RefPrice:", order.refPrice);
    console.log("CurrentMargin:", order.currentMargin.toString());
    console.log("Buyer:", order.buyer);
    console.log("Seller:", order.seller);

    if (Number(order.status) === 5) {
        console.log("\n=== Step 2: Updating to PENDING_SETTLEMENT ===");

        // 使用已有的喂价结果，或设置默认值
        const finalPrice = order.lastFeedPrice > 0
            ? order.lastFeedPrice
            : ethers.parseUnits("12", 18);

        console.log("Using finalPrice:", ethers.formatUnits(finalPrice, 18));

        const tx = await optionsCore.processFinalFeedResult(1, finalPrice);
        await tx.wait();
        console.log("✓ Status updated to PENDING_SETTLEMENT");

        // 验证
        const updatedOrder = await optionsCore.getOrder(1);
        console.log("New status:", updatedOrder.status.toString());
    } else if (Number(order.status) === 6) {
        console.log("Order is already in PENDING_SETTLEMENT");
    }

    console.log("\n=== Step 3: Testing settle via staticCall ===");
    try {
        await optionsCore.settle.staticCall(1);
        console.log("✓ settle staticCall succeeded!");

        console.log("\n=== Step 4: Executing settle ===");
        const settleTx = await optionsCore.settle(1);
        await settleTx.wait();
        console.log("✓ settle executed successfully!");

        // 验证最终状态
        const finalOrder = await optionsCore.getOrder(1);
        console.log("Final status:", finalOrder.status.toString(), "(should be 8 = SETTLED)");

    } catch (e: any) {
        console.log("✗ settle failed!");
        console.log("Error:", e.message?.slice(0, 500));
        if (e.reason) {
            console.log("Reason:", e.reason);
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
