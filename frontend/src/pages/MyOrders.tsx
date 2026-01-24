import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOptions } from '../hooks';
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
    'MATCHED': '已撮合',
    'LIVE': '已激活',
    'SETTLED': '已结算',
    'CANCELLED': '已取消',
    'LIQUIDATED': '已强平',
    'ARBITRATION': '仲裁中',
};

export function MyOrders() {
    const { account } = useWalletContext();
    const { getBuyerOrders, getSellerOrders, getOrder, isConnected } = useOptions();
    const [viewMode, setViewMode] = useState<'buyer' | 'seller'>('buyer');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
    const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const statusFilters = [
        { id: 'ALL', label: '全部订单' },
        { id: 'LIVE', label: '运行中' },
        { id: 'MATCHED', label: '已撮合' },
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
    }, [isConnected, account, getBuyerOrders, getSellerOrders, getOrder]);

    const formatAmount = (val: bigint) => {
        const num = Number(formatUnits(val, 6));
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
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
                        { label: '当前总敞口', value: formatAmount(orders.reduce((s, o) => s + o.notionalUSDT, 0n)) },
                        { label: '系统利用率', value: '84.2%' },
                        { label: '预期收益影响', value: '$12,400' },
                    ].map((stat, i) => (
                        <div key={i} className="glass-surface p-8 rounded-[40px] border-white/5 shadow-sm">
                            <p className="text-label mb-4 opacity-50">{stat.label}</p>
                            <p className="text-3xl font-bold text-white tracking-tight italic">{stat.value}</p>
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

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-16 flex-1 border-x border-white/[0.03] px-16">
                                        <div>
                                            <p className="text-label mb-2">名义本金 Exposure</p>
                                            <p className="text-xl font-bold text-white italic tracking-tighter truncate max-w-[150px]">{formatAmount(order.notionalUSDT)}</p>
                                        </div>
                                        <div>
                                            <p className="text-label mb-2">合约费率 Premium</p>
                                            <p className="text-xl font-bold text-emerald-500 italic tracking-tighter">{(order.premiumRate / 100).toFixed(2)}%</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-label mb-2">实时状态</p>
                                            <span className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-400 border border-white/[0.05]">
                                                {STATUS_ZH[order.status] || order.status}
                                            </span>
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
            <div className="h-32" />
        </div>
    );
}

export default MyOrders;
