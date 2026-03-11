/**
 * feedResultProcessor.ts
 * 
 * 喂价结果处理器 Keeper
 * 监听 FeedProtocol.FeedFinalized 事件，并调用 OptionsCore.processInitialFeedResult / processFinalFeedResult
 * 将已完成喂价的订单状态从 MATCHED → LIVE 或 LIVE → PENDING_SETTLEMENT
 */

import { ethers, Log } from 'ethers';
import { getProvider, getAdminWallet, sleep, getContracts, FeedProtocolAddress, OptionsCoreAddress, USDT_ADDRESS } from './utils';

// 最小 ABI
const FEED_PROTOCOL_ABI = [
    "event FeedFinalized(uint256 indexed requestId, uint256 finalPrice, uint256 timestamp)",
    "function feedRequests(uint256 requestId) view returns (uint256 requestId, uint256 orderId, uint8 feedType, uint8 tier, uint256 deadline, uint256 createdAt, uint256 totalFeeders, uint256 submittedCount, uint256 finalPrice, bool finalized)"
];

const OPTIONS_CORE_ABI = [
    "function processInitialFeedResult(uint256 orderId, uint256 initialPrice) external",
    "function processFinalFeedResult(uint256 orderId, uint256 finalPrice) external",
    "function processFeedCallback(uint256 orderId, uint8 feedType, uint256 feedPrice) external",
    "function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 strikePrice, uint256 expiryTimestamp, uint256 premiumRate, uint256 premiumAmount, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint256 maxPremiumRate, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint8 exerciseDelay, uint8 sellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment, uint8 feedRule, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 lastFeedPrice, uint256 dividendAmount))"
];

// FeedType 枚举 (from NSTTypes.sol)
const FEED_TYPE = {
    Initial: 0,
    Dynamic: 1,
    Final: 2,
    Arbitration: 3
};

// OrderStatus 枚举
const ORDER_STATUS = {
    MATCHED: 2,
    WAITING_INITIAL_FEED: 3,
    LIVE: 4,
    WAITING_FINAL_FEED: 5,
    PENDING_SETTLEMENT: 6
};

const POLL_INTERVAL_MS = 10_000; // 10秒轮询一次

async function processHistoricalEvents() {
    const provider = getProvider();
    const wallet = getAdminWallet();

    const feedProtocol = new ethers.Contract(FeedProtocolAddress, FEED_PROTOCOL_ABI, provider);
    const optionsCore = new ethers.Contract(OptionsCoreAddress, OPTIONS_CORE_ABI, wallet);

    // 获取最近 1000 个区块的事件
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);

    console.log(`[FeedResultProcessor] Scanning events from block ${fromBlock} to ${currentBlock}...`);

    const filter = feedProtocol.filters.FeedFinalized();
    const events = await feedProtocol.queryFilter(filter, fromBlock, currentBlock);

    console.log(`[FeedResultProcessor] Found ${events.length} FeedFinalized events`);

    for (const event of events) {
        try {
            const log = event as ethers.EventLog;
            const requestId = log.args[0];
            const finalPrice = log.args[1];

            await processEvent(feedProtocol, optionsCore, requestId, finalPrice);
        } catch (err) {
            console.error(`[FeedResultProcessor] Error processing event:`, err);
        }
    }
}

