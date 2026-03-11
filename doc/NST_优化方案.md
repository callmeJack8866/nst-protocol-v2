# NST 项目修改优化方案

> **审核时间**: 2026-03-11  
> **涉及范围**: 合约层、前端、Keeper 系统、与 FeedEngine 交互  
> **执行方**: NST 项目侧（本 AI 执行）

---

## 一、合约层问题与修复

### 1.1 FeedProtocol.requestFeedPublic 事件 emit 空数据 ⚠️ 严重

**文件**: `contracts/feed/FeedProtocol.sol` L360-372

**问题**: `requestFeedPublic` 发出的 `FeedRequested` 事件中，所有关键字段（underlyingName, underlyingCode, market, country）都传了空字符串 `""`。FeedEngine 无法从事件中获取订单信息，必须额外调用 OptionsCore.getOrder() 做回退查询。

**当前代码**:
```solidity
emit FeedRequested(
    requestId, orderId,
    "",  // underlyingName = 空！
    "",  // underlyingCode = 空！
    "",  // market = 空！
    "",  // country = 空！
    feedType, LiquidationRule.NoLiquidation, 0, 0, block.timestamp
);
```

**修复方案**: 从 OptionsCore 读取订单数据填充事件。需要在 `requestFeedPublic` 中添加读取逻辑：

```solidity
// 从 OptionsCore 获取订单信息
IOptionsCore.Order memory order = optionsCore.getOrder(orderId);

emit FeedRequested(
    requestId, orderId,
    order.underlyingName,
    order.underlyingCode,
    order.market,
    order.country,
    feedType,
    order.liquidationRule,
    order.consecutiveDays,
    order.exerciseDelay,
    block.timestamp
);
```

**影响**: 需要重新部署 FeedProtocol 合约，并更新所有引用地址。

---

### 1.2 OptionsCore.requestFeed 与 FeedProtocol.requestFeedPublic 双路径混乱

**文件**: `contracts/core/OptionsCore.sol` L225-258, `contracts/feed/FeedProtocol.sol` L333-375

**问题**: 存在两个发起喂价的入口：
1. `OptionsCore.requestFeed()` — 发出 `FeedRequestEmitted` 事件，同时更新订单状态为 `WAITING_INITIAL_FEED`
2. `FeedProtocol.requestFeedPublic()` — 发出 `FeedRequested` 事件，**但不更新 OptionsCore 订单状态**

前端实际调用的是 `requestFeedPublic`（L186 in useFeedAndPoints.ts），导致：
- OptionsCore 订单状态停留在 `MATCHED`，不会变为 `WAITING_INITIAL_FEED`
- FeedEngine 监听的是 `FeedRequested`，但 Keeper 系统的 `initialFeedKeeper` 可能检测不到正确状态

**修复方案**: 
- **方案 A（推荐）**: 在 `FeedProtocol.requestFeedPublic` 中添加回调，自动更新 OptionsCore 订单状态。需要 FeedProtocol 拥有 OptionsCore 的写入权限。
- **方案 B**: 废弃 `OptionsCore.requestFeed()` 函数，所有喂价请求统一走 FeedProtocol。
- **方案 C（临时）**: 前端在调用 `requestFeedPublic` 后，额外调用 `OptionsCore.requestFeed()` 更新状态（增加一次交易，用户体验差）。

**推荐方案 A 实施步骤**:
1. 给 FeedProtocol 合约添加 `FEED_PROTOCOL_ROLE` 到 OptionsCore
2. 在 `requestFeedPublic` 末尾调用 `optionsCore.updateOrderStatus(orderId, OrderStatus.WAITING_INITIAL_FEED)`

---

### 1.3 processInitialFeedResult 权限配置问题

**文件**: `contracts/core/OptionsCore.sol` L509-521

**问题**: `processInitialFeedResult` 和 `processFinalFeedResult` 都要求 `DEFAULT_ADMIN_ROLE`，而不是 `FEED_PROTOCOL_ROLE`。这意味着只有管理员钱包能调用，不支持 FeedProtocol 自动回调。

而 `processFeedCallback` (L546-575) 使用的是 `FEED_PROTOCOL_ROLE`，但 Keeper 的 `feedResultProcessor.ts` 调用的是 `processInitialFeedResult` 而非 `processFeedCallback`。

**修复方案**: 
- 统一使用 `processFeedCallback` 作为唯一入口
- Keeper `feedResultProcessor.ts` 改为调用 `processFeedCallback` 并使用 FEED_PROTOCOL_ROLE
- 或者将 `processInitialFeedResult` 的权限改为 `FEED_PROTOCOL_ROLE`

---

### 1.4 合约地址不一致 ⚠️ 已确认

**涉及文件**:
- `deployed-addresses.json` — OptionsCore: `0xEcf453...`，FeedProtocol: `0xb61834...`
- `frontend/src/contracts/config.ts` — OptionsCore: `0x98505C...`，FeedProtocol: `0xa4d3d2...`
- `scripts/keeper/utils.ts` — OptionsCore: `0x98505C...`，FeedProtocol: `0xa4d3d2...`

