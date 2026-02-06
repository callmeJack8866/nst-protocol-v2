// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/NSTTypes.sol";
import "../interfaces/IOptionsCore.sol";
import "../vault/VaultManager.sol";
import "./Config.sol";

/**
 * @title OptionsCore
 * @notice 期权核心合约 - 订单创建、匹配、结算
 * @dev 继承 IOptionsCore 接口，实现所有核心功能
 */
contract OptionsCore is IOptionsCore, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant FEED_PROTOCOL_ROLE = keccak256("FEED_PROTOCOL_ROLE");

    // ==================== 状态变量 ====================
    Config public config;
    VaultManager public vaultManager;
    IERC20 public usdt;

    uint256 public nextOrderId = 1;
    uint256 public nextQuoteId = 1;

    // 订单存储
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Quote[]) public orderQuotes;
    mapping(uint256 => Quote) public quotes;

    // 用户订单索引
    mapping(address => uint256[]) public buyerOrders;
    mapping(address => uint256[]) public sellerOrders;

    // 订单检索索引
    mapping(string => uint256[]) private ordersByCountry;
    mapping(string => uint256[]) private ordersByMarket;
    mapping(string => uint256[]) private ordersByCode;

    // ==================== 构造函数 ====================
    constructor(
        address _config,
        address _vaultManager,
        address _usdt,
        address _admin
    ) {
        config = Config(_config);
        vaultManager = VaultManager(_vaultManager);
        usdt = IERC20(_usdt);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    // ==================== 修改器 ====================
    modifier validOrder(uint256 orderId) {
        require(orderId > 0 && orderId < nextOrderId, "OptionsCore: invalid order id");
        _;
    }

    modifier onlyBuyer(uint256 orderId) {
        require(msg.sender == orders[orderId].buyer, "OptionsCore: not buyer");
        _;
    }

    modifier onlySeller(uint256 orderId) {
        require(msg.sender == orders[orderId].seller, "OptionsCore: not seller");
        _;
    }

    modifier inStatus(uint256 orderId, OrderStatus expectedStatus) {
        require(orders[orderId].status == expectedStatus, "OptionsCore: invalid order status");
        _;
    }

    // ==================== 买方功能实现 ====================

    /**
     * @notice 买方创建询价订单
     * @param liquidationRule 平仓规则（无强平/连板强平/涨幅强平）
     * @param consecutiveDays 连续天数（用于连板/涨幅强平规则）
     * @param dailyLimitPercent 单日涨幅阈值百分比（用于涨幅强平规则）
     * @param feedRule 喂价规则（正常喂价/跟量成交喂价）
     */
    function createBuyerRFQ(
        string calldata underlyingName,
        string calldata underlyingCode,
        string calldata market,
        string calldata country,
        string calldata refPrice,
        Direction direction,
        uint256 notionalUSDT,
        uint256 expiryTimestamp,
        uint256 maxPremiumRate,
        uint256 minMarginRate,
        SellerType acceptedSellerType,
        address designatedSeller,
        uint256 arbitrationWindow,
        uint256 marginCallDeadline,
        bool dividendAdjustment,
        LiquidationRule liquidationRule,
        uint8 consecutiveDays,
        uint8 dailyLimitPercent,
        FeedRule feedRule
    ) external override nonReentrant whenNotPaused returns (uint256 orderId) {
        require(notionalUSDT > 0, "OptionsCore: notional must be positive");
        require(expiryTimestamp > block.timestamp, "OptionsCore: expiry must be in future");
        require(minMarginRate >= config.minMarginRate(), "OptionsCore: margin rate too low");

        // 收取建仓手续费 1U
        usdt.safeTransferFrom(msg.sender, address(vaultManager), config.creationFee());
        
        orderId = nextOrderId++;

        Order storage order = orders[orderId];
        order.orderId = orderId;
        order.buyer = msg.sender;
        order.underlyingName = underlyingName;
        order.underlyingCode = underlyingCode;
        order.market = market;
        order.country = country;
        order.refPrice = refPrice;
        order.direction = direction;
        order.notionalUSDT = notionalUSDT;
        order.expiryTimestamp = expiryTimestamp;
        order.premiumRate = maxPremiumRate;
        order.minMarginRate = minMarginRate;
        order.sellerType = acceptedSellerType;
        order.designatedSeller = designatedSeller;
        order.arbitrationWindow = arbitrationWindow;
        order.marginCallDeadline = marginCallDeadline;
        order.dividendAdjustment = dividendAdjustment;
        // 新增：平仓规则和喂价规则
        order.liquidationRule = liquidationRule;
        order.consecutiveDays = consecutiveDays;
        order.dailyLimitPercent = dailyLimitPercent;
        order.feedRule = feedRule;
        order.status = OrderStatus.RFQ_CREATED;
        order.createdAt = block.timestamp;

        // 添加到用户订单列表
        buyerOrders[msg.sender].push(orderId);

        // 添加到检索索引
        ordersByCountry[country].push(orderId);
        ordersByMarket[market].push(orderId);
        ordersByCode[underlyingCode].push(orderId);

        emit OrderCreated(orderId, msg.sender, true, block.timestamp);
        emit OrderStatusChanged(orderId, OrderStatus.RFQ_CREATED, OrderStatus.RFQ_CREATED, "created", block.timestamp);

        return orderId;
    }

    /**
     * @notice 买方选择卖方报价成交
     */
    function acceptQuote(uint256 quoteId) external override nonReentrant whenNotPaused {
        Quote storage quote = quotes[quoteId];
        require(quote.status == QuoteStatus.Active, "OptionsCore: quote not active");
        require(block.timestamp <= quote.expiresAt, "OptionsCore: quote expired");

        Order storage order = orders[quote.orderId];
        require(msg.sender == order.buyer, "OptionsCore: not buyer");
        require(order.status == OrderStatus.RFQ_CREATED || order.status == OrderStatus.QUOTING, "OptionsCore: invalid status");
        require(quote.premiumRate <= order.premiumRate, "OptionsCore: premium rate exceeds max");

        // 更新报价状态
        quote.status = QuoteStatus.Accepted;

        // 更新订单信息
        order.seller = quote.seller;
        order.sellerType = quote.sellerType;
        order.premiumRate = quote.premiumRate;
        order.premiumAmount = quote.premiumAmount;
        order.initialMargin = quote.marginAmount;
        order.currentMargin = quote.marginAmount;
        order.liquidationRule = quote.liquidationRule;
        order.consecutiveDays = quote.consecutiveDays;
        order.dailyLimitPercent = quote.dailyLimitPercent;
        
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.MATCHED;
        order.matchedAt = block.timestamp;

        // 买方支付期权费 + 交易手续费
        uint256 tradingFee = (order.notionalUSDT * config.tradingFeeRate()) / 10000;
        uint256 totalPayment = quote.premiumAmount + tradingFee;
        usdt.safeTransferFrom(msg.sender, address(vaultManager), totalPayment);

        // 添加到卖方订单列表
        sellerOrders[quote.seller].push(order.orderId);

        // 将其他报价设为拒绝
        Quote[] storage allQuotes = orderQuotes[order.orderId];
        for (uint256 i = 0; i < allQuotes.length; i++) {
            if (allQuotes[i].quoteId != quoteId && allQuotes[i].status == QuoteStatus.Active) {
                allQuotes[i].status = QuoteStatus.Rejected;
            }
        }

        emit OrderMatched(order.orderId, order.buyer, order.seller, block.timestamp);
        emit OrderStatusChanged(order.orderId, oldStatus, OrderStatus.MATCHED, "quote accepted", block.timestamp);
    }

    /**
     * @notice 买方直接承接卖方挂单
     * @param orderId 卖方订单ID
     */
    function acceptSellerOrder(uint256 orderId) external 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        
        // 验证订单状态 - 必须是卖方创建的挂单
        require(order.status == OrderStatus.RFQ_CREATED, "OptionsCore: order not available");
        require(order.seller != address(0), "OptionsCore: not a seller order");
        require(order.buyer == address(0), "OptionsCore: already has buyer");
        require(msg.sender != order.seller, "OptionsCore: cannot accept own order");
        
        // 更新订单信息
        order.buyer = msg.sender;
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.MATCHED;
        order.matchedAt = block.timestamp;
        
        // 买方支付期权费 + 交易手续费
        uint256 tradingFee = (order.notionalUSDT * config.tradingFeeRate()) / 10000;
        uint256 totalPayment = order.premiumAmount + tradingFee;
        usdt.safeTransferFrom(msg.sender, address(vaultManager), totalPayment);
        
        // 添加到买方订单列表
        buyerOrders[msg.sender].push(orderId);
        
        emit OrderMatched(order.orderId, order.buyer, order.seller, block.timestamp);
        emit OrderStatusChanged(order.orderId, oldStatus, OrderStatus.MATCHED, "seller order accepted", block.timestamp);
    }

    /**
     * @notice 买方发起喂价请求
     */
    function requestFeed(uint256 orderId, FeedTier tier) external payable override 
        validOrder(orderId) 
        onlyBuyer(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        // 喂价逻辑将在 FeedProtocol 合约中实现
        // 这里只是接口预留
        revert("OptionsCore: feed protocol not implemented yet");
    }

    /**
     * @notice 买方提前行权
     */
    function earlyExercise(uint256 orderId) external override 
        validOrder(orderId) 
        onlyBuyer(orderId) 
        inStatus(orderId, OrderStatus.LIVE) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        
        // 检查 T+X 条件 (MVP演示: 改为秒而不是天)
        uint256 requiredDelay = uint256(order.exerciseDelay) * 1 seconds;
        require(
            block.timestamp >= order.matchedAt + requiredDelay,
            "OptionsCore: exercise delay not met"
        );

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.WAITING_FINAL_FEED;

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.WAITING_FINAL_FEED, "early exercise", block.timestamp);
    }

    /**
     * @notice 买方取消未成交的RFQ
     */
    function cancelRFQ(uint256 orderId) external override 
        validOrder(orderId) 
        onlyBuyer(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.RFQ_CREATED || order.status == OrderStatus.QUOTING,
            "OptionsCore: cannot cancel after match"
        );

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.CANCELLED;

        // 注意：建仓手续费不退还

        emit OrderCancelled(orderId, "buyer cancelled", block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, "buyer cancelled", block.timestamp);
    }

    // ==================== 卖方功能实现 ====================

    /**
     * @notice 卖方创建卖单
     */
    function createSellerOrder(
        string calldata underlyingName,
        string calldata underlyingCode,
        string calldata market,
        string calldata country,
        string calldata refPrice,
        Direction direction,
        uint256 notionalUSDT,
        uint256 expiryTimestamp,
        uint256 premiumRate,
        uint256 marginAmount,
        LiquidationRule liquidationRule,
        uint8 consecutiveDays,
        uint8 dailyLimitPercent,
        uint256 arbitrationWindow,
        bool dividendAdjustment,
        uint8 exerciseDelay,
        FeedRule feedRule
    ) external override nonReentrant whenNotPaused returns (uint256 orderId) {
        require(notionalUSDT > 0, "OptionsCore: notional must be positive");
        require(expiryTimestamp > block.timestamp, "OptionsCore: expiry must be in future");

        // 收取建仓手续费 1U
        usdt.safeTransferFrom(msg.sender, address(vaultManager), config.creationFee());
        
        // 收取保证金
        if (marginAmount > 0) {
            usdt.safeTransferFrom(msg.sender, address(vaultManager), marginAmount);
        }
        
        orderId = nextOrderId++;

        Order storage order = orders[orderId];
        order.orderId = orderId;
        order.seller = msg.sender;
        order.underlyingName = underlyingName;
        order.underlyingCode = underlyingCode;
        order.market = market;
        order.country = country;
        order.refPrice = refPrice;
        order.direction = direction;
        order.notionalUSDT = notionalUSDT;
        order.expiryTimestamp = expiryTimestamp;
        order.premiumRate = premiumRate;
        order.premiumAmount = (notionalUSDT * premiumRate) / 10000;
        order.initialMargin = marginAmount;
        order.currentMargin = marginAmount;
        order.liquidationRule = liquidationRule;
        order.consecutiveDays = consecutiveDays;
        order.dailyLimitPercent = dailyLimitPercent;
        order.arbitrationWindow = arbitrationWindow;
        order.dividendAdjustment = dividendAdjustment;
        order.exerciseDelay = exerciseDelay;
        order.feedRule = feedRule;
        order.status = OrderStatus.RFQ_CREATED;
        order.createdAt = block.timestamp;

        // 添加到卖方订单列表
        sellerOrders[msg.sender].push(orderId);

        // 添加到检索索引
        ordersByCountry[country].push(orderId);
        ordersByMarket[market].push(orderId);
        ordersByCode[underlyingCode].push(orderId);

        emit OrderCreated(orderId, msg.sender, false, block.timestamp);

        return orderId;
    }

    /**
     * @notice 卖方对买方RFQ报价
     */
    function submitQuote(
        uint256 orderId,
        uint256 premiumRate,
        uint256 marginRate,
        LiquidationRule liquidationRule,
        uint8 consecutiveDays,
        uint8 dailyLimitPercent
    ) external override validOrder(orderId) nonReentrant whenNotPaused returns (uint256 quoteId) {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.RFQ_CREATED || order.status == OrderStatus.QUOTING,
            "OptionsCore: order not accepting quotes"
        );
        require(order.buyer != address(0), "OptionsCore: not a buyer order");
        require(block.timestamp < order.createdAt + config.rfqValidityPeriod(), "OptionsCore: RFQ expired");

        // 检查报价数量限制
        require(
            orderQuotes[orderId].length < config.maxQuotesPerBuyerOrder(),
            "OptionsCore: max quotes reached"
        );

        // 检查卖方类型
        if (order.sellerType == SellerType.DesignatedSeller) {
            require(msg.sender == order.designatedSeller, "OptionsCore: not designated seller");
        }

        // 计算保证金金额
        uint256 marginAmount = (order.notionalUSDT * marginRate) / 10000;
        require(marginRate >= order.minMarginRate, "OptionsCore: margin rate too low");

        // 收取保证金
        usdt.safeTransferFrom(msg.sender, address(vaultManager), marginAmount);

        quoteId = nextQuoteId++;

        Quote memory quote = Quote({
            quoteId: quoteId,
            orderId: orderId,
            seller: msg.sender,
            sellerType: SellerType.FreeSeller,  // TODO: 根据实际情况判断
            premiumRate: premiumRate,
            premiumAmount: (order.notionalUSDT * premiumRate) / 10000,
            marginRate: marginRate,
            marginAmount: marginAmount,
            liquidationRule: liquidationRule,
            consecutiveDays: consecutiveDays,
            dailyLimitPercent: dailyLimitPercent,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + config.quoteValidityPeriod(),
            status: QuoteStatus.Active
        });

        quotes[quoteId] = quote;
        orderQuotes[orderId].push(quote);

        // 更新订单状态为报价中
        if (order.status == OrderStatus.RFQ_CREATED) {
            order.status = OrderStatus.QUOTING;
        }

        emit QuoteSubmitted(orderId, quoteId, msg.sender, premiumRate, block.timestamp);

        return quoteId;
    }

    /**
     * @notice 卖方追加保证金
     */
    function addMargin(uint256 orderId, uint256 amount) external override 
        validOrder(orderId) 
        onlySeller(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "OptionsCore: amount must be positive");
        
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.LIVE, "OptionsCore: order not live");

        uint256 oldMargin = order.currentMargin;
        usdt.safeTransferFrom(msg.sender, address(vaultManager), amount);
        order.currentMargin += amount;

        emit MarginChanged(orderId, msg.sender, oldMargin, order.currentMargin, "add", block.timestamp);
    }

    /**
     * @notice 卖方提取超额保证金（不能低于初始保证金）
     */
    function withdrawExcessMargin(uint256 orderId, uint256 amount) external override 
        validOrder(orderId) 
        onlySeller(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.LIVE, "OptionsCore: order not live");
        
        uint256 excess = order.currentMargin - order.initialMargin;
        require(amount <= excess, "OptionsCore: cannot withdraw below initial margin");

        uint256 oldMargin = order.currentMargin;
        order.currentMargin -= amount;
        
        // 通过 VaultManager 提取
        vaultManager.withdrawMargin(msg.sender, address(usdt), amount);

        emit MarginChanged(orderId, msg.sender, oldMargin, order.currentMargin, "withdraw", block.timestamp);
    }

    /**
     * @notice 记录标的分红 (§7.2 分红调整)
     * @param orderId 订单ID
     * @param dividendPerShare 每股分红金额 (18位精度)
     * @dev 仅操作员可调用，累积记录分红用于结算时调整行权价
     */
    function recordDividend(uint256 orderId, uint256 dividendPerShare) external override 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "OptionsCore: not authorized");
        
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.LIVE, "OptionsCore: order not live");
        require(order.dividendAdjustment, "OptionsCore: dividend adjustment not enabled");
        require(dividendPerShare > 0, "OptionsCore: dividend must be positive");
        
        // 累加分红金额
        order.dividendAmount += dividendPerShare;
        
        emit DividendRecorded(orderId, dividendPerShare, order.dividendAmount, block.timestamp);
    }

    /**
     * @notice 到期结算
     * @dev 根据最终喂价与开仓价计算盈亏，划转资金
     *      支持分红调整 (§7.2): 当 dividendAdjustment=true 时，行权价会扣除累计分红
     */
    function settle(uint256 orderId) external override 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.PENDING_SETTLEMENT, "OptionsCore: not pending settlement");
        require(order.lastFeedPrice > 0, "OptionsCore: no feed price");

        // 计算盈亏 (支持分红调整)
        uint256 strikePrice = _parsePrice(order.refPrice);
        
        // 分红调整 (§7.2): 如果启用分红调整，从行权价中扣除累计分红
        if (order.dividendAdjustment && order.dividendAmount > 0) {
            // 防止行权价变为负数
            if (order.dividendAmount < strikePrice) {
                strikePrice = strikePrice - order.dividendAmount;
            } else {
                strikePrice = 0; // 极端情况：分红超过行权价
            }
        }
        uint256 finalPrice = order.lastFeedPrice;
        
        uint256 buyerProfit = 0;
        
        if (order.direction == Direction.Call) {
            // 看涨期权：买方盈利 = max(0, 最终价 - 开仓价) * 名义本金 / 开仓价
            if (finalPrice > strikePrice) {
                buyerProfit = (finalPrice - strikePrice) * order.notionalUSDT / strikePrice;
            }
        } else {
            // 看跌期权：买方盈利 = max(0, 开仓价 - 最终价) * 名义本金 / 开仓价
            if (strikePrice > finalPrice) {
                buyerProfit = (strikePrice - finalPrice) * order.notionalUSDT / strikePrice;
            }
        }

        // 限制盈利不超过卖方保证金
        uint256 buyerPayout = 0;
        uint256 sellerPayout = 0;
        
        if (buyerProfit > 0) {
            // 买方盈利，从卖方保证金中划出
            if (buyerProfit > order.currentMargin) {
                buyerProfit = order.currentMargin; // 最多赔完保证金
            }
            buyerPayout = buyerProfit;
            sellerPayout = order.currentMargin - buyerProfit;
        } else {
            // 买方亏损或平价，卖方拿回全部保证金
            sellerPayout = order.currentMargin;
        }

        // 划转资金
        if (buyerPayout > 0) {
            vaultManager.transferMargin(
                order.seller,
                order.buyer,
                address(usdt),
                buyerPayout,
                "settlement payout"
            );
        }
        
        // 释放剩余保证金给卖方
        if (sellerPayout > 0) {
            vaultManager.withdrawMargin(order.seller, address(usdt), sellerPayout);
        }

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.SETTLED;
        order.settledAt = block.timestamp;

        emit OrderSettled(orderId, buyerPayout, sellerPayout, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.SETTLED, "settled", block.timestamp);
    }

    /**
     * @notice 解析价格字符串为 uint256 (简化实现，实际需要更复杂的解析)
     */
    function _parsePrice(string memory priceStr) internal pure returns (uint256) {
        bytes memory b = bytes(priceStr);
        uint256 result = 0;
        uint256 decimals = 0;
        bool afterDot = false;
        
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '.') {
                afterDot = true;
                continue;
            }
            if (b[i] >= '0' && b[i] <= '9') {
                result = result * 10 + (uint8(b[i]) - 48);
                if (afterDot) decimals++;
            }
        }
        
        // 标准化到 18 位小数
        if (decimals < 18) {
            result = result * (10 ** (18 - decimals));
        }
        return result;
    }

    /**
     * @notice 发起仲裁
     */
    function initiateArbitration(uint256 orderId) external payable override 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.PENDING_SETTLEMENT,
            "OptionsCore: cannot initiate arbitration"
        );
        require(
            msg.sender == order.buyer || msg.sender == order.seller,
            "OptionsCore: not party to order"
        );
        require(
            block.timestamp <= order.settledAt + order.arbitrationWindow,
            "OptionsCore: arbitration window closed"
        );

        // 收取仲裁费 30U
        usdt.safeTransferFrom(msg.sender, address(vaultManager), config.arbitrationFee());

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.ARBITRATION;

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.ARBITRATION, "arbitration initiated", block.timestamp);
    }

    /**
     * @notice 强制清算（保证金不足）
     */
    function forceLiquidate(uint256 orderId) external override 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.LIVE, "OptionsCore: order not live");

        // TODO: 检查保证金是否充足

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.LIQUIDATED;
        order.settledAt = block.timestamp;

        emit OrderLiquidated(orderId, order.buyer, order.currentMargin, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIQUIDATED, "force liquidated", block.timestamp);
    }

    // ==================== 超时处理函数 ====================

    /**
     * @notice 初始喂价超时取消订单 (§8.2, §15.2)
     * @param orderId 订单ID
     * @dev 由 Keeper 服务调用，处理成交后10分钟内未发起初始喂价的订单
     * 
     * 处理规则：
     * - 买方期权费：全额退回
     * - 卖方保证金：扣除违约金（5%进入国库），剩余退回
     * - 建仓手续费：不退还（已进入生态利润池）
     */
    function cancelOrderDueToFeedTimeout(uint256 orderId) external 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        
        // 验证订单状态：必须是 MATCHED 或 WAITING_INITIAL_FEED
        require(
            order.status == OrderStatus.MATCHED || order.status == OrderStatus.WAITING_INITIAL_FEED,
            "OptionsCore: order not awaiting initial feed"
        );
        
        // 验证超时条件：成交时间 + 10分钟
        require(order.matchedAt > 0, "OptionsCore: order not matched yet");
        require(
            block.timestamp > order.matchedAt + config.initialFeedDeadline(),
            "OptionsCore: initial feed deadline not reached"
        );

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.CANCELLED;
        order.settledAt = block.timestamp;

        // 计算违约金 (卖方保证金的 5%)
        uint256 penaltyRate = config.initialFeedPenaltyRate();
        uint256 penaltyAmount = (order.currentMargin * penaltyRate) / 10000;
        uint256 sellerRefund = order.currentMargin - penaltyAmount;

        // 1. 退还买方期权费
        vaultManager.refundPremium(order.buyer, order.premiumAmount);

        // 2. 退还卖方保证金（扣除违约金）
        if (sellerRefund > 0) {
            vaultManager.refundMargin(order.seller, sellerRefund);
        }

        // 3. 违约金进入国库
        if (penaltyAmount > 0) {
            vaultManager.transferToTreasury(penaltyAmount);
        }

        // 更新订单保证金状态
        order.currentMargin = 0;

        emit OrderCancelled(orderId, "initial feed timeout", block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, "initial feed timeout", block.timestamp);
        
        // 发出违约金扣除事件
        emit MarginChanged(
            orderId, 
            order.seller, 
            order.currentMargin + penaltyAmount + sellerRefund, 
            0, 
            "penalty_deducted", 
            block.timestamp
        );
    }

    /**
     * @notice 触发追保 (P0 追保机制)
     * @param orderId 订单ID
     * @param isCrypto 是否为加密货币/外汇（决定追保时限: 2h vs 12h）
     * @dev 由 Keeper 服务或 FeedProtocol 调用，当动态喂价显示保证金不足时触发
     * 
     * 追保规则 (§9.3):
     * - 加密货币/外汇: 2小时内补足
     * - 其他标的: 12小时内补足
     */
    function triggerMarginCall(uint256 orderId, bool isCrypto) external 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.LIVE, "OptionsCore: order not live");
        require(order.marginCallDeadline == 0, "OptionsCore: margin call already triggered");

        // 检查是否确实需要追保（当前保证金 < 最低要求）
        uint256 minRequired = (order.initialMargin * order.minMarginRate) / 10000;
        require(order.currentMargin < minRequired, "OptionsCore: margin sufficient");

        // 设置追保截止时间
        uint256 deadline = block.timestamp + config.getMarginCallDeadline(isCrypto);
        order.marginCallDeadline = deadline;

        emit MarginCallTriggered(
            orderId,
            order.seller,
            order.currentMargin,
            minRequired,
            deadline
        );
    }

    /**
     * @notice 追保超时强制清算 (P0 追保机制)
     * @param orderId 订单ID
     * @dev 由 Keeper 服务调用，处理追保超时的订单
     * 
     * 处理规则：
     * - 买方获得全部卖方保证金
     * - 订单状态变为 LIQUIDATED
     */
    function forceLiquidateMarginCall(uint256 orderId) external 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.LIVE, "OptionsCore: order not live");
        require(order.marginCallDeadline > 0, "OptionsCore: no margin call active");
        require(block.timestamp > order.marginCallDeadline, "OptionsCore: deadline not reached");

        // 检查保证金仍然不足
        uint256 minRequired = (order.initialMargin * order.minMarginRate) / 10000;
        require(order.currentMargin < minRequired, "OptionsCore: margin was restored");

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.LIQUIDATED;
        order.settledAt = block.timestamp;

        // 买方获得全部保证金
        uint256 buyerPayout = order.currentMargin;
        if (buyerPayout > 0) {
            vaultManager.refundPremium(order.buyer, buyerPayout);
        }

        order.currentMargin = 0;
        order.marginCallDeadline = 0;

        emit OrderLiquidated(orderId, order.buyer, buyerPayout, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIQUIDATED, "margin call timeout", block.timestamp);
    }

    /// @notice 追保触发事件
    event MarginCallTriggered(
        uint256 indexed orderId,
        address indexed seller,
        uint256 currentMargin,
        uint256 requiredMargin,
        uint256 deadline
    );

    /**
     * @notice 解决仲裁 (§15.4)
     * @param orderId 订单ID
     * @param arbitrationPrice 仲裁后的喂价结果
     * @param arbitrators 参与仲裁的喂价员地址列表
     * @dev 仅由操作员/守护者调用，用于完成仲裁流程
     */
    function resolveArbitration(
        uint256 orderId,
        uint256 arbitrationPrice,
        address[] calldata arbitrators
    ) external override 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "OptionsCore: not authorized");
        
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.ARBITRATION, "OptionsCore: order not in arbitration");
        require(arbitrators.length > 0, "OptionsCore: no arbitrators");

        // 记录原始喂价和仲裁者
        uint256 originalPrice = order.lastFeedPrice;
        address initiator = order.buyer; // 假设买方发起仲裁（可扩展追踪）
        
        // 判断仲裁结果是否改变了原始喂价
        bool resultChanged = (arbitrationPrice != originalPrice);
        
        // 计算仲裁奖励 (若结果改变，给发起方50%的剩余仲裁费)
        // 仲裁费30U: 大约8U用于喂价，剩余22U的50%=11U给发起方
        uint256 initiatorReward = 0;
        if (resultChanged) {
            initiatorReward = 11 * 1e18; // 11 USDT
            // 实际转账由VaultManager执行
            vaultManager.transferReward(initiator, initiatorReward);
        }

        // 更新订单喂价结果
        order.lastFeedPrice = arbitrationPrice;
        
        // 根据新喂价重新计算结算结果
        // 结算逻辑在此省略，应调用 _calculateSettlement 内部函数
        
        // 变更订单状态为已结算
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.SETTLED;
        order.settledAt = block.timestamp;

        // 生成仲裁ID (简化：使用orderId + 时间戳)
        uint256 arbitrationId = uint256(keccak256(abi.encodePacked(orderId, block.timestamp)));

        // 发送仲裁解决事件
        emit ArbitrationResolved(
            orderId,
            arbitrationId,
            initiator,
            originalPrice,
            arbitrationPrice,
            resultChanged,
            initiatorReward,
            block.timestamp
        );
        
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.SETTLED, "arbitration resolved", block.timestamp);
    }

    // ==================== 查询功能实现 ====================

    function getOrder(uint256 orderId) external view override returns (Order memory) {
        return orders[orderId];
    }

    function getQuotes(uint256 orderId) external view override returns (Quote[] memory) {
        return orderQuotes[orderId];
    }

    function getBuyerOrders(address buyer) external view override returns (uint256[] memory) {
        return buyerOrders[buyer];
    }

    function getSellerOrders(address seller) external view override returns (uint256[] memory) {
        return sellerOrders[seller];
    }

    /**
     * @notice 按国家检索订单
     */
    function getOrdersByCountry(string calldata country) external view returns (uint256[] memory) {
        return ordersByCountry[country];
    }

    /**
     * @notice 按市场检索订单
     */
    function getOrdersByMarket(string calldata market) external view returns (uint256[] memory) {
        return ordersByMarket[market];
    }

    // ==================== 管理功能 ====================

    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }

    function setVaultManager(address _vaultManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultManager = VaultManager(_vaultManager);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice 处理期初喂价结果，将订单状态从 MATCHED 更新为 LIVE
     * @dev 由管理员或 Keeper 在喂价完成后调用
     * @param orderId 订单ID
     * @param initialPrice 期初喂价结果（18位小数）
     */
    function processInitialFeedResult(
        uint256 orderId, 
        uint256 initialPrice
    ) external validOrder(orderId) onlyRole(DEFAULT_ADMIN_ROLE) {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.MATCHED, "OptionsCore: order not matched");
        require(initialPrice > 0, "OptionsCore: invalid price");

        // 更新订单状态为 LIVE
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.LIVE;
        order.refPrice = _uintToString(initialPrice / 1e18); // 转换为可读价格字符串
        order.lastFeedPrice = initialPrice;

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIVE, "initial feed completed", block.timestamp);
    }

    /**
     * @notice 处理期末喂价结果并结算订单
     * @dev 由管理员或 Keeper 在喂价完成后调用
     * @param orderId 订单ID
     * @param finalPrice 期末喂价结果（18位小数）
     */
    function processFinalFeedResult(
        uint256 orderId, 
        uint256 finalPrice
    ) external validOrder(orderId) onlyRole(DEFAULT_ADMIN_ROLE) {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.LIVE || order.status == OrderStatus.WAITING_FINAL_FEED, 
            "OptionsCore: order not in valid state for final feed"
        );
        require(finalPrice > 0, "OptionsCore: invalid price");

        // 更新订单状态为待结算
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.PENDING_SETTLEMENT;
        order.lastFeedPrice = finalPrice;
        order.settledAt = block.timestamp;

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.PENDING_SETTLEMENT, "final feed completed", block.timestamp);
    }

    /**
     * @notice FeedProtocol 喂价完成后自动回调（由 FeedProtocol 调用）
     * @param orderId 订单ID
     * @param feedType 喂价类型 (期初/期末)
     * @param finalPrice 喂价结果 (18位精度)
     */
    function processFeedCallback(
        uint256 orderId, 
        FeedType feedType, 
        uint256 finalPrice
    ) external override validOrder(orderId) onlyRole(FEED_PROTOCOL_ROLE) {
        Order storage order = orders[orderId];
        require(finalPrice > 0, "OptionsCore: invalid price");

        if (feedType == FeedType.Initial) {
            // 期初喂价: MATCHED -> LIVE
            require(order.status == OrderStatus.MATCHED, "OptionsCore: order not matched");
            
            OrderStatus oldStatus = order.status;
            order.status = OrderStatus.LIVE;
            order.refPrice = _uintToString(finalPrice / 1e18);
            order.lastFeedPrice = finalPrice;

            emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIVE, "initial feed callback", block.timestamp);
        } else if (feedType == FeedType.Final) {
            // 期末喂价: LIVE/WAITING_FINAL_FEED -> PENDING_SETTLEMENT
            require(
                order.status == OrderStatus.LIVE || order.status == OrderStatus.WAITING_FINAL_FEED, 
                "OptionsCore: order not in valid state"
            );
            
            OrderStatus oldStatus = order.status;
            order.status = OrderStatus.PENDING_SETTLEMENT;
            order.lastFeedPrice = finalPrice;
            order.settledAt = block.timestamp;

            emit OrderStatusChanged(orderId, oldStatus, OrderStatus.PENDING_SETTLEMENT, "final feed callback", block.timestamp);
        }
    }

    /**
     * @notice 将 uint256 转换为字符串
     */
    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
