// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/NSTTypes.sol";
import "../interfaces/IFeedProtocol.sol";
import "../core/Config.sol";

/**
 * @title FeedProtocol
 * @notice 独立喂价协议 - 喂价请求、喂价提交、结果聚合
 * @dev 与期权协议完全分离，可服务于多种协议
 */
contract FeedProtocol is IFeedProtocol, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant FEED_OPERATOR_ROLE = keccak256("FEED_OPERATOR_ROLE");
    bytes32 public constant PROTOCOL_ROLE = keccak256("PROTOCOL_ROLE");  // 可调用的协议合约
    bytes32 public constant SENIOR_FEEDER_ROLE = keccak256("SENIOR_FEEDER_ROLE");  // 高级喂价员（仲裁用）

    // ==================== 状态变量 ====================
    Config public config;
    IERC20 public usdt;

    uint256 public nextRequestId = 1;

    // 喂价请求存储
    mapping(uint256 => FeedRequest) public feedRequests;
    
    // 喂价请求的提交记录
    struct FeedSubmission {
        address feeder;
        uint256 price;
        uint256 timestamp;
        bool isValid;
    }
    mapping(uint256 => FeedSubmission[]) public requestSubmissions;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;

    // 喂价员注册
    struct Feeder {
        address feederAddress;
        uint256 stakedAmount;
        uint256 completedFeeds;
        uint256 rejectedFeeds;
        uint256 registeredAt;
        bool isActive;
        bool isBlacklisted;
    }
    mapping(address => Feeder) public feeders;
    address[] public feederList;

    // 喂价档位配置
    struct FeedTierConfig {
        uint8 totalFeeders;
        uint8 effectiveFeeds;
        uint256 platformFee;
        uint256 feederReward;
        uint256 totalFee;
    }
    mapping(FeedTier => FeedTierConfig) public tierConfigs;

    // 订单关联的喂价请求
    mapping(uint256 => uint256[]) public orderFeedRequests;

    // ==================== 事件 ====================
    event FeederRegistered(
        address indexed feeder,
        uint256 stakedAmount,
        uint256 timestamp
    );

    event FeederDeactivated(
        address indexed feeder,
        string reason,
        uint256 timestamp
    );

    event FeederBlacklisted(
        address indexed feeder,
        string reason,
        uint256 timestamp
    );

    event RewardDistributed(
        uint256 indexed requestId,
        address indexed feeder,
        uint256 amount,
        uint256 timestamp
    );

    // ==================== 构造函数 ====================
    constructor(
        address _config,
        address _usdt,
        address _admin
    ) {
        config = Config(_config);
        usdt = IERC20(_usdt);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(FEED_OPERATOR_ROLE, _admin);

        // 初始化喂价档位配置
        _initTierConfigs();
    }

    function _initTierConfigs() internal {
        // 5-3档：3U
        tierConfigs[FeedTier.Tier_5_3] = FeedTierConfig({
            totalFeeders: 5,
            effectiveFeeds: 3,
            platformFee: 0.3 ether,     // 10% = 0.3U
            feederReward: 2.7 ether,    // 90% = 2.7U
            totalFee: 3 ether
        });

        // 7-5档：5U
        tierConfigs[FeedTier.Tier_7_5] = FeedTierConfig({
            totalFeeders: 7,
            effectiveFeeds: 5,
            platformFee: 0.5 ether,
            feederReward: 4.5 ether,
            totalFee: 5 ether
        });

        // 10-7档：8U
        tierConfigs[FeedTier.Tier_10_7] = FeedTierConfig({
            totalFeeders: 10,
            effectiveFeeds: 7,
            platformFee: 0.8 ether,
            feederReward: 7.2 ether,
            totalFee: 8 ether
        });
    }

    // ==================== 修改器 ====================
    modifier onlyOperator() {
        require(hasRole(FEED_OPERATOR_ROLE, msg.sender), "FeedProtocol: not operator");
        _;
    }

    modifier onlyProtocol() {
        require(hasRole(PROTOCOL_ROLE, msg.sender), "FeedProtocol: not authorized protocol");
        _;
    }

    modifier onlyActiveFeeder() {
        require(feeders[msg.sender].isActive, "FeedProtocol: not active feeder");
        require(!feeders[msg.sender].isBlacklisted, "FeedProtocol: feeder blacklisted");
        require(
            feeders[msg.sender].stakedAmount >= config.minFeederStake(),
            "FeedProtocol: insufficient stake"
        );
        _;
    }

    modifier validRequest(uint256 requestId) {
        require(requestId > 0 && requestId < nextRequestId, "FeedProtocol: invalid request");
        _;
    }

    // ==================== 喂价员注册 ====================

    /**
     * @notice 注册为喂价员
     * @param stakeAmount 质押金额（最低100U）
     */
    function registerFeeder(uint256 stakeAmount) external nonReentrant whenNotPaused {
        require(feeders[msg.sender].feederAddress == address(0), "FeedProtocol: already registered");
        require(stakeAmount >= config.minFeederStake(), "FeedProtocol: insufficient stake");

        usdt.safeTransferFrom(msg.sender, address(this), stakeAmount);

        feeders[msg.sender] = Feeder({
            feederAddress: msg.sender,
            stakedAmount: stakeAmount,
            completedFeeds: 0,
            rejectedFeeds: 0,
            registeredAt: block.timestamp,
            isActive: true,
            isBlacklisted: false
        });

        feederList.push(msg.sender);

        emit FeederRegistered(msg.sender, stakeAmount, block.timestamp);
    }

    /**
     * @notice 追加质押
     */
    function addStake(uint256 amount) external nonReentrant whenNotPaused {
        require(feeders[msg.sender].feederAddress != address(0), "FeedProtocol: not registered");
        
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        feeders[msg.sender].stakedAmount += amount;
    }

    /**
     * @notice 提取质押（需无进行中的喂价任务）
     */
    function withdrawStake(uint256 amount) external nonReentrant whenNotPaused {
        Feeder storage feeder = feeders[msg.sender];
        require(feeder.stakedAmount >= amount, "FeedProtocol: insufficient stake");
        require(
            feeder.stakedAmount - amount >= config.minFeederStake() || amount == feeder.stakedAmount,
            "FeedProtocol: must maintain min stake or withdraw all"
        );

        feeder.stakedAmount -= amount;
        if (feeder.stakedAmount == 0) {
            feeder.isActive = false;
        }
        
        usdt.safeTransfer(msg.sender, amount);
    }

    // ==================== 喂价请求 ====================

    /**
     * @notice 创建喂价请求（由期权协议调用）
     */
    function createFeedRequest(
        uint256 orderId,
        FeedType feedType,
        FeedTier tier
    ) external payable override onlyProtocol nonReentrant returns (uint256 requestId) {
        FeedTierConfig memory tierConfig = tierConfigs[tier];
        
        // 收取喂价费用
        usdt.safeTransferFrom(msg.sender, address(this), tierConfig.totalFee);

        requestId = nextRequestId++;

        feedRequests[requestId] = FeedRequest({
            requestId: requestId,
            orderId: orderId,
            feedType: feedType,
            tier: tier,
            deadline: block.timestamp + 30 minutes,  // 30分钟超时
            createdAt: block.timestamp,
            totalFeeders: tierConfig.totalFeeders,
            submittedCount: 0,
            finalPrice: 0,
            finalized: false
        });

        orderFeedRequests[orderId].push(requestId);

        // 注意：实际的喂价员选择需要 VRF 随机数
        // 这里简化处理，事件触发后由链下服务分配

        emit FeedRequested(
            requestId,
            orderId,
            "",  // underlyingName 需要从订单获取
            "",  // underlyingCode
            "",  // market
            "",  // country
            feedType,
            LiquidationRule.NoLiquidation,
            0,   // consecutiveDays
            0,   // exerciseDelay
            block.timestamp
        );

        return requestId;
    }

    /**
     * @notice 喂价员提交喂价
     */
    function submitFeed(
        uint256 requestId,
        uint256 price
    ) external override validRequest(requestId) onlyActiveFeeder nonReentrant whenNotPaused {
        FeedRequest storage request = feedRequests[requestId];
        require(!request.finalized, "FeedProtocol: already finalized");
        require(block.timestamp <= request.deadline, "FeedProtocol: request expired");
        require(!hasSubmitted[requestId][msg.sender], "FeedProtocol: already submitted");
        require(price > 0, "FeedProtocol: price must be positive");

        hasSubmitted[requestId][msg.sender] = true;
        request.submittedCount++;

        requestSubmissions[requestId].push(FeedSubmission({
            feeder: msg.sender,
            price: price,
            timestamp: block.timestamp,
            isValid: true
        }));

        emit FeedSubmitted(requestId, msg.sender, price, block.timestamp);

        // 检查是否达到所需数量
        if (request.submittedCount >= request.totalFeeders) {
            _finalizeFeed(requestId);
        }
    }

    /**
     * @notice 喂价员拒绝喂价
     */
    function rejectFeed(
        uint256 requestId,
        string calldata reason
    ) external override validRequest(requestId) onlyActiveFeeder nonReentrant whenNotPaused {
        FeedRequest storage request = feedRequests[requestId];
        require(!request.finalized, "FeedProtocol: already finalized");
        require(!hasSubmitted[requestId][msg.sender], "FeedProtocol: already submitted");

        hasSubmitted[requestId][msg.sender] = true;
        feeders[msg.sender].rejectedFeeds++;

        emit FeedRejected(requestId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice 完成喂价聚合（取中间位）
     */
    function finalizeFeed(uint256 requestId) external override returns (uint256 finalPrice) {
        return _finalizeFeed(requestId);
    }

    function _finalizeFeed(uint256 requestId) internal returns (uint256 finalPrice) {
        FeedRequest storage request = feedRequests[requestId];
        require(!request.finalized, "FeedProtocol: already finalized");

        FeedSubmission[] storage submissions = requestSubmissions[requestId];
        require(submissions.length > 0, "FeedProtocol: no submissions");

        // 收集有效价格
        uint256[] memory prices = new uint256[](submissions.length);
        uint256 validCount = 0;
        
        for (uint256 i = 0; i < submissions.length; i++) {
            if (submissions[i].isValid && submissions[i].price > 0) {
                prices[validCount] = submissions[i].price;
                validCount++;
            }
        }

        require(validCount > 0, "FeedProtocol: no valid prices");

        // 排序价格
        for (uint256 i = 0; i < validCount - 1; i++) {
            for (uint256 j = 0; j < validCount - i - 1; j++) {
                if (prices[j] > prices[j + 1]) {
                    uint256 temp = prices[j];
                    prices[j] = prices[j + 1];
                    prices[j + 1] = temp;
                }
            }
        }

        // 取中位数
        if (validCount % 2 == 0) {
            finalPrice = (prices[validCount / 2 - 1] + prices[validCount / 2]) / 2;
        } else {
            finalPrice = prices[validCount / 2];
        }

        request.finalPrice = finalPrice;
        request.finalized = true;

        // 分发奖励
        _distributeRewards(requestId, submissions);

        emit FeedFinalized(requestId, finalPrice, block.timestamp);

        return finalPrice;
    }

    /**
     * @notice 分发喂价奖励
     */
    function _distributeRewards(uint256 requestId, FeedSubmission[] storage submissions) internal {
        FeedRequest storage request = feedRequests[requestId];
        FeedTierConfig memory tierConfig = tierConfigs[request.tier];
        
        uint256 rewardPerFeeder = tierConfig.feederReward / submissions.length;

        for (uint256 i = 0; i < submissions.length; i++) {
            if (submissions[i].isValid) {
                address feeder = submissions[i].feeder;
                usdt.safeTransfer(feeder, rewardPerFeeder);
                feeders[feeder].completedFeeds++;
                
                emit RewardDistributed(requestId, feeder, rewardPerFeeder, block.timestamp);
            }
        }

        // 平台费用保留在合约中
    }

    // ==================== 查询功能 ====================

    function getFeedFee(FeedTier tier) external view override returns (uint256) {
        return tierConfigs[tier].totalFee;
    }

    function getFeedRequest(uint256 requestId) external view returns (FeedRequest memory) {
        return feedRequests[requestId];
    }

    function getFeeder(address feeder) external view returns (Feeder memory) {
        return feeders[feeder];
    }

    function getFeederCount() external view returns (uint256) {
        return feederList.length;
    }

    function getOrderFeedRequests(uint256 orderId) external view returns (uint256[] memory) {
        return orderFeedRequests[orderId];
    }

    function getSubmissions(uint256 requestId) external view returns (FeedSubmission[] memory) {
        return requestSubmissions[requestId];
    }

    // ==================== 管理功能 ====================

    function grantProtocolRole(address protocol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(PROTOCOL_ROLE, protocol);
    }

    function grantSeniorFeederRole(address feeder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(SENIOR_FEEDER_ROLE, feeder);
    }

    function blacklistFeeder(address feeder, string calldata reason) external onlyOperator {
        feeders[feeder].isBlacklisted = true;
        feeders[feeder].isActive = false;
        emit FeederBlacklisted(feeder, reason, block.timestamp);
    }

    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }

    function withdrawPlatformFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 提取平台费用
        uint256 balance = usdt.balanceOf(address(this));
        // 需要减去所有质押金额
        uint256 totalStaked = 0;
        for (uint256 i = 0; i < feederList.length; i++) {
            totalStaked += feeders[feederList[i]].stakedAmount;
        }
        uint256 platformFees = balance > totalStaked ? balance - totalStaked : 0;
        if (platformFees > 0) {
            usdt.safeTransfer(to, platformFees);
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
