import { useState } from 'react';

// Mock data for seller hall - buyer RFQ orders
const mockBuyerRFQs = [
    {
        orderId: 101,
        underlyingName: '贵州茅台 Moutai',
        underlyingCode: '600519',
        market: 'CN',
        direction: 'Call' as const,
        notionalUSDT: 500000,
        premiumRate: 800,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 45,
        status: 'RFQ_CREATED',
        sellerType: 'FreeSeller',
        buyer: '0x1234...5678',
        minMarginRate: 1000, // 10%
    },
    {
        orderId: 102,
        underlyingName: 'Tesla Inc.',
        underlyingCode: 'TSLA',
        market: 'US',
        direction: 'Put' as const,
        notionalUSDT: 150000,
        premiumRate: 600,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: 'RFQ_CREATED',
        sellerType: 'SeatSeller',
        buyer: '0xabcd...efgh',
        minMarginRate: 1500, // 15%
    },
    {
        orderId: 103,
        underlyingName: 'Ethereum',
        underlyingCode: 'ETH',
        market: 'Crypto',
        direction: 'Call' as const,
        notionalUSDT: 300000,
        premiumRate: 1200,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 7,
        status: 'QUOTING',
        sellerType: 'FreeSeller',
        buyer: '0x9876...5432',
        minMarginRate: 2000, // 20%
        quotesCount: 3,
    },
];

const markets = ['全部 All', '中国 CN', '美国 US', '加密 Crypto'];

