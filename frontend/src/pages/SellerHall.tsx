import { useState } from 'react';

// Mock data for seller hall - buyer RFQ orders
const mockBuyerRFQs = [
    {
        orderId: 101,
        underlyingName: '贵州茅台',
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

const markets = ['全部', '中国', '美国', '加密货币'];

export function SellerHall() {
    const [selectedMarket, setSelectedMarket] = useState('全部');
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
        // TODO: Call contract
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">卖方订单大厅</h1>
                <p className="text-dark-400">浏览买方询价订单，提交您的报价并赚取期权费收益</p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="搜索标的名称或代码..."
                        className="input-field pl-10"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">🔍</span>
                </div>

                <button className="btn-primary flex items-center space-x-2">
                    <span>📊</span>
                    <span>创建卖单</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
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
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">待报价订单</p>
                    <p className="text-2xl font-bold text-white">56</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">我的报价</p>
                    <p className="text-2xl font-bold text-primary-400">8</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">已成交</p>
                    <p className="text-2xl font-bold text-green-400">12</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">总收益</p>
                    <p className="text-2xl font-bold text-white">$45,200</p>
                </div>
            </div>

            {/* Order List */}
            <div className="space-y-4">
                {mockBuyerRFQs.map((order) => (
                    <div key={order.orderId} className="glass-card-hover p-5">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center">
                                    <span className="text-2xl">
                                        {order.market === 'Crypto' ? '₿' : order.market === 'US' ? '🇺🇸' : '🇨🇳'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{order.underlyingName}</h3>
                                    <p className="text-sm text-dark-400">{order.underlyingCode} · 买方: {order.buyer}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <span className={`badge border ${order.direction === 'Call'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {order.direction === 'Call' ? '📈 看涨' : '📉 看跌'}
                                </span>
                                {order.quotesCount && (
                                    <span className="badge-warning">{order.quotesCount} 个报价</span>
                                )}
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">名义本金</p>
                                <p className="text-lg font-semibold text-white">{formatAmount(order.notionalUSDT)}</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">最高费率</p>
                                <p className="text-lg font-semibold text-primary-400">{(order.premiumRate / 100).toFixed(2)}%</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">最低保证金</p>
                                <p className="text-lg font-semibold text-white">{(order.minMarginRate / 100).toFixed(1)}%</p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">预计收益</p>
                                <p className="text-lg font-semibold text-green-400">
                                    {formatAmount(order.notionalUSDT * order.premiumRate / 10000)}
                                </p>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => handleOrderAction(order.orderId, 'quote')}
                                className="btn-primary text-sm"
                            >
                                提交报价
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quote Modal */}
            {showQuoteModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 w-full max-w-lg animate-fade-in-up">
                        <h2 className="text-xl font-bold text-white mb-4">提交报价</h2>
                        <p className="text-dark-400 mb-6">
                            订单 #{selectedOrder.orderId} · {selectedOrder.underlyingName}
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm text-dark-300 mb-2">期权费率 (%)</label>
                                <input
                                    type="number"
                                    value={quoteForm.premiumRate}
                                    onChange={(e) => setQuoteForm({ ...quoteForm, premiumRate: e.target.value })}
                                    placeholder="例如: 7.0"
                                    className="input-field"
                                />
                                <p className="text-xs text-dark-400 mt-1">
                                    买方最高接受: {(selectedOrder.premiumRate / 100).toFixed(2)}%
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm text-dark-300 mb-2">保证金率 (%)</label>
                                <input
                                    type="number"
                                    value={quoteForm.marginRate}
                                    onChange={(e) => setQuoteForm({ ...quoteForm, marginRate: e.target.value })}
                                    placeholder="例如: 15.0"
                                    className="input-field"
                                />
                                <p className="text-xs text-dark-400 mt-1">
                                    最低要求: {(selectedOrder.minMarginRate / 100).toFixed(1)}%
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm text-dark-300 mb-2">保证金金额 (USDT)</label>
                                <input
                                    type="number"
                                    value={quoteForm.marginAmount}
                                    onChange={(e) => setQuoteForm({ ...quoteForm, marginAmount: e.target.value })}
                                    placeholder="自动计算"
                                    className="input-field"
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowQuoteModal(false)}
                                className="btn-secondary flex-1"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmitQuote}
                                className="btn-primary flex-1"
                            >
                                确认提交
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SellerHall;
