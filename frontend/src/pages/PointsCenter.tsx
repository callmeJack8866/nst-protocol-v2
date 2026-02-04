import { useState, useEffect } from 'react';
import { usePoints } from '../hooks';
import { useWalletContext } from '../context/WalletContext';
import { formatUnits } from 'ethers';
import { useTranslation } from 'react-i18next';

export function PointsCenter() {
  const { isConnected, userPoints, fetchUserPoints, getCurrentAirdrop, calculateClaimableNST, claimAirdrop, isLoading, getPointsHistory } = usePoints();
  const { connect } = useWalletContext();
  const { t } = useTranslation();
  const [claimableNST, setClaimableNST] = useState('0');
  const [airdropInfo, setAirdropInfo] = useState<any>(null);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchUserPoints();
      loadAirdropInfo();
      loadPointsHistory();
    }
  }, [isConnected]);

  const loadPointsHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await getPointsHistory();
      setPointsHistory(history);
    } catch (e) {
      console.error('Failed to load points history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

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
      setClaimError(e instanceof Error ? e.message : 'Claiming failed');
    }
  };

  const totalPoints = userPoints ? Number(formatUnits(userPoints.totalPoints, 0)) : 0;
  const claimedPoints = userPoints ? Number(formatUnits(userPoints.claimedPoints, 0)) : 0;
  const availablePoints = userPoints ? Number(formatUnits(userPoints.availablePoints, 0)) : 0;
  const formatPoints = (p: number) => new Intl.NumberFormat().format(p);

  if (!isConnected) {
    return (
      <div className="max-w-[1200px] mx-auto px-10 py-40 animate-elite-entry">
        <div className="glass-panel p-16 rounded-[56px] border-white/5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 blur-[100px] pointer-events-none" />
          <div className="w-24 h-24 rounded-[32px] bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-10 flex items-center justify-center animate-pulse">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">{t('points.loyalty_restricted')}</h3>
          <p className="text-gray-500 font-bold italic mb-12 max-w-sm mx-auto uppercase text-xs tracking-[0.2em]">{t('points.connect_wallet_access')}</p>
          <button onClick={() => connect()} className="btn-gold h-14 px-12 rounded-2xl text-[10px] tracking-widest italic font-black">{t('points.establish_elite_link')}</button>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-[1500px] mx-auto pt-16 pb-20 px-6 animate-elite-entry">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 mb-20">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">{t('points.protocol_value_matrix')}</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase italic">{t('points.rewards_terminal')}</h1>
          <p className="text-gray-500 text-xl max-w-2xl font-bold leading-relaxed italic">
            {t('points.page_description')}
          </p>
        </div>

        <div className="bg-obsidian-900/50 border border-white/5 p-1.5 rounded-2xl flex shadow-2xl">
          <div className="px-10 py-3 rounded-xl bg-white/5 border border-white/5">
            <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-1 text-center italic">{t('points.yield_acceleration')}</p>
            <p className="text-lg font-black text-emerald-500 italic text-center tracking-tighter">{t('points.boost_matrix')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-20">
        <div className="xl:col-span-2 glass-panel rounded-[56px] p-16 relative overflow-hidden group border-white/5">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/[0.03] blur-[160px] pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 mb-20 relative z-10">
            <div>
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-4 italic">{t('points.captured_score')}</p>
              <div className="flex items-baseline space-x-3">
                <h2 className="text-7xl font-black text-white tracking-tighter leading-none italic">{formatPoints(availablePoints)}</h2>
                <span className="text-xl font-black text-emerald-500 uppercase tracking-widest opacity-60">{t('points.pts')}</span>
              </div>
            </div>
            <div className="w-32 h-32 rounded-[32px] bg-obsidian-950 border border-white/5 flex items-center justify-center text-7xl shadow-2xl group-hover:scale-110 transition-transform duration-700">🥇</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-white/5 relative z-10">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-gray-700 uppercase italic">{t('points.cumulative_accrual')}</p>
                <p className="text-xl font-black text-white italic tracking-tighter">{formatPoints(totalPoints)} <span className="text-[8px] opacity-30 text-emerald-500 uppercase">{t('points.pts')}</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-gray-700 uppercase italic">{t('points.reward_realized')}</p>
                <p className="text-xl font-black text-white italic tracking-tighter">{formatPoints(claimedPoints)} <span className="text-[8px] opacity-30 text-emerald-500 uppercase">{t('points.pts')}</span></p>
              </div>
            </div>
            <div className="flex flex-col justify-center md:items-end">
              <p className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em] italic mb-3">{t('points.protocol_loyalty_tier')}</p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-8 py-2.5 rounded-full shadow-xl shadow-emerald-500/5">
                <span className="text-[10px] font-black text-emerald-400 tracking-[0.2em] uppercase italic">Platinum Prime Contributor</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel border-emerald-500/20 rounded-[56px] p-16 relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute inset-0 bg-emerald-500/[0.01]" />
          <div>
            <div className="flex items-center justify-between mb-16">
              <h3 className="text-[10px] font-black text-white italic tracking-[0.4em] uppercase">{t('points.distribution_center')}</h3>
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/20 italic animate-pulse">{t('points.cycle_active')}</span>
            </div>

            <div className="space-y-12">
              <div className="bg-obsidian-950/80 border border-white/5 rounded-[40px] p-10 flex flex-col items-center shadow-inner">
                <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-6 italic">{t('points.claimable_allocation')}</p>
                <div className="flex items-baseline space-x-3">
                  <p className="text-6xl font-black text-emerald-500 tracking-tighter italic">{parseFloat(claimableNST).toFixed(2)}</p>
                  <p className="text-xl font-black text-white opacity-20 italic">NST</p>
                </div>
              </div>

              {airdropInfo && airdropInfo.isActive && (
                <div className="space-y-5 px-4">
                  <div className="flex justify-between items-center"><span className="text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Protocol Round</span><span className="text-xs font-black text-white uppercase italic">#{airdropInfo.airdropId}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Total Pool Liquid</span><span className="text-xs font-black text-white italic tracking-tighter">{Number(formatUnits(airdropInfo.totalPool, 18)).toLocaleString()} NST</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-16">
            {claimError && <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center mb-6 animate-shake italic">{claimError}</p>}
            <button onClick={handleClaim} disabled={isLoading || parseFloat(claimableNST) === 0 || !airdropInfo?.isActive || claimSuccess} className="w-full btn-gold h-20 rounded-[32px] text-[12px] tracking-[0.4em] italic font-black shadow-2xl shadow-gold-500/10">
              {isLoading ? 'TRANSMITTING REQUEST...' : claimSuccess ? 'ALLOCATION SECURED' : 'CLAIM NST ALLOCATION'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-10 mb-20">
        <div className="flex items-center justify-between pb-6 border-b border-white/5 px-2">
          <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.5em] italic">Institutional Contribution Log</h4>
          <button className="text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-emerald-500/20 italic">EXPORT CSV RECORD</button>
        </div>

        <div className="glass-panel rounded-[48px] overflow-hidden border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-10 py-6 text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Signal Type</th>
                  <th className="px-10 py-6 text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Provenance Hash</th>
                  <th className="px-10 py-6 text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Yield Score</th>
                  <th className="px-10 py-6 text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Status</th>
                  <th className="px-10 py-6 text-[9px] font-black text-gray-700 uppercase tracking-widest italic">Synchronized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {historyLoading ? (
                  <tr><td colSpan={5} className="px-10 py-24 text-center"><div className="flex flex-col items-center space-y-6"><div className="w-10 h-10 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" /><p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em] italic">Indexing Chain State...</p></div></td></tr>
                ) : pointsHistory.length === 0 ? (
                  <tr><td colSpan={5} className="px-10 py-24 text-center"><div className="space-y-6"><p className="text-4xl grayscale opacity-20">📊</p><p className="text-[11px] font-black text-gray-800 uppercase tracking-[0.6em] italic leading-loose">No institutional contribution metadata detected in current window</p></div></td></tr>
                ) : pointsHistory.map((log, i) => (
                  <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-10 py-8"><div className="flex items-center gap-4"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /><span className="text-[11px] font-black text-white italic tracking-widest uppercase">{log.type}</span></div></td>
                    <td className="px-10 py-8"><a href={`https://testnet.bscscan.com/tx/${log.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono font-bold text-gray-600 transition-all hover:text-emerald-500 uppercase tracking-tighter">{log.source}</a></td>
                    <td className="px-10 py-8"><span className="text-2xl font-black text-emerald-500 italic tracking-tighter">{log.points}</span></td>
                    <td className="px-10 py-8"><span className="px-4 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest italic">{log.status}</span></td>
                    <td className="px-10 py-8 text-[11px] font-bold text-gray-700 group-hover:text-gray-400 transition-colors italic uppercase">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-10 bg-white/[0.02] border-t border-white/5 flex justify-center"><button className="text-[10px] font-black text-gray-800 uppercase tracking-[0.5em] hover:text-white transition-all italic">LOAD EXTENDED METADATA</button></div>
        </div>
      </div>

      <div className="space-y-20">
        <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.6em] text-center italic underline underline-offset-8 decoration-white/5">Ecosystem Contribution Yield Matrix</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Liquidity Provision (LP)', rate: '100 PTS / $1 FEE', desc: 'Secure protocol solvency by providing underlying collateral for OTC desks.' },
            { title: 'RFQ Initiation', rate: '50 PTS / $1 FEE', desc: 'Activate execution layers by broadcasting high-density institutional orders.' },
            { title: 'Governance Staking', rate: 'STAKING_BOOST', desc: 'Lock capital to amplify your reward matrix and capture governance yield.' },
          ].map((rule, i) => (
            <div key={i} className="glass-panel rounded-[56px] p-12 text-center group border-white/5 hover:border-emerald-500/20 transition-all duration-700 relative overflow-hidden">
              <div className="absolute inset-0 bg-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl mb-8 group-hover:scale-110 transition-transform duration-700 inline-block">🛡️</div>
              <h5 className="text-xl font-black text-white italic tracking-tighter uppercase mb-4 leading-tight">{rule.title}</h5>
              <p className="text-gray-500 font-bold text-[10px] leading-relaxed mb-10 italic uppercase tracking-widest">{rule.desc}</p>
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-8 py-3 rounded-full uppercase tracking-[0.2em] italic shadow-xl shadow-emerald-500/5">{rule.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PointsCenter;
