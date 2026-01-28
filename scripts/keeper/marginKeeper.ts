/**
 * Margin Keeper - 追保超时强平
 * 扫描 LIVE 状态订单，检查 marginCallDeadline 是否已过期
 */

import { getOptionsCore, log, safeExecute, OrderStatus } from './utils';

export async function runMarginKeeper(): Promise<void> {
    const moduleName = 'MARGIN_KEEPER';
    log(moduleName, 'Starting margin call timeout scan...');

    try {
        const optionsCore = getOptionsCore();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} orders...`);

        const now = Math.floor(Date.now() / 1000);
        let liquidatedCount = 0;

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 仅处理 LIVE 状态
                if (status !== OrderStatus.LIVE) {
                    continue;
                }

                const marginCallDeadline = Number(order.marginCallDeadline);
                const currentMargin = order.currentMargin;
                const initialMargin = order.initialMargin;
                const minMarginRate = Number(order.minMarginRate);

                // 检查是否触发追保 (当前保证金 < 初始保证金 * minMarginRate / 10000)
                const minRequiredMargin = (initialMargin * BigInt(minMarginRate)) / 10000n;
                const isUnderMargin = currentMargin < minRequiredMargin;

                // 检查追保期限是否已过
                const isDeadlinePassed = marginCallDeadline > 0 && now > marginCallDeadline;

                if (isUnderMargin && isDeadlinePassed) {
                    log(moduleName, `Order #${orderId} margin call expired`, {
                        currentMargin: currentMargin.toString(),
                        minRequired: minRequiredMargin.toString(),
                        deadline: new Date(marginCallDeadline * 1000).toISOString(),
                    });

                    const success = await safeExecute(
                        moduleName,
                        orderId,
                        'forceLiquidate',
                        optionsCore.forceLiquidate(orderId)
                    );

                    if (success) {
                        liquidatedCount++;
                    }
                }
            } catch (err) {
                continue;
            }
        }

        log(moduleName, `Scan complete. Force liquidated ${liquidatedCount} orders.`);
    } catch (error) {
        log(moduleName, 'Scan failed', { error: (error as Error).message });
    }
}
