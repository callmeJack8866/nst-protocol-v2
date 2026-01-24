import { useState, useEffect } from 'react';
import { usePoints } from '../hooks';
import { formatUnits } from 'ethers';

export function PointsCenter() {
  const { isConnected, userPoints, fetchUserPoints, getCurrentAirdrop, calculateClaimableNST, claimAirdrop, isLoading } = usePoints();
  const [claimableNST, setClaimableNST] = useState('0');
  const [airdropInfo, setAirdropInfo] = useState<any>(null);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchUserPoints();
      loadAirdropInfo();
    }
  }, [isConnected, fetchUserPoints]);

  const loadAirdropInfo = async () => {
    try {
      const airdrop = await getCurrentAirdrop();
      setAirdropInfo(airdrop);
      const claimable = await calculateClaimableNST();
      setClaimableNST(claimable);
    } catch (e) {
      console.error("Failed to load airdrop info:", e);
    }
  };

  const handleClaim = async () => {
    setClaimError('');
    try {
      await claimAirdrop();
      setClaimSuccess(true);
      await loadAirdropInfo();
      setTimeout(() => setClaimSuccess(false), 3000);
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Claim failed');
    }
  };

  const totalPoints = userPoints ? Number(formatUnits(userPoints.totalPoints, 0)) : 0;
  const claimedPoints = userPoints ? Number(formatUnits(userPoints.claimedPoints, 0)) : 0;
  const availablePoints = userPoints ? Number(formatUnits(userPoints.availablePoints, 0)) : 0;
  const formatPoints = (p: number) => new Intl.NumberFormat().format(p);

  if (!isConnected) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-20 text-center">
        <div className="glass-card p-20 animate-fade-in-up">
          <div className="text-8xl mb-8 opacity-30 grayscale">🔗</div>
          <h3 className="text-3xl font-black text-white mb-4">Points Portfolio Locked</h3>
          <p className="text-dark-400 text-lg mb-10 max-w-sm mx-auto font-medium">Connect your wallet to synchronize your loyalty points and participate in ongoing distribution cycles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Refined Page Header */}
      <div className="mb-14 animate-fade-in-up">
        <div className="flex items-center space-x-3 mb-4">
          <span className="w-12 h-[2px] bg-primary-500 rounded-full" />
          <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">Governance & Loyalty</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">积分中心 <span className="text-gradient-gold">Points Center</span></h1>
        <p className="text-dark-400 text-lg font-medium max-w-2xl">Manage your ecosystem contribution points and claim your share of protocol distributions through our fair-launch mechanism.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Main Points Display */}
        <div className="lg:col-span-2 glass-card p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 relative z-10">
            <div>
              <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-3">Available Points</p>
              <div className="flex items-baseline space-x-4">
                <h2 className="text-6xl font-black text-white tracking-tighter">{formatPoints(availablePoints)}</h2>
                <span className="text-2xl font-black text-primary-500">PTS</span>
              </div>
            </div>
            <div className="w-24 h-24 rounded-2xl bg-dark-900 border border-white/5 flex items-center justify-center text-5xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-primary-500/5" />
              <span className="relative z-10 filter drop-shadow-xl">🏆</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/5 relative z-10">
            {[
              { label: 'Total Earned 累计', value: formatPoints(totalPoints), icon: '📊' },
              { label: 'Claimed 已领取', value: formatPoints(claimedPoints), icon: '✅' },
              { label: 'Conversion Rate', value: '1U = 100 PTS', icon: '💱' },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-2">{item.label}</p>
                <p className="text-lg font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Claim Card */}
        <div className="glass-card p-10 border-primary-500/20 shadow-2xl shadow-primary-500/5 bg-gradient-to-b from-primary-500/[0.03] to-transparent">
          <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight flex items-center">
            <span className="w-2 h-6 bg-primary-500 rounded-full mr-3" />
            NST Airdrop
          </h3>
          <div className="space-y-6 mb-10">
            <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[9px] font-black text-dark-500 uppercase tracking-widest">Claimable NST</span>
              <span className="text-xl font-black text-primary-400">{parseFloat(claimableNST).toFixed(2)} NST</span>
            </div>
            {airdropInfo && airdropInfo.isActive && (
              <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                <div className="flex justify-between text-[9px] font-black text-dark-500 uppercase tracking-widest mb-3">
                  <span>Airdrop #{airdropInfo.airdropId}</span>
                  <span className="text-green-400">ACTIVE</span>
                </div>
                <div className="flex justify-between text-xs text-dark-400">
                  <span>End: {new Date(airdropInfo.endTime * 1000).toLocaleDateString()}</span>
                  <span>Pool: {formatUnits(airdropInfo.totalPool, 18)} NST</span>
                </div>
              </div>
            )}
            {claimError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs">
                {claimError}
              </div>
            )}
          </div>
          <button
            onClick={handleClaim}
            disabled={isLoading || parseFloat(claimableNST) === 0 || !airdropInfo?.isActive || claimSuccess}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all
              ${parseFloat(claimableNST) > 0 && airdropInfo?.isActive
                ? 'btn-primary shadow-lg shadow-primary-500/20'
                : 'bg-white/5 border border-white/10 text-dark-500 cursor-not-allowed'}`}
          >
            {isLoading ? 'Processing...' : claimSuccess ? '✓ Claimed!' : parseFloat(claimableNST) > 0 ? 'Claim NST' : 'No Pending Claims'}
          </button>
        </div>
      </div>

      {/* Rules Section */}
      <div>
        <h3 className="text-[11px] font-black text-dark-400 uppercase tracking-[0.3em] mb-10 text-center">How to Earn Points</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: 'Trading Fees', desc: 'Earn points for every protocol fee you pay when creating RFQs or accepting quotes.', rate: '100 pts / $1', icon: '💰' },
            { title: 'Creating Orders', desc: 'Points for active market participation as both buyer and seller.', rate: '1 pts / Fee U', icon: '📝' },
            { title: 'Airdrop Claims', desc: 'Redeem accumulated points for NST tokens during airdrop periods.', rate: 'Pro-rata Share', icon: '🎁' },
          ].map((rule, i) => (
            <div key={i} className="text-center group">
              <div className="w-16 h-16 rounded-2xl bg-dark-900 border border-white/5 flex items-center justify-center text-2xl mx-auto mb-6 group-hover:scale-110 transition-transform">
                {rule.icon}
              </div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider mb-2">{rule.title}</h4>
              <p className="text-dark-500 text-xs font-medium leading-relaxed mb-4 max-w-[200px] mx-auto">{rule.desc}</p>
              <span className="text-[10px] font-black text-primary-500/80 bg-primary-500/5 px-3 py-1 rounded-full">{rule.rate}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}

export default PointsCenter;
