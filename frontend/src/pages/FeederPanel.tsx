import { useState } from 'react';

// Mock data for feeder panel
const mockFeedRequests = [
    {
        requestId: 1,
        orderId: 1001,
        underlyingName: '黄金 AU',
        underlyingCode: 'XAU',
        market: 'CN',
        feedType: 'Initial',
        tier: 'Tier_5_3',
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 min
        reward: 0.54, // 2.7U / 5
        status: 'pending',
        direction: 'Call',
        notionalUSDT: 100000,
        buyer: '0x1234...5678',
        seller: '0xabcd...efgh',
    },
    {
        requestId: 2,
        orderId: 1002,
        underlyingName: 'Apple Inc.',
        underlyingCode: 'AAPL',
        market: 'US',
        feedType: 'Final',
        tier: 'Tier_7_5',
        deadline: Math.floor(Date.now() / 1000) + 600, // 10 min
        reward: 0.64,
        status: 'pending',
        direction: 'Put',
        notionalUSDT: 50000,
        buyer: '0x9876...5432',
        seller: '0xfedc...ba98',
    },
    {
        requestId: 3,
        orderId: 1003,
        underlyingName: 'Bitcoin',
        underlyingCode: 'BTC',
        market: 'Crypto',
        feedType: 'Dynamic',
        tier: 'Tier_5_3',
        deadline: Math.floor(Date.now() / 1000) + 2400, // 40 min
        reward: 0.54,
        status: 'pending',
        direction: 'Call',
        notionalUSDT: 200000,
        buyer: '0xaaaa...bbbb',
        seller: '0xcccc...dddd',
    },
];

const feedTypeLabels: Record<string, { label: string; color: string }> = {
    Initial: { label: '期初喂价', color: 'badge-info' },
    Final: { label: '期末喂价', color: 'badge-warning' },
    Dynamic: { label: '动态喂价', color: 'badge-success' },
    Arbitration: { label: '仲裁喂价', color: 'badge-error' },
};

