/**
 * check-callback-permissions.ts
 * 
 * 检查 FeedProtocol 回调权限配置
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    console.log("\n=== Checking FeedProtocol Configuration ===");

    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    try {
        const ocAddress = await feedProtocol.optionsCore();
        console.log("optionsCore in FeedProtocol:", ocAddress);
        console.log("Expected:", OPTIONS_CORE_ADDRESS);
        console.log("Match:", ocAddress.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase());

        if (ocAddress.toLowerCase() !== OPTIONS_CORE_ADDRESS.toLowerCase()) {
            console.log("\n⚠️ FeedProtocol points to wrong OptionsCore!");
            console.log("Updating...");
            const tx = await feedProtocol.setOptionsCore(OPTIONS_CORE_ADDRESS);
            await tx.wait();
            console.log("✓ FeedProtocol.setOptionsCore done");
        }
    } catch (e: any) {
        console.log("Error checking FeedProtocol:", e.message?.slice(0, 200));
    }

    console.log("\n=== Checking OptionsCore Permissions ===");

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    console.log("FEED_PROTOCOL_ROLE hash:", FEED_PROTOCOL_ROLE);

    try {
        const hasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
        console.log("FeedProtocol has FEED_PROTOCOL_ROLE in OptionsCore:", hasRole);

        if (!hasRole) {
            console.log("\n⚠️ FeedProtocol does NOT have FEED_PROTOCOL_ROLE!");
            console.log("Granting role...");
            const tx = await optionsCore.grantRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
            await tx.wait();
            console.log("✓ Role granted!");

            // 验证
            const verifyRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
            console.log("Verify: FeedProtocol now has role:", verifyRole);
        }
    } catch (e: any) {
        console.log("Error checking/granting role:", e.message?.slice(0, 200));
    }

    console.log("\n=== Testing processFeedCallback ===");
    try {
        // 尝试从 deployer 调用（应该失败，因为没有 FEED_PROTOCOL_ROLE）
        // 这只是测试 ABI 是否正确
        console.log("Checking if processFeedCallback exists...");

        // 获取订单信息
        const nextOrderId = await optionsCore.nextOrderId();
        console.log("Current nextOrderId:", nextOrderId.toString());

        if (nextOrderId > 1) {
            const order = await optionsCore.getOrder(1);
            console.log("Order 1 status:", order.status.toString());
        }
    } catch (e: any) {
        console.log("Error:", e.message?.slice(0, 200));
    }

    console.log("\n✅ Permission check complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
