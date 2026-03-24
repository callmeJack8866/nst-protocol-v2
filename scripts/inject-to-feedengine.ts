import { ethers } from "ethers";
import fetch from "node-fetch";

const OPTIONS_CORE_ADDR = "0x78F4600D6963044cCE956DC2322A92cB58142129";
const FEED_PROTOCOL_ADDR = "0x45E4ee36e6fA443a7318cd549c6AC20d83b6C1A7";
const FEED_ENGINE_API = "http://localhost:3001/api/nst/request-feed";
const DEV_API_KEY = "dev-key-nst-2026";

// ✅ 正确的 ABI — 包含 maxPremiumRate 字段（Order struct 第18个字段）
const OPTIONS_CORE_ABI = [
    "function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 strikePrice, uint256 expiryTimestamp, uint256 premiumRate, uint256 premiumAmount, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint256 maxPremiumRate, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint8 exerciseDelay, uint8 sellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment, uint8 feedRule, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 finalFeedRequestedAt, uint256 lastFeedPrice, uint256 dividendAmount))"
];

const FEED_PROTOCOL_ABI = [
    "function nextRequestId() view returns (uint256)",
    "function feedRequests(uint256) view returns (uint256 requestId, uint256 orderId, uint8 feedType, uint8 tier, uint256 deadline, uint256 createdAt, uint256 totalFeeders, uint256 submittedCount, uint256 finalPrice, bool finalized)",
];

const STATUS_MAP: Record<number, string> = {
    0:"RFQ_CREATED",1:"QUOTING",2:"MATCHED",3:"WAITING_INITIAL_FEED",
    4:"LIVE",5:"WAITING_FINAL_FEED",6:"PENDING_SETTLEMENT",7:"ARBITRATION",
    8:"SETTLED",9:"LIQUIDATED",10:"CANCELLED"
};
const FEED_TYPE_MAP: Record<number, string> = {
    0:"INITIAL",1:"DYNAMIC",2:"FINAL",3:"ARBITRATION"
};

async function main() {
    const provider = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com");
    const optionsCore = new ethers.Contract(OPTIONS_CORE_ADDR, OPTIONS_CORE_ABI, provider);
    const feedProtocol = new ethers.Contract(FEED_PROTOCOL_ADDR, FEED_PROTOCOL_ABI, provider);

    // 1. 扫描所有 feedRequests
    const nextId = Number(await feedProtocol.nextRequestId());
    console.log(`\n=== FeedProtocol feedRequests (1 ~ ${nextId-1}) 扫描 ===\n`);

    let injected = 0;
    const processedOrderIds = new Set<number>();

    for (let reqId = 1; reqId < nextId; reqId++) {
        const req = await feedProtocol.feedRequests(reqId);
        const orderId = Number(req.orderId);
        const feedType = FEED_TYPE_MAP[Number(req.feedType)] || "INITIAL";
        const finalized = req.finalized;

        if (finalized) { console.log(`req#${reqId}: orderId=${orderId} [FINALIZED]`); continue; }
        if (processedOrderIds.has(orderId)) { console.log(`req#${reqId}: orderId=${orderId} 重复跳过`); continue; }
        processedOrderIds.add(orderId);

        const o = await optionsCore.getOrder(orderId);
        const status = NUMBER_STATUS(o.status);
        const symbol = o.underlyingName || o.underlyingCode || "UNKNOWN";
        const market = o.market || "UNKNOWN";
        const country = o.country || "CN";
        const notional = parseFloat(ethers.formatUnits(o.notionalUSDT, 18));

        console.log(`req#${reqId}: orderId=${orderId} [${status}] "${symbol}" ${market} $${notional}`);

        // 注入状态 >= WAITING_INITIAL_FEED(3) 的订单
        if (Number(o.status) >= 3 && Number(o.status) < 8) {
            console.log(`  → 注入 FeedEngine...`);
            try {
                const resp = await fetch(FEED_ENGINE_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-api-key": DEV_API_KEY },
                    body: JSON.stringify({
                        symbol, market, country, exchange: market,
                        feedType, notionalAmount: notional,
                        externalOrderId: orderId.toString(),
                        externalRequestId: reqId.toString(),
                    }),
                });
                const data = await resp.json() as any;
                if (data.success) { console.log(`  ✅ 成功: FeedEngine ID ${data.order?.id}`); injected++; }
                else { console.log(`  ⚠️  失败: ${JSON.stringify(data)}`); }
            } catch(e:any) { console.log(`  ❌ API 错误: ${e.message}`); }
        }
    }

    // 2. 也直接扫描 OptionsCore orderId 1-15，找 WAITING_INITIAL_FEED
    console.log(`\n=== OptionsCore 订单直接扫描 ===\n`);
    for (let id = 1; id <= 30; id++) {
        try {
            const o = await optionsCore.getOrder(id);
            if (o.buyer === ethers.ZeroAddress) { console.log(`orderId ${id}: 不存在（结束）`); break; }
            const statusNum = Number(o.status);
            const status = STATUS_MAP[statusNum] || `UNK(${statusNum})`;
            const symbol = o.underlyingName || "?";
            console.log(`orderId ${id}: [${status}] "${symbol}"`);
        } catch(e:any) { console.log(`orderId ${id}: error - ${e.message?.slice(0,60)}`); break; }
    }

    console.log(`\n=== 完成，共注入 ${injected} 个订单 ===`);
}

function NUMBER_STATUS(v: any): string {
    const n = Number(v);
    return STATUS_MAP[n] || `UNK(${n})`;
}

main().catch(console.error);
