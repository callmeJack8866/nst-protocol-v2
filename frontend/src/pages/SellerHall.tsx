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
  const { getAllActiveRFQs, isConnected } = useOptions();
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rfqs, setRfqs] = useState<RFQOrder[]>([]);
  const [loading, setLoading] = useState(true);

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
            <input
              type="text"
              placeholder="搜索资产、市场或代码..."
              className="elite-input w-full pl-14 pr-8 h-16 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
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
                    refPrice: rfq.refPrice
                  }}
                  onAction={(id) => { console.log("提价 ID", id); }}
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
    </div>
  );
}
