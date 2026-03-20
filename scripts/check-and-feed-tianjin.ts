/**
 * check-and-feed-tianjin.ts
 * 
 * 查看最近的 NST 订单状态，并对 MATCHED 状态的订单手动触发 requestFeedPublic
 * 用于联调：让 FeedEngine 能看到在 NST 前端创建的订单
 * 
 * 用法: npx hardhat run scripts/check-and-feed-tianjin.ts --network bscTestnet
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const STATUS_MAP: Record<number, string> = {
    0: "RFQ_CREATED",
    1: "QUOTING",
    2: "MATCHED",
    3: "WAITING_INITIAL_FEED",
    4: "LIVE",
    5: "WAITING_FINAL_FEED",
    6: "PENDING_SETTLEMENT",
    7: "SETTLED",
    8: "CANCELLED",
    9: "EXPIRED",
};

async function main() {
    const [deployer] = await ethers.getSigners();
    const addresses = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"), "utf8")
    );

    console.log("═".repeat(60));
    console.log("  NST 订单检查 + 手动触发 requestFeedPublic");
    console.log("═".repeat(60));
    console.log(`  OptionsCore:   ${addresses.OptionsCore}`);
    console.log(`  FeedProtocol:  ${addresses.FeedProtocol}`);
    console.log(`  操作者:        ${deployer.address}`);
    console.log("");

    const optionsCore = await ethers.getContractAt("OptionsCore", addresses.OptionsCore);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", addresses.FeedProtocol);

    // ===== 查看近期订单（从 orderId=1 往上，最多查 20 个）=====
    console.log("📋 最近订单列表:\n");
    const matchedOrders: number[] = [];

    for (let id = 1; id <= 20; id++) {
        try {
            const order = await optionsCore.getOrder(id);
            const status = Number(order.status);
            const statusName = STATUS_MAP[status] ?? `UNKNOWN(${status})`;
            const isMatched = status === 2; // MATCHED - 可以发起喂价

            if (order.buyer === ethers.ZeroAddress) break; // 订单不存在

            console.log(`  ID=${id}  [${statusName}]  ${order.underlyingName} (${order.underlyingCode})`);
            console.log(`         买方: ${order.buyer}`);
            console.log(`         名义: ${ethers.formatEther(order.notionalUSDT)} USDT`);

            if (isMatched) {
                matchedOrders.push(id);
                console.log(`         ⚡ 可触发 requestFeedPublic`);
            }
            console.log("");
        } catch {
            break;
        }
    }

    if (matchedOrders.length === 0) {
        console.log("⚠  没有找到 MATCHED(2) 状态的订单。");
        console.log("   如果订单已是 WAITING_INITIAL_FEED(3) 或更高，说明已经发起过喂价请求。");
        console.log("   FeedEngine 未显示可能是因为事件在 FeedEngine 重启前发生。");
        console.log("\n💡 建议：在 FeedEngine 后端日志中查看是否有 [NST FeedProtocol] FeedRequested 记录。");
        return;
    }

    // ===== 对 MATCHED 订单发起 requestFeedPublic =====
    console.log(`\n🚀 对 ${matchedOrders.length} 个 MATCHED 订单发起 requestFeedPublic...\n`);

    // 检查是否是注册喂价员
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const isFeeder = await feedProtocol.isRegisteredFeeder(deployer.address).catch(() => false);
    console.log(`  喂价员检查: ${isFeeder ? "已注册" : "未注册（仍可以 Public 方式发起）"}`);

    for (const orderId of matchedOrders) {
        try {
            // feedType=0 (INITIAL), tier=0 (5-3)
            const feeData = await ethers.provider.getFeeData();
            const gasPrice = (feeData.gasPrice || 5000000000n) * 120n / 100n;

            // USDT approve FeedProtocol 喂价费（3 USDT）
            const usdt = await ethers.getContractAt(
                "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                addresses.USDT
            );
            const allowance = await usdt.allowance(deployer.address, addresses.FeedProtocol);
            const needed = ethers.parseEther("3");
            if (allowance < needed) {
                console.log(`  🔑 授权 FeedProtocol 喂价费...`);
                const approveTx = await usdt.approve(addresses.FeedProtocol, ethers.parseEther("10000"), {
                    gasPrice
                } as any);
                await approveTx.wait();
                console.log(`  ✅ 授权完成`);
            }

            console.log(`  📡 触发 requestFeedPublic(orderId=${orderId}, feedType=0, tier=0)...`);
            const tx = await feedProtocol.requestFeedPublic(orderId, 0, 0, { gasPrice } as any);
            const receipt = await tx.wait();
            console.log(`  ✅ 成功! TX: ${receipt?.hash}`);

            // 验证状态
            const order = await optionsCore.getOrder(orderId);
            const newStatus = STATUS_MAP[Number(order.status)] ?? `UNKNOWN(${order.status})`;
            console.log(`  📊 订单新状态: ${newStatus}`);
            console.log(`  💡 FeedEngine 现在应该能看到此订单（通过 FeedRequested 事件）\n`);

        } catch (e: any) {
            console.error(`  ❌ orderId=${orderId} requestFeedPublic 失败: ${e.reason || e.message?.slice(0, 200)}`);
        }
    }

    console.log("\n=== 完成 ===");
    console.log("请检查 FeedEngine 后端日志，应看到 [NST FeedProtocol] FeedRequested 记录");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
