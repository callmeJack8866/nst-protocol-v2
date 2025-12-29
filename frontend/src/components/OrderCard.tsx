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
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getDirectionStyle = (direction: string) => {
        return direction === 'Call'
            ? 'bg-green-500/20 text-green-400 border-green-500/30'
            : 'bg-red-500/20 text-red-400 border-red-500/30';
    };

    const getStatusBadge = (status: string) => {
        const statusStyles: Record<string, string> = {
            RFQ_CREATED: 'badge-info',
            QUOTING: 'badge-warning',
            MATCHED: 'badge-success',
            LIVE: 'badge-success',
            SETTLED: 'badge-info',
            CANCELLED: 'badge-error',
        };
        return statusStyles[status] || 'badge-info';
    };

    return (
        <div className="glass-card-hover p-5" onClick={() => setIsExpanded(!isExpanded)}>
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center">
                        <span className="text-2xl">
                            {order.market === 'Crypto' ? '₿' : order.market === 'US' ? '🇺🇸' : '🇨🇳'}
                        </span>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">{order.underlyingName}</h3>
                        <p className="text-sm text-dark-400">{order.underlyingCode}</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <span className={`badge border ${getDirectionStyle(order.direction)}`}>
                        {order.direction === 'Call' ? '📈 看涨' : '📉 看跌'}
                    </span>
                    <span className={getStatusBadge(order.status)}>
                        {order.status}
                    </span>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-dark-800/50 rounded-xl p-3">
                    <p className="text-xs text-dark-400 mb-1">名义本金</p>
                    <p className="text-lg font-semibold text-white">{formatAmount(order.notionalUSDT)}</p>
                </div>
                <div className="bg-dark-800/50 rounded-xl p-3">
                    <p className="text-xs text-dark-400 mb-1">期权费率</p>
                    <p className="text-lg font-semibold text-primary-400">{(order.premiumRate / 100).toFixed(2)}%</p>
                </div>
                <div className="bg-dark-800/50 rounded-xl p-3">
                    <p className="text-xs text-dark-400 mb-1">到期日</p>
                    <p className="text-lg font-semibold text-white">{formatDate(order.expiryTimestamp)}</p>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-dark-700 pt-4 mt-4 animate-fade-in-up">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-sm text-dark-400">卖方类型</p>
                            <p className="text-white">{order.sellerType}</p>
                        </div>
                        <div>
                            <p className="text-sm text-dark-400">订单ID</p>
                            <p className="text-white">#{order.orderId}</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                        {type === 'buyer' && order.status === 'RFQ_CREATED' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction?.(order.orderId, 'cancel');
                                }}
                                className="btn-secondary text-sm flex-1"
                            >
                                取消订单
                            </button>
                        )}
                        {type === 'seller' && order.status === 'RFQ_CREATED' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction?.(order.orderId, 'quote');
                                }}
                                className="btn-primary text-sm flex-1"
                            >
                                提交报价
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction?.(order.orderId, 'view');
                            }}
                            className="btn-secondary text-sm"
                        >
                            查看详情
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrderCard;
