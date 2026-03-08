/**
 * Margin Keeper - 追保触发与超时强平 (P0 追保机制)
 * 
 * 功能：
 * 1. 扫描 LIVE 状态订单，检测保证金不足触发追保
 * 2. 检测追保超时订单，执行强制清算
 * 
 * 规则 (§9.3):
 * - 保证金不足时设置追保截止时间
 * - 加密货币/外汇: 2小时内补足
 * - 其他标的: 12小时内补足
 * - 超时未补足 → 强平，买方获得保证金
 */

import { getOptionsCore, getOptionsSettlement, log, safeExecute, OrderStatus } from './utils';

// 加密货币/外汇市场代码（用于判断追保时限）
const CRYPTO_FOREX_MARKETS = ['CRYPTO', 'FOREX', 'BINANCE', 'COINBASE', 'FX'];

interface MarginCallCandidate {
    orderId: number;
    currentMargin: bigint;
    minRequired: bigint;
    marginDeficit: bigint;
    marginCallDeadline: number;
    market: string;
}

export async function runMarginKeeper(): Promise<void> {
    const moduleName = 'MARGIN_KEEPER';
    log(moduleName, '🔍 Starting margin monitoring scan...');

    try {
        const optionsCore = getOptionsCore();
        const optionsSettlement = getOptionsSettlement();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} LIVE orders...`);

        const now = Math.floor(Date.now() / 1000);
        const triggerCandidates: MarginCallCandidate[] = [];
        const liquidateCandidates: MarginCallCandidate[] = [];

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 仅处理 LIVE 状态
                if (status !== OrderStatus.LIVE) {
                    continue;
                }

                const currentMargin = order.currentMargin;
                const initialMargin = order.initialMargin;
                const minMarginRate = Number(order.minMarginRate);
                const marginCallDeadline = Number(order.marginCallDeadline);
                const market = order.market || '';

                // 计算最低保证金要求
                const minRequired = (initialMargin * BigInt(minMarginRate)) / 10000n;
                const isUnderMargin = currentMargin < minRequired;

                if (!isUnderMargin) {
                    continue; // 保证金充足，跳过
                }

                const candidate: MarginCallCandidate = {
                    orderId,
                    currentMargin,
                    minRequired,
                    marginDeficit: minRequired - currentMargin,
                    marginCallDeadline,
                    market,
                };

                if (marginCallDeadline === 0) {
                    // 未触发追保，需要触发
                    triggerCandidates.push(candidate);
                } else if (now > marginCallDeadline) {
                    // 追保已超时，需要强平
                    liquidateCandidates.push(candidate);
                }
            } catch (err) {
                continue;
            }
        }

        // === 阶段1: 触发追保 ===
        if (triggerCandidates.length > 0) {
            log(moduleName, `⚠️ Found ${triggerCandidates.length} orders requiring margin call trigger`);

            for (const candidate of triggerCandidates) {
                const isCrypto = CRYPTO_FOREX_MARKETS.some(m =>
                    candidate.market.toUpperCase().includes(m)
                );

                log(moduleName, `📢 Triggering margin call for Order #${candidate.orderId}`, {
                    currentMargin: candidate.currentMargin.toString(),
                    minRequired: candidate.minRequired.toString(),
                    deficit: candidate.marginDeficit.toString(),
                    isCrypto,
                    deadline: isCrypto ? '2 hours' : '12 hours',
                });

                await safeExecute(
                    moduleName,
                    candidate.orderId,
                    'triggerMarginCall',
                    optionsSettlement.triggerMarginCall(candidate.orderId, isCrypto)
                );
            }
        }

        // === 阶段2: 执行强平 ===
        if (liquidateCandidates.length > 0) {
            log(moduleName, `🚨 Found ${liquidateCandidates.length} orders exceeding margin call deadline`);

            let liquidatedCount = 0;
            for (const candidate of liquidateCandidates) {
                log(moduleName, `💥 Force liquidating Order #${candidate.orderId}`, {
                    currentMargin: candidate.currentMargin.toString(),
                    deadline: new Date(candidate.marginCallDeadline * 1000).toISOString(),
                });

                const success = await safeExecute(
                    moduleName,
                    candidate.orderId,
                    'forceLiquidateMarginCall',
                    optionsSettlement.forceLiquidateMarginCall(candidate.orderId)
                );

                if (success) {
                    liquidatedCount++;
                }
            }

            log(moduleName, `📊 Force liquidated ${liquidatedCount}/${liquidateCandidates.length} orders`);
        }

        if (triggerCandidates.length === 0 && liquidateCandidates.length === 0) {
            log(moduleName, '✅ All margins are sufficient. No action required.');
        }

        log(moduleName, 'Scan complete.');
    } catch (error) {
        log(moduleName, '❌ Scan failed', { error: (error as Error).message });
    }
}
