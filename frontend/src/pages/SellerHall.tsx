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

// T+X 行权延迟选项
const EXERCISE_DELAY_OPTIONS = [
  { value: 1, label: 'T+1', desc: '次日行权' },
  { value: 2, label: 'T+2', desc: '2日后行权' },
  { value: 3, label: 'T+3', desc: '3日后行权' },
  { value: 5, label: 'T+5', desc: '5日后行权' },
];

// 平仓规则选项
const LIQUIDATION_OPTIONS = [
  { value: 0, label: '无强平', desc: '不设自动强平' },
  { value: 1, label: '连板强平', desc: '连续涨停触发' },
  { value: 2, label: '涨幅强平', desc: '单日涨幅触发' },
];

export function SellerHall() {
  const { getAllActiveRFQs, submitQuote, isConnected } = useOptions();
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rfqs, setRfqs] = useState<RFQOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Quote Modal State - 扩展报价表单
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQOrder | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    premiumRate: '6.5',
    marginAmount: '150000',
    exerciseDelay: 1,        // T+1 默认
    liquidationRule: 0,      // 无强平默认
    consecutiveDays: 3,      // 连板天数
    dailyLimitPercent: 10,   // 涨幅百分比
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
    const notional = Number(formatUnits(rfq.notionalUSDT, 6));
    setQuoteForm({
      premiumRate: (rfq.premiumRate / 100).toFixed(2),
      marginAmount: String(Math.floor(notional * 0.15)),
      exerciseDelay: 1,
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
        marginRate: 1500, // 15%
        liquidationRule: quoteForm.liquidationRule,
        consecutiveDays: quoteForm.consecutiveDays,
        dailyLimitPercent: quoteForm.dailyLimitPercent,
        notionalUSDT: selectedRFQ.notionalUSDT,
        // exerciseDelay 需要在合约中支持后传递
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        setShowQuoteModal(false);
        getAllActiveRFQs().then(data => setRfqs(data));
      }, 1500);
    } catch (err: any) { setSubmitError(err.message || '报价提交失败'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-[1400px] mx-auto pt-16 pb-20">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 mb-24">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-label text-amber-500/80">流动性分发与承保终端</span>
          </div>
          <h1 className="text-6xl font-extrabold text-white tracking-tighter italic">流动性大厅 <span className="text-amber-500">Seller Hall</span></h1>
          <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed">
            作为授权流动性节点，承接优质资产询价订单，捕获去中心化保险协议的权利金收益。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center space-x-12 px-10 py-6 glass-surface rounded-[32px]">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">已承保总额</p>
              <p className="text-2xl font-bold text-white tracking-tight italic">$1.2M</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">待响应订单</p>
              <p className="text-2xl font-bold text-white tracking-tight italic">{filteredRFQs.length}</p>
            </div>
          </div>
          <Link to="/create-order" className="btn-elite-warning px-12 h-20 rounded-[28px] text-[14px] tracking-[0.05em] flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M12 5v14M5 12h14" /></svg>
            发布卖方报单
          </Link>
        </div>
      </div>

      <div className="space-y-20">
        {/* Filter Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-10 pb-10 border-b border-white/[0.05]">
          <div className="relative w-full xl:w-[480px]">
            <input type="text" placeholder="搜索资产、市场或代码..." className="elite-input w-full pl-14 pr-8 h-16 text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </div>
          <div className="bg-slate-900 border border-white/[0.08] p-2 rounded-2xl flex">
            {['ALL', 'CN', 'US', 'CRYPTO'].map(m => (
              <button key={m} onClick={() => setFilter(m)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all ${filter === m ? 'bg-amber-500/10 text-amber-500 shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}>
                {m === 'ALL' ? '全部市场' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Market Grid */}
        <div className="space-y-12 min-h-[500px]">
          {!loading && isConnected && (
            <div className="grid grid-cols-1 gap-6">
              <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-[12px] font-black text-slate-600 uppercase tracking-[0.3em] italic">待报价请求流 ({filteredRFQs.length})</h2>
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
                  actionLabel="立即报价 (SUBMIT)"
                />
              ))}
            </div>
          )}
          {!isConnected && !loading && (
            <div className="py-40 rounded-[48px] border-2 border-dashed border-white/[0.05] bg-white/[0.01] text-center flex flex-col items-center">
              <div className="text-8xl opacity-10 mb-10">🛡️</div>
              <h3 className="text-2xl font-bold text-slate-600 uppercase tracking-widest mb-4">连接受限</h3>
              <p className="text-slate-500 text-lg font-medium max-w-sm leading-relaxed">请授权您的交易身份，访问去中心化协议的实时流动性脉冲。</p>
            </div>
          )}
        </div>
      </div>

      <div className="h-32" />

      {/* Quote Modal */}
      {showQuoteModal && selectedRFQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl" onClick={() => setShowQuoteModal(false)} />
          <div className="w-full max-w-[640px] glass-surface rounded-[48px] p-12 relative z-10 shadow-2xl animate-elite-entry border-amber-500/20" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 blur-[120px] -mr-40 -mt-40 pointer-events-none" />

            <div className="text-center mb-12">
              <p className="text-[11px] font-black text-amber-500 uppercase tracking-[0.5em] mb-3">提交报价终端</p>
              <h3 className="text-3xl font-extrabold text-white tracking-tighter italic">报价单详情 / {selectedRFQ.underlyingCode}</h3>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-10 py-8 border-y border-white/[0.08]">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase">名义本金</p>
                <p className="text-xl font-bold text-white">${Number(formatUnits(selectedRFQ.notionalUSDT, 6)).toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase">期权方向</p>
                <p className={`text-xl font-bold ${selectedRFQ.direction === 'Call' ? 'text-emerald-400' : 'text-rose-400'}`}>{selectedRFQ.direction === 'Call' ? '看涨 CALL' : '看跌 PUT'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase">参考价格</p>
                <p className="text-xl font-bold text-white">${selectedRFQ.refPrice}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase">目标费率</p>
                <p className="text-xl font-bold text-amber-400">{(selectedRFQ.premiumRate / 100).toFixed(2)}%</p>
              </div>
            </div>

            <div className="space-y-6 mb-10">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">您的报价费率 (%)</label>
                <input type="text" className="elite-input w-full h-16 text-2xl font-bold text-amber-500" value={quoteForm.premiumRate} onChange={e => setQuoteForm({ ...quoteForm, premiumRate: e.target.value })} />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">质押保证金 (USDT)</label>
                <input type="text" className="elite-input w-full h-16 text-2xl font-bold" value={quoteForm.marginAmount} onChange={e => setQuoteForm({ ...quoteForm, marginAmount: e.target.value })} />
              </div>

              {/* P1: T+X 行权延迟选择 */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">行权延迟 (T+X)</label>
                <div className="grid grid-cols-4 gap-3">
                  {EXERCISE_DELAY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuoteForm({ ...quoteForm, exerciseDelay: opt.value })}
                      className={`p-3 rounded-xl border text-center transition-all ${quoteForm.exerciseDelay === opt.value
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                    >
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-[9px] text-slate-500 mt-1">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* P1: 平仓规则选择 */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">平仓规则建议</label>
                <div className="grid grid-cols-3 gap-3">
                  {LIQUIDATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuoteForm({ ...quoteForm, liquidationRule: opt.value })}
                      className={`p-3 rounded-xl border text-center transition-all ${quoteForm.liquidationRule === opt.value
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                    >
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-[9px] text-slate-500 mt-1">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {/* 连板/涨幅参数 */}
                {quoteForm.liquidationRule === 1 && (
                  <div className="flex items-center gap-4 mt-3 p-3 bg-slate-800/30 rounded-xl">
                    <span className="text-[11px] text-slate-400">连续涨停天数:</span>
                    <select
                      className="elite-input px-3 py-2 text-sm"
                      value={quoteForm.consecutiveDays}
                      onChange={e => setQuoteForm({ ...quoteForm, consecutiveDays: Number(e.target.value) })}
                    >
                      {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} 天</option>)}
                    </select>
                  </div>
                )}
                {quoteForm.liquidationRule === 2 && (
                  <div className="flex items-center gap-4 mt-3 p-3 bg-slate-800/30 rounded-xl">
                    <span className="text-[11px] text-slate-400">单日涨幅阈值:</span>
                    <select
                      className="elite-input px-3 py-2 text-sm"
                      value={quoteForm.dailyLimitPercent}
                      onChange={e => setQuoteForm({ ...quoteForm, dailyLimitPercent: Number(e.target.value) })}
                    >
                      {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}%</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* P1: 费用明细 */}
            <div className="mb-6 p-4 bg-slate-800/30 rounded-2xl border border-white/[0.05]">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">📋 费用明细</p>
              <div className="grid grid-cols-3 gap-4 text-[12px]">
                <div>
                  <p className="text-slate-500">建仓手续费</p>
                  <p className="text-amber-400 font-bold">1 USDT</p>
                </div>
                <div>
                  <p className="text-slate-500">保证金锁定</p>
                  <p className="text-white font-bold">{Number(quoteForm.marginAmount).toLocaleString()} USDT</p>
                </div>
                <div>
                  <p className="text-slate-500">合计支出</p>
                  <p className="text-emerald-400 font-bold">{(Number(quoteForm.marginAmount) + 1).toLocaleString()} USDT</p>
                </div>
              </div>
            </div>

            {submitError && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[12px] font-bold text-center">{submitError}</div>}
            {submitSuccess && <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-[12px] font-bold text-center uppercase tracking-widest">报价已提交成功！</div>}

            <button onClick={handleSubmitQuote} disabled={isSubmitting || submitSuccess} className="w-full btn-elite-warning h-16 rounded-2xl text-[14px] tracking-widest">
              {isSubmitting ? '处理中...' : submitSuccess ? '已提交' : '提交报价 TRANSMIT QUOTE'}
            </button>
            <button onClick={() => setShowQuoteModal(false)} className="mt-6 w-full text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] hover:text-white transition-all">关闭终端 TERMINAL</button>
          </div>
        </div>
      )}
    </div>
  );
}
