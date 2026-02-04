import { useState, useEffect } from 'react';
import { useOptions } from '../hooks';
import { useWalletContext } from '../context/WalletContext';
import { usePerspective } from '../context/PerspectiveContext';
import { formatUnits } from 'ethers';
import { useTranslation } from 'react-i18next';


export function MyOrders() {
    const { isConnected, account } = useWalletContext();
    const { t } = useTranslation();
    const { perspective: viewMode, setPerspective: setViewMode } = usePerspective();
    const {

        getBuyerOrders,
        getSellerOrders,
        getOrder,
        earlyExercise,
        settleOrder,
        initiateArbitration,
        addMargin,
        withdrawExcessMargin,
    } = useOptions();

    const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
    const [sellerOrders, setSellerOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // 30秒自动刷新订单状态

    useEffect(() => {
        if (!isConnected) return;

        const interval = setInterval(() => {
            setRefreshKey(prev => prev + 1);
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [isConnected]);

    useEffect(() => {
        const fetchOrders = async () => {
            if (!isConnected || !account) return;
            setLoading(true);
            try {
                const bIds = await getBuyerOrders();
                const sIds = await getSellerOrders();
                const bData = await Promise.all(bIds.map((id: any) => getOrder(Number(id))));
                const sData = await Promise.all(sIds.map((id: any) => getOrder(Number(id))));
                setBuyerOrders(bData);
                setSellerOrders(sData);
            } catch (e) {
                console.error('Failed to fetch orders:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [isConnected, account, refreshKey, getBuyerOrders, getOrder, getSellerOrders]);

    const activeOrders = viewMode === 'buyer' ? buyerOrders : sellerOrders;

    const formatAmount = (val: bigint) => {
        const num = Number(formatUnits(val, 6));
        if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
        return `$${num.toLocaleString()}`;
    };

    return (
        <div className="flex flex-col space-y-12 pb-24 animate-in fade-in duration-700">
            {/* Perspective Controller */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mt-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${viewMode === 'buyer' ? 'bg-blue-500 shadow-[0_0_15px_#3b82f6]' : 'bg-purple-500 shadow-[0_0_15px_#a855f7]'}`} />
                        <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${viewMode === 'buyer' ? 'text-blue-400' : 'text-purple-400'}`}>
                            {t('portfolio.active_strategies')}
                        </span>
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter italic">
                        {t('portfolio.portfolio_management')}
                    </h1>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: t('portfolio.active_exposure'), value: formatAmount(activeOrders.reduce((acc, o) => acc + (o.notionalUSDT || 0n), 0n)), icon: '⚡' },
                    { label: t('portfolio.pnl_estimate'), value: '+$4.2K', icon: viewMode === 'buyer' ? '📈' : '💎', color: 'text-emerald-500' },
                    { label: t('portfolio.capital_utility'), value: '88.4%', icon: '🏗️' }
                ].map((stat, i) => (

                    <div key={i} className="obsidian-glass grid-bg p-8 flex flex-col group hover:border-white/20">
                        <div className="flex justify-between items-center mb-6">
                            <span className="section-label">{stat.label}</span>
                            <span className="text-xl">{stat.icon}</span>
                        </div>
                        <span className={`text-4xl font-black italic tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Matrix Display */}
            <div className="flex flex-col space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">{t('portfolio.strategy_grid')}</h3>
                    <button onClick={() => setRefreshKey(k => k + 1)} className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all">{t('portfolio.reload_stream')}</button>
                </div>


                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="h-64 obsidian-glass animate-pulse bg-white/5 border-dashed" />
                    ) : activeOrders.length === 0 ? (
                        <div className="obsidian-glass p-24 text-center border-white/5">
                            <span className="text-white/10 font-black italic tracking-[0.5em]">No strategies active in current mode</span>
                        </div>
                    ) : (
                        activeOrders.map((order, i) => (
                            <div key={i} className={`obsidian-glass p-8 flex flex-col lg:flex-row lg:items-center gap-10 group relative overflow-hidden transition-all duration-500 border-l-4 ${viewMode === 'buyer' ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                                <div className="flex-1 space-y-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black border tracking-[0.2em] italic ${order.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                            {String(order.status).toUpperCase()}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-white/20">ORD_REF_{order.orderId}</span>
                                    </div>
                                    <div className="flex items-end gap-6">
                                        <h4 className="text-3xl font-black text-white italic tracking-tighter">{order.underlyingName}</h4>
                                        <span className={`text-xl font-black italic ${order.direction === 'Call' ? 'text-emerald-500' : 'text-red-500'}`}>{order.direction.toUpperCase()}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">Notional</span>
                                            <span className="text-sm font-black text-white italic tracking-tight">{formatAmount(order.notionalUSDT || 0n)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">Strike</span>
                                            <span className="text-sm font-black text-white/60 italic tracking-tight">${order.refPrice}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">Est. Value</span>
                                            <span className="text-sm font-black text-emerald-500 italic tracking-tight">+$1,240.00</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">Delta</span>
                                            <span className="text-sm font-black text-white/40 italic tracking-tight">0.82</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap lg:flex-nowrap gap-4 relative z-10">
                                    {viewMode === 'buyer' ? (
                                        <>
                                            <button onClick={() => earlyExercise(order.orderId)} className="btn-buyer min-w-[140px]">EXERCISE</button>
                                            <button onClick={() => settleOrder(order.orderId)} className="btn-elite-secondary min-w-[140px] h-12">SETTLE</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => addMargin(order.orderId, "0")} className="btn-seller min-w-[140px]">ADD MARGIN</button>
                                            <button onClick={() => withdrawExcessMargin(order.orderId, "0")} className="btn-elite-secondary min-w-[140px] h-12">WITHDRAW</button>
                                        </>
                                    )}
                                    <button onClick={() => initiateArbitration(order.orderId)} className="btn-elite-secondary w-12 h-12 !p-0 opacity-20 hover:opacity-100 hover:border-red-500/50">
                                        ⚠️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default MyOrders;
