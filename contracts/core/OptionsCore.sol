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
 * @notice 期权核心合约 - 订单创建、撮合、喂价
 * @dev 结算/保证金/仲裁功能已拆分到 OptionsSettlement 合约
 */
contract OptionsCore is IOptionsCore, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant FEED_PROTOCOL_ROLE = keccak256("FEED_PROTOCOL_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

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

    modifier inStatus(uint256 orderId, OrderStatus status) {
        require(orders[orderId].status == status, "OptionsCore: invalid status");
        _;
    }

    // ==================== 买方功能 ====================

    /**
     * @notice 买方创建询价订单
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
        order.maxPremiumRate = maxPremiumRate;
        order.minMarginRate = minMarginRate;
        order.sellerType = acceptedSellerType;
        order.designatedSeller = designatedSeller;
        order.arbitrationWindow = arbitrationWindow;
        order.marginCallDeadline = marginCallDeadline;
        order.dividendAdjustment = dividendAdjustment;
        order.exerciseDelay = 0;
        // 新增：平仓规则和喂价规则
        order.liquidationRule = liquidationRule;
        order.consecutiveDays = consecutiveDays;
        order.dailyLimitPercent = dailyLimitPercent;
        order.feedRule = feedRule;
        order.status = OrderStatus.RFQ_CREATED;
        order.createdAt = block.timestamp;

        buyerOrders[msg.sender].push(orderId);
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

        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.MATCHED;
        order.seller = quote.seller;
        order.premiumAmount = quote.premiumAmount;
        order.initialMargin = quote.marginAmount;
        order.currentMargin = quote.marginAmount;
        order.liquidationRule = quote.liquidationRule;
        order.consecutiveDays = quote.consecutiveDays;
        order.dailyLimitPercent = quote.dailyLimitPercent;
        order.matchedAt = block.timestamp;

        uint256 tradingFee = (order.notionalUSDT * config.tradingFeeRate()) / 10000;
        uint256 totalPayment = quote.premiumAmount + tradingFee;
        usdt.safeTransferFrom(msg.sender, address(vaultManager), totalPayment);

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
     */
    function acceptSellerOrder(uint256 orderId) external 
        validOrder(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.RFQ_CREATED, "OptionsCore: order not available");
        require(order.seller != address(0), "OptionsCore: not a seller order");
        require(msg.sender != order.seller, "OptionsCore: cannot accept own order");

        order.buyer = msg.sender;
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.MATCHED;
        order.matchedAt = block.timestamp;

        uint256 tradingFee = (order.notionalUSDT * config.tradingFeeRate()) / 10000;
        uint256 totalPayment = order.premiumAmount + tradingFee;
        usdt.safeTransferFrom(msg.sender, address(vaultManager), totalPayment);

        buyerOrders[msg.sender].push(orderId);
        
        emit OrderMatched(order.orderId, order.buyer, order.seller, block.timestamp);
        emit OrderStatusChanged(order.orderId, oldStatus, OrderStatus.MATCHED, "seller order accepted", block.timestamp);
    }

    /**
     * @notice 买方发起喂价请求（发射事件供 FeedEngine 监听）
     */
    function requestFeed(uint256 orderId, FeedTier tier) external payable override 
        validOrder(orderId) 
        onlyBuyer(orderId) 
        nonReentrant 
        whenNotPaused 
    {
        Order storage order = orders[orderId];

        FeedType feedType;
        if (order.status == OrderStatus.MATCHED) {
            feedType = FeedType.Initial;
            OrderStatus oldStatus = order.status;
            order.status = OrderStatus.WAITING_INITIAL_FEED;
            emit OrderStatusChanged(orderId, oldStatus, OrderStatus.WAITING_INITIAL_FEED, "initial feed requested", block.timestamp);
        } else if (order.status == OrderStatus.WAITING_FINAL_FEED) {
            feedType = FeedType.Final;
        } else if (order.status == OrderStatus.LIVE) {
            feedType = FeedType.Dynamic;
        } else {
            revert("OptionsCore: invalid status for feed request");
        }

        emit FeedRequestEmitted(
            orderId,
            order.underlyingCode,
            order.market,
            order.country,
            feedType,
            tier,
            msg.sender,
            order.notionalUSDT,
            block.timestamp
        );
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

        emit OrderCancelled(orderId, "buyer cancelled", block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, "buyer cancelled", block.timestamp);
    }

    // ==================== 卖方功能 ====================

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

        usdt.safeTransferFrom(msg.sender, address(vaultManager), config.creationFee());
        usdt.safeTransferFrom(msg.sender, address(vaultManager), marginAmount);

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

        sellerOrders[msg.sender].push(orderId);
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

        uint256 premiumAmount = (order.notionalUSDT * premiumRate) / 10000;
        uint256 marginAmount = (order.notionalUSDT * marginRate) / 10000;

        if (order.maxPremiumRate > 0) {
            require(premiumRate <= order.maxPremiumRate, "OptionsCore: premium rate too high");
        }
        require(marginRate >= order.minMarginRate, "OptionsCore: margin rate too low");

        usdt.safeTransferFrom(msg.sender, address(vaultManager), marginAmount);

        quoteId = nextQuoteId++;

        Quote memory quote = Quote({
            quoteId: quoteId,
            orderId: orderId,
            seller: msg.sender,
            sellerType: SellerType.FreeSeller,
            premiumRate: premiumRate,
            premiumAmount: premiumAmount,
            marginRate: marginRate,
            marginAmount: marginAmount,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + 24 hours,
            status: QuoteStatus.Active,
            liquidationRule: liquidationRule,
            consecutiveDays: consecutiveDays,
            dailyLimitPercent: dailyLimitPercent
        });

        quotes[quoteId] = quote;
        orderQuotes[orderId].push(quote);

        if (order.status == OrderStatus.RFQ_CREATED) {
            order.status = OrderStatus.QUOTING;
        }

        emit QuoteSubmitted(orderId, quoteId, msg.sender, premiumRate, block.timestamp);

        return quoteId;
    }

    // ==================== Settlement 跨合约写入接口 ====================

    /**
     * @notice 更新订单状态（仅 Settlement 合约可调用）
     */
    function updateOrderStatus(uint256 orderId, OrderStatus newStatus) external 
        validOrder(orderId) onlyRole(SETTLEMENT_ROLE) 
    {
        orders[orderId].status = newStatus;
    }

    /**
     * @notice 更新订单保证金（仅 Settlement 合约可调用）
     */
    function updateOrderMargin(uint256 orderId, uint256 newMargin) external 
        validOrder(orderId) onlyRole(SETTLEMENT_ROLE) 
    {
        orders[orderId].currentMargin = newMargin;
    }

    /**
     * @notice 更新订单价格（仅 Settlement 合约可调用）
     */
    function updateOrderPrice(uint256 orderId, uint256 newPrice) external 
        validOrder(orderId) onlyRole(SETTLEMENT_ROLE) 
    {
        orders[orderId].lastFeedPrice = newPrice;
    }

    /**
     * @notice 更新订单结算时间（仅 Settlement 合约可调用）
     */
    function updateOrderSettledAt(uint256 orderId, uint256 timestamp) external 
        validOrder(orderId) onlyRole(SETTLEMENT_ROLE) 
    {
        orders[orderId].settledAt = timestamp;
    }

    /**
     * @notice 更新追保截止时间（仅 Settlement 合约可调用）
     */
    function updateOrderMarginCallDeadline(uint256 orderId, uint256 deadline) external 
        validOrder(orderId) onlyRole(SETTLEMENT_ROLE) 
    {
        orders[orderId].marginCallDeadline = deadline;
    }

    /**
     * @notice 更新订单累计分红（仅 Settlement 合约可调用）
     */
    function updateOrderDividend(uint256 orderId, uint256 amount) external 
        validOrder(orderId) onlyRole(SETTLEMENT_ROLE) 
    {
        orders[orderId].dividendAmount = amount;
    }

    // ==================== 查询功能 ====================

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

    function getOrdersByCountry(string calldata country) external view returns (uint256[] memory) {
        return ordersByCountry[country];
    }

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

    // ==================== 喂价回调 ====================

    /**
     * @notice 处理期初喂价结果
     */
    function processInitialFeedResult(
        uint256 orderId, 
        uint256 initialPrice
    ) external validOrder(orderId) onlyRole(DEFAULT_ADMIN_ROLE) {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.MATCHED, "OptionsCore: order not matched");
        
        order.lastFeedPrice = initialPrice;
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.LIVE;
        
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIVE, "initial feed", block.timestamp);
    }

    /**
     * @notice 处理期末喂价结果
     */
    function processFinalFeedResult(
        uint256 orderId, 
        uint256 finalPrice
    ) external validOrder(orderId) onlyRole(DEFAULT_ADMIN_ROLE) {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.LIVE || order.status == OrderStatus.WAITING_FINAL_FEED, 
            "OptionsCore: invalid status"
        );
        
        order.lastFeedPrice = finalPrice;
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.PENDING_SETTLEMENT;
        
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.PENDING_SETTLEMENT, "final feed", block.timestamp);
    }

    /**
     * @notice FeedEngine 喂价完成后自动回调
     */
    function processFeedCallback(
        uint256 orderId, 
        FeedType feedType, 
        uint256 finalPrice
    ) external override validOrder(orderId) onlyRole(FEED_PROTOCOL_ROLE) {
        Order storage order = orders[orderId];
        require(finalPrice > 0, "OptionsCore: invalid price");

        if (feedType == FeedType.Initial) {
            require(
                order.status == OrderStatus.MATCHED || order.status == OrderStatus.WAITING_INITIAL_FEED,
                "OptionsCore: not awaiting initial feed"
            );
            order.lastFeedPrice = finalPrice;
            OrderStatus oldStatus = order.status;
            order.status = OrderStatus.LIVE;
            emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIVE, "initial feed callback", block.timestamp);

        } else if (feedType == FeedType.Final) {
            require(
                order.status == OrderStatus.LIVE || order.status == OrderStatus.WAITING_FINAL_FEED,
                "OptionsCore: not awaiting final feed"
            );
            order.lastFeedPrice = finalPrice;
            OrderStatus oldStatus = order.status;
            order.status = OrderStatus.PENDING_SETTLEMENT;
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
