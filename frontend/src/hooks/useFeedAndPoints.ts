import { useState, useCallback } from 'react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import { useWalletContext } from '../context/WalletContext';
import { getContractAddresses } from '../contracts/config';
import { FeedProtocolABI, PointsManagerABI, VolumeBasedFeedABI } from '../contracts/abis';

// Types
export interface FeedRequest {
    requestId: bigint;
    orderId: bigint;
    feedType: number;
    tier: number;
    deadline: bigint;
    createdAt: bigint;
    totalFeeders: bigint;
    submittedCount: bigint;
    finalPrice: bigint;
    finalized: boolean;
    // P2 新增字段
    exerciseDelay?: number;      // T+X 行权延迟条件
    feedRule?: number;           // 喂价规则: 0=正常, 1=跟量成交
    suggestedPrice?: string;     // 跟量成交建议价格
}

export interface Feeder {
    feederAddress: string;
    stakedAmount: bigint;
    completedFeeds: bigint;
    rejectedFeeds: bigint;
    registeredAt: bigint;
    isActive: boolean;
    isBlacklisted: boolean;
}

export interface UserPoints {
    totalPoints: bigint;
    claimedPoints: bigint;
    availablePoints: bigint;
    lastUpdateTime: bigint;
}

export interface Airdrop {
    airdropId: bigint;
    totalNSTPool: bigint;
    startTime: bigint;
    endTime: bigint;
    snapshotTotalPoints: bigint;
    isFinalized: boolean;
}

