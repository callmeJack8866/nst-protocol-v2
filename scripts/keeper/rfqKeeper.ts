/**
 * RFQ Keeper - 自动取消超时 RFQ
 * 扫描 RFQ_CREATED 状态订单，超过 2 小时未成交则自动取消
 */

import { getOptionsCore, log, safeExecute, OrderStatus } from './utils';

const RFQ_TIMEOUT_SECONDS = 2 * 60 * 60; // 2 小时

export async function runRfqKeeper(): Promise<void> {
    const moduleName = 'RFQ_KEEPER';
    log(moduleName, 'Starting RFQ timeout scan...');

    try {
        const optionsCore = getOptionsCore();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} orders...`);

        const now = Math.floor(Date.now() / 1000);
        let expiredCount = 0;

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 仅处理 RFQ_CREATED 状态
                if (status !== OrderStatus.RFQ_CREATED) {
                    continue;
                }

                const createdAt = Number(order.createdAt);
                const expiryTime = createdAt + RFQ_TIMEOUT_SECONDS;

                if (now > expiryTime) {
                    log(moduleName, `Order #${orderId} has expired (created: ${new Date(createdAt * 1000).toISOString()})`);

                    const success = await safeExecute(
                        moduleName,
                        orderId,
                        'cancelRFQ',
                        optionsCore.cancelRFQ(orderId)
                    );

                    if (success) {
                        expiredCount++;
                    }
                }
            } catch (err) {
                // 跳过无效订单
                continue;
            }
        }

        log(moduleName, `Scan complete. Cancelled ${expiredCount} expired RFQs.`);
    } catch (error) {
        log(moduleName, 'Scan failed', { error: (error as Error).message });
    }
}
