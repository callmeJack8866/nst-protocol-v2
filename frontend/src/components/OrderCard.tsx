import { useState } from 'react';

interface OrderCardProps {
    order: {
        orderId: number;
        underlyingName: string;
        underlyingCode: string;
        market: string;
        direction: 'Call' | 'Put';
        notionalUSDT: number;
        premiumRate: number;
        expiryTimestamp: number;
        status: string;
        sellerType: string;
    };
    type: 'buyer' | 'seller';
    onAction?: (orderId: number, action: string) => void;
}

export function OrderCard({ order, type, onAction }: OrderCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getDirectionTheme = (direction: string) => {
        return direction === 'Call'
            ? 'text-green-400'
            : 'text-red-400';
    };

    const getStatusTheme = (status: string) => {
        switch (status) {
            case 'RFQ_CREATED': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'QUOTING': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'MATCHED':
            case 'LIVE': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'SETTLED': return 'text-primary-400 bg-primary-500/10 border-primary-500/20';
            case 'CANCELLED': return 'text-dark-400 bg-dark-500/10 border-dark-500/20';
            default: return 'text-dark-300 bg-dark-500/10 border-dark-500/20';
        }
    };

    return (
        <div
            className={`glass-card-hover overflow-hidden border-white/[0.05] transition-all duration-300 ${isExpanded ? 'bg-white/[0.04]' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="px-8 py-6">
                {/* Compact Header Row */}
                <div className="flex items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-dark-900 flex items-center justify-center border border-white/5 flex-shrink-0">
                            <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">
                                {order.market === 'Crypto' ? '₿' : order.market === 'US' ? '🇺🇸' : '🇨🇳'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-white tracking-tight truncate">{order.underlyingName}</h3>
                                <span className="text-xs font-bold text-dark-500 bg-dark-800/50 px-2 py-0.5 rounded border border-white/5 uppercase font-mono flex-shrink-0">{order.underlyingCode}</span>
                            </div>
                            <p className="text-xs font-bold text-dark-500 uppercase tracking-wide mt-1">Order ID #{order.orderId}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <div className={`px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wide ${getDirectionTheme(order.direction)} border-current/10 bg-current/5`}>
                            {order.direction} Option
                        </div>
                        <div className={`px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wide ${getStatusTheme(order.status)}`}>
                            {order.status.replace('_', ' ')}
                        </div>
                    </div>
                </div>

                {/* Clean Horizontal Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex flex-col">
                        <span className="metric-label mb-1.5">Notional</span>
                        <span className="metric-value text-base lg:text-lg">{formatAmount(order.notionalUSDT)}</span>
                    </div>
                    <div className="flex flex-col lg:border-l lg:border-white/5 lg:pl-6">
                        <span className="metric-label mb-1.5">Premium Rate</span>
                        <span className="metric-value text-gradient-gold text-base lg:text-lg">{(order.premiumRate / 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex flex-col lg:border-l lg:border-white/5 lg:pl-6">
                        <span className="metric-label mb-1.5">Expiry Date</span>
                        <span className="metric-value text-base lg:text-lg">{formatDate(order.expiryTimestamp)}</span>
                    </div>
                    <div className="flex flex-col lg:border-l lg:border-white/5 lg:pl-6">
                        <span className="metric-label mb-1.5">Estimated Yield</span>
                        <span className="metric-value text-green-400 text-base lg:text-lg">{formatAmount(order.notionalUSDT * order.premiumRate / 10000)}</span>
                    </div>
                </div>
            </div>

            {/* Expanded Content - Simpler */}
            {isExpanded && (
                <div className="px-6 pb-6 pt-4 border-t border-white/5 bg-black/10 animate-fade-in">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center space-x-8">
                            <div>
                                <h4 className="metric-label mb-1">Required Verification</h4>
                                <p className="text-sm font-semibold text-dark-200">{order.sellerType}</p>
                            </div>
                            <div className="w-px h-8 bg-white/5" />
                            <div>
                                <h4 className="metric-label mb-1">Protocol Fee</h4>
                                <p className="text-sm font-semibold text-dark-200">1.00 USDT</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {type === 'buyer' && order.status === 'RFQ_CREATED' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAction?.(order.orderId, 'cancel'); }}
                                    className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                                >
                                    Cancel Request
                                </button>
                            )}
                            {type === 'seller' && order.status === 'RFQ_CREATED' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAction?.(order.orderId, 'quote'); }}
                                    className="btn-primary text-xs py-2 px-5"
                                >
                                    Submit Quote
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onAction?.(order.orderId, 'view'); }}
                                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors"
                            >
                                Detailed View
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visual indicator bar */}
            <div className={`h-[2px] w-full transition-all duration-300 ${isExpanded ? 'bg-primary-500/40' : 'bg-transparent group-hover:bg-primary-500/10'}`} />
        </div>
    );
}

export default OrderCard;
