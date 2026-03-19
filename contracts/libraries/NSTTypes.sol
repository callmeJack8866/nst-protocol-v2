// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NSTTypes
 * @notice 数据类型定义 - NST Options MVP
 * @dev 定义所有合约共用的数据结构和枚举
 */

/**
 * @notice 订单方向
 */
enum Direction {
    Call,   // 看涨
    Put     // 看跌
}

/**
 * @notice 卖方类型
 */
enum SellerType {
    FreeSeller,         // 自由卖方
    SeatSeller,         // 席位卖方
    DesignatedSeller    // 指定卖方
}

/**
 * @notice 强平规则
 */
enum LiquidationRule {
    NoLiquidation,          // 无强平，到期结算
    ConsecutiveLimitUp,     // 连续涨停板强平（触板/封板）
    ConsecutiveDailyGain    // 连续单日涨幅≥X%强平
}

/**
 * @notice 订单状态
 */
enum OrderStatus {
    RFQ_CREATED,            // 询价已创建
    QUOTING,                // 报价中
    MATCHED,                // 已匹配，待喂价
    WAITING_INITIAL_FEED,   // 待期初喂价
    LIVE,                   // 持仓中
    WAITING_FINAL_FEED,     // 待期末喂价
    PENDING_SETTLEMENT,     // 待结算
    ARBITRATION,            // 仲裁中
    SETTLED,                // 已结算
    LIQUIDATED,             // 已强平
    CANCELLED               // 已取消
}

/**
 * @notice 报价状态
 */
enum QuoteStatus {
    Active,     // 有效
    Accepted,   // 已接受
    Rejected,   // 已拒绝
    Expired     // 已过期
}

/**
 * @notice 喂价类型
 */
enum FeedType {
    Initial,        // 期初喂价
    Dynamic,        // 动态保证金调整喂价
    Final,          // 期末喂价
    Arbitration     // 仲裁喂价
}

/**
 * @notice 喂价档位
 */
enum FeedTier {
    Tier_5_3,   // 5个喂价员，取3个有效
    Tier_7_5,   // 7个喂价员，取5个有效
    Tier_10_7   // 10个喂价员，取7个有效
}

/**
 * @notice 喂价规则
 */
enum FeedRule {
    NormalFeed,         // 正常喂价（市价）
    VolumeBasedFeed     // 跟量成交喂价（需真实成交量支持）
}

/**
 * @notice 订单结构体
 */
struct Order {
    // 基础信息
    uint256 orderId;
    address buyer;
    address seller;
    
    // 标的信息
    string underlyingName;      // 标的名称
    string underlyingCode;      // 标的代码
    string market;              // 市场
    string country;             // 国家
    string refPrice;            // 参考价格
    
    // 合约要素
    Direction direction;        // 看涨/看跌
    uint256 notionalUSDT;       // 名义本金
    uint256 strikePrice;        // 行权价
    uint256 expiryTimestamp;    // 到期时间
    
    // 费率与保证金
    uint256 premiumRate;        // 期权费率（基点）
    uint256 premiumAmount;      // 期权费金额
    uint256 initialMargin;      // 初始保证金
    uint256 currentMargin;      // 当前保证金
    uint256 minMarginRate;      // 最低保证金率（基点）
    uint256 maxPremiumRate;     // 最高期权费率限制（基点，0=不限）
    
    // 平仓规则
    LiquidationRule liquidationRule;
    uint8 consecutiveDays;      // 连续天数
    uint8 dailyLimitPercent;    // 单日涨幅阈值
    uint8 exerciseDelay;        // T+X 行权延迟
    
    // 卖方类型
    SellerType sellerType;
    address designatedSeller;   // 指定卖方地址
    
    // 仲裁与追保配置
    uint256 arbitrationWindow;  // 仲裁窗口
    uint256 marginCallDeadline; // 追保截止时间
    
    // 分红调整
    bool dividendAdjustment;    // 是否调整行权价
    
    // 喂价规则
    FeedRule feedRule;          // 正常喂价/跟量成交喂价
    
    // 状态与时间
    OrderStatus status;
    uint256 createdAt;
    uint256 matchedAt;
    uint256 settledAt;
    uint256 finalFeedRequestedAt; // 终轮喂价请求发起时间（earlyExercise/到期触发时写入）
    uint256 lastFeedPrice;      // 最后一次喂价价格
    uint256 dividendAmount;     // 累计分红金额 (用于调整行权价)
}

/**
 * @notice 报价结构体
 */
struct Quote {
    uint256 quoteId;
    uint256 orderId;
    address seller;
    SellerType sellerType;
    
    uint256 premiumRate;        // 报价费率（基点）
    uint256 premiumAmount;      // 期权费金额
    uint256 marginRate;         // 保证金比例
    uint256 marginAmount;       // 保证金金额
    
    LiquidationRule liquidationRule;
    uint8 consecutiveDays;
    uint8 dailyLimitPercent;
    
    uint256 createdAt;
    uint256 expiresAt;          // 报价有效期
    QuoteStatus status;
}

/**
 * @notice 席位信息结构体
 */
struct Seat {
    address owner;
    uint256 depositAmount;      // 席位押金
    uint256 nstStaked;          // 质押的NST数量
    uint256 stakeStartTime;     // 质押开始时间
    uint256 currentExposure;    // 当前风险敞口
    uint256 maxExposure;        // 最大允许敞口
    bool isActive;
}

/**
 * @notice 喂价请求结构体
 */
struct FeedRequest {
    uint256 requestId;
    uint256 orderId;
    FeedType feedType;
    FeedTier tier;
    uint256 deadline;           // 喂价截止时间
    uint256 createdAt;
    uint256 totalFeeders;       // 需要的喂价员数量
    uint256 submittedCount;     // 已提交数量
    uint256 finalPrice;         // 最终价格
    bool finalized;             // 是否已完成
}

/**
 * @notice 用户积分结构体
 */
struct UserPoints {
    uint256 totalPoints;        // 累计积分
    uint256 claimedPoints;      // 已领取空投的积分
    uint256 availablePoints;    // 可用积分
    uint256 lastUpdateTime;     // 最后更新时间
}
