// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../core/Config.sol";

/**
 * @title FeederSelector
 * @notice 使用 Chainlink VRF V2.5 随机选择喂价员
 * @dev 从合格的喂价员列表中随机抽取指定数量的喂价员
 */
contract FeederSelector is VRFConsumerBaseV2Plus, AccessControl {
    // ==================== 角色定义 ====================
    bytes32 public constant SELECTOR_OPERATOR_ROLE = keccak256("SELECTOR_OPERATOR_ROLE");
    bytes32 public constant FEED_PROTOCOL_ROLE = keccak256("FEED_PROTOCOL_ROLE");

    // ==================== VRF 配置 ====================
    
    /// @notice BSC Mainnet VRF Coordinator
    /// BSC Testnet: 0x6A2AAd07396B36Fe02a22b33cf443582f682c82f
    /// BSC Mainnet: 0xDA3b641D438362C440Ac5458c57e00a712b66700
    
    uint256 public s_subscriptionId;
    bytes32 public s_keyHash;
    uint32 public s_callbackGasLimit = 500000;
    uint16 public s_requestConfirmations = 3;

    // ==================== 状态变量 ====================
    Config public config;

    // 选择请求
    struct SelectionRequest {
        uint256 requestId;          // VRF 请求ID
        uint256 feedRequestId;      // 对应的喂价请求ID
        address[] candidates;       // 候选喂价员列表
        uint8 numToSelect;          // 需要选择的数量
        address[] selectedFeeders;  // 选中的喂价员
        bool fulfilled;             // 是否已完成
        uint256 createdAt;
    }

    mapping(uint256 => SelectionRequest) public selectionRequests;
    mapping(uint256 => uint256) public vrfRequestToSelection;  // VRF requestId => selectionId
    uint256 public nextSelectionId = 1;

    // 最近的选择结果（供查询）
    mapping(uint256 => address[]) public feedRequestSelectedFeeders;

    // ==================== 事件 ====================
    event SelectionRequested(
        uint256 indexed selectionId,
        uint256 indexed feedRequestId,
        uint256 vrfRequestId,
        uint8 numToSelect,
        uint256 candidateCount,
        uint256 timestamp
    );

    event SelectionFulfilled(
        uint256 indexed selectionId,
        uint256 indexed feedRequestId,
        address[] selectedFeeders,
        uint256 timestamp
    );

    event VRFConfigUpdated(
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint256 timestamp
    );

    // ==================== 构造函数 ====================
    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        address _config,
        address _admin
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        s_subscriptionId = _subscriptionId;
        s_keyHash = _keyHash;
        config = Config(_config);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(SELECTOR_OPERATOR_ROLE, _admin);
    }

    // ==================== 修改器 ====================
    modifier onlyOperator() {
        require(hasRole(SELECTOR_OPERATOR_ROLE, msg.sender), "FeederSelector: not operator");
        _;
    }

    modifier onlyFeedProtocol() {
        require(hasRole(FEED_PROTOCOL_ROLE, msg.sender), "FeederSelector: not feed protocol");
        _;
    }

    // ==================== 核心功能 ====================

    /**
     * @notice 请求随机选择喂价员
     * @param feedRequestId 喂价请求ID
     * @param candidates 候选喂价员列表
     * @param numToSelect 需要选择的数量
     * @return selectionId 选择请求ID
     */
    function requestRandomSelection(
        uint256 feedRequestId,
        address[] calldata candidates,
        uint8 numToSelect
    ) external onlyFeedProtocol returns (uint256 selectionId) {
        require(candidates.length >= numToSelect, "FeederSelector: not enough candidates");
        require(numToSelect > 0, "FeederSelector: must select at least one");

        selectionId = nextSelectionId++;

        // 如果候选人数量等于需要选择的数量，直接返回全部
        if (candidates.length == numToSelect) {
            address[] memory selected = new address[](numToSelect);
            for (uint256 i = 0; i < numToSelect; i++) {
                selected[i] = candidates[i];
            }
            
            selectionRequests[selectionId] = SelectionRequest({
                requestId: 0,
                feedRequestId: feedRequestId,
                candidates: candidates,
                numToSelect: numToSelect,
                selectedFeeders: selected,
                fulfilled: true,
                createdAt: block.timestamp
            });

            feedRequestSelectedFeeders[feedRequestId] = selected;

            emit SelectionFulfilled(selectionId, feedRequestId, selected, block.timestamp);
            return selectionId;
        }

        // 请求 VRF 随机数
        uint256 vrfRequestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: s_requestConfirmations,
                callbackGasLimit: s_callbackGasLimit,
                numWords: 1,  // 只需要一个随机数作为种子
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        // 存储候选人列表（需要复制）
        address[] memory candidatesCopy = new address[](candidates.length);
        for (uint256 i = 0; i < candidates.length; i++) {
            candidatesCopy[i] = candidates[i];
        }

        selectionRequests[selectionId] = SelectionRequest({
            requestId: vrfRequestId,
            feedRequestId: feedRequestId,
            candidates: candidatesCopy,
            numToSelect: numToSelect,
            selectedFeeders: new address[](0),
            fulfilled: false,
            createdAt: block.timestamp
        });

        vrfRequestToSelection[vrfRequestId] = selectionId;

        emit SelectionRequested(
            selectionId,
            feedRequestId,
            vrfRequestId,
            numToSelect,
            candidates.length,
            block.timestamp
        );

        return selectionId;
    }

    /**
     * @notice VRF 回调函数 - 处理随机数结果
     * @dev 由 VRF Coordinator 调用
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        uint256 selectionId = vrfRequestToSelection[requestId];
        require(selectionId > 0, "FeederSelector: unknown request");
        
        SelectionRequest storage request = selectionRequests[selectionId];
        require(!request.fulfilled, "FeederSelector: already fulfilled");

        uint256 randomSeed = randomWords[0];
        address[] memory selected = _selectFromCandidates(
            request.candidates,
            request.numToSelect,
            randomSeed
        );

        request.selectedFeeders = selected;
        request.fulfilled = true;

        feedRequestSelectedFeeders[request.feedRequestId] = selected;

        emit SelectionFulfilled(
            selectionId,
            request.feedRequestId,
            selected,
            block.timestamp
        );
    }

    /**
     * @notice 使用 Fisher-Yates 洗牌算法选择
     * @param candidates 候选人列表
     * @param numToSelect 需要选择的数量
     * @param randomSeed 随机种子
     */
    function _selectFromCandidates(
        address[] memory candidates,
        uint8 numToSelect,
        uint256 randomSeed
    ) internal pure returns (address[] memory) {
        address[] memory selected = new address[](numToSelect);
        uint256 n = candidates.length;

        // 复制候选人数组以进行洗牌
        address[] memory shuffled = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            shuffled[i] = candidates[i];
        }

        // Fisher-Yates 洗牌（只需要洗前 numToSelect 个）
        for (uint256 i = 0; i < numToSelect; i++) {
            // 生成 [i, n-1] 范围内的随机索引
            uint256 j = i + (uint256(keccak256(abi.encodePacked(randomSeed, i))) % (n - i));
            
            // 交换 shuffled[i] 和 shuffled[j]
            address temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;

            selected[i] = shuffled[i];
        }

        return selected;
    }

    // ==================== 查询功能 ====================

    /**
     * @notice 获取选择请求详情
     */
    function getSelectionRequest(uint256 selectionId) external view returns (
        uint256 requestId,
        uint256 feedRequestId,
        uint8 numToSelect,
        address[] memory selectedFeeders,
        bool fulfilled,
        uint256 createdAt
    ) {
        SelectionRequest storage request = selectionRequests[selectionId];
        return (
            request.requestId,
            request.feedRequestId,
            request.numToSelect,
            request.selectedFeeders,
            request.fulfilled,
            request.createdAt
        );
    }

    /**
     * @notice 获取喂价请求对应的选中喂价员
     */
    function getSelectedFeeders(uint256 feedRequestId) external view returns (address[] memory) {
        return feedRequestSelectedFeeders[feedRequestId];
    }

    /**
     * @notice 检查选择是否已完成
     */
    function isSelectionFulfilled(uint256 selectionId) external view returns (bool) {
        return selectionRequests[selectionId].fulfilled;
    }

    // ==================== 管理功能 ====================

    /**
     * @notice 更新 VRF 订阅ID
     */
    function setSubscriptionId(uint256 subscriptionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_subscriptionId = subscriptionId;
        emit VRFConfigUpdated(subscriptionId, s_keyHash, s_callbackGasLimit, block.timestamp);
    }

    /**
     * @notice 更新 VRF Key Hash
     */
    function setKeyHash(bytes32 keyHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_keyHash = keyHash;
        emit VRFConfigUpdated(s_subscriptionId, keyHash, s_callbackGasLimit, block.timestamp);
    }

    /**
     * @notice 更新回调 Gas 限制
     */
    function setCallbackGasLimit(uint32 gasLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_callbackGasLimit = gasLimit;
        emit VRFConfigUpdated(s_subscriptionId, s_keyHash, gasLimit, block.timestamp);
    }

    /**
     * @notice 更新请求确认数
     */
    function setRequestConfirmations(uint16 confirmations) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_requestConfirmations = confirmations;
    }

    /**
     * @notice 授权 FeedProtocol
     */
    function grantFeedProtocolRole(address feedProtocol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(FEED_PROTOCOL_ROLE, feedProtocol);
    }

    /**
     * @notice 更新 Config
     */
    function setConfig(address _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = Config(_config);
    }
}
