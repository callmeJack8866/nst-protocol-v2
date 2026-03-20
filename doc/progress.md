# NST Protocol Progress

## [2026-03-20 14:30 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**Config + OptionsCore 联合重部署 — 完整流程验证通过 🎉**

根因：测试网 Config 是旧版本，缺少 `minArbitrationWindow`/`maxArbitrationWindow`/`minMarginCallDeadline`/`maxMarginCallDeadline`/`maxConsecutiveDays` 等新 OptionsCore 所需的校验参数。

已完成：
1. 重部署 Config → `0x9f839C36146c0c8867c2E36E33EA5A024be38e31`
2. 重部署 OptionsCore → `0x78F4600D6963044cCE956DC2322A92cB58142129`
3. 配置所有角色（VAULT_OPERATOR/FEED_PROTOCOL/SETTLEMENT/PROTOCOL）
4. 更新跨合约引用（FeedProtocol/OptionsSettlement/VaultManager → 新 Config/OC）
5. 全局替换 17 个文件中的旧地址
6. test-full-flow.ts 9 步完整验证通过（含 requestFeedPublic → WAITING_INITIAL_FEED）

### [Next Step]
- 联调可开始

## [2026-03-20 13:57 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**稳定化 integration-test.ts（防止 replacement transaction underpriced）**

注入 `safeSendTx`（nonce + gasPrice × 1.2 + 3 次重试）和 `ensureAllowance`（allowance-aware），替换了：
- 3 处裸 `approve`（行 195/270/301）→ `ensureAllowance`
- 3 处裸交易发送（`createBuyerRFQ`/`submitQuote`/`acceptQuote`）→ `safeSendTx`
- approve 金额统一提高到 10000 USDT，减少后续 approve 次数

### [Next Step]
- 等待用户完成其他合约修改，然后一起重新部署

## [2026-03-20 13:46 / Latest Session] Status: Blocked

### [Status]: Blocked
### [Changes]:
**诊断 requestFeedPublic revert 根因**

FeedProtocol 侧全部校验通过：
- FEED_PROTOCOL_ROLE ✅
- optionsCore 引用正确 ✅
- Tier 配置 = 1 人 ✅
- 活跃喂价员 = 1 ✅
- Allowance / Balance ✅
- Order status = MATCHED(2) ✅

**唯一失败点**：`optionsCore.onFeedRequested(orderId, feedType)` 返回 raw `0x` revert → 测试网 OptionsCore (`0x98505...`) 也是旧版本，不含 `onFeedRequested` 函数。

### [Next Step]
- 需要重新部署 OptionsCore（以及可能的 OptionsSettlement）并重新配置所有角色

## [2026-03-19 22:20 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**FeedProtocol 重部署完成 + 地址全局替换**

新地址: `0x45E4ee36e6fA443a7318cd549c6AC20d83b6C1A7`

已替换 5 处旧地址 (`0x98BA...`)：
- `deployed-addresses.json`（脚本自动）
- `frontend/src/contracts/config.ts` 第 24 行
- `scripts/keeper/utils.ts` 第 15 行
- `scripts/test-full-flow.ts` 第 47 行
- `scripts/integration-test.ts` 第 25 行

### [Next Step]
- 复跑 test-full-flow.ts 验证 requestFeedPublic 后状态切换到 WAITING_INITIAL_FEED

## [2026-03-19 22:17 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**创建 FeedProtocol 一键重部署脚本**

#### 根因
测试网部署的 FeedProtocol(`0x98BA...`) 是旧版本，`requestFeedPublic` 中不含 `onFeedRequested` 回调，导致喂价请求成功但订单状态不切换。

#### 修复
创建 `scripts/redeploy-feedprotocol-v2.ts`，7 步自动化：
1. 部署新 FeedProtocol（含 onFeedRequested 回调）
2. setOptionsCore
3. 授予 OptionsCore PROTOCOL_ROLE
4. 授予新 FeedProtocol FEED_PROTOCOL_ROLE
5. 撤销旧 FeedProtocol 角色
6. 验证 tier 配置
7. 自动更新 deployed-addresses.json

#### 部署后还需手动更新
- `frontend/src/contracts/config.ts` 第 24 行
- `scripts/keeper/utils.ts` 第 15 行
- `scripts/test-full-flow.ts` 第 47 行

### [Next Step]
- 执行部署脚本: `npx hardhat run scripts/redeploy-feedprotocol-v2.ts --network bscTestnet`

## [2026-03-19 22:03 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**清理 scripts 目录 6 位精度残留（续：额外 5 个脚本）**

- `fund-and-settle.ts` — 5 处
- `fix-order3.ts` — 4 处
- `redeploy-feedprotocol.ts` — 3 处
- `full-diagnosis.ts` — 2 处
- `full-redeploy-and-setup.ts` — 1 处

