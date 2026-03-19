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
    function updateOrderStrikePrice(uint256 orderId, uint256 price) external;
    function updateOrderFinalFeedRequestedAt(uint256 orderId, uint256 timestamp) external;
}

/**
 * @title OptionsSettlement
 * @notice 期权结算合约 — 结算、保证金管理、仲裁、清算
 * @dev 从 OptionsCore 拆分出来，通过跨合约调用读写订单数据
 */
contract OptionsSettlement is IOptionsSettlement, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 事件 ====================

    /// @notice 动态喂价后保证金不足，需触发追保
    event MarginCallRequired(
        uint256 indexed orderId,
        address indexed seller,
        uint256 currentMargin,
        uint256 minRequired,
        uint256 lastFeedPrice
    );

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

        // 检查 T+X 条件（exerciseDelay 存储天数，如 1 = T+1，需转换为秒）
        uint256 requiredDelay = uint256(order.exerciseDelay) * 1 days;
        require(
            block.timestamp >= order.matchedAt + requiredDelay,
            "Settlement: exercise delay not met"
        );

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.WAITING_FINAL_FEED);
        optionsCore.updateOrderFinalFeedRequestedAt(orderId, block.timestamp);

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

        // 使用首轮喂价确认的正式行权价（不再用 refPrice 字符串解析）
        require(order.strikePrice > 0, "Settlement: strike price not set (initial feed required)");
        uint256 strikePrice = order.strikePrice;
        
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

        // 划转资金（真实 USDT 转账）
        if (buyerPayout > 0) {
            // 从卖方内部余额转给买方，然后提现给买方钱包
            vaultManager.transferMargin(
                order.seller, order.buyer, address(usdt), buyerPayout, "settlement payout"
            );
            vaultManager.withdrawMargin(order.buyer, address(usdt), buyerPayout);
        }
        if (sellerPayout > 0) {
            // 卖方剩余保证金直接提现到卖方钱包
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
        uint256 newMargin = order.currentMargin + amount;
        // 通过 VaultManager 正式入账（卖方保证金账户）
        vaultManager.depositMargin(msg.sender, address(usdt), amount);
        optionsCore.updateOrderMargin(orderId, newMargin);

        // 追保成功后，如果保证金已恢复到最低要求以上，自动清除追保状态
        if (order.marginCallDeadline > 0) {
            // ✅ 正确公式：最低保证金 = notionalUSDT * minMarginRate / 10000
            uint256 minRequired = _calcMinRequired(order);
            if (newMargin >= minRequired) {
                optionsCore.updateOrderMarginCallDeadline(orderId, 0);
            }
        }

        emit MarginChanged(orderId, msg.sender, oldMargin, newMargin, "add", block.timestamp);
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

    // 记录仲裁发起人（买方或卖方）
    mapping(uint256 => address) public arbitrationInitiator;

    /**
     * @notice 发起仲裁
     * @dev 买方或卖方均可发起，需支付仲裁费
     */
    function initiateArbitration(uint256 orderId) external payable override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.PENDING_SETTLEMENT, "Settlement: cannot initiate arbitration");
        require(msg.sender == order.buyer || msg.sender == order.seller, "Settlement: not party to order");
        require(block.timestamp <= order.settledAt + order.arbitrationWindow, "Settlement: arbitration window closed");

        // 仲裁费走 VaultManager 正式记账
        vaultManager.collectFee(msg.sender, address(usdt), config.arbitrationFee(), "arbitration_fee");

        // 记录仲裁发起人
        arbitrationInitiator[orderId] = msg.sender;

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.ARBITRATION);

        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.ARBITRATION, "arbitration initiated", block.timestamp);
    }

    /**
     * @notice 解决仲裁 (§15.4)
     * @dev 如果仲裁价格与原价不同，必须用新价格重新结算资金分配
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
        address initiator = arbitrationInitiator[orderId];
        if (initiator == address(0)) initiator = order.buyer; // 向后兼容
        bool resultChanged = (arbitrationPrice != originalPrice);
        
        // 仲裁成功奖励发起人（价格改变时）
        uint256 initiatorReward = 0;
        if (resultChanged) {
            initiatorReward = 11 * 1e18;
            vaultManager.transferReward(initiator, initiatorReward);

            // 用仲裁价格重新结算
            optionsCore.updateOrderPrice(orderId, arbitrationPrice);
            _settleWithPrice(orderId, order, arbitrationPrice);
        } else {
            // 价格未改变，维持原结算
            optionsCore.updateOrderPrice(orderId, arbitrationPrice);
        }
        
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

    /**
     * @notice 内部函数：用指定价格重新结算（仲裁用）
     * @dev 重新计算买卖双方 payout 并转账
     */
    function _settleWithPrice(uint256 orderId, Order memory order, uint256 finalPrice) internal {
        require(order.strikePrice > 0, "Settlement: strike price not set");
        uint256 strikePrice = order.strikePrice;

        // 分红调整
        if (order.dividendAdjustment && order.dividendAmount > 0) {
            if (order.dividendAmount < strikePrice) {
                strikePrice = strikePrice - order.dividendAmount;
            } else {
                strikePrice = 0;
            }
        }

        // 计算盈亏
        uint256 buyerProfit = 0;
        if (order.direction == Direction.Call) {
            if (finalPrice > strikePrice && strikePrice > 0) {
                buyerProfit = (finalPrice - strikePrice) * order.notionalUSDT / strikePrice;
            }
        } else {
            if (strikePrice > finalPrice && strikePrice > 0) {
                buyerProfit = (strikePrice - finalPrice) * order.notionalUSDT / strikePrice;
            }
        }

        // 分配
        uint256 buyerPayout = buyerProfit > order.currentMargin ? order.currentMargin : buyerProfit;
        uint256 sellerPayout = order.currentMargin - buyerPayout;

        // 转账
        if (buyerPayout > 0) {
            vaultManager.transferMargin(
                order.seller, order.buyer, address(usdt), buyerPayout, "arbitration settlement"
            );
            vaultManager.withdrawMargin(order.buyer, address(usdt), buyerPayout);
        }
        if (sellerPayout > 0) {
            vaultManager.withdrawMargin(order.seller, address(usdt), sellerPayout);
        }
        optionsCore.updateOrderMargin(orderId, 0);

        emit OrderSettled(orderId, buyerPayout, sellerPayout, block.timestamp);
    }

    // ==================== 清算 ====================

    /**
     * @notice 强制清算（连续涨停/单日暴涨触发）
     * @dev 仅 ADMIN 可触发，需满足订单的 liquidationRule 条件
     */
    function forceLiquidate(uint256 orderId) external override nonReentrant whenNotPaused {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Settlement: not authorized");
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");
        // 强平规则校验：必须有设定强平条件
        require(
            order.liquidationRule != LiquidationRule.NoLiquidation,
            "Settlement: no liquidation rule set"
        );

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.LIQUIDATED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        // 清算时保证金全部赔付买方（真实 USDT 转账）
        uint256 payout = order.currentMargin;
        if (payout > 0) {
            vaultManager.transferMargin(
                order.seller, order.buyer, address(usdt), payout, "liquidation payout"
            );
            vaultManager.withdrawMargin(order.buyer, address(usdt), payout);
        }
        optionsCore.updateOrderMargin(orderId, 0);

        // 清除追保状态（如有）
        if (order.marginCallDeadline > 0) {
            optionsCore.updateOrderMarginCallDeadline(orderId, 0);
        }

        emit OrderLiquidated(orderId, order.buyer, payout, block.timestamp);
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

        // 退还权利金给买方（从买方内部余额提现）
        vaultManager.withdrawMargin(order.buyer, address(usdt), order.premiumAmount);
        // 违约金从卖方余额转入利润池
        if (penaltyAmount > 0) {
            vaultManager.penaltyToTreasury(order.seller, address(usdt), penaltyAmount);
        }
        // 卖方剩余保证金提现
        if (sellerRefund > 0) {
            vaultManager.withdrawMargin(order.seller, address(usdt), sellerRefund);
        }
        optionsCore.updateOrderMargin(orderId, 0);

        emit OrderCancelled(orderId, "initial feed timeout", block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, "initial feed timeout", block.timestamp);
        emit MarginChanged(orderId, order.seller, order.currentMargin, 0, "penalty_deducted", block.timestamp);
    }

    /**
     * @notice 终轮喂价超时取消订单
     * @dev 终轮喂价超时后双方均无过错：买方权利金退还，卖方保证金全额退还
     *      违约金由喂价员承担（在 FeedProtocol 中扣质押），不扣卖方保证金
     */
    function cancelOrderDueFinalFeedTimeout(uint256 orderId) external nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(
            order.status == OrderStatus.LIVE || order.status == OrderStatus.WAITING_FINAL_FEED,
            "Settlement: order not awaiting final feed"
        );
        require(order.expiryTimestamp > 0, "Settlement: no expiry set");
        require(
            block.timestamp > order.expiryTimestamp + config.closingFeedDeadline(),
            "Settlement: final feed deadline not reached"
        );

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.CANCELLED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        // 终轮喂价超时，双方无过错，全额退还
        // 退还买方权利金
        if (order.premiumAmount > 0) {
            vaultManager.withdrawMargin(order.buyer, address(usdt), order.premiumAmount);
        }
        // 退还卖方全部保证金（无违约金）
        if (order.currentMargin > 0) {
            vaultManager.withdrawMargin(order.seller, address(usdt), order.currentMargin);
        }
        optionsCore.updateOrderMargin(orderId, 0);

        emit OrderCancelled(orderId, "final feed timeout", block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, "final feed timeout", block.timestamp);
        emit MarginChanged(orderId, order.seller, order.currentMargin, 0, "final_feed_timeout_refund", block.timestamp);
    }

    /**
     * @notice 触发追保 (P0 追保机制)
     * @param orderId 订单ID
     * @param isCrypto true=加密货币/外汇（2小时追保），false=其他（12小时追保）
     */
    function triggerMarginCall(uint256 orderId, bool isCrypto) external override nonReentrant whenNotPaused {
        Order memory order = optionsCore.getOrder(orderId);
        require(order.status == OrderStatus.LIVE, "Settlement: order not live");
        require(order.marginCallDeadline == 0, "Settlement: margin call already triggered");

        // ✅ 正确公式：最低保证金 = notionalUSDT * minMarginRate / 10000
        uint256 minRequired = _calcMinRequired(order);
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

        // ✅ 正确公式：最低保证金 = notionalUSDT * minMarginRate / 10000
        uint256 minRequired = _calcMinRequired(order);
        require(order.currentMargin < minRequired, "Settlement: margin was restored");

        OrderStatus oldStatus = order.status;
        optionsCore.updateOrderStatus(orderId, OrderStatus.LIQUIDATED);
        optionsCore.updateOrderSettledAt(orderId, block.timestamp);

        uint256 buyerPayout = order.currentMargin;
        if (buyerPayout > 0) {
            // 从卖方余额转给买方，然后提现给买方钱包
            vaultManager.transferMargin(
                order.seller, order.buyer, address(usdt), buyerPayout, "margin call liquidation"
            );
            vaultManager.withdrawMargin(order.buyer, address(usdt), buyerPayout);
        }
        optionsCore.updateOrderMargin(orderId, 0);
        optionsCore.updateOrderMarginCallDeadline(orderId, 0);

        emit OrderLiquidated(orderId, order.buyer, buyerPayout, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.LIQUIDATED, "margin call timeout", block.timestamp);
    }

    // ==================== 内部辅助 ====================

    /**
     * @dev 计算订单的最低保证金要求
     *      公式：notionalUSDT * minMarginRate / 10000
     *      语义：minMarginRate 是针对名义本金的比率，不是针对 initialMargin
     *      例：notional=10000, minMarginRate=500 → minRequired=500 USDT
     */
    function _calcMinRequired(Order memory order) internal pure returns (uint256) {
        return (order.notionalUSDT * order.minMarginRate) / 10000;
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
