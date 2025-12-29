/**
 * Contract ABIs - Exported from Hardhat compilation
 * These are minimal ABIs containing only the functions we need for the frontend
 */

// OptionsCore ABI (minimal)
export const OptionsCoreABI = [
    // Read functions
    'function getOrder(uint256 orderId) view returns (tuple(uint256 orderId, address buyer, address seller, string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 strikePrice, uint256 expiryTimestamp, uint256 premiumRate, uint256 premiumAmount, uint256 initialMargin, uint256 currentMargin, uint256 minMarginRate, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint8 exerciseDelay, uint8 sellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment, uint8 feedRule, uint8 status, uint256 createdAt, uint256 matchedAt, uint256 settledAt, uint256 lastFeedPrice))',
    'function getQuote(uint256 quoteId) view returns (tuple(uint256 quoteId, uint256 orderId, address seller, uint8 sellerType, uint256 premiumRate, uint256 premiumAmount, uint256 marginRate, uint256 marginAmount, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint256 createdAt, uint256 expiresAt, uint8 status))',
    'function getBuyerOrders(address buyer) view returns (uint256[])',
    'function getSellerOrders(address seller) view returns (uint256[])',
    'function getOrderQuotes(uint256 orderId) view returns (uint256[])',
    'function nextOrderId() view returns (uint256)',
    'function nextQuoteId() view returns (uint256)',

    // Write functions
    'function createBuyerRFQ(string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 expiryTimestamp, uint256 maxPremiumRate, uint256 minMarginRate, uint8 acceptedSellerType, address designatedSeller, uint256 arbitrationWindow, uint256 marginCallDeadline, bool dividendAdjustment) returns (uint256 orderId)',
    'function createSellerOrder(string underlyingName, string underlyingCode, string market, string country, string refPrice, uint8 direction, uint256 notionalUSDT, uint256 expiryTimestamp, uint256 premiumRate, uint256 marginAmount, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint256 arbitrationWindow, bool dividendAdjustment) returns (uint256 orderId)',
    'function submitQuote(uint256 orderId, uint256 premiumRate, uint256 marginAmount, uint8 liquidationRule, uint8 consecutiveDays, uint8 dailyLimitPercent, uint256 expiresAt) returns (uint256 quoteId)',
    'function acceptQuote(uint256 quoteId)',
    'function cancelRFQ(uint256 orderId)',
    'function addMargin(uint256 orderId, uint256 amount)',
    'function withdrawExcessMargin(uint256 orderId, uint256 amount)',
    'function requestFeed(uint256 orderId, uint8 tier) payable',
    'function earlyExercise(uint256 orderId)',
    'function settle(uint256 orderId)',
    'function initiateArbitration(uint256 orderId)',
    'function forceLiquidate(uint256 orderId)',

    // Events
    'event OrderCreated(uint256 indexed orderId, address indexed creator, bool isBuyerOrder, uint256 timestamp)',
    'event QuoteSubmitted(uint256 indexed orderId, uint256 indexed quoteId, address indexed seller, uint256 premiumRate, uint256 timestamp)',
    'event OrderMatched(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 timestamp)',
    'event OrderSettled(uint256 indexed orderId, int256 buyerPnL, int256 sellerPnL, uint256 timestamp)',
    'event OrderCancelled(uint256 indexed orderId, string reason, uint256 timestamp)',
    'event OrderStatusChanged(uint256 indexed orderId, uint8 oldStatus, uint8 newStatus, string reason, uint256 timestamp)',
    'event MarginChanged(uint256 indexed orderId, address indexed seller, uint256 oldAmount, uint256 newAmount, string changeType, uint256 timestamp)',
] as const;

