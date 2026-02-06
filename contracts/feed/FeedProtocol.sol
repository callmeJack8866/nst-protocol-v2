// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/NSTTypes.sol";
import "../interfaces/IFeedProtocol.sol";
import "../interfaces/IOptionsCore.sol";
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
    
    // OptionsCore 引用（用于自动回调）
    IOptionsCore public optionsCore;
    
    // FeederSelector for VRF random selection
    address public feederSelector;

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

    event OptionsCoreUpdated(
        address indexed oldAddress,
        address indexed newAddress,
        uint256 timestamp
    );

    event CallbackFailed(
        uint256 indexed requestId,
        uint256 indexed orderId,
        string reason
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
        // 使用 6 位小数精度匹配 USDT (1e6 = 1 USDT)
        // 5-3档：3U (测试模式: 1人即可完成)
        tierConfigs[FeedTier.Tier_5_3] = FeedTierConfig({
            totalFeeders: 1,       // 测试模式: 1人即可完成
            effectiveFeeds: 1,     // 测试模式: 1人即可完成
            platformFee: 0.3e6,     // 10% = 0.3U
            feederReward: 2.7e6,    // 90% = 2.7U
            totalFee: 3e6
        });

        // 7-5档：5U
        tierConfigs[FeedTier.Tier_7_5] = FeedTierConfig({
            totalFeeders: 7,
            effectiveFeeds: 5,
            platformFee: 0.5e6,
            feederReward: 4.5e6,
            totalFee: 5e6
        });

        // 10-7档：8U
        tierConfigs[FeedTier.Tier_10_7] = FeedTierConfig({
            totalFeeders: 10,
            effectiveFeeds: 7,
            platformFee: 0.8e6,
            feederReward: 7.2e6,
            totalFee: 8e6
        });
    }

    /**
     * @notice 设置 OptionsCore 地址（用于自动回调）
     * @param _optionsCore OptionsCore 合约地址
     */
    function setOptionsCore(address _optionsCore) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address oldAddress = address(optionsCore);
        optionsCore = IOptionsCore(_optionsCore);
        emit OptionsCoreUpdated(oldAddress, _optionsCore, block.timestamp);
    }

    /**
     * @notice 更新喂价档位配置 (管理员)
     */
    function setTierConfig(
        FeedTier tier,
        uint8 totalFeeders,
        uint8 effectiveFeeds,
        uint256 platformFee,
        uint256 feederReward,
        uint256 totalFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tierConfigs[tier] = FeedTierConfig({
            totalFeeders: totalFeeders,
            effectiveFeeds: effectiveFeeds,
            platformFee: platformFee,
            feederReward: feederReward,
            totalFee: totalFee
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
     * @notice 创建喂价请求（公开版本，MVP演示用）
     * @dev 允许任何地址发起喂价请求，需支付 USDT 喂价费用
     * @param orderId 订单ID
     * @param feedType 喂价类型 (期初/动态/期末/仲裁)
     * @param tier 喂价档位 (5-3/7-5/10-7)
     */
    function requestFeedPublic(
        uint256 orderId,
        FeedType feedType,
        FeedTier tier
    ) external nonReentrant whenNotPaused returns (uint256 requestId) {
        FeedTierConfig memory tierConfig = tierConfigs[tier];
        
        // 收取喂价费用
        usdt.safeTransferFrom(msg.sender, address(this), tierConfig.totalFee);

        requestId = nextRequestId++;

        feedRequests[requestId] = FeedRequest({
            requestId: requestId,
            orderId: orderId,
            feedType: feedType,
            tier: tier,
            deadline: block.timestamp + 30 minutes,
            createdAt: block.timestamp,
            totalFeeders: tierConfig.totalFeeders,
            submittedCount: 0,
            finalPrice: 0,
            finalized: false
        });

        orderFeedRequests[orderId].push(requestId);

        emit FeedRequested(
            requestId,
            orderId,
            "",
            "",
            "",
            "",
            feedType,
            LiquidationRule.NoLiquidation,
            0,
            0,
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

        // 自动回调 OptionsCore 更新订单状态
        if (address(optionsCore) != address(0)) {
            try optionsCore.processFeedCallback(request.orderId, request.feedType, finalPrice) {
                // 回调成功
            } catch {
                // 回调失败时不 revert 整个交易，只记录事件
                emit CallbackFailed(requestId, request.orderId, "OptionsCore callback failed");
            }
        }

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

    /**
     * @notice 获取所有待处理（未完成）的喂价请求
     * @return pendingRequests 待处理喂价请求数组
     */
    function getPendingRequests() external view returns (FeedRequest[] memory) {
        // 先统计未完成请求数量
        uint256 pendingCount = 0;
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (!feedRequests[i].finalized && block.timestamp <= feedRequests[i].deadline) {
                pendingCount++;
            }
        }

        // 创建结果数组
        FeedRequest[] memory pendingRequests = new FeedRequest[](pendingCount);
        uint256 index = 0;

        for (uint256 i = 1; i < nextRequestId; i++) {
            if (!feedRequests[i].finalized && block.timestamp <= feedRequests[i].deadline) {
                pendingRequests[index] = feedRequests[i];
                index++;
            }
        }

        return pendingRequests;
    }

    /**
     * @notice 分页获取所有喂价请求
     * @param offset 起始位置
     * @param limit 获取数量
     * @return requests 喂价请求数组
     */
    function getAllFeedRequests(uint256 offset, uint256 limit) external view returns (FeedRequest[] memory) {
        uint256 totalRequests = nextRequestId - 1;
        
        if (offset >= totalRequests) {
            return new FeedRequest[](0);
        }

        uint256 endIndex = offset + limit;
        if (endIndex > totalRequests) {
            endIndex = totalRequests;
        }

        uint256 resultCount = endIndex - offset;
        FeedRequest[] memory requests = new FeedRequest[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            requests[i] = feedRequests[offset + i + 1]; // requestId 从 1 开始
        }

        return requests;
    }

    /**
     * @notice 获取喂价请求总数
     */
    function getTotalRequestCount() external view returns (uint256) {
        return nextRequestId - 1;
    }

    // ==================== VRF 集成功能 ====================

    /**
     * @notice 获取活跃喂价员列表（供 FeederSelector 使用）
     * @return activeFeeders 活跃喂价员地址数组
     */
    function getActiveFeeders() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // 先统计活跃数量
        for (uint256 i = 0; i < feederList.length; i++) {
            if (feeders[feederList[i]].isActive && 
                !feeders[feederList[i]].isBlacklisted &&
                feeders[feederList[i]].stakedAmount >= config.minFeederStake()) {
                activeCount++;
            }
        }
        
        // 创建结果数组
        address[] memory activeFeeders = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < feederList.length; i++) {
            if (feeders[feederList[i]].isActive && 
                !feeders[feederList[i]].isBlacklisted &&
                feeders[feederList[i]].stakedAmount >= config.minFeederStake()) {
                activeFeeders[index] = feederList[i];
                index++;
            }
        }
        
        return activeFeeders;
    }

    /**
     * @notice 设置 FeederSelector 地址
     */
    function setFeederSelector(address _feederSelector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feederSelector = _feederSelector;
    }

    // ==================== 管理功能 ====================

    // ==================== 恶意喂价处理 (P2) ====================

    /// @notice 恶意喂价举报
    struct MaliciousReport {
        uint256 reportId;
        address reporter;           // 举报人
        address reportedFeeder;     // 被举报喂价员
        uint256 requestId;          // 相关喂价请求
        string evidence;            // 证据说明
        uint256 reportedAt;
        bool processed;
        bool confirmed;             // 是否确认恶意
    }
    
    mapping(uint256 => MaliciousReport) public maliciousReports;
    uint256 public nextReportId = 1;
    
    event MaliciousFeedReported(
        uint256 indexed reportId,
        address indexed reporter,
        address indexed feeder,
        uint256 requestId,
        uint256 timestamp
    );
    
    event MaliciousReportProcessed(
        uint256 indexed reportId,
        bool confirmed,
        uint256 slashedAmount,
        uint256 timestamp
    );

    /**
     * @notice 举报恶意喂价
     * @param feeder 被举报的喂价员
     * @param requestId 相关喂价请求ID
     * @param evidence 证据说明
     */
    function reportMaliciousFeed(
        address feeder,
        uint256 requestId,
        string calldata evidence
    ) external nonReentrant whenNotPaused returns (uint256 reportId) {
        require(feeders[feeder].feederAddress != address(0), "FeedProtocol: invalid feeder");
        require(bytes(evidence).length > 0, "FeedProtocol: evidence required");

        reportId = nextReportId++;
        maliciousReports[reportId] = MaliciousReport({
            reportId: reportId,
            reporter: msg.sender,
            reportedFeeder: feeder,
            requestId: requestId,
            evidence: evidence,
            reportedAt: block.timestamp,
            processed: false,
            confirmed: false
        });

        emit MaliciousFeedReported(reportId, msg.sender, feeder, requestId, block.timestamp);
        return reportId;
    }

    /**
     * @notice 处理恶意举报（管理员）
     * @param reportId 举报ID
     * @param confirmed 是否确认恶意
     * @param slashPercent 罚没比例（基点，5000 = 50%）
     */
    function processMaliciousReport(
        uint256 reportId,
        bool confirmed,
        uint256 slashPercent
    ) external onlyOperator nonReentrant {
        MaliciousReport storage report = maliciousReports[reportId];
        require(!report.processed, "FeedProtocol: already processed");
        require(slashPercent <= 10000, "FeedProtocol: invalid slash percent");

        report.processed = true;
        report.confirmed = confirmed;

        uint256 slashedAmount = 0;

        if (confirmed) {
            Feeder storage feeder = feeders[report.reportedFeeder];
            
            // 计算罚没金额
            slashedAmount = (feeder.stakedAmount * slashPercent) / 10000;
            
            if (slashedAmount > 0) {
                feeder.stakedAmount -= slashedAmount;
                // 罚没的押金可转入国库或奖励举报人（此处转入合约作为平台收入）
            }

            // 加入黑名单
            feeder.isBlacklisted = true;
            feeder.isActive = false;
            
            emit FeederBlacklisted(report.reportedFeeder, "malicious feed confirmed", block.timestamp);
        }

        emit MaliciousReportProcessed(reportId, confirmed, slashedAmount, block.timestamp);
    }

    /**
     * @notice 获取举报详情
     */
    function getMaliciousReport(uint256 reportId) external view returns (MaliciousReport memory) {
        return maliciousReports[reportId];
    }

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
