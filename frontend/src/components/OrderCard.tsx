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

    const getDirectionBadge = (direction: string) => {
        return direction === 'Call'
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20';
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
            className={`glass-card-hover overflow-hidden transition-all duration-500 ${isExpanded ? 'ring-1 ring-primary-500/30' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="p-6">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center border border-white/5 shadow-inner">
                            <span className="text-3xl filter drop-shadow-md">
                                {order.market === 'Crypto' ? '' : order.market === 'US' ? '' : ''}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-xl font-black text-white tracking-tight">{order.underlyingName}</h3>
                                <span className="text-xs font-bold text-dark-500 bg-dark-800/50 px-2 py-0.5 rounded border border-white/5 uppercase">{order.underlyingCode}</span>
                            </div>
                            <p className="text-xs font-bold text-dark-400 uppercase tracking-widest mt-1">Order #{order.orderId}</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                        <div className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getStatusTheme(order.status)}`}>
                            {order.status.replace('_', ' ')}
                        </div>
                        <div className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getDirectionBadge(order.direction)}`}>
                            {order.direction === 'Call' ? ' Long Call' : ' Long Put'}
                        </div>
                    </div>
                </div>

                {/* Grid Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-colors hover:bg-white/[0.04]">
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Notional</p>
                        <p className="text-lg font-bold text-white">{formatAmount(order.notionalUSDT)}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-colors hover:bg-white/[0.04]">
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Premium Rate</p>
                        <p className="text-lg font-bold text-gradient-gold">{(order.premiumRate / 100).toFixed(2)}%</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-colors hover:bg-white/[0.04]">
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Expiry</p>
                        <p className="text-lg font-bold text-white">{formatDate(order.expiryTimestamp)}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-colors hover:bg-white/[0.04]">
                        <p className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Est. Premium</p>
                        <p className="text-lg font-extrabold text-green-400">{formatAmount(order.notionalUSDT * order.premiumRate / 10000)}</p>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="px-6 pb-6 pt-2 border-t border-white/5 mt-2 bg-gradient-to-b from-transparent to-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] mb-2">Counterparty Requirements</h4>
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center text-xs"></div>
                                    <span className="text-sm font-semibold text-dark-200">{order.sellerType}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center md:justify-end space-x-3">
                            {type === 'buyer' && order.status === 'RFQ_CREATED' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAction?.(order.orderId, 'cancel');
                                    }}
                                    className="btn-secondary text-sm border-red-500/20 text-red-400 hover:bg-red-500/10"
                                >
                                    Cancel RFQ
                                </button>
                            )}
                            {type === 'seller' && order.status === 'RFQ_CREATED' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAction?.(order.orderId, 'quote');
                                    }}
                                    className="btn-primary text-sm"
                                >
                                    Submit Quote
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction?.(order.orderId, 'view');
                                }}
                                className="btn-secondary text-sm"
                            >
                                Detailed Analytics
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Minimal interaction hint */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary-500/20 to-transparent opacity-0 group-hover:opacity-100" />
        </div>
    );
}

export default OrderCard;
