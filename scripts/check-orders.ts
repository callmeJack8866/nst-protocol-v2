import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com");
    const abi = [
        "function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 strikePrice, uint256 expiryTimestamp, uint256 premiumRate, uint256 premiumAmount, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint8 exerciseDelay, uint8 sellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment, uint8 feedRule, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 lastFeedPrice, uint256 dividendAmount))"
    ];
    const STATUS_MAP: Record<number, string> = {
        0:"RFQ_CREATED",1:"QUOTING",2:"MATCHED",3:"WAITING_INITIAL_FEED",
        4:"LIVE",5:"WAITING_FINAL_FEED",6:"PENDING_SETTLEMENT",7:"SETTLED",8:"CANCELLED",9:"EXPIRED"
    };
    const c = new ethers.Contract("0x78F4600D6963044cCE956DC2322A92cB58142129", abi, provider);

    // 查更大范围 orderId
    for (let id = 7; id <= 20; id++) {
        try {
            const o = await c.getOrder(id);
            if (o.buyer === ethers.ZeroAddress) { console.log(`Order ${id}: 不存在`); break; }
            const status = STATUS_MAP[Number(o.status)] || `UNKNOWN(${o.status})`;
            console.log(`Order ${id}: [${status}]  "${o.underlyingName}" buyer=${o.buyer.slice(0,10)}  seller=${o.seller.slice(0,10)}`);
            console.log(`         notional=${ethers.formatUnits(o.notionalUSDT,18)} USDT  matchedAt=${Number(o.matchedAt)}`);
        } catch(e:any) {
            console.log(`Order ${id}: error - ${e.message?.slice(0,80)}`);
            break;
        }
    }
}
main();
