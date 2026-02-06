/**
 * debug-callback-issue.ts
 * 
 * 诊断为什么 FeedProtocol 回调失败
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Debugging with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    console.log("\n=== 检查最近的订单状态 ===");
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("总订单数:", Number(nextOrderId) - 1);

    for (let i = 1; i < Number(nextOrderId); i++) {
        const order = await optionsCore.getOrder(i);
        const statusNames = ['RFQ_CREATED', 'QUOTING', 'MATCHED', 'WAITING_INITIAL_FEED', 'LIVE', 'WAITING_FINAL_FEED', 'PENDING_SETTLEMENT', 'ARBITRATION', 'SETTLED', 'LIQUIDATED', 'CANCELLED'];
        console.log(`\n订单 ${i}:`);
        console.log(`  状态: ${order.status} (${statusNames[Number(order.status)]})`);
        console.log(`  lastFeedPrice: ${order.lastFeedPrice}`);
    }

    console.log("\n=== 检查最近的喂价请求 ===");
    const nextRequestId = await feedProtocol.nextRequestId();
    console.log("总喂价请求数:", Number(nextRequestId) - 1);

    for (let i = Math.max(1, Number(nextRequestId) - 5); i < Number(nextRequestId); i++) {
        const request = await feedProtocol.getFeedRequest(i);
        console.log(`\n喂价请求 ${i}:`);
        console.log(`  orderId: ${request.orderId}`);
        console.log(`  feedType: ${request.feedType} (0=Initial, 1=Final)`);
        console.log(`  finalized: ${request.finalized}`);
        console.log(`  finalPrice: ${request.finalPrice}`);
    }

    console.log("\n=== 检查 CallbackFailed 事件 ===");
    try {
        const filter = feedProtocol.filters.CallbackFailed();
        const events = await feedProtocol.queryFilter(filter, -10000);
        console.log("找到", events.length, "个 CallbackFailed 事件");

        for (const event of events) {
            const args = (event as any).args;
            console.log(`  RequestId: ${args[0]}, OrderId: ${args[1]}, Reason: ${args[2]}`);
        }
    } catch (e: any) {
        console.log("查询事件错误:", e.message?.slice(0, 100));
    }

    console.log("\n=== 模拟 processFeedCallback 调用 ===");
    // 找一个需要更新的订单
    for (let i = 1; i < Number(nextOrderId); i++) {
        const order = await optionsCore.getOrder(i);
        const status = Number(order.status);

        // 如果订单状态是 WAITING_FINAL_FEED (5) 或 LIVE (4)
        if (status === 4 || status === 5) {
            console.log(`\n尝试对订单 ${i} 调用 processFeedCallback (Final)...`);

            const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
            const deployer_has_role = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, deployer.address);

            if (!deployer_has_role) {
                console.log("授予 deployer FEED_PROTOCOL_ROLE...");
                await (await optionsCore.grantRole(FEED_PROTOCOL_ROLE, deployer.address)).wait();
            }

            try {
                const finalPrice = ethers.parseUnits("100", 18);
                const tx = await optionsCore.processFeedCallback(i, 1, finalPrice); // feedType=1 (Final)
                await tx.wait();
                console.log("✓ processFeedCallback 成功!");

                const updatedOrder = await optionsCore.getOrder(i);
                console.log("新状态:", updatedOrder.status.toString());
            } catch (e: any) {
                console.log("✗ 失败:", e.message?.slice(0, 300));
            }
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
