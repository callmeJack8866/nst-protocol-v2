/**
 * Keeper Service - 公共工具模块
 * 提供合约实例、Provider 和日志功能
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

// 合约地址配置 (BSC Testnet) - 与 frontend/src/contracts/config.ts 同步
const CONTRACT_ADDRESSES = {
    OptionsCore: '0x3eF66aFCe1DD7598460A0fE6AEeF18cbF3c92964',
    FeedProtocol: '0x73c55A0EE01B227FeB172d53CEDD90cF27A46D2A',
    Config: '0x5d660E670c943498176A50ebE8Ce11864962cA4c',
};

// OptionsCore ABI (仅 Keeper 需要的函数)
const OPTIONS_CORE_ABI = [
    'function nextOrderId() view returns (uint256)',
    'function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 premiumRate, uint256 premiumAmount, uint256 expiryTimestamp, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint256 marginCallDeadline, uint256 arbitrationWindow, bool dividendAdjustment, uint256 lastFeedPrice, uint256 lastFeedTime))',
    'function cancelRFQ(uint256 orderId) external',
    'function forceLiquidate(uint256 orderId) external',
    'function settle(uint256 orderId) external',
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
