/**
 * fix-order-status.ts
 * 
 * 手动更新订单状态到 PENDING_SETTLEMENT 并检查回调配置
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    console.log("\n=== Checking FeedProtocol Configuration ===");
    try {
        const ocAddress = await feedProtocol.optionsCore();
        console.log("OptionsCore in FeedProtocol:", ocAddress);
        console.log("Expected:", OPTIONS_CORE_ADDRESS);
        console.log("Match:", ocAddress.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase());

        if (ocAddress.toLowerCase() !== OPTIONS_CORE_ADDRESS.toLowerCase()) {
            console.log("\n⚠️ FeedProtocol points to wrong OptionsCore! Updating...");
            const tx = await feedProtocol.setOptionsCore(OPTIONS_CORE_ADDRESS);
            await tx.wait();
            console.log("✓ FeedProtocol.setOptionsCore done");
        }
    } catch (e: any) {
        console.log("Error:", e.message?.slice(0, 200));
    }

    console.log("\n=== Manually updating Order 1 status ===");

    // 检查订单状态
    const order = await optionsCore.getOrder(1);
    console.log("Current status:", order.status.toString());
    console.log("Last Feed Price:", order.lastFeedPrice.toString());

    if (Number(order.status) === 5) {
        console.log("\nOrder is in WAITING_FINAL_FEED, updating to PENDING_SETTLEMENT...");

        try {
            // 使用 processFinalFeedResult 更新状态
            const tx = await optionsCore.processFinalFeedResult(
                1,                    // orderId
                order.lastFeedPrice,  // feedPrice
                true                  // isFinal
            );
            await tx.wait();
            console.log("✓ Order status updated!");

            // 验证
            const updatedOrder = await optionsCore.getOrder(1);
            console.log("New status:", updatedOrder.status.toString());
            console.log("Status Name:", ['RFQ_CREATED', 'QUOTING', 'MATCHED', 'WAITING_INITIAL_FEED', 'LIVE', 'WAITING_FINAL_FEED', 'PENDING_SETTLEMENT', 'ARBITRATION', 'SETTLED', 'LIQUIDATED', 'CANCELLED'][Number(updatedOrder.status)]);
        } catch (e: any) {
            console.log("Error updating status:", e.message?.slice(0, 300));
        }
    } else if (Number(order.status) === 6) {
        console.log("✓ Order is already in PENDING_SETTLEMENT");
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
