/**
 * Exercise Feed Keeper - 平仓喂价超时惩罚
 * 
 * 监控 WAITING_FINAL_FEED 状态订单：
 * - 检测买方发起行权后卖方是否在 10 分钟内发起平仓喂价
 * - 超时则记录警告（合约层需支持代扣喂价费）
 * - 授权买方可发起仲裁喂价
 * 
 * 注意：完整的扣费逻辑需要合约层支持，此处 Keeper 仅负责监控和触发
 */

import { getOptionsCore, log, OrderStatus, getProvider } from './utils';
import { Contract } from 'ethers';

const EXERCISE_FEED_TIMEOUT_SECONDS = 10 * 60; // 10 分钟

// FeedProtocol 合约地址和 ABI
const FEED_PROTOCOL_ADDRESS = '0x73c55A0EE01B227FeB172d53CEDD90cF27A46D2A';
const FEED_PROTOCOL_ABI = [
    'function getFeedRequest(uint256 requestId) view returns (tuple(uint256 requestId, uint256 orderId, uint8 feedType, uint8 tier, uint256 deadline, uint256 createdAt, uint256 totalFeeders, uint256 submittedCount, uint256 finalPrice, bool finalized))',
    'function nextRequestId() view returns (uint256)',
    'function requestFeedPublic(uint256 orderId, uint8 feedType, uint8 tier) external',
];

interface ExerciseTimeoutOrder {
    orderId: number;
    exerciseInitiatedAt: number; // 进入 WAITING_FINAL_FEED 的时间
    timeoutAt: number;
    buyerAddress: string;
    sellerAddress: string;
}

// 内存中记录已发现的超时订单（避免重复告警）
const processedTimeouts = new Set<number>();

export async function runExerciseFeedKeeper(): Promise<void> {
    const moduleName = 'EXERCISE_FEED_KEEPER';
    log(moduleName, 'Starting exercise feed timeout scan...');

    try {
        const optionsCore = getOptionsCore();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} orders for exercise feed timeout...`);

        const now = Math.floor(Date.now() / 1000);
        const timeoutOrders: ExerciseTimeoutOrder[] = [];

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 仅处理 WAITING_FINAL_FEED 状态（待期末喂价）
                if (status !== OrderStatus.WAITING_FINAL_FEED) {
                    continue;
                }

                // 跳过已处理的订单
                if (processedTimeouts.has(orderId)) {
                    continue;
                }

                // 使用 settledAt 或回退到 matchedAt 作为行权发起时间
                // 注意：实际实现中应有专门的 exerciseInitiatedAt 字段
                const exerciseInitiatedAt = Number(order.settledAt) > 0
                    ? Number(order.settledAt)
                    : Number(order.matchedAt);

                const timeoutAt = exerciseInitiatedAt + EXERCISE_FEED_TIMEOUT_SECONDS;

                if (now > timeoutAt) {
                    timeoutOrders.push({
                        orderId,
                        exerciseInitiatedAt,
                        timeoutAt,
                        buyerAddress: order.buyer,
                        sellerAddress: order.seller,
                    });
                }
            } catch (err) {
                continue;
            }
        }

        // 处理超时订单
        for (const timeoutOrder of timeoutOrders) {
            log(moduleName, `⚠️ Order #${timeoutOrder.orderId} EXERCISE FEED TIMEOUT DETECTED`, {
                exerciseInitiated: new Date(timeoutOrder.exerciseInitiatedAt * 1000).toISOString(),
                timeoutAt: new Date(timeoutOrder.timeoutAt * 1000).toISOString(),
                seller: timeoutOrder.sellerAddress,
                buyer: timeoutOrder.buyerAddress,
            });

            // 标记为已处理
            processedTimeouts.add(timeoutOrder.orderId);

            // TODO: 合约层需要以下功能支持：
            // 1. 从卖方保证金中扣除喂价费用
            // 2. 标记订单为"买方可仲裁喂价"状态
            // 
            // 当前 Keeper 仅记录告警，实际惩罚需通过以下方式实现：
            // - 方案 A: 合约增加 `penalizeSellerFeedTimeout(orderId)` 函数
            // - 方案 B: 买方前端检测超时后直接发起仲裁喂价

            log(moduleName, `📢 Buyer ${timeoutOrder.buyerAddress} is now authorized to initiate arbitration feed for order #${timeoutOrder.orderId}`);
        }

        log(moduleName, `Scan complete. Found ${timeoutOrders.length} exercise feed timeout(s).`);
    } catch (error) {
        log(moduleName, 'Scan failed', { error: (error as Error).message });
    }
}
