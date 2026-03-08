// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/NSTTypes.sol";
import "../interfaces/IOptionsSettlement.sol";
import "../vault/VaultManager.sol";
import "./Config.sol";

/**
 * @title IOptionsCoreForSettlement
 * @notice OptionsCore 暴露给 Settlement 合约的读写接口
 */
interface IOptionsCoreForSettlement {
    function getOrder(uint256 orderId) external view returns (Order memory);
    function nextOrderId() external view returns (uint256);
    
    // 写入接口（由 OptionsCore 新增，仅 SETTLEMENT_ROLE 可调用）
    function updateOrderStatus(uint256 orderId, OrderStatus newStatus) external;
    function updateOrderMargin(uint256 orderId, uint256 newMargin) external;
    function updateOrderPrice(uint256 orderId, uint256 newPrice) external;
    function updateOrderSettledAt(uint256 orderId, uint256 timestamp) external;
    function updateOrderMarginCallDeadline(uint256 orderId, uint256 deadline) external;
    function updateOrderDividend(uint256 orderId, uint256 amount) external;
}

/**
 * @title OptionsSettlement
 * @notice 期权结算合约 — 结算、保证金管理、仲裁、清算
 * @dev 从 OptionsCore 拆分出来，通过跨合约调用读写订单数据
 */
