/**
 * check-feed-requests.ts
 * 
 * 检查喂价请求的配置和状态
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    console.log("\n=== Checking Feed Requests ===");

    const nextRequestId = await feedProtocol.nextRequestId();
    console.log("Total feed requests:", (Number(nextRequestId) - 1));

    for (let i = 1; i < Math.min(Number(nextRequestId), 10); i++) { // 最多检查10个
        console.log(`\n--- Feed Request ${i} ---`);
        try {
            const request = await feedProtocol.getFeedRequest(i);
            console.log("  orderId:", request.orderId.toString());
            console.log("  feedType:", request.feedType.toString(), "(0=Initial, 1=Final)");
            console.log("  totalFeeders:", request.totalFeeders.toString());
            console.log("  submittedCount:", request.submittedCount.toString());
            console.log("  finalized:", request.finalized);
            console.log("  finalPrice:", request.finalPrice.toString());
        } catch (e: any) {
            console.log("  Error:", e.message?.slice(0, 100));
        }
    }

    console.log("\n=== Checking Recent CallbackFailed Events ===");
    try {
        const filter = feedProtocol.filters.CallbackFailed();
        const events = await feedProtocol.queryFilter(filter, -50000); // 最近5万区块
        console.log("Found", events.length, "CallbackFailed events");

        for (const event of events.slice(-5)) { // 最后5个
            console.log("  RequestId:", event.args?.[0].toString());
            console.log("  OrderId:", event.args?.[1].toString());
            console.log("  Reason:", event.args?.[2]);
        }
    } catch (e: any) {
        console.log("Error querying events:", e.message?.slice(0, 100));
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
