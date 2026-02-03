import { ethers } from "hardhat";

/**
 * 手动完成期末喂价 - 调用 processFinalFeedResult
 */

const BSC_TESTNET = {
    OptionsCore: '0x266Cc281bEcDe06834a13B9f08881877e309FB0b',
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Processing final feed with account:", deployer.address);

    // 获取合约实例
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = OptionsCore.attach(BSC_TESTNET.OptionsCore);

    // 检查订单当前状态
    const orderId = 2;
    console.log(`\n=== Checking Order #${orderId} Status ===`);
    let order = await optionsCore.getOrder(orderId);
    console.log("Current Order Status:", Number(order.status));
    console.log("Status Map: 3=WAITING_INITIAL_FEED, 4=LIVE, 5=WAITING_FINAL_FEED, 6=PENDING_SETTLEMENT");

    // 使用与期初喂价相同的最终价格 (模拟)
    const finalPrice = 3000000000000000000n; // 3e18 = 3 USDT

    console.log(`\n=== Processing Final Feed for Order #${orderId} ===`);
    console.log(`Final Price: ${finalPrice} (${Number(finalPrice) / 1e18} in human readable)`);

    try {
        console.log("\nCalling processFinalFeedResult...");
        const tx = await optionsCore.processFinalFeedResult(orderId, finalPrice);
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt?.blockNumber);
        console.log("✅ Order status synced to PENDING_SETTLEMENT!");

        // 验证状态
        order = await optionsCore.getOrder(orderId);
        console.log("\n=== Verification ===");
        console.log("New Order Status:", Number(order.status));
        console.log("LastFeedPrice:", order.lastFeedPrice?.toString());
    } catch (e: any) {
        console.error("❌ Error:", e.message);
        if (e.message.includes("order not live")) {
            console.log("Order is not in LIVE status, may need different handling");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
