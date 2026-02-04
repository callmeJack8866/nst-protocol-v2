/**
 * diagnose-callback-failure.ts
 * 
 * 诊断 FeedProtocol 回调失败的具体原因
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Diagnosing with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    console.log("\n=== Checking Order 1 ===");
    const order = await optionsCore.getOrder(1);
    console.log("Status:", order.status.toString());
    console.log("  0=RFQ_CREATED, 1=QUOTING, 2=MATCHED, 3=WAITING_INITIAL_FEED");
    console.log("  4=LIVE, 5=WAITING_FINAL_FEED, 6=PENDING_SETTLEMENT");

    console.log("\n=== Simulating processFeedCallback ===");

    // 检查 FeedProtocol 是否有 FEED_PROTOCOL_ROLE
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const hasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
    console.log("FeedProtocol has FEED_PROTOCOL_ROLE:", hasRole);

    // 如果订单状态是 5 (WAITING_FINAL_FEED)，模拟回调应该可以成功
    if (Number(order.status) === 5) {
        console.log("\nOrder is in WAITING_FINAL_FEED - callback should work");

        // 使用 deployer 模拟 FeedProtocol 调用（需要先授予权限）
        console.log("Granting FEED_PROTOCOL_ROLE to deployer for testing...");
        try {
            const grantTx = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, deployer.address);
            await grantTx.wait();
            console.log("✓ Role granted to deployer");

            // 尝试调用 processFeedCallback
            console.log("\nCalling processFeedCallback...");
            const finalPrice = order.lastFeedPrice > 0
                ? order.lastFeedPrice
                : ethers.parseUnits("12", 18);

            const callbackTx = await optionsCore.processFeedCallback(
                1,              // orderId
                1,              // feedType (1 = Final)
                finalPrice
            );
            await callbackTx.wait();
            console.log("✓ processFeedCallback succeeded!");

            // 验证状态
            const updatedOrder = await optionsCore.getOrder(1);
            console.log("New status:", updatedOrder.status.toString());

        } catch (e: any) {
            console.log("Error:", e.message?.slice(0, 500));
            if (e.reason) {
                console.log("Reason:", e.reason);
            }
        }
    } else if (Number(order.status) === 4) {
        console.log("\nOrder is in LIVE - needs final feed first");
    } else if (Number(order.status) === 6) {
        console.log("\nOrder is already in PENDING_SETTLEMENT");
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
