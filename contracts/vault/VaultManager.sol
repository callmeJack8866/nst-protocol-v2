// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../core/Config.sol";

/**
 * @title VaultManager
 * @notice 资金池管理合约 - 资金调度与状态执行中枢
 * @dev 只接受授权的合约调用，不直接与用户交互
 */
contract VaultManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== 角色定义 ====================
    bytes32 public constant VAULT_OPERATOR_ROLE = keccak256("VAULT_OPERATOR_ROLE");

    // ==================== 状态变量 ====================
    Config public config;
    
    // 资金池余额
    mapping(address => uint256) public marginPoolBalance;       // 保证金池
    mapping(address => uint256) public profitPoolBalance;       // 生态利润池
    mapping(address => uint256) public lpPoolBalance;           // 代币LP池
    mapping(address => uint256) public interactPoolBalance;     // 合约交互池
    mapping(address => uint256) public donationPoolBalance;     // 捐赠节点池

    // 用户保证金余额
    mapping(address => mapping(address => uint256)) public userMarginBalance;  // user => token => balance

    // ==================== 事件 ====================
    event MarginDeposited(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event MarginWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event MarginTransferred(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        string reason,
        uint256 timestamp
    );

    event FeeCollected(
        address indexed token,
        uint256 amount,
        string feeType,
        uint256 timestamp
    );

    event ProfitDistributed(
        address indexed token,
        uint256 amount,
        string poolType,
        uint256 timestamp
    );

    // ==================== 构造函数 ====================
    constructor(address _config, address _admin) {
        config = Config(_config);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(VAULT_OPERATOR_ROLE, _admin);
    }

    // ==================== 修改器 ====================
    modifier onlyOperator() {
        require(hasRole(VAULT_OPERATOR_ROLE, msg.sender), "VaultManager: caller is not operator");
        _;
    }

    // ==================== 保证金操作 ====================

    /**
     * @notice 存入保证金
     * @param _user 用户地址
     * @param _token 代币地址
     * @param _amount 金额
     */
    function depositMargin(
        address _user,
        address _token,
        uint256 _amount
    ) external onlyOperator nonReentrant whenNotPaused {
        require(_amount > 0, "VaultManager: amount must be greater than 0");
        
        IERC20(_token).safeTransferFrom(_user, address(this), _amount);
        userMarginBalance[_user][_token] += _amount;
        marginPoolBalance[_token] += _amount;

        emit MarginDeposited(_user, _token, _amount, block.timestamp);
    }

    /**
     * @notice 提取保证金
     * @param _user 用户地址
     * @param _token 代币地址
     * @param _amount 金额
     */
    function withdrawMargin(
        address _user,
        address _token,
        uint256 _amount
    ) external onlyOperator nonReentrant whenNotPaused {
        require(_amount > 0, "VaultManager: amount must be greater than 0");
        require(userMarginBalance[_user][_token] >= _amount, "VaultManager: insufficient balance");

        userMarginBalance[_user][_token] -= _amount;
        marginPoolBalance[_token] -= _amount;
        IERC20(_token).safeTransfer(_user, _amount);

        emit MarginWithdrawn(_user, _token, _amount, block.timestamp);
    }

    /**
     * @notice 内部转移保证金（订单结算时使用）
     * @param _from 发送方
     * @param _to 接收方
     * @param _token 代币地址
     * @param _amount 金额
     * @param _reason 转移原因
     */
    function transferMargin(
        address _from,
        address _to,
        address _token,
        uint256 _amount,
        string calldata _reason
    ) external onlyOperator nonReentrant whenNotPaused {
        require(userMarginBalance[_from][_token] >= _amount, "VaultManager: insufficient balance");

        userMarginBalance[_from][_token] -= _amount;
        userMarginBalance[_to][_token] += _amount;

        emit MarginTransferred(_from, _to, _token, _amount, _reason, block.timestamp);
    }

    // ==================== 手续费操作 ====================

    /**
     * @notice 收取手续费
     * @param _user 用户地址
     * @param _token 代币地址
     * @param _amount 金额
     * @param _feeType 费用类型
     */
    function collectFee(
        address _user,
        address _token,
        uint256 _amount,
        string calldata _feeType
    ) external onlyOperator nonReentrant whenNotPaused {
        require(_amount > 0, "VaultManager: amount must be greater than 0");

        IERC20(_token).safeTransferFrom(_user, address(this), _amount);
        profitPoolBalance[_token] += _amount;

        emit FeeCollected(_token, _amount, _feeType, block.timestamp);
    }

    /**
     * @notice 分配利润到各池子
     * @param _token 代币地址
     * @param _amount 总金额
     */
    function distributeProfits(
        address _token,
        uint256 _amount
    ) external onlyOperator nonReentrant whenNotPaused {
        require(profitPoolBalance[_token] >= _amount, "VaultManager: insufficient profit pool");

        profitPoolBalance[_token] -= _amount;

        // 按比例分配
        uint256 nodeReward = (_amount * config.nodeRewardShare()) / 10000;
        uint256 buyback = (_amount * config.tokenBuybackShare()) / 10000;
        uint256 lp = (_amount * config.lpPoolShare()) / 10000;
        // 剩余部分分配给团队、基金会、DAO、成长节点
        // 这里简化处理，实际需要转账到对应地址

        lpPoolBalance[_token] += lp;
        donationPoolBalance[_token] += nodeReward;

        emit ProfitDistributed(_token, _amount, "all", block.timestamp);
    }

    // ==================== 喂价费用操作 ====================

    /**
     * @notice 转移喂价费用到喂价生态
     * @param _token 代币地址
     * @param _amount 金额
     * @param _feedProtocol 喂价协议地址
     */
    function transferToFeedProtocol(
        address _token,
        uint256 _amount,
        address _feedProtocol
    ) external onlyOperator nonReentrant whenNotPaused {
        interactPoolBalance[_token] -= _amount;
        IERC20(_token).safeTransfer(_feedProtocol, _amount);
    }

    // ==================== 查询函数 ====================

    /**
     * @notice 查询用户保证金余额
     */
    function getUserMarginBalance(
        address _user,
        address _token
    ) external view returns (uint256) {
        return userMarginBalance[_user][_token];
    }

    /**
     * @notice 查询总保证金池余额
     */
    function getTotalMarginPool(address _token) external view returns (uint256) {
        return marginPoolBalance[_token];
    }

    /**
     * @notice 查询利润池余额
     */
    function getProfitPoolBalance(address _token) external view returns (uint256) {
        return profitPoolBalance[_token];
    }

    // ==================== 管理函数 ====================

    /**
     * @notice 更新 Config 地址
     */
    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }

    /**
     * @notice 授权操作者角色
     */
    function grantOperatorRole(address _operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VAULT_OPERATOR_ROLE, _operator);
    }

    /**
     * @notice 暂停合约
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice 恢复合约
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
