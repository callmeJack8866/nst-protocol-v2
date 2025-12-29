import { useState } from 'react';

// Mock data for points
const mockPointsData = {
    totalPoints: 125800,
    availablePoints: 98500,
    claimedPoints: 27300,
    rank: 156,
    totalUsers: 2500,
};

const mockAirdrop = {
    isActive: true,
    airdropId: 3,
    totalPool: 100000,
    startTime: Math.floor(Date.now() / 1000) - 86400,
    endTime: Math.floor(Date.now() / 1000) + 86400 * 6,
    claimable: 125.50,
};

const mockHistory = [
    { date: '2024-12-28', type: '交易手续费', amount: 50, points: 5000 },
    { date: '2024-12-27', type: '建仓手续费', amount: 1, points: 100 },
    { date: '2024-12-26', type: '交易手续费', amount: 100, points: 10000 },
    { date: '2024-12-25', type: '喂价费', amount: 5, points: 500 },
    { date: '2024-12-24', type: '仲裁费', amount: 30, points: 3000 },
];

export function PointsCenter() {
    const [showClaimModal, setShowClaimModal] = useState(false);

    const formatPoints = (points: number) => {
        return new Intl.NumberFormat('en-US').format(points);
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const getDaysRemaining = () => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = mockAirdrop.endTime - now;
        return Math.max(0, Math.ceil(remaining / 86400));
    };

    const handleClaim = () => {
        console.log('Claiming airdrop...');
        setShowClaimModal(false);
        // TODO: Call contract
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">积分中心</h1>
                <p className="text-dark-400">查看积分余额，领取空投奖励</p>
            </div>

            {/* Points Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Main Points Card */}
                <div className="md:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-dark-400 mb-2">可用积分</p>
                            <p className="text-5xl font-bold text-primary-400">
                                {formatPoints(mockPointsData.availablePoints)}
                            </p>
                        </div>
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                            <span className="text-4xl">🎁</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-dark-800/50 rounded-xl p-4">
                            <p className="text-sm text-dark-400 mb-1">累计积分</p>
                            <p className="text-xl font-semibold text-white">{formatPoints(mockPointsData.totalPoints)}</p>
                        </div>
                        <div className="bg-dark-800/50 rounded-xl p-4">
                            <p className="text-sm text-dark-400 mb-1">已领取积分</p>
                            <p className="text-xl font-semibold text-white">{formatPoints(mockPointsData.claimedPoints)}</p>
                        </div>
                        <div className="bg-dark-800/50 rounded-xl p-4">
                            <p className="text-sm text-dark-400 mb-1">排名</p>
                            <p className="text-xl font-semibold text-white">
                                #{mockPointsData.rank} <span className="text-sm text-dark-400">/ {mockPointsData.totalUsers}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Airdrop Card */}
                <div className="glass-card p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />

                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">第 {mockAirdrop.airdropId} 期空投</h3>
                            <span className="badge-success">进行中</span>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-dark-400 mb-2">可领取 NST</p>
                            <p className="text-3xl font-bold text-primary-400">
                                {formatAmount(mockAirdrop.claimable)}
                            </p>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-dark-400">剩余时间</span>
                                <span className="text-white">{getDaysRemaining()} 天</span>
                            </div>
                            <div className="w-full bg-dark-700 rounded-full h-2">
                                <div
                                    className="bg-primary-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(100, (1 - getDaysRemaining() / 7) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => setShowClaimModal(true)}
                            className="btn-primary w-full"
                            disabled={mockAirdrop.claimable <= 0}
                        >
                            领取空投
                        </button>
                    </div>
                </div>
            </div>

            {/* Points Rules */}
            <div className="glass-card p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">积分规则</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-dark-800/50 rounded-xl p-4">
                        <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">💰</span>
                            <span className="text-white font-medium">交易手续费</span>
                        </div>
                        <p className="text-dark-400 text-sm">每支付 1 USDT 手续费获得 100 积分</p>
                    </div>
                    <div className="bg-dark-800/50 rounded-xl p-4">
                        <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">📋</span>
                            <span className="text-white font-medium">建仓手续费</span>
                        </div>
                        <p className="text-dark-400 text-sm">每支付 1 USDT 手续费获得 100 积分</p>
                    </div>
                    <div className="bg-dark-800/50 rounded-xl p-4">
                        <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">📡</span>
                            <span className="text-white font-medium">喂价费</span>
                        </div>
                        <p className="text-dark-400 text-sm">每支付 1 USDT 手续费获得 100 积分</p>
                    </div>
                </div>
            </div>

            {/* Points History */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">积分记录</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-dark-400 border-b border-dark-700">
                                <th className="pb-3 font-medium">日期</th>
                                <th className="pb-3 font-medium">类型</th>
                                <th className="pb-3 font-medium text-right">消费金额</th>
                                <th className="pb-3 font-medium text-right">获得积分</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mockHistory.map((record, index) => (
                                <tr key={index} className="border-b border-dark-800">
                                    <td className="py-4 text-white">{record.date}</td>
                                    <td className="py-4 text-dark-300">{record.type}</td>
                                    <td className="py-4 text-white text-right">{formatAmount(record.amount)}</td>
                                    <td className="py-4 text-primary-400 text-right font-medium">+{formatPoints(record.points)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Claim Modal */}
            {showClaimModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 w-full max-w-md animate-fade-in-up">
                        <h2 className="text-xl font-bold text-white mb-2">确认领取空投</h2>
                        <p className="text-dark-400 mb-6">第 {mockAirdrop.airdropId} 期空投</p>

                        <div className="bg-dark-800/50 rounded-xl p-4 mb-6">
                            <div className="flex justify-between mb-2">
                                <span className="text-dark-400">使用积分</span>
                                <span className="text-white">{formatPoints(mockPointsData.availablePoints)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-dark-400">获得 NST</span>
                                <span className="text-primary-400 font-semibold">{formatAmount(mockAirdrop.claimable)}</span>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                            <p className="text-sm text-yellow-400">
                                ⚠️ 领取后积分将被清零，请确认您要领取本期空投
                            </p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowClaimModal(false)}
                                className="btn-secondary flex-1"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleClaim}
                                className="btn-primary flex-1"
                            >
                                确认领取
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PointsCenter;