// Feed Protocol Hook
export function useFeedProtocol() {
    const { provider, chainId, account } = useWalletContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getContract = useCallback(async () => {
        if (!provider || !chainId) return null;

        const addresses = getContractAddresses(chainId);
        if (!addresses.FeedProtocol) return null;

        const signer = await provider.getSigner();
        return new Contract(addresses.FeedProtocol, FeedProtocolABI, signer);
    }, [provider, chainId]);

    const getReadContract = useCallback(async () => {
        if (!provider || !chainId) return null;

        const addresses = getContractAddresses(chainId);
        if (!addresses.FeedProtocol) return null;

        return new Contract(addresses.FeedProtocol, FeedProtocolABI, provider);
    }, [provider, chainId]);

    // Get feed request
    const getFeedRequest = useCallback(async (requestId: number): Promise<FeedRequest | null> => {
        const contract = await getReadContract();
        if (!contract) return null;

        try {
            const request = await contract.getFeedRequest(requestId);
            return request as FeedRequest;
        } catch (err) {
            console.error('Failed to fetch feed request:', err);
            return null;
        }
    }, [getReadContract]);

    // Get pending (unfilled) feed requests
    const getPendingRequests = useCallback(async (): Promise<FeedRequest[]> => {
        const contract = await getReadContract();
        if (!contract) return [];

        try {
            const requests = await contract.getPendingRequests();
            return requests as FeedRequest[];
        } catch (err) {
            console.error('Failed to fetch pending requests:', err);
            return [];
        }
    }, [getReadContract]);

    // Get all feed requests with pagination
    const getAllFeedRequests = useCallback(async (offset: number = 0, limit: number = 50): Promise<FeedRequest[]> => {
        const contract = await getReadContract();
        if (!contract) return [];

        try {
            const requests = await contract.getAllFeedRequests(offset, limit);
            return requests as FeedRequest[];
        } catch (err) {
            console.error('Failed to fetch all feed requests:', err);
            return [];
        }
    }, [getReadContract]);

    // Get total request count
    const getTotalRequestCount = useCallback(async (): Promise<number> => {
        const contract = await getReadContract();
        if (!contract) return 0;

        try {
            const count = await contract.getTotalRequestCount();
            return Number(count);
        } catch (err) {
            console.error('Failed to get total request count:', err);
            return 0;
        }
    }, [getReadContract]);

    // Get feeder info
    const getFeederInfo = useCallback(async (address?: string): Promise<Feeder | null> => {
        const contract = await getReadContract();
        if (!contract) return null;

        try {
            const feeder = await contract.getFeeder(address || account);
            return feeder as Feeder;
        } catch (err) {
            console.error('Failed to fetch feeder info:', err);
            return null;
        }
    }, [getReadContract, account]);

    // Request feed (public function for MVP) - with USDT approval
    const requestFeed = useCallback(async (orderId: number, feedType: number, tier: number) => {
        if (!provider || !chainId) throw new Error('Provider not initialized');

        const addresses = getContractAddresses(chainId);
        const feedProtocolAddress = addresses.FeedProtocol;
        const usdtAddress = addresses.USDT;

        if (!feedProtocolAddress || !usdtAddress) throw new Error('Contract addresses not found');

        setIsLoading(true);
        setError(null);

        try {
            const signer = await provider.getSigner();

            // Get feed fee for the tier using getFeedFee
            const feedProtocol = new Contract(feedProtocolAddress, FeedProtocolABI, signer);
            const feedFee = await feedProtocol.getFeedFee(tier);

            // Step 1: Check and approve USDT
            const usdtContract = new Contract(
                usdtAddress,
                [
                    'function allowance(address owner, address spender) view returns (uint256)',
                    'function approve(address spender, uint256 amount) returns (bool)'
                ],
                signer
            );

            const currentAllowance = await usdtContract.allowance(await signer.getAddress(), feedProtocolAddress);

            if (currentAllowance < feedFee) {
                console.log('Approving USDT for feed fee...', feedFee.toString());
                const approveTx = await usdtContract.approve(feedProtocolAddress, feedFee);
                await approveTx.wait();
                console.log('USDT approved');
            }

            // Step 2: Request feed
            const tx = await feedProtocol.requestFeedPublic(orderId, feedType, tier);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Transaction failed';
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [provider, chainId]);

    // Register as feeder (with USDT approval)
    const registerFeeder = useCallback(async (stakeAmount: string) => {
        if (!provider || !chainId) throw new Error('Provider not initialized');

        const addresses = getContractAddresses(chainId);
        const feedProtocolAddress = addresses.FeedProtocol;
        const usdtAddress = addresses.USDT;

        if (!feedProtocolAddress || !usdtAddress) throw new Error('Contract addresses not found');

        setIsLoading(true);
        setError(null);

        try {
            const signer = await provider.getSigner();

            // Mock USDT uses 18 decimals
            const stakeAmountWei = parseUnits(stakeAmount, 18);

            // Step 1: Check and approve USDT
            const usdtContract = new Contract(
                usdtAddress,
                [
                    'function allowance(address owner, address spender) view returns (uint256)',
                    'function approve(address spender, uint256 amount) returns (bool)'
                ],
                signer
            );

            const currentAllowance = await usdtContract.allowance(await signer.getAddress(), feedProtocolAddress);

            if (currentAllowance < stakeAmountWei) {
                console.log('Approving USDT...');
                const approveTx = await usdtContract.approve(feedProtocolAddress, stakeAmountWei);
                await approveTx.wait();
                console.log('USDT approved');
            }

            // Step 2: Register as feeder
            const feedProtocol = new Contract(feedProtocolAddress, FeedProtocolABI, signer);
            const tx = await feedProtocol.registerFeeder(stakeAmountWei);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Transaction failed';
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [provider, chainId]);

    // Submit feed
    const submitFeed = useCallback(async (requestId: number, price: string) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            // Price uses 18 decimals for precision
            const tx = await contract.submitFeed(requestId, parseUnits(price, 18));
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract]);

    // Reject feed
    const rejectFeed = useCallback(async (requestId: number, reason: string) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await contract.rejectFeed(requestId, reason);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract]);

    // Get feed fee
    const getFeedFee = useCallback(async (tier: number): Promise<string> => {
        const contract = await getReadContract();
        if (!contract) return '0';

        try {
            const fee = await contract.getFeedFee(tier);
            return formatUnits(fee, 18); // USDT 18 decimals (项目统一标准)
        } catch (err) {
            console.error('Failed to get feed fee:', err);
            return '0';
        }
    }, [getReadContract]);

    // Get feed requests for a specific order
    const getOrderFeedRequests = useCallback(async (orderId: number): Promise<number[]> => {
        const contract = await getReadContract();
        if (!contract) return [];

        try {
            const requestIds = await contract.getOrderFeedRequests(orderId);
            return requestIds.map((id: bigint) => Number(id));
        } catch (err) {
            console.error('Failed to get order feed requests:', err);
            return [];
        }
    }, [getReadContract]);

    // Check if initial feed is completed for an order
    const checkInitialFeedCompleted = useCallback(async (orderId: number): Promise<{
        completed: boolean;
        finalPrice: bigint;
    }> => {
        const requestIds = await getOrderFeedRequests(orderId);
        if (requestIds.length === 0) {
            return { completed: false, finalPrice: 0n };
        }

        // 检查最新的喂价请求
        const latestRequestId = Math.max(...requestIds);
        const request = await getFeedRequest(latestRequestId);

        if (request && request.finalized) {
            return { completed: true, finalPrice: request.finalPrice };
        }

        return { completed: false, finalPrice: 0n };
    }, [getOrderFeedRequests, getFeedRequest]);

    return {
        isLoading,
        error,
        getFeedRequest,
        getPendingRequests,
        getAllFeedRequests,
        getTotalRequestCount,
        getFeederInfo,
        requestFeed,
        registerFeeder,
        submitFeed,
        rejectFeed,
        getFeedFee,
        getOrderFeedRequests,
        checkInitialFeedCompleted,
    };
}

// Points Manager Hook
export function usePoints() {
    const { provider, chainId, account, isConnected } = useWalletContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userPoints, setUserPoints] = useState<UserPoints | null>(null);

    const getContract = useCallback(async () => {
        if (!provider || !chainId) return null;

        const addresses = getContractAddresses(chainId);
        if (!addresses.PointsManager) return null;

        const signer = await provider.getSigner();
        return new Contract(addresses.PointsManager, PointsManagerABI, signer);
    }, [provider, chainId]);

    // Fetch user points
    const fetchUserPoints = useCallback(async () => {
        const contract = await getContract();
        if (!contract || !account) return;

        try {
            const points = await contract.getUserPoints(account);
            setUserPoints({
                totalPoints: points.totalPoints,
                claimedPoints: points.claimedPoints,
                availablePoints: points.availablePoints,
                lastUpdateTime: points.lastUpdateTime,
            });
        } catch (err) {
            console.error('Failed to fetch user points:', err);
        }
    }, [getContract, account]);

    // Get current airdrop config
    const getCurrentAirdrop = useCallback(async () => {
        const contract = await getContract();
        if (!contract) return null;

        try {
            const airdrop = await contract.getCurrentAirdrop();
            return {
                totalPool: airdrop.totalPool,
                startTime: Number(airdrop.startTime),
                endTime: Number(airdrop.endTime),
                totalPointsSnapshot: airdrop.totalPointsSnapshot,
                isActive: airdrop.isActive,
                airdropId: Number(airdrop.airdropId),
            };
        } catch (err) {
            console.error('Failed to fetch current airdrop:', err);
            return null;
        }
    }, [getContract]);

    // Calculate claimable NST
    const calculateClaimableNST = useCallback(async (): Promise<string> => {
        const contract = await getContract();
        if (!contract || !account) return '0';

        try {
            const amount = await contract.getClaimableAirdrop(account);
            return formatUnits(amount, 18);
        } catch (err) {
            console.error('Failed to calculate claimable NST:', err);
            return '0';
        }
    }, [getContract, account]);

    // Claim airdrop
    const claimAirdrop = useCallback(async () => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await contract.claimAirdrop();
            const receipt = await tx.wait();
            await fetchUserPoints(); // Refresh points after claiming
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract, fetchUserPoints]);

    // Get current airdrop ID (airdrop counter)
    const getCurrentAirdropId = useCallback(async (): Promise<number> => {
        const contract = await getContract();
        if (!contract) return 0;

        try {
            const id = await contract.airdropCounter();
            return Number(id);
        } catch (err) {
            console.error('Failed to get current airdrop ID:', err);
            return 0;
        }
    }, [getContract]);

    // 积分历史记录类型
    interface PointsHistoryItem {
        type: string;
        source: string;
        points: string;
        status: 'CONFIRMED';
        time: string;
        txHash: string;
    }

    /**
     * 获取用户积分历史记录
     * 通过读取 PointsAccumulated 事件获取
     * @param maxBlocks 最大查询区块数 (默认 10000)
     */
    const getPointsHistory = useCallback(async (maxBlocks: number = 10000): Promise<PointsHistoryItem[]> => {
        if (!provider || !chainId || !account) return [];

        const addresses = getContractAddresses(chainId);
        if (!addresses.PointsManager) return [];

        try {
            const contract = new Contract(addresses.PointsManager, PointsManagerABI, provider);

            // 获取当前区块
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - maxBlocks);

            // 查询 PointsAccumulated 事件
            const filter = contract.filters.PointsAccumulated(account);
            const events = await contract.queryFilter(filter, fromBlock, currentBlock);

            // 格式化事件数据
            const history: PointsHistoryItem[] = await Promise.all(
                events.map(async (event) => {
                    const block = await event.getBlock();
                    const timestamp = block.timestamp;
                    const date = new Date(timestamp * 1000);
                    const timeStr = date.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                    });

                    // 解析事件参数
                    const args = (event as any).args;
                    const amount = args.amount;
                    const feeType = args.feeType;

                    // 生成来源标识
                    const sourceId = `${feeType.toUpperCase()}-${event.transactionHash.slice(0, 6)}`;

                    return {
                        type: feeType.toUpperCase(),
                        source: sourceId,
                        points: `+${formatUnits(amount, 0)}`,
                        status: 'CONFIRMED' as const,
                        time: timeStr,
                        txHash: event.transactionHash,
                    };
                })
            );

            // 按时间倒序排列
            return history.reverse();
        } catch (err) {
            console.error('Failed to fetch points history:', err);
            return [];
        }
    }, [provider, chainId, account]);

    return {
        isLoading,
        error,
        userPoints,
        isConnected,
        fetchUserPoints,
        getCurrentAirdrop,
        calculateClaimableNST,
        claimAirdrop,
        getCurrentAirdropId,
        getPointsHistory,
    };
}

