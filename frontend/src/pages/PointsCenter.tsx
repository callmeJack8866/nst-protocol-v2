import { useState, useEffect } from 'react';
import { usePoints } from '../hooks';
import { useWalletContext } from '../context/WalletContext';
import { formatUnits } from 'ethers';

export function PointsCenter() {
  const { isConnected, userPoints, fetchUserPoints, getCurrentAirdrop, calculateClaimableNST, claimAirdrop, isLoading, getPointsHistory } = usePoints();
  const { connect } = useWalletContext();
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
      setClaimError(e instanceof Error ? e.message : '提取失败');
    }
  };

  const totalPoints = userPoints ? Number(formatUnits(userPoints.totalPoints, 0)) : 0;
  const claimedPoints = userPoints ? Number(formatUnits(userPoints.claimedPoints, 0)) : 0;
  const availablePoints = userPoints ? Number(formatUnits(userPoints.availablePoints, 0)) : 0;
  const formatPoints = (p: number) => new Intl.NumberFormat().format(p);

  if (!isConnected) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-16 text-center animate-elite-entry">
        <div className="glass-surface p-16 rounded-[40px] border-dashed border-white/10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-8">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-3">请先连接钱包</h3>
          <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto leading-relaxed">连接以查看您的积分余额和 NST 代币分配权益</p>
          <button onClick={() => connect()} className="btn-elite-primary px-8 h-12 text-sm font-semibold">连接钱包</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-16 animate-elite-entry">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10 mb-16">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-500/80 tracking-wide">生态价值与贡献</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight">积分中心</h1>
          <p className="text-slate-400 text-base max-w-xl leading-relaxed">
            参与协议治理与流动性提供，捕获 NST 代币的早期分配权益
          </p>
        </div>

        <div className="flex bg-slate-900 border border-white/[0.08] p-1.5 rounded-2xl">
          <div className="px-8 py-3 rounded-xl bg-white/[0.05] border border-white/[0.05]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">当前收益加成</p>
            <p className="text-lg font-bold text-emerald-400 italic text-center">1.2x Boost</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-24">
        {/* Balance Card */}
        <div className="lg:col-span-2 glass-surface rounded-[56px] p-16 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/[0.03] blur-[140px] -mr-48 -mt-48 transition-opacity duration-1000 group-hover:opacity-100" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 mb-20 relative z-10">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3 tracking-wide">可提取积分余额</p>
              <div className="flex items-baseline space-x-3">
                <h2 className="text-6xl font-bold text-white tracking-tight leading-none">{formatPoints(availablePoints)}</h2>
                <span className="text-xl font-bold text-emerald-500">pts</span>
              </div>
            </div>
            <div className="w-32 h-32 rounded-[32px] bg-slate-950 border border-white/5 flex items-center justify-center text-7xl shadow-inner group-hover:scale-110 transition-transform duration-700">🥇</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-16 border-t border-white/[0.05] relative z-10">
            <div className="flex items-center space-x-6">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-[10px] font-black text-slate-600 uppercase mb-2 tracking-widest">累计获取收益</p>
                <p className="text-xl font-bold text-white tracking-tight">{formatPoints(totalPoints)} <span className="text-xs opacity-30">pts</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-[10px] font-black text-slate-600 uppercase mb-2 tracking-widest">已领奖励份额</p>
                <p className="text-xl font-bold text-white tracking-tight">{formatPoints(claimedPoints)} <span className="text-xs opacity-30">pts</span></p>
              </div>
            </div>
            <div className="flex flex-col justify-center items-end">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Protocol Loyalty Rank</p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-full">
                <span className="text-[11px] font-black text-emerald-400 tracking-[0.2em] uppercase">Platinum Contributor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Claim Terminal */}
        <div className="glass-surface border-emerald-500/20 rounded-[56px] p-16 relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute inset-0 bg-emerald-500/[0.01]" />
          <div>
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-lg font-black text-white italic tracking-widest uppercase">权益分发 Distribution</h3>
              <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/10">周期进行中</span>
            </div>

            <div className="space-y-10 mb-16">
              <div className="bg-slate-950/60 border border-white/5 rounded-[32px] p-10 flex flex-col items-center">
                <p className="text-label opacity-40 uppercase mb-4">当前可领奖励 Claimable NST</p>
                <div className="flex items-baseline space-x-3">
                  <p className="text-5xl font-bold text-emerald-400 tracking-tight">{parseFloat(claimableNST).toFixed(2)}</p>
                  <p className="text-xl font-bold text-white opacity-40 italic">NST</p>
                </div>
              </div>

              {airdropInfo && airdropInfo.isActive && (
                <div className="space-y-6 px-4">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className="text-slate-600">分发周期 ID</span>
                    <span className="text-white">#{airdropInfo.airdropId}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className="text-slate-600">本轮总池额度</span>
                    <span className="text-white font-mono">{Number(formatUnits(airdropInfo.totalPool, 18)).toLocaleString()} NST</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {claimError && (
              <p className="text-[11px] font-black text-rose-500 uppercase tracking-widest text-center mb-6 animate-shake">{claimError}</p>
            )}
            <button
              onClick={handleClaim}
              disabled={isLoading || parseFloat(claimableNST) === 0 || !airdropInfo?.isActive || claimSuccess}
              className="w-full btn-elite-primary h-20 rounded-[28px] text-[13px] tracking-[0.3em] disabled:opacity-20 disabled:backdrop-grayscale shadow-2xl"
            >
              {isLoading ? '正在广播提取请求...' : claimSuccess ? '提取已发放到账' : '立即提取 NST 奖励'}
            </button>
          </div>
        </div>
      </div>

      {/* Points History - PointsSourceList (Elite 2.1 新增) */}
      <div className="space-y-12 mb-24">
        <div className="flex items-center justify-between pb-8 border-b border-white/[0.05]">
          <h4 className="text-[12px] font-black text-slate-500 uppercase tracking-[0.5em] italic">积分获取详情 Points Acquisition Log</h4>
          <button className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:text-white transition-colors">导出完整报表 Export CSV</button>
        </div>

        <div className="glass-surface rounded-[40px] overflow-hidden border-white/[0.03]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">操作类型 Type</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">关联凭据 Source</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">获取积分 Points</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">状态 Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">记录时间 Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {historyLoading ? (
                <tr>
                  <td colSpan={5} className="px-10 py-16 text-center">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">正在读取链上积分记录...</span>
                    </div>
                  </td>
                </tr>
              ) : pointsHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-16 text-center">
                    <div className="space-y-4">
                      <div className="text-4xl opacity-30">📊</div>
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">暂无积分记录 NO RECORDS YET</p>
                      <p className="text-[10px] text-slate-700">参与交易、报价或喂价后将在此显示积分获取详情</p>
                    </div>
                  </td>
                </tr>
              ) : pointsHistory.map((log, i) => (
                <tr key={i} className="group hover:bg-white/[0.01] transition-colors">
                  <td className="px-10 py-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      <span className="text-[12px] font-bold text-white tracking-widest uppercase italic">{log.type}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <a
                      href={`https://testnet.bscscan.com/tx/${log.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-emerald-400 transition-colors hover:underline"
                    >
                      {log.source}
                    </a>
                  </td>
                  <td className="px-10 py-8">
                    <span className="text-xl font-bold text-emerald-400 italic tracking-tighter">{log.points}</span>
                  </td>
                  <td className="px-10 py-8">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-[11px] font-bold text-slate-600 group-hover:text-slate-400 transition-colors">
                    {log.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-10 bg-white/[0.02] border-t border-white/[0.05] flex justify-center">
            <button className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] hover:text-white transition-all">查看更多贡献记录 LOAD MORE RECORDS</button>
          </div>
        </div>
      </div>

      {/* Mechanics Grid */}
      <div className="space-y-20">
        <h4 className="text-[12px] font-black text-slate-700 uppercase tracking-[0.6em] text-center italic">贡献价值获取矩阵 Protocol Distribution Rules</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: '流动性提供 (LP)', rate: '100 积分 / $1 费用', desc: '作为承销方为全公开市场提供底层担保资本，捕获手续费积分。' },
            { title: '发起询价 (RFQ)', rate: '50 积分 / $1 费用', desc: '通过广播高质量报价请求激活协议成交，提升全网数据密度。' },
            { title: '治理与质押', rate: 'Staking Boost', desc: '通过锁定资产提升您的收益加成，加速积分矩阵的获取速度。' },
          ].map((rule, i) => (
            <div key={i} className="glass-surface rounded-[48px] p-12 text-center group hover:border-emerald-500/20 transition-all duration-700 relative overflow-hidden">
              <div className="absolute inset-0 bg-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl mb-8 group-hover:scale-110 transition-transform duration-700 inline-block">🛡️</div>
              <h5 className="text-white font-black text-base uppercase tracking-widest mb-4 italic leading-tight">{rule.title}</h5>
              <p className="text-slate-600 font-bold text-[11px] leading-relaxed mb-10 uppercase tracking-wider">{rule.desc}</p>
              <span className="text-[11px] font-black text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 px-6 py-2.5 rounded-full uppercase tracking-widest">{rule.rate}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-32" />
    </div>
  );
}

export default PointsCenter;
