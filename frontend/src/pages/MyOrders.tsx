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
}

const STATUS_MAP: { [key: number]: string } = {
    0: 'RFQ_CREATED',
    1: 'QUOTING',
    2: 'MATCHED',
    3: 'LIVE',
    4: 'PENDING_SETTLEMENT',
    5: 'SETTLED',
    6: 'CANCELLED',
    7: 'LIQUIDATED',
    8: 'ARBITRATION',
};

const STATUS_ZH: { [key: string]: string } = {
    'RFQ_CREATED': '询价中',
    'QUOTING': '报价中',
    'MATCHED': '待喂价',
    'LIVE': '已激活',
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
    const { getBuyerOrders, getSellerOrders, getOrder, isConnected } = useOptions();
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

    const statusFilters = [
        { id: 'ALL', label: '全部订单' },
        { id: 'MATCHED', label: '待喂价' },
        { id: 'LIVE', label: '运行中' },
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

    const rawOrders = viewMode === 'buyer' ? buyerOrders : sellerOrders;
    const orders = statusFilter === 'ALL' ? rawOrders : rawOrders.filter(o => o.status === statusFilter);

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

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 flex-1 border-x border-white/[0.03] px-12">
                                        <div>
                                            <p className="text-label mb-2">名义本金</p>
                                            <p className="text-xl font-bold text-white italic tracking-tighter truncate max-w-[150px]">{formatAmount(order.notionalUSDT)}</p>
                                        </div>
                                        <div>
                                            <p className="text-label mb-2">费率</p>
                                            <p className="text-xl font-bold text-emerald-500 italic tracking-tighter">{(order.premiumRate / 100).toFixed(2)}%</p>
                                        </div>
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
                                                <div className="flex gap-3">
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
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {orders.length === 0 && !loading && (
                            <div className="py-40 text-center opacity-30 italic text-slate-500 font-bold uppercase tracking-widest text-[13px] border-2 border-dashed border-white/5 rounded-[40px]">
                                历史记录中未发现符合条件的持仓
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

            <div className="h-32" />
        </div>
    );
}

export default MyOrders;
