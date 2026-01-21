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

export function MyOrders() {
    const { account } = useWalletContext();
    const { getBuyerOrders, getSellerOrders, getOrder, isConnected } = useOptions();
    const [viewMode, setViewMode] = useState<'buyer' | 'seller'>('buyer');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
    const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const statusFilters = ['ALL', 'LIVE', 'MATCHED', 'SETTLED', 'CANCELLED'];

    // Fetch orders from blockchain
    useEffect(() => {
        const fetchOrders = async () => {
            if (!isConnected || !account) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Fetch buyer orders
                const buyerIds = await getBuyerOrders();
                const buyerOrdersData: Order[] = [];
                for (const id of buyerIds) {
                    try {
                        const order = await getOrder(id);
                        buyerOrdersData.push({
                            orderId: Number(order.orderId),
                            buyer: order.buyer,
                            seller: order.seller,
                            underlyingName: order.underlyingName,
                            underlyingCode: order.underlyingCode,
                            market: order.market,
                            country: order.country,
                            direction: Number(order.direction) === 0 ? 'Call' : 'Put',
                            notionalUSDT: order.notionalUSDT,
                            premiumRate: Number(order.premiumRate),
                            premiumAmount: order.premiumAmount,
                            expiryTimestamp: Number(order.expiryTimestamp),
                            status: STATUS_MAP[Number(order.status)] || 'UNKNOWN',
                            initialMargin: order.initialMargin,
                            currentMargin: order.currentMargin,
                            createdAt: Number(order.createdAt),
                            matchedAt: Number(order.matchedAt),
                        });
                    } catch {
                        // Skip invalid orders
                    }
                }
                setBuyerOrders(buyerOrdersData);

                // Fetch seller orders
                const sellerIds = await getSellerOrders();
                const sellerOrdersData: Order[] = [];
                for (const id of sellerIds) {
                    try {
                        const order = await getOrder(id);
                        sellerOrdersData.push({
                            orderId: Number(order.orderId),
                            buyer: order.buyer,
                            seller: order.seller,
                            underlyingName: order.underlyingName,
                            underlyingCode: order.underlyingCode,
                            market: order.market,
                            country: order.country,
                            direction: Number(order.direction) === 0 ? 'Call' : 'Put',
                            notionalUSDT: order.notionalUSDT,
                            premiumRate: Number(order.premiumRate),
                            premiumAmount: order.premiumAmount,
                            expiryTimestamp: Number(order.expiryTimestamp),
                            status: STATUS_MAP[Number(order.status)] || 'UNKNOWN',
                            initialMargin: order.initialMargin,
                            currentMargin: order.currentMargin,
                            createdAt: Number(order.createdAt),
                            matchedAt: Number(order.matchedAt),
                        });
                    } catch {
                        // Skip invalid orders
                    }
                }
                setSellerOrders(sellerOrdersData);
            } catch (err) {
                console.error('Failed to fetch orders:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [isConnected, account, getBuyerOrders, getSellerOrders, getOrder]);

    const formatAmount = (amount: number | bigint, decimals = 6) => {
        const value = typeof amount === 'bigint' ? Number(formatUnits(amount, decimals)) : amount;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (timestamp: number) => {
        if (!timestamp) return '--';
        return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusTheme = (status: string) => {
        switch (status) {
            case 'LIVE':
            case 'MATCHED': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'SETTLED': return 'text-primary-400 bg-primary-500/10 border-primary-500/20';
            case 'PENDING_SETTLEMENT': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'RFQ_CREATED':
            case 'QUOTING': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'CANCELLED':
            case 'LIQUIDATED': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-dark-300 bg-dark-500/10 border-dark-500/20';
        }
    };

    const rawOrders = viewMode === 'buyer' ? buyerOrders : sellerOrders;
    const orders = statusFilter === 'ALL'
        ? rawOrders
        : rawOrders.filter(o => o.status === statusFilter);

    // Calculate stats
    const totalNotional = orders.reduce((sum, o) => sum + Number(formatUnits(o.notionalUSDT, 6)), 0);
    const totalPremium = orders.reduce((sum, o) => sum + Number(formatUnits(o.premiumAmount, 6)), 0);
    const totalMargin = viewMode === 'seller'
        ? orders.reduce((sum, o) => sum + Number(formatUnits(o.currentMargin, 6)), 0)
        : 0;
    const activeCount = orders.filter(o => ['LIVE', 'MATCHED', 'QUOTING'].includes(o.status)).length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Page Header */}
            <div className="mb-14 animate-fade-in-up">
                <div className="flex items-center space-x-2 mb-3">
                    <span className="w-8 h-1 bg-primary-500 rounded-full" />
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em]">Portfolio Management</span>
                </div>
                <h1 className="text-5xl font-black text-white mb-3 tracking-tighter">我的订单 <span className="text-gradient-gold">My Orders</span></h1>
                <p className="text-dark-400 text-lg font-medium">Monitor your active positions, manage margins, and review historical performance.</p>
            </div>

            {/* View & Filter Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
                <div className="flex bg-dark-900 border border-white/5 rounded-2xl p-1.5 shadow-2xl">
                    <button
                        onClick={() => setViewMode('buyer')}
                        className={`px-8 py-3 rounded-xl text-sm font-black transition-all uppercase tracking-widest
                            ${viewMode === 'buyer' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-dark-400 hover:text-white'}`}
                    >
                        买方 Buyer ({buyerOrders.length})
                    </button>
                    <button
                        onClick={() => setViewMode('seller')}
                        className={`px-8 py-3 rounded-xl text-sm font-black transition-all uppercase tracking-widest
                            ${viewMode === 'seller' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-dark-400 hover:text-white'}`}
                    >
                        卖方 Seller ({sellerOrders.length})
                    </button>
                </div>

                <div className="flex bg-dark-900/50 border border-white/5 rounded-2xl p-1.5 overflow-x-auto max-w-full">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                                ${statusFilter === filter ? 'bg-white/10 text-white' : 'text-dark-500 hover:text-dark-300'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'Active Positions 活跃', value: activeCount, color: 'text-white' },
                    { label: 'Total Exposure 名义本金', value: formatAmount(totalNotional, 6), color: 'text-primary-400' },
                    {
                        label: viewMode === 'buyer' ? 'Premiums Paid 期权费' : 'Active Margin 保证金',
                        value: viewMode === 'buyer' ? formatAmount(totalPremium, 6) : formatAmount(totalMargin, 6),
                        color: 'text-white'
                    },
                    { label: 'Total Orders 订单总数', value: orders.length, color: 'text-white' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-6 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary-500/10 transition-colors" />
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className={`text-2xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="glass-card p-16 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-6"></div>
                    <p className="text-dark-400 font-medium">Loading orders from blockchain...</p>
                </div>
            )}

            {/* Not Connected State */}
            {!isConnected && !loading && (
                <div className="glass-card p-16 text-center border-dashed border-2 border-white/10">
                    <div className="text-7xl mb-6 opacity-30 grayscale">🔗</div>
                    <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Connect Wallet</h3>
                    <p className="text-dark-400 font-medium mb-8 max-w-sm mx-auto">
                        Please connect your wallet to view your orders.
                    </p>
                </div>
            )}

            {/* Order List */}
            {!loading && isConnected && (
                <div className="space-y-6">
                    {orders.map((order, i) => (
                        <div key={order.orderId} className="glass-card-hover group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="p-6">
                                {/* Header */}
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                                    <div className="flex items-center space-x-5">
                                        <div className="w-14 h-14 rounded-2xl bg-dark-900 border border-white/5 flex items-center justify-center text-3xl shadow-2xl">
                                            {order.market === 'Crypto' ? '₿' : order.country === 'US' ? '🇺🇸' : '🇨🇳'}
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-3">
                                                <h3 className="text-xl font-black text-white tracking-tight">{order.underlyingName}</h3>
                                                <span className="text-[10px] font-black text-dark-500 tracking-widest uppercase">{order.underlyingCode}</span>
                                            </div>
                                            <p className="text-[10px] font-black text-primary-500/60 uppercase tracking-widest mt-1">Order #{order.orderId}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] shadow-inner ${order.direction === 'Call'
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            {order.direction === 'Call' ? '📈 Call' : '📉 Put'}
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${getStatusTheme(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Notional</p>
                                        <p className="text-lg font-bold text-white">{formatAmount(order.notionalUSDT)}</p>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Premium Rate</p>
                                        <p className="text-lg font-bold text-gradient-gold">{(order.premiumRate / 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Premium</p>
                                        <p className="text-lg font-bold text-primary-400">{formatAmount(order.premiumAmount)}</p>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Expiry</p>
                                        <p className="text-lg font-bold text-white">{formatDate(order.expiryTimestamp)}</p>
                                    </div>
                                    {viewMode === 'seller' && (
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Margin</p>
                                            <p className="text-lg font-bold text-white">{formatAmount(order.currentMargin)}</p>
                                        </div>
                                    )}
                                    {viewMode === 'buyer' && (
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Created</p>
                                            <p className="text-lg font-bold text-white">{formatDate(order.createdAt)}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end space-x-4 pt-6 border-t border-white/5">
                                    {order.status === 'LIVE' && viewMode === 'buyer' && (
                                        <button className="btn-primary text-xs px-6 py-2.5">Request Settlement</button>
                                    )}
                                    {order.status === 'LIVE' && viewMode === 'seller' && (
                                        <button className="btn-secondary text-xs px-6 py-2.5 border-white/10 hover:border-primary-500/30">Add Margin</button>
                                    )}
                                    <button className="btn-secondary text-xs px-6 py-2.5 border-white/10">View Details</button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {orders.length === 0 && (
                        <div className="glass-card py-24 text-center border-dashed border-2 border-white/10">
                            <div className="text-8xl mb-8 opacity-40 grayscale">📋</div>
                            <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">No Orders Found</h3>
                            <p className="text-dark-400 text-lg mb-12 max-w-sm mx-auto">
                                {statusFilter === 'ALL'
                                    ? `You don't have any ${viewMode} orders yet.`
                                    : `No ${statusFilter} orders found.`
                                }
                            </p>
                            <Link to={viewMode === 'buyer' ? '/create-rfq' : '/create-order'} className="btn-primary px-10 py-4 font-black">
                                {viewMode === 'buyer' ? 'Create RFQ' : 'Create Sell Order'}
                            </Link>
                        </div>
                    )}
                </div>
            )}

            <div className="h-20" />
        </div>
    );
}

export default MyOrders;
