// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/NSTTypes.sol";

/**
 * @title IOptionsCore
 * @notice 期权核心合约接口
 */
interface IOptionsCore {
    // ==================== 事件 ====================
    event OrderCreated(
        uint256 indexed orderId,
        address indexed creator,
        bool isBuyerOrder,
        uint256 timestamp
    );

    event QuoteSubmitted(
        uint256 indexed orderId,
        uint256 indexed quoteId,
        address indexed seller,
        uint256 premiumRate,
        uint256 timestamp
    );

    event OrderMatched(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 timestamp
    );

    event OrderSettled(
        uint256 indexed orderId,
        int256 buyerPnL,
        int256 sellerPnL,
        uint256 timestamp
    );

    event OrderLiquidated(
        uint256 indexed orderId,
        address beneficiary,
        uint256 amount,
        uint256 timestamp
    );

    event OrderCancelled(
        uint256 indexed orderId,
        string reason,
        uint256 timestamp
    );

    event OrderStatusChanged(
        uint256 indexed orderId,
        OrderStatus oldStatus,
        OrderStatus newStatus,
        string reason,
        uint256 timestamp
    );

    event MarginChanged(
        uint256 indexed orderId,
        address indexed seller,
        uint256 oldAmount,
        uint256 newAmount,
        string changeType,
        uint256 timestamp
    );

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
        bool dividendAdjustment
    ) external returns (uint256 orderId);

    /**
     * @notice 买方选择卖方报价成交
     */
    function acceptQuote(uint256 quoteId) external;

    /**
     * @notice 买方发起喂价请求
     */
    function requestFeed(uint256 orderId, FeedTier tier) external payable;

    /**
     * @notice 买方提前行权
     */
    function earlyExercise(uint256 orderId) external;

    /**
     * @notice 买方取消未成交的RFQ
     */
    function cancelRFQ(uint256 orderId) external;

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
        bool dividendAdjustment
    ) external returns (uint256 orderId);

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
    ) external returns (uint256 quoteId);

    /**
     * @notice 卖方追加保证金
     */
    function addMargin(uint256 orderId, uint256 amount) external;

    /**
     * @notice 卖方提取超额保证金
     */
    function withdrawExcessMargin(uint256 orderId, uint256 amount) external;

    // ==================== 结算功能 ====================

    /**
     * @notice 到期结算
     */
    function settle(uint256 orderId) external;

    /**
     * @notice 发起仲裁
     */
    function initiateArbitration(uint256 orderId) external payable;

    /**
     * @notice 强制清算
     */
    function forceLiquidate(uint256 orderId) external;

    // ==================== 查询功能 ====================

    function getOrder(uint256 orderId) external view returns (Order memory);
    function getQuotes(uint256 orderId) external view returns (Quote[] memory);
    function getBuyerOrders(address buyer) external view returns (uint256[] memory);
    function getSellerOrders(address seller) external view returns (uint256[] memory);
}
