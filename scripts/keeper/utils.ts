/**
 * Keeper Service - 公共工具模块
 * 提供合约实例、Provider 和日志功能
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

// 合约地址配置 (BSC Testnet) - 2026-03-06 合约拆分后重新部署
const CONTRACT_ADDRESSES = {
    OptionsCore: '0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a',
    OptionsSettlement: '0x8DF881593368FD8be3F40722fcb9f555593a8257',
    FeedProtocol: '0x45E4ee36e6fA443a7318cd549c6AC20d83b6C1A7',
    Config: '0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea',
    USDT: '0x6ae0833E637D1d99F3FCB6204860386f6a6713C0',
};

// OptionsCore ABI (仅 Keeper 需要的函数 - 创建/查询)
const OPTIONS_CORE_ABI = [
    'function nextOrderId() view returns (uint256)',
    'function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 strikePrice, uint256 expiryTimestamp, uint256 premiumRate, uint256 premiumAmount, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint256 maxPremiumRate, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint8 exerciseDelay, uint8 sellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment, uint8 feedRule, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 finalFeedRequestedAt, uint256 lastFeedPrice, uint256 dividendAmount))',
    'function cancelRFQ(uint256 orderId) external',
];

// OptionsSettlement ABI (结算/清算/追保)
const OPTIONS_SETTLEMENT_ABI = [
    'function settle(uint256 orderId) external',
    'function forceLiquidate(uint256 orderId) external',
    'function forceLiquidateMarginCall(uint256 orderId) external',
    'function cancelOrderDueToFeedTimeout(uint256 orderId) external',
    'function cancelOrderDueFinalFeedTimeout(uint256 orderId) external',
    'function triggerMarginCall(uint256 orderId, bool isCrypto) external',
];

// 订单状态枚举
export enum OrderStatus {
    RFQ_CREATED = 0,
    QUOTING = 1,
    MATCHED = 2,
    WAITING_INITIAL_FEED = 3,
    LIVE = 4,
    WAITING_FINAL_FEED = 5,
    PENDING_SETTLEMENT = 6,
    SETTLED = 7,
    CANCELLED = 8,
    LIQUIDATED = 9,
    ARBITRATION = 10,
}

// 获取 Provider
export function getProvider(): ethers.JsonRpcProvider {
    const rpcUrl = process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/';
    return new ethers.JsonRpcProvider(rpcUrl);
}

// 获取 Signer (Keeper 钱包)
export function getSigner(): ethers.Wallet {
    const privateKey = process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('KEEPER_PRIVATE_KEY or PRIVATE_KEY not set in .env');
    }
    return new ethers.Wallet(privateKey, getProvider());
}

// 获取 OptionsCore 合约实例
export function getOptionsCore(): ethers.Contract {
    return new ethers.Contract(CONTRACT_ADDRESSES.OptionsCore, OPTIONS_CORE_ABI, getSigner());
}

// 获取 OptionsSettlement 合约实例
export function getOptionsSettlement(): ethers.Contract {
    return new ethers.Contract(CONTRACT_ADDRESSES.OptionsSettlement, OPTIONS_SETTLEMENT_ABI, getSigner());
}

// 格式化日志
export function log(module: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${module}]`;
    if (data) {
        console.log(`${prefix} ${message}`, data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

// 安全执行交易
export async function safeExecute(
    module: string,
    orderId: number,
    action: string,
    txPromise: Promise<ethers.TransactionResponse>
): Promise<boolean> {
    try {
        log(module, `Executing ${action} for order #${orderId}...`);
        const tx = await txPromise;
        const receipt = await tx.wait();
        log(module, `✅ ${action} succeeded for order #${orderId}`, { txHash: receipt?.hash });
        return true;
    } catch (error) {
        log(module, `❌ ${action} failed for order #${orderId}`, { error: (error as Error).message });
        return false;
    }
}

// Sleep 函数
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出合约地址
export const OptionsCoreAddress = CONTRACT_ADDRESSES.OptionsCore;
export const OptionsSettlementAddress = CONTRACT_ADDRESSES.OptionsSettlement;
export const FeedProtocolAddress = CONTRACT_ADDRESSES.FeedProtocol;
export const USDT_ADDRESS = process.env.USDT_ADDRESS || '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd';

// 管理员钱包 (与 Signer 相同但语义更清晰)
export function getAdminWallet(): ethers.Wallet {
    return getSigner();
}

// 获取所有合约实例
export function getContracts() {
    return {
        optionsCore: getOptionsCore(),
        optionsSettlement: getOptionsSettlement(),
    };
}

