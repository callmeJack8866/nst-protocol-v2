import { useState, useEffect } from 'react';
import { useOptions, useFeedProtocol } from '../hooks';
import { useToast } from '../components/Toast';
import { useWalletContext } from '../context/WalletContext';
import { usePerspective } from '../context/PerspectiveContext';
import { formatUnits } from 'ethers';
import { useTranslation } from 'react-i18next';


export function MyOrders() {
    const { isConnected, account } = useWalletContext();
    const { t } = useTranslation();
    const { perspective: viewMode } = usePerspective();
    const {

        getBuyerOrders,
        getSellerOrders,
        getOrder,
        earlyExercise,
        settleOrder,
        initiateArbitration,
        addMargin,
        withdrawExcessMargin,
    } = useOptions();

    // Feed protocol for initiating initial feeds
    const { requestFeed, isLoading: feedLoading } = useFeedProtocol();
    const { showToast } = useToast();

    const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
    const [sellerOrders, setSellerOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [initFeedLoading, setInitFeedLoading] = useState<number | null>(null);

    // 保证金弹窗状态
    const [marginModalOpen, setMarginModalOpen] = useState(false);
    const [marginModalType, setMarginModalType] = useState<'add' | 'withdraw'>('add');
    const [marginAmount, setMarginAmount] = useState('');
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

    // 仲裁弹窗状态
    const [arbitrationModalOpen, setArbitrationModalOpen] = useState(false);
    const [arbitrationOrderId, setArbitrationOrderId] = useState<number | null>(null);

    // 动态喂价加载状态
    const [dynamicFeedLoading, setDynamicFeedLoading] = useState<number | null>(null);

    // 30秒自动刷新订单状态

    useEffect(() => {
        if (!isConnected) return;

        const interval = setInterval(() => {
            setRefreshKey(prev => prev + 1);
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [isConnected]);

    useEffect(() => {
        const fetchOrders = async () => {
            if (!isConnected || !account) return;
            setLoading(true);
            try {
                const bIds = await getBuyerOrders();
                const sIds = await getSellerOrders();
                const bData = await Promise.all(bIds.map((id: any) => getOrder(Number(id))));
                const sData = await Promise.all(sIds.map((id: any) => getOrder(Number(id))));
                setBuyerOrders(bData);
                setSellerOrders(sData);
            } catch (e) {
                console.error('Failed to fetch orders:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [isConnected, account, refreshKey, getBuyerOrders, getOrder, getSellerOrders]);

    const activeOrders = viewMode === 'buyer' ? buyerOrders : sellerOrders;

    const formatAmount = (val: any) => {
        // Handle both BigInt and Number types safely
        let num: number;
        if (typeof val === 'bigint') {
            num = Number(formatUnits(val, 6));
        } else if (typeof val === 'number') {
            num = val;
        } else if (val && typeof val === 'string') {
            num = parseFloat(val);
        } else {
            num = 0;
        }
        if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
        return `$${num.toLocaleString()}`;
    };

    // Safe direction conversion: handles both string and number
    const getDirectionStr = (direction: any): string => {
        if (typeof direction === 'string') return direction;
        return Number(direction) === 0 ? 'Call' : 'Put';
    };

    // Countdown helper: returns "Xd YH" format - safely handles BigInt
    const getExpiryCountdown = (timestamp: any) => {
        const now = Math.floor(Date.now() / 1000);
        // Safe conversion from BigInt to Number
        const ts = typeof timestamp === 'bigint' ? Number(timestamp) : (typeof timestamp === 'number' ? timestamp : 0);
        const diff = ts - now;
        if (diff <= 0) return t('portfolio.expired');
        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        if (days > 0) return `${days}${t('portfolio.days')} ${hours}H`;
        return `${hours}H`;
    };

    // Helper to safely convert premiumAmount to number
    const getPremiumNum = (order: any): number => {
        const val = order.premiumAmount;
        if (typeof val === 'bigint') {
            return Number(formatUnits(val, 6));
        } else if (typeof val === 'number') {
            return val;
        }
        return 0;
    };

    // Simple P&L calculation based on premium rate (mock for now)
    const calculatePnL = (order: any) => {
        const premium = getPremiumNum(order);
        // Mock P&L: random between -10% to +20% of premium
        const pnlRatio = viewMode === 'buyer'
            ? 0.15 // Buyers generally profit from price movement
            : -0.05; // Sellers profit from premium decay
        const pnl = premium * pnlRatio;
        return pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    };

    const getPnLColor = (order: any) => {
        const premium = getPremiumNum(order);
        const pnlRatio = viewMode === 'buyer' ? 0.15 : -0.05;
        return (premium * pnlRatio) >= 0 ? 'text-emerald-500' : 'text-red-500';
    };

    // Order status constants matching contract enum
    const ORDER_STATUS = {
        RFQ_CREATED: 0,
        QUOTING: 1,
        MATCHED: 2,
        WAITING_INITIAL_FEED: 3,
        LIVE: 4,
        WAITING_FINAL_FEED: 5,
        PENDING_SETTLEMENT: 6,
        ARBITRATION: 7,
        SETTLED: 8,
        LIQUIDATED: 9,
        CANCELLED: 10
    };

    // Get status number from order (handles both number and string status)
    const getStatusNum = (order: any): number => {
        const status = order.status;
        if (typeof status === 'number') return status;
        if (typeof status === 'bigint') return Number(status);
        // Handle string status names
        const statusMap: Record<string, number> = {
            'RFQ_CREATED': 0, 'QUOTING': 1, 'MATCHED': 2, 'WAITING_INITIAL_FEED': 3,
            'LIVE': 4, 'WAITING_FINAL_FEED': 5, 'PENDING_SETTLEMENT': 6,
            'ARBITRATION': 7, 'SETTLED': 8, 'LIQUIDATED': 9, 'CANCELLED': 10
        };
        return statusMap[String(status).toUpperCase()] ?? -1;
    };

    // Get human-readable status label
    const getStatusLabel = (order: any): string => {
        const num = getStatusNum(order);
        const labels: Record<number, string> = {
            0: t('portfolio.status.rfq_created'),
            1: t('portfolio.status.quoting'),
            2: t('portfolio.status.matched'),
            3: t('portfolio.status.waiting_initial_feed'),
            4: t('portfolio.status.live'),
            5: t('portfolio.status.waiting_final_feed'),
            6: t('portfolio.status.pending_settlement'),
            7: t('portfolio.status.arbitration'),
            8: t('portfolio.status.settled'),
            9: t('portfolio.status.liquidated'),
            10: t('portfolio.status.cancelled')
        };
        return labels[num] || String(order.status).toUpperCase();
    };

    // ==================== T+X 行权条件检查 ====================

    /**
     * 计算 T+X 可行权时间
     * @param order 订单对象
     * @returns 可行权的时间戳（秒）
     */
    const getExerciseEnabledTime = (order: any): number => {
        const matchedAt = Number(order.matchedAt || 0);
        const exerciseDelay = Number(order.exerciseDelay || 0); // T+X 天数
        const DAY_SECONDS = 24 * 60 * 60;
        return matchedAt + (exerciseDelay * DAY_SECONDS);
    };

    /**
     * 检查 T+X 条件是否满足
     * @param order 订单对象
     * @returns true 如果可以行权
     */
    const isExerciseDelayMet = (order: any): boolean => {
        if (!order.matchedAt || Number(order.matchedAt) === 0) {
            return false; // 未成交的订单不能行权
        }
        const now = Math.floor(Date.now() / 1000);
        return now >= getExerciseEnabledTime(order);
    };

    /**
     * 获取 T+X 倒计时字符串
     * @param order 订单对象
     * @returns 倒计时字符串 或 "可行权"
     */
    const getTplusXCountdown = (order: any): string => {
        const exerciseEnabledTime = getExerciseEnabledTime(order);
        const now = Math.floor(Date.now() / 1000);

        if (now >= exerciseEnabledTime) {
            return t('portfolio.exercise_ready') || '可行权';
        }

        const remaining = exerciseEnabledTime - now;
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);

        if (days > 0) {
            return `T+${order.exerciseDelay || 0}: ${days}${t('common.days') || '天'} ${hours}${t('common.hours') || '时'}`;
        }
        return `T+${order.exerciseDelay || 0}: ${hours}${t('common.hours') || '时'} ${minutes}${t('common.minutes') || '分'}`;
    };

    // Check if action is available based on order status AND T+X condition
    const canExercise = (order: any) => {
        const isLive = getStatusNum(order) === ORDER_STATUS.LIVE;
        const tPlusXMet = isExerciseDelayMet(order);
        return isLive && tPlusXMet;
    };
    const canSettle = (order: any) => getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT;
    const canArbitrate = (order: any) => getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT;
    const canAddMargin = (order: any) => getStatusNum(order) === ORDER_STATUS.LIVE;
    const canWithdraw = (order: any) => getStatusNum(order) === ORDER_STATUS.LIVE;
    const canInitiateFeed = (order: any) => getStatusNum(order) === ORDER_STATUS.MATCHED;

    // Handle initiating initial feed for MATCHED orders
    const handleInitiateFeed = async (orderId: number) => {
        setInitFeedLoading(orderId);
        try {
            // FeedType.Initial = 0, FeedTier.Tier_5_3 = 0 (lowest tier for MVP)
            await requestFeed(orderId, 0, 0);
            showToast('success', t('portfolio.feed_requested'));
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Request feed failed';
            showToast('error', `${t('portfolio.initiate_feed')} 失败: ${message}`);
        } finally {
            setInitFeedLoading(null);
        }
    };

    // Handle action with user-friendly error
    const handleAction = async (action: () => Promise<any>, actionName: string) => {
        try {
            await action();
            showToast('success', `${actionName} 成功`);
            setRefreshKey(k => k + 1); // Refresh orders after action
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `${actionName} 失败: ${message}`);
        }
    };

    // Handle exercise with automatic final feed request
    const handleExerciseWithFeed = async (orderId: number | bigint) => {
        const orderIdNum = Number(orderId);
        try {
            // Step 1: Call earlyExercise
            showToast('info', t('portfolio.exercising') || '正在执行行权...');
            await earlyExercise(orderIdNum);
            showToast('success', t('portfolio.exercise_success') || '行权成功');

            // Step 2: Automatically create final feed request
            showToast('info', t('portfolio.requesting_final_feed') || '正在请求期末喂价...');
            await requestFeed(orderIdNum, 2, 0); // feedType=2 (Final: Initial=0, Dynamic=1, Final=2), tier=0
            showToast('success', t('portfolio.final_feed_requested') || '期末喂价请求已发起');

            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `Exercise 失败: ${message}`);
        }
    };

    // 打开保证金弹窗
    const openMarginModal = (orderId: number, type: 'add' | 'withdraw') => {
        setSelectedOrderId(orderId);
        setMarginModalType(type);
        setMarginAmount('');
        setMarginModalOpen(true);
    };

    // 提交保证金操作
    const handleMarginSubmit = async () => {
        if (!selectedOrderId || !marginAmount || parseFloat(marginAmount) <= 0) {
            showToast('error', '请输入有效金额');
            return;
        }
        try {
            if (marginModalType === 'add') {
                await addMargin(selectedOrderId, marginAmount);
                showToast('success', `成功追加 ${marginAmount} USDT 保证金`);
            } else {
                await withdrawExcessMargin(selectedOrderId, marginAmount);
                showToast('success', `成功提取 ${marginAmount} USDT`);
            }
            setMarginModalOpen(false);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `${marginModalType === 'add' ? '追加' : '提取'}保证金失败: ${message}`);
        }
    };

    // 打开仲裁弹窗
    const openArbitrationModal = (orderId: number) => {
        setArbitrationOrderId(orderId);
        setArbitrationModalOpen(true);
    };

    // 确认仲裁
    const handleArbitrationConfirm = async () => {
        if (!arbitrationOrderId) return;
        try {
            await initiateArbitration(arbitrationOrderId);
            showToast('success', '仲裁已发起，等待高级喂价员重新喂价');
            setArbitrationModalOpen(false);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `发起仲裁失败: ${message}`);
        }
    };

    // 发起动态保证金喂价
    const handleDynamicFeed = async (orderId: number) => {
        setDynamicFeedLoading(orderId);
        try {
            // feedType=1 (Dynamic), tier=0
            await requestFeed(orderId, 1, 0);
            showToast('success', '动态喂价请求已发起');
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `动态喂价失败: ${message}`);
        } finally {
            setDynamicFeedLoading(null);
        }
    };

    return (
        <div className="flex flex-col space-y-12 pb-24 animate-in fade-in duration-700">
            {/* Perspective Controller */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mt-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${viewMode === 'buyer' ? 'bg-blue-500 shadow-[0_0_15px_#3b82f6]' : 'bg-purple-500 shadow-[0_0_15px_#a855f7]'}`} />
                        <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${viewMode === 'buyer' ? 'text-blue-400' : 'text-purple-400'}`}>
                            {t('portfolio.active_strategies')}
                        </span>
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter italic">
                        {t('portfolio.portfolio_management')}
                    </h1>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {(() => {
                    // Helper to safely sum values that may be BigInt or Number
                    const safeSum = (orders: any[], field: string): number => {
                        return orders.reduce((acc, o) => {
                            const val = o[field];
                            if (typeof val === 'bigint') {
                                return acc + Number(formatUnits(val, 6));
                            } else if (typeof val === 'number') {
                                return acc + val;
                            }
                            return acc;
                        }, 0);
                    };

                    const stats = [
                        {
                            label: t('portfolio.active_exposure'),
                            value: `$${safeSum(activeOrders, 'notionalUSDT').toLocaleString()}`,
                            icon: '⚡'
                        },
                        {
                            label: t('portfolio.pending_orders'),
                            value: String(activeOrders.filter(o => o.status === 'Pending' || o.status === 0).length),
                            icon: '⏳',
                            color: 'text-amber-500'
                        },
                        {
                            label: t('portfolio.total_margin'),
                            value: `$${safeSum(activeOrders, 'marginAmount').toLocaleString()}`,
                            icon: '🔒',
                            color: 'text-blue-400'
                        },
                        {
                            label: t('portfolio.pnl_estimate'),
                            value: '+$4.2K',
                            icon: viewMode === 'buyer' ? '📈' : '💎',
                            color: 'text-emerald-500'
                        }
                    ];

                    return stats.map((stat, i) => (
                        <div key={i} className="obsidian-glass grid-bg p-8 flex flex-col group hover:border-white/20">
                            <div className="flex justify-between items-center mb-6">
                                <span className="section-label">{stat.label}</span>
                                <span className="text-xl">{stat.icon}</span>
                            </div>
                            <span className={`text-4xl font-black italic tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</span>
                        </div>
                    ));
                })()}
            </div>

            {/* Matrix Display */}
            <div className="flex flex-col space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">{t('portfolio.strategy_grid')}</h3>
                    <button onClick={() => setRefreshKey(k => k + 1)} className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all">{t('portfolio.reload_stream')}</button>
                </div>


                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="h-64 obsidian-glass animate-pulse bg-white/5 border-dashed" />
                    ) : activeOrders.length === 0 ? (
                        <div className="obsidian-glass p-24 text-center border-white/5">
                            <span className="text-white/10 font-black italic tracking-[0.5em]">No strategies active in current mode</span>
                        </div>
                    ) : (
                        activeOrders.map((order, i) => (
                            <div key={i} className={`obsidian-glass p-8 flex flex-col lg:flex-row lg:items-center gap-10 group relative overflow-hidden transition-all duration-500 border-l-4 ${viewMode === 'buyer' ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                                <div className="flex-1 space-y-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black border tracking-[0.2em] italic ${order.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                            {String(order.status).toUpperCase()}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-white/20">ORD_REF_{order.orderId}</span>
                                    </div>
                                    <div className="flex items-end gap-6">
                                        <h4 className="text-3xl font-black text-white italic tracking-tighter">{order.underlyingName}</h4>
                                        <span className={`text-xl font-black italic ${getDirectionStr(order.direction) === 'Call' ? 'text-emerald-500' : 'text-red-500'}`}>{getDirectionStr(order.direction).toUpperCase()}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.notional')}</span>
                                            <span className="text-sm font-black text-white italic tracking-tight">{formatAmount(order.notionalUSDT)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.strike')}</span>
                                            <span className="text-sm font-black text-white/60 italic tracking-tight">${order.refPrice}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.pnl')}</span>
                                            <span className={`text-sm font-black italic tracking-tight ${getPnLColor(order)}`}>{calculatePnL(order)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.expires_in')}</span>
                                            <span className="text-sm font-black text-amber-400 italic tracking-tight">{getExpiryCountdown(order.expiryTimestamp || 0)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap lg:flex-nowrap gap-4 relative z-10 items-center">
                                    {/* Status Badge */}
                                    <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${getStatusNum(order) === ORDER_STATUS.LIVE ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                        getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            getStatusNum(order) === ORDER_STATUS.MATCHED ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                'bg-white/10 text-white/60 border border-white/10'
                                        }`}>
                                        {getStatusLabel(order)}
                                    </span>

                                    {/* Initiate Feed button for MATCHED orders */}
                                    {canInitiateFeed(order) && (
                                        <button
                                            onClick={() => handleInitiateFeed(Number(order.orderId))}
                                            disabled={initFeedLoading === Number(order.orderId) || feedLoading}
                                            className="btn-gold min-w-[160px] h-12 text-[11px] tracking-widest"
                                        >
                                            {initFeedLoading === Number(order.orderId) ? t('portfolio.requesting') : t('portfolio.initiate_feed')}
                                        </button>
                                    )}

                                    {viewMode === 'buyer' ? (
                                        <>
                                            <button
                                                onClick={() => handleExerciseWithFeed(order.orderId)}
                                                disabled={!canExercise(order) || feedLoading}
                                                title={!canExercise(order)
                                                    ? (getStatusNum(order) === ORDER_STATUS.LIVE
                                                        ? `${getTplusXCountdown(order)}`
                                                        : t('portfolio.hint.need_live_status'))
                                                    : t('portfolio.hint.exercise_enabled') || '可提前行权'}
                                                className={`btn-buyer min-w-[140px] ${!canExercise(order) || feedLoading ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                {getStatusNum(order) === ORDER_STATUS.LIVE && !isExerciseDelayMet(order)
                                                    ? `⏳ ${getTplusXCountdown(order)}`
                                                    : 'EXERCISE'}
                                            </button>
                                            <button
                                                onClick={() => handleAction(() => settleOrder(order.orderId), 'Settle')}
                                                disabled={!canSettle(order)}
                                                title={!canSettle(order) ? t('portfolio.hint.need_pending_settlement') : ''}
                                                className={`btn-elite-secondary min-w-[140px] h-12 ${!canSettle(order) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                SETTLE
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => openMarginModal(order.orderId, 'add')}
                                                disabled={!canAddMargin(order)}
                                                title={!canAddMargin(order) ? t('portfolio.hint.need_live_status') : ''}
                                                className={`btn-seller min-w-[140px] ${!canAddMargin(order) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                ADD MARGIN
                                            </button>
                                            <button
                                                onClick={() => openMarginModal(order.orderId, 'withdraw')}
                                                disabled={!canWithdraw(order)}
                                                title={!canWithdraw(order) ? t('portfolio.hint.need_live_status') : ''}
                                                className={`btn-elite-secondary min-w-[140px] h-12 ${!canWithdraw(order) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                WITHDRAW
                                            </button>
                                            <button
                                                onClick={() => handleDynamicFeed(order.orderId)}
                                                disabled={!canAddMargin(order) || dynamicFeedLoading === order.orderId}
                                                title={!canAddMargin(order) ? t('portfolio.hint.need_live_status') : ''}
                                                className={`btn-elite-secondary min-w-[140px] h-12 ${!canAddMargin(order) ? 'opacity-30 cursor-not-allowed' : 'border-cyan-500/30 text-cyan-400 hover:border-cyan-500/50'}`}
                                            >
                                                {dynamicFeedLoading === order.orderId ? '...' : '⚡ DYNAMIC FEED'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => openArbitrationModal(order.orderId)}
                                        disabled={!canArbitrate(order)}
                                        title={!canArbitrate(order) ? t('portfolio.hint.need_pending_settlement') : ''}
                                        className={`btn-elite-secondary w-12 h-12 !p-0 ${!canArbitrate(order) ? 'opacity-10 cursor-not-allowed' : 'opacity-40 hover:opacity-100 hover:border-red-500/50'}`}
                                    >
                                        ⚠️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 保证金操作弹窗 */}
            {marginModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="obsidian-glass p-8 rounded-3xl border border-white/10 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-white mb-6">
                            {marginModalType === 'add' ? '追加保证金' : '提取保证金'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">金额 (USDT)</label>
                                <input
                                    type="number"
                                    value={marginAmount}
                                    onChange={(e) => setMarginAmount(e.target.value)}
                                    placeholder="输入金额..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setMarginModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleMarginSubmit}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${marginModalType === 'add' ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-gold-500 hover:bg-gold-600 text-black'}`}
                                >
                                    确认{marginModalType === 'add' ? '追加' : '提取'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 仲裁确认弹窗 */}
            {arbitrationModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="obsidian-glass p-8 rounded-3xl border border-red-500/20 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-2xl">⚠️</span>
                            <h3 className="text-xl font-black text-white">发起仲裁</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <p className="text-red-400 font-bold mb-2">您将支付 30 USDT 仲裁费用</p>
                                <p className="text-gray-400 text-sm">
                                    仲裁将指定高级喂价员重新喂价，结果一次定论，不可再次仲裁。
                                </p>
                            </div>

                            <div className="text-sm text-gray-500">
                                <p>• 仲裁费用不退还</p>
                                <p>• 如仲裁成功改变结果，您将获得 50% 仲裁费奖励</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setArbitrationModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleArbitrationConfirm}
                                    className="flex-1 py-3 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition-all"
                                >
                                    确认仲裁 (30U)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyOrders;
