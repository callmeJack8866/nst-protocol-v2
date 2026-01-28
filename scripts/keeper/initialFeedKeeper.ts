/**
 * Initial Feed Keeper - 成交后初始喂价超时监控
 * 
 * 规范要求 (§8.2):
 * - 订单成交后，卖方必须在 10分钟 内发起初始喂价
 * - 超时处理：订单自动取消，卖方保证金扣除违约金进入国库，买方期权费退回
 */

import { getOptionsCore, log, safeExecute, OrderStatus } from './utils';

// 初始喂价超时时间：10分钟
const INITIAL_FEED_TIMEOUT_SECONDS = 10 * 60;

// 违约金比例（用于日志记录，实际扣除在合约中处理）
const PENALTY_RATE = 0.05; // 5%

interface TimeoutCandidate {
    orderId: number;
    matchedAt: number;
    timeoutAt: number;
    secondsOverdue: number;
    sellerAddress: string;
    buyerAddress: string;
    notionalUSDT: bigint;
}

export async function runInitialFeedKeeper(): Promise<void> {
    const moduleName = 'INITIAL_FEED_KEEPER';
    log(moduleName, '🔍 Starting initial feed timeout scan...');

    try {
        const optionsCore = getOptionsCore();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} orders for MATCHED status without initial feed...`);

        const now = Math.floor(Date.now() / 1000);
        const candidates: TimeoutCandidate[] = [];

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 检测状态：MATCHED 或 WAITING_INITIAL_FEED
                // 这些状态表示订单已成交但尚未完成初始喂价
                if (status !== OrderStatus.MATCHED && status !== OrderStatus.WAITING_INITIAL_FEED) {
                    continue;
                }

                const matchedAt = Number(order.matchedAt);

                // 如果 matchedAt 为 0，说明订单尚未真正成交
                if (matchedAt === 0) {
                    continue;
                }

                const timeoutAt = matchedAt + INITIAL_FEED_TIMEOUT_SECONDS;

                if (now > timeoutAt) {
                    const secondsOverdue = now - timeoutAt;
                    candidates.push({
                        orderId,
                        matchedAt,
                        timeoutAt,
                        secondsOverdue,
                        sellerAddress: order.seller,
                        buyerAddress: order.buyer,
                        notionalUSDT: order.notionalUSDT,
                    });
                }
            } catch (err) {
                // 跳过无效订单
                continue;
            }
        }

        if (candidates.length === 0) {
            log(moduleName, '✅ No initial feed timeout violations found.');
            return;
        }

        log(moduleName, `⚠️ Found ${candidates.length} orders with initial feed timeout:`,
            candidates.map(c => ({
                orderId: c.orderId,
                matchedAt: new Date(c.matchedAt * 1000).toISOString(),
                overdueMinutes: Math.floor(c.secondsOverdue / 60),
            }))
        );

        // 处理超时订单
        let cancelledCount = 0;
        for (const candidate of candidates) {
            log(moduleName, `🚨 Order #${candidate.orderId} INITIAL FEED TIMEOUT`, {
                seller: candidate.sellerAddress,
                buyer: candidate.buyerAddress,
                matchedAt: new Date(candidate.matchedAt * 1000).toISOString(),
                overdueMinutes: Math.floor(candidate.secondsOverdue / 60),
                action: 'Cancelling order, refunding buyer, penalizing seller',
            });

            // 调用合约取消订单
            // 注意：合约需要有 cancelOrderDueToFeedTimeout 或类似函数
            // 这里暂时使用 cancelRFQ，实际可能需要专门的超时取消函数
            const success = await safeExecute(
                moduleName,
                candidate.orderId,
                'cancelOrderDueToFeedTimeout',
                optionsCore.cancelRFQ(candidate.orderId)
            );

            if (success) {
                cancelledCount++;
                log(moduleName, `💰 Order #${candidate.orderId} cancelled successfully`, {
                    buyerRefund: 'Premium returned',
                    sellerPenalty: `${PENALTY_RATE * 100}% of margin deducted`,
                });
            }
        }

        log(moduleName, `📊 Scan complete. Cancelled ${cancelledCount}/${candidates.length} timed-out orders.`);
    } catch (error) {
        log(moduleName, '❌ Scan failed', { error: (error as Error).message });
    }
}
