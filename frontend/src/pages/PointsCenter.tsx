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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="glass-card p-16 animate-fade-in-up">
          <div className="text-8xl mb-8 opacity-40 grayscale"></div>
          <h3 className="text-3xl font-black text-white mb-4">Vault Locked</h3>
          <p className="text-dark-400 text-lg mb-10 max-w-sm mx-auto">Please connect your authorized institutional wallet to access the Points & Rewards Center.</p>
          <button className="btn-primary px-12 py-4">Connect Wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="mb-14 animate-fade-in-up">
        <div className="flex items-center space-x-2 mb-3">
          <span className="w-8 h-1 bg-primary-500 rounded-full" />
          <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em]">Institutional Rewards</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-3 tracking-tighter">积分中心 <span className="text-gradient-gold">Points Center</span></h1>
        <p className="text-dark-400 text-lg font-medium">Manage your governance points and claim institutional-grade distribution rewards.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Points Overview */}
        <div className="lg:col-span-2 glass-card p-8 h-full flex flex-col justify-between">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
            <div>
              <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] mb-3">Available Points Balance</p>
              <div className="flex items-baseline space-x-3">
                <p className="text-6xl font-black text-gradient-gold tracking-tighter">
                  {formatPoints(availablePoints)}
                </p>
                <span className="text-sm font-bold text-dark-400 uppercase tracking-widest">PTS</span>
              </div>
            </div>
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-dark-800 to-dark-950 flex items-center justify-center border border-white/5 shadow-2xl relative group overflow-hidden">
              <div className="absolute inset-0 bg-primary-500/5 group-hover:bg-primary-500/10 transition-colors" />
              <span className="text-6xl relative z-10 filter drop-shadow-xl pulse-gold"></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Cumulative Points累计', value: formatPoints(totalPoints), icon: '' },
              { label: 'Claimed Distribution已领', value: formatPoints(claimedPoints), icon: '' },
              { label: 'Authorized Entity主体', value: account ? `${account.slice(0, 8)}...${account.slice(-6)}` : 'N/A', icon: '', isMono: true },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] transition-colors">
                <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-2 flex items-center">
                  <span className="mr-2">{item.icon}</span> {item.label}
                </p>
                <p className={`text-lg font-bold text-white ${item.isMono ? 'font-mono text-sm' : ''}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution Card */}
        <div className="glass-card p-8 relative overflow-hidden flex flex-col border-primary-500/10 shadow-[0_0_50px_rgba(247,168,31,0.05)]">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-[80px] -mr-24 -mt-24" />

          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  {currentAirdrop ? `第 ${currentAirdrop.airdropId} 期分发` : '暂无分发'}
                </h3>
                <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mt-1">Airdrop Distribution</p>
              </div>
              {currentAirdrop && (
                <span className="px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  Active
                </span>
              )}
            </div>

            <div className="mb-10 p-6 bg-white/[0.03] rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-2">Claimable NST Tokens</p>
              <div className="flex items-baseline space-x-2">
                <p className="text-4xl font-black text-white tracking-tight">
                  {formatAmount(claimableNST)}
                </p>
                <span className="text-xs font-bold text-primary-400">NST</span>
              </div>
            </div>

            {currentAirdrop && (
              <div className="mb-10 group">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-3">
                  <span className="text-dark-500">Processing Window</span>
                  <span className="text-white">{getDaysRemaining()} Days Remaining</span>
                </div>
                <div className="w-full bg-dark-800 rounded-full h-2.5 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-primary-600 to-primary-400 h-full rounded-full transition-all duration-1000 group-hover:shadow-[0_0_15px_rgba(247,168,31,0.3)]"
                    style={{ width: `75%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setShowClaimModal(true)}
              className="btn-primary w-full py-5 font-black text-lg group relative"
              disabled={!currentAirdrop || parseFloat(claimableNST) <= 0 || isLoading}
            >
              <span className="relative z-10">{isLoading ? 'Processing...' : '立即领取 Claim Now'}</span>
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
            </button>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="glass-card p-10 mt-12 mb-20 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[100px] -ml-32 -mb-32" />
        <h3 className="text-2xl font-black text-white mb-8 tracking-tight">积分算法 <span className="text-primary-400 font-bold uppercase text-xs tracking-[0.3em] ml-4">Mining Rules</span></h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: '交易手续费', detail: '每支付 1 USDT 手续费', pts: '100', icon: '' },
            { title: '建仓支付', detail: '每支付 1 USDT 成本', pts: '100', icon: '' },
            { title: '喂价贡献', detail: '每提供 1 次核心价格', pts: '100', icon: '' },
          ].map((rule, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 hover:bg-white/[0.05] transition-all hover:-translate-y-1">
              <div className="flex items-center space-x-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-dark-900 flex items-center justify-center text-2xl border border-white/5 shadow-xl">
                  {rule.icon}
                </div>
                <span className="text-lg font-black text-white tracking-tight">{rule.title}</span>
              </div>
              <p className="text-dark-400 text-sm font-medium mb-4">{rule.detail}</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-gradient-gold">+{rule.pts}</span>
                <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Points</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Claim Modal */}
      {showClaimModal && currentAirdrop && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="glass-card max-w-lg w-full relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-[80px] -mr-24 -mt-24" />

            <div className="p-10 relative z-10">
              <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">确认领取授权奖励</h2>
              <p className="text-dark-400 font-bold uppercase text-[10px] tracking-widest">Distribution Window: Phase {Number(currentAirdrop.airdropId)}</p>

              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 my-8">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Expenditure Points</span>
                  <span className="text-xl font-bold text-white tracking-tight">{formatPoints(availablePoints)} PTS</span>
                </div>
                <div className="w-full h-px bg-white/5 mb-6" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Authorized NST Award</span>
                  <span className="text-2xl font-black text-gradient-gold tracking-tight">{formatAmount(claimableNST)} NST</span>
                </div>
              </div>

              <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-6 mb-10">
                <p className="text-sm font-bold text-primary-400 leading-relaxed">
                  确认后，所有活跃积分将按当前周期汇率完成清算。此项操作一经链上共识不可撤销。
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="btn-secondary flex-1 py-4 font-black"
                  disabled={isLoading}
                >
                  取消 Abort
                </button>
                <button
                  onClick={handleClaim}
                  className="btn-primary flex-1 py-4 font-black"
                  disabled={isLoading}
                >
                  {isLoading ? 'Clearing...' : '确认申领 Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PointsCenter;