export function SellerHall() {
    const [selectedMarket, setSelectedMarket] = useState('全部 All');
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<typeof mockBuyerRFQs[0] | null>(null);
    const [quoteForm, setQuoteForm] = useState({
        premiumRate: '',
        marginRate: '',
        marginAmount: '',
    });

    const handleOrderAction = (orderId: number, action: string) => {
        if (action === 'quote') {
            const order = mockBuyerRFQs.find(o => o.orderId === orderId);
            if (order) {
                setSelectedOrder(order);
                setShowQuoteModal(true);
            }
        }
    };

    const handleSubmitQuote = () => {
        console.log('Submitting quote:', quoteForm, 'for order:', selectedOrder?.orderId);
        setShowQuoteModal(false);
        setQuoteForm({ premiumRate: '', marginRate: '', marginAmount: '' });
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                <div className="animate-fade-in-up">
                    <div className="flex items-center space-x-2 mb-3">
                        <span className="w-8 h-1 bg-primary-500 rounded-full" />
                        <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em]">Yield Generation</span>
                    </div>
                    <h1 className="text-5xl font-black text-white mb-3 tracking-tighter">卖方大厅 <span className="text-gradient-gold">Seller Hall</span></h1>
                    <p className="text-dark-400 text-lg font-medium max-w-xl">
                        Provide liquidity to earn premium. Review active buyer inquiries and submit your competitive quotes.
                    </p>
                </div>
                
                <button className="btn-primary flex items-center space-x-3 px-8 py-4 group puls-gold">
                    <span className="text-xl"></span>
                    <span>批量卖单 Batch Orders</span>
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                    { label: '待报价 RFQs', value: '452', trend: '+8.1%', color: 'text-white' },
                    { label: '我的活跃报价 Active Quotes', value: '12', trend: '稳定 Stable', color: 'text-primary-400' },
                    { label: '平均年化 Avg APY', value: '24.5%', trend: '+3.2%', color: 'text-green-400' },
                    { label: '累计期权费 Total Premiums', value: '$248.5K', trend: '历史累计 Total', color: 'text-white' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-6 relative overflow-hidden group">
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-3xl -mr-12 -mb-12 transition-all group-hover:bg-primary-500/10" />
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <div className="flex items-baseline space-x-2">
                            <p className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.value}</p>
                            <span className="text-[10px] font-bold text-green-400">{stat.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action & Filter Bar */}
            <div className="glass-card p-4 flex flex-col xl:flex-row justify-between items-center gap-6 mb-8">
                <div className="relative w-full xl:max-w-md group">
                    <input
                        type="text"
                        placeholder="Filter by asset or buyer address..."
                        className="glass-input w-full pl-12 pr-4"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500"></span>
                </div>

                <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
                    {markets.map((market) => (
                        <button
                            key={market}
                            onClick={() => setSelectedMarket(market)}
                            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider
                                ${selectedMarket === market
                                    ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20'
                                    : 'text-dark-400 hover:text-white'
                                }`}
                        >
                            {market}
                        </button>
                    ))}
                </div>
            </div>

            {/* RFQ List */}
            <div className="space-y-6">
                {mockBuyerRFQs.map((order, i) => (
                    <div key={order.orderId} className="glass-card-hover group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="p-6">
                            {/* Card Header */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center space-x-5">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-dark-800 to-dark-950 flex items-center justify-center border border-white/5 shadow-2xl">
                                        <span className="text-4xl text-white/90">
                                            {order.market === 'Crypto' ? '' : order.market === 'US' ? '' : ''}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-3">
                                            <h3 className="text-2xl font-black text-white tracking-tight">{order.underlyingName}</h3>
                                            <span className="text-[10px] font-black text-dark-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 uppercase tracking-widest">{order.underlyingCode}</span>
                                        </div>
                                        <p className="text-xs font-bold text-dark-500 uppercase tracking-widest mt-1 flex items-center space-x-2">
                                            <span>Buyer: {order.buyer}</span>
                                            <span className="w-1 h-1 bg-dark-700 rounded-full" />
                                            <span className="text-primary-400">Yield Opp #{order.orderId}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] shadow-inner ${order.direction === 'Call'
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {order.direction === 'Call' ? ' Bullish Call' : ' Bearish Put'}
                                    </div>
                                    {order.quotesCount && (
                                        <div className="px-4 py-1.5 rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                            {order.quotesCount} Active Quotes
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Target Notional</p>
                                    <p className="text-xl font-bold text-white">{formatAmount(order.notionalUSDT)}</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Max Premium Accept</p>
                                    <p className="text-xl font-bold text-gradient-gold">{(order.premiumRate / 100).toFixed(2)}%</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Min Margin Req.</p>
                                    <p className="text-xl font-bold text-white">{(order.minMarginRate / 100).toFixed(1)}%</p>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Estimated Income</p>
                                    <p className="text-xl font-extrabold text-green-400">
                                        {formatAmount(order.notionalUSDT * order.premiumRate / 10000)}
                                    </p>
                                </div>
                            </div>

                            {/* Footer Action */}
                            <div className="flex items-center justify-between border-t border-white/5 pt-6">
                                <div className="flex items-center space-x-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-dark-500 uppercase tracking-wider">Required Seller Node</span>
                                        <span className="text-sm font-bold text-dark-200">{order.sellerType}</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/5" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-dark-500 uppercase tracking-wider">Time Remaining</span>
                                        <span className="text-sm font-bold text-white">4h 12m</span>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => handleOrderAction(order.orderId, 'quote')}
                                    className="btn-primary"
                                >
                                    Submit Quote 
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quote Modal */}
            {showQuoteModal && selectedOrder && (
                <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="glass-card max-w-xl w-full relative overflow-hidden animate-fade-in-up">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-[80px] -mr-24 -mt-24" />
                        
                        <div className="p-8 relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tighter">Submit Quote</h2>
                                    <p className="text-dark-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                                        RFQ #{selectedOrder.orderId}  {selectedOrder.underlyingName}
                                    </p>
                                </div>
                                <button onClick={() => setShowQuoteModal(false)} className="text-dark-400 hover:text-white text-2xl"></button>
                            </div>

                            <div className="space-y-6 mb-10">
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                                    <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-4">Premium Rate (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={quoteForm.premiumRate}
                                            onChange={(e) => setQuoteForm({ ...quoteForm, premiumRate: e.target.value })}
                                            placeholder="eg: 7.25"
                                            className="glass-input w-full text-2xl font-bold pr-12"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 font-black text-xl">%</span>
                                    </div>
                                    <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mt-3">
                                        Buyer Limit: {(selectedOrder.premiumRate / 100).toFixed(2)}%
                                    </p>
                                </div>

                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                                    <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-4">Collateral Margin (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={quoteForm.marginRate}
                                            onChange={(e) => setQuoteForm({ ...quoteForm, marginRate: e.target.value })}
                                            placeholder="eg: 15.0"
                                            className="glass-input w-full text-2xl font-bold pr-12"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 font-black text-xl">%</span>
                                    </div>
                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mt-3">
                                        Minimum Requirement: {(selectedOrder.minMarginRate / 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowQuoteModal(false)}
                                    className="btn-secondary flex-1 py-4 font-black"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitQuote}
                                    className="btn-primary flex-1 py-4 font-black"
                                >
                                    Confirm Quote
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SellerHall;
