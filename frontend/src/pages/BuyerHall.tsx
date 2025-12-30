import { useState } from 'react';
import { OrderCard } from '../components/OrderCard';
import { Link } from 'react-router-dom';

const mockOrders = [
    {
        orderId: 1,
        underlyingName: '黄金 Gold',
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

const markets = ['全部 All', '中国 CN', '美国 US', '加密 Crypto'];
const directions = ['全部 All', '看涨 Call', '看跌 Put'];

export function BuyerHall() {
    const [selectedMarket, setSelectedMarket] = useState('全部 All');
    const [selectedDirection, setSelectedDirection] = useState('全部 All');
    const [searchQuery, setSearchQuery] = useState('');

    const handleOrderAction = (orderId: number, action: string) => {
        console.log(`Order ${orderId}: ${action}`);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                <div className="animate-fade-in-up">
                    <div className="flex items-center space-x-2 mb-3">
                        <span className="w-8 h-1 bg-primary-500 rounded-full" />
                        <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em]">Marketplace</span>
                    </div>
                    <h1 className="text-5xl font-black text-white mb-3 tracking-tighter">买方大厅 <span className="text-gradient-gold">Buyer Hall</span></h1>
                    <p className="text-dark-400 text-lg font-medium max-w-xl">
                        Discover institutional liquidity and institutional-grade option structures. Create your RFQ or select from premier quotes.
                    </p>
                </div>
                
                <Link to="/create-rfq" className="btn-primary flex items-center space-x-3 px-8 py-4 group">
                    <span className="text-xl group-hover:rotate-90 transition-transform duration-300"></span>
                    <span>创建询价 Create RFQ</span>
                </Link>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                    { label: '活跃订单 Active', value: '1,284', trend: '+12%', color: 'text-white' },
                    { label: '24h 成交 Volume', value: '$84.2M', trend: '+5.4%', color: 'text-green-400' },
                    { label: '全网 TVL', value: '$1.2B', trend: '+2.1%', color: 'text-primary-400' },
                    { label: '平均费率 Avg Premium', value: '6.84%', trend: '-0.2%', color: 'text-white' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-primary-500/10" />
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <div className="flex items-baseline space-x-2">
                            <p className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.value}</p>
                            <span className="text-[10px] font-bold text-green-400">{stat.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action & Filter Bar */}
            <div className="glass-card p-4 flex flex-col xl:flex-row justify-between items-center gap-6 mb-4">
                {/* Search */}
                <div className="relative w-full xl:max-w-md group">
                    <input
                        type="text"
                        placeholder="Search assets, codes or markets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="glass-input w-full pl-12 pr-4 focus:ring-1 focus:ring-primary-500/30"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors"></span>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-6 w-full xl:w-auto">
                    <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
                        {markets.map((market) => (
                            <button
                                key={market}
                                onClick={() => setSelectedMarket(market)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider
                                    ${selectedMarket === market
                                        ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20'
                                        : 'text-dark-400 hover:text-white'
                                    }`}
                            >
                                {market}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
                        {directions.map((direction) => (
                            <button
                                key={direction}
                                onClick={() => setSelectedDirection(direction)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider
                                    ${selectedDirection === direction
                                        ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20'
                                        : 'text-dark-400 hover:text-white'
                                    }`}
                            >
                                {direction}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sub-header Context */}
            <div className="flex items-center justify-between mb-6 px-2">
                <p className="text-xs font-bold text-dark-500 uppercase tracking-widest">Showing {mockOrders.length} liquidity pools</p>
                <div className="flex items-center space-x-4">
                    <button className="text-[10px] font-black text-dark-500 uppercase hover:text-primary-400 transition-colors">Sort by Vol </button>
                    <button className="text-[10px] font-black text-dark-500 uppercase hover:text-primary-400 transition-colors">Sort by Premium </button>
                </div>
            </div>

            {/* Order List */}
            <div className="space-y-6">
                {mockOrders.map((order, i) => (
                    <div key={order.orderId} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                        <OrderCard
                            order={order}
                            type="buyer"
                            onAction={handleOrderAction}
                        />
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {mockOrders.length === 0 && (
                <div className="glass-card py-24 text-center border-dashed border-2 border-white/10">
                    <div className="text-7xl mb-6 opacity-40 grayscale"></div>
                    <h3 className="text-2xl font-black text-white mb-2">No Liquidity Found</h3>
                    <p className="text-dark-400 mb-10 max-w-sm mx-auto">None of the currently listed orders match your criteria. Expand your search or create your own RFQ.</p>
                    <Link to="/create-rfq" className="btn-primary">Create Your First RFQ</Link>
                </div>
            )}
            
            {/* Footer gradient fade */}
            <div className="h-20" />
        </div>
    );
}

export default BuyerHall;