// ==================== 跟量成交喂价 Hook ====================

// 跟量成交喂价请求状态常量
export const VolumeBasedFeedStatus = {
    Pending: 0,
    Approved: 1,
    Rejected: 2,
    Modified: 3,
    Expired: 4,
    Finalized: 5,
} as const;
export type VolumeBasedFeedStatus = typeof VolumeBasedFeedStatus[keyof typeof VolumeBasedFeedStatus];

// 拒绝原因常量
export const RejectReason = {
    T_PLUS_X_NOT_MET: 0,
    NO_TRADING_VOLUME: 1,
    MARKET_CLOSED: 2,
    PRICE_NOT_AVAILABLE: 3,
    PRICE_UNREASONABLE: 4,
    OTHER: 5,
} as const;
export type RejectReason = typeof RejectReason[keyof typeof RejectReason];

// 拒绝原因标签
export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
    [RejectReason.T_PLUS_X_NOT_MET]: '不符合T+X行权条件',
    [RejectReason.NO_TRADING_VOLUME]: '跟量成交无成交量',
    [RejectReason.MARKET_CLOSED]: '市场休市',
    [RejectReason.PRICE_NOT_AVAILABLE]: '无法获取价格',
    [RejectReason.PRICE_UNREASONABLE]: '价格不合理',
    [RejectReason.OTHER]: '其他原因',
};

