import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOptions, useFeedProtocol } from '../hooks';
import { useWalletContext } from '../context/WalletContext';
import { formatUnits } from 'ethers';

interface Order {
    orderId: number;
    buyer: string;
    seller: string;
    underlyingName: string;
    underlyingCode: string;
    market: string;
    country: string;
    direction: 'Call' | 'Put';
    notionalUSDT: bigint;
    premiumRate: number;
    premiumAmount: bigint;
    expiryTimestamp: number;
    status: string;
    initialMargin: bigint;
    currentMargin: bigint;
    createdAt: number;
    matchedAt: number;
    // 新增：盈亏计算相关字段
    refPrice: string;         // 开仓参考价格
    lastFeedPrice: bigint;    // 最后一次喂价价格 (18位小数)
    // 新增：倒计时相关字段
    minMarginRate: number;    // 最低保证金率 (基点)
    marginCallDeadline: number; // 追保截止时间 (时间戳)
    arbitrationWindow: number;  // 仲裁窗口 (秒)
    settledAt: number;        // 结算时间 (时间戳)
}

const STATUS_MAP: { [key: number]: string } = {
    0: 'RFQ_CREATED',
    1: 'QUOTING',
    2: 'MATCHED',
    3: 'WAITING_INITIAL_FEED',
    4: 'LIVE',
    5: 'WAITING_FINAL_FEED',
    6: 'PENDING_SETTLEMENT',
    7: 'ARBITRATION',
    8: 'SETTLED',
    9: 'LIQUIDATED',
    10: 'CANCELLED',
};

const STATUS_ZH: { [key: string]: string } = {
    'RFQ_CREATED': '询价中',
    'QUOTING': '报价中',
    'MATCHED': '待匹配',
    'WAITING_INITIAL_FEED': '待期初喂价',
    'LIVE': '已激活',
    'WAITING_FINAL_FEED': '待期末喂价',
    'PENDING_SETTLEMENT': '待结算',
    'SETTLED': '已结算',
    'CANCELLED': '已取消',
    'LIQUIDATED': '已强平',
    'ARBITRATION': '仲裁中',
};

// Feed tier options
const FEED_TIERS = [
    { id: 0, name: '5-3档', desc: '5个喂价员，取中间3个', fee: '3 USDT' },
    { id: 1, name: '7-5档', desc: '7个喂价员，取中间5个', fee: '5 USDT' },
    { id: 2, name: '10-7档', desc: '10个喂价员，取中间7个', fee: '8 USDT' },
];

