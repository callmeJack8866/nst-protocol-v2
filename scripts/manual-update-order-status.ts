/**
 * manual-update-order-status.ts
 * 
 * 使用 processFinalFeedResult 手动更新订单状态
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Updating with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    console.log("\n=== Checking Order 1 Status ===");
    const order = await optionsCore.getOrder(1);
    console.log("Current status:", order.status.toString());
    console.log("Last Feed Price:", order.lastFeedPrice.toString());

    if (Number(order.status) === 5) {
        console.log("\nOrder is in WAITING_FINAL_FEED (5)");
        console.log("Updating to PENDING_SETTLEMENT (6)...");

        try {
            const finalPrice = order.lastFeedPrice > 0
                ? order.lastFeedPrice
                : ethers.parseUnits("12", 18); // 默认价格 12

            console.log("Using final price:", finalPrice.toString());

            const tx = await optionsCore.processFinalFeedResult(1, finalPrice);
            await tx.wait();
            console.log("✓ Status updated!");

            // 验证
            const updatedOrder = await optionsCore.getOrder(1);
            console.log("New status:", updatedOrder.status.toString());
            console.log("Status Name:", ['RFQ_CREATED', 'QUOTING', 'MATCHED', 'WAITING_INITIAL_FEED', 'LIVE', 'WAITING_FINAL_FEED', 'PENDING_SETTLEMENT', 'ARBITRATION', 'SETTLED', 'LIQUIDATED', 'CANCELLED'][Number(updatedOrder.status)]);
        } catch (e: any) {
            console.log("Error:", e.message?.slice(0, 500));
            if (e.reason) {
                console.log("Reason:", e.reason);
            }
        }
    } else if (Number(order.status) === 6) {
        console.log("✓ Order is already in PENDING_SETTLEMENT (6)");
    } else {
        console.log("Order status:", order.status.toString(), "- no action needed");
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
