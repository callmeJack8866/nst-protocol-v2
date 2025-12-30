import { useState, useEffect } from 'react';
import { useWallet, useFeedProtocol } from '../hooks';

const mockFeedRequests = [
  { requestId: 1, orderId: 1001, underlyingName: '黄金 AU', underlyingCode: 'XAU', market: 'CN', feedType: 0, tier: 0, deadline: Math.floor(Date.now() / 1000) + 1800, reward: 0.54, direction: 'Call', notionalUSDT: 100000 },
  { requestId: 2, orderId: 1002, underlyingName: 'Apple Inc.', underlyingCode: 'AAPL', market: 'US', feedType: 1, tier: 1, deadline: Math.floor(Date.now() / 1000) + 600, reward: 0.64, direction: 'Put', notionalUSDT: 50000 },
];

const feedTypeLabels: Record<number, { label: string; color: string }> = {
  0: { label: '期初喂价', color: 'badge-info' },
  1: { label: '期末喂价', color: 'badge-warning' },
  2: { label: '动态喂价', color: 'badge-success' },
  3: { label: '仲裁喂价', color: 'badge-error' },
};

export function FeederPanel() {
  const { isConnected } = useWallet();
  const { getFeederInfo, submitFeed, rejectFeed, registerFeeder, isLoading } = useFeedProtocol();
  const [feederInfo, setFeederInfo] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<typeof mockFeedRequests[0] | null>(null);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [feedPrice, setFeedPrice] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('500');

  useEffect(() => { if (isConnected) loadFeederInfo(); }, [isConnected]);

  const loadFeederInfo = async () => { const info = await getFeederInfo(); setFeederInfo(info); };

  const formatTimeRemaining = (deadline: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    if (remaining <= 0) return '已超时';
    return Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  };

  const handleSubmitFeed = async () => {
    if (!selectedRequest || !feedPrice) return;
    try { await submitFeed(selectedRequest.requestId, feedPrice); setShowFeedModal(false); setFeedPrice(''); } catch {}
  };

  const handleRejectFeed = async () => {
    if (!selectedRequest || !rejectReason) return;
    try { await rejectFeed(selectedRequest.requestId, rejectReason); setShowFeedModal(false); setRejectReason(''); setIsRejecting(false); } catch {}
  };

  const handleRegister = async () => {
    try { await registerFeeder(stakeAmount); setShowRegisterModal(false); await loadFeederInfo(); } catch {}
  };

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4"></div>
          <h3 className="text-xl font-semibold text-white mb-2">请先连接钱包</h3>
          <p className="text-dark-400">连接钱包后访问喂价工作台</p>
        </div>
      </div>
    );
  }

  const isRegistered = feederInfo && feederInfo.isActive;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">喂价员工作台</h1>
        <p className="text-dark-400">处理待喂价的订单，获取喂价奖励</p>
      </div>

      {!isRegistered ? (
        <div className="glass-card p-8 text-center">
          <div className="text-6xl mb-4"></div>
          <h3 className="text-xl font-semibold text-white mb-2">成为喂价员</h3>
          <p className="text-dark-400 mb-6">质押 USDT 成为喂价员，参与喂价获取奖励</p>
          <button onClick={() => setShowRegisterModal(true)} className="btn-primary">注册成为喂价员</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-4"><p className="text-sm text-dark-400 mb-1">质押金额</p><p className="text-2xl font-bold text-white">${feederInfo ? Number(feederInfo.stakedAmount) / 1e18 : 0}</p></div>
            <div className="glass-card p-4"><p className="text-sm text-dark-400 mb-1">待处理</p><p className="text-2xl font-bold text-primary-400">{mockFeedRequests.length}</p></div>
            <div className="glass-card p-4"><p className="text-sm text-dark-400 mb-1">已完成</p><p className="text-2xl font-bold text-green-400">{feederInfo ? Number(feederInfo.completedFeeds) : 0}</p></div>
            <div className="glass-card p-4"><p className="text-sm text-dark-400 mb-1">状态</p><p className="text-2xl font-bold text-green-400">活跃</p></div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">待处理喂价请求</h2>
            {mockFeedRequests.map((request) => (
              <div key={request.requestId} className="glass-card-hover p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center">
                      <span className="text-2xl">{request.market === 'Crypto' ? '' : request.market === 'US' ? '' : ''}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{request.underlyingName}</h3>
                      <p className="text-sm text-dark-400">{request.underlyingCode}  订单 #{request.orderId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={feedTypeLabels[request.feedType]?.color || 'badge-info'}>{feedTypeLabels[request.feedType]?.label || '未知'}</span>
                    <div className="text-right text-dark-300">
                      <p className="text-sm">剩余时间</p>
                      <p className="text-lg font-mono font-bold">{formatTimeRemaining(request.deadline)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-dark-800/50 rounded-xl p-3"><p className="text-xs text-dark-400 mb-1">方向</p><p className={`text-lg font-semibold ${request.direction === 'Call' ? 'text-green-400' : 'text-red-400'}`}>{request.direction === 'Call' ? ' 看涨' : ' 看跌'}</p></div>
                  <div className="bg-dark-800/50 rounded-xl p-3"><p className="text-xs text-dark-400 mb-1">名义本金</p><p className="text-lg font-semibold text-white">${(request.notionalUSDT / 1000).toFixed(0)}K</p></div>
                  <div className="bg-dark-800/50 rounded-xl p-3"><p className="text-xs text-dark-400 mb-1">档位</p><p className="text-lg font-semibold text-white">{request.tier === 0 ? '5/3' : '7/5'}</p></div>
                  <div className="bg-dark-800/50 rounded-xl p-3"><p className="text-xs text-dark-400 mb-1">预计奖励</p><p className="text-lg font-semibold text-primary-400">${request.reward.toFixed(2)}</p></div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button onClick={() => { setSelectedRequest(request); setIsRejecting(true); setShowFeedModal(true); }} className="btn-secondary text-sm">拒绝喂价</button>
                  <button onClick={() => { setSelectedRequest(request); setIsRejecting(false); setShowFeedModal(true); }} className="btn-primary text-sm">提交喂价</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showFeedModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-lg animate-fade-in-up">
            <h2 className="text-xl font-bold text-white mb-2">{isRejecting ? '拒绝喂价' : '提交喂价'}</h2>
            <p className="text-dark-400 mb-6">{selectedRequest.underlyingName} ({selectedRequest.underlyingCode})</p>
            {!isRejecting ? (
              <div className="space-y-4 mb-6">
                <div><label className="block text-sm text-dark-300 mb-2">当前价格</label><input type="number" value={feedPrice} onChange={(e) => setFeedPrice(e.target.value)} placeholder="输入价格" className="input-field" step="0.01" /></div>
                <div className="bg-dark-800/50 rounded-xl p-4"><div className="flex justify-between text-sm"><span className="text-dark-400">预计奖励</span><span className="text-primary-400 font-semibold">${selectedRequest.reward.toFixed(2)}</span></div></div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div><label className="block text-sm text-dark-300 mb-2">拒绝原因</label><select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="input-field"><option value="">选择原因...</option><option value="NO_VOLUME">无成交量</option><option value="MARKET_CLOSED">市场休市</option><option value="OTHER">其他</option></select></div>
              </div>
            )}
            <div className="flex space-x-3">
              <button onClick={() => { setShowFeedModal(false); setFeedPrice(''); setRejectReason(''); }} className="btn-secondary flex-1" disabled={isLoading}>取消</button>
              <button onClick={isRejecting ? handleRejectFeed : handleSubmitFeed} className={`flex-1 ${isRejecting ? 'btn-secondary text-red-400' : 'btn-primary'}`} disabled={isLoading}>{isLoading ? '处理中...' : isRejecting ? '确认拒绝' : '确认提交'}</button>
            </div>
          </div>
        </div>
      )}

      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in-up">
            <h2 className="text-xl font-bold text-white mb-2">注册成为喂价员</h2>
            <p className="text-dark-400 mb-6">质押 USDT 成为喂价员</p>
            <div className="space-y-4 mb-6"><div><label className="block text-sm text-dark-300 mb-2">质押金额 (USDT)</label><input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="最低 500 USDT" className="input-field" min="500" /></div></div>
            <div className="flex space-x-3">
              <button onClick={() => setShowRegisterModal(false)} className="btn-secondary flex-1" disabled={isLoading}>取消</button>
              <button onClick={handleRegister} className="btn-primary flex-1" disabled={isLoading || parseFloat(stakeAmount) < 500}>{isLoading ? '处理中...' : '确认注册'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeederPanel;
