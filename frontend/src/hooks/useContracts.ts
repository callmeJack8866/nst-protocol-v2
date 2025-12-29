import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';
import { getContractAddresses, getChainConfig } from '../contracts/config';
import { OptionsCoreABI, ERC20ABI } from '../contracts/abis';

// Types
export interface Order {
    orderId: bigint;
    buyer: string;
    seller: string;
    underlyingName: string;
    underlyingCode: string;
    market: string;
    country: string;
    refPrice: string;
    direction: number;
    notionalUSDT: bigint;
    strikePrice: bigint;
    expiryTimestamp: bigint;
    premiumRate: bigint;
    premiumAmount: bigint;
    initialMargin: bigint;
    currentMargin: bigint;
    minMarginRate: bigint;
    liquidationRule: number;
    consecutiveDays: number;
    dailyLimitPercent: number;
    exerciseDelay: number;
    sellerType: number;
    designatedSeller: string;
    arbitrationWindow: bigint;
    marginCallDeadline: bigint;
    dividendAdjustment: boolean;
    feedRule: number;
    status: number;
    createdAt: bigint;
    matchedAt: bigint;
    settledAt: bigint;
    lastFeedPrice: bigint;
}

export interface Quote {
    quoteId: bigint;
    orderId: bigint;
    seller: string;
    sellerType: number;
    premiumRate: bigint;
    premiumAmount: bigint;
    marginRate: bigint;
    marginAmount: bigint;
    liquidationRule: number;
    consecutiveDays: number;
    dailyLimitPercent: number;
    createdAt: bigint;
    expiresAt: bigint;
    status: number;
}

// Wallet connection hook
export function useWallet() {
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback(async () => {
        if (typeof window.ethereum === 'undefined') {
            setError('Please install MetaMask!');
            return;
        }

        try {
            setIsConnecting(true);
            setError(null);

            const browserProvider = new BrowserProvider(window.ethereum);
            const accounts = await browserProvider.send('eth_requestAccounts', []);
            const network = await browserProvider.getNetwork();

            setProvider(browserProvider);
            setAccount(accounts[0]);
            setChainId(Number(network.chainId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect');
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAccount(null);
        setChainId(null);
        setProvider(null);
    }, []);

    const switchToBSC = useCallback(async (testnet = true) => {
        if (!window.ethereum) return;

        const chainConfig = getChainConfig(testnet ? 97 : 56);

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ethers.toBeHex(chainConfig.chainId) }],
            });
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: ethers.toBeHex(chainConfig.chainId),
                        chainName: chainConfig.name,
                        nativeCurrency: chainConfig.nativeCurrency,
                        rpcUrls: [chainConfig.rpcUrl],
                        blockExplorerUrls: [chainConfig.blockExplorer],
                    }],
                });
            }
        }
    }, []);

    // Listen for account/chain changes
    useEffect(() => {
        if (!window.ethereum) return;

        const handleAccountsChanged = (...args: unknown[]) => {
            const accounts = args[0] as string[];
            if (accounts.length === 0) {
                disconnect();
            } else {
                setAccount(accounts[0]);
            }
        };

        const handleChainChanged = (...args: unknown[]) => {
            const chainIdHex = args[0] as string;
            setChainId(parseInt(chainIdHex, 16));
        };

        window.ethereum.on?.('accountsChanged', handleAccountsChanged);
        window.ethereum.on?.('chainChanged', handleChainChanged);

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener?.('chainChanged', handleChainChanged);
            }
        };
    }, [disconnect]);

    return {
        account,
        chainId,
        provider,
        isConnecting,
        error,
        isConnected: !!account,
        connect,
        disconnect,
        switchToBSC,
    };
}

// Contract instances hook
export function useContracts() {
    const { provider, chainId } = useWallet();
    const [contracts, setContracts] = useState<{
        optionsCore: Contract | null;
        usdt: Contract | null;
    }>({ optionsCore: null, usdt: null });

    useEffect(() => {
        if (!provider || !chainId) {
            setContracts({ optionsCore: null, usdt: null });
            return;
        }

        const addresses = getContractAddresses(chainId);

        const initContracts = async () => {
            const signer = await provider.getSigner();

            const optionsCore = addresses.OptionsCore
                ? new Contract(addresses.OptionsCore, OptionsCoreABI, signer)
                : null;

            const usdt = addresses.USDT
                ? new Contract(addresses.USDT, ERC20ABI, signer)
                : null;

            setContracts({ optionsCore, usdt });
        };

        initContracts();
    }, [provider, chainId]);

    return contracts;
}

