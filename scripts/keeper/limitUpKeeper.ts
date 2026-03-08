/**
 * Limit-Up Keeper - 连板/涨幅强平监控
 * 
 * 分析喂价历史，检测以下强平触发条件：
 * 1. 连续涨停板达到约定天数 (consecutiveDays)
 * 2. 单日涨幅超过约定阈值 (dailyLimitPercent)
 * 
 * 注意：此 Keeper 依赖喂价历史数据。当前实现使用链上最后喂价与开仓价对比。
 * 完整实现需要链下喂价历史数据库或事件日志索引。
 */

import { getOptionsCore, getOptionsSettlement, log, safeExecute, OrderStatus, getProvider } from './utils';
import { formatUnits } from 'ethers';

// 典型涨停板阈值 (10%)
const DEFAULT_LIMIT_UP_PERCENT = 10;

interface LiquidationCandidate {
    orderId: number;
    underlyingName: string;
    openPrice: number;
    lastPrice: number;
    priceChangePercent: number;
    consecutiveDays: number;    // 合约约定的连板天数
    dailyLimitPercent: number;  // 合约约定的单日涨幅阈值
    triggerReason: 'consecutive_limit_up' | 'daily_surge';
}

export async function runLimitUpKeeper(): Promise<void> {
    const moduleName = 'LIMIT_UP_KEEPER';
    log(moduleName, 'Starting limit-up/price surge scan...');

    try {
        const optionsCore = getOptionsCore();
        const optionsSettlement = getOptionsSettlement();
        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);

        log(moduleName, `Scanning ${totalOrders - 1} LIVE orders for price surge conditions...`);

        const candidates: LiquidationCandidate[] = [];

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // 仅处理 LIVE 状态订单
                if (status !== OrderStatus.LIVE) {
                    continue;
                }

                // 从订单中读取强平规则（新增：读取合约存储的参数）
                // liquidationRule: 0 = 无强平, 1 = 连续涨停板, 2 = 连续涨幅
                const liquidationRule = Number(order.liquidationRule);

                // 如果规则是"无强平"，跳过此订单
                if (liquidationRule === 0) {
                    continue;
                }

                // 从订单中读取连续天数和涨幅阈值
                const consecutiveDays = Number(order.consecutiveDays) || 3;
                const dailyLimitPercent = Number(order.dailyLimitPercent) || DEFAULT_LIMIT_UP_PERCENT;

                // 解析价格数据
                const openPrice = parseFloat(order.refPrice);
                const lastFeedPrice = order.lastFeedPrice;

                // 如果没有喂价数据，跳过
                if (lastFeedPrice === 0n || openPrice <= 0) {
                    continue;
                }

                // 计算价格变化 (lastFeedPrice 是 18 位小数)
                const lastPrice = parseFloat(formatUnits(lastFeedPrice, 18));
                const priceChangePercent = ((lastPrice - openPrice) / openPrice) * 100;

                // 检测触发条件
                // 简化版：检测总涨幅是否超过连板天数 * 涨停板阈值
                const cumulativeThreshold = consecutiveDays * dailyLimitPercent;

                if (priceChangePercent >= cumulativeThreshold) {
                    candidates.push({
                        orderId,
                        underlyingName: order.underlyingName,
                        openPrice,
                        lastPrice,
                        priceChangePercent,
                        consecutiveDays,
                        dailyLimitPercent,
                        triggerReason: liquidationRule === 1 ? 'consecutive_limit_up' : 'daily_surge',
                    });
                } else if (priceChangePercent >= dailyLimitPercent) {
                    // 单日涨幅触发 (需要更精确的日内价格对比)
                    // 当前简化为：如果涨幅超过单日阈值，标记为潜在候选
                    log(moduleName, `⚡ Order #${orderId} approaching daily limit threshold`, {
                        underlying: order.underlyingName,
                        priceChange: `${priceChangePercent.toFixed(2)}%`,
                        threshold: `${dailyLimitPercent}%`,
                        rule: liquidationRule === 1 ? 'limit_up' : 'daily_surge',
                    });
                }
            } catch (err) {
                continue;
            }
        }

        // 处理触发强平的订单
        let liquidatedCount = 0;
        for (const candidate of candidates) {
            log(moduleName, `🚨 Order #${candidate.orderId} LIMIT-UP LIQUIDATION TRIGGERED`, {
                underlying: candidate.underlyingName,
                openPrice: candidate.openPrice.toFixed(4),
                lastPrice: candidate.lastPrice.toFixed(4),
                priceChange: `+${candidate.priceChangePercent.toFixed(2)}%`,
                trigger: candidate.triggerReason,
            });

            const success = await safeExecute(
                moduleName,
                candidate.orderId,
                'forceLiquidate',
                optionsSettlement.forceLiquidate(candidate.orderId)
            );

            if (success) {
                liquidatedCount++;
            }
        }

        log(moduleName, `Scan complete. Found ${candidates.length} candidates, liquidated ${liquidatedCount} orders.`);
    } catch (error) {
        log(moduleName, 'Scan failed', { error: (error as Error).message });
    }
}
