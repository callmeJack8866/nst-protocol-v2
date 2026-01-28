/**
 * Settle Keeper - 仲裁窗口自动结算
 * 扫描 PENDING_SETTLEMENT 状态订单，超过仲裁窗口后自动结算
 */

import { getOptionsCore, log, safeExecute, OrderStatus } from './utils';

export async function runSettleKeeper(): Promise<void> {
    const moduleName = 'SETTLE_KEEPER';
    log(moduleName, 'Starting settlement window scan...');

    try {
        const optionsCore = getOptionsCore();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} orders...`);

        const now = Math.floor(Date.now() / 1000);
        let settledCount = 0;

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 仅处理 PENDING_SETTLEMENT 状态
                if (status !== OrderStatus.PENDING_SETTLEMENT) {
                    continue;
                }

                const settledAt = Number(order.settledAt); // 进入待结算的时间戳
                const arbitrationWindow = Number(order.arbitrationWindow); // 仲裁窗口秒数

                // 如果 settledAt 为 0，使用 matchedAt 作为备选
                const settlementStartTime = settledAt > 0 ? settledAt : Number(order.matchedAt);
                const windowEnd = settlementStartTime + arbitrationWindow;

                if (now > windowEnd) {
                    log(moduleName, `Order #${orderId} arbitration window expired`, {
                        windowStart: new Date(settlementStartTime * 1000).toISOString(),
                        windowDuration: `${arbitrationWindow / 3600} hours`,
                    });

                    const success = await safeExecute(
                        moduleName,
                        orderId,
                        'settle',
                        optionsCore.settle(orderId)
                    );

                    if (success) {
                        settledCount++;
                    }
                }
            } catch (err) {
                continue;
            }
        }

        log(moduleName, `Scan complete. Auto-settled ${settledCount} orders.`);
    } catch (error) {
        log(moduleName, 'Scan failed', { error: (error as Error).message });
    }
}
