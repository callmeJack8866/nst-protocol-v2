import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com");
    const abi = [
        "function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 strikePrice, uint256 expiryTimestamp, uint256 premiumRate, uint256 premiumAmount, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint8 exerciseDelay, uint8 sellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment, uint8 feedRule, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 lastFeedPrice, uint256 dividendAmount))"
    ];
    const c = new ethers.Contract("0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a", abi, provider);

    for (const id of [5, 6]) {
        try {
            const o = await c.getOrder(id);
            console.log("Order " + id + ":");
            console.log("  name=" + o.underlyingName);
            console.log("  code=" + o.underlyingCode);
            console.log("  market=" + o.market);
            console.log("  country=" + o.country);
            console.log("  notionalUSDT=" + o.notionalUSDT.toString());
            console.log("  status=" + Number(o.status));
        } catch (e: any) {
            console.error("Error order " + id + ":", e.message);
        }
    }
}

main();
