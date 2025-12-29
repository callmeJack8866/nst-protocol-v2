import { useState } from 'react';
import { OrderCard } from '../components/OrderCard';

// Mock data for demonstration
const mockOrders = [
    {
        orderId: 1,
        underlyingName: '黄金 AU',
        underlyingCode: 'XAU',
        market: 'CN',
        direction: 'Call' as const,
        notionalUSDT: 100000,
        premiumRate: 700,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: 'RFQ_CREATED',
        sellerType: 'FreeSeller',
    },
    {
        orderId: 2,
        underlyingName: 'Apple Inc.',
        underlyingCode: 'AAPL',
        market: 'US',
        direction: 'Put' as const,
        notionalUSDT: 50000,
        premiumRate: 500,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 60,
        status: 'QUOTING',
        sellerType: 'SeatSeller',
    },
    {
        orderId: 3,
        underlyingName: 'Bitcoin',
        underlyingCode: 'BTC',
        market: 'Crypto',
        direction: 'Call' as const,
        notionalUSDT: 200000,
        premiumRate: 1000,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 14,
        status: 'MATCHED',
        sellerType: 'DesignatedSeller',
    },
];

const markets = ['全部', '中国', '美国', '加密货币'];
const directions = ['全部', '看涨', '看跌'];

export function BuyerHall() {
    const [selectedMarket, setSelectedMarket] = useState('全部');
    const [selectedDirection, setSelectedDirection] = useState('全部');
    const [searchQuery, setSearchQuery] = useState('');

    const handleOrderAction = (orderId: number, action: string) => {
        console.log(`Order ${orderId}: ${action}`);
        // TODO: Implement actual actions
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">买方订单大厅</h1>
                <p className="text-dark-400">浏览并选择卖方报价，或创建自己的询价订单</p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="搜索标的名称或代码..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field pl-10"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">🔍</span>
                </div>

                {/* Create Order Button */}
                <button className="btn-primary flex items-center space-x-2">
                    <span>➕</span>
                    <span>创建询价</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                {/* Market Filter */}
                <div className="flex bg-dark-800/50 rounded-xl p-1">
                    {markets.map((market) => (
                        <button
                            key={market}
                            onClick={() => setSelectedMarket(market)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${selectedMarket === market
                                    ? 'bg-primary-500 text-white'
                                    : 'text-dark-300 hover:text-white'
                                }`}
                        >
                            {market}
                        </button>
                    ))}
                </div>

                {/* Direction Filter */}
                <div className="flex bg-dark-800/50 rounded-xl p-1">
                    {directions.map((direction) => (
                        <button
                            key={direction}
                            onClick={() => setSelectedDirection(direction)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${selectedDirection === direction
                                    ? 'bg-primary-500 text-white'
                                    : 'text-dark-300 hover:text-white'
                                }`}
                        >
                            {direction}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">活跃订单</p>
                    <p className="text-2xl font-bold text-white">128</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">今日成交</p>
                    <p className="text-2xl font-bold text-green-400">23</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">总名义本金</p>
                    <p className="text-2xl font-bold text-primary-400">$12.5M</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">平均费率</p>
                    <p className="text-2xl font-bold text-white">7.2%</p>
                </div>
            </div>

            {/* Order List */}
            <div className="space-y-4">
                {mockOrders.map((order) => (
                    <OrderCard
                        key={order.orderId}
                        order={order}
                        type="buyer"
                        onAction={handleOrderAction}
                    />
                ))}
            </div>

            {/* Empty State */}
            {mockOrders.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-semibold text-white mb-2">暂无订单</h3>
                    <p className="text-dark-400 mb-6">当前没有符合条件的订单，试试调整筛选条件</p>
                    <button className="btn-primary">创建第一个询价</button>
                </div>
            )}
        </div>
    );
}

export default BuyerHall;
