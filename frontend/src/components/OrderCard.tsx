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

    // Safe direction conversion: handles both string and number
    const getDirectionStr = (direction: any): string => {
        if (typeof direction === 'string') return direction;
        return Number(direction) === 0 ? 'Call' : 'Put';
    };

    // 格式化金额
    const formatAmount = (amount: number) => {
        if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
        if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
        if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
        if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'RFQ_CREATED': return 'QUOTING';
            case 'QUOTING': return 'QUOTING';
            case 'LIVE': return 'ACTIVE';
            case 'MATCHED': return 'MATCHED';
            case 'SETTLED': return 'SETTLED';
            case 'CANCELLED': return 'CANCELLED';
            default: return 'UNKNOWN';
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'RFQ_CREATED':
            case 'QUOTING':
                return 'text-gold-500 bg-gold-500/10 border-gold-500/30';
            case 'LIVE':
                return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
            case 'SETTLED':
                return 'text-gray-500 bg-obsidian-800 border-white/5';
            case 'CANCELLED':
                return 'text-red-500 bg-red-500/10 border-red-500/30';
            default:
                return 'text-gray-400 bg-white/5 border-white/5';
        }
    };

    const getRfqRemaining = (): { text: string; isUrgent: boolean; isExpired: boolean } | null => {
        if (!order.createdAt) return null;
        if (order.status !== 'RFQ_CREATED' && order.status !== 'QUOTING') return null;

        const rfqValiditySeconds = 2 * 60 * 60;
        const now = Math.floor(Date.now() / 1000);
        const deadline = order.createdAt + rfqValiditySeconds;
        const remaining = deadline - now;

        if (remaining <= 0) return { text: 'EXPIRED', isUrgent: false, isExpired: true };

        const mins = Math.floor(remaining / 60);
        const isUrgent = remaining < 1800; // 30 mins

        return { text: `${mins}M Remaining`, isUrgent, isExpired: false };
    };

    return (
        <div
            className="group relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Glow */}
            <div className={`absolute -inset-2 bg-gold-500/5 blur-[60px] rounded-[40px] transition-opacity duration-1000 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />

            <div className={`relative glass-panel p-8 rounded-[40px] transition-all duration-500 ${isHovered ? 'border-gold-500/30 -translate-y-1' : ''}`}>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">

                    {/* Left: Asset Identity */}
                    <div className="flex items-center space-x-6 min-w-[280px]">
                        <div className={`w-14 h-14 rounded-2xl bg-obsidian-950 border border-white/5 flex items-center justify-center text-2xl transition-all duration-500 ${isHovered ? 'shadow-[0_0_20px_rgba(234,179,8,0.2)] border-gold-500/20' : ''}`}>
                            {getDirectionStr(order.direction) === 'Call' ? '📈' : '📉'}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1.5">
                                <h3 className="text-xl font-black text-white tracking-tighter italic">{order.underlyingName}</h3>
                                <div className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black tracking-[0.2em] border uppercase ${getStatusStyles(order.status)}`}>
                                    {getStatusLabel(order.status)}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-600">
                                <span>{order.market}</span>
                                <span className="opacity-20">•</span>
                                <span className={getDirectionStr(order.direction) === 'Call' ? 'text-emerald-500' : 'text-red-500'}>{getDirectionStr(order.direction).toUpperCase()}</span>
                                <span className="opacity-20">•</span>
                                <span className="opacity-40">#{order.orderId}</span>
                            </div>
                        </div>
                    </div>

                    {/* Center: Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 border-white/5 xl:border-x xl:px-8">
                        <div className="flex flex-col">
                            <span className="data-label mb-1.5 opacity-40">Notional</span>
                            <span className="text-lg font-black text-white tracking-tight">{formatAmount(order.notionalUSDT)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="data-label mb-1.5 opacity-40">Max Rate</span>
                            <span className="text-lg font-black text-gold-500 italic">{(order.premiumRate / 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="data-label mb-1.5 opacity-40">Settlement</span>
                            <span className="text-lg font-black text-gray-500 italic tracking-tighter">{formatDate(order.expiryTimestamp)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="data-label mb-1.5 opacity-40">Mark Price</span>
                            <span className="text-lg font-black text-gray-700 italic">${order.refPrice || '--'}</span>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="min-w-[160px] flex justify-end">
                        {onAction ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAction(order.orderId); }}
                                className="w-full btn-gold text-[10px] py-4 tracking-widest uppercase font-black shadow-2xl"
                            >
                                {actionLabel || 'Execute'}
                            </button>
                        ) : (
                            <div className="w-full flex justify-end">
                                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-600 group-hover:text-gold-500 group-hover:border-gold-500/40 group-hover:bg-gold-500/5 transition-all duration-500">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="m9 18 6-6-6-6" /></svg>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-700">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="opacity-30">COUNTERPARTY:</span>
                            <span className="text-gray-500">{order.sellerType === 'Open Market' ? 'GLOBAL LIQUIDITY' : 'DIRECT P2P'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="opacity-30">CLEARING:</span>
                            <span className="text-gray-500">REAL-TIME T+0</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {(() => {
                            const rem = getRfqRemaining();
                            if (rem) {
                                return (
                                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black border tracking-widest ${rem.isExpired
                                        ? 'bg-red-500/10 text-red-500 border-red-500/10'
                                        : rem.isUrgent
                                            ? 'bg-gold-500/10 text-gold-500 border-gold-500/10 animate-pulse'
                                            : 'bg-obsidian-800 text-gray-500 border-white/5'
                                        }`}>
                                        VALIDITY: {rem.text}
                                    </span>
                                );
                            }
                            return null;
                        })()}
                        <div className="flex items-center gap-2 text-emerald-500/40">
                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shadow-[0_0_8px_currentColor]" />
                            <span>ON-CHAIN VERIFIED</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OrderCard;
