// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/NSTTypes.sol";
import "../core/Config.sol";

/**
 * @title VolumeBasedFeed
 * @notice 跟量成交喂价合约 - 需要真实市场成交量支持的喂价方式
 * @dev 卖方提交建议价格，喂价员验证后确认/修正/拒绝
 */
contract VolumeBasedFeed is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant FEED_OPERATOR_ROLE = keccak256("FEED_OPERATOR_ROLE");
    bytes32 public constant PROTOCOL_ROLE = keccak256("PROTOCOL_ROLE");
    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");

    // ==================== 数据结构 ====================
    
    /// @notice 跟量成交喂价请求状态
    enum VolumeBasedFeedStatus {
        Pending,        // 待验证
        Approved,       // 验证通过，价格合理
        Rejected,       // 验证拒绝，价格不合理或无成交量
        Modified,       // 喂价员修正价格
        Expired,        // 已过期
        Finalized       // 已完成
    }

    /// @notice 拒绝原因
    enum RejectReason {
        T_PLUS_X_NOT_MET,       // 不符合T+X行权条件
        NO_TRADING_VOLUME,      // 跟量成交无成交量
        MARKET_CLOSED,          // 市场休市
        PRICE_NOT_AVAILABLE,    // 无法获取价格
        PRICE_UNREASONABLE,     // 价格不合理
        OTHER                   // 其他原因
    }

    /// @notice 跟量成交喂价请求
    struct VolumeBasedFeedRequest {
        uint256 requestId;
        uint256 orderId;
        address seller;                 // 卖方地址
        uint256 suggestedPrice;         // 卖方建议成交价格
        string priceEvidence;           // 价格依据说明
        uint256 submittedAt;            // 提交时间
        uint256 deadline;               // 验证截止时间
        
        // 验证结果
        bool isVerified;                // 是否已验证
        address verifiedBy;             // 验证的喂价员地址
        uint256 finalPrice;             // 最终确认价格
        VolumeBasedFeedStatus status;
        
        // 拒绝信息
        RejectReason rejectReason;
        string rejectDescription;       // 拒绝详细说明
        
        // 喂价类型
        FeedType feedType;              // 期初/期末/动态
        bool isInitialFeed;             // 是否为期初喂价（拒绝则取消订单）
    }

    // ==================== 状态变量 ====================
    Config public config;
    IERC20 public usdt;

    uint256 public nextRequestId = 1;

    // 请求存储
    mapping(uint256 => VolumeBasedFeedRequest) public requests;
    
    // 订单关联的跟量成交请求
    mapping(uint256 => uint256[]) public orderVolumeRequests;

    // 验证超时时间（默认30分钟）
    uint256 public verificationTimeout = 30 minutes;

    // ==================== 事件 ====================
    
    /// @notice 卖方提交建议价格
    event SuggestedPriceSubmitted(
        uint256 indexed requestId,
        uint256 indexed orderId,
        address indexed seller,
        uint256 suggestedPrice,
        string priceEvidence,
        FeedType feedType,
        uint256 timestamp
    );

    /// @notice 喂价员验证通过
    event PriceApproved(
        uint256 indexed requestId,
        address indexed feeder,
        uint256 finalPrice,
        uint256 timestamp
    );

    /// @notice 喂价员修正价格
    event PriceModified(
        uint256 indexed requestId,
        address indexed feeder,
        uint256 originalPrice,
        uint256 modifiedPrice,
        string reason,
        uint256 timestamp
    );

    /// @notice 喂价员拒绝
    event PriceRejected(
        uint256 indexed requestId,
        address indexed feeder,
        RejectReason reason,
        string description,
        uint256 timestamp
    );

    /// @notice 请求超时
    event RequestExpired(
        uint256 indexed requestId,
        uint256 timestamp
    );

    /// @notice 重新喂价（平仓订单拒绝后）
    event RefeedRequired(
        uint256 indexed requestId,
        uint256 indexed orderId,
        string reason,
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
    }

    // ==================== 修改器 ====================
    modifier onlyOperator() {
        require(hasRole(FEED_OPERATOR_ROLE, msg.sender), "VolumeBasedFeed: not operator");
        _;
    }

    modifier onlyProtocol() {
        require(hasRole(PROTOCOL_ROLE, msg.sender), "VolumeBasedFeed: not authorized protocol");
        _;
    }

    modifier onlyFeeder() {
        require(hasRole(FEEDER_ROLE, msg.sender), "VolumeBasedFeed: not authorized feeder");
        _;
    }

    modifier validRequest(uint256 requestId) {
        require(requestId > 0 && requestId < nextRequestId, "VolumeBasedFeed: invalid request");
        _;
    }

    modifier requestPending(uint256 requestId) {
        require(
            requests[requestId].status == VolumeBasedFeedStatus.Pending,
            "VolumeBasedFeed: request not pending"
        );
        _;
    }

    // ==================== 卖方功能 ====================

    /**
     * @notice 卖方提交建议价格
     * @param orderId 订单ID
     * @param suggestedPrice 建议成交价格
     * @param priceEvidence 价格依据说明（如：上海黄金交易所实时成交价）
     * @param feedType 喂价类型
     * @param isInitialFeed 是否为期初喂价
     */
    function submitSuggestedPrice(
        uint256 orderId,
        uint256 suggestedPrice,
        string calldata priceEvidence,
        FeedType feedType,
        bool isInitialFeed
    ) external nonReentrant whenNotPaused returns (uint256 requestId) {
        require(suggestedPrice > 0, "VolumeBasedFeed: price must be positive");
        require(bytes(priceEvidence).length > 0, "VolumeBasedFeed: evidence required");

        requestId = nextRequestId++;

        requests[requestId] = VolumeBasedFeedRequest({
            requestId: requestId,
            orderId: orderId,
            seller: msg.sender,
            suggestedPrice: suggestedPrice,
            priceEvidence: priceEvidence,
            submittedAt: block.timestamp,
            deadline: block.timestamp + verificationTimeout,
            isVerified: false,
            verifiedBy: address(0),
            finalPrice: 0,
            status: VolumeBasedFeedStatus.Pending,
            rejectReason: RejectReason.OTHER,
            rejectDescription: "",
            feedType: feedType,
            isInitialFeed: isInitialFeed
        });

        orderVolumeRequests[orderId].push(requestId);

        emit SuggestedPriceSubmitted(
            requestId,
            orderId,
            msg.sender,
            suggestedPrice,
            priceEvidence,
            feedType,
            block.timestamp
        );

        return requestId;
    }

    // ==================== 喂价员功能 ====================

    /**
     * @notice 喂价员验证通过，确认使用卖方建议价格
     * @param requestId 请求ID
     */
    function approvePrice(uint256 requestId) 
        external 
        validRequest(requestId) 
        requestPending(requestId)
        onlyFeeder 
        nonReentrant 
        whenNotPaused 
    {
        VolumeBasedFeedRequest storage request = requests[requestId];
        require(block.timestamp <= request.deadline, "VolumeBasedFeed: request expired");

        request.isVerified = true;
        request.verifiedBy = msg.sender;
        request.finalPrice = request.suggestedPrice;
        request.status = VolumeBasedFeedStatus.Approved;

        emit PriceApproved(requestId, msg.sender, request.finalPrice, block.timestamp);
    }

    /**
     * @notice 喂价员修正价格
     * @param requestId 请求ID
     * @param modifiedPrice 修正后的价格
     * @param reason 修正原因
     */
    function modifyPrice(
        uint256 requestId,
        uint256 modifiedPrice,
        string calldata reason
    ) 
        external 
        validRequest(requestId) 
        requestPending(requestId)
        onlyFeeder 
        nonReentrant 
        whenNotPaused 
    {
        require(modifiedPrice > 0, "VolumeBasedFeed: price must be positive");
        require(bytes(reason).length > 0, "VolumeBasedFeed: reason required");

        VolumeBasedFeedRequest storage request = requests[requestId];
        require(block.timestamp <= request.deadline, "VolumeBasedFeed: request expired");

        uint256 originalPrice = request.suggestedPrice;

        request.isVerified = true;
        request.verifiedBy = msg.sender;
        request.finalPrice = modifiedPrice;
        request.status = VolumeBasedFeedStatus.Modified;

        emit PriceModified(
            requestId,
            msg.sender,
            originalPrice,
            modifiedPrice,
            reason,
            block.timestamp
        );
    }

    /**
     * @notice 喂价员拒绝喂价
     * @param requestId 请求ID
     * @param reason 拒绝原因枚举
     * @param description 详细说明
     */
    function rejectPrice(
        uint256 requestId,
        RejectReason reason,
        string calldata description
    ) 
        external 
        validRequest(requestId) 
        requestPending(requestId)
        onlyFeeder 
        nonReentrant 
        whenNotPaused 
    {
        VolumeBasedFeedRequest storage request = requests[requestId];
        require(block.timestamp <= request.deadline, "VolumeBasedFeed: request expired");

        request.isVerified = true;
        request.verifiedBy = msg.sender;
        request.status = VolumeBasedFeedStatus.Rejected;
        request.rejectReason = reason;
        request.rejectDescription = description;

        emit PriceRejected(requestId, msg.sender, reason, description, block.timestamp);

        // 根据喂价类型处理拒绝后的逻辑
        if (request.isInitialFeed) {
            // 期初订单被拒绝 -> 订单将被自动取消（由 OptionsCore 处理）
        } else {
            // 平仓订单被拒绝 -> 需要重新喂价（改为正常喂价）
            emit RefeedRequired(
                requestId,
                request.orderId,
                "Volume-based feed rejected, requires normal feed",
                block.timestamp
            );
        }
    }

    // ==================== 超时处理 ====================

    /**
     * @notice 标记请求为超时
     * @param requestId 请求ID
     */
    function markExpired(uint256 requestId) 
        external 
        validRequest(requestId) 
        requestPending(requestId)
    {
        VolumeBasedFeedRequest storage request = requests[requestId];
        require(block.timestamp > request.deadline, "VolumeBasedFeed: not expired yet");

        request.status = VolumeBasedFeedStatus.Expired;

        emit RequestExpired(requestId, block.timestamp);
    }

    // ==================== 查询功能 ====================

    /**
     * @notice 获取请求详情
     */
    function getRequest(uint256 requestId) external view returns (VolumeBasedFeedRequest memory) {
        return requests[requestId];
    }

    /**
     * @notice 获取订单的所有跟量成交请求
     */
    function getOrderVolumeRequests(uint256 orderId) external view returns (uint256[] memory) {
        return orderVolumeRequests[orderId];
    }

    /**
     * @notice 获取请求的最终价格（如果已完成）
     */
    function getFinalPrice(uint256 requestId) external view returns (uint256, bool) {
        VolumeBasedFeedRequest storage request = requests[requestId];
        bool isValid = request.status == VolumeBasedFeedStatus.Approved ||
                       request.status == VolumeBasedFeedStatus.Modified;
        return (request.finalPrice, isValid);
    }

    /**
     * @notice 检查请求状态
     */
    function getRequestStatus(uint256 requestId) external view returns (VolumeBasedFeedStatus) {
        return requests[requestId].status;
    }

    /**
     * @notice 检查请求是否已过期
     */
    function isExpired(uint256 requestId) external view returns (bool) {
        VolumeBasedFeedRequest storage request = requests[requestId];
        return block.timestamp > request.deadline && 
               request.status == VolumeBasedFeedStatus.Pending;
    }

    /**
     * @notice 获取拒绝原因的字符串描述
     */
    function getRejectReasonString(RejectReason reason) external pure returns (string memory) {
        if (reason == RejectReason.T_PLUS_X_NOT_MET) return "T+X condition not met";
        if (reason == RejectReason.NO_TRADING_VOLUME) return "No trading volume available";
        if (reason == RejectReason.MARKET_CLOSED) return "Market is closed";
        if (reason == RejectReason.PRICE_NOT_AVAILABLE) return "Price not available";
        if (reason == RejectReason.PRICE_UNREASONABLE) return "Price is unreasonable";
        return "Other reason";
    }

    // ==================== 管理功能 ====================

    /**
     * @notice 设置验证超时时间
     */
    function setVerificationTimeout(uint256 timeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(timeout >= 10 minutes && timeout <= 2 hours, "VolumeBasedFeed: invalid timeout");
        verificationTimeout = timeout;
    }

    /**
     * @notice 授权协议角色
     */
    function grantProtocolRole(address protocol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(PROTOCOL_ROLE, protocol);
    }

    /**
     * @notice 授权喂价员角色
     */
    function grantFeederRole(address feeder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(FEEDER_ROLE, feeder);
    }

    /**
     * @notice 批量授权喂价员
     */
    function grantFeederRoleBatch(address[] calldata feeders) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < feeders.length; i++) {
            grantRole(FEEDER_ROLE, feeders[i]);
        }
    }

    /**
     * @notice 撤销喂价员角色
     */
    function revokeFeederRole(address feeder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(FEEDER_ROLE, feeder);
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