export interface VolumeBasedFeedRequest {
    requestId: bigint;
    orderId: bigint;
    seller: string;
    suggestedPrice: bigint;
    priceEvidence: string;
    submittedAt: bigint;
    deadline: bigint;
    isVerified: boolean;
    verifiedBy: string;
    finalPrice: bigint;
    status: VolumeBasedFeedStatus;
    rejectReason: RejectReason;
    rejectDescription: string;
    feedType: number;
    isInitialFeed: boolean;
}

export function useVolumeBasedFeed() {
    const { provider, chainId } = useWalletContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getContract = useCallback(async () => {
        if (!provider || !chainId) return null;

        const addresses = getContractAddresses(chainId);
        if (!addresses.VolumeBasedFeed) return null;

        const signer = await provider.getSigner();
        return new Contract(addresses.VolumeBasedFeed, VolumeBasedFeedABI, signer);
    }, [provider, chainId]);

    const getReadContract = useCallback(async () => {
        if (!provider || !chainId) return null;

        const addresses = getContractAddresses(chainId);
        if (!addresses.VolumeBasedFeed) return null;

        return new Contract(addresses.VolumeBasedFeed, VolumeBasedFeedABI, provider);
    }, [provider, chainId]);

    /**
     * 获取跟量成交喂价请求详情
     */
    const getVolumeRequest = useCallback(async (requestId: number): Promise<VolumeBasedFeedRequest | null> => {
        const contract = await getReadContract();
        if (!contract) return null;

        try {
            const request = await contract.getRequest(requestId);
            return request as VolumeBasedFeedRequest;
        } catch (err) {
            console.error('Failed to fetch volume-based feed request:', err);
            return null;
        }
    }, [getReadContract]);

    /**
     * 获取订单的所有跟量成交请求ID
     */
    const getOrderVolumeRequests = useCallback(async (orderId: number): Promise<number[]> => {
        const contract = await getReadContract();
        if (!contract) return [];

        try {
            const requestIds = await contract.getOrderVolumeRequests(orderId);
            return requestIds.map((id: bigint) => Number(id));
        } catch (err) {
            console.error('Failed to fetch order volume requests:', err);
            return [];
        }
    }, [getReadContract]);

    /**
     * 喂价员确认使用卖方建议价格
     */
    const approvePrice = useCallback(async (requestId: number) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await contract.approvePrice(requestId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Approve price failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract]);

    /**
     * 喂价员修正价格
     */
    const modifyPrice = useCallback(async (requestId: number, modifiedPrice: string, reason: string) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            // 价格使用 18 位精度
            const tx = await contract.modifyPrice(requestId, parseUnits(modifiedPrice, 18), reason);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Modify price failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract]);

    /**
     * 喂价员拒绝喂价
     */
    const rejectPrice = useCallback(async (requestId: number, reason: RejectReason, description: string) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await contract.rejectPrice(requestId, reason, description);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Reject price failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract]);

    /**
     * 获取请求最终价格
     */
    const getFinalPrice = useCallback(async (requestId: number): Promise<{ price: string; isValid: boolean }> => {
        const contract = await getReadContract();
        if (!contract) return { price: '0', isValid: false };

        try {
            const [price, isValid] = await contract.getFinalPrice(requestId);
            return { price: formatUnits(price, 18), isValid };
        } catch (err) {
            console.error('Failed to get final price:', err);
            return { price: '0', isValid: false };
        }
    }, [getReadContract]);

    return {
        isLoading,
        error,
        getVolumeRequest,
        getOrderVolumeRequests,
        approvePrice,
        modifyPrice,
        rejectPrice,
        getFinalPrice,
    };
}
