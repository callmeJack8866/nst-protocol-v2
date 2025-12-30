import { useState } from 'react';
import { useOptions } from '../hooks';
import { OrderCard } from '../components/OrderCard';
import { Link } from 'react-router-dom';

export function BuyerHall() {
  useOptions();
  const [filter, setFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for initial UI demo
  const mockRFQs = [
    { orderId: 1, underlyingName: '黄金 Gold', underlyingCode: 'XAU', market: 'CN', direction: 'Call' as const, notionalUSDT: 100000, premiumRate: 700, expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30, status: 'RFQ_CREATED', sellerType: 'Verified Node' },
    { orderId: 2, underlyingName: 'Apple Inc.', underlyingCode: 'AAPL', market: 'US', direction: 'Put' as const, notionalUSDT: 50000, premiumRate: 500, expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 60, status: 'QUOTING', sellerType: 'Community Seller' },
    { orderId: 3, underlyingName: 'Bitcoin', underlyingCode: 'BTC', market: 'Crypto', direction: 'Call' as const, notionalUSDT: 200000, premiumRate: 1000, expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 14, status: 'MATCHED', sellerType: 'Institutional' },
  ];

  const stats = [
    { label: 'Active 活跃订单', value: '1,284', trend: '+12%', color: 'text-white' },
    { label: '24h Volume 成交', value: '$84.2M', trend: '+5.4%', color: 'text-green-400' },
    { label: 'Total TVL 全网', value: '$1.2B', trend: '+2.1%', color: 'text-primary-400' },
    { label: 'Avg Premium 均费率', value: '6.84%', trend: '-0.2%', color: 'text-white' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Refined Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="animate-fade-in-up">
          <div className="flex items-center space-x-3 mb-4">
            <span className="w-12 h-[2px] bg-primary-500 rounded-full" />
            <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">Institutional Marketplace</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter leading-tight">
            买方大厅 <span className="text-gradient-gold">Buyer Hall</span>
          </h1>
          <p className="text-dark-400 text-lg font-medium max-w-xl">
            Access secure, audited liquidity and build enterprise-grade option structures with institutional transparency.
          </p>
        </div>

        <Link
          to="/create-rfq"
          className="btn-primary px-10 py-4 font-black shadow-2xl shadow-primary-500/20 hover:scale-105 transition-transform"
        >
          创建询价 CREATE RFQ
        </Link>
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
            placeholder="Search assets, codes or markets..."
            className="glass-input w-full pl-12 pr-4 py-4 rounded-2xl font-bold bg-dark-900 shadow-inner group-hover:border-white/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-dark-900 border border-white/5 rounded-xl p-1 shadow-2xl">
            {['ALL', 'CN', 'US', 'CRYPTO'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                  ${filter === f ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/10' : 'text-dark-500 hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex bg-dark-900 border border-white/5 rounded-xl p-1 shadow-2xl">
            {['ALL', 'CALL', 'PUT'].map((f) => (
              <button
                key={f}
                onClick={() => setDirectionFilter(f)}
                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                  ${directionFilter === f ? 'bg-white/10 text-white' : 'text-dark-500 hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Spaced Order List */}
      <div className="grid grid-cols-1 gap-6">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Active Quotations ({mockRFQs.length})</span>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Sort by: Vol</span>
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Premium</span>
          </div>
        </div>
        {mockRFQs.map((rfq, i) => (
          <div key={rfq.orderId} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <OrderCard order={rfq} type="buyer" />
          </div>
        ))}
      </div>

      {mockRFQs.length === 0 && (
        <div className="glass-card p-16 text-center border-dashed border-2 border-white/10">
          <div className="text-7xl mb-6 opacity-30 grayscale"></div>
          <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">No Active Liquidity Pools</h3>
          <p className="text-dark-400 font-medium mb-8 max-w-sm mx-auto">The market currently has no active RFQs matching your filters. Create a custom inquiry to find counterparties.</p>
          <button className="btn-primary px-8 py-3 bg-white text-black hover:bg-primary-500">Initialize Marketplace RFQ</button>
        </div>
      )}

      <div className="h-20" />
    </div>
  );
}
