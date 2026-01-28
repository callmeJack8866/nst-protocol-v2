import { useState, useEffect, useCallback } from 'react';
import { useWallet, useFeedProtocol, useOptions } from '../hooks';
import { formatUnits } from 'ethers';
import type { FeedRequest, Feeder } from '../hooks/useFeedAndPoints';

// Feed type labels
const FEED_TYPE_LABELS: Record<number, string> = {
  0: '期初喂价',
  1: '动态喂价',
  2: '期末喂价',
  3: '仲裁喂价',
};

// Feed tier labels
const FEED_TIER_LABELS: Record<number, { name: string; desc: string }> = {
  0: { name: '5-3档', desc: '5个喂价员，取中间3个' },
  1: { name: '7-5档', desc: '7个喂价员，取中间5个' },
  2: { name: '10-7档', desc: '10个喂价员，取中间7个' },
};

export function FeederPanel() {
  const { isConnected, account, connect } = useWallet();
  const {
    isLoading,
    error,
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
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null); // Elite 2.1 新增
  const [refreshKey, setRefreshKey] = useState(0);

  // Load feeder info and pending requests
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

  // Handle feed submission
  const handleSubmitFeed = async () => {
    if (!selectedRequest || !priceInput) return;

    try {
      await submitFeed(Number(selectedRequest.requestId), priceInput);
      setShowFeedModal(false);
      setPriceInput('');
      setSelectedRequest(null);
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('Failed to submit feed:', e);
    }
  };

  // Handle feed rejection
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

  // Handle feeder registration
  const handleRegister = async () => {
    try {
      await registerFeeder(stakeAmount);
      setShowRegisterModal(false);
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('Failed to register as feeder:', e);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (deadline: bigint) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = deadline - now;
    if (remaining <= 0n) return '已超时';

    const minutes = Number(remaining / 60n);
    const seconds = Number(remaining % 60n);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="max-w-[1240px] mx-auto px-10 py-40 text-center animate-elite-entry">
        <div className="glass-surface p-28 rounded-[56px] border-dashed border-white/10 flex flex-col items-center">
          <div className="text-8xl mb-14 opacity-10">📡</div>
          <h3 className="text-2xl font-bold text-white mb-6 italic tracking-tighter uppercase">终端离线 Station Offline</h3>
          <p className="text-slate-500 text-lg mb-12 max-w-sm font-medium leading-relaxed">连接您的 Web3 身份以访问去中心化喂价工作台与协议共识网络。</p>
          <button onClick={() => connect()} className="btn-elite-primary px-16 h-16 shadow-2xl">授权连接终端</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pt-16 pb-20 w-full animate-elite-entry">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 mb-24">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_12px_#3b82f6]" />
            <span className="text-label text-blue-400">去中心化预言机节点集群</span>
          </div>
          <h1 className="text-6xl font-extrabold text-white tracking-tighter italic">数据终端 <span className="text-blue-500">Feeder</span></h1>
          <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed">
            实时验证并上报全球资产的市场价格信号，确保协议在清算与交割时的公平性与准确性。
          </p>
        </div>

        {feederInfo?.isActive ? (
          <div className="bg-blue-500/5 border border-blue-500/15 px-8 py-4 rounded-[28px] flex items-center space-x-5 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_#3b82f6]" />
            <span className="text-[12px] font-black text-blue-400 uppercase tracking-[0.2em]">预言机节点状态: 运行中</span>
          </div>
        ) : (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="btn-elite-primary bg-blue-600 hover:bg-blue-500 shadow-blue-600/20 h-20 px-12 rounded-[32px] text-xs tracking-widest"
          >
            申请成为喂价节点
          </button>
        )}
      </div>

      <div className="space-y-24">
        {/* Statistics Grid */}
        {feederInfo?.isActive && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: '累计完成喂价', value: feederInfo.completedFeeds?.toString() || '0', color: 'text-white' },
              { label: '质押金额', value: `${formatUnits(feederInfo.stakedAmount || 0n, 6)} U`, color: 'text-blue-500' },
              { label: '待处理请求', value: pendingRequests.length.toString(), color: 'text-emerald-400' },
              { label: '拒绝次数', value: feederInfo.rejectedFeeds?.toString() || '0', color: 'text-white' },
            ].map((stat, i) => (
              <div key={i} className="glass-surface p-8 rounded-[40px] group relative overflow-hidden transition-all hover:bg-white/[0.04]">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <p className="text-label mb-4 opacity-50 uppercase">{stat.label}</p>
                <p className={`text-3xl font-bold tracking-tighter italic ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests */}
        <div className="space-y-12">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] italic mb-2">
              待处理数据请求流 ({pendingRequests.length})
            </h2>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="text-[11px] font-bold text-blue-500 uppercase tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-blue-500/20"
            >
              强制同步节点数据
            </button>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="glass-surface p-16 rounded-[56px] text-center">
              <p className="text-slate-500 text-lg">暂无待处理的喂价请求</p>
              <p className="text-slate-600 text-sm mt-2">当有新的喂价请求时，将在此处显示</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {pendingRequests.map((req) => (
                <div key={Number(req.requestId)} className="group glass-surface p-10 rounded-[56px] relative overflow-hidden border-white/[0.03]">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12">
                    <div className="flex items-center space-x-8">
                      <div className="w-20 h-20 rounded-[32px] bg-slate-950 border border-white/5 flex items-center justify-center text-5xl shadow-inner group-hover:scale-110 transition-transform duration-1000">📡</div>
                      <div>
                        <div className="flex items-center space-x-5 mb-3">
                          <h3 className="text-2xl font-bold text-white italic tracking-tighter">订单 #{Number(req.orderId)}</h3>
                          <p className="text-[10px] font-black text-blue-400 bg-blue-400/5 px-3 py-1 rounded-full tracking-widest border border-blue-400/10 uppercase">
                            {FEED_TYPE_LABELS[req.feedType] || '未知类型'}
                          </p>
                          <p className="text-[10px] font-black text-amber-400 bg-amber-400/5 px-3 py-1 rounded-full tracking-widest border border-amber-400/10 uppercase">
                            {FEED_TIER_LABELS[req.tier]?.name || '未知档位'}
                          </p>
                          {/* P2: 喂价规则标签 */}
                          <p className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest border uppercase ${req.feedRule === 1
                            ? 'text-purple-400 bg-purple-400/5 border-purple-400/10'
                            : 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10'
                            }`}>
                            {req.feedRule === 1 ? '📈 跟量成交' : '📊 正常喂价'}
                          </p>
                        </div>
                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                          请求 ID-{Number(req.requestId)} · 进度: {Number(req.submittedCount)}/{Number(req.totalFeeders)}
                        </p>
                        {/* P2: T+X 条件显示 */}
                        {req.exerciseDelay && Number(req.exerciseDelay) > 0 && (
                          <p className="text-[10px] font-bold text-rose-400 mt-2 flex items-center gap-1">
                            <span>⏱️</span>
                            T+{Number(req.exerciseDelay)} 行权延迟要求
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-16 flex-1 border-l border-white/5 pl-16">
                      <div className="text-right">
                        <p className="text-label mb-2">喂价进度</p>
                        <p className="text-2xl font-bold text-emerald-400 italic tracking-tighter">
                          {Number(req.submittedCount)}/{Number(req.totalFeeders)}
                        </p>
                      </div>
                      <div className="text-right border-l border-white/5 pl-16">
                        <p className="text-label mb-2">剩余时间</p>
                        <p className="text-2xl font-bold text-white italic tracking-tighter">
                          {getTimeRemaining(req.deadline)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end space-x-8 pl-16">
                        {feederInfo?.isActive && (
                          <button
                            onClick={async () => {
                              setSelectedRequest(req);
                              setShowFeedModal(true);
                              setSelectedOrderDetails(null);
                              try {
                                const details = await getOrder(Number(req.orderId));
                                setSelectedOrderDetails(details);
                              } catch (e) { console.error(e); }
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-slate-950 px-10 h-16 rounded-[24px] font-black text-[12px] shadow-2xl shadow-blue-600/20 tracking-widest"
                          >
                            提交价格信号
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* P2: 跟量成交建议价格显示 */}
                  {req.feedRule === 1 && req.suggestedPrice && (
                    <div className="mt-6 bg-purple-500/5 border border-purple-500/10 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-purple-400 text-lg">💡</span>
                        <div>
                          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">卖方建议成交价格</p>
                          <p className="text-white font-bold text-lg">{req.suggestedPrice}</p>
                        </div>
                      </div>
                      <p className="text-slate-500 text-xs max-w-xs text-right">
                        请验证此价格是否合理。如合理可直接使用，如不合理可拒绝或输入修正价格。
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="glass-surface p-12 rounded-[40px] w-full max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-8">注册成为喂价员</h2>

            <div className="space-y-6">
              <div>
                <label className="text-label mb-2 block">质押金额 (USDT)</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="最低 100 USDT"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white"
                />
                <p className="text-slate-500 text-sm mt-2">最低质押要求: 100 USDT</p>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 h-14 rounded-xl border border-white/10 text-white font-bold"
                >
                  取消
                </button>
                <button
                  onClick={handleRegister}
                  disabled={isLoading || Number(stakeAmount) < 100}
                  className="flex-1 h-14 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
                >
                  {isLoading ? '处理中...' : '确认注册'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed Modal */}
      {showFeedModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="glass-surface p-12 rounded-[40px] w-full max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-2">提交喂价</h2>
            <p className="text-slate-500 mb-8">订单 #{Number(selectedRequest.orderId)} · {FEED_TYPE_LABELS[selectedRequest.feedType]}</p>

            <div className="space-y-6">
              <div>
                <label className="text-label mb-2 block">价格</label>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="输入当前市场价格"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white"
                />
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-400 text-sm">
                  当前进度: {Number(selectedRequest.submittedCount)}/{Number(selectedRequest.totalFeeders)} 个喂价员已提交
                </p>
              </div>

              {/* Order Constraints - Elite 2.1 新增 */}
              <div className="border-t border-white/5 pt-8">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 italic">标的合约约束约束 (Order Constraints)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] text-slate-600 font-bold uppercase mb-2">定价模型</p>
                    <p className="text-white font-bold text-sm italic">Black-Scholes (T+0)</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] text-slate-600 font-bold uppercase mb-2">分红调整</p>
                    <p className="text-emerald-400 font-bold text-sm italic">协议自动补偿</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] text-slate-600 font-bold uppercase mb-2">结算延迟</p>
                    <p className="text-white font-bold text-sm italic">7200s (T+2h)</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] text-slate-600 font-bold uppercase mb-2">强平线</p>
                    <p className="text-rose-400 font-bold text-sm italic">110% 保证金率</p>
                  </div>
                </div>
                {selectedOrderDetails && (
                  <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">标的资产</p>
                      <p className="text-white font-bold text-sm">{selectedOrderDetails.underlyingName} ({selectedOrderDetails.underlyingCode})</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">名义本金</p>
                      <p className="text-white font-bold text-sm italic">${Number(formatUnits(selectedOrderDetails.notionalUSDT, 6)).toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* P2: T+X 条件和喂价规则显示 */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {selectedRequest.exerciseDelay && Number(selectedRequest.exerciseDelay) > 0 && (
                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4">
                      <p className="text-[10px] text-rose-400 font-bold uppercase mb-1">⏱️ 行权延迟要求</p>
                      <p className="text-white font-bold text-lg">T+{Number(selectedRequest.exerciseDelay)}</p>
                      <p className="text-slate-500 text-[10px] mt-1">需确认满足 T+X 条件后方可喂价</p>
                    </div>
                  )}
                  {selectedRequest.feedRule === 1 && (
                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-4">
                      <p className="text-[10px] text-purple-400 font-bold uppercase mb-1">📈 跟量成交喂价</p>
                      <p className="text-white font-bold text-lg">{selectedRequest.suggestedPrice || '待验证'}</p>
                      <p className="text-slate-500 text-[10px] mt-1">卖方建议价格，请验证合理性</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowFeedModal(false);
                    setSelectedRequest(null);
                    setPriceInput('');
                  }}
                  className="flex-1 h-14 rounded-xl border border-white/10 text-white font-bold"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitFeed}
                  disabled={isLoading || !priceInput}
                  className="flex-1 h-14 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
                >
                  {isLoading ? '提交中...' : '确认提交'}
                </button>
              </div>

              {/* Reject option */}
              <div className="border-t border-white/10 pt-6">
                <p className="text-slate-500 text-sm mb-4">如果无法获取价格，可以拒绝喂价：</p>

                {/* P1: 预定义拒绝原因 */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { id: 'T_PLUS_X_NOT_MET', label: '不符合T+X条件', icon: '📅' },
                    { id: 'NO_TRADING_VOLUME', label: '无成交量/无法跟量', icon: '📉' },
                    { id: 'MARKET_CLOSED', label: '市场休市', icon: '🏢' },
                    { id: 'PRICE_NOT_AVAILABLE', label: '无法获取价格', icon: '❓' },
                  ].map(reason => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setRejectReason(reason.label)}
                      className={`p-3 rounded-xl border text-left transition-all text-xs ${rejectReason === reason.label
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                        : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                    >
                      <span className="mr-2">{reason.icon}</span>
                      {reason.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="拒绝原因 (可自定义)"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
                />
                <button
                  onClick={handleRejectFeed}
                  disabled={isLoading || !rejectReason}
                  className="w-full h-12 rounded-xl border border-red-500/30 text-red-400 font-bold disabled:opacity-50 hover:bg-red-500/10 transition-all"
                >
                  拒绝喂价
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="fixed bottom-8 right-8 bg-red-500/20 border border-red-500/30 rounded-xl px-6 py-4 text-red-400">
          {error}
        </div>
      )}

      <div className="h-32" />
    </div>
  );
}