✅ 全局扫描确认 `scripts/` 目录零残留

### [Next Step]
- 测试网联调

## [2026-03-19 22:00 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**清理 scripts 目录 6 位精度残留（5 个目标文件）**

每个文件新增自动 decimals 检测（MockERC20 接口 + fallback 18），所有 `formatUnits(*, 6)` 和 `parseUnits(*, 6)` 替换为动态 `decimals`。

- `check-vault-balance.ts` — 2 处 formatUnits
- `debug-settle.ts` — 2 处 formatUnits
- `set-margin-and-settle.ts` — 7 处 formatUnits + 1 处 parseUnits
- `debug-create-order.ts` — 2 处 formatUnits + 1 处 parseUnits
- `deep-debug-create-order.ts` — 2 处 formatUnits + 4 处 parseUnits

#### ⚠ 全局扫描发现额外残留（未在本次任务范围）
`redeploy-feedprotocol.ts`(3)、`fund-and-settle.ts`(5)、`full-redeploy-and-setup.ts`(1)、`full-diagnosis.ts`(2)、`fix-order3.ts`(4)

### [Next Step]
- 决定是否继续清理额外残留脚本

## [2026-03-19 21:58 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**修复 test-full-flow.ts 交易发送可靠性**

#### 问题
两个 `usdt.approve()` 连续发送，BSC testnet RPC 节点 nonce 同步延迟导致 `ProviderError: replacement transaction underpriced`。

#### 修复
- 新增 `safeSendTx()` — 显式获取 nonce、gasPrice 加 20%、最多 3 次重试（仅对 underpriced/nonce/already known 重试）
- 新增 `ensureAllowance()` — 先查链上 allowance，充足则跳过，不足才发 approve
- approve 阶段改为 allowance-aware，脚本可稳定重复执行

### [Next Step]
- 测试网联调执行

## [2026-03-19 21:43 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**同步 finalFeedRequestedAt 字段到所有手写 ABI**

#### 问题
合约 NSTTypes.sol Order struct 已新增 `finalFeedRequestedAt`（位于 settledAt 和 lastFeedPrice 之间），但前端和 keeper 的手写 ABI tuple 缺少该字段，导致 ethers 解码位移 — `lastFeedPrice` 读到的是 `finalFeedRequestedAt` 的值，`dividendAmount` 读到的是 `lastFeedPrice` 的值，而 `finalFeedRequestedAt` 本身完全无法访问。

#### 修复
- `frontend/src/contracts/abis.ts` 第 22 行 (`getOrder` tuple) — 插入 `uint256 finalFeedRequestedAt`
- `frontend/src/contracts/abis.ts` 第 33 行 (`orders` tuple) — 插入 `uint256 finalFeedRequestedAt`
- `scripts/keeper/utils.ts` 第 23 行 (`getOrder` tuple) — 插入 `uint256 finalFeedRequestedAt`

#### 下游消费者（无需改代码，ABI 修复后自动生效）
- `MyOrders.tsx` 第 521 行: `order.finalFeedRequestedAt` ✓
- `exerciseFeedKeeper.ts` 第 138 行: `order.finalFeedRequestedAt` ✓

### [Next Step]
- 联调验证 MyOrders 倒计时和 exerciseFeedKeeper 超时判断读到非零值

## [2026-03-19 21:30 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**修复联调脚本参数签名和 approve 对象**

#### quick-test-full-flow.ts（核心 bug）
- `marginRate=2000` → `marginAmount=parseUnits("2", decimals)` — 合约第 10 参数是 bigint 金额而非基点费率
- approve 目标 OptionsCore → VaultManager
- 清理重复 approve 行

#### integration-test.ts（6 处）
- 全部 `usdt.allowance/approve(OptionsCore)` → `VaultManager`

#### test-full-flow.ts
- 移除多余的 `usdt.approve(OptionsCore)` 行
- `createBuyerRFQ` 参数顺序验证正确 ✓

### [Next Step]
- 部署测试网联调

## [2026-03-19 21:25 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**修复 RFQ 权利金率字段映射错误 (premiumRate → maxPremiumRate)**

#### 问题
`getAllActiveRFQs` 返回 `order.premiumRate`（成交后实际费率，RFQ 阶段为 0），而 RFQ 应展示 `maxPremiumRate`（买方可接受上限）。

#### useContracts.ts
- `getAllActiveRFQs` 新增 `maxPremiumRate: Number(order.maxPremiumRate)` 字段映射

#### SellerHall.tsx
- 接口 `premiumRate` → `maxPremiumRate`
- Modal 初始化 quoteForm、OrderCard prop、弹窗 Target Rate 三处改读 `maxPremiumRate`

