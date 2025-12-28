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
 * @title PointsManager
 * @notice 积分管理合约 - 手续费积分统计、空投领取
 * @dev 积分规则：1U = 100分
 */
contract PointsManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant POINTS_OPERATOR_ROLE = keccak256("POINTS_OPERATOR_ROLE");
    bytes32 public constant AIRDROP_ADMIN_ROLE = keccak256("AIRDROP_ADMIN_ROLE");

    // ==================== 状态变量 ====================
    Config public config;
    IERC20 public nstToken;

    // 用户积分
    mapping(address => UserPoints) public userPoints;
    address[] public pointsUsers;

    // 空投配置
    struct AirdropConfig {
        uint256 totalPool;          // 本期空投池总量
        uint256 startTime;          // 开始领取时间
        uint256 endTime;            // 结束领取时间
        uint256 totalPointsSnapshot;// 快照时的总积分
        bool isActive;              // 是否激活
        uint256 airdropId;          // 空投期数
    }

    AirdropConfig public currentAirdrop;
    uint256 public airdropCounter;

    // 已领取记录
    mapping(uint256 => mapping(address => bool)) public hasClaimed;  // airdropId => user => claimed
    mapping(uint256 => mapping(address => uint256)) public claimedAmount;  // airdropId => user => amount

    // 积分统计
    uint256 public totalPoints;
    uint256 public totalClaimedPoints;

    // ==================== 事件 ====================
    event PointsAccumulated(
        address indexed user,
        uint256 amount,
        string feeType,
        uint256 timestamp
    );

    event AirdropCreated(
        uint256 indexed airdropId,
        uint256 totalPool,
        uint256 startTime,
        uint256 endTime,
        uint256 timestamp
    );

    event AirdropClaimed(
        address indexed user,
        uint256 indexed airdropId,
        uint256 pointsUsed,
        uint256 tokenAmount,
        uint256 timestamp
    );

    event AirdropEnded(
        uint256 indexed airdropId,
        uint256 totalClaimed,
        uint256 timestamp
    );

    // ==================== 构造函数 ====================
    constructor(
        address _config,
        address _nstToken,
        address _admin
    ) {
        config = Config(_config);
        nstToken = IERC20(_nstToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(POINTS_OPERATOR_ROLE, _admin);
        _grantRole(AIRDROP_ADMIN_ROLE, _admin);
    }

    // ==================== 修改器 ====================
    modifier onlyOperator() {
        require(hasRole(POINTS_OPERATOR_ROLE, msg.sender), "PointsManager: caller is not operator");
        _;
    }

    modifier onlyAirdropAdmin() {
        require(hasRole(AIRDROP_ADMIN_ROLE, msg.sender), "PointsManager: caller is not airdrop admin");
        _;
    }

    // ==================== 积分功能 ====================

    /**
     * @notice 记录用户手续费积分
     * @param user 用户地址
     * @param feeAmount 手续费金额（以最小单位计）
     * @param feeType 费用类型（"creation", "trading", "arbitration"）
     */
    function recordPoints(
        address user,
        uint256 feeAmount,
        string calldata feeType
    ) external onlyOperator {
        uint256 points = (feeAmount * config.pointsMultiplier()) / 1 ether;
        
        if (userPoints[user].lastUpdateTime == 0) {
            // 新用户
            pointsUsers.push(user);
        }

        userPoints[user].totalPoints += points;
        userPoints[user].availablePoints += points;
        userPoints[user].lastUpdateTime = block.timestamp;

        totalPoints += points;

        emit PointsAccumulated(user, points, feeType, block.timestamp);
    }

    /**
     * @notice 查询用户积分
     */
    function getPoints(address user) external view returns (uint256) {
        return userPoints[user].availablePoints;
    }

    /**
     * @notice 获取用户完整积分信息
     */
    function getUserPoints(address user) external view returns (UserPoints memory) {
        return userPoints[user];
    }

    // ==================== 空投功能 ====================

    /**
     * @notice 创建新一期空投
     * @param totalPool 空投代币总量
     * @param startTime 开始时间
     * @param endTime 结束时间
     */
    function createAirdrop(
        uint256 totalPool,
        uint256 startTime,
        uint256 endTime
    ) external onlyAirdropAdmin {
        require(!currentAirdrop.isActive, "PointsManager: previous airdrop still active");
        require(startTime >= block.timestamp, "PointsManager: start time in past");
        require(endTime > startTime, "PointsManager: invalid time range");
        require(totalPool > 0, "PointsManager: pool must be positive");

        // 确保合约有足够的代币
        require(
            nstToken.balanceOf(address(this)) >= totalPool,
            "PointsManager: insufficient token balance"
        );

        airdropCounter++;

        currentAirdrop = AirdropConfig({
            totalPool: totalPool,
            startTime: startTime,
            endTime: endTime,
            totalPointsSnapshot: totalPoints - totalClaimedPoints,
            isActive: true,
            airdropId: airdropCounter
        });

        emit AirdropCreated(airdropCounter, totalPool, startTime, endTime, block.timestamp);
    }

    /**
     * @notice 领取空投
     */
    function claimAirdrop() external nonReentrant whenNotPaused {
        require(currentAirdrop.isActive, "PointsManager: no active airdrop");
        require(block.timestamp >= currentAirdrop.startTime, "PointsManager: airdrop not started");
        require(block.timestamp <= currentAirdrop.endTime, "PointsManager: airdrop ended");
        require(
            !hasClaimed[currentAirdrop.airdropId][msg.sender],
            "PointsManager: already claimed"
        );

        UserPoints storage user = userPoints[msg.sender];
        require(user.availablePoints > 0, "PointsManager: no points to claim");

        // 计算可领取的代币数量
        // 用户可领取 = 用户可用积分 / 总积分快照 * 总空投池
        uint256 claimable = (user.availablePoints * currentAirdrop.totalPool) / 
                            currentAirdrop.totalPointsSnapshot;

        require(claimable > 0, "PointsManager: nothing to claim");

        // 更新状态
        uint256 pointsUsed = user.availablePoints;
        user.claimedPoints += pointsUsed;
        user.availablePoints = 0;
        totalClaimedPoints += pointsUsed;

        hasClaimed[currentAirdrop.airdropId][msg.sender] = true;
        claimedAmount[currentAirdrop.airdropId][msg.sender] = claimable;

        // 发放代币
        nstToken.safeTransfer(msg.sender, claimable);

        emit AirdropClaimed(
            msg.sender,
            currentAirdrop.airdropId,
            pointsUsed,
            claimable,
            block.timestamp
        );
    }

    /**
     * @notice 查询可领取空投数量
     */
    function getClaimableAirdrop(address user) external view returns (uint256) {
        if (!currentAirdrop.isActive) return 0;
        if (block.timestamp < currentAirdrop.startTime) return 0;
        if (block.timestamp > currentAirdrop.endTime) return 0;
        if (hasClaimed[currentAirdrop.airdropId][user]) return 0;
        if (currentAirdrop.totalPointsSnapshot == 0) return 0;

        uint256 availablePoints = userPoints[user].availablePoints;
        if (availablePoints == 0) return 0;

        return (availablePoints * currentAirdrop.totalPool) / currentAirdrop.totalPointsSnapshot;
    }

    /**
     * @notice 结束当前空投
     */
    function endAirdrop() external onlyAirdropAdmin {
        require(currentAirdrop.isActive, "PointsManager: no active airdrop");
        require(
            block.timestamp > currentAirdrop.endTime,
            "PointsManager: airdrop not ended yet"
        );

        uint256 totalClaimed = 0;
        for (uint256 i = 0; i < pointsUsers.length; i++) {
            totalClaimed += claimedAmount[currentAirdrop.airdropId][pointsUsers[i]];
        }

        currentAirdrop.isActive = false;

        emit AirdropEnded(currentAirdrop.airdropId, totalClaimed, block.timestamp);
    }

    // ==================== 查询功能 ====================

    /**
     * @notice 获取当前空投配置
     */
    function getCurrentAirdrop() external view returns (AirdropConfig memory) {
        return currentAirdrop;
    }

    /**
     * @notice 获取所有积分用户数量
     */
    function getPointsUserCount() external view returns (uint256) {
        return pointsUsers.length;
    }

    /**
     * @notice 获取用户是否已领取指定期数空投
     */
    function hasClaimedAirdrop(uint256 airdropId, address user) external view returns (bool) {
        return hasClaimed[airdropId][user];
    }

    // ==================== 管理功能 ====================

    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }

    function setNSTToken(address _nstToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nstToken = IERC20(_nstToken);
    }

    function grantOperatorRole(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(POINTS_OPERATOR_ROLE, operator);
    }

    /**
     * @notice 紧急提取剩余空投代币（仅空投结束后）
     */
    function withdrawRemainingTokens(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!currentAirdrop.isActive, "PointsManager: airdrop still active");
        uint256 balance = nstToken.balanceOf(address(this));
        if (balance > 0) {
            nstToken.safeTransfer(to, balance);
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
