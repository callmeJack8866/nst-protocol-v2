// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/NSTTypes.sol";

/**
 * @title IOptionsCore
 * @notice 期权核心合约接口
 * @dev 结算/保证金/仲裁函数已迁移到 IOptionsSettlement
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

    /// @notice 喂价请求发射事件（供 FeedEngine 监听）
    event FeedRequestEmitted(
        uint256 indexed orderId,
        string underlyingCode,
        string market,
        string country,
        FeedType feedType,
        FeedTier tier,
        address indexed requester,
        uint256 notionalAmount,
        uint256 timestamp
    );

    /// @notice 报价保证金退还事件
    event QuoteMarginRefunded(
        uint256 indexed orderId,
        uint256 indexed quoteId,
        address indexed seller,
        uint256 amount,
        uint256 timestamp
    );

    // ==================== 买方功能 ====================

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
    ) external returns (uint256 orderId);

    function acceptQuote(uint256 quoteId) external;
    function requestFeed(uint256 orderId, FeedTier tier) external payable;
    function cancelRFQ(uint256 orderId) external;

    // ==================== 卖方功能 ====================

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
    ) external returns (uint256 orderId);

    function submitQuote(
        uint256 orderId,
        uint256 premiumRate,
        uint256 marginRate,
        LiquidationRule liquidationRule,
        uint8 consecutiveDays,
        uint8 dailyLimitPercent
    ) external returns (uint256 quoteId);

    // ==================== 查询功能 ====================

    function getOrder(uint256 orderId) external view returns (Order memory);
    function getQuotes(uint256 orderId) external view returns (Quote[] memory);
    function getBuyerOrders(address buyer) external view returns (uint256[] memory);
    function getSellerOrders(address seller) external view returns (uint256[] memory);

    // ==================== 喂价回调 ====================
    
    function processFeedCallback(
        uint256 orderId, 
        FeedType feedType, 
        uint256 finalPrice
    ) external;

    function onFeedRequested(
        uint256 orderId,
        FeedType feedType
    ) external;
}
