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

    // Get feed request
    const getFeedRequest = useCallback(async (requestId: number): Promise<FeedRequest | null> => {
        const contract = await getContract();
        if (!contract) return null;

        try {
            const request = await contract.getFeedRequest(requestId);
            return request as FeedRequest;
        } catch (err) {
            console.error('Failed to fetch feed request:', err);
            return null;
        }
    }, [getContract]);

    // Get feeder info
    const getFeederInfo = useCallback(async (address?: string): Promise<Feeder | null> => {
        const contract = await getContract();
        if (!contract) return null;

        try {
            const feeder = await contract.getFeeder(address || account);
            return feeder as Feeder;
        } catch (err) {
            console.error('Failed to fetch feeder info:', err);
            return null;
        }
    }, [getContract, account]);

    // Register as feeder
    const registerFeeder = useCallback(async (stakeAmount: string) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await contract.registerFeeder(parseUnits(stakeAmount, 18));
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getContract]);

    // Submit feed
    const submitFeed = useCallback(async (requestId: number, price: string) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
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
        const contract = await getContract();
        if (!contract) return '0';

        try {
            const fee = await contract.getFeedFee(tier);
            return formatUnits(fee, 18);
        } catch (err) {
            console.error('Failed to get feed fee:', err);
            return '0';
        }
    }, [getContract]);

    return {
        isLoading,
        error,
        getFeedRequest,
        getFeederInfo,
        registerFeeder,
        submitFeed,
        rejectFeed,
        getFeedFee,
    };
}

// Points Manager Hook
export function usePoints() {
    const { provider, chainId, account } = useWalletContext();
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
            setUserPoints(points as UserPoints);
        } catch (err) {
            console.error('Failed to fetch user points:', err);
        }
    }, [getContract, account]);

    // Get airdrop info
    const getAirdrop = useCallback(async (airdropId: number): Promise<Airdrop | null> => {
        const contract = await getContract();
        if (!contract) return null;

        try {
            const airdrop = await contract.getAirdrop(airdropId);
            return airdrop as Airdrop;
        } catch (err) {
            console.error('Failed to fetch airdrop:', err);
            return null;
        }
    }, [getContract]);

    // Calculate claimable NST
    const calculateClaimableNST = useCallback(async (airdropId: number): Promise<string> => {
        const contract = await getContract();
        if (!contract || !account) return '0';

        try {
            const amount = await contract.calculateClaimableNST(account, airdropId);
            return formatUnits(amount, 18);
        } catch (err) {
            console.error('Failed to calculate claimable NST:', err);
            return '0';
        }
    }, [getContract, account]);

    // Claim airdrop
    const claimAirdrop = useCallback(async (airdropId: number) => {
        const contract = await getContract();
        if (!contract) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await contract.claimAirdrop(airdropId);
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

    // Get current airdrop ID
    const getCurrentAirdropId = useCallback(async (): Promise<number> => {
        const contract = await getContract();
        if (!contract) return 0;

        try {
            const id = await contract.currentAirdropId();
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
        fetchUserPoints,
        getAirdrop,
        calculateClaimableNST,
        claimAirdrop,
        getCurrentAirdropId,
    };
}
