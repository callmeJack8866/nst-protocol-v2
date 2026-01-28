import { useState, useCallback } from 'react';
import { parseUnits } from 'ethers';
import { useWalletContext } from '../context/WalletContext';
import { getContractAddresses } from '../contracts/config';

// Re-export the wallet context hook for backwards compatibility
export { useWalletContext as useWallet } from '../context/WalletContext';

// USDT Operations Hook
export function useUSDT() {
    const { account, usdt } = useWalletContext();
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

    return { balance, allowance, approve, fetchBalance, fetchAllowance, loading };
}

// Options Core Operations Hook
export function useOptions() {
    const { account, chainId, optionsCore, usdt, isConnected } = useWalletContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getOptionsCoreAddress = useCallback(() => {
        if (!chainId) return '';
        const rawAddress = getContractAddresses(chainId).OptionsCore;
        // Use toLowerCase() to bypass ethers v6 strict checksum validation
        return rawAddress ? rawAddress.toLowerCase() : '';
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
        // 新增：平仓规则和喂价规则
        liquidationRule: number;
        consecutiveDays: number;
        dailyLimitPercent: number;
        feedRule: number;
    }) => {
        if (!optionsCore || !usdt) {
            throw new Error('Contracts not initialized. Please connect your wallet first.');
        }

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
                params.dividendAdjustment,
                // 新增参数
                params.liquidationRule, params.consecutiveDays, params.dailyLimitPercent,
                params.feedRule
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
        if (!optionsCore || !usdt) {
            throw new Error('Contracts not initialized. Please connect your wallet first.');
        }

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

    // Fetch all active RFQs (orders with status RFQ_CREATED or QUOTING)
    const getAllActiveRFQs = useCallback(async () => {
        if (!optionsCore) return [];
        try {
            const nextId = await optionsCore.nextOrderId();
            const totalOrders = Number(nextId);
            const activeRFQs = [];

            for (let i = 1; i < totalOrders; i++) {
                try {
                    const order = await optionsCore.getOrder(i);
                    // Status 0 = RFQ_CREATED, 1 = QUOTING (active buyer orders)
                    // Also check if buyer address exists (buyer orders have buyer != 0x0)
                    if (order.buyer !== '0x0000000000000000000000000000000000000000' &&
                        (Number(order.status) === 0 || Number(order.status) === 1)) {
                        activeRFQs.push({
                            orderId: Number(order.orderId),
                            buyer: order.buyer,
                            underlyingName: order.underlyingName,
                            underlyingCode: order.underlyingCode,
                            market: order.market,
                            country: order.country,
                            refPrice: order.refPrice,
                            direction: Number(order.direction) === 0 ? 'Call' : 'Put',
                            notionalUSDT: order.notionalUSDT,
                            premiumRate: Number(order.premiumRate),
                            expiryTimestamp: Number(order.expiryTimestamp),
                            status: Number(order.status) === 0 ? 'RFQ_CREATED' : 'QUOTING',
                            createdAt: Number(order.createdAt),
                        });
                    }
                } catch {
                    // Skip invalid orders
                }
            }
            return activeRFQs;
        } catch (err) {
            console.error('Fetch all active RFQs error:', err);
            return [];
        }
    }, [optionsCore]);

    // Submit a quote for a buyer RFQ
    const submitQuote = useCallback(async (params: {
        orderId: number;
        premiumRate: number;      // In basis points (e.g., 650 = 6.5%)
        marginRate: number;       // In basis points (e.g., 1000 = 10%)
        liquidationRule: number;  // 0 = Consecutive, 1 = Single
        consecutiveDays: number;
        dailyLimitPercent: number;
        notionalUSDT: bigint;     // For calculating margin amount
    }) => {
        if (!optionsCore || !usdt) {
            throw new Error('Contracts not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            // Calculate margin amount (notional * marginRate / 10000)
            const marginAmount = (params.notionalUSDT * BigInt(params.marginRate)) / 10000n;
            const optionsCoreAddr = getOptionsCoreAddress();

            // Check and approve USDT for margin
            const currentAllowance = await usdt.allowance(account, optionsCoreAddr);
            if (currentAllowance < marginAmount) {
                const approveTx = await usdt.approve(optionsCoreAddr, marginAmount * 10n); // Approve 10x for future quotes
                await approveTx.wait();
            }

            // Submit the quote
            const tx = await optionsCore.submitQuote(
                params.orderId,
                params.premiumRate,
                params.marginRate,
                params.liquidationRule,
                params.consecutiveDays,
                params.dailyLimitPercent
            );

            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Quote submission failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore, usdt, account, getOptionsCoreAddress]);

    // Get all quotes for a specific order
    const getQuotesForOrder = useCallback(async (orderId: number) => {
        if (!optionsCore) return [];
        try {
            // getQuotes returns an array of Quote structs
            const quotes = await optionsCore.getQuotes(orderId);
            return quotes.map((quote: any) => ({
                quoteId: Number(quote.quoteId),
                orderId: Number(quote.orderId),
                seller: quote.seller,
                sellerType: Number(quote.sellerType),
                premiumRate: Number(quote.premiumRate),
                premiumAmount: quote.premiumAmount,
                marginRate: Number(quote.marginRate),
                marginAmount: quote.marginAmount,
                liquidationRule: Number(quote.liquidationRule),
                consecutiveDays: Number(quote.consecutiveDays),
                dailyLimitPercent: Number(quote.dailyLimitPercent),
                createdAt: Number(quote.createdAt),
                expiresAt: Number(quote.expiresAt),
                status: Number(quote.status), // 0=Active, 1=Accepted, 2=Rejected, 3=Expired
            }));
        } catch (err) {
            console.error('Fetch quotes error:', err);
            return [];
        }
    }, [optionsCore]);

    // Accept a quote (buyer action)
    const acceptQuote = useCallback(async (quoteId: number, premiumAmount: bigint, notionalUSDT: bigint) => {
        if (!optionsCore || !usdt) {
            throw new Error('Contracts not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            // Calculate trading fee (0.1% of notional)
            const tradingFee = (notionalUSDT * 10n) / 10000n;
            const totalPayment = premiumAmount + tradingFee;
            const optionsCoreAddr = getOptionsCoreAddress();

            // Check and approve USDT for premium + fee
            const currentAllowance = await usdt.allowance(account, optionsCoreAddr);
            if (currentAllowance < totalPayment) {
                const approveTx = await usdt.approve(optionsCoreAddr, totalPayment * 2n); // Approve 2x for safety
                await approveTx.wait();
            }

            // Accept the quote
            const tx = await optionsCore.acceptQuote(quoteId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Accept quote failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore, usdt, account, getOptionsCoreAddress]);

    /**
     * 卖方追加保证金
     * @param orderId 订单 ID
     * @param amountUSDT 追加金额 (USDT, 6位小数)
     */
    const addMargin = useCallback(async (orderId: number, amountUSDT: string) => {
        if (!optionsCore || !usdt) {
            throw new Error('Contracts not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            const amount = parseUnits(amountUSDT, 6); // USDT 6位小数
            const optionsCoreAddr = getOptionsCoreAddress();

            // Check and approve USDT
            const currentAllowance = await usdt.allowance(account, optionsCoreAddr);
            if (currentAllowance < amount) {
                const approveTx = await usdt.approve(optionsCoreAddr, amount);
                await approveTx.wait();
            }

            // Call addMargin
            const tx = await optionsCore.addMargin(orderId, amount);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Add margin failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore, usdt, account, getOptionsCoreAddress]);

    /**
     * 卖方提取超额保证金
     * @param orderId 订单 ID
     * @param amountUSDT 提取金额 (USDT, 6位小数)
     */
    const withdrawExcessMargin = useCallback(async (orderId: number, amountUSDT: string) => {
        if (!optionsCore) {
            throw new Error('Contract not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            const amount = parseUnits(amountUSDT, 6); // USDT 6位小数

            // Call withdrawExcessMargin
            const tx = await optionsCore.withdrawExcessMargin(orderId, amount);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Withdraw margin failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore]);

    /**
     * 买方提前行权
     * @param orderId 订单 ID
     */
    const earlyExercise = useCallback(async (orderId: number) => {
        if (!optionsCore) {
            throw new Error('Contract not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            const tx = await optionsCore.earlyExercise(orderId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Early exercise failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore]);

    /**
     * 结算订单
     * @param orderId 订单 ID
     * @param finalPrice 最终价格 (由喂价提供)
     */
    const settleOrder = useCallback(async (orderId: number) => {
        if (!optionsCore) {
            throw new Error('Contract not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            const tx = await optionsCore.settle(orderId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Settlement failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore]);

    /**
     * 发起仲裁
     * @param orderId 订单 ID
     * @description 仅在 PENDING_SETTLEMENT 状态可发起，收取 30 USDT 仲裁费
     */
    const initiateArbitration = useCallback(async (orderId: number) => {
        if (!optionsCore || !usdt) {
            throw new Error('Contract not initialized. Please connect your wallet first.');
        }

        setLoading(true);
        setError(null);
        try {
            // 仲裁费 30 USDT (6位小数)
            const arbitrationFee = parseUnits('30', 6);
            const optionsCoreAddr = getOptionsCoreAddress();

            // Check and approve USDT for arbitration fee
            const currentAllowance = await usdt.allowance(account, optionsCoreAddr);
            if (currentAllowance < arbitrationFee) {
                const approveTx = await usdt.approve(optionsCoreAddr, arbitrationFee);
                await approveTx.wait();
            }

            // Call initiateArbitration
            const tx = await optionsCore.initiateArbitration(orderId);
            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Arbitration initiation failed';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [optionsCore, usdt, account, getOptionsCoreAddress]);

    return {
        loading,
        error,
        isConnected,
        createBuyerRFQ,
        createSellerOrder,
        submitQuote,
        acceptQuote,
        addMargin,
        withdrawExcessMargin,
        earlyExercise,
        settleOrder,
        initiateArbitration,
        getOrder,
        getBuyerOrders,
        getSellerOrders,
        getAllActiveRFQs,
        getQuotesForOrder,
        getOptionsCoreAddress
    };
}
