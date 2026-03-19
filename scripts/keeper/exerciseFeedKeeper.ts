/**
 * Exercise Feed Keeper - 行权后终轮喂价超时的完整兜底处理
 * 
 * ██  两阶段兜底机制  ██
 * 
 * Phase 1 — 检测 WAITING_FINAL_FEED 超时 → 自动代为发起终轮喂价请求
 *   - 监控 WAITING_FINAL_FEED 状态订单
 *   - 检测是否在 closingFeedDeadline (默认10分钟) 内未收到终轮喂价请求
 *   - 超时则通过 FeedProtocol.requestFeedPublic 自动代替买方发起
 * 
 * Phase 2 — 检测喂价请求本身超时 → 自动触发合约取消 + 双方全额退款
 *   - 如果 Phase 1 触发了喂价请求，但喂价员未在截止时间内提交喂价
 *   - 且 expiryTimestamp + closingFeedDeadline 已到
 *   - 则调用 OptionsSettlement.cancelOrderDueFinalFeedTimeout() 取消订单
 *   - 合约逻辑：买方权利金退还 + 卖方保证金全额退还（喂价员过错，不扣买卖双方）
 * 
 * 注意：
 * - 需要 Keeper 钱包有足够 USDT 支付喂价费用（Phase 1）
 * - 需要 Keeper 钱包对 FeedProtocol 有 USDT 授权（Phase 1）
 * - Phase 2 不需要 USDT，仅调用 Settlement 合约
 */

import { getOptionsCore, getOptionsSettlement, log, OrderStatus, safeExecute, FeedProtocolAddress } from './utils';
import { Contract } from 'ethers';

/** 超时阈值：与 Config.closingFeedDeadline 保持一致（默认 10 分钟） */
const CLOSING_FEED_DEADLINE_SECONDS = 10 * 60;

/** Phase 1 额外缓冲时间（给予网络延迟容差） */
const PHASE1_BUFFER_SECONDS = 60;

/** Phase 2 额外缓冲时间（在合约超时基础上加 2 分钟给喂价员最后机会） */
const PHASE2_BUFFER_SECONDS = 2 * 60;

const FEED_PROTOCOL_ABI = [
    'function getFeedRequest(uint256 requestId) view returns (tuple(uint256 requestId, uint256 orderId, uint8 feedType, uint8 tier, uint256 deadline, uint256 createdAt, uint256 totalFeeders, uint256 submittedCount, uint256 finalPrice, bool finalized))',
    'function nextRequestId() view returns (uint256)',
    'function requestFeedPublic(uint256 orderId, uint8 feedType, uint8 tier) external',
    'function getOrderFeedRequests(uint256 orderId) view returns (uint256[])',
];

/** 内存中记录各阶段已处理的订单（避免重复操作） */
const phase1Processed = new Set<number>();
const phase2Processed = new Set<number>();

/**
 * 检查订单是否已有活跃的 Final 类型喂价请求
 * @returns true = 已有终轮喂价请求（未 finalized），无需 Phase 1 干预
 */
async function hasActiveFinalFeedRequest(feedProtocol: Contract, orderId: number): Promise<boolean> {
    try {
        const requestIds: bigint[] = await feedProtocol.getOrderFeedRequests(orderId);
        for (const reqId of requestIds) {
            const req = await feedProtocol.getFeedRequest(reqId);
            // feedType=2 是 Final
            if (Number(req.feedType) === 2 && !req.finalized) {
                return true;
            }
        }
    } catch {
        // getOrderFeedRequests 可能不存在于旧合约，安全忽略
    }
    return false;
}

/**
 * 检查订单是否已有已完成（finalized）的 Final 喂价
 * @returns true = 终轮喂价已完成，不需要任何兜底
 */
