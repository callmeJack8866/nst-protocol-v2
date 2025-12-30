import { useState, useEffect } from 'react';
import { useWallet, useFeedProtocol } from '../hooks';

export function FeederPanel() {
  const { isConnected, account } = useWallet();
  const { getFeederInfo } = useFeedProtocol();
  const [feederInfo, setFeederInfo] = useState<any>(null);

  useEffect(() => {
    if (isConnected && account) {
      // Logic to fetch info if needed, but the original hooks didn't have these
      const loadInfo = async () => {
        const info = await getFeederInfo();
        setFeederInfo(info);
      };
      loadInfo();
    }
  }, [isConnected, account, getFeederInfo]);

  // Mock data for initial UI demo
  const mockRequests = [
    { requestId: 1, underlyingName: '黄金 Gold', underlyingCode: 'XAU', feedType: 'Price', status: 'Pending', timeLeft: '45m', reward: '5 USDT' },
    { requestId: 2, underlyingName: 'Apple Inc.', underlyingCode: 'AAPL', feedType: 'Price', status: 'Pending', timeLeft: '12m', reward: '3 USDT' },
  ];

  if (!isConnected) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-20 text-center">
        <div className="glass-card p-20 animate-fade-in-up">
          <div className="text-8xl mb-8 opacity-30 grayscale"></div>
          <h3 className="text-3xl font-black text-white mb-4">Feed Access Restricted</h3>
          <p className="text-dark-400 text-lg mb-10 max-w-sm mx-auto font-medium">Please connect your authorized data provider wallet to access the decentralized price feeding workbench.</p>
          <button className="btn-primary px-12 py-4 font-black">CONNECT WALLET</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Refined Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="animate-fade-in-up">
          <div className="flex items-center space-x-3 mb-4">
            <span className="w-12 h-[2px] bg-primary-500 rounded-full" />
            <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">Data Oracle Interface</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter leading-tight">
            喂价工作台 <span className="text-gradient-gold">Feeder Panel</span>
          </h1>
          <p className="text-dark-400 text-lg font-medium max-w-xl">
            Contribute real-time market data to the protocol settlement engine and earn protocol incentives for verifiable accuracy.
          </p>
        </div>

        {feederInfo?.isRegistered ? (
          <div className="px-6 py-3 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center space-x-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Active Provider Node</span>
          </div>
        ) : (
          <button className="btn-primary px-10 py-4 font-black shadow-2xl shadow-primary-500/10"> BECOME A PROVIDER </button>
        )}
      </div>

      {/* Spaced Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {[
          { label: 'Total Serviced 请求数', value: '1,429', color: 'text-white' },
          { label: 'Avg Latency 响应速度', value: '12s', color: 'text-primary-400' },
          { label: 'Protocol Rewards 累计奖励', value: '$840', color: 'text-green-400' },
          { label: 'Reputation Score 信用分', value: '99.8', color: 'text-white' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-8 group hover:bg-white/[0.05] transition-all">
            <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-3">{stat.label}</p>
            <span className={`text-3xl font-black tracking-tight ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Spaced Request List */}
      <div className="grid grid-cols-1 gap-6">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Incoming Feed Inquiries ({mockRequests.length})</span>
        </div>

        {mockRequests.map((req, i) => (
          <div key={req.requestId} className="glass-card p-6 group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center space-x-5">
                <div className="w-12 h-12 rounded-xl bg-dark-900 border border-white/5 flex items-center justify-center text-2xl">
                  {req.underlyingCode === 'XAU' ? '🏦' : '🇺🇸'}
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-black text-white tracking-tight">{req.underlyingName}</h3>
                    <span className="text-[10px] font-black text-dark-500 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">{req.feedType}</span>
                  </div>
                  <p className="text-[9px] font-black text-primary-500/60 uppercase tracking-widest mt-1">Request #00{req.requestId}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col min-w-[80px]">
                  <span className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Incentive</span>
                  <span className="text-sm font-bold text-green-400 font-mono">{req.reward}</span>
                </div>
                <div className="flex flex-col min-w-[80px]">
                  <span className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Time Remaining</span>
                  <span className="text-sm font-bold text-white font-mono">{req.timeLeft}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="px-6 py-2.5 rounded-xl border border-white/5 text-dark-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all">Reject</button>
                  <button className="px-6 py-2.5 rounded-xl btn-primary text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-500/20">Submit Data</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-20" />
    </div>
  );
}