// USDT operations hook
export function useUSDT() {
    const { account } = useWallet();
    const { usdt } = useContracts();
    const [balance, setBalance] = useState<string>('0');
    const [isLoading, setIsLoading] = useState(false);

    const fetchBalance = useCallback(async () => {
        if (!usdt || !account) return;

        try {
            const bal = await usdt.balanceOf(account);
            setBalance(formatUnits(bal, 18));
        } catch (err) {
            console.error('Failed to fetch USDT balance:', err);
        }
    }, [usdt, account]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    const approve = useCallback(async (spender: string, amount: string) => {
        if (!usdt) throw new Error('USDT contract not initialized');

        setIsLoading(true);
        try {
            const tx = await usdt.approve(spender, parseUnits(amount, 18));
            await tx.wait();
            await fetchBalance();
        } finally {
            setIsLoading(false);
        }
    }, [usdt, fetchBalance]);

    const checkAllowance = useCallback(async (spender: string): Promise<bigint> => {
        if (!usdt || !account) return BigInt(0);
        return usdt.allowance(account, spender);
    }, [usdt, account]);

    return {
        balance,
        isLoading,
        approve,
        checkAllowance,
        refresh: fetchBalance,
    };
}

// Options operations hook
export function useOptions() {
    const { account } = useWallet();
    const { optionsCore } = useContracts();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch order by ID
    const getOrder = useCallback(async (orderId: number): Promise<Order | null> => {
        if (!optionsCore) return null;

        try {
            const order = await optionsCore.getOrder(orderId);
            return order as Order;
        } catch (err) {
            console.error('Failed to fetch order:', err);
            return null;
        }
    }, [optionsCore]);

    // Fetch user's buyer orders
    const getBuyerOrders = useCallback(async (): Promise<number[]> => {
        if (!optionsCore || !account) return [];

        try {
            const orderIds = await optionsCore.getBuyerOrders(account);
            return orderIds.map((id: bigint) => Number(id));
        } catch (err) {
            console.error('Failed to fetch buyer orders:', err);
            return [];
        }
    }, [optionsCore, account]);

    // Fetch user's seller orders
    const getSellerOrders = useCallback(async (): Promise<number[]> => {
        if (!optionsCore || !account) return [];

        try {
            const orderIds = await optionsCore.getSellerOrders(account);
            return orderIds.map((id: bigint) => Number(id));
        } catch (err) {
            console.error('Failed to fetch seller orders:', err);
            return [];
        }
    }, [optionsCore, account]);

    // Create buyer RFQ
    const createBuyerRFQ = useCallback(async (params: {
        underlyingName: string;
        underlyingCode: string;
        market: string;
        country: string;
        refPrice: string;
        direction: number;
        notionalUSDT: string;
        expiryTimestamp: number;
        maxPremiumRate: number;
        minMarginRate: number;
        acceptedSellerType: number;
        designatedSeller: string;
        arbitrationWindow: number;
        marginCallDeadline: number;
        dividendAdjustment: boolean;
    }) => {
        if (!optionsCore) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await optionsCore.createBuyerRFQ(
                params.underlyingName,
                params.underlyingCode,
                params.market,
                params.country,
                params.refPrice,
                params.direction,
                parseUnits(params.notionalUSDT, 18),
                params.expiryTimestamp,
                params.maxPremiumRate,
                params.minMarginRate,
                params.acceptedSellerType,
                params.designatedSeller,
                params.arbitrationWindow,
                params.marginCallDeadline,
                params.dividendAdjustment
            );

            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [optionsCore]);

    // Submit quote
    const submitQuote = useCallback(async (params: {
        orderId: number;
        premiumRate: number;
        marginAmount: string;
        liquidationRule: number;
        consecutiveDays: number;
        dailyLimitPercent: number;
        expiresAt: number;
    }) => {
        if (!optionsCore) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await optionsCore.submitQuote(
                params.orderId,
                params.premiumRate,
                parseUnits(params.marginAmount, 18),
                params.liquidationRule,
                params.consecutiveDays,
                params.dailyLimitPercent,
                params.expiresAt
            );

            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [optionsCore]);

    // Accept quote
    const acceptQuote = useCallback(async (quoteId: number) => {
        if (!optionsCore) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await optionsCore.acceptQuote(quoteId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [optionsCore]);

    // Cancel RFQ
    const cancelRFQ = useCallback(async (orderId: number) => {
        if (!optionsCore) throw new Error('Contract not initialized');

        setIsLoading(true);
        setError(null);

        try {
            const tx = await optionsCore.cancelRFQ(orderId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [optionsCore]);

    return {
        isLoading,
        error,
        getOrder,
        getBuyerOrders,
        getSellerOrders,
        createBuyerRFQ,
        submitQuote,
        acceptQuote,
        cancelRFQ,
    };
}
