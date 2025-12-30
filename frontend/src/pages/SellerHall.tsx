import { useState } from 'react';
import { useOptions } from '../hooks';
import { OrderCard } from '../components/OrderCard';

export function SellerHall() {
  useOptions();
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<any>(null);

  // Mock data for initial UI demo
  const mockRFQs = [
    { orderId: 101, underlyingName: '黄金 Gold', underlyingCode: 'XAU', market: 'CN', direction: 'Call' as const, notionalUSDT: 100000, premiumRate: 700, expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30, status: 'RFQ_CREATED', sellerType: 'Open Interest' },
    { orderId: 102, underlyingName: 'Apple Inc.', underlyingCode: 'AAPL', market: 'US', direction: 'Put' as const, notionalUSDT: 50000, premiumRate: 500, expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 60, status: 'RFQ_CREATED', sellerType: 'Open Interest' },
  ];

  const stats = [
    { label: 'Active RFQs 待报价', value: '42', trend: '+5', color: 'text-white' },
    { label: 'My Yield 累计收益', value: '$12.4K', trend: '+8.2%', color: 'text-green-400' },
    { label: 'Active Margin 占用保证金', value: '$450K', trend: '-2.1%', color: 'text-primary-400' },
    { label: 'Collateral Ratio 抵押率', value: '142%', trend: '+0.5%', color: 'text-white' },
  ];

  const handleQuote = (orderId: number) => {
    const rfq = mockRFQs.find(r => r.orderId === orderId);
    setSelectedRFQ(rfq);
    setShowQuoteModal(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Refined Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="animate-fade-in-up">
          <div className="flex items-center space-x-3 mb-4">
            <span className="w-12 h-[2px] bg-primary-500 rounded-full" />
            <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">Yield Generation Engine</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter leading-tight">
            卖方大厅 <span className="text-gradient-gold">Seller Hall</span>
          </h1>
          <p className="text-dark-400 text-lg font-medium max-w-xl">
            Underwrite institutional-grade options, manage capital risk, and capture premium yields through the NST decentralized liquidty protocol.
          </p>
        </div>

        <button className="btn-primary px-10 py-4 font-black shadow-2xl shadow-primary-500/10 hover:scale-105 transition-transform flex items-center">
          <span className="mr-2"></span> 批量挂单 BATCH ORDERS
        </button>
      </div>

      {/* Spaced Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-8 group relative overflow-hidden transition-all duration-300 hover:bg-white/[0.05]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary-500/10 transition-colors" />
            <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-3">{stat.label}</p>
            <div className="flex items-end space-x-3">
              <span className={`text-3xl font-black tracking-tight ${stat.color}`}>{stat.value}</span>
              <span className="text-[10px] font-black text-green-500 mb-1.5">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Clean Filter Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-10 pb-6 border-b border-white/5">
        <div className="relative w-full xl:w-96 group">
          <input
            type="text"
            placeholder="Search incoming RFQs..."
            className="glass-input w-full pl-12 pr-4 py-4 rounded-2xl font-bold bg-dark-900 shadow-inner group-hover:border-white/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex bg-dark-900 border border-white/5 rounded-xl p-1 shadow-2xl">
          {['ALL', 'EQUITY', 'COMMODITY', 'CRYPTO'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                ${filter === f ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/10' : 'text-dark-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Spaced RFQ List */}
      <div className="grid grid-cols-1 gap-6">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Incoming Requests For Quote ({mockRFQs.length})</span>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Sort by: Time</span>
          </div>
        </div>
        {mockRFQs.map((rfq, i) => (
          <div key={rfq.orderId} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <OrderCard order={rfq} type="seller" onAction={handleQuote} />
          </div>
        ))}
      </div>

      {/* Quote Modal - Cleaned up */}
      {showQuoteModal && selectedRFQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowQuoteModal(false)} />
          <div className="glass-card w-full max-w-xl p-10 animate-fade-in-up relative z-10 border-white/10">
            <div className="mb-10 text-center">
              <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Submit Institutional Quote</h3>
              <p className="text-dark-500 text-sm font-medium tracking-wide">Underwriting Order #{selectedRFQ.orderId}</p>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                <div>
                  <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Target Asset</p>
                  <p className="text-lg font-bold text-white">{selectedRFQ.underlyingName}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Notional Magnitude</p>
                  <p className="text-lg font-bold text-white">${selectedRFQ.notionalUSDT.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-3">Proposed Premium Rate (%)</label>
                <div className="relative">
                  <input type="number" className="glass-input w-full text-2xl font-black pr-12" defaultValue={8.0} />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-dark-500 font-bold">%</span>
                </div>
                <div className="flex justify-between mt-2 px-1">
                  <p className="text-[9px] font-bold text-dark-500">Min Req: 7.00%</p>
                  <p className="text-[9px] font-bold text-primary-500">Exp. Yield: $8,000</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="flex-1 py-4 rounded-xl border border-white/10 text-white font-black hover:bg-white/5 transition-all uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="flex-1 py-4 rounded-xl btn-primary font-black shadow-lg shadow-primary-500/20 uppercase tracking-widest text-xs"
                >
                  Transmit Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-20" />
    </div>
  );
}