contract OptionsSettlement is IOptionsSettlement, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 状态变量 ====================
    IOptionsCoreForSettlement public optionsCore;
    Config public config;
    VaultManager public vaultManager;
    IERC20 public usdt;

    // ==================== 构造函数 ====================
    constructor(
        address _optionsCore,
        address _config,
        address _vaultManager,
        address _usdt,
        address _admin
    ) {
        optionsCore = IOptionsCoreForSettlement(_optionsCore);
        config = Config(_config);
        vaultManager = VaultManager(_vaultManager);
        usdt = IERC20(_usdt);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    // ==================== 内部辅助 ====================

    /**
     * @notice 解析价格字符串为 uint256
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
        if (decimals < 18) {
            result = result * (10 ** (18 - decimals));
        }
        return result;
    }

    // ==================== 结算功能 ====================

    /**
     * @notice 买方提前行权
     */
    function earlyExercise(uint256 orderId) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.orderId > 0, "Settlement: invalid order");
        require(msg.sender == order.buyer, "Settlement: not buyer");
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");

        // 检查 T+X 条件
        uint256 requiredDelay = uint256(order.exerciseDelay) * 1 seconds;
        require(
            block.timestamp >= order.matchedAt + requiredDelay,
            "Settlement: exercise delay not met"
        );

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.WAITING_FINAL_FEED);

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.WAITING_FINAL_FEED, "early exercise", block.timestamp);
    }

    /**
     * @notice 到期结算
     * @dev 根据最终喂价与开仓价计算盈亏，划转资金
     *      支持分红调整 (§7.2)
     */
    function settle(uint256 orderId) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.PENDING_SETTLEMENT, "Settlement: not pending settlement");
        require(order.lastFeedPrice > 0, "Settlement: no feed price");

        // 计算盈亏 (支持分红调整)
        uint256 strikePrice = _parsePrice(order.refPrice);
        
        if (order.dividendAdjustment && order.dividendAmount > 0) {
            if (order.dividendAmount < strikePrice) {
                strikePrice = strikePrice - order.dividendAmount;
            } else {
                strikePrice = 0;
            }
        }
        uint256 finalPrice = order.lastFeedPrice;
        
        uint256 buyerProfit = 0;
        
        if (order.direction == Direction.Call) {
            if (finalPrice > strikePrice) {
                buyerProfit = (finalPrice - strikePrice) * order.notionalUSDT / strikePrice;
            }
        } else {
            if (strikePrice > finalPrice) {
                buyerProfit = (strikePrice - finalPrice) * order.notionalUSDT / strikePrice;
            }
        }

        uint256 buyerPayout = 0;
        uint256 sellerPayout = 0;
        
        if (buyerProfit > 0) {
            if (buyerProfit > order.currentMargin) {
                buyerProfit = order.currentMargin;
            }
            buyerPayout = buyerProfit;
            sellerPayout = order.currentMargin - buyerProfit;
        } else {
            sellerPayout = order.currentMargin;
        }

        // 划转资金
        if (buyerPayout > 0) {
            vaultManager.transferMargin(
                order.seller, order.buyer, address(usdt), buyerPayout, "settlement payout"
            );
        }
        if (sellerPayout > 0) {
            vaultManager.withdrawMargin(order.seller, address(usdt), sellerPayout);
        }

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.SETTLED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        emit OrderSettled(orderId, buyerPayout, sellerPayout, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.SETTLED, "settled", block.timestamp);
    }

    // ==================== 保证金管理 ====================

    /**
     * @notice 卖方追加保证金
     */
    function addMargin(uint256 orderId, uint256 amount) external override nonReentrant whenNotPaused {
        require(amount > 0, "Settlement: amount must be positive");
        Order memory order = optionsCore.getOrder(orderId);
        require(msg.sender == order.seller, "Settlement: not seller");
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");

        uint256 oldMargin = order.currentMargin;
        usdt.safeTransferFrom(msg.sender, address(vaultManager), amount);
        optionsCore.updateOrderMargin(orderId, order.currentMargin + amount);

        emit MarginChanged(orderId, msg.sender, oldMargin, order.currentMargin + amount, "add", block.timestamp);
    }

    /**
     * @notice 卖方提取超额保证金
     */
    function withdrawExcessMargin(uint256 orderId, uint256 amount) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(msg.sender == order.seller, "Settlement: not seller");
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");
        
        uint256 excess = order.currentMargin - order.initialMargin;
        require(amount <= excess, "Settlement: cannot withdraw below initial margin");

        uint256 oldMargin = order.currentMargin;
        optionsCore.updateOrderMargin(orderId, order.currentMargin - amount);
        vaultManager.withdrawMargin(msg.sender, address(usdt), amount);

        emit MarginChanged(orderId, msg.sender, oldMargin, order.currentMargin - amount, "withdraw", block.timestamp);
    }

    /**
     * @notice 记录标的分红 (§7.2)
     */
    function recordDividend(uint256 orderId, uint256 dividendPerShare) external override nonReentrant whenNotPaused {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Settlement: not authorized");
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");
        require(order.dividendAdjustment, "Settlement: dividend adjustment not enabled");
        require(dividendPerShare > 0, "Settlement: dividend must be positive");

        optionsCore.updateOrderDividend(orderId, order.dividendAmount + dividendPerShare);

        emit DividendRecorded(orderId, dividendPerShare, order.dividendAmount + dividendPerShare, block.timestamp);
    }

    // ==================== 仲裁 ====================

    /**
     * @notice 发起仲裁
     */
    function initiateArbitration(uint256 orderId) external payable override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.PENDING_SETTLEMENT, "Settlement: cannot initiate arbitration");
        require(msg.sender == order.buyer || msg.sender == order.seller, "Settlement: not party to order");
        require(block.timestamp <= order.settledAt + order.arbitrationWindow, "Settlement: arbitration window closed");

        usdt.safeTransferFrom(msg.sender, address(vaultManager), config.arbitrationFee());

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.ARBITRATION);

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.ARBITRATION, "arbitration initiated", block.timestamp);
    }

    /**
     * @notice 解决仲裁 (§15.4)
     */
    function resolveArbitration(
        uint256 orderId,
        uint256 arbitrationPrice,
        address[] calldata arbitrators
    ) external override nonReentrant whenNotPaused {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Settlement: not authorized");
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.ARBITRATION, "Settlement: order not in arbitration");
        require(arbitrators.length > 0, "Settlement: no arbitrators");

        uint256 originalPrice = order.lastFeedPrice;
        address initiator = order.buyer;
        bool resultChanged = (arbitrationPrice != originalPrice);
        
        uint256 initiatorReward = 0;
        if (resultChanged) {
            initiatorReward = 11 * 1e18;
            vaultManager.transferReward(initiator, initiatorReward);
        }

        optionsCore.updateOrderPrice(orderId, arbitrationPrice);
        
        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.SETTLED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        uint256 arbitrationId = uint256(keccak256(abi.encodePacked(orderId, block.timestamp)));

        emit ArbitrationResolved(
            orderId, arbitrationId, initiator,
            originalPrice, arbitrationPrice,
            resultChanged, initiatorReward, block.timestamp
        );
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.SETTLED, "arbitration resolved", block.timestamp);
    }

    // ==================== 清算 ====================

    /**
     * @notice 强制清算（保证金不足）
     */
    function forceLiquidate(uint256 orderId) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.LIQUIDATED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        emit OrderLiquidated(orderId, order.buyer, order.currentMargin, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIQUIDATED, "force liquidated", block.timestamp);
    }

    /**
     * @notice 初始喂价超时取消订单 (§8.2, §15.2)
     */
    function cancelOrderDueToFeedTimeout(uint256 orderId) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(
            order.status == OrderStatus.MATCHED || order.status == OrderStatus.WAITING_INITIAL_FEED,
            "Settlement: order not awaiting initial feed"
        );
        require(order.matchedAt > 0, "Settlement: order not matched yet");
        require(
            block.timestamp > order.matchedAt + config.initialFeedDeadline(),
            "Settlement: initial feed deadline not reached"
        );

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.CANCELLED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        uint256 penaltyRate = config.initialFeedPenaltyRate();
        uint256 penaltyAmount = (order.currentMargin * penaltyRate) / 10000;
        uint256 sellerRefund = order.currentMargin - penaltyAmount;

        vaultManager.refundPremium(order.buyer, order.premiumAmount);
        if (sellerRefund > 0) {
            vaultManager.refundMargin(order.seller, sellerRefund);
        }
        if (penaltyAmount > 0) {
            vaultManager.transferToTreasury(penaltyAmount);
        }
        optionsCore.updateOrderMargin(orderId, 0);

        emit OrderCancelled(orderId, "initial feed timeout", block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, "initial feed timeout", block.timestamp);
        emit MarginChanged(orderId, order.seller, order.currentMargin, 0, "penalty_deducted", block.timestamp);
    }

    /**
     * @notice 触发追保 (P0 追保机制)
     */
    function triggerMarginCall(uint256 orderId, bool isCrypto) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");
        require(order.marginCallDeadline == 0, "Settlement: margin call already triggered");

        uint256 minRequired = (order.initialMargin * order.minMarginRate) / 10000;
        require(order.currentMargin < minRequired, "Settlement: margin sufficient");

        uint256 deadline = block.timestamp + config.getMarginCallDeadline(isCrypto);
        optionsCore.updateOrderMarginCallDeadline(orderId, deadline);

        emit MarginCallTriggered(orderId, order.seller, order.currentMargin, minRequired, deadline);
    }

    /**
     * @notice 追保超时强制清算
     */
    function forceLiquidateMarginCall(uint256 orderId) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");
        require(order.marginCallDeadline > 0, "Settlement: no margin call active");
        require(block.timestamp > order.marginCallDeadline, "Settlement: deadline not reached");

        uint256 minRequired = (order.initialMargin * order.minMarginRate) / 10000;
        require(order.currentMargin < minRequired, "Settlement: margin was restored");

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.LIQUIDATED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        uint256 buyerPayout = order.currentMargin;
        if (buyerPayout > 0) {
            vaultManager.refundPremium(order.buyer, buyerPayout);
        }
        optionsCore.updateOrderMargin(orderId, 0);
        optionsCore.updateOrderMarginCallDeadline(orderId, 0);

        emit OrderLiquidated(orderId, order.buyer, buyerPayout, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIQUIDATED, "margin call timeout", block.timestamp);
    }

    // ==================== 管理功能 ====================

    function setOptionsCore(address _optionsCore) external onlyRole(DEFAULT_ADMIN_ROLE) {
        optionsCore = IOptionsCoreForSettlement(_optionsCore);
    }

    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
