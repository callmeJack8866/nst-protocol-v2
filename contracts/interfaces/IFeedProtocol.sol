// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/NSTTypes.sol";

/**
 * @title IFeedProtocol
 * @notice 喂价协议接口
 */
interface IFeedProtocol {
    // ==================== 事件 ====================
    
    /// @notice 喂价请求事件
    event FeedRequested(
        uint256 indexed requestId,
        uint256 indexed orderId,
        string underlyingName,
        string underlyingCode,
        string market,
        string country,
        FeedType feedType,
        LiquidationRule liquidationRule,
        uint8 consecutiveDays,
        uint8 exerciseDelay,
        uint256 timestamp
    );

    /// @notice 喂价提交事件
    event FeedSubmitted(
        uint256 indexed requestId,
        address indexed feeder,
        uint256 price,
        uint256 timestamp
    );

    /// @notice 喂价结果确认事件
    event FeedFinalized(
        uint256 indexed requestId,
        uint256 finalPrice,
        uint256 timestamp
    );

    /// @notice 喂价被拒绝事件
    event FeedRejected(
        uint256 indexed requestId,
        address indexed feeder,
        string reason,
        uint256 timestamp
    );

    // ==================== 函数 ====================

    /// @notice 创建喂价请求
    function createFeedRequest(
        uint256 orderId,
        FeedType feedType,
        FeedTier tier
    ) external payable returns (uint256 requestId);

    /// @notice 喂价员提交喂价
    function submitFeed(uint256 requestId, uint256 price) external;

    /// @notice 喂价员拒绝喂价
    function rejectFeed(uint256 requestId, string calldata reason) external;

    /// @notice 完成喂价聚合
    function finalizeFeed(uint256 requestId) external returns (uint256 finalPrice);

    /// @notice 获取喂价费用
    function getFeedFee(FeedTier tier) external view returns (uint256);
}
