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
 * @title SeatManager
 * @notice 席位管理合约 - 席位卖方管理：席位注册、押金、敞口控制
 * @dev 席位押金和最大敞口由后端设定
 */
contract SeatManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant SEAT_OPERATOR_ROLE = keccak256("SEAT_OPERATOR_ROLE");
    bytes32 public constant OPTIONS_CORE_ROLE = keccak256("OPTIONS_CORE_ROLE");

    // ==================== 状态变量 ====================
    Config public config;
    IERC20 public usdt;
    IERC20 public nstToken;

    // 席位存储
    mapping(address => Seat) public seats;
    address[] public seatOwners;

    // ==================== 事件 ====================
    event SeatRegistered(
        address indexed owner,
        uint256 depositAmount,
        uint256 maxExposure,
        uint256 timestamp
    );

    event SeatDeactivated(
        address indexed owner,
        string reason,
        uint256 timestamp
    );

    event SeatReactivated(
        address indexed owner,
        uint256 timestamp
    );

    event DepositUpdated(
        address indexed owner,
        uint256 oldAmount,
        uint256 newAmount,
        uint256 timestamp
    );

    event ExposureUpdated(
        address indexed owner,
        uint256 oldExposure,
        uint256 newExposure,
        bool isIncrease,
        uint256 timestamp
    );

    event NSTStaked(
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );

    event NSTUnstaked(
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );

    event SeatParamsUpdated(
        address indexed owner,
        uint256 depositAmount,
        uint256 maxExposure,
        uint256 timestamp
    );

    // ==================== 构造函数 ====================
    constructor(
        address _config,
        address _usdt,
        address _nstToken,
        address _admin
    ) {
        config = Config(_config);
        usdt = IERC20(_usdt);
        nstToken = IERC20(_nstToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(SEAT_OPERATOR_ROLE, _admin);
    }

    // ==================== 修改器 ====================
    modifier onlyOperator() {
        require(hasRole(SEAT_OPERATOR_ROLE, msg.sender), "SeatManager: caller is not operator");
        _;
    }

    modifier onlyOptionsCore() {
        require(hasRole(OPTIONS_CORE_ROLE, msg.sender), "SeatManager: caller is not OptionsCore");
        _;
    }

    modifier validSeatOwner(address owner) {
        require(seats[owner].owner != address(0), "SeatManager: seat not registered");
        _;
    }

    // ==================== 席位注册 ====================

    /**
     * @notice 注册席位（需要后端设定押金和敞口）
     * @param depositAmount 席位押金（后端设定）
     */
    function registerSeat(uint256 depositAmount) external nonReentrant whenNotPaused {
        require(seats[msg.sender].owner == address(0), "SeatManager: seat already registered");
        require(depositAmount > 0, "SeatManager: deposit must be positive");

        // 收取押金
        usdt.safeTransferFrom(msg.sender, address(this), depositAmount);

        // 创建席位
        seats[msg.sender] = Seat({
            owner: msg.sender,
            depositAmount: depositAmount,
            nstStaked: 0,
            stakeStartTime: 0,
            currentExposure: 0,
            maxExposure: 0,  // 由后端设定
            isActive: true
        });

        seatOwners.push(msg.sender);

        emit SeatRegistered(msg.sender, depositAmount, 0, block.timestamp);
    }

    /**
     * @notice 后端设置席位参数
     * @param seller 卖方地址
     * @param depositAmount 押金金额
     * @param maxExposure 最大敞口
     */
    function setSeatParams(
        address seller,
        uint256 depositAmount,
        uint256 maxExposure
    ) external onlyOperator validSeatOwner(seller) {
        Seat storage seat = seats[seller];
        
        seat.depositAmount = depositAmount;
        seat.maxExposure = maxExposure;

        emit SeatParamsUpdated(seller, depositAmount, maxExposure, block.timestamp);
    }

    // ==================== 押金管理 ====================

    /**
     * @notice 追加押金
     * @param amount 追加金额
     */
    function addDeposit(uint256 amount) external nonReentrant whenNotPaused validSeatOwner(msg.sender) {
        require(amount > 0, "SeatManager: amount must be positive");

        Seat storage seat = seats[msg.sender];
        uint256 oldAmount = seat.depositAmount;

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        seat.depositAmount += amount;

        emit DepositUpdated(msg.sender, oldAmount, seat.depositAmount, block.timestamp);
    }

    /**
     * @notice 提取押金（需确保无敞口）
     * @param amount 提取金额
     */
    function withdrawDeposit(uint256 amount) external nonReentrant whenNotPaused validSeatOwner(msg.sender) {
        Seat storage seat = seats[msg.sender];
        require(seat.currentExposure == 0, "SeatManager: has active exposure");
        require(seat.depositAmount >= amount, "SeatManager: insufficient deposit");

        uint256 oldAmount = seat.depositAmount;
        seat.depositAmount -= amount;
        usdt.safeTransfer(msg.sender, amount);

        emit DepositUpdated(msg.sender, oldAmount, seat.depositAmount, block.timestamp);
    }

    // ==================== 敞口管理 ====================

    /**
     * @notice 更新风险敞口（由 OptionsCore 调用）
     * @param seller 卖方地址
     * @param notional 名义本金
     * @param isAdd 是否增加敞口
     */
    function updateExposure(
        address seller,
        uint256 notional,
        bool isAdd
    ) external onlyOptionsCore validSeatOwner(seller) {
        Seat storage seat = seats[seller];
        uint256 oldExposure = seat.currentExposure;

        if (isAdd) {
            require(
                seat.currentExposure + notional <= seat.maxExposure,
                "SeatManager: exceeds max exposure"
            );
            seat.currentExposure += notional;
        } else {
            require(seat.currentExposure >= notional, "SeatManager: insufficient exposure");
            seat.currentExposure -= notional;
        }

        emit ExposureUpdated(seller, oldExposure, seat.currentExposure, isAdd, block.timestamp);
    }

    // ==================== NST 质押 ====================

    /**
     * @notice 质押 NST（后期功能）
     * @param amount 质押金额
     */
    function stakeNST(uint256 amount) external nonReentrant whenNotPaused validSeatOwner(msg.sender) {
        require(amount > 0, "SeatManager: amount must be positive");
        require(address(nstToken) != address(0), "SeatManager: NST token not set");

        Seat storage seat = seats[msg.sender];

        nstToken.safeTransferFrom(msg.sender, address(this), amount);
        
        if (seat.nstStaked == 0) {
            seat.stakeStartTime = block.timestamp;
        }
        seat.nstStaked += amount;

        emit NSTStaked(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice 解除 NST 质押
     * @param amount 解除金额
     */
    function unstakeNST(uint256 amount) external nonReentrant whenNotPaused validSeatOwner(msg.sender) {
        Seat storage seat = seats[msg.sender];
        require(seat.nstStaked >= amount, "SeatManager: insufficient staked amount");
        require(seat.currentExposure == 0, "SeatManager: has active exposure");

        seat.nstStaked -= amount;
        if (seat.nstStaked == 0) {
            seat.stakeStartTime = 0;
        }
        nstToken.safeTransfer(msg.sender, amount);

        emit NSTUnstaked(msg.sender, amount, block.timestamp);
    }

    // ==================== 席位状态管理 ====================

    /**
     * @notice 停用席位
     * @param owner 席位持有人
     * @param reason 停用原因
     */
    function deactivateSeat(address owner, string calldata reason) external onlyOperator validSeatOwner(owner) {
        seats[owner].isActive = false;
        emit SeatDeactivated(owner, reason, block.timestamp);
    }

    /**
     * @notice 重新激活席位
     * @param owner 席位持有人
     */
    function reactivateSeat(address owner) external onlyOperator validSeatOwner(owner) {
        seats[owner].isActive = true;
        emit SeatReactivated(owner, block.timestamp);
    }

    // ==================== 查询功能 ====================

    /**
     * @notice 检查席位是否有效
     */
    function isValidSeat(address seller) external view returns (bool) {
        Seat storage seat = seats[seller];
        return seat.owner != address(0) && seat.isActive;
    }

    /**
     * @notice 获取席位信息
     */
    function getSeat(address owner) external view returns (Seat memory) {
        return seats[owner];
    }

    /**
     * @notice 获取所有席位持有人
     */
    function getAllSeatOwners() external view returns (address[] memory) {
        return seatOwners;
    }

    /**
     * @notice 获取席位持有人数量
     */
    function getSeatCount() external view returns (uint256) {
        return seatOwners.length;
    }

    /**
     * @notice 检查是否可以承接指定金额的订单
     */
    function canTakeOrder(address seller, uint256 notional) external view returns (bool) {
        Seat storage seat = seats[seller];
        return seat.isActive && 
               seat.currentExposure + notional <= seat.maxExposure;
    }

    // ==================== 管理功能 ====================

    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }

    function setNSTToken(address _nstToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nstToken = IERC20(_nstToken);
    }

    function grantOptionsCoreRole(address _optionsCore) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(OPTIONS_CORE_ROLE, _optionsCore);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
