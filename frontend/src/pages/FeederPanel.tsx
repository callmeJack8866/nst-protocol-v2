import { useState, useEffect } from 'react';
import { useWallet, useFeedProtocol } from '../hooks';

const mockFeedRequests = [
  { requestId: 1, orderId: 1001, underlyingName: '黄金 Gold', underlyingCode: 'XAU', market: 'CN', feedType: 0, tier: 0, deadline: Math.floor(Date.now() / 1000) + 1800, reward: 0.54, direction: 'Call', notionalUSDT: 100000 },
  { requestId: 2, orderId: 1002, underlyingName: 'Apple Inc.', underlyingCode: 'AAPL', market: 'US', feedType: 1, tier: 1, deadline: Math.floor(Date.now() / 1000) + 600, reward: 0.64, direction: 'Put', notionalUSDT: 50000 },
];

const feedTypeLabels: Record<number, { label: string; color: string }> = {
  0: { label: '期初 Initial', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  1: { label: '期末 Final', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  2: { label: '动态 dynamic', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  3: { label: '仲裁 Arbitration', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
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
    if (remaining <= 0) return 'EXPIRED';
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="glass-card p-16 animate-fade-in-up">
           <div className="text-8xl mb-8 opacity-40 grayscale"></div>
           <h3 className="text-3xl font-black text-white mb-4">Feed Access Denied</h3>
           <p className="text-dark-400 text-lg mb-10 max-w-sm mx-auto">Authorized node credentials required to access the price feeding workspace.</p>
           <button className="btn-primary px-12 py-4">Connect Wallet</button>
        </div>
      </div>
    );
  }

  const isRegistered = feederInfo && feederInfo.isActive;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-14 animate-fade-in-up">
          <div className="flex items-center space-x-2 mb-3">
              <span className="w-8 h-1 bg-primary-500 rounded-full" />
              <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em]">Oracle Operations</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3 tracking-tighter">喂价员工作台 <span className="text-gradient-gold">Feeder Panel</span></h1>
          <p className="text-dark-400 text-lg font-medium">Verify market data and maintain the decentralized price stream to earn rewards.</p>
      </div>

      {!isRegistered ? (
        <div className="glass-card p-16 text-center border-primary-500/10 shadow-[0_0_50px_rgba(247,168,31,0.05)] max-w-2xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-3xl bg-primary-500/10 flex items-center justify-center text-5xl pulse-gold"></div>
          </div>
          <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Become a Node Provider</h3>
          <p className="text-dark-400 text-lg mb-10">Collateralize USDT to initialize your price-feeding node and start earning real-time data premiums.</p>
          <button onClick={() => setShowRegisterModal(true)} className="btn-primary px-10 py-4 font-black">Initial Authorization</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Staked Collateral 质押', value: `$${Number(feederInfo?.stakedAmount || 0) / 1e18}`, color: 'text-white' },
              { label: 'Pending Requests 待处理', value: mockFeedRequests.length, color: 'text-primary-400' },
              { label: 'Total Operations 累计', value: Number(feederInfo?.completedFeeds || 0), color: 'text-green-400' },
              { label: 'Node Status 状态', value: 'ACTIVE', color: 'text-green-400', isTag: true },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-6 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
                <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className={`text-2xl font-black tracking-tight ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center">
              <span className="w-2 h-2 rounded-full bg-primary-500 mr-3 pulse-gold" />
              Real-time Feed Requests
            </h2>
            
            {mockFeedRequests.map((request, i) => (
              <div key={request.requestId} className="glass-card-hover group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-dark-900 border border-white/5 flex items-center justify-center text-3xl shadow-xl">
                        {request.market === 'Crypto' ? '' : request.market === 'US' ? '' : ''}
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-xl font-black text-white tracking-tight">{request.underlyingName}</h3>
                          <span className="text-[10px] font-black text-dark-500 tracking-widest uppercase">{request.underlyingCode}</span>
                        </div>
                        <p className="text-[10px] font-black text-primary-500/60 uppercase tracking-widest mt-1">Request ID: {request.requestId}  Order #{request.orderId}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${feedTypeLabels[request.feedType]?.color}`}>
                        {feedTypeLabels[request.feedType]?.label}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Expiration</span>
                        <span className={`text-lg font-mono font-black ${formatTimeRemaining(request.deadline) === 'EXPIRED' ? 'text-red-500' : 'text-primary-400'}`}>
                          {formatTimeRemaining(request.deadline)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Direction</p>
                      <p className={`text-lg font-bold ${request.direction === 'Call' ? 'text-green-400' : 'text-red-400'}`}>
                        {request.direction === 'Call' ? ' Long Call' : ' Long Put'}
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Target Notional</p>
                      <p className="text-lg font-bold text-white">${(request.notionalUSDT / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Feed Tier</p>
                      <p className="text-lg font-bold text-white">{request.tier === 0 ? 'Aggressive' : 'Conservative'}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Reward Authorization</p>
                      <p className="text-lg font-extrabold text-gradient-gold">${request.reward.toFixed(2)} NST</p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-6 border-t border-white/5">
                    <button 
                      onClick={() => { setSelectedRequest(request); setIsRejecting(true); setShowFeedModal(true); }} 
                      className="btn-secondary text-sm px-6 py-3 border-white/5 hover:border-red-500/30 hover:text-red-400 transition-all font-bold"
                    >
                      Reject Request
                    </button>
                    <button 
                      onClick={() => { setSelectedRequest(request); setIsRejecting(false); setShowFeedModal(true); }} 
                      className="btn-primary text-sm px-8 py-3"
                    >
                      Authenticate Price
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Feed Modal */}
      {showFeedModal && selectedRequest && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="glass-card max-w-xl w-full relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-[80px] -mr-24 -mt-24" />
            
            <div className="p-10 relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter">{isRejecting ? 'Reject Data Point' : 'Price Authentication'}</h2>
                    <p className="text-dark-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                      {selectedRequest.underlyingName}  {selectedRequest.underlyingCode}
                    </p>
                  </div>
                  <button onClick={() => setShowFeedModal(false)} className="text-dark-500 hover:text-white text-3xl leading-none"></button>
                </div>
                
                {!isRejecting ? (
                  <div className="space-y-6 mb-10">
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                      <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-4">Final Market Price</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={feedPrice} 
                          onChange={(e) => setFeedPrice(e.target.value)} 
                          placeholder="eg: 124.50" 
                          className="glass-input w-full text-3xl font-bold pr-16" 
                          step="0.0001" 
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 font-black text-xl">USD</span>
                      </div>
                    </div>
                    <div className="bg-primary-500/5 border border-primary-500/10 rounded-2xl p-6 flex justify-between items-center">
                        <span className="text-[10px] font-black text-dark-400 uppercase tracking-widest">Authorized Reward</span>
                        <span className="text-2xl font-black text-gradient-gold">${selectedRequest.reward.toFixed(2)} NST</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 mb-10">
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                        <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-4">Reason for Rejection</label>
                        <select 
                          value={rejectReason} 
                          onChange={(e) => setRejectReason(e.target.value)} 
                          className="glass-input w-full text-lg font-bold appearance-none bg-dark-900"
                        >
                          <option value="">Select logical reason...</option>
                          <option value="MARKET_LACK_LIQUIDITY">Insufficient Market Liquidity</option>
                          <option value="DATA_STREAM_CORRUPTION">Data Stream Discrepancy</option>
                          <option value="MARKET_HALTED">Exchange Multi-Circuit Halted</option>
                          <option value="UNCERTAIN_VALUATION">Highly Volatile valuation</option>
                        </select>
                    </div>
                    <p className="text-xs font-bold text-red-400/80 px-2 leading-relaxed">
                         Frequent unverified rejections may lead to node reputation degradation and potential collateral slashing.
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button 
                    onClick={() => { setShowFeedModal(false); setFeedPrice(''); setRejectReason(''); }} 
                    className="btn-secondary flex-1 py-4 font-black" 
                    disabled={isLoading}
                  >
                    Abort
                  </button>
                  <button 
                    onClick={isRejecting ? handleRejectFeed : handleSubmitFeed} 
                    className={`flex-1 py-4 font-black ${isRejecting ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'btn-primary'}`} 
                    disabled={isLoading || (!isRejecting && !feedPrice) || (isRejecting && !rejectReason)}
                  >
                    {isLoading ? 'Processing...' : isRejecting ? 'Confirm Rejection' : 'Submit Data'}
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="glass-card max-w-md w-full relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 w-48 h-48 bg-primary-500/10 rounded-full blur-[80px] -ml-24 -mt-24" />
            
            <div className="p-10 relative z-10">
                <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Node Registration</h2>
                <p className="text-dark-400 font-bold uppercase text-[10px] tracking-widest">Initial System Authorization</p>

                <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 my-8 text-center">
                    <div className="text-5xl mb-6"></div>
                    <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-4">Required Stake Amount</label>
                    <div className="relative">
                        <input 
                          type="number" 
                          value={stakeAmount} 
                          onChange={(e) => setStakeAmount(e.target.value)} 
                          placeholder="Min 500 USDT" 
                          className="glass-input w-full text-center text-3xl font-bold" 
                          min="500" 
                        />
                        <div className="mt-2 text-[10px] font-black text-primary-500 uppercase tracking-widest">Minimum 500 USDT</div>
                    </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setShowRegisterModal(false)} className="btn-secondary flex-1 py-4 font-black" disabled={isLoading}>Abort</button>
                  <button onClick={handleRegister} className="btn-primary flex-1 py-4 font-black" disabled={isLoading || parseFloat(stakeAmount) < 500}>
                    {isLoading ? 'Registering...' : 'Confirm Activation'}
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeederPanel;