**问题**: `deployed-addresses.json` 存的是旧版合约地址，与前端和 Keeper 使用的地址不一致。

**修复方案**: 更新 `deployed-addresses.json` 与 `config.ts` 保持一致，并使用 .env 统一管理所有地址引用。

---

## 二、前端问题与修复

### 2.1 handleInitiateFeed 硬编码 tier=0 无选择 ⚠️ 用户体验

**文件**: `frontend/src/pages/MyOrders.tsx` L529-543

**问题**: `handleInitiateFeed` 硬编码 `tier=0`（Tier_5_3 最低档），用户无法选择喂价档位。不同档位对应不同的手续费和喂价人数。

**修复方案**: 
1. 添加 **FeedTierSelector 弹窗组件**
2. 点击「发起喂价」后弹出选择面板，显示三个档位的费用和说明
3. 用户选择后再调用 `requestFeed(orderId, feedType, selectedTier)`

**档位配置**:
| Tier | 喂价人数 | 有效喂价 | 说明 |
|------|---------|---------|------|
| Tier_5_3 (0) | 5 人 | 取中间 3 | 基础 |
| Tier_7_5 (1) | 7 人 | 取中间 5 | 标准 |
| Tier_10_7 (2) | 10 人 | 取中间 7 | 高级 |

**实施步骤**:
1. 创建 `frontend/src/components/FeedTierModal.tsx`
2. 修改 `MyOrders.tsx` handleInitiateFeed 打开弹窗
3. 从合约读取每档费用 `getFeedFee(tier)` 显示给用户
4. 添加中英文翻译 key

---

### 2.2 订单状态持久化依赖前端缓存

**文件**: `frontend/src/pages/MyOrders.tsx` L50, L80-102

**问题**: `feedRequestedOrders`（Set<number>）存在 React state 中，页面刷新后通过链上查询恢复。但查询逻辑只在 `fetchOrders` 中执行，如果 RPC 请求慢或失败，用户可能看到状态闪烁（先显示「发起喂价」再变为「等待中」）。

**修复方案**: 
1. 使用 `localStorage` 缓存 `feedRequestedOrders` 
2. 页面加载时先从缓存读取，再异步从链上确认
3. 链上确认后更新缓存

---

### 2.3 OrderDetail 页面未处理喂价状态

**文件**: `frontend/src/pages/OrderDetail.tsx`

**问题**: 需要检查 OrderDetail（如果存在）是否也需要显示喂价等待状态和倒计时。

**修复方案**: 审核并同步 OrderDetail 页面的状态显示逻辑。

---

### 2.4 多处 status 判断使用 magic number

**文件**: `frontend/src/pages/MyOrders.tsx` 多处

**问题**: 订单状态判断使用硬编码数字  `s === 2`（MATCHED）、`s === 4`（LIVE）等，可读性差，易出错。

**修复方案**: 使用 TypeScript enum 或常量对象替代 magic number：
```typescript
const ORDER_STATUS = {
    RFQ_CREATED: 0, QUOTING: 1, MATCHED: 2,
    WAITING_INITIAL_FEED: 3, LIVE: 4,
    WAITING_FINAL_FEED: 5, PENDING_SETTLEMENT: 6,
    SETTLED: 7, CANCELLED: 8, LIQUIDATED: 9, ARBITRATION: 10,
} as const;
```

---

## 三、Keeper 系统问题与修复

### 3.1 feedResultProcessor 使用错误的 ABI 函数

**文件**: `scripts/keeper/feedResultProcessor.ts` L18-22, L96-105

**问题**: Keeper 调用 `optionsCore.processInitialFeedResult()` 和 `processFinalFeedResult()` — 这两个函数需要 `DEFAULT_ADMIN_ROLE`。应该改为调用 `processFeedCallback()` 并使用 `FEED_PROTOCOL_ROLE`。

**修复方案**: 
1. 修改 ABI 为 `processFeedCallback(uint256, uint8, uint256)`
2. 赋予 Keeper 钱包 `FEED_PROTOCOL_ROLE`
3. 或者让 FeedProtocol 合约的 `_finalizeFeed` 自动回调 OptionsCore — 这是最佳方案

---

### 3.2 Keeper getOrder ABI 与合约不匹配

**文件**: `scripts/keeper/utils.ts` L22-25 vs `feedResultProcessor.ts` L18-22

**问题**: `utils.ts` 中的 `getOrder` ABI 包含 `maxPremiumRate` 字段，但 `feedResultProcessor.ts` 中的 `orders()` 函数只返回 4 个字段。两者 ABI 不一致可能导致解析异常。

**修复方案**: 统一使用 `utils.ts` 中的完整 ABI，feedResultProcessor 改用 `getOrder` 而非 `orders()`。

---

