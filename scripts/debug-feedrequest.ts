/**
 * debug-feedrequest.ts - 诊断 requestFeedPublic revert 原因
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const addresses = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"), "utf8")
    );

    const optionsCore = await ethers.getContractAt("OptionsCore", addresses.OptionsCore);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", addresses.FeedProtocol);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", addresses.USDT);

    console.log("Deployer:", deployer.address);
    console.log("FeedProtocol:", addresses.FeedProtocol);
    console.log("OptionsCore:", addresses.OptionsCore);

    // 1. 检查 FEED_PROTOCOL_ROLE
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const hasFPR = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, addresses.FeedProtocol);
    console.log("\n1. FeedProtocol has FEED_PROTOCOL_ROLE:", hasFPR);

    // 2. 检查 optionsCore ref
    const ocRef = await feedProtocol.optionsCore();
    console.log("2. feedProtocol.optionsCore():", ocRef);
    console.log("   Match OptionsCore:", ocRef.toLowerCase() === addresses.OptionsCore.toLowerCase());

    // 3. 检查 tier config
    const tier0 = await feedProtocol.tierConfigs(0);
    console.log("3. Tier_5_3:", {
        totalFeeders: Number(tier0.totalFeeders),
        effectiveFeeds: Number(tier0.effectiveFeeds),
        totalFee: ethers.formatEther(tier0.totalFee),
    });

    // 4. 检查活跃喂价员 — 通过 feederList array 长度估算
    try {
        let feederCount = 0;
        for (let i = 0; i < 20; i++) {
            try { await feedProtocol.feederList(i); feederCount++; } catch { break; }
        }
        console.log("4. Registered feeders (feederList length):", feederCount);
    } catch (e: any) {
        console.log("4. Error checking feeder list:", e.message?.slice(0, 100));
    }

    // 5. 检查 deployer 的 feeder 状态
    const feeder = await feedProtocol.getFeeder(deployer.address);
    console.log("5. Deployer feeder:", { isActive: feeder.isActive, staked: ethers.formatEther(feeder.stakedAmount) });

    // 6. 检查 deployer 对 FeedProtocol 的 allowance
    const allowance = await usdt.allowance(deployer.address, addresses.FeedProtocol);
    console.log("6. USDT allowance to FeedProtocol:", ethers.formatEther(allowance));

    // 7. 检查 deployer USDT 余额
    const balance = await usdt.balanceOf(deployer.address);
    console.log("7. USDT balance:", ethers.formatEther(balance));

    // 8. 找一个 MATCHED 的订单
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("\n8. nextOrderId:", Number(nextOrderId));
    let testOrderId = -1;
    for (let i = Number(nextOrderId) - 1; i >= 1; i--) {
        const order = await optionsCore.getOrder(i);
        if (Number(order.status) === 2) { // MATCHED
            console.log(`   Found MATCHED order: #${i}`);
            console.log("   buyer:", order.buyer);
            console.log("   seller:", order.seller);
            console.log("   feedRule:", Number(order.feedRule));
            testOrderId = i;
            break;
        }
    }

    if (testOrderId < 0) {
        console.log("   No MATCHED orders found, creating one...");
        // Create a quick RFQ + Quote + Accept
        const now = Math.floor(Date.now() / 1000);
        const tx = await optionsCore.createBuyerRFQ(
            "Debug", "DBG001", "A股", "CN", "100", 0,
            ethers.parseEther("10"), now + 86400 * 30,
            500, 1000, 0, ethers.ZeroAddress,
            12 * 3600, 2 * 3600, false, 0, 3, 10, 0
        );
        await tx.wait();
        testOrderId = Number(await optionsCore.nextOrderId()) - 1;
        console.log("   Created order:", testOrderId);

        // Submit quote
        await (await optionsCore.submitQuote(testOrderId, 300, 1500, 0, 3, 10)).wait();
        const quoteId = Number(await optionsCore.nextQuoteId()) - 1;
        console.log("   Submitted quote:", quoteId);

        // Accept quote
        await (await optionsCore.acceptQuote(quoteId)).wait();
        console.log("   Accepted quote");
    }

    // 9. staticCall requestFeedPublic
    console.log(`\n9. Testing requestFeedPublic(${testOrderId}, 0, 0) via staticCall...`);
    try {
        const result = await feedProtocol.requestFeedPublic.staticCall(testOrderId, 0, 0);
        console.log("   ✓ staticCall succeeded! requestId:", result.toString());
    } catch (e: any) {
        console.log("   ✗ staticCall FAILED!");
        console.log("   Reason:", e.reason || "N/A");
        console.log("   Message:", (e.message || "").slice(0, 500));
        if (e.data) console.log("   Data:", e.data);

        // 10. 逐步模拟排查
        console.log("\n10. 逐步排查:");
        
        // 10a. _validateFeedTypeForStatus
        const order = await optionsCore.getOrder(testOrderId);
        console.log("    a. Order status:", Number(order.status), "(need 2 for Initial feed)");
        console.log("    b. feedRule:", Number(order.feedRule), "(need 0 for NormalFeed)");
        
        // 10c. Fee check
        const fee = tier0.totalFee;
        console.log("    c. Fee needed:", ethers.formatEther(fee), "USDT");
        console.log("    d. Allowance:", ethers.formatEther(allowance), ">= fee:", allowance >= fee);
        console.log("    e. Balance:", ethers.formatEther(balance), ">= fee:", balance >= fee);

        // 10f. 直接尝试 onFeedRequested
        console.log("\n    f. Testing optionsCore.onFeedRequested via staticCall...");
        try {
            await optionsCore.onFeedRequested.staticCall(testOrderId, 0);
            console.log("       ✓ onFeedRequested would succeed");
        } catch (e2: any) {
            console.log("       ✗ onFeedRequested failed:", e2.reason || e2.message?.slice(0, 200));
        }
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
