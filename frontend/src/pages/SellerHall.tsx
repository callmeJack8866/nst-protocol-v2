import { useState, useEffect } from 'react';
import { useOptions } from '../hooks';
import { OrderCard } from '../components/OrderCard';
import { Link } from 'react-router-dom';
import { formatUnits } from 'ethers';

interface RFQOrder {
  orderId: number;
  buyer: string;
  underlyingName: string;
  underlyingCode: string;
  market: string;
  country: string;
  refPrice: string;
  direction: string;
  notionalUSDT: bigint;
  premiumRate: number;
  expiryTimestamp: number;
  status: string;
  createdAt: number;
}

export function SellerHall() {
  const { getAllActiveRFQs, submitQuote, isConnected, loading: submitLoading } = useOptions();
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rfqs, setRfqs] = useState<RFQOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQOrder | null>(null);
  const [quoteForm, setQuoteForm] = useState({ premiumRate: '', marginRate: '10' });
  const [quoteError, setQuoteError] = useState('');
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  // Fetch RFQs from blockchain
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getAllActiveRFQs();
        setRfqs(data);
      } catch (err) {
        console.error('Failed to fetch RFQs:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [getAllActiveRFQs, isConnected]);

  // Filter RFQs based on user selection
  const filteredRFQs = rfqs.filter((rfq) => {
    // Market filter
    if (filter !== 'ALL') {
      const marketMatch =
        filter === 'CRYPTO' ? rfq.market.toLowerCase().includes('crypto') :
          filter === 'EQUITY' ? ['US', 'CN', 'HK'].includes(rfq.country.toUpperCase()) :
            filter === 'COMMODITY' ? ['XAU', 'XAG', 'OIL'].includes(rfq.underlyingCode.toUpperCase()) :
              true;
      if (!marketMatch) return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rfq.underlyingName.toLowerCase().includes(query) ||
        rfq.underlyingCode.toLowerCase().includes(query) ||
        rfq.market.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Format order for OrderCard component
  const formatOrderForCard = (rfq: RFQOrder) => ({
    orderId: rfq.orderId,
    underlyingName: rfq.underlyingName,
    underlyingCode: rfq.underlyingCode,
    market: rfq.market,
    direction: rfq.direction,
    notionalUSDT: Number(formatUnits(rfq.notionalUSDT, 6)),
    premiumRate: rfq.premiumRate,
    expiryTimestamp: rfq.expiryTimestamp,
    status: rfq.status,
    sellerType: 'Open Interest',
  });

  const handleQuote = (orderId: number) => {
    const rfq = rfqs.find(r => r.orderId === orderId);
    if (rfq) {
      setSelectedRFQ(rfq);
      setShowQuoteModal(true);
    }
  };

  const stats = [
    { label: 'Active RFQs 待报价', value: rfqs.length.toString(), trend: '', color: 'text-white' },
    { label: 'My Yield 累计收益', value: '$--', trend: '', color: 'text-green-400' },
    { label: 'Active Margin 占用保证金', value: '$--', trend: '', color: 'text-primary-400' },
    { label: 'Collateral Ratio 抵押率', value: '--%', trend: '', color: 'text-white' },
  ];

  return (
    <div className="w-full">
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
            Underwrite institutional-grade options, manage capital risk, and capture premium yields through the NST decentralized liquidity protocol.
          </p>
        </div>

        <Link
          to="/create-order"
          className="btn-primary px-10 py-4 font-black shadow-2xl shadow-primary-500/10 hover:scale-105 transition-transform flex items-center"
        >
          <span className="mr-2">📊</span> 创建卖单 CREATE ORDER
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
              {stat.trend && <span className="text-[10px] font-black text-green-500 mb-1.5">{stat.trend}</span>}
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

      {/* Loading State */}
      {loading && (
        <div className="glass-card p-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-6"></div>
          <p className="text-dark-400 font-medium">Loading RFQs from blockchain...</p>
        </div>
      )}

      {/* Not Connected State */}
      {!isConnected && !loading && (
        <div className="glass-card p-16 text-center border-dashed border-2 border-white/10">
          <div className="text-7xl mb-6 opacity-30 grayscale">🔗</div>
          <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Connect Wallet</h3>
          <p className="text-dark-400 font-medium mb-8 max-w-sm mx-auto">
            Please connect your wallet to view available RFQ opportunities.
          </p>
        </div>
      )}

      {/* RFQ List */}
      {!loading && isConnected && (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">
              Incoming Requests For Quote ({filteredRFQs.length})
            </span>
            <div className="flex items-center space-x-4">
              <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Sort by: Time</span>
            </div>
          </div>
          {filteredRFQs.map((rfq, i) => (
            <div key={rfq.orderId} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <OrderCard order={formatOrderForCard(rfq)} type="seller" onAction={handleQuote} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && isConnected && filteredRFQs.length === 0 && (
        <div className="glass-card p-16 text-center border-dashed border-2 border-white/10">
          <div className="text-7xl mb-6 opacity-30 grayscale">📋</div>
          <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">No Incoming RFQs</h3>
          <p className="text-dark-400 font-medium mb-8 max-w-sm mx-auto">
            There are currently no active buyer RFQs to quote on. Check back soon or create your own sell order.
          </p>
          <Link to="/create-order" className="btn-primary px-8 py-3">
            Create Sell Order
          </Link>
        </div>
      )}

      {/* Quote Modal */}
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
                  <p className="text-lg font-bold text-white">${Number(formatUnits(selectedRFQ.notionalUSDT, 18)).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Direction</p>
                  <p className={`text-lg font-bold ${selectedRFQ.direction === 'Call' ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedRFQ.direction === 'Call' ? '📈 Call' : '📉 Put'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Max Premium Rate</p>
                  <p className="text-lg font-bold text-primary-400">{(selectedRFQ.premiumRate / 100).toFixed(2)}%</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-3">Proposed Premium Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    className="glass-input w-full text-2xl font-black pr-12"
                    value={quoteForm.premiumRate || (selectedRFQ.premiumRate / 100).toFixed(2)}
                    onChange={(e) => setQuoteForm({ ...quoteForm, premiumRate: e.target.value })}
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-dark-500 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-dark-400 uppercase tracking-[0.2em] mb-3">Margin Rate (%) - Min 10%</label>
                <div className="relative">
                  <input
                    type="number"
                    className="glass-input w-full text-2xl font-black pr-12"
                    value={quoteForm.marginRate}
                    onChange={(e) => setQuoteForm({ ...quoteForm, marginRate: e.target.value })}
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-dark-500 font-bold">%</span>
                </div>
                <p className="text-xs text-dark-500 mt-2">
                  Margin Required: ${(Number(formatUnits(selectedRFQ.notionalUSDT, 18)) * parseFloat(quoteForm.marginRate || '10') / 100).toLocaleString()} USDT
                </p>
              </div>

              {quoteError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                  {quoteError}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="flex-1 py-4 rounded-xl border border-white/10 text-white font-black hover:bg-white/5 transition-all uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setQuoteError('');
                    try {
                      const premiumRate = Math.floor(parseFloat(quoteForm.premiumRate || String(selectedRFQ.premiumRate / 100)) * 100);
                      const marginRate = Math.floor(parseFloat(quoteForm.marginRate) * 100);

                      if (marginRate < 1000) {
                        setQuoteError('Margin rate must be at least 10%');
                        return;
                      }

                      await submitQuote({
                        orderId: selectedRFQ.orderId,
                        premiumRate,
                        marginRate,
                        liquidationRule: 0,
                        consecutiveDays: 3,
                        dailyLimitPercent: 30,
                        notionalUSDT: selectedRFQ.notionalUSDT,
                      });

                      setQuoteSuccess(true);
                      setTimeout(() => {
                        setShowQuoteModal(false);
                        setQuoteSuccess(false);
                        setQuoteForm({ premiumRate: '', marginRate: '10' });
                      }, 2000);
                    } catch (err) {
                      setQuoteError(err instanceof Error ? err.message : 'Quote submission failed');
                    }
                  }}
                  disabled={submitLoading}
                  className="flex-1 py-4 rounded-xl btn-primary font-black shadow-lg shadow-primary-500/20 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {submitLoading ? 'Submitting...' : quoteSuccess ? '✓ Quote Sent!' : 'Transmit Quote'}
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