export function FeederPanel() {
    const [selectedRequest, setSelectedRequest] = useState<typeof mockFeedRequests[0] | null>(null);
    const [showFeedModal, setShowFeedModal] = useState(false);
    const [feedPrice, setFeedPrice] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const formatTimeRemaining = (deadline: number) => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = deadline - now;
        if (remaining <= 0) return '已超时';
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const isUrgent = (deadline: number) => {
        const now = Math.floor(Date.now() / 1000);
        return deadline - now < 600; // Less than 10 min
    };

    const handleSubmitFeed = () => {
        console.log('Submitting feed:', feedPrice, 'for request:', selectedRequest?.requestId);
        setShowFeedModal(false);
        setFeedPrice('');
        // TODO: Call contract
    };

    const handleRejectFeed = () => {
        console.log('Rejecting feed:', rejectReason, 'for request:', selectedRequest?.requestId);
        setShowFeedModal(false);
        setRejectReason('');
        setIsRejecting(false);
        // TODO: Call contract
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">喂价员工作台</h1>
                <p className="text-dark-400">处理待喂价的订单，获取喂价奖励</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">质押金额</p>
                    <p className="text-2xl font-bold text-white">$500</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">待处理</p>
                    <p className="text-2xl font-bold text-primary-400">{mockFeedRequests.length}</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">已完成</p>
                    <p className="text-2xl font-bold text-green-400">156</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">总收益</p>
                    <p className="text-2xl font-bold text-white">$842.50</p>
                </div>
                <div className="glass-card p-4">
                    <p className="text-sm text-dark-400 mb-1">成功率</p>
                    <p className="text-2xl font-bold text-green-400">98.7%</p>
                </div>
            </div>

            {/* Feed Request List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white mb-4">待处理喂价请求</h2>

                {mockFeedRequests.map((request) => (
                    <div
                        key={request.requestId}
                        className={`glass-card-hover p-5 ${isUrgent(request.deadline) ? 'border-red-500/50' : ''}`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center">
                                    <span className="text-2xl">
                                        {request.market === 'Crypto' ? '₿' : request.market === 'US' ? '🇺🇸' : '🇨🇳'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{request.underlyingName}</h3>
                                    <p className="text-sm text-dark-400">{request.underlyingCode} · 订单 #{request.orderId}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <span className={feedTypeLabels[request.feedType].color}>
                                    {feedTypeLabels[request.feedType].label}
                                </span>
                                <div className={`text-right ${isUrgent(request.deadline) ? 'text-red-400' : 'text-dark-300'}`}>
                                    <p className="text-sm">剩余时间</p>
                                    <p className="text-lg font-mono font-bold">{formatTimeRemaining(request.deadline)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">方向</p>
                                <p className={`text-lg font-semibold ${request.direction === 'Call' ? 'text-green-400' : 'text-red-400'}`}>
                                    {request.direction === 'Call' ? '📈 看涨' : '📉 看跌'}
                                </p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">名义本金</p>
                                <p className="text-lg font-semibold text-white">
                                    ${(request.notionalUSDT / 1000).toFixed(0)}K
                                </p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">档位</p>
                                <p className="text-lg font-semibold text-white">
                                    {request.tier.replace('Tier_', '')}
                                </p>
                            </div>
                            <div className="bg-dark-800/50 rounded-xl p-3">
                                <p className="text-xs text-dark-400 mb-1">预计奖励</p>
                                <p className="text-lg font-semibold text-primary-400">
                                    ${request.reward.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setSelectedRequest(request);
                                    setIsRejecting(true);
                                    setShowFeedModal(true);
                                }}
                                className="btn-secondary text-sm"
                            >
                                拒绝喂价
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedRequest(request);
                                    setIsRejecting(false);
                                    setShowFeedModal(true);
                                }}
                                className="btn-primary text-sm"
                            >
                                提交喂价
                            </button>
                        </div>
                    </div>
                ))}

                {mockFeedRequests.length === 0 && (
                    <div className="glass-card p-12 text-center">
                        <div className="text-6xl mb-4">📡</div>
                        <h3 className="text-xl font-semibold text-white mb-2">暂无待处理请求</h3>
                        <p className="text-dark-400">当前没有分配给您的喂价任务</p>
                    </div>
                )}
            </div>

            {/* Feed Modal */}
            {showFeedModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 w-full max-w-lg animate-fade-in-up">
                        <h2 className="text-xl font-bold text-white mb-2">
                            {isRejecting ? '拒绝喂价' : '提交喂价'}
                        </h2>
                        <p className="text-dark-400 mb-6">
                            {selectedRequest.underlyingName} ({selectedRequest.underlyingCode}) ·
                            {feedTypeLabels[selectedRequest.feedType].label}
                        </p>

                        {!isRejecting ? (
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm text-dark-300 mb-2">当前价格</label>
                                    <input
                                        type="number"
                                        value={feedPrice}
                                        onChange={(e) => setFeedPrice(e.target.value)}
                                        placeholder="输入标的当前市场价格"
                                        className="input-field"
                                        step="0.01"
                                    />
                                </div>
                                <div className="bg-dark-800/50 rounded-xl p-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-dark-400">预计奖励</span>
                                        <span className="text-primary-400 font-semibold">${selectedRequest.reward.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm text-dark-300 mb-2">拒绝原因</label>
                                    <select
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="input-field"
                                    >
                                        <option value="">选择原因...</option>
                                        <option value="T_PLUS_X_NOT_MET">不符合T+X行权条件</option>
                                        <option value="NO_TRADING_VOLUME">无成交量</option>
                                        <option value="MARKET_CLOSED">市场休市</option>
                                        <option value="PRICE_NOT_AVAILABLE">无法获取价格</option>
                                        <option value="OTHER">其他原因</option>
                                    </select>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                    <p className="text-sm text-yellow-400">
                                        ⚠️ 拒绝喂价将记录在您的历史中，过多拒绝可能影响信用评分
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setShowFeedModal(false);
                                    setFeedPrice('');
                                    setRejectReason('');
                                }}
                                className="btn-secondary flex-1"
                            >
                                取消
                            </button>
                            <button
                                onClick={isRejecting ? handleRejectFeed : handleSubmitFeed}
                                className={`flex-1 ${isRejecting ? 'btn-secondary border-red-500/50 text-red-400' : 'btn-primary'}`}
                            >
                                {isRejecting ? '确认拒绝' : '确认提交'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FeederPanel;