### 3.3 FeedResultProcessor 与 FeedProtocol._finalizeFeed 回调逻辑重复

**文件**: `contracts/feed/FeedProtocol.sol` `_finalizeFeed` 函数, `scripts/keeper/feedResultProcessor.ts`

**问题**: FeedProtocol 合约的 `_finalizeFeed` 已经会自动回调 `optionsCore.processFeedCallback()`。如果回调成功，Keeper 的 feedResultProcessor 就是多余的。如果回调失败（gas 不足等），Keeper 作为兜底。

**修复方案**: 
1. 确认 FeedProtocol `_finalizeFeed` 的回调逻辑是否完整
2. feedResultProcessor 作为兜底补偿，需要先检查订单是否已被回调处理过
3. 添加去重逻辑：检查 OptionsCore 订单状态是否已经是 LIVE/PENDING_SETTLEMENT

---

## 四、与 FeedEngine 交互层问题

### 4.1 FeedProtocol 事件数据不足 → FeedEngine 需要额外查询

**现状**: FeedEngine 的 `event-listener.service.ts` 监听 `FeedRequested` 事件后，因数据为空需回退到 `OptionsCore.getOrder()` 查询。如果 OptionsCore 合约地址配置错误，将无法获取订单信息。

**修复方案**: （与 1.1 合约修复配合）合约修复后事件自带完整数据，FeedEngine 无需额外查询。

---

### 4.2 FeedEngine 喂价完成后，结果如何回传 NST

**现状流程**:
1. NST 用户 → FeedProtocol.requestFeedPublic → FeedRequested 事件
2. FeedEngine 监听事件 → 创建内部订单 → 喂价员提交价格
3. FeedEngine 共识完成后 → ??? 如何通知 NST？

**当前实现**: 
- FeedProtocol 合约有 `submitFeed()` 函数，需要 `ACTIVE_FEEDER` 角色
- FeedEngine 后端的 Keeper/Bot 需要一个钱包拥有 `FEED_OPERATOR_ROLE` 来调用 submitFeed
- 或者 FeedEngine 直接调 NST Keeper 的 API？（没有这个 API）

**缺失环节**: **没有从 FeedEngine → NST 合约的自动回调！** 这是整个流程的最大断裂点。

**修复方案**:  
方案 A — **FeedEngine 直接链上写入**:
1. FeedEngine 后端使用一个钱包调用 `FeedProtocol.submitFeed(requestId, price)`
2. 需要该钱包在 FeedProtocol 上注册为活跃喂价员

方案 B — **Callback URL 模式**（链下）:
1. NST 启动一个 HTTP 服务接收回调
2. FeedEngine 完成共识后调 callback URL
3. NST 的 callback 服务收到后调用合约 submitFeed

方案 C — **NST Keeper 轮询** （当前临时方案）:
1. Keeper 的 feedResultProcessor 轮询 FeedProtocol 的 FeedFinalized 事件
2. 已实现但依赖 FeedEngine 那边的喂价员手动提交

**推荐方案 A**: 让 FeedEngine 后端直接在链上写入，最简洁且去中心化。

---

### 4.3 NST_OPTIONS_CORE_CONTRACT 地址同步

**现状**: FeedEngine `.env` 中 `NST_OPTIONS_CORE_CONTRACT=0x98505C...` 需要与 NST 前端 `config.ts` 保持一致。

**修复方案**: 确保地址一致。如果 NST 重新部署合约，需要通知 FeedEngine 更新。建议添加一个共享配置文件或使用链上注册中心。

---

## 五、执行优先级

| 优先级 | 编号 | 描述 | 难度 | 是否需要合约重部署 |
|--------|------|------|------|-------------------|
| 🔴 P0 | 4.2 | FeedEngine→NST 回调缺失 | 高 | 否（链上角色授权） |
| 🔴 P0 | 1.2 | 双路径混乱（状态不更新） | 高 | 是 |
| 🟡 P1 | 1.1 | 事件 emit 空数据 | 中 | 是 |
| 🟡 P1 | 2.1 | 喂价档位选择 UI | 中 | 否 |
| 🟡 P1 | 3.1 | feedResultProcessor ABI | 低 | 否 |
| 🟢 P2 | 1.4 | 合约地址统一 | 低 | 否 |
| 🟢 P2 | 2.2 | localStorage 缓存 | 低 | 否 |
| 🟢 P2 | 2.4 | magic number 优化 | 低 | 否 |
| 🟢 P2 | 3.2 | Keeper ABI 统一 | 低 | 否 |

---

## 六、验证计划

### 6.1 合约变更验证
- 使用 hardhat test 验证合约功能
- BSC Testnet 重新部署后端到端测试

### 6.2 前端验证
- 手动测试喂价档位选择流程
- 确认状态持久化在页面切换和刷新后正确

### 6.3 集成验证
- 发起喂价请求 → FeedEngine 收到 → 喂价完成 → NST 合约状态更新 → 前端显示 LIVE
- 全流程端到端测试
