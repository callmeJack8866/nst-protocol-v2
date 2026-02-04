/**
 * check-order-status.ts
 * 
 * 检查订单实际状态
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    console.log("\n=== Checking Orders ===");

    const nextOrderId = await optionsCore.nextOrderId();
    console.log("Total orders:", nextOrderId.toString());

    // 检查最近的订单
    for (let i = 1; i <= Math.min(Number(nextOrderId) - 1, 5); i++) {
        console.log(`\n--- Order ${i} ---`);
        try {
            const order = await optionsCore.getOrder(i);
            console.log("  Status:", order.status.toString());
            console.log("  Status Name:", ['RFQ_CREATED', 'QUOTING', 'MATCHED', 'WAITING_INITIAL_FEED', 'LIVE', 'WAITING_FINAL_FEED', 'PENDING_SETTLEMENT', 'ARBITRATION', 'SETTLED', 'LIQUIDATED', 'CANCELLED'][Number(order.status)]);
            console.log("  Buyer:", order.buyer);
            console.log("  Seller:", order.seller);
            console.log("  Last Feed Price:", order.lastFeedPrice.toString());
            console.log("  Last Feed Time:", order.lastFeedTime.toString());

            // 如果状态是 5 (WAITING_FINAL_FEED) 但应该是 6 (PENDING_SETTLEMENT)
            if (Number(order.status) === 5) {
                console.log("  ⚠️ Order is still in WAITING_FINAL_FEED status");
                console.log("  ⚠️ This might mean the callback from FeedProtocol didn't update the status");
            }

            if (Number(order.status) === 6) {
                console.log("  ✓ Order is in PENDING_SETTLEMENT - ready to settle!");
            }
        } catch (e: any) {
            console.log("  Error:", e.message?.slice(0, 100));
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
