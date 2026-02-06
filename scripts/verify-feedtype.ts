/**
 * verify-feedtype.ts
 * 
 * 验证 FeedType 枚举值
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Verifying with account:", deployer.address);

    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";

    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);

    console.log("\n=== FeedType 枚举值检查 ===");
    console.log("预期: Initial=0, Dynamic=1, Final=2, Arbitration=3");

    const nextRequestId = await feedProtocol.nextRequestId();

    for (let i = Math.max(1, Number(nextRequestId) - 5); i < Number(nextRequestId); i++) {
        const request = await feedProtocol.getFeedRequest(i);
        console.log(`\n喂价请求 ${i}:`);
        console.log(`  orderId: ${request.orderId}`);
        console.log(`  feedType (raw): ${request.feedType}`);

        const feedTypeNames = ['Initial', 'Dynamic', 'Final', 'Arbitration'];
        const typeIndex = Number(request.feedType);
        console.log(`  feedType (name): ${feedTypeNames[typeIndex] || 'UNKNOWN'}`);
        console.log(`  finalized: ${request.finalized}`);

        // 检查是否是期末喂价
        if (typeIndex === 2) {
            console.log(`  ✓ 这是正确的 Final (2) 类型`);
        } else if (typeIndex === 1 && request.feedType.toString() !== '0') {
            console.log(`  ⚠️ 这是 Dynamic (1) 类型，不是 Final (2)!`);
        }
    }

    console.log("\n=== 检查创建请求时的 feedType ===");
    // 查看 createPublicFeedRequest 使用的接口
    const iface = feedProtocol.interface;
    const createFunc = iface.getFunction("createPublicFeedRequest");
    console.log("createPublicFeedRequest 签名:", createFunc?.format("full"));

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