async function processEvent(
    feedProtocol: ethers.Contract,
    optionsCore: ethers.Contract,
    requestId: bigint,
    finalPrice: bigint
) {
    console.log(`[FeedResultProcessor] Processing request ${requestId} with price ${finalPrice}`);

    // 获取 FeedRequest 详情
    const feedRequest = await feedProtocol.feedRequests(requestId);
    const orderId = feedRequest[1]; // orderId is at index 1
    const feedType = Number(feedRequest[2]); // feedType is at index 2

    console.log(`[FeedResultProcessor] Order ${orderId}, FeedType: ${feedType}`);

    // 使用 getOrder 获取完整订单信息
    const order = await optionsCore.getOrder(orderId);
    const currentStatus = Number(order.status);

    console.log(`[FeedResultProcessor] Order ${orderId} current status: ${currentStatus}`);

    try {
        if (feedType === FEED_TYPE.Initial && (currentStatus === ORDER_STATUS.MATCHED || currentStatus === ORDER_STATUS.WAITING_INITIAL_FEED)) {
            console.log(`[FeedResultProcessor] Processing INITIAL feed for order ${orderId}...`);
            const tx = await optionsCore.processInitialFeedResult(orderId, finalPrice);
            await tx.wait();
            console.log(`[FeedResultProcessor] ✅ Order ${orderId} updated to LIVE. TX: ${tx.hash}`);
        } else if (feedType === FEED_TYPE.Final && (currentStatus === ORDER_STATUS.LIVE || currentStatus === ORDER_STATUS.WAITING_FINAL_FEED)) {
            console.log(`[FeedResultProcessor] Processing FINAL feed for order ${orderId}...`);
            const tx = await optionsCore.processFinalFeedResult(orderId, finalPrice);
            await tx.wait();
            console.log(`[FeedResultProcessor] ✅ Order ${orderId} updated to PENDING_SETTLEMENT. TX: ${tx.hash}`);
        } else if (currentStatus === ORDER_STATUS.LIVE || currentStatus === ORDER_STATUS.PENDING_SETTLEMENT || currentStatus === ORDER_STATUS.SETTLED) {
            // 订单已经处理过，可能是合约 _finalizeFeed 自动回调已完成
            console.log(`[FeedResultProcessor] Order ${orderId} already in status ${currentStatus}, skipping (likely already processed by contract callback).`);
        } else {
            console.log(`[FeedResultProcessor] Skipping: FeedType=${feedType}, Status=${currentStatus}`);
        }
    } catch (err: any) {
        if (err.message?.includes('order not matched') || err.message?.includes('order not in valid state') || err.message?.includes('already processed')) {
            console.log(`[FeedResultProcessor] Order ${orderId} already processed, skipping.`);
        } else {
            throw err;
        }
    }
}

// 使用轮询模式替代事件监听器（BSC RPC 不支持长时间过滤器）
async function pollForNewEvents() {
    const provider = getProvider();
    const wallet = getAdminWallet();

    const feedProtocol = new ethers.Contract(FeedProtocolAddress, FEED_PROTOCOL_ABI, provider);
    const optionsCore = new ethers.Contract(OptionsCoreAddress, OPTIONS_CORE_ABI, wallet);

    let lastProcessedBlock = await provider.getBlockNumber();
    console.log(`[FeedResultProcessor] Starting polling from block ${lastProcessedBlock}...`);

    while (true) {
        try {
            const currentBlock = await provider.getBlockNumber();

            if (currentBlock > lastProcessedBlock) {
                const filter = feedProtocol.filters.FeedFinalized();
                const events = await feedProtocol.queryFilter(filter, lastProcessedBlock + 1, currentBlock);

                if (events.length > 0) {
                    console.log(`[FeedResultProcessor] Found ${events.length} new FeedFinalized events`);

                    for (const event of events) {
                        try {
                            const log = event as ethers.EventLog;
                            const requestId = log.args[0];
                            const finalPrice = log.args[1];
                            await processEvent(feedProtocol, optionsCore, requestId, finalPrice);
                        } catch (err) {
                            console.error(`[FeedResultProcessor] Error processing event:`, err);
                        }
                    }
                }

                lastProcessedBlock = currentBlock;
            }
        } catch (err: any) {
            console.error(`[FeedResultProcessor] Polling error:`, err.message?.slice(0, 200));
        }

        await sleep(POLL_INTERVAL_MS);
    }
}

export async function runFeedResultProcessor() {
    console.log('[FeedResultProcessor] Starting...');
    console.log(`[FeedResultProcessor] FeedProtocol: ${FeedProtocolAddress}`);
    console.log(`[FeedResultProcessor] OptionsCore: ${OptionsCoreAddress}`);

    // 先处理历史事件
    await processHistoricalEvents();

    // 启动轮询模式（替代事件监听，兼容 BSC RPC）
    await pollForNewEvents();
}

// 如果直接运行此脚本
if (require.main === module) {
    runFeedResultProcessor()
        .then(() => console.log('[FeedResultProcessor] Completed'))
        .catch(console.error);
}
