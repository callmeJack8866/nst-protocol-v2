import { ethers } from "hardhat";

/**
 * 手动同步订单 #1 状态 - 调用 processInitialFeedResult
 */

const BSC_TESTNET = {
    OptionsCore: '0x35B99f2B1aca75a8fBf4E9121bF67D8d3DF4B16F',
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Syncing with account:", deployer.address);

    // 获取合约实例
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = OptionsCore.attach(BSC_TESTNET.OptionsCore);

    // 同步订单 #1 的状态
    const orderId = 1;
    const finalPrice = 3000000000000000000n; // 3e18

    console.log(`\n=== Syncing Order #${orderId} Status ===`);
    console.log(`Final Price: ${finalPrice} (${Number(finalPrice) / 1e18} in human readable)`);

    try {
        console.log("\nCalling processInitialFeedResult...");
        const tx = await optionsCore.processInitialFeedResult(orderId, finalPrice);
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt?.blockNumber);
        console.log("✅ Order status synced to LIVE!");

        // 验证状态
        const order = await optionsCore.getOrder(orderId);
        console.log("\n=== Verification ===");
        console.log("New Order Status:", Number(order.status));
        console.log("RefPrice:", order.refPrice);
        console.log("LastFeedPrice:", order.lastFeedPrice?.toString());
    } catch (e: any) {
        console.error("❌ Error:", e.message);
        if (e.message.includes("order not matched")) {
            console.log("Order is already synced or in wrong state");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