async function hasFinalizedFinalFeed(feedProtocol: Contract, orderId: number): Promise<boolean> {
    try {
        const requestIds: bigint[] = await feedProtocol.getOrderFeedRequests(orderId);
        for (const reqId of requestIds) {
            const req = await feedProtocol.getFeedRequest(reqId);
            if (Number(req.feedType) === 2 && req.finalized) {
                return true;
            }
        }
    } catch {
        // 安全忽略
    }
    return false;
}

/**
 * 输出人工处理指引（当自动操作全部失败时的兜底）
 */
function printManualEscalation(moduleName: string, orderId: number, phase: string, reason: string): void {
    log(moduleName, `\n${'='.repeat(70)}`);
    log(moduleName, `🚨 人工处理指引 — Order #${orderId} [${phase}]`);
    log(moduleName, `失败原因: ${reason}`);
    log(moduleName, `\n请管理员按以下步骤手动处理:`);

    if (phase === 'PHASE_1') {
        log(moduleName, `  1. 检查 Keeper 钱包 USDT 余额和对 FeedProtocol 的授权`);
        log(moduleName, `  2. 手动调用 FeedProtocol.requestFeedPublic(${orderId}, 2, 0)`);
        log(moduleName, `     合约地址: ${FeedProtocolAddress}`);
        log(moduleName, `  3. 如果喂价请求仍失败，等待超过 expiryTimestamp + closingFeedDeadline 后执行 Phase 2`);
    } else if (phase === 'PHASE_2') {
        log(moduleName, `  1. 确认当前 block.timestamp > order.expiryTimestamp + config.closingFeedDeadline()`);
        log(moduleName, `  2. 手动调用 OptionsSettlement.cancelOrderDueFinalFeedTimeout(${orderId})`);
        log(moduleName, `     合约地址: 参见 utils.ts 中 OptionsSettlementAddress`);
        log(moduleName, `  3. 验证订单状态已变更为 CANCELLED (8)`);
        log(moduleName, `  4. 确认买方权利金已退还、卖方保证金已全额退还`);
    }

    log(moduleName, `${'='.repeat(70)}\n`);
}

