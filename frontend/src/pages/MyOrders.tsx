import { useState, useEffect } from 'react';
import { useOptions, useFeedProtocol, useVolumeBasedFeed } from '../hooks';
import { useToast } from '../components/Toast';
import FeedTierModal from '../components/FeedTierModal';
import { useWalletContext } from '../context/WalletContext';
import { usePerspective } from '../context/PerspectiveContext';
import { formatUnits, Contract } from 'ethers';
import { useTranslation } from 'react-i18next';
import { formatUSDTAmount, usdtToNumber } from '../utils/transformers';
import { ORDER_STATUS, FEED_TYPE, FEED_TIER } from '../constants/orderStatus';
import { getContractAddresses } from '../contracts/config';


export function MyOrders() {
    const { isConnected, account, provider, chainId } = useWalletContext();
    const { t } = useTranslation();
    const { perspective: viewMode } = usePerspective();
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

    // Feed protocol for initiating initial feeds
    const { requestFeed, isLoading: feedLoading, getOrderFeedRequests } = useFeedProtocol();
    const { submitSuggestedPrice, isLoading: vbfLoading } = useVolumeBasedFeed();
    const { showToast } = useToast();

    const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
    const [sellerOrders, setSellerOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [initFeedLoading, setInitFeedLoading] = useState<number | null>(null);

    // 保证金弹窗状态
    const [marginModalOpen, setMarginModalOpen] = useState(false);
    const [marginModalType, setMarginModalType] = useState<'add' | 'withdraw'>('add');
    const [marginAmount, setMarginAmount] = useState('');
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

    // 仲裁弹窗状态
    const [arbitrationModalOpen, setArbitrationModalOpen] = useState(false);
    const [arbitrationOrderId, setArbitrationOrderId] = useState<number | null>(null);

    // 动态喂价加载状态
    const [dynamicFeedLoading, setDynamicFeedLoading] = useState<number | null>(null);

    // 喂价档位弹窗状态
    const [tierModalOpen, setTierModalOpen] = useState(false);
    const [tierModalOrderId, setTierModalOrderId] = useState<number | null>(null);

    // 跟量成交喂价弹窗状态
    const [vbfModalOpen, setVbfModalOpen] = useState(false);
    const [vbfOrderId, setVbfOrderId] = useState<number | null>(null);
    const [vbfFeedType, setVbfFeedType] = useState(0); // 0=Initial, 1=Dynamic, 2=Final
    const [vbfIsInitial, setVbfIsInitial] = useState(true);
    const [vbfPrice, setVbfPrice] = useState('');
    const [vbfEvidence, setVbfEvidence] = useState('');
    const [feedFees, setFeedFees] = useState<string[]>(['', '', '']);

    // 已发起喂价请求的 orderId 集合（用于 UI 反馈，因为合约 status 不会立刻变化）
    // 使用 localStorage 持久化，避免页面刷新时状态闪烁
    const [feedRequestedOrders, setFeedRequestedOrders] = useState<Set<number>>(() => {
        try {
            const cached = localStorage.getItem('nst_feed_requested_orders');
            if (cached) return new Set(JSON.parse(cached) as number[]);
        } catch { /* ignore parse error */ }
        return new Set();
    });

    // 同步 feedRequestedOrders 到 localStorage
    useEffect(() => {
        try {
            localStorage.setItem('nst_feed_requested_orders', JSON.stringify([...feedRequestedOrders]));
        } catch { /* ignore storage error */ }
    }, [feedRequestedOrders]);

    // 状态筛选标签页
    type StatusFilter = 'all' | 'rfq' | 'pending_feed' | 'live' | 'settlement' | 'history';
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

                // 检查 MATCHED 状态订单是否已有链上 feed request（持久化状态）
                // 注意：由于 OptionsCore 可能重部署导致 orderId 重用，
                // 必须同时验证链上状态：只有当链上状态 >= WAITING_INITIAL_FEED(3) 时才认为 feed 已生效
                const allData = [...bData, ...sData];
                const matchedOrders = allData.filter(o => {
                    const s = typeof o.status === 'bigint' ? Number(o.status) : (typeof o.status === 'number' ? o.status : -1);
                    return s === 2; // MATCHED
                });

                // 对于仍在 MATCHED(2) 的订单，清理可能的 stale feedRequestedOrders 记录
                const staleIds = matchedOrders.map(o => Number(o.orderId));
                if (staleIds.length > 0) {
                    setFeedRequestedOrders(prev => {
                        const cleaned = new Set(prev);
                        staleIds.forEach(id => cleaned.delete(id));
                        return cleaned;
                    });
                }

                // 真正已进入 WAITING_INITIAL_FEED 或更高状态的订单才标记为"已发起"
                const advancedOrders = allData.filter(o => {
                    const s = typeof o.status === 'bigint' ? Number(o.status) : (typeof o.status === 'number' ? o.status : -1);
                    return s >= 3; // WAITING_INITIAL_FEED or beyond
                });
                if (advancedOrders.length > 0) {
                    const advIds = new Set(advancedOrders.map(o => Number(o.orderId)));
                    setFeedRequestedOrders(prev => {
                        const merged = new Set(prev);
                        advIds.forEach(id => merged.add(id));
                        return merged;
                    });
                }
            } catch (e) {
                console.error('Failed to fetch orders:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [isConnected, account, refreshKey, getBuyerOrders, getOrder, getSellerOrders, getOrderFeedRequests]);

    const allOrders = viewMode === 'buyer' ? buyerOrders : sellerOrders;

    // 订单状态过滤函数
    const filterOrdersByStatus = (orders: any[], filter: StatusFilter): any[] => {
        if (filter === 'all') return orders;

        return orders.filter(order => {
            const status = typeof order.status === 'number' ? order.status :
                typeof order.status === 'bigint' ? Number(order.status) : -1;

            switch (filter) {
                case 'rfq': // 询价订单: RFQ_CREATED, QUOTING
                    return status === ORDER_STATUS.RFQ_CREATED || status === ORDER_STATUS.QUOTING;
                case 'pending_feed': // 待喂价: MATCHED, WAITING_INITIAL_FEED
                    return status === ORDER_STATUS.MATCHED || status === ORDER_STATUS.WAITING_INITIAL_FEED;
                case 'live': // 持仓订单: LIVE, WAITING_FINAL_FEED
                    return status === ORDER_STATUS.LIVE || status === ORDER_STATUS.WAITING_FINAL_FEED;
                case 'settlement': // 结算/仲裁: PENDING_SETTLEMENT, ARBITRATION
                    return status === ORDER_STATUS.PENDING_SETTLEMENT || status === ORDER_STATUS.ARBITRATION;
                case 'history': // 历史订单: SETTLED, LIQUIDATED, CANCELLED
                    return status === ORDER_STATUS.SETTLED || status === ORDER_STATUS.LIQUIDATED || status === ORDER_STATUS.CANCELLED;
                default:
                    return true;
            }
        });
    };

    const activeOrders = filterOrdersByStatus(allOrders, statusFilter);

    const formatAmount = (val: any) => {
        // Handle both BigInt and Number types safely
        if (typeof val === 'bigint') {
            return formatUSDTAmount(val);
        } else if (typeof val === 'number') {
            const num = val;
            if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
            return `$${num.toLocaleString()}`;
        } else if (val && typeof val === 'string') {
            const num = parseFloat(val);
            if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
            return `$${num.toLocaleString()}`;
        }
        return '$0';
    };

    // Safe direction conversion: handles both string and number
    const getDirectionStr = (direction: any): string => {
        if (typeof direction === 'string') return direction;
        return Number(direction) === 0 ? 'Call' : 'Put';
    };

    // Countdown helper: returns "Xd YH" format - safely handles BigInt
    const getExpiryCountdown = (timestamp: any) => {
        const now = Math.floor(Date.now() / 1000);
        // Safe conversion from BigInt to Number
        const ts = typeof timestamp === 'bigint' ? Number(timestamp) : (typeof timestamp === 'number' ? timestamp : 0);
        const diff = ts - now;
        if (diff <= 0) return t('portfolio.expired');
        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        if (days > 0) return `${days}${t('portfolio.days')} ${hours}H`;
        return `${hours}H`;
    };



    /**
     * 计算真实结算盈亏
     * 看涨(Call): 盈亏 = (现价 - 行权价) * 名义本金 / 行权价
     * 看跌(Put): 盈亏 = (行权价 - 现价) * 名义本金 / 行权价
     * 买方盈利上限 = min(盈利, 卖方保证金)
     */
    const calculateSettlementPnL = (order: any): { pnl: number; buyerProfit: number; sellerProfit: number; status: 'profit' | 'loss' | 'neutral' } => {
        const notional = Number(formatUnits(BigInt(order.notionalUSDT || 0), 18));
        const strikePrice = Number(formatUnits(BigInt(order.strikePrice || 0), 18));
        const lastFeedPrice = Number(formatUnits(BigInt(order.lastFeedPrice || 0), 18));
        const currentMargin = Number(formatUnits(BigInt(order.currentMargin || 0), 18));
        const premium = Number(formatUnits(BigInt(order.premiumAmount || 0), 18));

        // 0 = Call, 1 = Put
        const direction = Number(order.direction || 0);

        if (strikePrice === 0 || lastFeedPrice === 0) {
            return { pnl: 0, buyerProfit: 0, sellerProfit: 0, status: 'neutral' };
        }

        let rawPnL = 0;
        if (direction === 0) { // Call
            rawPnL = ((lastFeedPrice - strikePrice) / strikePrice) * notional;
        } else { // Put
            rawPnL = ((strikePrice - lastFeedPrice) / strikePrice) * notional;
        }

        // 买方盈利上限为卖方保证金
        const buyerProfit = rawPnL > 0 ? Math.min(rawPnL, currentMargin) : 0;
        // 卖方盈利 = 期权费 - 赔付
        const sellerProfit = premium - buyerProfit;

        return {
            pnl: rawPnL,
            buyerProfit,
            sellerProfit,
            status: rawPnL > 0 ? 'profit' : rawPnL < 0 ? 'loss' : 'neutral'
        };
    };

    // P&L display based on real calculation
    const calculatePnL = (order: any) => {
        const settlement = calculateSettlementPnL(order);
        const pnl = viewMode === 'buyer' ? settlement.buyerProfit : settlement.sellerProfit;
        return pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    };

    const getPnLColor = (order: any) => {
        const settlement = calculateSettlementPnL(order);
        const pnl = viewMode === 'buyer' ? settlement.buyerProfit : settlement.sellerProfit;
        return pnl >= 0 ? 'text-emerald-500' : 'text-red-500';
    };

    // ORDER_STATUS imported from '../constants/orderStatus' — matches NSTTypes.sol:
    // PENDING_SETTLEMENT=6, ARBITRATION=7, SETTLED=8, LIQUIDATED=9, CANCELLED=10

    // Get status number from order (handles both number and string status)
    const getStatusNum = (order: any): number => {
        const status = order.status;
        if (typeof status === 'number') return status;
        if (typeof status === 'bigint') return Number(status);
        // Handle string status names — matches NSTTypes.sol enum order
        const statusMap: Record<string, number> = {
            'RFQ_CREATED': ORDER_STATUS.RFQ_CREATED,
            'QUOTING': ORDER_STATUS.QUOTING,
            'MATCHED': ORDER_STATUS.MATCHED,
            'WAITING_INITIAL_FEED': ORDER_STATUS.WAITING_INITIAL_FEED,
            'LIVE': ORDER_STATUS.LIVE,
            'WAITING_FINAL_FEED': ORDER_STATUS.WAITING_FINAL_FEED,
            'PENDING_SETTLEMENT': ORDER_STATUS.PENDING_SETTLEMENT,
            'SETTLED': ORDER_STATUS.SETTLED,
            'CANCELLED': ORDER_STATUS.CANCELLED,
            'LIQUIDATED': ORDER_STATUS.LIQUIDATED,
            'ARBITRATION': ORDER_STATUS.ARBITRATION,
        };
        return statusMap[String(status).toUpperCase()] ?? -1;
    };

    // Get human-readable status label
    const getStatusLabel = (order: any): string => {
        const num = getStatusNum(order);
        const labels: Record<number, string> = {
            0: t('portfolio.status.rfq_created'),
            1: t('portfolio.status.quoting'),
            2: t('portfolio.status.matched'),
            3: t('portfolio.status.waiting_initial_feed'),
            4: t('portfolio.status.live'),
            5: t('portfolio.status.waiting_final_feed'),
            6: t('portfolio.status.pending_settlement'),
            7: t('portfolio.status.arbitration'),
            8: t('portfolio.status.settled'),
            9: t('portfolio.status.liquidated'),
            10: t('portfolio.status.cancelled')
        };
        return labels[num] || String(order.status).toUpperCase();
    };

    // ==================== T+X 行权条件检查 ====================

    /**
     * 计算 T+X 可行权时间
     * @param order 订单对象
     * @returns 可行权的时间戳（秒）
     */
    const getExerciseEnabledTime = (order: any): number => {
        const matchedAt = Number(order.matchedAt || 0);
        const exerciseDelay = Number(order.exerciseDelay || 0); // T+X 天数
        const DAY_SECONDS = 24 * 60 * 60;
        return matchedAt + (exerciseDelay * DAY_SECONDS);
    };

    /**
     * 检查 T+X 条件是否满足
     * @param order 订单对象
     * @returns true 如果可以行权
     */
    const isExerciseDelayMet = (order: any): boolean => {
        if (!order.matchedAt || Number(order.matchedAt) === 0) {
            return false; // 未成交的订单不能行权
        }
        const now = Math.floor(Date.now() / 1000);
        return now >= getExerciseEnabledTime(order);
    };

    /**
     * 获取 T+X 倒计时字符串
     * @param order 订单对象
     * @returns 倒计时字符串 或 "可行权"
     */
    const getTplusXCountdown = (order: any): string => {
        const exerciseEnabledTime = getExerciseEnabledTime(order);
        const now = Math.floor(Date.now() / 1000);

        if (now >= exerciseEnabledTime) {
            return t('portfolio.exercise_ready') || '可行权';
        }

        const remaining = exerciseEnabledTime - now;
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);

        if (days > 0) {
            return `T+${order.exerciseDelay || 0}: ${days}${t('common.days') || '天'} ${hours}${t('common.hours') || '时'}`;
        }
        return `T+${order.exerciseDelay || 0}: ${hours}${t('common.hours') || '时'} ${minutes}${t('common.minutes') || '分'}`;
    };

    // Check if action is available based on order status AND T+X condition
    const canExercise = (order: any) => {
        const isLive = getStatusNum(order) === ORDER_STATUS.LIVE;
        const tPlusXMet = isExerciseDelayMet(order);
        return isLive && tPlusXMet;
    };
    const canSettle = (order: any) => {
        const isPendingSettlement = getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT;
        const hasFeedPrice = Number(order.lastFeedPrice || 0) > 0;
        return isPendingSettlement && hasFeedPrice;
    };
    const canArbitrate = (order: any) => getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT;
    const canAddMargin = (order: any) => getStatusNum(order) === ORDER_STATUS.LIVE;
    const canWithdraw = (order: any) => getStatusNum(order) === ORDER_STATUS.LIVE;
    const canInitiateFeed = (order: any) => getStatusNum(order) === ORDER_STATUS.MATCHED;

    // ==================== 保证金健康度计算 ====================

    /**
     * 计算保证金健康度百分比
     * 健康度 = currentMargin / requiredMargin * 100
     * requiredMargin = notionalUSDT * minMarginRate / 10000
     * 
     * 注意：订单数据可能来自两种格式：
     * 1. 原始 bigint (合约直接返回)
     * 2. 已转换的 number (通过 transformers.ts 转换，使用18位小数)
     */
    const getMarginHealthPercent = (order: any): number => {
        // 获取名义金额
        let notional: number;
        if (typeof order.notionalUSDT === 'bigint') {
            notional = Number(formatUnits(order.notionalUSDT, 18));
        } else {
            notional = Number(order.notionalUSDT || 0);
        }

        // 获取当前保证金
        let currentMargin: number;
        if (typeof order.currentMargin === 'bigint') {
            currentMargin = Number(formatUnits(order.currentMargin, 18));
        } else {
            currentMargin = Number(order.currentMargin || 0);
        }

        // 获取最低保证金率 (basis points, 1000 = 10%)
        // 如果已经是百分比格式（<100），则认为是已转换的
        let minMarginRate = Number(order.minMarginRate || 1000);
        if (minMarginRate < 100) {
            // 已经是百分比格式 (e.g., 10 = 10%)
            minMarginRate = minMarginRate * 100; // 转为 basis points
        }

        if (notional === 0 || minMarginRate === 0) return 100;

        // requiredMargin = notional * rate / 10000
        const requiredMargin = notional * minMarginRate / 10000;
        if (requiredMargin === 0) return 100;

        return Math.min(200, (currentMargin / requiredMargin) * 100);
    };

    /**
     * 获取保证金健康状态：healthy (>120%), warning (80-120%), danger (<80%)
     */
    const getMarginHealthStatus = (order: any): 'healthy' | 'warning' | 'danger' => {
        const health = getMarginHealthPercent(order);
        if (health >= 120) return 'healthy';
        if (health >= 80) return 'warning';
        return 'danger';
    };

    /**
     * 获取追保倒计时字符串
     */
    const getMarginCallCountdown = (order: any): string | null => {
        const deadline = Number(order.marginCallDeadline || 0);
        if (deadline === 0) return null;

        const now = Math.floor(Date.now() / 1000);
        const remaining = deadline - now;

        if (remaining <= 0) return '已逾期';

        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);

        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };



    // ==================== 倒计时显示函数 ====================

    /**
     * 获取仲裁窗口倒计时
     * @param order 订单对象
     * @returns 倒计时字符串 或 null（窗口已过期或不适用）
     */
    const getArbitrationCountdown = (order: any): string | null => {
        if (getStatusNum(order) !== ORDER_STATUS.PENDING_SETTLEMENT) {
            return null;
        }

        const settledAt = Number(order.settledAt || 0);
        const arbitrationWindow = Number(order.arbitrationWindow || 24 * 3600); // 默认24小时

        if (settledAt === 0) return null;

        const deadline = settledAt + arbitrationWindow;
        const now = Math.floor(Date.now() / 1000);

        if (now >= deadline) {
            return '已过期';
        }

        const remaining = deadline - now;
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);

        return `${hours}h ${minutes}m`;
    };

    /**
     * 获取初始喂价倒计时 (10分钟时限)
     * @param order 订单对象
     * @returns 倒计时字符串 或 null（不适用）
     */
    const getInitialFeedCountdown = (order: any): string | null => {
        if (getStatusNum(order) !== ORDER_STATUS.MATCHED) {
            return null;
        }

        const matchedAt = Number(order.matchedAt || 0);
        const FEED_DEADLINE = 10 * 60; // 10分钟

        if (matchedAt === 0) return null;

        const deadline = matchedAt + FEED_DEADLINE;
        const now = Math.floor(Date.now() / 1000);

        if (now >= deadline) {
            return '已超时';
        }

        const remaining = deadline - now;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    /**
     * 获取平仓喂价倒计时 (10分钟时限) - 卖方专用
     * @param order 订单对象
     * @returns 倒计时字符串 或 null（不适用）
     */
    const getFinalFeedCountdown = (order: any): string | null => {
        if (getStatusNum(order) !== ORDER_STATUS.WAITING_FINAL_FEED) {
            return null;
        }

        // 使用链上真实字段 finalFeedRequestedAt 作为起始时间
        const requestedAt = Number(order.finalFeedRequestedAt || 0);
        const FEED_DEADLINE = 10 * 60; // 10分钟

        if (requestedAt === 0) return null;

        const deadline = requestedAt + FEED_DEADLINE;
        const now = Math.floor(Date.now() / 1000);

        if (now >= deadline) {
            return '已超时';
        }

        const remaining = deadline - now;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    /**
     * 打开喂价档位选择弹窗
     * 先从合约读取各档费用，然后显示弹窗让用户选择
     */
    /**
     * 根据 order.feedRule 路由到正确的喂价入口
     * feedRule=0 (NormalFeed) → FeedProtocol 档位弹窗
     * feedRule=1 (VolumeBasedFeed) → 跟量成交弹窗（输入建议价格）
     */
    const handleInitiateFeed = async (orderId: number) => {
        // 查找订单的 feedRule
        const order = [...buyerOrders, ...sellerOrders].find(o => Number(o.orderId) === orderId);
        const feedRule = order ? Number(order.feedRule || 0) : 0;

        if (feedRule === 1) {
            // 跟量成交：仅卖方可以提交建议价格
            // 合约层已校验 msg.sender === order.seller，前端提前拦截避免无效交易
            if (!order || !account || order.seller.toLowerCase() !== account.toLowerCase()) {
                showToast('error', t('errors.vbf_seller_only', '只有卖方可以提交跟量成交建议价格'));
                return;
            }
            // 跟量成交：打开建议价格输入弹窗
            setVbfOrderId(orderId);
            setVbfFeedType(FEED_TYPE.INITIAL); // 期初喂价
            setVbfIsInitial(true);
            setVbfPrice('');
            setVbfEvidence('');
            setVbfModalOpen(true);

            return;
        }

        // 正常喂价：打开档位选择弹窗
        setTierModalOrderId(orderId);
        setTierModalOpen(true);

        // 异步加载各档位费用
        try {
            if (provider) {
                const addresses = getContractAddresses(chainId || 97);
                const feedProtocol = new Contract(
                    addresses.FeedProtocol,
                    ['function getFeedFee(uint8 tier) view returns (uint256)'],
                    await provider.getSigner()
                );
                const fees = await Promise.all([
                    feedProtocol.getFeedFee(FEED_TIER.TIER_5_3),
                    feedProtocol.getFeedFee(FEED_TIER.TIER_7_5),
                    feedProtocol.getFeedFee(FEED_TIER.TIER_10_7),
                ]);
                setFeedFees(fees.map(f => Number(formatUnits(f, 18)).toFixed(2)));
            }
        } catch (err) {
            console.warn('Failed to fetch feed fees:', err);
        }
    };

    /**
     * 用户在弹窗中选择档位后确认发起喂价
     */
    const handleConfirmFeed = async (tier: number) => {
        if (tierModalOrderId === null) return;
        const orderId = tierModalOrderId;
        setInitFeedLoading(orderId);
        try {
            await requestFeed(orderId, FEED_TYPE.INITIAL, tier);
            showToast('success', t('portfolio.feed_requested') + ' — 等待喂价员提交价格');
            setFeedRequestedOrders(prev => new Set(prev).add(orderId));
            setRefreshKey(k => k + 1);
            setTierModalOpen(false);
            setTierModalOrderId(null);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Request feed failed';
            showToast('error', `${t('portfolio.initiate_feed')} 失败: ${message}`);
        } finally {
            setInitFeedLoading(null);
        }
    };

    // Handle action with user-friendly error
    const handleAction = async (action: () => Promise<any>, actionName: string) => {
        try {
            await action();
            showToast('success', `${actionName} 成功`);
            setRefreshKey(k => k + 1); // Refresh orders after action
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `${actionName} 失败: ${message}`);
        }
    };

    // Handle exercise with automatic final feed request
    const handleExerciseWithFeed = async (orderId: number | bigint) => {
        const orderIdNum = Number(orderId);
        const order = [...buyerOrders, ...sellerOrders].find(o => Number(o.orderId) === orderIdNum);
        const feedRule = order ? Number(order.feedRule || 0) : 0;

        try {
            // Step 1: Call earlyExercise
            showToast('info', t('portfolio.exercising') || '正在执行行权...');
            await earlyExercise(orderIdNum);
            showToast('success', t('portfolio.exercise_success') || '行权成功');

            if (feedRule === 1) {
                // 跟量成交：打开建议价格输入弹窗 (期末喂价)
                setVbfOrderId(orderIdNum);
                setVbfFeedType(2); // Final
                setVbfIsInitial(false);
                setVbfPrice('');
                setVbfEvidence('');
                setVbfModalOpen(true);
            } else {
                // 正常喂价：自动发起期末喂价
                showToast('info', t('portfolio.requesting_final_feed') || '正在请求期末喂价...');
                await requestFeed(orderIdNum, 2, 0);
                showToast('success', t('portfolio.final_feed_requested') || '期末喂价请求已发起');
            }

            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `Exercise 失败: ${message}`);
        }
    };

    // 打开保证金弹窗
    const openMarginModal = (orderId: number, type: 'add' | 'withdraw') => {
        setSelectedOrderId(orderId);
        setMarginModalType(type);
        setMarginAmount('');
        setMarginModalOpen(true);
    };

    // 提交保证金操作
    const handleMarginSubmit = async () => {
        if (!selectedOrderId || !marginAmount || parseFloat(marginAmount) <= 0) {
            showToast('error', '请输入有效金额');
            return;
        }
        try {
            if (marginModalType === 'add') {
                await addMargin(selectedOrderId, marginAmount);
                showToast('success', `成功追加 ${marginAmount} USDT 保证金`);
            } else {
                await withdrawExcessMargin(selectedOrderId, marginAmount);
                showToast('success', `成功提取 ${marginAmount} USDT`);
            }
            setMarginModalOpen(false);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `${marginModalType === 'add' ? '追加' : '提取'}保证金失败: ${message}`);
        }
    };

    // 打开仲裁弹窗
    const openArbitrationModal = (orderId: number) => {
        setArbitrationOrderId(orderId);
        setArbitrationModalOpen(true);
    };

    // 确认仲裁
    const handleArbitrationConfirm = async () => {
        if (!arbitrationOrderId) return;
        try {
            await initiateArbitration(arbitrationOrderId);
            showToast('success', '仲裁已发起，等待高级喂价员重新喂价');
            setArbitrationModalOpen(false);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `发起仲裁失败: ${message}`);
        }
    };

    // 发起动态保证金喂价
    const handleDynamicFeed = async (orderId: number) => {
        const order = [...buyerOrders, ...sellerOrders].find(o => Number(o.orderId) === orderId);
        const feedRule = order ? Number(order.feedRule || 0) : 0;

        if (feedRule === 1) {
            // 跟量成交：打开建议价格输入弹窗 (动态喂价)
            setVbfOrderId(orderId);
            setVbfFeedType(1); // Dynamic
            setVbfIsInitial(false);
            setVbfPrice('');
            setVbfEvidence('');
            setVbfModalOpen(true);
            return;
        }

        setDynamicFeedLoading(orderId);
        try {
            // feedType=1 (Dynamic), tier=0
            await requestFeed(orderId, 1, 0);
            showToast('success', '动态喂价请求已发起');
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `动态喂价失败: ${message}`);
        } finally {
            setDynamicFeedLoading(null);
        }
    };

    /**
     * 跟量成交弹窗确认 — 提交建议价格到 VolumeBasedFeed 合约
     */
    const handleVbfSubmit = async () => {
        if (!vbfOrderId || !vbfPrice || parseFloat(vbfPrice) <= 0) {
            showToast('error', '请输入有效建议价格');
            return;
        }
        if (!vbfEvidence.trim()) {
            showToast('error', '请填写价格依据说明');
            return;
        }
        try {
            await submitSuggestedPrice(
                vbfOrderId,
                vbfPrice,
                vbfEvidence,
                vbfFeedType,
                vbfIsInitial
            );
            showToast('success', '跟量成交建议价格已提交，等待喂价员验证');
            setVbfModalOpen(false);
            setFeedRequestedOrders(prev => new Set(prev).add(vbfOrderId));
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            const message = err?.reason || err?.message || 'Operation failed';
            showToast('error', `提交建议价格失败: ${message}`);
        }
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {(() => {
                    // Helper to safely sum values that may be BigInt or Number
                    const safeSum = (orders: any[], field: string): number => {
                        return orders.reduce((acc, o) => {
                            const val = o[field];
                            if (typeof val === 'bigint') {
                                return acc + usdtToNumber(val);
                            } else if (typeof val === 'number') {
                                return acc + val;
                            }
                            return acc;
                        }, 0);
                    };

                    const stats = [
                        {
                            label: t('portfolio.active_exposure'),
                            value: `$${safeSum(activeOrders, 'notionalUSDT').toLocaleString()}`,
                            icon: '⚡'
                        },
                        {
                            label: t('portfolio.pending_orders'),
                            value: String(activeOrders.filter(o => o.status === 'Pending' || o.status === 0).length),
                            icon: '⏳',
                            color: 'text-amber-500'
                        },
                        {
                            label: t('portfolio.total_margin'),
                            value: `$${safeSum(activeOrders, 'marginAmount').toLocaleString()}`,
                            icon: '🔒',
                            color: 'text-blue-400'
                        },
                        {
                            label: t('portfolio.pnl_estimate'),
                            value: '+$4.2K',
                            icon: viewMode === 'buyer' ? '📈' : '💎',
                            color: 'text-emerald-500'
                        }
                    ];

                    return stats.map((stat, i) => (
                        <div key={i} className="obsidian-glass grid-bg p-8 flex flex-col group hover:border-white/20">
                            <div className="flex justify-between items-center mb-6">
                                <span className="section-label">{stat.label}</span>
                                <span className="text-xl">{stat.icon}</span>
                            </div>
                            <span className={`text-4xl font-black italic tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</span>
                        </div>
                    ));
                })()}
            </div>

            {/* Matrix Display */}
            <div className="flex flex-col space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">{t('portfolio.strategy_grid')}</h3>
                    <button onClick={() => setRefreshKey(k => k + 1)} className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all">{t('portfolio.reload_stream')}</button>
                </div>

                {/* 状态筛选标签页 */}
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'all' as StatusFilter, label: '全部', count: allOrders.length },
                        { key: 'rfq' as StatusFilter, label: '询价', count: filterOrdersByStatus(allOrders, 'rfq').length },
                        { key: 'pending_feed' as StatusFilter, label: '待喂价', count: filterOrdersByStatus(allOrders, 'pending_feed').length },
                        { key: 'live' as StatusFilter, label: '持仓', count: filterOrdersByStatus(allOrders, 'live').length },
                        { key: 'settlement' as StatusFilter, label: '结算/仲裁', count: filterOrdersByStatus(allOrders, 'settlement').length },
                        { key: 'history' as StatusFilter, label: '历史', count: filterOrdersByStatus(allOrders, 'history').length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${statusFilter === tab.key
                                ? 'bg-white/10 text-white border border-white/20'
                                : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/60'
                                }`}
                        >
                            {tab.label} {tab.count > 0 && <span className="ml-1 opacity-50">({tab.count})</span>}
                        </button>
                    ))}
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
                                        {Number(order.feedRule) === 1 && (
                                            <span className="px-3 py-1 rounded-full text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-[0.15em] italic">跟量成交</span>
                                        )}
                                        <span className="text-[10px] font-mono font-bold text-white/20">ORD_REF_{order.orderId}</span>
                                    </div>
                                    <div className="flex items-end gap-6">
                                        <h4 className="text-3xl font-black text-white italic tracking-tighter">{order.underlyingName}</h4>
                                        <span className={`text-xl font-black italic ${getDirectionStr(order.direction) === 'Call' ? 'text-emerald-500' : 'text-red-500'}`}>{getDirectionStr(order.direction).toUpperCase()}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pt-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.notional')}</span>
                                            <span className="text-sm font-black text-white italic tracking-tight">{formatAmount(order.notionalUSDT)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.strike')}</span>
                                            <span className="text-sm font-black text-white/60 italic tracking-tight">${order.refPrice}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.pnl')}</span>
                                            <span className={`text-sm font-black italic tracking-tight ${getPnLColor(order)}`}>{calculatePnL(order)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.feed_price') || '喂价'}</span>
                                            <span className="text-sm font-black text-cyan-400 italic tracking-tight">
                                                {order.lastFeedPrice && Number(order.lastFeedPrice) > 0
                                                    ? `$${Number(formatUnits(order.lastFeedPrice, 18)).toLocaleString()}`
                                                    : '--'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="section-label">{t('portfolio.expires_in')}</span>
                                            <span className="text-sm font-black text-amber-400 italic tracking-tight">{getExpiryCountdown(order.expiryTimestamp || 0)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap lg:flex-nowrap gap-4 relative z-10 items-center">
                                    {/* Status Badge */}
                                    <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${getStatusNum(order) === ORDER_STATUS.LIVE ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                        getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            getStatusNum(order) === ORDER_STATUS.MATCHED ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                getStatusNum(order) === ORDER_STATUS.ARBITRATION ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                    getStatusNum(order) === ORDER_STATUS.LIQUIDATED ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                        getStatusNum(order) === ORDER_STATUS.SETTLED ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                            'bg-white/10 text-white/60 border border-white/10'
                                        }`}>
                                        {getStatusNum(order) === ORDER_STATUS.ARBITRATION && '⚖️ '}
                                        {getStatusNum(order) === ORDER_STATUS.LIQUIDATED && '💀 '}
                                        {getStatusNum(order) === ORDER_STATUS.SETTLED && '✓ '}
                                        {getStatusLabel(order)}
                                    </span>

                                    {/* 结算详情 - SETTLED/PENDING_SETTLEMENT状态 */}
                                    {(getStatusNum(order) === ORDER_STATUS.SETTLED || getStatusNum(order) === ORDER_STATUS.PENDING_SETTLEMENT) && (
                                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                                            <span className="text-[9px] font-black text-white/40 uppercase">
                                                {viewMode === 'buyer' ? '买方盈亏' : '卖方盈亏'}:
                                            </span>
                                            <span className={`text-[10px] font-black ${getPnLColor(order)}`}>
                                                {calculatePnL(order)}
                                            </span>
                                        </div>
                                    )}

                                    {/* 强平原因提示 - LIQUIDATED状态 */}
                                    {getStatusNum(order) === ORDER_STATUS.LIQUIDATED && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30">
                                            <span className="text-[9px] font-black text-red-400 uppercase">
                                                保证金不足强平
                                            </span>
                                        </div>
                                    )}

                                    {/* 仲裁中提示 - ARBITRATION状态 */}
                                    {getStatusNum(order) === ORDER_STATUS.ARBITRATION && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 animate-pulse">
                                            <span className="text-[9px] font-black text-purple-400 uppercase">
                                                等待高级喂价员重新喂价
                                            </span>
                                        </div>
                                    )}

                                    {/* 仲裁窗口倒计时 - PENDING_SETTLEMENT状态 */}
                                    {getArbitrationCountdown(order) && (
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${getArbitrationCountdown(order) === '已过期'
                                            ? 'bg-red-500/10 border border-red-500/30'
                                            : 'bg-amber-500/10 border border-amber-500/30'
                                            }`}>
                                            <span className="text-amber-400">⏱️</span>
                                            <span className={`text-[9px] font-black uppercase ${getArbitrationCountdown(order) === '已过期' ? 'text-red-400' : 'text-amber-400'
                                                }`}>
                                                仲裁窗口 {getArbitrationCountdown(order)}
                                            </span>
                                        </div>
                                    )}

                                    {/* 初始喂价倒计时 - MATCHED状态 (10分钟时限) */}
                                    {getInitialFeedCountdown(order) && (
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${getInitialFeedCountdown(order) === '已超时'
                                            ? 'bg-red-500/10 border border-red-500/30 animate-pulse'
                                            : 'bg-cyan-500/10 border border-cyan-500/30'
                                            }`}>
                                            <span className="text-cyan-400">📡</span>
                                            <span className={`text-[9px] font-black uppercase ${getInitialFeedCountdown(order) === '已超时' ? 'text-red-400' : 'text-cyan-400'
                                                }`}>
                                                喂价时限 {getInitialFeedCountdown(order)}
                                            </span>
                                        </div>
                                    )}

                                    {/* 平仓喂价倒计时 - WAITING_FINAL_FEED状态 (卖方10分钟时限) */}
                                    {getFinalFeedCountdown(order) && (
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${getFinalFeedCountdown(order) === '已超时'
                                            ? 'bg-red-500/10 border border-red-500/30 animate-pulse'
                                            : 'bg-orange-500/10 border border-orange-500/30'
                                            }`}>
                                            <span className="text-orange-400">🔔</span>
                                            <span className={`text-[9px] font-black uppercase ${getFinalFeedCountdown(order) === '已超时' ? 'text-red-400' : 'text-orange-400'
                                                }`}>
                                                平仓喂价 {getFinalFeedCountdown(order)}
                                            </span>
                                        </div>
                                    )}
                                    {/* 卖方保证金健康度指示器 */}
                                    {viewMode === 'seller' && getStatusNum(order) === ORDER_STATUS.LIVE && (
                                        <div className="flex items-center gap-3">
                                            {/* 健康度条 */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-white/40 uppercase tracking-wider">保证金</span>
                                                <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${getMarginHealthStatus(order) === 'healthy' ? 'bg-emerald-500' :
                                                            getMarginHealthStatus(order) === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${Math.min(100, getMarginHealthPercent(order))}%` }}
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-black ${getMarginHealthStatus(order) === 'healthy' ? 'text-emerald-400' :
                                                    getMarginHealthStatus(order) === 'warning' ? 'text-amber-400' : 'text-red-400'
                                                    }`}>
                                                    {getMarginHealthPercent(order).toFixed(0)}%
                                                </span>
                                            </div>

                                            {/* 追保倒计时警告 */}
                                            {getMarginCallCountdown(order) && (
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 animate-pulse">
                                                    <span className="text-red-500">⚠️</span>
                                                    <span className="text-[9px] font-black text-red-400 uppercase">
                                                        追保 {getMarginCallCountdown(order)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Initiate Feed button for MATCHED orders */}
                                    {canInitiateFeed(order) && (
                                        feedRequestedOrders.has(Number(order.orderId)) ? (
                                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                                                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                                                <span className="text-[11px] font-bold text-cyan-400 tracking-wider">
                                                    ⏳ 喂价请求已发起，等待喂价员提交价格...
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleInitiateFeed(Number(order.orderId))}
                                                disabled={initFeedLoading === Number(order.orderId) || feedLoading}
                                                className="btn-gold min-w-[160px] h-12 text-[11px] tracking-widest"
                                            >
                                                {initFeedLoading === Number(order.orderId) ? t('portfolio.requesting') : t('portfolio.initiate_feed')}
                                            </button>
                                        )
                                    )}

                                    {viewMode === 'buyer' ? (
                                        <>
                                            <button
                                                onClick={() => handleExerciseWithFeed(order.orderId)}
                                                disabled={!canExercise(order) || feedLoading}
                                                title={!canExercise(order)
                                                    ? (getStatusNum(order) === ORDER_STATUS.LIVE
                                                        ? `${getTplusXCountdown(order)}`
                                                        : t('portfolio.hint.need_live_status'))
                                                    : t('portfolio.hint.exercise_enabled') || '可提前行权'}
                                                className={`min-w-[100px] h-11 px-4 rounded-xl font-bold text-sm transition-all ${!canExercise(order) || feedLoading
                                                    ? 'bg-gray-700/30 text-gray-500 border border-gray-600/30 cursor-not-allowed'
                                                    : 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/60 hover:bg-emerald-500/30 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20'
                                                    }`}
                                            >
                                                {getStatusNum(order) === ORDER_STATUS.LIVE && !isExerciseDelayMet(order)
                                                    ? `⏳ ${getTplusXCountdown(order)}`
                                                    : '行权'}
                                            </button>
                                            <button
                                                onClick={() => handleAction(() => settleOrder(order.orderId), 'Settle')}
                                                disabled={!canSettle(order)}
                                                title={!canSettle(order) ? t('portfolio.hint.need_pending_settlement') : ''}
                                                className={`min-w-[100px] h-11 px-4 rounded-xl font-bold text-sm transition-all ${!canSettle(order)
                                                    ? 'bg-gray-700/30 text-gray-500 border border-gray-600/30 cursor-not-allowed'
                                                    : 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/60 hover:bg-blue-500/30 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20'
                                                    }`}
                                            >
                                                结算
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => openMarginModal(order.orderId, 'add')}
                                                disabled={!canAddMargin(order)}
                                                title={!canAddMargin(order) ? t('portfolio.hint.need_live_status') : ''}
                                                className={`btn-seller min-w-[140px] ${!canAddMargin(order) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                追加保证金
                                            </button>
                                            <button
                                                onClick={() => openMarginModal(order.orderId, 'withdraw')}
                                                disabled={!canWithdraw(order)}
                                                title={!canWithdraw(order) ? t('portfolio.hint.need_live_status') : ''}
                                                className={`btn-elite-secondary min-w-[140px] h-12 ${!canWithdraw(order) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                提取
                                            </button>
                                            <button
                                                onClick={() => handleDynamicFeed(order.orderId)}
                                                disabled={!canAddMargin(order) || dynamicFeedLoading === order.orderId}
                                                title={!canAddMargin(order) ? t('portfolio.hint.need_live_status') : ''}
                                                className={`btn-elite-secondary min-w-[140px] h-12 ${!canAddMargin(order) ? 'opacity-30 cursor-not-allowed' : 'border-cyan-500/30 text-cyan-400 hover:border-cyan-500/50'}`}
                                            >
                                                {dynamicFeedLoading === order.orderId ? '...' : '⚡ 动态喂价'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => openArbitrationModal(order.orderId)}
                                        disabled={!canArbitrate(order)}
                                        title={!canArbitrate(order) ? t('portfolio.hint.need_pending_settlement') : ''}
                                        className={`min-w-[100px] h-11 px-4 rounded-xl font-bold text-sm transition-all ${!canArbitrate(order)
                                            ? 'bg-gray-700/30 text-gray-500 border border-gray-600/30 cursor-not-allowed'
                                            : 'bg-red-500/20 text-red-400 border-2 border-red-500/60 hover:bg-red-500/30 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20'
                                            }`}
                                    >
                                        仲裁
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 保证金操作弹窗 */}
            {marginModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="obsidian-glass p-8 rounded-3xl border border-white/10 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-white mb-6">
                            {marginModalType === 'add' ? '追加保证金' : '提取保证金'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">金额 (USDT)</label>
                                <input
                                    type="number"
                                    value={marginAmount}
                                    onChange={(e) => setMarginAmount(e.target.value)}
                                    placeholder="输入金额..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setMarginModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleMarginSubmit}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${marginModalType === 'add' ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-gold-500 hover:bg-gold-600 text-black'}`}
                                >
                                    确认{marginModalType === 'add' ? '追加' : '提取'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 仲裁确认弹窗 */}
            {arbitrationModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="obsidian-glass p-8 rounded-3xl border border-red-500/20 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-2xl">⚠️</span>
                            <h3 className="text-xl font-black text-white">发起仲裁</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <p className="text-red-400 font-bold mb-2">您将支付 30 USDT 仲裁费用</p>
                                <p className="text-gray-400 text-sm">
                                    仲裁将指定高级喂价员重新喂价，结果一次定论，不可再次仲裁。
                                </p>
                            </div>

                            <div className="text-sm text-gray-500">
                                <p>• 仲裁费用不退还</p>
                                <p>• 如仲裁成功改变结果，您将获得 50% 仲裁费奖励</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setArbitrationModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleArbitrationConfirm}
                                    className="flex-1 py-3 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition-all"
                                >
                                    确认仲裁 (30U)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 喂价档位选择弹窗 */}
            <FeedTierModal
                isOpen={tierModalOpen}
                onClose={() => { setTierModalOpen(false); setTierModalOrderId(null); }}
                onConfirm={handleConfirmFeed}
                loading={initFeedLoading !== null}
                feedFees={feedFees}
            />

            {/* 跟量成交喂价弹窗 */}
            {vbfModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="obsidian-glass w-full max-w-lg p-8 rounded-[32px] border border-purple-500/20 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-purple-500 text-2xl">📊</span>
                                <div>
                                    <h3 className="text-lg font-black text-white italic">跟量成交喂价</h3>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        {vbfFeedType === 0 ? '期初喂价 (Initial)' : vbfFeedType === 1 ? '动态喂价 (Dynamic)' : '期末喂价 (Final)'}
                                        {' · '}订单 #{vbfOrderId}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setVbfModalOpen(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">建议成交价格 (USD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={vbfPrice}
                                    onChange={e => setVbfPrice(e.target.value)}
                                    placeholder="例: 2100.50"
                                    className="obsidian-input w-full h-14 text-xl font-black italic text-purple-400 px-6"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">价格依据说明</label>
                                <textarea
                                    value={vbfEvidence}
                                    onChange={e => setVbfEvidence(e.target.value)}
                                    placeholder="例: 上海黄金交易所实时成交价 / Bloomberg 终端报价"
                                    rows={3}
                                    className="obsidian-input w-full text-sm font-bold px-6 py-4 resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                            <p className="text-[10px] font-bold text-purple-400/70">
                                ⚡ 提交后将由喂价员验证您的建议价格。验证通过后价格将自动写入订单。
                                {vbfIsInitial && ' 如果被拒绝，订单将被取消。'}
                            </p>
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button onClick={() => setVbfModalOpen(false)} className="flex-1 h-12 rounded-2xl border border-white/10 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">取消</button>
                            <button
                                onClick={handleVbfSubmit}
                                disabled={vbfLoading || !vbfPrice || !vbfEvidence.trim()}
                                className="flex-1 h-12 rounded-2xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                            >
                                {vbfLoading ? '提交中...' : '提交建议价格'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyOrders;
