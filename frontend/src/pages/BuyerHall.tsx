import { useState, useEffect } from 'react';
import { useOptions } from '../hooks';
import { useWalletContext } from '../context/WalletContext';
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
  direction: 'Call' | 'Put';
  notionalUSDT: bigint;
  premiumRate: number;
  expiryTimestamp: number;
  status: string;
  createdAt: number;
}

interface Quote {
  quoteId: number;
  orderId: number;
  seller: string;
  sellerType: number;
  premiumRate: number;
  premiumAmount: bigint;
  marginRate: number;
  marginAmount: bigint;
  liquidationRule: number;
  consecutiveDays: number;
  dailyLimitPercent: number;
  createdAt: number;
  expiresAt: number;
  status: number;
}

export function BuyerHall() {
  const { account } = useWalletContext();
  const { getAllActiveRFQs, getQuotesForOrder, acceptQuote, isConnected, loading: actionLoading } = useOptions();
  const [filter, setFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rfqs, setRfqs] = useState<RFQOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Quotes modal state
  const [showQuotesModal, setShowQuotesModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQOrder | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [acceptSuccess, setAcceptSuccess] = useState(false);

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
      const marketMatch = filter === 'CRYPTO'
        ? rfq.market.toLowerCase().includes('crypto')
        : rfq.market.toUpperCase() === filter || rfq.country.toUpperCase() === filter;
      if (!marketMatch) return false;
    }
    // Direction filter
    if (directionFilter !== 'ALL' && rfq.direction.toUpperCase() !== directionFilter) {
      return false;
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
    sellerType: 'Open Market',
  });

  // Handle viewing quotes for buyer's own RFQ
  const handleViewQuotes = async (orderId: number) => {
    const rfq = rfqs.find(r => r.orderId === orderId);
    if (!rfq) return;

    setSelectedRFQ(rfq);
    setShowQuotesModal(true);
    setLoadingQuotes(true);
    setAcceptError('');
    setAcceptSuccess(false);

    try {
      const quotesData = await getQuotesForOrder(orderId);
      setQuotes(quotesData.filter((q: Quote) => q.status === 0)); // Only active quotes
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  // Handle accepting a quote
  const handleAcceptQuote = async (quote: Quote) => {
    if (!selectedRFQ) return;

    setAcceptError('');
    try {
      await acceptQuote(quote.quoteId, quote.premiumAmount, selectedRFQ.notionalUSDT);
      setAcceptSuccess(true);
      setTimeout(() => {
        setShowQuotesModal(false);
        setAcceptSuccess(false);
        // Refresh RFQs
        getAllActiveRFQs().then(data => setRfqs(data));
      }, 2000);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept quote');
    }
  };

  const stats = [
    { label: 'Active 活跃订单', value: rfqs.length.toString(), trend: '', color: 'text-white' },
    { label: '24h Volume 成交', value: '$--', trend: '', color: 'text-green-400' },
    { label: 'Total TVL 全网', value: '$--', trend: '', color: 'text-primary-400' },
    { label: 'Avg Premium 均费率', value: '--', trend: '', color: 'text-white' },
  ];

  // Check if RFQ belongs to current user and has status QUOTING
  const isMyQuotingRFQ = (rfq: RFQOrder) => {
    return rfq.buyer.toLowerCase() === account?.toLowerCase() && rfq.status === 'QUOTING';
  };

  return (
    <div className="w-full">
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
          className="btn-primary px-12 py-5 font-black shadow-2xl shadow-primary-500/20 hover:scale-105 transition-transform"
        >
          创建询价 CREATE RFQ
        </Link>
      </div>

      <div className="flex flex-col gap-24">

        {/* Spaced Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="glass-card p-8 group relative overflow-hidden transition-all duration-300 hover:bg-white/[0.05]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary-500/10 transition-colors" />
              <p className="text-xs font-bold text-dark-500 uppercase tracking-widest mb-4 truncate">{stat.label}</p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className={`text-2xl lg:text-4xl font-black tracking-tight ${stat.color}`}>{stat.value}</span>
                {stat.trend && <span className="text-xs font-extrabold text-green-500">{stat.trend}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Clean Filter Bar */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10 pb-10 border-b border-white/10">
          <div className="relative w-full xl:w-[450px] group">
            <input
              type="text"
              placeholder="Search assets, codes or markets..."
              className="glass-input w-full pl-14 pr-6 py-5 rounded-2xl font-bold bg-dark-900 shadow-inner group-hover:border-white/20 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-dark-500 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex bg-dark-900 border border-white/5 rounded-2xl p-2 shadow-2xl">
              {['ALL', 'CN', 'US', 'CRYPTO'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all min-w-[80px]
                  ${filter === f ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/10' : 'text-dark-500 hover:text-white'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex bg-dark-900 border border-white/5 rounded-2xl p-2 shadow-2xl">
              {['ALL', 'CALL', 'PUT'].map((f) => (
                <button
                  key={f}
                  onClick={() => setDirectionFilter(f)}
                  className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all min-w-[70px]
                  ${directionFilter === f ? 'bg-white/10 text-white' : 'text-dark-500 hover:text-white'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass-card p-16 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-6"></div>
            <p className="text-dark-400 font-medium">Loading orders from blockchain...</p>
          </div>
        )}

        {/* Not Connected State */}
        {!isConnected && !loading && (
          <div className="glass-card p-16 text-center border-dashed border-2 border-white/10">
            <div className="text-7xl mb-6 opacity-30 grayscale">🔗</div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Connect Wallet</h3>
            <p className="text-dark-400 font-medium mb-8 max-w-sm mx-auto">
              Please connect your wallet to view active RFQ orders from the blockchain.
            </p>
          </div>
        )}

        {/* Order List */}
        {!loading && isConnected && (
          <div className="grid grid-cols-1 gap-8">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-xs font-black text-dark-500 uppercase tracking-[0.2em]">
                Active Quotations ({filteredRFQs.length})
              </span>
              <div className="flex items-center space-x-6">
                <span className="text-xs font-black text-dark-500 uppercase tracking-[0.2em]">Sort by: Vol</span>
                <span className="text-xs font-black text-dark-500 uppercase tracking-[0.2em]">Premium</span>
              </div>
            </div>
            {filteredRFQs.map((rfq, i) => (
              <div key={rfq.orderId} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <OrderCard
                  order={formatOrderForCard(rfq)}
                  type="buyer"
                  onAction={isMyQuotingRFQ(rfq) ? handleViewQuotes : undefined}
                  actionLabel={isMyQuotingRFQ(rfq) ? "View Quotes" : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && isConnected && filteredRFQs.length === 0 && (
          <div className="glass-card p-16 text-center border-dashed border-2 border-white/10">
            <div className="text-7xl mb-6 opacity-30 grayscale">📋</div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">No Active Liquidity Pools</h3>
            <p className="text-dark-400 font-medium mb-8 max-w-sm mx-auto">
              The market currently has no active RFQs matching your filters. Create a custom inquiry to find counterparties.
            </p>
            <Link to="/create-rfq" className="btn-primary px-8 py-3 bg-white text-black hover:bg-primary-500">
              Initialize Marketplace RFQ
            </Link>
          </div>
        )}

      </div>

      {/* Quotes Modal */}
      {showQuotesModal && selectedRFQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowQuotesModal(false)} />
          <div className="glass-card w-full max-w-2xl p-10 animate-fade-in-up relative z-10 border-white/10 max-h-[80vh] overflow-y-auto">
            <div className="mb-8 text-center">
              <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Incoming Quotes</h3>
              <p className="text-dark-500 text-sm font-medium tracking-wide">
                Order #{selectedRFQ.orderId} · {selectedRFQ.underlyingName}
              </p>
            </div>

            {/* Order Summary */}
            <div className="grid grid-cols-3 gap-4 bg-white/[0.02] p-4 rounded-xl border border-white/5 mb-8">
              <div>
                <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Notional</p>
                <p className="text-lg font-bold text-white">${Number(formatUnits(selectedRFQ.notionalUSDT, 6)).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Direction</p>
                <p className={`text-lg font-bold ${selectedRFQ.direction === 'Call' ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedRFQ.direction === 'Call' ? '📈 Call' : '📉 Put'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Max Premium</p>
                <p className="text-lg font-bold text-primary-400">{(selectedRFQ.premiumRate / 100).toFixed(2)}%</p>
              </div>
            </div>

            {/* Loading Quotes */}
            {loadingQuotes && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-dark-400">Loading quotes...</p>
              </div>
            )}

            {/* No Quotes */}
            {!loadingQuotes && quotes.length === 0 && (
              <div className="text-center py-8">
                <p className="text-6xl mb-4">📭</p>
                <p className="text-dark-400">No active quotes for this order yet.</p>
              </div>
            )}

            {/* Quotes List */}
            {!loadingQuotes && quotes.length > 0 && (
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <div key={quote.quoteId} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:border-primary-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-bold text-dark-500 mb-1">Quote #{quote.quoteId}</p>
                        <p className="text-sm font-medium text-dark-400">
                          Seller: {quote.seller.slice(0, 6)}...{quote.seller.slice(-4)}
                        </p>
                      </div>
                      <span className="bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                        Active
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-[9px] font-black text-dark-500 uppercase mb-1">Premium Rate</p>
                        <p className="text-xl font-bold text-white">{(quote.premiumRate / 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-dark-500 uppercase mb-1">Premium Amount</p>
                        <p className="text-xl font-bold text-primary-400">${Number(formatUnits(quote.premiumAmount, 6)).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-dark-500 uppercase mb-1">Margin Rate</p>
                        <p className="text-xl font-bold text-white">{(quote.marginRate / 100).toFixed(0)}%</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcceptQuote(quote)}
                      disabled={actionLoading || acceptSuccess}
                      className="w-full py-3 rounded-xl btn-primary font-black uppercase tracking-widest text-xs disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : acceptSuccess ? '✓ Matched!' : 'Accept Quote'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {acceptError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {acceptError}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowQuotesModal(false)}
              className="mt-6 w-full py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="h-20" />
    </div>
  );
}
