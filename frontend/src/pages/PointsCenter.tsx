import { useState, useEffect } from 'react';
import { useWallet, usePoints } from '../hooks';


export function PointsCenter() {
  const { isConnected, account } = useWallet();
  const { 
    userPoints, 
    fetchUserPoints, 
    getAirdrop, 
    calculateClaimableNST, 
    claimAirdrop,
    getCurrentAirdropId,
    isLoading 
  } = usePoints();
  
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [currentAirdrop, setCurrentAirdrop] = useState<any>(null);
  const [claimableNST, setClaimableNST] = useState('0');

  // Fetch data on mount
  useEffect(() => {
    if (isConnected) {
      fetchUserPoints();
      loadAirdropData();
    }
  }, [isConnected, fetchUserPoints]);

  const loadAirdropData = async () => {
    const airdropId = await getCurrentAirdropId();
    if (airdropId > 0) {
      const airdrop = await getAirdrop(airdropId);
      setCurrentAirdrop(airdrop);
      const claimable = await calculateClaimableNST(airdropId);
      setClaimableNST(claimable);
    }
  };

  const formatPoints = (points: bigint | number) => {
    const num = typeof points === 'bigint' ? Number(points) : points;
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatAmount = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const getDaysRemaining = () => {
    if (!currentAirdrop) return 0;
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(currentAirdrop.endTime) - now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };

  const handleClaim = async () => {
    if (!currentAirdrop) return;
    try {
      await claimAirdrop(Number(currentAirdrop.airdropId));
      setShowClaimModal(false);
      await fetchUserPoints();
      await loadAirdropData();
    } catch (error) {
      console.error('Claim failed:', error);
    }
  };

  const availablePoints = userPoints ? Number(userPoints.availablePoints) : 0;
  const totalPoints = userPoints ? Number(userPoints.totalPoints) : 0;
  const claimedPoints = userPoints ? Number(userPoints.claimedPoints) : 0;

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4"></div>
          <h3 className="text-xl font-semibold text-white mb-2">请先连接钱包</h3>
          <p className="text-dark-400">连接钱包后查看您的积分和空投信息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">积分中心</h1>
        <p className="text-dark-400">查看积分余额，领取空投奖励</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-dark-400 mb-2">可用积分</p>
              <p className="text-5xl font-bold text-primary-400">
                {formatPoints(availablePoints)}
              </p>
            </div>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <span className="text-4xl"></span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-dark-800/50 rounded-xl p-4">
              <p className="text-sm text-dark-400 mb-1">累计积分</p>
              <p className="text-xl font-semibold text-white">{formatPoints(totalPoints)}</p>
            </div>
            <div className="bg-dark-800/50 rounded-xl p-4">
              <p className="text-sm text-dark-400 mb-1">已领取积分</p>
              <p className="text-xl font-semibold text-white">{formatPoints(claimedPoints)}</p>
            </div>
            <div className="bg-dark-800/50 rounded-xl p-4">
              <p className="text-sm text-dark-400 mb-1">钱包地址</p>
              <p className="text-sm font-mono text-white truncate">{account}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {currentAirdrop ? `第  期空投` : '暂无空投'}
              </h3>
              {currentAirdrop && <span className="badge-success">进行中</span>}
            </div>

            <div className="mb-6">
              <p className="text-sm text-dark-400 mb-2">可领取 NST</p>
              <p className="text-3xl font-bold text-primary-400">
                {formatAmount(claimableNST)}
              </p>
            </div>

            {currentAirdrop && (
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-dark-400">剩余时间</span>
                  <span className="text-white">{getDaysRemaining()} 天</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full" 
                    style={{ width: `%` }}
                  />
                </div>
              </div>
            )}

            <button 
              onClick={() => setShowClaimModal(true)}
              className="btn-primary w-full"
              disabled={!currentAirdrop || parseFloat(claimableNST) <= 0 || isLoading}
            >
              {isLoading ? '处理中...' : '领取空投'}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">积分规则</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-dark-800/50 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-2xl"></span>
              <span className="text-white font-medium">交易手续费</span>
            </div>
            <p className="text-dark-400 text-sm">每支付 1 USDT 手续费获得 100 积分</p>
          </div>
          <div className="bg-dark-800/50 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-2xl"></span>
              <span className="text-white font-medium">建仓手续费</span>
            </div>
            <p className="text-dark-400 text-sm">每支付 1 USDT 手续费获得 100 积分</p>
          </div>
          <div className="bg-dark-800/50 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-2xl"></span>
              <span className="text-white font-medium">喂价费</span>
            </div>
            <p className="text-dark-400 text-sm">每支付 1 USDT 手续费获得 100 积分</p>
          </div>
        </div>
      </div>

      {showClaimModal && currentAirdrop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in-up">
            <h2 className="text-xl font-bold text-white mb-2">确认领取空投</h2>
            <p className="text-dark-400 mb-6">第 {Number(currentAirdrop.airdropId)} 期空投</p>

            <div className="bg-dark-800/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-dark-400">使用积分</span>
                <span className="text-white">{formatPoints(availablePoints)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">获得 NST</span>
                <span className="text-primary-400 font-semibold">{formatAmount(claimableNST)}</span>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-yellow-400">
                 领取后积分将被清零，请确认您要领取本期空投
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowClaimModal(false)}
                className="btn-secondary flex-1"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleClaim}
                className="btn-primary flex-1"
                disabled={isLoading}
              >
                {isLoading ? '处理中...' : '确认领取'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PointsCenter;