export function MyOrders() {
    const { account } = useWalletContext();
    const { getBuyerOrders, getSellerOrders, getOrder, isConnected, addMargin, withdrawExcessMargin, earlyExercise, settleOrder, initiateArbitration, loading: optionsLoading } = useOptions();
    const { requestFeed, isLoading: feedLoading, error: feedError } = useFeedProtocol();

    const [viewMode, setViewMode] = useState<'buyer' | 'seller'>('buyer');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
    const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // Feed modal state
    const [showFeedModal, setShowFeedModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [selectedTier, setSelectedTier] = useState(0);
    const [selectedFeedType, setSelectedFeedType] = useState(0); // 0: Initial, 1: Dynamic, 2: Settlement

    // Margin modal state
    const [showMarginModal, setShowMarginModal] = useState(false);
    const [marginAction, setMarginAction] = useState<'add' | 'withdraw'>('add');
    const [marginAmount, setMarginAmount] = useState('');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const statusFilters = [
        { id: 'ALL', label: '全部订单' },
        { id: 'WAITING_INITIAL_FEED', label: '待期初喂价' },
        { id: 'LIVE', label: '运行中' },
        { id: 'WAITING_FINAL_FEED', label: '待期末喂价' },
        { id: 'PENDING_SETTLEMENT', label: '待结算' },
        { id: 'SETTLED', label: '已结算' }
    ];

    useEffect(() => {
        const fetchOrders = async () => {
            if (!isConnected || !account) { setLoading(false); return; }
            setLoading(true);
            try {
                const buyerIds = await getBuyerOrders();
                const bData: Order[] = [];
                for (const id of buyerIds) {
                    try {
                        const o = await getOrder(id);
                        bData.push({
                            orderId: Number(o.orderId),
                            buyer: o.buyer,
                            seller: o.seller,
                            underlyingName: o.underlyingName,
                            underlyingCode: o.underlyingCode,
                            market: o.market,
                            country: o.country,
                            direction: Number(o.direction) === 0 ? 'Call' : 'Put',
                            notionalUSDT: o.notionalUSDT,
                            premiumRate: Number(o.premiumRate),
                            premiumAmount: o.premiumAmount,
                            expiryTimestamp: Number(o.expiryTimestamp),
                            status: STATUS_MAP[Number(o.status)] || 'UNKNOWN',
                            initialMargin: o.initialMargin,
                            currentMargin: o.currentMargin,
                            createdAt: Number(o.createdAt),
                            matchedAt: Number(o.matchedAt),
                            refPrice: o.refPrice || '0',
                            lastFeedPrice: o.lastFeedPrice || 0n,
                            minMarginRate: Number(o.minMarginRate || 0),
                            marginCallDeadline: Number(o.marginCallDeadline || 0),
                            arbitrationWindow: Number(o.arbitrationWindow || 0),
                            settledAt: Number(o.settledAt || 0),
                        });
                    } catch { /* Skip */ }
                }
                setBuyerOrders(bData);

                const sellerIds = await getSellerOrders();
                const sData: Order[] = [];
                for (const id of sellerIds) {
                    try {
                        const o = await getOrder(id);
                        sData.push({
                            orderId: Number(o.orderId),
                            buyer: o.buyer,
                            seller: o.seller,
                            underlyingName: o.underlyingName,
                            underlyingCode: o.underlyingCode,
                            market: o.market,
                            country: o.country,
                            direction: Number(o.direction) === 0 ? 'Call' : 'Put',
                            notionalUSDT: o.notionalUSDT,
                            premiumRate: Number(o.premiumRate),
                            premiumAmount: o.premiumAmount,
                            expiryTimestamp: Number(o.expiryTimestamp),
                            status: STATUS_MAP[Number(o.status)] || 'UNKNOWN',
                            initialMargin: o.initialMargin,
                            currentMargin: o.currentMargin,
                            createdAt: Number(o.createdAt),
                            matchedAt: Number(o.matchedAt),
                            refPrice: o.refPrice || '0',
                            lastFeedPrice: o.lastFeedPrice || 0n,
                            minMarginRate: Number(o.minMarginRate || 0),
                            marginCallDeadline: Number(o.marginCallDeadline || 0),
                            arbitrationWindow: Number(o.arbitrationWindow || 0),
                            settledAt: Number(o.settledAt || 0),
                        });
                    } catch { /* Skip */ }
                }
                setSellerOrders(sData);
            } finally { setLoading(false); }
        };
        fetchOrders();
    }, [isConnected, account, getBuyerOrders, getSellerOrders, getOrder, refreshKey]);

    const formatAmount = (val: bigint) => {
        const num = Number(formatUnits(val, 6));
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
    };

    /**
     * 解析价格字符串为数字
     * @param priceStr 如 "842.15" 或 "100000"
     */
    const parsePriceString = (priceStr: string): number => {
        if (!priceStr || priceStr === '0') return 0;
        const cleaned = priceStr.replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
    };

    /**
     * 格式化倒计时显示
     * @param seconds 剩余秒数
     * @returns 格式化字符串如 "2h 30m" 或 "已过期"
     */
    const formatCountdown = (seconds: number): { text: string; isUrgent: boolean; isExpired: boolean } => {
        if (seconds <= 0) {
            return { text: '已过期', isUrgent: false, isExpired: true };
        }
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const isUrgent = seconds < 7200; // 2小时内为紧急

        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return { text: `${days}天 ${hours % 24}h`, isUrgent: false, isExpired: false };
        }
        if (hours > 0) {
            return { text: `${hours}h ${mins}m`, isUrgent, isExpired: false };
        }
        return { text: `${mins}分钟`, isUrgent: true, isExpired: false };
    };

    /**
     * 计算追保截止时间剩余秒数
     */
    const getMarginCallRemaining = (order: Order): number => {
        if (!order.marginCallDeadline || order.marginCallDeadline === 0) return -1; // 无追保
        const now = Math.floor(Date.now() / 1000);
        return order.marginCallDeadline - now;
    };

    /**
     * 计算仲裁窗口剩余秒数
     */
    const getArbitrationRemaining = (order: Order): number => {
        if (!order.settledAt || order.settledAt === 0) return -1;
        if (!order.arbitrationWindow) return -1;
        const now = Math.floor(Date.now() / 1000);
        const deadline = order.settledAt + order.arbitrationWindow;
        return deadline - now;
    };

    /**
     * 检查保证金状态
     * @returns 'safe' | 'warning' | 'danger'
     */
    const getMarginStatus = (order: Order): 'safe' | 'warning' | 'danger' => {
        if (!order.minMarginRate || order.minMarginRate === 0) return 'safe';
        const notional = Number(formatUnits(order.notionalUSDT, 6));
        const current = Number(formatUnits(order.currentMargin, 6));
        const minRequired = (notional * order.minMarginRate) / 10000;

        if (current < minRequired) return 'danger';
        if (current < minRequired * 1.2) return 'warning'; // 低于120%时警告
        return 'safe';
    };

    /**
     * 计算买方盈亏
     * 看涨期权: buyerProfit = max(0, 最终价 - 开仓价) * 名义本金 / 开仓价
     * 看跌期权: buyerProfit = max(0, 开仓价 - 最终价) * 名义本金 / 开仓价
     */
    const calculatePnL = (order: Order, isBuyer: boolean): { pnl: number; pnlPercent: number; isProfit: boolean } => {
        const strikePrice = parsePriceString(order.refPrice);
        // lastFeedPrice 是 18 位小数格式
        const currentPrice = order.lastFeedPrice > 0n
            ? Number(formatUnits(order.lastFeedPrice, 18))
            : 0;
        const notional = Number(formatUnits(order.notionalUSDT, 6));

        if (strikePrice === 0 || currentPrice === 0) {
            return { pnl: 0, pnlPercent: 0, isProfit: true };
        }

        let buyerProfit = 0;
        if (order.direction === 'Call') {
            // 看涨期权：买方盈利 = max(0, 最终价 - 开仓价) * 名义本金 / 开仓价
            if (currentPrice > strikePrice) {
                buyerProfit = (currentPrice - strikePrice) * notional / strikePrice;
            }
        } else {
            // 看跌期权：买方盈利 = max(0, 开仓价 - 最终价) * 名义本金 / 开仓价
            if (strikePrice > currentPrice) {
                buyerProfit = (strikePrice - currentPrice) * notional / strikePrice;
            }
        }

        // 买方盈利受卖方保证金限制
        const currentMargin = Number(formatUnits(order.currentMargin, 6));
        const cappedBuyerProfit = Math.min(buyerProfit, currentMargin);

        // 卖方盈亏与买方相反 (受保证金限制)
        const pnl = isBuyer ? cappedBuyerProfit : -cappedBuyerProfit;
        const pnlPercent = notional > 0 ? (Math.abs(pnl) / notional) * 100 : 0;

        return {
            pnl,
            pnlPercent,
            isProfit: pnl >= 0
        };
    };

    // Handle request feed
    const handleRequestFeed = async () => {
        if (!selectedOrder) return;
        try {
            await requestFeed(selectedOrder.orderId, selectedFeedType, selectedTier);
            setShowFeedModal(false);
            setSelectedOrder(null);
            setRefreshKey(k => k + 1);
        } catch (e) {
            console.error('Failed to request feed:', e);
        }
    };

    // Open feed modal
    const openFeedModal = (order: Order, feedType: number) => {
        setSelectedOrder(order);
        setSelectedFeedType(feedType);
        setShowFeedModal(true);
    };

    // Open margin modal
    const openMarginModal = (order: Order, action: 'add' | 'withdraw') => {
        setSelectedOrder(order);
        setMarginAction(action);
        setMarginAmount('');
        setShowMarginModal(true);
    };

    // Handle margin action
    const handleMarginAction = async () => {
        if (!selectedOrder || !marginAmount) return;
        try {
            if (marginAction === 'add') {
                await addMargin(selectedOrder.orderId, marginAmount);
            } else {
                await withdrawExcessMargin(selectedOrder.orderId, marginAmount);
            }
            setShowMarginModal(false);
            setSelectedOrder(null);
            setMarginAmount('');
            setRefreshKey(k => k + 1);
        } catch (e) {
            console.error(`Failed to ${marginAction} margin:`, e);
        }
    };

    // Calculate excess margin (currentMargin - initialMargin)
    const getExcessMargin = (order: Order): bigint => {
        if (order.currentMargin > order.initialMargin) {
            return order.currentMargin - order.initialMargin;
        }
        return 0n;
    };

    // Handle early exercise (buyer action)
    const handleEarlyExercise = async (order: Order) => {
        if (!confirm(`确认对订单 #${order.orderId} 发起提前行权？\n\n这将触发期末喂价流程，喂价完成后进行结算。`)) {
            return;
        }
        try {
            await earlyExercise(order.orderId);
            setRefreshKey(k => k + 1);
        } catch (e) {
            console.error('Failed to early exercise:', e);
            alert('提前行权失败: ' + (e instanceof Error ? e.message : '未知错误'));
        }
    };

    // Handle settlement
    const handleSettle = async (order: Order) => {
        if (!confirm(`确认结算订单 #${order.orderId}？\n\n结算将根据最终喂价价格计算盈亏并分配资金。`)) {
            return;
        }
        try {
            await settleOrder(order.orderId);
            setRefreshKey(k => k + 1);
        } catch (e) {
            console.error('Failed to settle:', e);
            alert('结算失败: ' + (e instanceof Error ? e.message : '未知错误'));
        }
    };

    // Handle arbitration initiation
    const handleArbitration = async (order: Order) => {
        if (!confirm(`确认对订单 #${order.orderId} 发起仲裁？\n\n仲裁费用：30 USDT\n仲裁为一次定论，不可再次发起。`)) {
            return;
        }
        try {
            await initiateArbitration(order.orderId);
            setRefreshKey(k => k + 1);
            alert('仲裁已发起，等待仲裁员处理。');
        } catch (e) {
            console.error('Failed to initiate arbitration:', e);
            alert('仲裁发起失败: ' + (e instanceof Error ? e.message : '未知错误'));
        }
    };

    const rawOrders = viewMode === 'buyer' ? buyerOrders : sellerOrders;
    // 应用状态筛选和搜索过滤
    const filteredOrders = rawOrders.filter(o => {
        // 状态筛选
        if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
        // 搜索过滤 (标的名称、代码、订单ID)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = o.underlyingName.toLowerCase().includes(query);
            const matchCode = o.underlyingCode.toLowerCase().includes(query);
            const matchId = o.orderId.toString().includes(query);
            if (!matchName && !matchCode && !matchId) return false;
        }
        return true;
    });

    // 分页计算
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    const orders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // 重置页码当筛选条件变化时
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, searchQuery, viewMode]);

    return (
        <div className="max-w-[1400px] mx-auto pt-16 pb-20 animate-elite-entry">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-24">
                <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-label text-emerald-500/80">个人资产与仓位看板</span>
                    </div>
                    <h1 className="text-6xl font-extrabold text-white tracking-tighter italic">我的订单 <span className="text-emerald-500">My Orders</span></h1>
                    <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed">
                        实时管理您的合约头寸，监控市场风险，并获取持仓对应的权利金与收益明细。
                    </p>
                </div>

                <div className="bg-slate-900 border border-white/[0.08] p-2 rounded-2xl flex">
                    <button onClick={() => setViewMode('buyer')} className={`px-10 py-3 rounded-xl text-[12px] font-black uppercase transition-all ${viewMode === 'buyer' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        买方视图 (Buyer)
                    </button>
                    <button onClick={() => setViewMode('seller')} className={`px-10 py-3 rounded-xl text-[12px] font-black uppercase transition-all ${viewMode === 'seller' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        卖方视图 (Seller)
                    </button>
                </div>
            </div>

            <div className="space-y-24">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { label: '活跃仓位数量', value: orders.filter(o => ['LIVE', 'MATCHED'].includes(o.status)).length },
                        { label: '待喂价订单', value: orders.filter(o => o.status === 'MATCHED').length, highlight: true },
                        { label: '当前总敞口', value: formatAmount(orders.reduce((s, o) => s + o.notionalUSDT, 0n)) },
                        { label: '累计结算', value: orders.filter(o => o.status === 'SETTLED').length },
                    ].map((stat, i) => (
                        <div key={i} className={`glass-surface p-8 rounded-[40px] border-white/5 shadow-sm ${stat.highlight ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
                            <p className="text-label mb-4 opacity-50">{stat.label}</p>
                            <p className={`text-3xl font-bold tracking-tight italic ${stat.highlight ? 'text-amber-400' : 'text-white'}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Filter & List */}
                <div className="space-y-12">
                    <div className="flex flex-col md:flex-row items-center justify-between pb-10 border-b border-white/[0.05] gap-8">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-white/[0.08]">
                            {statusFilters.map(f => (
                                <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${statusFilter === f.id ? 'bg-white/10 text-white shadow-sm' : 'text-slate-600 hover:text-slate-300'}`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        {/* 搜索框 */}
                        <div className="relative flex-1 max-w-xs">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索标的或订单ID..."
                                className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <Link to="/create-rfq" className="btn-elite-primary px-8 h-12 text-[11px] rounded-xl tracking-widest">
                            建立新仓位 OPEN POSITION
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {loading ? (
                            <div className="py-40 flex flex-col items-center space-y-4">
                                <div className="w-10 h-10 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                                <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">正在拉取链上快照...</p>
                            </div>
                        ) : orders.map((order) => (
                            <div key={order.orderId} className="group glass-surface p-10 rounded-[48px] hover:border-emerald-500/20 transition-all relative overflow-hidden border-white/[0.03]">
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12">
                                    <div className="flex items-center space-x-8 min-w-[320px]">
                                        <div className="w-16 h-16 rounded-[24px] bg-slate-950 border border-white/5 flex items-center justify-center text-4xl shadow-inner group-hover:scale-105 transition-transform duration-700">
                                            {order.market === 'Crypto' ? '₿' : '🇺🇸'}
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-4 mb-2.5">
                                                <h3 className="text-2xl font-bold text-white tracking-tight italic">{order.underlyingName}</h3>
                                                <span className="text-[10px] font-black text-slate-500 bg-white/5 px-2.5 py-1 rounded-full tracking-widest uppercase border border-white/5">{order.underlyingCode}</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.1em] flex items-center gap-2">
                                                <span className="opacity-40">仓位 ID-0x{order.orderId}</span>
                                                <span>•</span>
                                                <span className={order.direction === 'Call' ? 'text-emerald-400' : 'text-rose-400'}>{order.direction === 'Call' ? '看涨认购' : '看跌认沽'}期权</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8 flex-1 border-x border-white/[0.03] px-12">
                                        <div>
                                            <p className="text-label mb-2">名义本金</p>
                                            <p className="text-xl font-bold text-white italic tracking-tighter truncate max-w-[150px]">{formatAmount(order.notionalUSDT)}</p>
                                        </div>
                                        <div>
                                            <p className="text-label mb-2">费率</p>
                                            <p className="text-xl font-bold text-emerald-500 italic tracking-tighter">{(order.premiumRate / 100).toFixed(2)}%</p>
                                        </div>
                                        {/* 盈亏显示 - 仅 LIVE 状态 */}
                                        {order.status === 'LIVE' ? (() => {
                                            const { pnl, pnlPercent, isProfit } = calculatePnL(order, viewMode === 'buyer');
                                            const hasPrice = order.lastFeedPrice > 0n;
                                            return (
                                                <div>
                                                    <p className="text-label mb-2">浮动盈亏</p>
                                                    {hasPrice ? (
                                                        <div className="flex items-baseline gap-2">
                                                            <p className={`text-xl font-bold italic tracking-tighter ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {isProfit ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                            </p>
                                                            <span className={`text-[10px] font-bold ${isProfit ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                                                                ({pnlPercent.toFixed(2)}%)
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-500 text-sm italic">待喂价更新</p>
                                                    )}
                                                </div>
                                            );
                                        })() : (
                                            <div>
                                                <p className="text-label mb-2">保证金</p>
                                                <p className="text-xl font-bold text-white italic tracking-tighter">{formatAmount(order.currentMargin)}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-label mb-2">状态</p>
                                            <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${order.status === 'MATCHED'
                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                : order.status === 'LIVE'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-white/5 text-slate-400 border-white/[0.05]'
                                                }`}>
                                                {STATUS_ZH[order.status] || order.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-end">
                                            {/* Action buttons based on status */}
                                            {order.status === 'MATCHED' && (
                                                <button
                                                    onClick={() => openFeedModal(order, 0)}
                                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all"
                                                >
                                                    发起期初喂价
                                                </button>
                                            )}
                                            {order.status === 'LIVE' && (
                                                <div className="flex gap-3 flex-wrap">
                                                    <button
                                                        onClick={() => openFeedModal(order, 1)}
                                                        className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-blue-500/20"
                                                    >
                                                        动态喂价
                                                    </button>
                                                    <button
                                                        onClick={() => openFeedModal(order, 2)}
                                                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider"
                                                    >
                                                        平仓喂价
                                                    </button>
                                                    {/* 卖方视图显示保证金管理按钮 */}
                                                    {viewMode === 'seller' && (
                                                        <>
                                                            <button
                                                                onClick={() => openMarginModal(order, 'add')}
                                                                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-amber-500/20"
                                                            >
                                                                追加保证金
                                                            </button>
                                                            {getExcessMargin(order) > 0n && (
                                                                <button
                                                                    onClick={() => openMarginModal(order, 'withdraw')}
                                                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-white/10"
                                                                >
                                                                    提取超额
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    {/* 买方视图显示提前行权按钮 */}
                                                    {viewMode === 'buyer' && (
                                                        <button
                                                            onClick={() => handleEarlyExercise(order)}
                                                            disabled={optionsLoading}
                                                            className="bg-rose-500 hover:bg-rose-400 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider disabled:opacity-50 shadow-lg shadow-rose-500/20"
                                                        >
                                                            提前行权
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {/* PENDING_SETTLEMENT 状态显示结算和仲裁按钮 */}
                                            {order.status === 'PENDING_SETTLEMENT' && (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleSettle(order)}
                                                        disabled={optionsLoading}
                                                        className="bg-purple-500 hover:bg-purple-400 text-white px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                                    >
                                                        确认结算
                                                    </button>
                                                    <button
                                                        onClick={() => handleArbitration(order)}
                                                        disabled={optionsLoading}
                                                        className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-rose-500/20 disabled:opacity-50"
                                                    >
                                                        发起仲裁 (30U)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 警告标签区域 - 显示保证金状态、倒计时等 */}
                                    {(order.status === 'LIVE' || order.status === 'PENDING_SETTLEMENT') && (
                                        <div className="mt-6 pt-4 border-t border-white/[0.03] flex flex-wrap gap-3">
                                            {/* 卖方保证金状态警告 */}
                                            {viewMode === 'seller' && order.status === 'LIVE' && (() => {
                                                const marginStatus = getMarginStatus(order);
                                                if (marginStatus === 'danger') {
                                                    return (
                                                        <span className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                                            ⚠️ 保证金不足
                                                        </span>
                                                    );
                                                }
                                                if (marginStatus === 'warning') {
                                                    return (
                                                        <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                                            ⚡ 保证金偏低
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {/* 追保倒计时 - 卖方 LIVE 订单 */}
                                            {viewMode === 'seller' && order.status === 'LIVE' && (() => {
                                                const remaining = getMarginCallRemaining(order);
                                                if (remaining < 0) return null; // 无追保
                                                const { text, isUrgent, isExpired } = formatCountdown(remaining);
                                                if (isExpired) {
                                                    return (
                                                        <span className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                                                            🕐 追保已超时
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isUrgent
                                                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                                                        : 'bg-slate-700/50 border border-white/10 text-slate-400'
                                                        }`}>
                                                        🕐 追保截止: {text}
                                                    </span>
                                                );
                                            })()}

                                            {/* 仲裁窗口倒计时 - PENDING_SETTLEMENT 订单 */}
                                            {order.status === 'PENDING_SETTLEMENT' && (() => {
                                                const remaining = getArbitrationRemaining(order);
                                                if (remaining < 0) return null;
                                                const { text, isUrgent, isExpired } = formatCountdown(remaining);
                                                if (isExpired) {
                                                    return (
                                                        <span className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                            仲裁窗口已关闭
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isUrgent
                                                        ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                                                        : 'bg-slate-700/50 border border-white/10 text-slate-400'
                                                        }`}>
                                                        ⏱️ 仲裁窗口: {text}
                                                    </span>
                                                );
                                            })()}

                                            {/* 到期时间显示 */}
                                            {order.status === 'LIVE' && (() => {
                                                const now = Math.floor(Date.now() / 1000);
                                                const remaining = order.expiryTimestamp - now;
                                                if (remaining <= 0) return null;
                                                const { text, isUrgent } = formatCountdown(remaining);
                                                return (
                                                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isUrgent
                                                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                                                        : 'bg-slate-700/50 border border-white/10 text-slate-400'
                                                        }`}>
                                                        📅 到期: {text}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {orders.length === 0 && !loading && (
                            <div className="py-40 text-center opacity-30 italic text-slate-500 font-bold uppercase tracking-widest text-[13px] border-2 border-dashed border-white/5 rounded-[40px]">
                                历史记录中未发现符合条件的持仓
                            </div>
                        )}

                        {/* 分页组件 */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-10 pt-10 border-t border-white/[0.05]">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-800 border border-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    ← 上一页
                                </button>
                                <div className="flex items-center gap-2">
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        const page = totalPages <= 5 ? i + 1 :
                                            currentPage <= 3 ? i + 1 :
                                                currentPage >= totalPages - 2 ? totalPages - 4 + i :
                                                    currentPage - 2 + i;
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-10 h-10 rounded-xl text-[12px] font-bold transition-all ${currentPage === page
                                                    ? 'bg-emerald-500 text-slate-950'
                                                    : 'bg-slate-800 border border-white/[0.08] text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-800 border border-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    下一页 →
                                </button>
                                <span className="ml-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    {filteredOrders.length} 条订单
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Feed Request Modal */}
            {showFeedModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="glass-surface p-12 rounded-[40px] w-full max-w-lg animate-elite-entry">
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {selectedFeedType === 0 ? '发起期初喂价' : selectedFeedType === 1 ? '发起动态喂价' : '发起平仓喂价'}
                        </h2>
                        <p className="text-slate-500 mb-8">
                            {selectedOrder.underlyingName} ({selectedOrder.underlyingCode}) · 订单 #{selectedOrder.orderId}
                        </p>

                        <div className="space-y-6">
                            {/* Tier Selection */}
                            <div>
                                <label className="text-label mb-4 block">选择喂价档位</label>
                                <div className="space-y-3">
                                    {FEED_TIERS.map(tier => (
                                        <button
                                            key={tier.id}
                                            onClick={() => setSelectedTier(tier.id)}
                                            className={`w-full p-4 rounded-xl border text-left transition-all ${selectedTier === tier.id
                                                ? 'bg-amber-500/10 border-amber-500/30'
                                                : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className={`font-bold ${selectedTier === tier.id ? 'text-amber-400' : 'text-white'}`}>
                                                        {tier.name}
                                                    </p>
                                                    <p className="text-slate-500 text-sm">{tier.desc}</p>
                                                </div>
                                                <span className={`font-bold ${selectedTier === tier.id ? 'text-amber-400' : 'text-slate-400'}`}>
                                                    {tier.fee}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fee Info */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">喂价费用</span>
                                    <span className="text-white font-bold">{FEED_TIERS[selectedTier].fee}</span>
                                </div>
                                <p className="text-slate-500 text-xs mt-2">
                                    喂价费用将从您的 USDT 余额中扣除，用于支付喂价员报酬
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex space-x-4 pt-4">
                                <button
                                    onClick={() => {
                                        setShowFeedModal(false);
                                        setSelectedOrder(null);
                                    }}
                                    className="flex-1 h-14 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleRequestFeed}
                                    disabled={feedLoading}
                                    className="flex-1 h-14 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-50 hover:bg-amber-400 transition-all"
                                >
                                    {feedLoading ? '处理中...' : '确认发起喂价'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error display */}
            {feedError && (
                <div className="fixed bottom-8 right-8 bg-red-500/20 border border-red-500/30 rounded-xl px-6 py-4 text-red-400">
                    {feedError}
                </div>
            )}

            {/* Margin Management Modal */}
            {showMarginModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="glass-surface p-12 rounded-[40px] w-full max-w-lg animate-elite-entry">
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {marginAction === 'add' ? '追加保证金' : '提取超额保证金'}
                        </h2>
                        <p className="text-slate-500 mb-8">
                            {selectedOrder.underlyingName} ({selectedOrder.underlyingCode}) · 订单 #{selectedOrder.orderId}
                        </p>

                        <div className="space-y-6">
                            {/* Current Margin Info */}
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">初始保证金</span>
                                    <span className="text-white font-bold">{formatAmount(selectedOrder.initialMargin)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">当前保证金</span>
                                    <span className="text-emerald-400 font-bold">{formatAmount(selectedOrder.currentMargin)}</span>
                                </div>
                                {marginAction === 'withdraw' && (
                                    <div className="flex justify-between text-sm border-t border-white/10 pt-3">
                                        <span className="text-slate-400">可提取超额</span>
                                        <span className="text-amber-400 font-bold">{formatAmount(getExcessMargin(selectedOrder))}</span>
                                    </div>
                                )}
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label className="text-label mb-2 block">
                                    {marginAction === 'add' ? '追加金额 (USDT)' : '提取金额 (USDT)'}
                                </label>
                                <input
                                    type="number"
                                    value={marginAmount}
                                    onChange={(e) => setMarginAmount(e.target.value)}
                                    placeholder="输入金额"
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex space-x-4 pt-4">
                                <button
                                    onClick={() => {
                                        setShowMarginModal(false);
                                        setSelectedOrder(null);
                                        setMarginAmount('');
                                    }}
                                    className="flex-1 h-14 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleMarginAction}
                                    disabled={optionsLoading || !marginAmount}
                                    className={`flex-1 h-14 rounded-xl font-bold disabled:opacity-50 transition-all ${marginAction === 'add'
                                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                        }`}
                                >
                                    {optionsLoading ? '处理中...' : marginAction === 'add' ? '确认追加' : '确认提取'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-32" />
        </div>
    );
}

export default MyOrders;
