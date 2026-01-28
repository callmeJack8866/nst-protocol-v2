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
        
        // 检查 T+X 条件
        uint256 requiredDelay = uint256(order.exerciseDelay) * 1 days;
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
     * @notice 到期结算
     * @dev 根据最终喂价与开仓价计算盈亏，划转资金
     */
    function settle(uint256 orderId) external override 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.PENDING_SETTLEMENT, "OptionsCore: not pending settlement");
        require(order.lastFeedPrice > 0, "OptionsCore: no feed price");

        // 计算盈亏
        uint256 strikePrice = _parsePrice(order.refPrice);
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
}
