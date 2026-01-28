import { useState, useCallback } from 'react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import { useWalletContext } from '../context/WalletContext';
import { getContractAddresses } from '../contracts/config';
import { FeedProtocolABI, PointsManagerABI } from '../contracts/abis';

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

            // USDT uses 6 decimals
            const stakeAmountWei = parseUnits(stakeAmount, 6);

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
            return formatUnits(fee, 6); // USDT 6 decimals
        } catch (err) {
            console.error('Failed to get feed fee:', err);
            return '0';
        }
    }, [getReadContract]);

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
    };
}