export async function runExerciseFeedKeeper(): Promise<void> {
    const moduleName = 'EXERCISE_FEED_KEEPER';
    log(moduleName, '🔍 Starting two-phase exercise feed timeout scan...');

    try {
        const optionsCore = getOptionsCore();
        const optionsSettlement = getOptionsSettlement();
        const feedProtocol = new Contract(FeedProtocolAddress, FEED_PROTOCOL_ABI, optionsCore.runner);

        const nextOrderId = await optionsCore.nextOrderId();
        const totalOrders = Number(nextOrderId);
        const now = Math.floor(Date.now() / 1000);

        log(moduleName, `Scanning ${totalOrders - 1} orders... (timestamp: ${now})`);

        let phase1Count = 0;
        let phase2Count = 0;

        for (let orderId = 1; orderId < totalOrders; orderId++) {
            try {
                const order = await optionsCore.getOrder(orderId);
                const status = Number(order.status);

                // ============================================================
                // Phase 1: WAITING_FINAL_FEED 且未发起喂价请求 → 代发喂价请求
                // ============================================================
                if (status === OrderStatus.WAITING_FINAL_FEED && !phase1Processed.has(orderId)) {
                    // 使用 settledAt 作为行权发起时间
                    const exerciseInitiatedAt = Number(order.settledAt) > 0
                        ? Number(order.settledAt)
                        : Number(order.matchedAt); // 保守回退

                    const timeoutAt = exerciseInitiatedAt + CLOSING_FEED_DEADLINE_SECONDS + PHASE1_BUFFER_SECONDS;

                    if (now > timeoutAt) {
                        phase1Processed.add(orderId);

                        // 检查是否已有活跃的 Final 喂价请求
                        const hasRequest = await hasActiveFinalFeedRequest(feedProtocol, orderId);
                        if (hasRequest) {
                            log(moduleName, `  [P1] Order #${orderId}: 已有活跃终轮喂价请求 — 跳过，等待喂价员提交`);
                            continue;
                        }

                        // 自动代为发起终轮喂价请求
                        log(moduleName, `⚠️ [P1] Order #${orderId} EXERCISE FEED TIMEOUT`, {
                            exerciseInitiated: new Date(exerciseInitiatedAt * 1000).toISOString(),
                            timeoutAt: new Date(timeoutAt * 1000).toISOString(),
                            seller: order.seller,
                            buyer: order.buyer,
                        });

                        const success = await safeExecute(
                            moduleName,
                            orderId,
                            'Phase1: requestFeedPublic (Final)',
                            feedProtocol.requestFeedPublic(orderId, 2, 0) // feedType=2=Final, tier=0
                        );

                        if (success) {
                            phase1Count++;
                            log(moduleName, `  ✅ [P1] Order #${orderId}: 终轮喂价请求已自动创建，等待喂价员提交`);
                        } else {
                            // Phase 1 失败：输出人工指引
                            printManualEscalation(moduleName, orderId, 'PHASE_1',
                                'Keeper 自动发起终轮喂价请求失败（可能 USDT 余额不足或授权不够）');
                        }
                    }
                }

                // ============================================================
                // Phase 2: 终轮喂价请求超时 → 调用 Settlement 取消订单 + 退款
                // ============================================================
                // 条件：订单仍在 WAITING_FINAL_FEED / LIVE 状态
                //       且已超过 expiryTimestamp + closingFeedDeadline
                if (
                    (status === OrderStatus.WAITING_FINAL_FEED || status === OrderStatus.LIVE) &&
                    !phase2Processed.has(orderId)
                ) {
                    const expiryTimestamp = Number(order.expiryTimestamp);
                    if (expiryTimestamp === 0) continue;

                    const finalDeadline = expiryTimestamp + CLOSING_FEED_DEADLINE_SECONDS + PHASE2_BUFFER_SECONDS;

                    if (now > finalDeadline) {
                        phase2Processed.add(orderId);

                        // 再次确认没有已完成的终轮喂价
                        const hasFinalized = await hasFinalizedFinalFeed(feedProtocol, orderId);
                        if (hasFinalized) {
                            log(moduleName, `  [P2] Order #${orderId}: 终轮喂价已完成 — 跳过取消`);
                            continue;
                        }

                        log(moduleName, `🚨 [P2] Order #${orderId} FINAL FEED DEADLINE EXCEEDED — triggering cancelOrderDueFinalFeedTimeout`, {
                            expiryTimestamp: new Date(expiryTimestamp * 1000).toISOString(),
                            finalDeadline: new Date(finalDeadline * 1000).toISOString(),
                            seller: order.seller,
                            buyer: order.buyer,
                        });

                        const success = await safeExecute(
                            moduleName,
                            orderId,
                            'Phase2: cancelOrderDueFinalFeedTimeout',
                            optionsSettlement.cancelOrderDueFinalFeedTimeout(orderId)
                        );

                        if (success) {
                            phase2Count++;
                            log(moduleName, `  ✅ [P2] Order #${orderId}: 订单已取消，买方权利金退还 + 卖方保证金全额退还`);
                        } else {
                            // Phase 2 失败：输出人工指引
                            printManualEscalation(moduleName, orderId, 'PHASE_2',
                                'Keeper 自动取消订单失败（可能合约条件不满足或 gas 不足）');
                        }
                    }
                }

            } catch (err: any) {
                log(moduleName, `  ⚠ Order #${orderId} scan error: ${err.message?.slice(0, 100)}`);
                continue;
            }
        }

        log(moduleName, `✅ Scan complete. Phase1: ${phase1Count} feed request(s) triggered. Phase2: ${phase2Count} order(s) cancelled.`);
    } catch (error) {
        log(moduleName, '❌ Scan failed — cannot connect to contracts', { error: (error as Error).message });
        log(moduleName, '请检查: (1) RPC 连接是否正常 (2) KEEPER_PRIVATE_KEY 是否设置 (3) 合约地址是否正确');
    }
}
