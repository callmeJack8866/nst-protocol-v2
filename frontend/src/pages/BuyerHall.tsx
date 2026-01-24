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
    } catch (err: any) { setAcceptError(err.message || '接受报价失败'); }
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
    <div className="max-w-[1400px] mx-auto pt-16 pb-20">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 mb-24">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-label text-emerald-500/80">实时行情与撮合终端</span>
          </div>
          <h1 className="text-6xl font-extrabold text-white tracking-tighter italic">买方大厅 <span className="text-emerald-500">Buyer Hall</span></h1>
          <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed">
            浏览全球市场的实时询价订单，寻找最符合您投资策略的场外期权流动性。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center space-x-12 px-10 py-6 glass-surface rounded-[32px]">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">全网总流动性</p>
              <p className="text-2xl font-bold text-white tracking-tight italic">$---</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">活跃询价订单</p>
              <p className="text-2xl font-bold text-white tracking-tight italic">{rfqs.length}</p>
            </div>
          </div>
          <Link to="/create-rfq" className="btn-elite-primary px-12 h-20 rounded-[28px] text-[14px] tracking-[0.05em] shadow-2xl shadow-emerald-500/20">
            发起新询价 (RFQ)
          </Link>
        </div>
      </div>

      <div className="space-y-20">
        {/* Filter Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-10 pb-10 border-b border-white/[0.05]">
          <div className="relative w-full xl:w-[480px]">
            <input
              type="text"
              placeholder="搜索资产名称、代码或关键字..."
              className="elite-input w-full pl-14 pr-8 h-16 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex bg-slate-900 border border-white/[0.08] p-2 rounded-2xl">
              {['ALL', 'CN', 'US', 'CRYPTO'].map(m => (
                <button key={m} onClick={() => setFilter(m)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all ${filter === m ? 'bg-white/10 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}>
                  {m === 'ALL' ? '全部市场' : m}
                </button>
              ))}
            </div>
            <div className="flex bg-slate-900 border border-white/[0.08] p-2 rounded-2xl">
              {['ALL', 'CALL', 'PUT'].map(d => (
                <button key={d} onClick={() => setDirectionFilter(d)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all ${directionFilter === d ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'}`}>
                  {d === 'ALL' ? '全部方向' : d === 'CALL' ? '看涨 CALL' : '看跌 PUT'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Market Grid */}
        <div className="space-y-12 min-h-[500px]">
          {!isConnected ? (
            <div className="py-40 rounded-[48px] border-2 border-dashed border-white/[0.05] bg-white/[0.01] text-center flex flex-col items-center">
              <div className="text-8xl opacity-10 mb-10">🛡️</div>
              <h3 className="text-2xl font-bold text-slate-600 uppercase tracking-widest mb-4">连接受限</h3>
              <p className="text-slate-500 text-lg font-medium max-w-sm leading-relaxed">请连接您的 Web3 钱包，以实时观测去中心化节点传输的市场行情数据流。</p>
              <button onClick={() => connect()} className="mt-12 btn-elite-primary px-10 h-14">授权连接 Authenticate</button>
            </div>
          ) : loading ? (
            <div className="py-40 flex flex-col items-center space-y-6">
              <div className="w-12 h-12 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-[12px] font-black text-slate-600 uppercase tracking-[0.3em]">同步节点数据中...</p>
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
                    refPrice: rfq.refPrice
                  }}
                  onAction={rfq.buyer.toLowerCase() === account?.toLowerCase() && rfq.status === 'QUOTING' ? async (id) => {
                    setSelectedRFQ(rfq);
                    setShowQuotesModal(true);
                    setLoadingQuotes(true);
                    try {
                      const q = await getQuotesForOrder(id);
                      setQuotes(q.filter((item: any) => item.status === 0));
                    } finally { setLoadingQuotes(false); }
                  } : undefined}
                  actionLabel="查看收到报价"
                />
              ))}
              {filteredRFQs.length === 0 && (
                <div className="py-40 text-center opacity-40 italic text-slate-500 font-bold uppercase tracking-widest text-[14px]">
                  当前检索条件下未发现活跃询价信号
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-32" />

      {/* Quotes Modal */}
      {showQuotesModal && selectedRFQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl transition-all animate-fade-in" onClick={() => setShowQuotesModal(false)} />
          <div className="w-full max-w-[840px] glass-surface rounded-[56px] p-16 relative z-10 shadow-2xl overflow-hidden animate-elite-entry border-white/10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[140px] -mr-48 -mt-48" />

            <div className="text-center mb-16">
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.5em] mb-4">实时报价分析终端</p>
              <h3 className="text-4xl font-extrabold text-white tracking-tighter italic">询价单详情 <span className="opacity-20">/</span> {selectedRFQ.underlyingCode}</h3>
            </div>

            <div className="grid grid-cols-4 gap-10 mb-16 py-10 border-y border-white/[0.08]">
              <MetricItem label="名义本金" value={`$${Number(formatUnits(selectedRFQ.notionalUSDT, 6)).toLocaleString()}`} />
              <MetricItem label="期权方向" value={selectedRFQ.direction === 'Call' ? '看涨 CALL' : '看跌 PUT'} gold={selectedRFQ.direction === 'Call'} />
              <MetricItem label="参考价格" value={`$${selectedRFQ.refPrice}`} />
              <MetricItem label="目标费率" value={`${(selectedRFQ.premiumRate / 100).toFixed(2)}%`} />
            </div>

            <div className="space-y-6 max-h-[440px] overflow-y-auto pr-4 custom-scroll">
              {loadingQuotes ? (
                <div className="py-24 flex flex-col items-center space-y-6 opacity-40">
                  <div className="w-10 h-10 border-4 border-white/5 border-t-white rounded-full animate-spin" />
                  <p className="text-[12px] font-black uppercase tracking-[0.4em]">正在轮询去中心化节点数据...</p>
                </div>
              ) : quotes.length === 0 ? (
                <div className="py-24 text-center border-2 border-white/[0.04] rounded-[40px] bg-white/[0.01] border-dashed">
                  <p className="text-[13px] font-bold text-slate-600 uppercase tracking-widest italic leading-loose">当前暂无做市商节点发起有效报价</p>
                </div>
              ) : quotes.map(quote => (
                <div key={quote.quoteId} className="group bg-white/[0.03] border border-white/10 rounded-[32px] p-8 hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all flex items-center justify-between gap-12">
                  <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 bg-slate-950 border border-white/10 rounded-[20px] flex items-center justify-center text-3xl shadow-inner">🛡️</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase mb-1.5">报价方标识符 (Node ID)</p>
                      <p className="text-[13px] font-mono font-bold text-white uppercase tracking-tight">{quote.seller.slice(0, 16)}...{quote.seller.slice(-10)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-600 uppercase mb-1.5">提供的权利金费率</p>
                      <p className="text-3xl font-bold text-emerald-400 italic tracking-tighter">{(quote.premiumRate / 100).toFixed(2)}%</p>
                    </div>
                    <button
                      onClick={() => handleAccept(quote)}
                      disabled={isAccepting || acceptSuccess}
                      className="btn-elite-primary h-14 px-10 rounded-2xl text-[12px] shadow-none"
                    >
                      {isAccepting ? '处理中...' : acceptSuccess ? '撮合成功' : '接受并交易'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {acceptError && (
              <div className="mt-10 bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl text-rose-500 text-[12px] font-black text-center uppercase tracking-[0.1em]">
                执行冲突: {acceptError}
              </div>
            )}

            <button onClick={() => setShowQuotesModal(false)} className="mt-16 w-full text-[11px] font-black text-slate-700 uppercase tracking-[0.5em] hover:text-white transition-all">关闭终端 TERMINAL</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, gold }: { label: string, value: string, gold?: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold italic tracking-tighter ${gold ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
