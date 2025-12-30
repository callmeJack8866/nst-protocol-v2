import { useState, useEffect } from 'react';
import { useWallet, usePoints } from '../hooks';

export function PointsCenter() {
  const { isConnected, account } = useWallet();
  const { userPoints, fetchUserPoints, calculateClaimableNST, getCurrentAirdropId } = usePoints();
  const [claimableNST, setClaimableNST] = useState('0');

  useEffect(() => {
    if (isConnected && account) {
      fetchUserPoints();
      loadAirdropInfo();
    }
  }, [isConnected, account, fetchUserPoints]);

  const loadAirdropInfo = async () => {
    try {
      const airdropId = await getCurrentAirdropId();
      const claimable = await calculateClaimableNST(airdropId);
      setClaimableNST(claimable);
    } catch (e) {
      console.error("Failed to load airdrop info:", e);
    }
  };

  const totalPoints = userPoints ? Number(userPoints.totalPoints) : 12500;
  const claimedPoints = userPoints ? Number(userPoints.claimedPoints) : 2500;
  const formatPoints = (p: number) => new Intl.NumberFormat().format(p);

  if (!isConnected) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-20 text-center">
        <div className="glass-card p-20 animate-fade-in-up">
          <div className="text-8xl mb-8 opacity-30 grayscale"></div>
          <h3 className="text-3xl font-black text-white mb-4">Points Portfolio Locked</h3>
          <p className="text-dark-400 text-lg mb-10 max-w-sm mx-auto font-medium">Connect your wallet to synchronize your loyalty points and participate in ongoing distribution cycles.</p>
          <button className="btn-primary px-12 py-4 font-black">CONNECT WALLET</button>
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
        {/* Main Points Display - Spaced out */}
        <div className="lg:col-span-2 glass-card p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 relative z-10">
            <div>
              <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-3">Allocated Loyalty Points</p>
              <div className="flex items-baseline space-x-4">
                <h2 className="text-6xl font-black text-white tracking-tighter">{formatPoints(totalPoints - claimedPoints)}</h2>
                <span className="text-2xl font-black text-primary-500">NST</span>
              </div>
            </div>
            <div className="w-24 h-24 rounded-2xl bg-dark-900 border border-white/5 flex items-center justify-center text-5xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-primary-500/5" />
              <span className="relative z-10 filter drop-shadow-xl pulse-gold"></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/5 relative z-10">
            {[
              { label: 'Cumulative Points 累计', value: formatPoints(totalPoints), icon: '' },
              { label: 'Claimed Distribution 已领', value: formatPoints(claimedPoints), icon: '' },
              { label: 'Authorized Entity 主体', value: account ? `${account.slice(0, 8)}...${account.slice(-6)}` : 'N/A', icon: '', isMono: true },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-2">{item.label}</p>
                <p className={`text-lg font-bold text-white ${item.isMono ? 'font-mono text-xs opacity-70' : ''}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Claim Card - Cleaner */}
        <div className="glass-card p-10 border-primary-500/20 shadow-2xl shadow-primary-500/5 bg-gradient-to-b from-primary-500/[0.03] to-transparent">
          <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight flex items-center">
            <span className="w-2 h-6 bg-primary-500 rounded-full mr-3" />
            Active Distribution
          </h3>
          <div className="space-y-6 mb-10">
            <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[9px] font-black text-dark-500 uppercase tracking-widest">Available Allocation</span>
              <span className="text-xl font-black text-primary-400">{claimableNST} NST</span>
            </div>
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between text-[9px] font-black text-dark-500 uppercase tracking-widest mb-3">
                <span>Distribution Finalized</span>
                <span>100%</span>
              </div>
              <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div className="h-full bg-primary-500 rounded-full shadow-[0_0_10px_rgba(247,168,31,0.5)]" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
          <button
            disabled
            className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-dark-500 font-black uppercase tracking-widest text-xs cursor-not-allowed"
          >
            No Pending Claims
          </button>
        </div>
      </div>

      {/* Rules Section - Spaced and Minimalist */}
      <div>
        <h3 className="text-[11px] font-black text-dark-400 uppercase tracking-[0.3em] mb-10 text-center">Reward Distribution Taxonomy</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: 'Market Interaction', desc: 'Points accrued for every successfully settled option contract as either buyer or seller.', rate: '10 pts / $1k', icon: '' },
            { title: 'Governance Participation', desc: 'Secure community votes on protocol parameters and airdrop allocations.', rate: '50 pts / vote', icon: '' },
            { title: 'Early Adoption Bonus', desc: 'Multipliers applied to early platform supporters and high-frequency traders.', rate: '1.5x Multiplier', icon: '' },
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
