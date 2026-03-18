// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/NSTTypes.sol";

/**
 * @title IOptionsSettlement
 * @notice 期权结算合约接口 — 处理结算、保证金、仲裁
 * @dev 与 OptionsCore 配合使用，OptionsCore 负责创建/撮合/喂价
 */
interface IOptionsSettlement {
    // ==================== 事件 ====================

    event OrderSettled(
        uint256 indexed orderId,
        uint256 buyerPayout,
        uint256 sellerPayout,
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

    event ArbitrationResolved(
        uint256 indexed orderId,
        uint256 indexed arbitrationId,
        address initiator,
        uint256 originalPrice,
        uint256 arbitrationPrice,
        bool resultChanged,
        uint256 initiatorReward,
        uint256 timestamp
    );

    event DividendRecorded(
        uint256 indexed orderId,
        uint256 dividendPerShare,
        uint256 totalDividend,
        uint256 timestamp
    );

    event MarginCallTriggered(
        uint256 indexed orderId,
        address indexed seller,
        uint256 currentMargin,
        uint256 requiredMargin,
        uint256 deadline
    );

    // ==================== 结算功能 ====================

    function settle(uint256 orderId) external;
    function earlyExercise(uint256 orderId) external;

    // ==================== 保证金管理 ====================

    function addMargin(uint256 orderId, uint256 amount) external;
    function withdrawExcessMargin(uint256 orderId, uint256 amount) external;
    function recordDividend(uint256 orderId, uint256 dividendPerShare) external;

    // ==================== 清算 ====================

    function forceLiquidate(uint256 orderId) external;
    function cancelOrderDueToFeedTimeout(uint256 orderId) external;
    function cancelOrderDueFinalFeedTimeout(uint256 orderId) external;
    function triggerMarginCall(uint256 orderId, bool isCrypto) external;
    function forceLiquidateMarginCall(uint256 orderId) external;

    // ==================== 仲裁 ====================

    function initiateArbitration(uint256 orderId) external payable;
    function resolveArbitration(
        uint256 orderId,
        uint256 arbitrationPrice,
        address[] calldata arbitrators
    ) external;
}
