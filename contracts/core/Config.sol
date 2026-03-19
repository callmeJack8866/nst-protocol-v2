// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Config
 * @notice 参数配置管理合约 - 所有可调参数唯一存储
 * @dev 所有修改必须通过 Timelock，并 emit 新旧值
 */
contract Config is AccessControl, Pausable {
    // ==================== 角色定义 ====================
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ==================== 时间常量 ====================
    uint256 public rfqValidityPeriod = 2 hours;              // RFQ有效期
    uint256 public quoteValidityPeriod = 30 minutes;         // 报价有效期
    uint256 public initialFeedDeadline = 10 minutes;         // 初始喂价时限
    uint256 public closingFeedDeadline = 10 minutes;         // 平仓喂价时限
    uint256 public defaultMarginCallDeadline = 12 hours;     // 默认追保截止时间
    uint256 public cryptoMarginCallDeadline = 2 hours;       // 加密货币追保截止时间
    uint256 public settlementArbitrationWindow = 24 hours;   // 平仓结算仲裁窗口
    uint256 public defaultArbitrationWindow = 12 hours;      // 其他场景仲裁窗口

    // ==================== 费率常量 (基点 1 = 0.01%) ====================
    uint256 public creationFee = 1 ether;                    // 建仓手续费：1U
    uint256 public tradingFeeRate = 10;                      // 交易手续费：0.1%
    uint256 public arbitrationFee = 30 ether;                // 仲裁费：30U
    uint256 public nstDiscount = 80;                         // NST折扣：80%

    // ==================== 喂价费用 ====================
    uint256 public feedFee_5_3 = 3 ether;                    // 5-3档：3U
    uint256 public feedFee_7_5 = 5 ether;                    // 7-5档：5U
    uint256 public feedFee_10_7 = 8 ether;                   // 10-7档：8U
    uint256 public feedPlatformShare = 10;                   // 平台抽成：10%
    uint256 public feedFeederShare = 90;                     // 喂价员分配：90%

    // ==================== 保证金参数 ====================
    uint256 public minMarginRate = 1000;                     // 最低保证金率：10%（自由卖方）
    uint256 public seatSellerInitialMargin = 0;              // 席位卖方初始保证金：0

    // ==================== 喂价员参数 ====================
    uint256 public minFeederStake = 100 ether;               // 喂价员最低质押：100U

    // ==================== 限制参数 ====================
    uint256 public maxQuotesPerBuyerOrder = 5;               // 买方单最大报价数
    uint256 public maxQuotesPerSellerOrder = 1;              // 卖方单报价即成交
    uint256 public maxConsecutiveDays = 10;                  // 最大连续天数
    uint256 public defaultDailyLimitPercent = 30;            // 默认单日涨幅阈值
    uint256 public minExerciseDelay = 1;                     // 最小行权延迟T+1
    uint256 public maxExerciseDelay = 5;                     // 最大行权延迟T+5
    uint256 public minArbitrationWindow = 1 hours;           // 仲裁窗口下限
    uint256 public maxArbitrationWindow = 48 hours;          // 仲裁窗口上限
    uint256 public minMarginCallDeadline = 1 hours;          // 追保截止下限
    uint256 public maxMarginCallDeadline = 24 hours;         // 追保截止上限

    // ==================== 积分参数 ====================
    uint256 public pointsMultiplier = 100;                   // 积分倍率：1U = 100分

    // ==================== 违约金参数 ====================
    uint256 public initialFeedPenaltyRate = 500;             // 初始喂价超时违约金：5% (基点)
    uint256 public closingFeedPenaltyRate = 500;             // 平仓喂价超时违约金：5% (基点)

    // ==================== 资金池分配比例 (基点 100 = 1%) ====================
    uint256 public nodeRewardShare = 500;                    // 节点奖励：5%
    uint256 public tokenBuybackShare = 1000;                 // 代币回购：10%
    uint256 public lpPoolShare = 1000;                       // LP池：10%
    uint256 public teamFundShare = 3000;                     // 团队：30%
    uint256 public foundationShare = 2500;                   // 基金会：25%
    uint256 public daoShare = 1000;                          // DAO：10%
    uint256 public growthNodeShare = 1000;                   // 成长节点：10%

    // ==================== NST 代币折扣 (P1) ====================
    uint256 public nstDiscountRate = 8000;                   // NST支付折扣：80% (8000基点 = 80%)
    bool public nstDiscountEnabled = true;                   // 启用NST折扣


    // ==================== 合约地址 ====================
    address public usdtAddress;
    address public usdcAddress;
    address public nstTokenAddress;
    address public vaultManagerAddress;
    address public optionsCoreAddress;
    address public feedProtocolAddress;
    address public seatManagerAddress;
    address public pointsManagerAddress;

    // ==================== 事件 ====================
    event ParameterUpdated(
        string indexed paramName,
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp
    );

    event AddressUpdated(
        string indexed paramName,
        address oldAddress,
        address newAddress,
        uint256 timestamp
    );

    // ==================== 构造函数 ====================
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(DAO_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
    }

    // ==================== 修改器 ====================
    modifier onlyDAO() {
        require(hasRole(DAO_ROLE, msg.sender), "Config: caller is not DAO");
        _;
    }

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Config: caller is not Operator");
        _;
    }

    modifier onlyGuardian() {
        require(hasRole(GUARDIAN_ROLE, msg.sender), "Config: caller is not Guardian");
        _;
    }

    // ==================== 暂停功能 ====================
    function pause() external onlyGuardian {
        _pause();
    }

    function unpause() external onlyDAO {
        _unpause();
    }

    // ==================== 参数设置函数 ====================
    
    /**
     * @notice 设置 RFQ 有效期
     */
    function setRfqValidityPeriod(uint256 _value) external onlyDAO {
        uint256 oldValue = rfqValidityPeriod;
        rfqValidityPeriod = _value;
        emit ParameterUpdated("rfqValidityPeriod", oldValue, _value, block.timestamp);
    }

    /**
     * @notice 设置报价有效期
     */
    function setQuoteValidityPeriod(uint256 _value) external onlyDAO {
        uint256 oldValue = quoteValidityPeriod;
        quoteValidityPeriod = _value;
        emit ParameterUpdated("quoteValidityPeriod", oldValue, _value, block.timestamp);
    }

    /**
     * @notice 设置建仓手续费
     */
    function setCreationFee(uint256 _value) external onlyDAO {
        uint256 oldValue = creationFee;
        creationFee = _value;
        emit ParameterUpdated("creationFee", oldValue, _value, block.timestamp);
    }

    /**
     * @notice 设置交易手续费率
     */
    function setTradingFeeRate(uint256 _value) external onlyDAO {
        uint256 oldValue = tradingFeeRate;
        tradingFeeRate = _value;
        emit ParameterUpdated("tradingFeeRate", oldValue, _value, block.timestamp);
    }

    /**
     * @notice 设置仲裁费
     */
    function setArbitrationFee(uint256 _value) external onlyDAO {
        uint256 oldValue = arbitrationFee;
        arbitrationFee = _value;
        emit ParameterUpdated("arbitrationFee", oldValue, _value, block.timestamp);
    }

    /**
     * @notice 设置最低保证金率
     */
    function setMinMarginRate(uint256 _value) external onlyDAO {
        uint256 oldValue = minMarginRate;
        minMarginRate = _value;
        emit ParameterUpdated("minMarginRate", oldValue, _value, block.timestamp);
    }

    /**
     * @notice 设置喂价员最低质押
     */
    function setMinFeederStake(uint256 _value) external onlyDAO {
        uint256 oldValue = minFeederStake;
        minFeederStake = _value;
        emit ParameterUpdated("minFeederStake", oldValue, _value, block.timestamp);
    }

    // ==================== 地址设置函数 ====================

    /**
     * @notice 设置 USDT 地址
     */
    function setUsdtAddress(address _address) external onlyDAO {
        address oldAddress = usdtAddress;
        usdtAddress = _address;
        emit AddressUpdated("usdtAddress", oldAddress, _address, block.timestamp);
    }

    /**
     * @notice 设置 VaultManager 地址
     */
    function setVaultManagerAddress(address _address) external onlyDAO {
        address oldAddress = vaultManagerAddress;
        vaultManagerAddress = _address;
        emit AddressUpdated("vaultManagerAddress", oldAddress, _address, block.timestamp);
    }

    /**
     * @notice 设置 OptionsCore 地址
     */
    function setOptionsCoreAddress(address _address) external onlyDAO {
        address oldAddress = optionsCoreAddress;
        optionsCoreAddress = _address;
        emit AddressUpdated("optionsCoreAddress", oldAddress, _address, block.timestamp);
    }

    /**
     * @notice 设置 FeedProtocol 地址
     */
    function setFeedProtocolAddress(address _address) external onlyDAO {
        address oldAddress = feedProtocolAddress;
        feedProtocolAddress = _address;
        emit AddressUpdated("feedProtocolAddress", oldAddress, _address, block.timestamp);
    }

    /**
     * @notice 设置 SeatManager 地址
     */
    function setSeatManagerAddress(address _address) external onlyDAO {
        address oldAddress = seatManagerAddress;
        seatManagerAddress = _address;
        emit AddressUpdated("seatManagerAddress", oldAddress, _address, block.timestamp);
    }

    /**
     * @notice 设置 PointsManager 地址
     */
    function setPointsManagerAddress(address _address) external onlyDAO {
        address oldAddress = pointsManagerAddress;
        pointsManagerAddress = _address;
        emit AddressUpdated("pointsManagerAddress", oldAddress, _address, block.timestamp);
    }

    // ==================== 查询函数 ====================

    /**
     * @notice 获取喂价费用
     * @param tier 喂价档位 (0=5-3, 1=7-5, 2=10-7)
     */
    function getFeedFee(uint8 tier) external view returns (uint256) {
        if (tier == 0) return feedFee_5_3;
        if (tier == 1) return feedFee_7_5;
        if (tier == 2) return feedFee_10_7;
        revert("Config: invalid feed tier");
    }

    /**
     * @notice 获取追保截止时间
     * @param isCrypto 是否为加密货币/外汇
     */
    function getMarginCallDeadline(bool isCrypto) external view returns (uint256) {
        return isCrypto ? cryptoMarginCallDeadline : defaultMarginCallDeadline;
    }

    /**
     * @notice 获取仲裁窗口
     * @param isSettlement 是否为平仓结算
     */
    function getArbitrationWindow(bool isSettlement) external view returns (uint256) {
        return isSettlement ? settlementArbitrationWindow : defaultArbitrationWindow;
    }

    // ==================== NST 折扣函数 (P1) ====================

    /**
     * @notice 计算 NST 折扣后的费用
     * @param originalFee 原始费用
     * @return 折扣后的费用（使用 NST 支付时为 80%）
     */
    function getDiscountedFee(uint256 originalFee) external view returns (uint256) {
        if (!nstDiscountEnabled) {
            return originalFee;
        }
        // nstDiscountRate = 8000 表示 80%
        return (originalFee * nstDiscountRate) / 10000;
    }

    /**
     * @notice 设置 NST 折扣率
     * @param _rate 折扣率（基点，8000 = 80%）
     */
    function setNstDiscountRate(uint256 _rate) external onlyDAO {
        require(_rate > 0 && _rate <= 10000, "Config: invalid discount rate");
        uint256 oldValue = nstDiscountRate;
        nstDiscountRate = _rate;
        emit ParameterUpdated("nstDiscountRate", oldValue, _rate, block.timestamp);
    }

    /**
     * @notice 启用/禁用 NST 折扣
     */
    function setNstDiscountEnabled(bool _enabled) external onlyDAO {
        nstDiscountEnabled = _enabled;
    }
}
