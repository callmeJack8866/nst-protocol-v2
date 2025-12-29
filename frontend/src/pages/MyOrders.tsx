import { useState } from 'react';

// Mock data for user orders
const mockUserOrders = {
    asBuyer: [
        {
            orderId: 1,
            underlyingName: '黄金 AU',
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
    const [statusFilter, setStatusFilter] = useState('全部');

    const statusFilters = ['全部', '持仓中', '待结算', '已结算', '已取消'];

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

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            LIVE: 'badge-success',
            SETTLED: 'badge-info',
            PENDING_SETTLEMENT: 'badge-warning',
            CANCELLED: 'badge-error',
        };
        return styles[status] || 'badge-info';
    };

    const orders = viewMode === 'buyer' ? mockUserOrders.asBuyer : mockUserOrders.asSeller;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">我的订单</h1>
                <p className="text-dark-400">查看和管理您的所有期权订单</p>
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="flex bg-dark-800/50 rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('buyer')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all
              ${viewMode === 'buyer' ? 'bg-primary-500 text-white' : 'text-dark-300 hover:text-white'}`}
                    >
                        📋 买方订单
                    </button>
                    <button
                        onClick={() => setViewMode('seller')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all
              ${viewMode === 'seller' ? 'bg-primary-500 text-white' : 'text-dark-300 hover:text-white'}`}
                    >
                        📊 卖方订单
                    </button>
                </div>

                <div className="flex bg-dark-800/50 rounded-xl p-1">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${statusFilter === filter ? 'bg-dark-600 text-white' : 'text-dark-400 hover:text-white'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">持仓订单</p>
                    <p className="text-2xl font-bold text-white">
                        {orders.filter(o => o.status === 'LIVE').length}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">总名义本金</p>
                    <p className="text-2xl font-bold text-primary-400">
                        {formatAmount(orders.reduce((sum, o) => sum + o.notionalUSDT, 0))}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">
                        {viewMode === 'buyer' ? '未实现盈亏' : '当前保证金'}
                    </p>
                    <p className={`text-2xl font-bold ${viewMode === 'buyer' ? 'text-green-400' : 'text-white'}`}>
                        {viewMode === 'buyer'
                            ? formatAmount(orders.reduce((sum, o: any) => sum + (o.unrealizedPnL || 0), 0))
                            : formatAmount(orders.reduce((sum, o: any) => sum + (o.currentMargin || 0), 0))
                        }
                    </p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">
                        {viewMode === 'buyer' ? '支付期权费' : '收取期权费'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                        {formatAmount(orders.reduce((sum, o) => sum + o.premiumAmount, 0))}
                    </p>
                </div>
            </div>

            {/* Order List */}
            <div className="space-y-4">
                {orders.map((order) => (
                    <div key={order.orderId} className="glass-card p-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center">
                                    <span className="text-2xl">
                                        {order.market === 'Crypto' ? '₿' : order.market === 'US' ? '🇺🇸' : '🇨🇳'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{order.underlyingName}</h3>
                                    <p className="text-sm text-dark-400">#{order.orderId} · {order.underlyingCode}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <span className={`badge border ${order.direction === 'Call'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {order.direction === 'Call' ? '📈 看涨' : '📉 看跌'}
                                </span>
                                <span className={getStatusBadge(order.status)}>
                                    {order.status}
                                </span>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-5 gap-4 mb-4">
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">名义本金</p>
                                <p className="text-lg font-semibold text-white">{formatAmount(order.notionalUSDT)}</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">行权价</p>
                                <p className="text-lg font-semibold text-white">${order.strikePrice}</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">当前价格</p>
                                <p className="text-lg font-semibold text-primary-400">${order.currentPrice}</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">到期日</p>
                                <p className="text-lg font-semibold text-white">{formatDate(order.expiryTimestamp)}</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">
                                    {(order as any).unrealizedPnL !== undefined ? '盈亏' : '保证金'}
                                </p>
                                <p className={`text-lg font-semibold ${(order as any).unrealizedPnL > 0 ? 'text-green-400' :
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
                        <div className="flex justify-end space-x-3">
                            {order.status === 'LIVE' && viewMode === 'buyer' && (
                                <button className="btn-secondary text-sm">提前行权</button>
                            )}
                            {order.status === 'LIVE' && viewMode === 'seller' && (
                                <button className="btn-secondary text-sm">追加保证金</button>
                            )}
                            <button className="btn-secondary text-sm">查看详情</button>
                        </div>
                    </div>
                ))}

                {orders.length === 0 && (
                    <div className="glass-card p-12 text-center">
                        <div className="text-6xl mb-4">📁</div>
                        <h3 className="text-xl font-semibold text-white mb-2">暂无订单</h3>
                        <p className="text-dark-400 mb-6">您还没有{viewMode === 'buyer' ? '买入' : '卖出'}任何期权</p>
                        <button className="btn-primary">
                            {viewMode === 'buyer' ? '去买方大厅' : '去卖方大厅'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MyOrders;
