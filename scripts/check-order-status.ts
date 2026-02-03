import { ethers } from "hardhat";

/**
 * 检查订单状态并查询喂价请求
 */

const BSC_TESTNET = {
    OptionsCore: '0x35B99f2B1aca75a8fBf4E9121bF67D8d3DF4B16F',
    FeedProtocol: '0xb618341Ce5a762891f0Ffddee7cFc2a4b29D7F36',
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    // 获取合约实例
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = OptionsCore.attach(BSC_TESTNET.OptionsCore);

    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = FeedProtocol.attach(BSC_TESTNET.FeedProtocol);

    // 检查订单 #1 状态
    console.log("\n=== Checking Order #1 ===");
    try {
        const order = await optionsCore.getOrder(1);
        console.log("Order Status:", Number(order.status));
        console.log("Status Map:");
        console.log("  0=RFQ_CREATED, 1=QUOTING, 2=MATCHED");
        console.log("  3=WAITING_INITIAL_FEED, 4=LIVE, 5=WAITING_FINAL_FEED");
        console.log("  6=PENDING_SETTLEMENT, 7=ARBITRATION, 8=SETTLED");
        console.log("Buyer:", order.buyer);
        console.log("Seller:", order.seller);
        console.log("RefPrice:", order.refPrice);
        console.log("LastFeedPrice:", order.lastFeedPrice?.toString());
        console.log("MatchedAt:", order.matchedAt ? new Date(Number(order.matchedAt) * 1000).toISOString() : 'N/A');
    } catch (e) {
        console.log("Error getting order:", e);
    }

    // 检查该订单的喂价请求
    console.log("\n=== Checking Order #1 Feed Requests ===");
    try {
        const requestIds = await feedProtocol.getOrderFeedRequests(1);
        console.log("Feed Request IDs for Order #1:", requestIds.map((id: bigint) => Number(id)));

        for (const reqId of requestIds) {
            const request = await feedProtocol.getFeedRequest(reqId);
            console.log(`\nRequest #${Number(reqId)} details:`);
            console.log("  FeedType:", Number(request.feedType), "(0=Initial, 1=Dynamic, 2=Final)");
            console.log("  Finalized:", request.finalized);
            console.log("  FinalPrice:", request.finalPrice?.toString());
            console.log("  SubmittedCount:", Number(request.submittedCount));
        }
    } catch (e) {
        console.log("No feed requests found for order #1 or error:", e);
    }

    // 诊断结论
    console.log("\n=== Diagnosis ===");
    const order = await optionsCore.getOrder(1);
    const status = Number(order.status);

    if (status === 2) {
        console.log("⚠️ Order is in MATCHED status - needs initial feed to become LIVE");
        console.log("   Solution: Either request initial feed, or use processInitialFeedResult to sync");
    } else if (status === 4) {
        console.log("✅ Order is LIVE - can proceed with early exercise");
    } else {
        console.log(`ℹ️ Order status is ${status} - check status map above`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
