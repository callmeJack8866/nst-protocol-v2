/**
 * test-callback-directly.ts
 * 
 * 直接测试 processFeedCallback 是否能正常更新订单状态
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    console.log("\n=== Current Order Status ===");
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("Total orders:", (Number(nextOrderId) - 1));

    // 找一个状态为 LIVE (4) 的订单来测试
    let testOrderId = 0;
    for (let i = 1; i < Number(nextOrderId); i++) {
        const order = await optionsCore.getOrder(i);
        console.log(`Order ${i}: status=${order.status}`);
        if (Number(order.status) === 4) { // LIVE
            testOrderId = i;
        }
    }

    if (testOrderId === 0) {
        console.log("\n没有找到 LIVE 状态的订单来测试回调");
        console.log("让我们测试 FeedProtocol 是否能正确调用 processFeedCallback");

        // 授予 deployer FEED_PROTOCOL_ROLE 来模拟回调
        const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
        console.log("\n授予 deployer FEED_PROTOCOL_ROLE...");
        await (await optionsCore.grantRole(FEED_PROTOCOL_ROLE, deployer.address)).wait();
        console.log("✓ 角色已授予");

        // 找一个 WAITING_FINAL_FEED 状态的订单
        for (let i = 1; i < Number(nextOrderId); i++) {
            const order = await optionsCore.getOrder(i);
            if (Number(order.status) === 5) { // WAITING_FINAL_FEED
                console.log(`\n测试订单 ${i} (WAITING_FINAL_FEED -> PENDING_SETTLEMENT)`);

                const finalPrice = ethers.parseUnits("105", 18);
                try {
                    const tx = await optionsCore.processFeedCallback(i, 1, finalPrice); // feedType=Final
                    await tx.wait();
                    console.log("✓ processFeedCallback 成功!");

                    const updatedOrder = await optionsCore.getOrder(i);
                    console.log("新状态:", updatedOrder.status.toString());
                } catch (e: any) {
                    console.log("✗ processFeedCallback 失败:", e.message?.slice(0, 300));
                }
                break;
            }
        }
    }

    console.log("\n=== 验证 FeedProtocol 调用 OptionsCore ===");

    // 检查 FeedProtocol 是否有正确角色
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const fpHasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
    console.log("FeedProtocol has FEED_PROTOCOL_ROLE:", fpHasRole);

    // 检查 FeedProtocol.optionsCore 指向
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const ocAddr = await feedProtocol.optionsCore();
    console.log("FeedProtocol.optionsCore:", ocAddr);
    console.log("Expected:", OPTIONS_CORE_ADDRESS);
    console.log("Match:", ocAddr.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase());

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