#### BuyerHall.tsx
- 接口 `premiumRate` → `maxPremiumRate`
- OrderCard prop、MetricItem 标签改读 `maxPremiumRate`，标签改为 "Max Rate"

#### OrderCard.tsx
- 指标标签 "Premium" → "Max Rate"

#### SubmitQuotePage.tsx
- fallback 优先级反转：`maxPremiumRate || premiumRate`

### [Next Step]
- 前端联调验证 RFQ 列表展示正确的买方最高费率

## [2026-03-19 21:22 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**修复 CreateBuyerRFQ / CreateSellerOrder allowance 展示和授权对象错误**

#### useContracts.ts
- 将内部 `getVaultManagerAddress()` 添加到 `useOptions()` 的 return 导出

#### CreateBuyerRFQ.tsx（3 处）
- `refreshFinancials`: `fetchAllowance(OptionsCore)` → `fetchAllowance(VaultManager)`
- approve 按钮: `approve(OptionsCore, ...)` → `approve(VaultManager, ...)`
- 解构: `getOptionsCoreAddress` → `getVaultManagerAddress`

#### CreateSellerOrder.tsx（2 处）
- `refreshFinancials`: `fetchAllowance(OptionsCore)` → `fetchAllowance(VaultManager)`
- 解构: `getOptionsCoreAddress` → `getVaultManagerAddress`

#### 验证
- 页面层 `getOptionsCoreAddress` 零残留 ✓
- hooks 层自动授权原本已正确指向 VaultManager，无需修改

### [Next Step]
- 启动前端 dev server 验证页面 allowance 显示正确

## [2026-03-19 22:30 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**统一修复前端 USDT 精度显示问题**

#### transformers.ts（新增工具函数）
- `USDT_DECIMALS = 18` — 全局精度常量，禁止再硬编码 6
- `formatUSDTAmount(bigint)` — 链上原始值 → 人类可读字符串（支持 K/M 缩写）
- `usdtToNumber(bigint)` — 链上原始值 → 纯数字

#### 修复页面清单（7 个文件 17 处）
| 页面 | 修复数 | 说明 |
|------|--------|------|
| SubmitQuotePage.tsx | 3 | formatAmount + calculateEstimates 精度 |
| SellerHall.tsx | 5 | OrderCard.notionalUSDT + Modal 内 3 处估算 |
| SeatManagement.tsx | 3 | formatAmount + 1e6 → 1e18 乘法修复 |
| OrderMarket.tsx | 1 | formatAmount |
| MyOrders.tsx | 2 | formatAmount(bigint 分支) + safeSum |
| BuyerHall.tsx | 2 | OrderCard.notionalUSDT + MetricItem |
| CreateSellerOrder.tsx | 2 | balance/allowance 显示 |

### [Next Step]
- 启动前端 dev server 验证页面渲染正常
- 部署测试网联调

## [2026-03-19 21:09 / Latest Session] Status: Done

### [Status]: Done
### [Changes]:
**修复终轮喂价时间基准（本次变更）**

#### NSTTypes.sol
- Order struct 新增 `finalFeedRequestedAt` 字段（终轮喂价请求发起时间）

#### OptionsCore.sol
- 新增 `updateOrderFinalFeedRequestedAt(orderId, timestamp)` — SETTLEMENT_ROLE 专用
- `onFeedRequested(FeedType.Final)` 中写入 `order.finalFeedRequestedAt = block.timestamp`

#### OptionsSettlement.sol
- IOptionsCoreAdmin 接口新增 `updateOrderFinalFeedRequestedAt`
- `earlyExercise()` 中新增 `optionsCore.updateOrderFinalFeedRequestedAt(orderId, block.timestamp)`

#### exerciseFeedKeeper.ts
- Phase 1 超时计算改用 `order.finalFeedRequestedAt`（不再回退到 `settledAt→matchedAt`）
- `finalFeedRequestedAt=0` 时显式报错跳过

#### MyOrders.tsx
- 倒计时改读 `order.finalFeedRequestedAt`（移除不存在的 `exerciseRequestedAt`）

#### test/FinalFeedTimeBasis.test.ts（新建）
- 4 条回归测试全部通过
- 覆盖：earlyExercise 写入、onFeedRequested 写入、权限控制、Final 回调不覆盖

---

## [2026-03-19 / 前一次] Status: Done

### [Changes]:
**修复动态喂价 → 追保/强平风控链**
- OptionsCore: 新增 `DynamicFeedMarginAlert` 事件 + 修复 `createBuyerRFQ` 不写 `marginCallDeadline` 到 order
- OptionsSettlement: 三处改用 `notionalUSDT * minMarginRate / 10000` 公式
- marginKeeper.ts: 同步公式
- test/MarginRiskChain.test.ts: 10 条回归测试全部通过

### [Next Step]
- 部署到测试网并进行联调验证
