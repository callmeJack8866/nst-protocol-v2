import { useState } from 'react';

interface OrderCardProps {
    order: {
        orderId: number;
        underlyingName: string;
        underlyingCode: string;
        market: string;
        direction: string;
        notionalUSDT: number;
        premiumRate: number;
        expiryTimestamp: number;
        status: string;
        sellerType: string;
        refPrice?: string;
        createdAt?: number; // RFQ 创建时间，用于计算有效期倒计时
    };
    onAction?: (orderId: number) => void;
    actionLabel?: string;
}

export function OrderCard({ order, onAction, actionLabel }: OrderCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Compact number formatting for extremely large amounts (e.g. $1.00Q)
    const formatAmount = (amount: number) => {
        if (amount >= 1e18) return `$${(amount / 1e18).toFixed(2)}Q`;
        if (amount >= 1e15) return `$${(amount / 1e15).toFixed(2)}P`;
        if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
        if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
        if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'RFQ_CREATED': return '询价中';
            case 'QUOTING': return '报价中';
            case 'LIVE': return '已激活';
            case 'MATCHED': return '已撮合';
            case 'SETTLED': return '已结算';
            case 'CANCELLED': return '已取消';
            default: return '未知状态';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RFQ_CREATED': return 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10';
            case 'QUOTING': return 'text-amber-400 bg-amber-400/5 border-amber-400/10';
            case 'LIVE': return 'text-white bg-emerald-500 border-emerald-500/20';
            default: return 'text-slate-500 bg-white/5 border-white/5';
        }
    };

    /**
     * 计算 RFQ 剩余有效期 (默认 2 小时)
     */
    const getRfqRemaining = (): { text: string; isUrgent: boolean; isExpired: boolean } | null => {
        if (!order.createdAt) return null;
        if (order.status !== 'RFQ_CREATED' && order.status !== 'QUOTING') return null;

        const rfqValiditySeconds = 2 * 60 * 60; // 2 小时
        const now = Math.floor(Date.now() / 1000);
        const deadline = order.createdAt + rfqValiditySeconds;
        const remaining = deadline - now;

        if (remaining <= 0) {
            return { text: '已过期', isUrgent: false, isExpired: true };
        }

        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        const isUrgent = remaining < 1800; // 30 分钟内为紧急

        if (hours > 0) {
            return { text: `${hours}h ${mins}m`, isUrgent, isExpired: false };
        }
        return { text: `${mins}分钟`, isUrgent: true, isExpired: false };
    };

    return (
        <div
            className="group relative animate-elite-entry"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Glow */}
            <div className={`absolute -inset-x-4 -inset-y-2 bg-emerald-500/5 blur-3xl rounded-[48px] transition-opacity duration-1000 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />

            <div className={`relative glass-surface p-10 rounded-[40px] transition-all duration-700 ${isHovered ? 'border-emerald-500/30 -translate-y-1.5' : ''}`}>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12">

                    {/* Primary Asset Info */}
                    <div className="flex items-center space-x-8 min-w-[320px]">
                        <div className="w-16 h-16 rounded-[24px] bg-slate-950 border border-white/5 flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform duration-700">
                            {order.direction === 'Call' ? '📈' : '📉'}
                        </div>
                        <div>
                            <div className="flex items-center space-x-4 mb-2.5">
                                <h3 className="text-2xl font-bold text-white tracking-tight italic">{order.underlyingName}</h3>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${getStatusColor(order.status)} border uppercase`}>
                                    {getStatusLabel(order.status)}
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                                <span>{order.market}</span>
                                <span className="text-white/10">•</span>
                                <span className={order.direction === 'Call' ? 'text-emerald-400' : 'text-rose-400'}>{order.direction === 'Call' ? '看涨期权' : '看跌期权'}</span>
                                <span className="text-white/10">•</span>
                                <span className="text-white opacity-30">编号 #{order.orderId}</span>
                            </div>
                        </div>
                    </div>

                    {/* Transactional Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 flex-1 border-x border-white/[0.03] px-12">
                        <div className="space-y-2">
                            <p className="text-label">名义本金 Notional</p>
                            <p className="text-xl font-bold text-white tracking-tight truncate max-w-[140px]" title={String(order.notionalUSDT)}>
                                {formatAmount(order.notionalUSDT)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-label">费率 Premium</p>
                            <p className="text-xl font-bold text-emerald-400 italic tracking-tighter">{(order.premiumRate / 100).toFixed(2)}%</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-label">到期时间 Expiry</p>
                            <p className="text-xl font-bold text-slate-300 tracking-tight">{formatDate(order.expiryTimestamp)}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-label">参考价 Mark</p>
                            <p className="text-xl font-bold text-slate-500 italic">${order.refPrice || '--'}</p>
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="min-w-[180px] flex justify-end">
                        {onAction ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAction(order.orderId); }}
                                className="w-full btn-elite-primary text-[12px] py-4 tracking-widest shadow-xl"
                            >
                                {actionLabel || '立即执行'}
                            </button>
                        ) : (
                            <div className="w-full flex justify-end">
                                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-600 group-hover:text-emerald-500 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/5 transition-all duration-500">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="m9 18 6-6-6-6" /></svg>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footnote Metadata */}
                <div className="mt-10 pt-8 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    <div className="flex items-center space-x-8">
                        <span className="flex items-center gap-2"><span className="opacity-40">对手方:</span> <span className="text-slate-400">{order.sellerType === 'Open Market' ? '全公开市场' : '特定对手方'}</span></span>
                        <span>•</span>
                        <span className="flex items-center gap-2"><span className="opacity-40">结算周期:</span> <span className="text-slate-400">实时结算 (T+0)</span></span>
                        <span>•</span>
                        <span className="flex items-center gap-2"><span className="opacity-40">校验协议:</span> <span className="text-slate-400">NST-P2P v2.0</span></span>
                    </div>
                    <div className="flex items-center space-x-2 text-emerald-500/40">
                        {/* RFQ 有效期倒计时 */}
                        {(() => {
                            const rfqRemaining = getRfqRemaining();
                            if (rfqRemaining) {
                                return (
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mr-3 ${rfqRemaining.isExpired
                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20'
                                            : rfqRemaining.isUrgent
                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20 animate-pulse'
                                                : 'bg-slate-700/50 text-slate-400 border border-white/10'
                                        }`}>
                                        ⏱️ 有效期: {rfqRemaining.text}
                                    </span>
                                );
                            }
                            return null;
                        })()}
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        <span>链上实时验证</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OrderCard;
