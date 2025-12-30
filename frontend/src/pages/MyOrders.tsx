import { useState } from 'react';
import { Link } from 'react-router-dom';

// Mock data for user orders
const mockUserOrders = {
    asBuyer: [
        {
            orderId: 1,
            underlyingName: '黄金 Gold',
            underlyingCode: 'XAU',
            market: 'CN',
            direction: 'Call' as const,
            notionalUSDT: 100000,
            premiumRate: 700,
            premiumAmount: 7000,
            expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
            status: 'LIVE',
            strikePrice: 2150.50,
            currentPrice: 2200.30,
            unrealizedPnL: 2500,
        },
        {
            orderId: 2,
            underlyingName: 'Apple Inc.',
            underlyingCode: 'AAPL',
            market: 'US',
            direction: 'Put' as const,
            notionalUSDT: 50000,
            premiumRate: 500,
            premiumAmount: 2500,
            expiryTimestamp: Math.floor(Date.now() / 1000) - 86400 * 5,
            status: 'SETTLED',
            strikePrice: 180.00,
            currentPrice: 175.00,
            realizedPnL: 1250,
        },
    ],
    asSeller: [
        {
            orderId: 101,
            underlyingName: 'Bitcoin',
            underlyingCode: 'BTC',
            market: 'Crypto',
            direction: 'Call' as const,
            notionalUSDT: 200000,
            premiumRate: 1000,
            premiumAmount: 20000,
            expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 14,
            status: 'LIVE',
            strikePrice: 95000,
            currentPrice: 97500,
            currentMargin: 25000,
            marginRate: 12.5,
        },
    ],
};

export function MyOrders() {
    const [viewMode, setViewMode] = useState<'buyer' | 'seller'>('buyer');
    const [statusFilter, setStatusFilter] = useState('全部 All');

    const statusFilters = ['全部 All', '持仓中 Live', '待结算 Pending', '已结算 Settled', '已取消 Cancelled'];

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusTheme = (status: string) => {
        switch (status) {
            case 'LIVE': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'SETTLED': return 'text-primary-400 bg-primary-500/10 border-primary-500/20';
            case 'PENDING_SETTLEMENT': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'CANCELLED': return 'text-dark-400 bg-dark-500/10 border-dark-500/20';
            default: return 'text-dark-300 bg-dark-500/10 border-dark-500/20';
        }
    };

    const orders = viewMode === 'buyer' ? mockUserOrders.asBuyer : mockUserOrders.asSeller;

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
                         买方 Buyer
                    </button>
                    <button
                        onClick={() => setViewMode('seller')}
                        className={`px-8 py-3 rounded-xl text-sm font-black transition-all uppercase tracking-widest
                            ${viewMode === 'seller' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-dark-400 hover:text-white'}`}
                    >
                         卖方 Seller
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
                    { label: 'Active Positions 持仓', value: orders.filter(o => o.status === 'LIVE').length, color: 'text-white' },
                    { label: 'Total Exposure 名义本金', value: formatAmount(orders.reduce((sum, o) => sum + o.notionalUSDT, 0)), color: 'text-primary-400' },
                    { label: viewMode === 'buyer' ? 'Total PnL 盈亏' : 'Active Margin 保证金', 
                      value: viewMode === 'buyer' 
                        ? formatAmount(orders.reduce((sum, o: any) => sum + (o.unrealizedPnL || 0), 0))
                        : formatAmount(orders.reduce((sum, o: any) => sum + (o.currentMargin || 0), 0)), 
                      color: viewMode === 'buyer' ? 'text-green-400' : 'text-white' },
                    { label: viewMode === 'buyer' ? 'Paid Premiums 期权费' : 'Collected Premiums 期权费', 
                      value: formatAmount(orders.reduce((sum, o) => sum + o.premiumAmount, 0)), color: 'text-white' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-6 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary-500/10 transition-colors" />
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className={`text-2xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Order List */}
            <div className="space-y-6">
                {orders.map((order, i) => (
                    <div key={order.orderId} className="glass-card-hover group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center space-x-5">
                                    <div className="w-14 h-14 rounded-2xl bg-dark-900 border border-white/5 flex items-center justify-center text-3xl shadow-2xl">
                                        {order.market === 'Crypto' ? '' : order.market === 'US' ? '' : ''}
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-3">
                                            <h3 className="text-xl font-black text-white tracking-tight">{order.underlyingName}</h3>
                                            <span className="text-[10px] font-black text-dark-500 tracking-widest uppercase">{order.underlyingCode}</span>
                                        </div>
                                        <p className="text-[10px] font-black text-primary-500/60 uppercase tracking-widest mt-1">Portfolio Item #{order.orderId}</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] shadow-inner ${order.direction === 'Call'
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {order.direction === 'Call' ? ' Bullish Call' : ' Bearish Put'}
                                    </div>
                                    <span className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${getStatusTheme(order.status)}`}>
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Notional Exposure</p>
                                    <p className="text-lg font-bold text-white">{formatAmount(order.notionalUSDT)}</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Strike Price</p>
                                    <p className="text-lg font-bold text-white">${order.strikePrice}</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Mark Price</p>
                                    <p className="text-lg font-bold text-gradient-gold">${order.currentPrice}</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Maturity Date</p>
                                    <p className="text-lg font-bold text-white">{formatDate(order.expiryTimestamp)}</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">
                                        {(order as any).unrealizedPnL !== undefined ? 'Position PnL' : 'Active Collateral'}
                                    </p>
                                    <p className={`text-lg font-extrabold ${(order as any).unrealizedPnL > 0 ? 'text-green-400' :
                                            (order as any).unrealizedPnL < 0 ? 'text-red-400' : 'text-white'
                                        }`}>
                                        {(order as any).unrealizedPnL !== undefined
                                            ? formatAmount((order as any).unrealizedPnL)
                                            : formatAmount((order as any).currentMargin)
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end space-x-4 pt-6 border-t border-white/5">
                                {order.status === 'LIVE' && viewMode === 'buyer' && (
                                    <button className="btn-primary text-xs px-6 py-2.5">Execute Assignment</button>
                                )}
                                {order.status === 'LIVE' && viewMode === 'seller' && (
                                    <button className="btn-secondary text-xs px-6 py-2.5 border-white/10 hover:border-primary-500/30">Add Collateral</button>
                                )}
                                <button className="btn-secondary text-xs px-6 py-2.5 border-white/10">Detailed Analytics</button>
                            </div>
                        </div>
                    </div>
                ))}

                {orders.length === 0 && (
                    <div className="glass-card py-24 text-center border-dashed border-2 border-white/10">
                        <div className="text-8xl mb-8 opacity-40 grayscale"></div>
                        <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">No Active Positions</h3>
                        <p className="text-dark-400 text-lg mb-12 max-w-sm mx-auto">You do not currently have any active orders for this view. Explore the marketplace to seed your institutional portfolio.</p>
                        <Link to={viewMode === 'buyer' ? '/buyer' : '/seller'} className="btn-primary px-10 py-4 font-black">
                            {viewMode === 'buyer' ? 'Explore Buyer Hall' : 'Explore Seller Hall'}
                        </Link>
                    </div>
                )}
            </div>
            
            <div className="h-20" />
        </div>
    );
}

export default MyOrders;
