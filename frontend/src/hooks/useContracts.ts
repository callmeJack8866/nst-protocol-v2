import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import { getContractAddresses, CHAINS } from '../contracts/config';
import { OptionsCoreABI, ERC20ABI } from '../contracts/abis';

// Wallet Hook
export function useWallet() {
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const connect = useCallback(async () => {
        if (!window.ethereum) {
            alert('请安装 MetaMask!');
            return;
        }
        try {
            setIsConnecting(true);
            const browserProvider = new BrowserProvider(window.ethereum);
            const accounts = await browserProvider.send('eth_requestAccounts', []);
            const network = await browserProvider.getNetwork();
            
            setProvider(browserProvider);
            setAccount(accounts[0]);
            setChainId(Number(network.chainId));
            setIsConnected(true);
        } catch (err) {
            console.error('Connect error:', err);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAccount(null);
        setChainId(null);
        setProvider(null);
        setIsConnected(false);
    }, []);

    const switchToBSC = useCallback(async (testnet = true) => {
        if (!window.ethereum) return;
        const chain = testnet ? CHAINS.BSC_TESTNET : CHAINS.BSC_MAINNET;
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chain.chainId.toString(16)}` }],
            });
        } catch (err: unknown) {
            const error = err as { code?: number };
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: `0x${chain.chainId.toString(16)}`,
                        chainName: chain.name,
                        nativeCurrency: chain.nativeCurrency,
                        rpcUrls: [chain.rpcUrl],
                        blockExplorerUrls: [chain.blockExplorer],
                    }],
                });
            }
        }
    }, []);

    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = (...args: unknown[]) => {
                const accounts = args[0] as string[];
                if (accounts.length === 0) disconnect();
                else setAccount(accounts[0]);
            };
            const handleChainChanged = () => window.location.reload();

            window.ethereum.on?.('accountsChanged', handleAccountsChanged);
            window.ethereum.on?.('chainChanged', handleChainChanged);

            return () => {
                if (window.ethereum) {
                    window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener?.('chainChanged', handleChainChanged);
                }
            };
        }
    }, [disconnect]);

    return { account, chainId, provider, isConnected, isConnecting, connect, disconnect, switchToBSC };
}

// Contract Instances Hook
export function useContracts() {
    const { provider, chainId } = useWallet();
    const [optionsCore, setOptionsCore] = useState<Contract | null>(null);
    const [usdt, setUsdt] = useState<Contract | null>(null);

    useEffect(() => {
        if (!provider || !chainId) return;

        const initContracts = async () => {
            const signer = await provider.getSigner();
            const addresses = getContractAddresses(chainId);

            if (addresses.OptionsCore) {
                const options = new Contract(addresses.OptionsCore, OptionsCoreABI, signer);
                setOptionsCore(options);
            }
            if (addresses.USDT) {
                const usdtContract = new Contract(addresses.USDT, ERC20ABI, signer);
                setUsdt(usdtContract);
            }
        };

        initContracts();
    }, [provider, chainId]);

    return { optionsCore, usdt };
}

// USDT Operations Hook
export function useUSDT() {
    const { account } = useWallet();
    const { usdt } = useContracts();
    const [balance, setBalance] = useState<bigint>(0n);
    const [allowance, setAllowance] = useState<bigint>(0n);
    const [loading, setLoading] = useState(false);

    const fetchBalance = useCallback(async () => {
        if (!usdt || !account) return;
        try {
            const bal = await usdt.balanceOf(account);
            setBalance(bal);
        } catch (err) {
            console.error('Fetch balance error:', err);
        }
    }, [usdt, account]);

    const fetchAllowance = useCallback(async (spender: string) => {
        if (!usdt || !account) return 0n;
        try {
            const allow = await usdt.allowance(account, spender);
            setAllowance(allow);
            return allow;
        } catch (err) {
            console.error('Fetch allowance error:', err);
            return 0n;
        }
    }, [usdt, account]);

    const approve = useCallback(async (spender: string, amount: bigint) => {
        if (!usdt) throw new Error('USDT contract not initialized');
        setLoading(true);
        try {
            const tx = await usdt.approve(spender, amount);
            await tx.wait();
            await fetchAllowance(spender);
        } finally {
            setLoading(false);
        }
    }, [usdt, fetchAllowance]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    return { balance, allowance, approve, fetchBalance, fetchAllowance, loading };
}

// Options Core Operations Hook
export function useOptions() {
    const { account, chainId } = useWallet();
    const { optionsCore, usdt } = useContracts();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getOptionsCoreAddress = useCallback(() => {
        if (!chainId) return '';
        return getContractAddresses(chainId).OptionsCore;
    }, [chainId]);

    const createBuyerRFQ = useCallback(async (params: {
        underlyingName: string;
        underlyingCode: string;
        market: string;
        country: string;
        refPrice: string;
        direction: number;
        notionalUSDT: bigint;
        expiryTimestamp: number;
        maxPremiumRate: number;
        minMarginRate: number;
        sellerType: number;
        designatedSeller: string;
        arbitrationWindow: number;
        marginCallDeadline: number;
        dividendAdjustment: boolean;
    }) => {
        if (!optionsCore || !usdt) throw new Error('Contracts not initialized');
        
        setLoading(true);
        setError(null);
        try {
            const creationFee = parseUnits('1', 18);
            const optionsCoreAddr = getOptionsCoreAddress();
            const currentAllowance = await usdt.allowance(account, optionsCoreAddr);
            
            if (currentAllowance < creationFee) {
                const approveTx = await usdt.approve(optionsCoreAddr, parseUnits('1000000', 18));
                await approveTx.wait();
            }

            const tx = await optionsCore.createBuyerRFQ(
                params.underlyingName, params.underlyingCode, params.market, params.country,
                params.refPrice, params.direction, params.notionalUSDT, params.expiryTimestamp,
                params.maxPremiumRate, params.minMarginRate, params.sellerType,
                params.designatedSeller, params.arbitrationWindow, params.marginCallDeadline,
                params.dividendAdjustment
            );
            
            return await tx.wait();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Transaction failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore, usdt, account, getOptionsCoreAddress]);

    const createSellerOrder = useCallback(async (params: {
        underlyingName: string;
        underlyingCode: string;
        market: string;
        country: string;
        refPrice: string;
        direction: number;
        notionalUSDT: bigint;
        expiryTimestamp: number;
        premiumRate: number;
        marginAmount: bigint;
        liquidationRule: number;
        consecutiveDays: number;
        dailyLimitPercent: number;
        arbitrationWindow: number;
        dividendAdjustment: boolean;
    }) => {
        if (!optionsCore || !usdt) throw new Error('Contracts not initialized');
        
        setLoading(true);
        setError(null);
        try {
            const creationFee = parseUnits('1', 18);
            const totalRequired = creationFee + params.marginAmount;
            const optionsCoreAddr = getOptionsCoreAddress();
            const currentAllowance = await usdt.allowance(account, optionsCoreAddr);
            
            if (currentAllowance < totalRequired) {
                const approveTx = await usdt.approve(optionsCoreAddr, parseUnits('1000000', 18));
                await approveTx.wait();
            }

            const tx = await optionsCore.createSellerOrder(
                params.underlyingName, params.underlyingCode, params.market, params.country,
                params.refPrice, params.direction, params.notionalUSDT, params.expiryTimestamp,
                params.premiumRate, params.marginAmount, params.liquidationRule,
                params.consecutiveDays, params.dailyLimitPercent, params.arbitrationWindow,
                params.dividendAdjustment
            );
            
            return await tx.wait();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Transaction failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore, usdt, account, getOptionsCoreAddress]);

    const getOrder = useCallback(async (orderId: number) => {
        if (!optionsCore) throw new Error('Contract not initialized');
        return await optionsCore.getOrder(orderId);
    }, [optionsCore]);

    const getBuyerOrders = useCallback(async () => {
        if (!optionsCore || !account) return [];
        try {
            const orderIds = await optionsCore.getBuyerOrders(account);
            return orderIds.map((id: bigint) => Number(id));
        } catch (err) {
            console.error('Fetch buyer orders error:', err);
            return [];
        }
    }, [optionsCore, account]);

    const getSellerOrders = useCallback(async () => {
        if (!optionsCore || !account) return [];
        try {
            const orderIds = await optionsCore.getSellerOrders(account);
            return orderIds.map((id: bigint) => Number(id));
        } catch (err) {
            console.error('Fetch seller orders error:', err);
            return [];
        }
    }, [optionsCore, account]);

    return { loading, error, createBuyerRFQ, createSellerOrder, getOrder, getBuyerOrders, getSellerOrders, getOptionsCoreAddress };
}
