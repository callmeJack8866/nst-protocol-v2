import { useState, useEffect, useCallback } from 'react';
import { useWallet, useFeedProtocol, useOptions } from '../hooks';
import { formatUnits } from 'ethers';
import { useTranslation } from 'react-i18next';
import type { FeedRequest, Feeder } from '../hooks/useFeedAndPoints';


// Feed type labels
const FEED_TYPE_LABELS: Record<number, string> = {
  0: 'INITIAL TICK',
  1: 'DYNAMIC TICK',
  2: 'SETTLEMENT TICK',
  3: 'ARBITRATION',
};

// Feed tier labels
const FEED_TIER_LABELS: Record<number, { name: string; desc: string }> = {
  0: { name: 'Tier 5-3', desc: '5 Feeders, Median of 3' },
  1: { name: 'Tier 7-5', desc: '7 Feeders, Median of 5' },
  2: { name: 'Tier 10-7', desc: '10 Feeders, Median of 7' },
};

const FEEDER_RANKS = [
  { name: 'Rookie', minFeeds: 0, maxFeeds: 9, color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10', emoji: '🌱' },
  { name: 'Regular', minFeeds: 10, maxFeeds: 49, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', emoji: '⚡' },
  { name: 'Expert', minFeeds: 50, maxFeeds: 199, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', emoji: '🔮' },
  { name: 'Elite', minFeeds: 200, maxFeeds: Infinity, color: 'text-premium-gold', bg: 'bg-premium-gold/10', border: 'border-premium-gold/20', emoji: '👑' },
];

const getFeederRank = (completedFeeds: number) => {
  return FEEDER_RANKS.find(r => completedFeeds >= r.minFeeds && completedFeeds <= r.maxFeeds) || FEEDER_RANKS[0];
};

const getRankProgress = (completedFeeds: number): { current: number; next: number; percent: number } => {
  const rank = getFeederRank(completedFeeds);
  const nextRank = FEEDER_RANKS.find(r => r.minFeeds > completedFeeds);
  if (!nextRank) return { current: completedFeeds, next: completedFeeds, percent: 100 };
  const progress = completedFeeds - rank.minFeeds;
  const total = nextRank.minFeeds - rank.minFeeds;
  return { current: completedFeeds, next: nextRank.minFeeds, percent: Math.round((progress / total) * 100) };
};

export function FeederPanel() {
  const { isConnected, account, connect } = useWallet();
  const { t } = useTranslation();
  const {

    isLoading: feedLoading,
    error: feedError,
    getFeederInfo,
    getPendingRequests,
    submitFeed,
    rejectFeed,
    registerFeeder,
  } = useFeedProtocol();
  const { getOrder } = useOptions();

  const [feederInfo, setFeederInfo] = useState<Feeder | null>(null);
  const [pendingRequests, setPendingRequests] = useState<FeedRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FeedRequest | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [stakeAmount, setStakeAmount] = useState('100');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [volumeFeedMode, setVolumeFeedMode] = useState<'confirm' | 'modify' | 'reject'>('confirm');

  const loadData = useCallback(async () => {
    if (!isConnected || !account) return;
    try {
      const [info, requests] = await Promise.all([
        getFeederInfo(),
        getPendingRequests(),
      ]);
      setFeederInfo(info);
      setPendingRequests(requests);
    } catch (e) {
      console.error('Failed to load feeder data:', e);
    }
  }, [isConnected, account, getFeederInfo, getPendingRequests]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleSubmitFeed = async () => {
    if (!selectedRequest) return;
    let finalPrice = priceInput;
    if (selectedRequest.feedRule === 1 && volumeFeedMode === 'confirm') {
      finalPrice = selectedRequest.suggestedPrice || '';
    }
    if (!finalPrice) return;
    try {
      await submitFeed(Number(selectedRequest.requestId), finalPrice);
      setShowFeedModal(false);
      setPriceInput('');
      setSelectedRequest(null);
      setVolumeFeedMode('confirm');
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('Failed to submit feed:', e);
    }
  };

  const handleRejectFeed = async () => {
    if (!selectedRequest || !rejectReason) return;
    try {
      await rejectFeed(Number(selectedRequest.requestId), rejectReason);
      setShowFeedModal(false);
      setRejectReason('');
      setSelectedRequest(null);
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('Failed to reject feed:', e);
    }
  };

  const handleRegister = async () => {
    try {
      await registerFeeder(stakeAmount);
      setShowRegisterModal(false);
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('Failed to register as feeder:', e);
    }
  };

  const getTimeRemaining = (deadline: bigint) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = deadline - now;
    if (remaining <= 0n) return 'SESSION_EXPIRED';
    const minutes = Number(remaining / 60n);
    const seconds = Number(remaining % 60n);
    return `${minutes}:${seconds.toString().padStart(2, '0')} `;
  };

  if (!isConnected) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center p-12">
        <div className="obsidian-glass p-20 rounded-[64px] border-white/5 text-center relative overflow-hidden grid-bg max-w-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-premium-gold/5 blur-[100px] pointer-events-none" />
          <div className="w-24 h-24 rounded-[36px] bg-premium-gold/10 border border-premium-gold/20 mx-auto mb-10 flex items-center justify-center animate-pulse">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2.5">
              <path d="M2.27 19a10 10 0 0 1 0-14M5.66 17.34a6 6 0 0 1 0-10.68M12 12l0 1M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4">{t('feeder.node_link_offline')}</h3>
          <p className="text-white/20 font-bold italic mb-12 max-w-sm mx-auto uppercase text-[10px] tracking-[0.3em] leading-relaxed">{t('feeder.authorize_credentials')}</p>
          <button onClick={() => connect()} className="btn-gold h-16 px-14 rounded-2xl text-[11px] tracking-widest italic font-black shadow-2xl">{t('points.establish_elite_link')}</button>
        </div>
      </div>
    );
  }


  return (
    <div className="w-full flex flex-col pb-20 space-y-20">
      {/* Header section explicitly closed */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-12">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_12px_#3b82f6]" />
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">{t('feeder.oracle_authority_hub')}</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight italic">{t('feeder.price')} <span className="text-blue-500">{t('feeder.authority')}</span> {t('feeder.console')}</h1>
          <p className="text-white/40 text-lg max-w-2xl font-bold leading-snug">
            {t('feeder.page_description')}
          </p>
        </div>

        {feederInfo?.isActive ? (
          <div className="obsidian-glass px-10 py-5 rounded-[32px] border-blue-500/20 bg-blue-500/5 flex items-center space-x-6">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] italic">{t('feeder.cluster_identified')}</span>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{t('feeder.active_broadcasting')}</span>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowRegisterModal(true)} className="btn-gold h-18 px-14 rounded-[32px] text-[11px] tracking-widest italic shadow-xl shadow-blue-600/20 !bg-blue-600 !text-white !border-none">{t('feeder.activate_oracle_node')}</button>
        )}
      </div>

      {/* Stats Dashboard */}
      {feederInfo?.isActive && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: t('feeder.signal_broadcasts'), value: feederInfo.completedFeeds?.toString() || '0', color: 'text-white' },
            { label: t('feeder.staked_liquidity'), value: `${formatUnits(feederInfo.stakedAmount || 0n, 6)} USDT`, color: 'text-blue-500' },
            { label: t('feeder.active_tasks'), value: pendingRequests.length.toString(), color: 'text-emerald-500' },
            { label: t('feeder.signal_conflicts'), value: feederInfo.rejectedFeeds?.toString() || '0', color: 'text-red-500' },
          ].map((stat, i) => (
            <div key={i} className="obsidian-glass p-10 rounded-[48px] group border-white/5 relative overflow-hidden grid-bg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4 italic">{stat.label}</p>
              <p className={`text - 4xl font - black italic tracking - tighter ${stat.color} `}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rank Section */}
      {feederInfo?.isActive && (() => {
        const completedFeeds = Number(feederInfo.completedFeeds || 0);
        const rank = getFeederRank(completedFeeds);
        const progress = getRankProgress(completedFeeds);
        return (
          <div className="obsidian-glass rounded-[64px] p-12 flex flex-col lg:flex-row items-center justify-between gap-16 border-white/5 relative overflow-hidden grid-bg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-10 relative z-10 w-full lg:w-auto">
              <div className={`w - 32 h - 32 rounded - [40px] ${rank.bg} border ${rank.border} flex items - center justify - center text - 6xl shadow - 2xl relative`}>
                <div className="absolute inset-0 bg-current opacity-10 rounded-[40px] animate-pulse" />
                <span className="relative z-10">{rank.emoji}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] mb-2 block italic">Feeder Intelligence Rank</span>
                <h3 className={`text - 5xl font - black italic tracking - tighter uppercase ${rank.color} `}>{rank.name} <span className="text-2xl opacity-40 italic">PERSISTENCE</span></h3>
                <div className="flex items-center gap-4 mt-2">
                  <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[10px] font-black text-white/40 italic uppercase tracking-widest">{completedFeeds} CONFIRMED TICKS</div>
                </div>
              </div>
            </div>
            {progress.percent < 100 ? (
              <div className="flex-1 max-w-2xl relative z-10 w-full">
                <div className="flex justify-between text-[11px] font-black mb-4 uppercase tracking-[0.2em] italic">
                  <span className="text-white/20">Rank Evolution Simulation</span>
                  <span className="text-white">{progress.current} <span className="opacity-20">/</span> {progress.next} <span className="opacity-40 italic ml-2">DATA POINTS</span></span>
                </div>
                <div className="h-4 bg-obsidian-950/80 rounded-full overflow-hidden p-1 border border-white/5 shadow-inner">
                  <div className="h-full rounded-full transition-all duration-[2000ms] shadow-[0_0_20px_rgba(59,130,246,0.5)]" style={{ width: `${progress.percent}% `, backgroundColor: rank.color.includes('gold') ? '#EAB308' : rank.color.includes('purple') ? '#a855f7' : '#3b82f6' }} />
                </div>
              </div>
            ) : (
              <div className="px-12 py-6 rounded-[36px] bg-premium-gold/10 border border-premium-gold/30 shadow-2xl shadow-premium-gold/10 relative z-10 text-center">
                <span className="text-premium-gold font-black text-[12px] uppercase tracking-[0.5em] italic">APEX ORACLE STATUS LOCKED</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Main Queue */}
      <div className="space-y-12">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-8 px-4">
          <div className="flex items-center gap-6">
            <h2 className="text-[12px] font-black text-white tracking-[0.5em] uppercase italic">{t('feeder.signal_queue')}</h2>
            <div className="px-4 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-500 italic tracking-widest">{pendingRequests.length} {t('feeder.active_tasks').toUpperCase()}</div>
          </div>
          <button onClick={() => setRefreshKey(k => k + 1)} className="text-[11px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-blue-500/30 italic">{t('feeder.sync_infrastructure')}</button>
        </div>

        <div className="grid grid-cols-1 gap-12">
          {pendingRequests.length === 0 ? (
            <div className="obsidian-glass p-40 rounded-[72px] text-center border-dashed border-white/5 bg-white/[0.01]">
              <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center text-4xl mx-auto mb-10 opacity-10">🔭</div>
              <p className="text-[15px] font-black text-white/10 uppercase tracking-[0.8em] italic leading-loose">Passive Monitoring Mode — Node Cluster reporting zero task interference</p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div key={Number(req.requestId)} className="group obsidian-glass p-12 rounded-[64px] border-white/5 hover:border-blue-500/30 transition-all duration-700 relative overflow-hidden grid-bg">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[160px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-16 relative z-10">
                  <div className="flex items-center space-x-12">
                    <div className="w-28 h-28 rounded-[44px] bg-obsidian-950/80 border border-white/5 flex items-center justify-center text-6xl shadow-2xl group-hover:scale-105 transition-transform duration-700 relative overflow-hidden">
                      <div className="absolute inset-0 bg-blue-500/5" />
                      <span className="relative z-10">📡</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-5">
                        <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase whitespace-nowrap">STRAT-#{Number(req.orderId)}</h3>
                        <span className="px-5 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest italic">{FEED_TYPE_LABELS[req.feedType]}</span>
                        <span className="px-5 py-2 rounded-2xl bg-premium-gold/10 border border-premium-gold/30 text-[10px] font-black text-premium-gold uppercase tracking-widest italic">{FEED_TIER_LABELS[req.tier]?.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] italic">Task-0x{Number(req.requestId).toString(16).toUpperCase()}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span className={`text - [10px] font - black uppercase tracking - widest italic ${req.feedRule === 1 ? 'text-purple-400' : 'text-emerald-500'} `}>{req.feedRule === 1 ? 'VOLUME CONFORMATION REQUIRED' : 'SPOT PRICE BROADCAST'}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">QUORUM: {Number(req.submittedCount)} / {Number(req.totalFeeders)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 xl:border-l border-white/5 xl:pl-16 flex flex-col md:flex-row md:items-center justify-between gap-12">
                    <div className="grid grid-cols-2 gap-16">
                      <div className="space-y-2">
                        <span className="section-label">Session Deadline</span>
                        <p className="text-3xl font-black text-white italic tracking-tighter">{getTimeRemaining(req.deadline)}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="section-label">Broadcast Result</span>
                        <p className="text-3xl font-black text-emerald-500 italic tracking-tighter uppercase">Secure</p>
                      </div>
                    </div>
                    <button onClick={async () => {
                      setSelectedRequest(req);
                      setShowFeedModal(true);
                      setSelectedOrderDetails(null);
                      try {
                        const details = await getOrder(Number(req.orderId));
                        setSelectedOrderDetails(details);
                      } catch (e) { console.error(e); }
                    }} className="btn-gold h-18 px-12 text-[11px] tracking-widest font-black italic shadow-2xl shadow-premium-gold/10 whitespace-nowrap !bg-white !text-obsidian-950">ENGAGE BROADCAST</button>
                  </div>
                </div>
                {req.feedRule === 1 && req.suggestedPrice && (
                  <div className="mt-12 p-10 obsidian-glass bg-purple-500/5 border border-purple-500/20 rounded-[40px] flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div className="flex items-center gap-8">
                      <div className="w-16 h-16 rounded-[28px] bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-3xl shadow-xl">🕯️</div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-purple-400/60 uppercase tracking-widest italic">Counterparty Suggested Execution</span>
                        <p className="text-3xl font-black text-white italic tracking-tighter">{req.suggestedPrice}</p>
                      </div>
                    </div>
                    <div className="max-w-md lg:text-right border-l lg:border-l-0 lg:border-r border-white/10 pl-8 lg:pl-0 lg:pr-8">
                      <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic leading-relaxed">
                        Verify mark-to-market accuracy via primary data nodes. Feeder may certify or strictly override based on verified liquidity analytics.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-500">
          <div className="w-full max-w-xl obsidian-glass rounded-[64px] p-20 text-center relative border-white/10 shadow-2xl grid-bg">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[160px] pointer-events-none" />
            <div className="w-24 h-24 rounded-[36px] bg-blue-500/10 border border-blue-500/30 mx-auto flex items-center justify-center text-4xl mb-10 shadow-xl">🛡️</div>
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-3">Protocol <span className="text-blue-500">Enrollment</span></h2>
            <p className="text-white/20 font-bold italic mb-14 uppercase text-[10px] tracking-[0.3em] leading-relaxed max-w-sm mx-auto">Stake institutional liquidity to activate primary Oracle capabilities and join the Consensus Matrix.</p>
            <div className="space-y-12">
              <div className="space-y-5 flex flex-col">
                <div className="flex justify-between px-2">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Activation Deposit (USDT)</span>
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest italic">Min. 100.00</span>
                </div>
                <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className="obsidian-input h-20 w-full text-4xl font-black italic pr-10" />
              </div>
              <div className="flex gap-6">
                <button onClick={() => setShowRegisterModal(false)} className="flex-1 h-18 rounded-[28px] obsidian-glass border-white/10 text-[11px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all">ABORT</button>
                <button onClick={handleRegister} disabled={feedLoading || Number(stakeAmount) < 100} className="flex-1 h-18 rounded-[28px] bg-blue-600 text-white font-black text-[11px] tracking-widest uppercase italic shadow-2xl shadow-blue-600/30">CONFIRM & ACTIVATE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcasting Modal */}
      {showFeedModal && selectedRequest && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-500">
          <div className="w-full max-w-3xl obsidian-glass rounded-[72px] p-20 relative border-white/10 shadow-2xl grid-bg max-h-[95vh] overflow-y-auto custom-scroll">
            <div className="absolute top-0 right-0 w-96 h-96 bg-premium-gold/5 blur-[160px] pointer-events-none" />
            <div className="flex flex-col items-center gap-4 mb-14 text-center">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.5em] italic">Intelligence Broadcast Engagement</span>
              <h2 className="text-4xl font-black text-white italic tracking-tight uppercase">Tick Integration <span className="text-premium-gold">Matrix</span></h2>
              <div className="flex items-center gap-4 opacity-40">
                <span className="text-[10px] font-bold uppercase tracking-widest">SID: Pos-#{Number(selectedRequest.orderId)}</span>
                <div className="w-1 h-1 bg-white rounded-full" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{FEED_TYPE_LABELS[selectedRequest.feedType]}</span>
              </div>
            </div>

            <div className="space-y-16">
              {selectedRequest.feedRule === 1 ? (
                <div className="space-y-8">
                  <span className="text-[9px] font-black text-white/40 uppercase italic tracking-[0.4em] mb-2 block">Volume Conformation Path</span>
                  <div className="grid grid-cols-1 gap-6 flex flex-col">
                    <button onClick={() => setVolumeFeedMode('confirm')} className={`group relative p - 8 rounded - [40px] border text - left transition - all duration - 500 ${volumeFeedMode === 'confirm' ? 'bg-emerald-500/10 border-emerald-500/40 shadow-2xl' : 'bg-white/[0.02] border-white/10 hover:border-white/20'} `}>
                      <div className="flex items-center gap-8">
                        <div className={`w - 10 h - 10 rounded - 2xl border - 2 flex items - center justify - center transition - colors ${volumeFeedMode === 'confirm' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10'} `}>{volumeFeedMode === 'confirm' && <div className="w-4 h-4 rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/50" />}</div>
                        <div className="space-y-1">
                          <p className={`text - [10px] font - black uppercase italic tracking - widest ${volumeFeedMode === 'confirm' ? 'text-emerald-500' : 'text-white/20'} `}>Acknowledge Execution Price</p>
                          <p className="text-4xl font-black text-white italic tracking-tighter">{selectedRequest.suggestedPrice}</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => setVolumeFeedMode('modify')} className={`group relative p - 8 rounded - [40px] border text - left transition - all duration - 500 ${volumeFeedMode === 'modify' ? 'bg-blue-500/10 border-blue-500/40 shadow-2xl' : 'bg-white/[0.02] border-white/10 hover:border-white/20'} `}>
                      <div className="flex items-center gap-8 mb-4">
                        <div className={`w - 10 h - 10 rounded - 2xl border - 2 flex items - center justify - center transition - colors ${volumeFeedMode === 'modify' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'} `}>{volumeFeedMode === 'modify' && <div className="w-4 h-4 rounded-lg bg-blue-500 shadow-lg shadow-blue-500/50" />}</div>
                        <p className={`text - [10px] font - black uppercase italic tracking - widest ${volumeFeedMode === 'modify' ? 'text-blue-500' : 'text-white/20'} `}>Manual Intelligence Override</p>
                      </div>
                      {volumeFeedMode === 'modify' && (
                        <div className="relative animate-in slide-in-from-top-4 duration-500">
                          <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className="obsidian-input h-18 w-full text-3xl font-black italic pr-12" placeholder="0.0000" />
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black italic text-white/20">USD</span>
                        </div>
                      )}
                    </button>
                    <button onClick={() => setVolumeFeedMode('reject')} className={`group relative p - 8 rounded - [40px] border text - left transition - all duration - 500 ${volumeFeedMode === 'reject' ? 'bg-red-500/10 border-red-500/40 shadow-2xl' : 'bg-white/[0.02] border-white/10 hover:border-white/20'} `}>
                      <div className="flex items-center gap-8">
                        <div className={`w - 10 h - 10 rounded - 2xl border - 2 flex items - center justify - center transition - colors ${volumeFeedMode === 'reject' ? 'border-red-500 bg-red-500/10' : 'border-white/10'} `}>{volumeFeedMode === 'reject' && <div className="w-4 h-4 rounded-lg bg-red-500 shadow-lg shadow-red-500/50" />}</div>
                        <div className="space-y-1">
                          <p className={`text - [10px] font - black uppercase italic tracking - widest ${volumeFeedMode === 'reject' ? 'text-red-500' : 'text-white/20'} `}>Reject Signal Accuracy</p>
                          <p className="text-lg font-bold text-white/60 tracking-tight">Report Invalid Liquidity / Illegal Context</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 flex flex-col">
                  <span className="text-[9px] font-black text-white/40 uppercase italic tracking-[0.4em] mb-2 block">Primary Market Tick Upload</span>
                  <div className="relative">
                    <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} placeholder="0.0000" className="obsidian-input h-24 w-full text-6xl font-black italic pr-20" />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-sm font-black italic text-white/20 tracking-widest">USD TICK</span>
                  </div>
                </div>
              )}

              <div className="bg-white/[0.02] rounded-[40px] p-10 border border-white/5 space-y-10 grid-bg">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-premium-gold shadow-[0_0_8px_#EAB308]" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] italic">Strategy Constraint Audit</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
                  <div className="space-y-2 flex flex-col">
                    <p className="text-[9px] font-black text-white/20 uppercase italic">Settlement</p>
                    <p className="text-sm font-black text-white uppercase italic tracking-tight">{selectedOrderDetails?.liquidationRule === 0 ? 'MATURITY' : 'AUTO-EXIT'}</p>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <p className="text-[9px] font-black text-white/20 uppercase italic">Adjustment</p>
                    <p className="text-sm font-black text-white uppercase italic tracking-tight">{selectedOrderDetails?.dividendAdjustment ? 'VOTING' : 'STATIC'}</p>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <p className="text-[9px] font-black text-white/20 uppercase italic">Exp. Delay</p>
                    <p className="text-sm font-black text-white uppercase italic tracking-tight">T+{selectedOrderDetails?.exerciseDelay || '0'}</p>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <p className="text-[9px] font-black text-white/20 uppercase italic">Underlying</p>
                    <p className="text-sm font-black text-premium-gold uppercase italic tracking-widest">{selectedOrderDetails?.underlyingCode}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-8">
                <button onClick={() => { setShowFeedModal(false); setSelectedRequest(null); setPriceInput(''); setVolumeFeedMode('confirm'); }} className="flex-1 h-20 rounded-[32px] obsidian-glass border-white/10 text-[11px] font-black text-white/20 uppercase tracking-widest italic hover:text-white transition-all">ABORT ENGAGEMENT</button>
                {selectedRequest.feedRule === 1 && volumeFeedMode === 'reject' ? (
                  <button onClick={() => { setRejectReason('INVALID_LIQUIDITY'); handleRejectFeed(); }} className="flex-1 h-20 rounded-[32px] bg-red-600 text-white font-black text-[12px] tracking-widest uppercase italic shadow-2xl shadow-red-600/30">CONFIRM REJECTION</button>
                ) : (
                  <button onClick={handleSubmitFeed} disabled={feedLoading} className="flex-1 h-20 rounded-[32px] btn-gold text-lg italic shadow-2xl shadow-premium-gold/20 flex items-center justify-center gap-6">
                    {feedLoading ? 'TRANSMITTING...' : 'AUTHORIZE BROADCAST'}
                    {!feedLoading && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m5 12 14 0m-7-7 7 7-7 7" /></svg>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {feedError && (
        <div className="fixed bottom-12 right-12 obsidian-glass border-red-500/40 bg-red-500/10 rounded-[32px] p-8 text-red-500 font-black text-[11px] tracking-widest uppercase italic animate-in slide-in-from-right-20 duration-500 flex items-center gap-6 shadow-2xl z-[200]">
          <div className="w-8 h-8 rounded-xl bg-red-500 text-obsidian-950 flex items-center justify-center text-xl shadow-lg shadow-red-500/30 font-bold">!</div>
          <p>Transmission Integrity Breach: {feedError}</p>
        </div>
      )}
    </div>
  );
}

export default FeederPanel;
