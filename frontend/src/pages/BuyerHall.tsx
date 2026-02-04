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
  direction: string;
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
  const { account, connect } = useWalletContext();
  const { getAllActiveRFQs, getQuotesForOrder, acceptQuote, isConnected } = useOptions();
  const [filter, setFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rfqs, setRfqs] = useState<RFQOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Logic State
  const [showQuotesModal, setShowQuotesModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQOrder | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getAllActiveRFQs();
        setRfqs(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    if (isConnected) fetchData(); else setLoading(false);
  }, [getAllActiveRFQs, isConnected]);

  const handleAccept = async (quote: Quote) => {
    if (!selectedRFQ) return;
    setAcceptError('');
    setIsAccepting(true);
    try {
      await acceptQuote(quote.quoteId, quote.premiumAmount, selectedRFQ.notionalUSDT);
      setAcceptSuccess(true);
      setTimeout(() => {
        setShowQuotesModal(false);
        setAcceptSuccess(false);
        getAllActiveRFQs().then(data => setRfqs(data));
      }, 2000);
    } catch (err: any) {
      setAcceptError(err.message || 'Failed to accept quote');
    }
    finally { setIsAccepting(false); }
  };

  const filteredRFQs = rfqs.filter((rfq) => {
    if (filter !== 'ALL' && !rfq.market.toUpperCase().includes(filter) && !rfq.country.toUpperCase().includes(filter)) return false;
    if (directionFilter !== 'ALL' && rfq.direction.toUpperCase() !== directionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return rfq.underlyingName.toLowerCase().includes(q) || rfq.underlyingCode.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
            <span className="text-[10px] font-black text-gold-500/80 uppercase tracking-[0.3em]">Institutional RFQ Hub</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter">BUYER HALL</h1>
          <p className="text-gray-500 text-lg max-w-2xl font-bold leading-relaxed">
            Monitor real-time quote requests and secure institutional-grade liquidity for customized OTC options.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center space-x-12 px-8 py-6 glass-panel rounded-3xl">
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Global Liquidity</p>
              <p className="text-2xl font-black text-white tracking-tight">$---</p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Active RFQs</p>
              <p className="text-2xl font-black text-white tracking-tight">{rfqs.length}</p>
            </div>
          </div>
          <Link to="/create-rfq" className="btn-gold px-10 h-16 flex items-center justify-center text-xs tracking-widest">
            INITIATE NEW RFQ
          </Link>
        </div>
      </div>

      <div className="space-y-12">
        {/* Filter Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-8 pb-8 border-b border-white/5">
          <div className="relative w-full xl:w-[420px]">
            <input
              type="text"
              placeholder="Search assets, symbols or nodes..."
              className="obsidian-input w-full pl-12 pr-6 h-14 text-sm font-bold"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-obsidian-900 border border-white/5 p-1.5 rounded-2xl">
              {['ALL', 'CN', 'US', 'CRYPTO'].map(m => (
                <button
                  key={m}
                  onClick={() => setFilter(m)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${filter === m ? 'bg-gold-500/10 text-gold-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {m === 'ALL' ? 'ALL MARKETS' : m}
                </button>
              ))}
            </div>
            <div className="flex bg-obsidian-900 border border-white/5 p-1.5 rounded-2xl">
              {['ALL', 'CALL', 'PUT'].map(d => (
                <button
                  key={d}
                  onClick={() => setDirectionFilter(d)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${directionFilter === d ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Market Grid */}
        <div className="min-h-[400px]">
          {!isConnected ? (
            <div className="py-32 glass-panel border-dashed rounded-[40px] text-center flex flex-col items-center">
              <div className="text-6xl opacity-20 mb-8">🔒</div>
              <h3 className="text-xl font-black text-gray-500 uppercase tracking-[0.4em] mb-4">Access Restricted</h3>
              <p className="text-gray-600 font-bold max-w-sm leading-relaxed mb-10">Connect your institutional wallet to view secure P2P market signals.</p>
              <button onClick={() => connect()} className="btn-gold px-12 h-14 text-[10px] tracking-widest">AUTHENTICATE</button>
            </div>
          ) : loading ? (
            <div className="py-32 flex flex-col items-center space-y-6">
              <div className="w-10 h-10 border-4 border-gold-500/10 border-t-gold-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em]">Syncing Neural Node Data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredRFQs.map((rfq) => (
                <OrderCard
                  key={rfq.orderId}
                  order={{
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
                    refPrice: rfq.refPrice,
                    createdAt: rfq.createdAt
                  }}
                  onAction={rfq.buyer.toLowerCase() === account?.toLowerCase() && (rfq.status === 'QUOTING' || rfq.status === 'RFQ_CREATED') ? async (id) => {
                    setSelectedRFQ(rfq);
                    setShowQuotesModal(true);
                    setLoadingQuotes(true);
                    try {
                      const q = await getQuotesForOrder(id);
                      setQuotes(q.filter((item: any) => item.status === 0));
                    } finally { setLoadingQuotes(false); }
                  } : undefined}
                  actionLabel="VIEW OFFERS"
                />
              ))}
              {filteredRFQs.length === 0 && (
                <div className="py-32 text-center glass-panel border-dashed rounded-[40px]">
                  <p className="text-[12px] font-black text-gray-700 uppercase tracking-[0.3em] italic">No active signals match your filter criteria</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-24" />

      {/* Quotes Modal */}
      {showQuotesModal && selectedRFQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-obsidian-950/95 backdrop-blur-3xl animate-in fade-in duration-500" onClick={() => setShowQuotesModal(false)} />
          <div className="w-full max-w-[800px] glass-panel rounded-[48px] p-12 relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-500 border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />

            <div className="text-center mb-12">
              <p className="text-[10px] font-black text-gold-500 uppercase tracking-[0.5em] mb-3">Live Quote Terminal</p>
              <h3 className="text-2xl font-black text-white tracking-tighter italic">Order Detail / {selectedRFQ.underlyingCode}</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 py-8 border-y border-white/5">
              <MetricItem label="Notional" value={`$${Number(formatUnits(selectedRFQ.notionalUSDT, 6)).toLocaleString()}`} />
              <MetricItem label="Direction" value={selectedRFQ.direction.toUpperCase()} gold />
              <MetricItem label="Reference" value={`$${selectedRFQ.refPrice}`} />
              <MetricItem label="Target rate" value={`${(selectedRFQ.premiumRate / 100).toFixed(2)}%`} />
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scroll">
              {loadingQuotes ? (
                <div className="py-20 flex flex-col items-center space-y-4 opacity-40">
                  <div className="w-8 h-8 border-3 border-white/5 border-t-white rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Polling decentralized nodes...</p>
                </div>
              ) : quotes.length === 0 ? (
                <div className="py-20 text-center border border-white/5 rounded-3xl bg-transparent border-dashed">
                  <p className="text-[11px] font-black text-gray-700 uppercase tracking-widest italic">No market markers responded yet</p>
                </div>
              ) : quotes.map(quote => {
                const now = Math.floor(Date.now() / 1000);
                const remaining = quote.expiresAt - now;
                const isExpired = remaining <= 0;
                const isUrgent = remaining > 0 && remaining < 600;

                const formatRemaining = () => {
                  if (isExpired) return 'EXPIRED';
                  const mins = Math.floor(remaining / 60);
                  const secs = remaining % 60;
                  return mins > 0 ? `${mins}M ${secs}S` : `${secs}S`;
                };

                return (
                  <div key={quote.quoteId} className="group bg-obsidian-900/50 border border-white/5 rounded-3xl p-6 hover:bg-obsidian-800 transition-all flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center space-x-5">
                      <div className="w-12 h-12 bg-obsidian-950 border border-white/5 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">🛡️</div>
                      <div>
                        <p className="text-[9px] font-black text-gray-700 uppercase mb-1">Provider Node</p>
                        <p className="text-xs font-mono font-bold text-gray-400 truncate w-40 md:w-auto">{quote.seller.slice(0, 16)}...{quote.seller.slice(-10)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-gray-700 uppercase mb-1">Validity</p>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border tracking-widest ${isExpired
                          ? 'bg-red-500/10 text-red-500 border-red-500/10'
                          : isUrgent
                            ? 'bg-gold-500/10 text-gold-500 border-gold-500/10 animate-pulse'
                            : 'bg-obsidian-800 text-gray-500 border-white/5'
                          }`}>
                          {formatRemaining()}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-black text-gray-700 uppercase mb-1">Rate Offer</p>
                        <p className="text-xl font-black text-emerald-500 tracking-tight italic">{(quote.premiumRate / 100).toFixed(2)}%</p>
                      </div>

                      <button
                        onClick={() => handleAccept(quote)}
                        disabled={isAccepting || acceptSuccess || isExpired}
                        className={`h-12 px-8 rounded-xl text-[10px] font-black tracking-widest transition-all ${isAccepting || acceptSuccess || isExpired ? 'bg-obsidian-800 text-gray-600 cursor-not-allowed opacity-50' : 'bg-gold-500 hover:bg-gold-400 text-obsidian-950'}`}
                      >
                        {isExpired ? 'EXPIRED' : isAccepting ? 'PROCESSING' : acceptSuccess ? 'SUCCESS' : 'ACCEPT'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {acceptError && (
              <div className="mt-8 bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-red-500 text-[9px] font-black text-center uppercase tracking-widest">
                Conflict detected: {acceptError}
              </div>
            )}

            <button onClick={() => setShowQuotesModal(false)} className="mt-12 w-full text-[9px] font-black text-gray-700 uppercase tracking-[0.4em] hover:text-white transition-all">TERMINATE SESSION</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, gold }: { label: string, value: string, gold?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{label}</p>
      <p className={`text-lg font-black tracking-tight ${gold ? 'text-gold-500 italic' : 'text-white'}`}>{value}</p>
    </div>
  );
}
