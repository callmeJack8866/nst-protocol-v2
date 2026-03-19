import { useState, useEffect } from 'react';
import { useOptions } from '../hooks';
import { OrderCard } from '../components/OrderCard';
import { Link } from 'react-router-dom';
import { formatUnits } from 'ethers';
import { useTranslation } from 'react-i18next';

// Safe direction conversion: handles both string and number
const getDirectionStr = (direction: any): string => {
  if (typeof direction === 'string') return direction;
  return Number(direction) === 0 ? 'Call' : 'Put';
};

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




// Liquidation Rules
const LIQUIDATION_OPTIONS = [
  { value: 0, label: 'NONE', desc: 'No Auto-Liq' },
  { value: 1, label: 'LIMIT', desc: 'Consecutive Limit' },
  { value: 2, label: 'PRICE', desc: 'Price Surge' },
];

export function SellerHall() {
  const { getAllActiveRFQs, submitQuote, isConnected } = useOptions();
  const { t } = useTranslation();
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rfqs, setRfqs] = useState<RFQOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Quote Modal State
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQOrder | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    premiumRate: '6.5',
    marginRate: '15',
    liquidationRule: 0,
    consecutiveDays: 3,
    dailyLimitPercent: 10,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getAllActiveRFQs();
        setRfqs(data);
      } finally { setLoading(false); }
    };
    if (isConnected) fetchData(); else setLoading(false);
  }, [getAllActiveRFQs, isConnected]);

  const filteredRFQs = rfqs.filter(r => {
    if (filter !== 'ALL' && !r.market.toUpperCase().includes(filter) && !r.country.toUpperCase().includes(filter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.underlyingName.toLowerCase().includes(q) || r.underlyingCode.toLowerCase().includes(q);
    }
    return true;
  });

  const handleOpenQuoteModal = (rfq: RFQOrder) => {
    setSelectedRFQ(rfq);
    setQuoteForm({
      premiumRate: (rfq.premiumRate / 100).toFixed(2),
      marginRate: '15',
      liquidationRule: 0,
      consecutiveDays: 3,
      dailyLimitPercent: 10,
    });
    setSubmitError('');
    setSubmitSuccess(false);
    setShowQuoteModal(true);
  };

  const handleSubmitQuote = async () => {
    if (!selectedRFQ) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await submitQuote({
        orderId: selectedRFQ.orderId,
        premiumRate: Math.floor(parseFloat(quoteForm.premiumRate) * 100),
        marginRate: Math.floor(parseFloat(quoteForm.marginRate) * 100),
        liquidationRule: quoteForm.liquidationRule,
        consecutiveDays: quoteForm.consecutiveDays,
        dailyLimitPercent: quoteForm.dailyLimitPercent,
        notionalUSDT: selectedRFQ.notionalUSDT,
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        setShowQuoteModal(false);
        getAllActiveRFQs().then(data => setRfqs(data));
      }, 1500);
    } catch (err: any) { setSubmitError(err.message || 'Failed to submit quote'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
            <span className="text-[10px] font-black text-gold-500/80 uppercase tracking-[0.3em]">Provider Liquidity Terminal</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter">{t('seller_hall.title')}</h1>
          <p className="text-gray-500 text-lg max-w-2xl font-bold leading-relaxed">
            As a licensed provider, hedge institutional risks and capture premium yields through secure OTC underwriting.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center space-x-12 px-8 py-6 glass-panel rounded-3xl">
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Underwritten</p>
              <p className="text-2xl font-black text-white tracking-tight">$1.2M</p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Pending Requests</p>
              <p className="text-2xl font-black text-white tracking-tight">{filteredRFQs.length}</p>
            </div>
          </div>
          <Link to="/create-seller-order" className="btn-gold px-10 h-16 flex items-center justify-center text-xs tracking-widest gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M12 5v14M5 12h14" /></svg>
            {t('seller_hall.post_order')}
          </Link>
        </div>
      </div>

      <div className="space-y-12">
        {/* Filter Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-8 pb-8 border-b border-white/5">
          <div className="relative w-full xl:w-[420px]">
            <input type="text" placeholder="Search markets, nodes or assets..." className="obsidian-input w-full pl-12 pr-6 h-14 text-sm font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </div>
          <div className="bg-obsidian-900 border border-white/5 p-1.5 rounded-2xl flex">
            {['ALL', 'CN', 'US', 'CRYPTO'].map(m => (
              <button key={m} onClick={() => setFilter(m)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${filter === m ? 'bg-gold-500/10 text-gold-500' : 'text-gray-500 hover:text-gray-300'}`}>
                {m === 'ALL' ? t('seller_hall.all_markets') : m}
              </button>
            ))}
          </div>
        </div>

        {/* Market Grid */}
        <div className="min-h-[400px]">
          {!loading && isConnected && (
            <div className="grid grid-cols-1 gap-6">
              <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em] italic">Active Request Stream ({filteredRFQs.length})</h2>
              </div>
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
                    sellerType: 'Market LP',
                    refPrice: rfq.refPrice,
                    createdAt: rfq.createdAt
                  }}
                  onAction={() => handleOpenQuoteModal(rfq)}
                  actionLabel={t('seller_hall.submit_quote')}
                />
              ))}
              {filteredRFQs.length === 0 && (
                <div className="py-32 text-center glass-panel border-dashed rounded-[40px]">
                  <p className="text-[12px] font-black text-gray-700 uppercase tracking-[0.3em] italic">No pending signals found</p>
                </div>
              )}
            </div>
          )}
          {!isConnected && !loading && (
            <div className="py-32 glass-panel border-dashed rounded-[40px] text-center flex flex-col items-center">
              <div className="text-6xl opacity-20 mb-8">🛡️</div>
              <h3 className="text-xl font-black text-gray-500 uppercase tracking-[0.4em] mb-4">Access Restricted</h3>
              <p className="text-gray-600 font-bold max-w-sm leading-relaxed mb-10">Authorize your trading identity to access live protocol pulses.</p>
              <button onClick={() => { }} className="btn-gold px-12 h-14 text-[10px] tracking-widest">{t('common.authenticate')}</button>
            </div>
          )}
          {loading && (
            <div className="py-32 flex flex-col items-center space-y-6">
              <div className="w-10 h-10 border-4 border-gold-500/10 border-t-gold-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em]">Decoding Protocol Stream...</p>
            </div>
          )}
        </div>
      </div>

      <div className="h-24" />

      {/* Quote Modal */}
      {showQuoteModal && selectedRFQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-obsidian-950/95 backdrop-blur-3xl animate-in fade-in duration-500" onClick={() => setShowQuoteModal(false)} />
          <div className="w-full max-w-[700px] glass-panel rounded-[48px] p-10 relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-500 border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-72 h-72 bg-gold-500/5 blur-[100px] -mr-36 -mt-36 pointer-events-none" />

            <div className="text-center mb-10">
              <p className="text-[10px] font-black text-gold-500 uppercase tracking-[0.5em] mb-3">Transmission Terminal</p>
              <h3 className="text-2xl font-black text-white tracking-tighter italic">Quote Detail / {selectedRFQ.underlyingCode}</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 py-6 border-y border-white/5">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Notional</span>
                <span className="text-base font-black text-white">${Number(formatUnits(selectedRFQ.notionalUSDT, 6)).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Direction</span>
                <span className={`text-base font-black ${getDirectionStr(selectedRFQ.direction) === 'Call' ? 'text-emerald-500 italic' : 'text-red-500 italic'}`}>{getDirectionStr(selectedRFQ.direction).toUpperCase()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Reference</span>
                <span className="text-base font-black text-white">${selectedRFQ.refPrice}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Target Rate</span>
                <span className="text-base font-black text-gold-500 italic">{(selectedRFQ.premiumRate / 100).toFixed(2)}%</span>
              </div>
            </div>

            <div className="space-y-6 mb-10 max-h-[450px] overflow-y-auto pr-2 custom-scroll">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Premium Rate (%)</label>
                  <input type="text" className="obsidian-input w-full h-14 text-xl font-black text-gold-500 italic" value={quoteForm.premiumRate} onChange={e => setQuoteForm({ ...quoteForm, premiumRate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Margin Rate (%)</label>
                  <input type="text" className="obsidian-input w-full h-14 text-xl font-black text-white italic" value={quoteForm.marginRate} onChange={e => setQuoteForm({ ...quoteForm, marginRate: e.target.value })} />
                  {selectedRFQ && <p className="text-[8px] text-gray-600 ml-1">≈ {(Number(formatUnits(selectedRFQ.notionalUSDT, 6)) * parseFloat(quoteForm.marginRate || '0') / 100).toLocaleString()} USDT</p>}
                </div>
              </div>



              {/* Liquidation Rules */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Liquidation Protocol</label>
                <div className="grid grid-cols-3 gap-3">
                  {LIQUIDATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuoteForm({ ...quoteForm, liquidationRule: opt.value })}
                      className={`p-3 rounded-2xl border transition-all text-left ${quoteForm.liquidationRule === opt.value
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : 'bg-obsidian-900 border-white/5 text-gray-500 hover:border-white/10'
                        }`}
                    >
                      <p className="text-xs font-black">{opt.label}</p>
                      <p className="text-[8px] font-bold opacity-50 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {quoteForm.liquidationRule === 1 && (
                  <div className="flex items-center gap-4 mt-2 p-3 bg-obsidian-900/50 rounded-xl border border-white/5">
                    <span className="text-[9px] font-black text-gray-600 uppercase">Limit Days:</span>
                    <select
                      className="bg-transparent text-xs font-black text-white focus:outline-none"
                      value={quoteForm.consecutiveDays}
                      onChange={e => setQuoteForm({ ...quoteForm, consecutiveDays: Number(e.target.value) })}
                    >
                      {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} SESSIONS</option>)}
                    </select>
                  </div>
                )}
                {quoteForm.liquidationRule === 2 && (
                  <div className="flex items-center gap-4 mt-2 p-3 bg-obsidian-900/50 rounded-xl border border-white/5">
                    <span className="text-[9px] font-black text-gray-600 uppercase">Threshold:</span>
                    <select
                      className="bg-transparent text-xs font-black text-white focus:outline-none"
                      value={quoteForm.dailyLimitPercent}
                      onChange={e => setQuoteForm({ ...quoteForm, dailyLimitPercent: Number(e.target.value) })}
                    >
                      {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}% SURGE</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Cost Summary */}
              <div className="p-4 bg-gold-500/5 rounded-3xl border border-gold-500/10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] font-black text-gold-500 uppercase tracking-widest">📋 Cost breakdown</p>
                  <div className="px-2 py-0.5 rounded bg-gold-500 text-obsidian-950 text-[8px] font-black">L2 SPEED</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-gray-600 uppercase mb-0.5">Protocol Fee</p>
                    <p className="text-xs font-black text-white">1 USDT</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-gray-600 uppercase mb-0.5">Locked Margin</p>
                    <p className="text-xs font-black text-white">{selectedRFQ ? (Number(formatUnits(selectedRFQ.notionalUSDT, 6)) * parseFloat(quoteForm.marginRate || '0') / 100).toLocaleString() : '---'} USDT</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-gray-600 uppercase mb-0.5">Total Commitment</p>
                    <p className="text-xs font-black text-gold-500">{selectedRFQ ? (Number(formatUnits(selectedRFQ.notionalUSDT, 6)) * parseFloat(quoteForm.marginRate || '0') / 100 + 1).toLocaleString() : '---'} USDT</p>
                  </div>
                </div>
              </div>
            </div>

            {submitError && <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 text-[9px] font-black text-center tracking-widest uppercase">{submitError}</div>}
            {submitSuccess && <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-emerald-500 text-[9px] font-black text-center tracking-[0.2em] uppercase">{t('seller_hall.transmission_successful')}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => setShowQuoteModal(false)} className="h-14 rounded-2xl text-[10px] font-black tracking-widest text-gray-600 hover:text-white transition-all border border-white/5">{t('common.cancel')}</button>
              <button
                onClick={handleSubmitQuote}
                disabled={isSubmitting || submitSuccess}
                className={`h-14 rounded-2xl text-[10px] font-black tracking-widest transition-all ${isSubmitting || submitSuccess ? 'bg-obsidian-800 text-gray-700' : 'bg-gold-500 text-obsidian-950 hover:bg-gold-400 shadow-2xl shadow-gold-500/20'}`}
              >
                {isSubmitting ? t('common.transmitting') : submitSuccess ? 'SENT' : t('seller_hall.transmit_quote')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