// FeedProtocol ABI (minimal)
export const FeedProtocolABI = [
    // Read functions
    'function getFeedRequest(uint256 requestId) view returns (tuple(uint256 requestId, uint256 orderId, uint8 feedType, uint8 tier, uint256 deadline, uint256 createdAt, uint256 totalFeeders, uint256 submittedCount, uint256 finalPrice, bool finalized))',
    'function getFeeder(address feeder) view returns (tuple(address feederAddress, uint256 stakedAmount, uint256 completedFeeds, uint256 rejectedFeeds, uint256 registeredAt, bool isActive, bool isBlacklisted))',
    'function getActiveFeeders() view returns (address[])',
    'function getFeedFee(uint8 tier) view returns (uint256)',
    'function getFeederCount() view returns (uint256)',

    // Write functions
    'function registerFeeder(uint256 stakeAmount)',
    'function addStake(uint256 amount)',
    'function withdrawStake(uint256 amount)',
    'function submitFeed(uint256 requestId, uint256 price)',
    'function rejectFeed(uint256 requestId, string reason)',
    'function finalizeFeed(uint256 requestId) returns (uint256 finalPrice)',

    // Events
    'event FeedRequested(uint256 indexed requestId, uint256 indexed orderId, string underlyingName, string underlyingCode, string market, string country, uint8 feedType, uint8 liquidationRule, uint8 consecutiveDays, uint8 exerciseDelay, uint256 timestamp)',
    'event FeedSubmitted(uint256 indexed requestId, address indexed feeder, uint256 price, uint256 timestamp)',
    'event FeedFinalized(uint256 indexed requestId, uint256 finalPrice, uint256 timestamp)',
    'event FeedRejected(uint256 indexed requestId, address indexed feeder, string reason, uint256 timestamp)',
    'event FeederRegistered(address indexed feeder, uint256 stakedAmount, uint256 timestamp)',
] as const;

// PointsManager ABI (minimal)
export const PointsManagerABI = [
    // Read functions
    'function getUserPoints(address user) view returns (tuple(uint256 totalPoints, uint256 claimedPoints, uint256 availablePoints, uint256 lastUpdateTime))',
    'function getAirdrop(uint256 airdropId) view returns (tuple(uint256 airdropId, uint256 totalNSTPool, uint256 startTime, uint256 endTime, uint256 snapshotTotalPoints, bool isFinalized))',
    'function calculateClaimableNST(address user, uint256 airdropId) view returns (uint256)',
    'function currentAirdropId() view returns (uint256)',

    // Write functions  
    'function claimAirdrop(uint256 airdropId)',

    // Events
    'event PointsAdded(address indexed user, uint256 amount, uint256 feeAmount, string feeType, uint256 timestamp)',
    'event AirdropCreated(uint256 indexed airdropId, uint256 totalNSTPool, uint256 startTime, uint256 endTime, uint256 timestamp)',
    'event AirdropClaimed(address indexed user, uint256 indexed airdropId, uint256 pointsUsed, uint256 nstAmount, uint256 timestamp)',
] as const;

// SeatManager ABI (minimal)
export const SeatManagerABI = [
    // Read functions
    'function getSeat(address owner) view returns (tuple(address owner, uint256 depositAmount, uint256 nstStaked, uint256 stakeStartTime, uint256 currentExposure, uint256 maxExposure, bool isActive))',
    'function isSeatActive(address owner) view returns (bool)',
    'function getSeatExposure(address owner) view returns (uint256 current, uint256 max)',

    // Write functions
    'function registerSeat(uint256 depositAmount)',
    'function addDeposit(uint256 amount)',
    'function withdrawDeposit(uint256 amount)',
    'function stakeNST(uint256 amount)',
    'function unstakeNST(uint256 amount)',

    // Events
    'event SeatRegistered(address indexed owner, uint256 depositAmount, uint256 timestamp)',
    'event DepositChanged(address indexed owner, uint256 oldAmount, uint256 newAmount, string changeType, uint256 timestamp)',
    'event NSTStaked(address indexed owner, uint256 amount, uint256 timestamp)',
] as const;

// VaultManager ABI (minimal)
export const VaultManagerABI = [
    // Read functions
    'function getUserBalance(address user) view returns (uint256)',
    'function getPoolBalance(uint8 poolType) view returns (uint256)',
    'function marginPool() view returns (uint256)',
    'function profitPool() view returns (uint256)',

    // Write functions
    'function deposit(uint256 amount)',
    'function withdraw(uint256 amount)',

    // Events
    'event Deposited(address indexed user, uint256 amount, uint256 timestamp)',
    'event Withdrawn(address indexed user, uint256 amount, uint256 timestamp)',
] as const;

// ERC20 ABI (for USDT)
export const ERC20ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;
