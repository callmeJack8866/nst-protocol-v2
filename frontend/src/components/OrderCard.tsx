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
            <div className="px-6 py-5">
                {/* Compact Header Row */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-dark-900 flex items-center justify-center border border-white/5">
                            <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">
                                {order.market === 'Crypto' ? '' : order.market === 'US' ? '' : ''}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-lg font-bold text-white tracking-tight">{order.underlyingName}</h3>
                                <span className="text-[10px] font-black text-dark-500 bg-dark-800/50 px-1.5 py-0.5 rounded border border-white/5 uppercase font-mono">{order.underlyingCode}</span>
                            </div>
                            <p className="text-[9px] font-bold text-dark-500 uppercase tracking-widest mt-0.5">Order ID #{order.orderId}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <div className={`px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${getDirectionTheme(order.direction)} border-current/10 bg-current/5`}>
                            {order.direction} Option
                        </div>
                        <div className={`px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${getStatusTheme(order.status)}`}>
                            {order.status.replace('_', ' ')}
                        </div>
                    </div>
                </div>

                {/* Clean Horizontal Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 px-2">
                    <div className="flex flex-col">
                        <span className="metric-label mb-1">Notional</span>
                        <span className="metric-value">{formatAmount(order.notionalUSDT)}</span>
                    </div>
                    <div className="flex flex-col relative md:before:content-[''] md:before:absolute md:before:left-[-1rem] md:before:top-1 md:before:bottom-1 md:before:w-[1px] md:before:bg-white/5">
                        <span className="metric-label mb-1">Premium Rate</span>
                        <span className="metric-value text-gradient-gold">{(order.premiumRate / 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex flex-col relative md:before:content-[''] md:before:absolute md:before:left-[-1rem] md:before:top-1 md:before:bottom-1 md:before:w-[1px] md:before:bg-white/5">
                        <span className="metric-label mb-1">Expiry Date</span>
                        <span className="metric-value">{formatDate(order.expiryTimestamp)}</span>
                    </div>
                    <div className="flex flex-col relative md:before:content-[''] md:before:absolute md:before:left-[-1rem] md:before:top-1 md:before:bottom-1 md:before:w-[1px] md:before:bg-white/5">
                        <span className="metric-label mb-1">Estimated Yield</span>
                        <span className="metric-value text-green-400">{formatAmount(order.notionalUSDT * order.premiumRate / 10000)}</span>
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
