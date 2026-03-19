# 进展记录 — NST Protocol

## [2026-03-19 15:42] 联调脚本统一清理 — 可信诊断工具

**[Status]**: Done

**[Changes]**:
- **`test-full-flow.ts`** — 终轮 `requestFeedPublic` 后增加 `WAITING_FINAL_FEED(5)` 状态断言（与初始喂价同标准）；所有 catch 块加 `classifyError()` 分类日志；feedRule=1 路由冲突提示
- **`quick-test-full-flow.ts`** — 完全重写：自动检测 USDT decimals（修复 formatUnits(6) 精度 bug）；余额预检查；分类错误日志
- **`integration-test.ts`** — `fail()` 函数自动标记 `[链上逻辑]`/`[参数问题]`/`[权限配置]`
- 日志分类标准统一：`[链上逻辑]` = 合约 revert、`[参数问题]` = 余额/精度/Config 约束、`[权限配置]` = 角色缺失
- `hardhat compile` 零错误

**[Next Step]**: 使用脚本执行联调

---

## [2026-03-19 15:38] ExerciseFeedKeeper 兜底逻辑完全闭环

**[Status]**: Done

**[Changes]**:
- **`exerciseFeedKeeper.ts`** — 完全重写，两阶段兜底：
  - Phase 1: WAITING_FINAL_FEED 超时 → 代发 `FeedProtocol.requestFeedPublic(orderId, 2, 0)`
  - Phase 2 (新增): 喂价请求超时 + 喂价员未提交 → 调用 `OptionsSettlement.cancelOrderDueFinalFeedTimeout()` → 买方权利金退还 + 卖方保证金全额退还
  - 操作失败不再静默：每个失败场景输出具体人工处理指引（合约地址 + 函数签名 + 检查步骤）
  - 新增 `hasFinalizedFinalFeed()` 检查，避免误取消已完成喂价的订单
  - 使用 `safeExecute()` 统一交易执行和日志
- **`utils.ts`** — ABI 增加 `cancelOrderDueFinalFeedTimeout`
- TypeScript 编译零错误

**[Next Step]**: 联调部署后测试完整行权→超时→取消流程

---

## [2026-03-19 15:31] VolumeBasedFeed 完整链路打通

**[Status]**: Done

**[Changes]**:
- **审查结论** — 前端 VBF 链路 80% 已就绪：合约完整、Hook 功能齐全、MyOrders 已有 feedRule 路由 + VBF 弹窗（初始/动态/终轮三场景）
- **`CreateSellerOrder.tsx`** — 删除 `suggestedPrice` 废字段（合约不接受），添加跟量成交提示文案「建议价格将在喂价阶段由卖方实时填写」
- **`useContracts.ts`** — 删除 `suggestedPrice` 接口声明和 order struct 映射（2处）
- **`MyOrders.tsx`** — 订单卡片新增 `feedRule=1` 的「跟量成交」琥珀色标签
- 前端 `tsc -b && vite build` 零错误通过

**[Next Step]**: 联调测试 VolumeBasedFeed 完整流程

---

## [2026-03-19 15:25] 前端表单-链上参数完全一致性修复

**[Status]**: Done

**[Changes]**:
- **`CreateSellerOrder.tsx`** — formData 变量名 `marginCallDeadline` → `arbitrationWindow` 全面替换（4处）：
  - L68: 默认值声明 `arbitrationWindow: '12h'`
  - L95: handleSubmit 映射 `formData.arbitrationWindow === '12h' ? 12*3600 : 2*3600`
  - L416: 按钮 onClick/状态判断 `formData.arbitrationWindow === time`
  - L664: 确认摘要 label 从「补仓时限」→「仲裁窗口」
- **`SubmitQuotePage.tsx`** — 彻底删除 T+X 行权延迟只读展示区（L373-387）：
  - 原因：买方 RFQ 订单的 `exerciseDelay` 在 OptionsCore L152 硬编码为 0，且 submitQuote 不接受此参数
  - 该字段仅对卖方单有意义，放在报价页纯属误导
- 前端 `tsc -b && vite build` 零错误通过

**[Next Step]**: 联调测试完整流程

---

## [2026-03-19 15:20] Config 约束全面下沉 + 边界单测覆盖

**[Status]**: Done

**[Changes]**:
- **`Config.sol`** — 新增 4 个边界参数：`minArbitrationWindow`(1h), `maxArbitrationWindow`(48h), `minMarginCallDeadline`(1h), `maxMarginCallDeadline`(24h)
- **`OptionsCore.sol`** — 全面更新：
  - `createBuyerRFQ`: arbitrationWindow/marginCallDeadline 从硬编码改为读 Config
  - `createSellerOrder`: arbitrationWindow 从硬编码改为读 Config，exerciseDelay 错误信息统一
  - `submitQuote`: 新增 `marginRate >= config.minMarginRate()` 校验
- **`OptionsCore.test.ts`** — 新增 14 个边界校验测试：
  - createBuyerRFQ: minMarginRate↓、arbitrationWindow↑↓、marginCallDeadline↑、consecutiveDays↑、合法边界值
  - createSellerOrder: exerciseDelay↓↑、arbitrationWindow↑、合法边界值
  - submitQuote: consecutiveDays↑、marginRate↓、maxQuotes 溢出、合法参数
- **结果**: 61/61 测试全部通过

**[Next Step]**: 前端建单/报价页面需同步使用 Config 返回的边界值做表单校验

---

## [2026-03-19 15:10] requestFeedPublic 状态同步强制化

**[Status]**: Done

**[Changes]**:
- **`FeedProtocol.sol`** — 移除 `onFeedRequested` 的 try/catch 包裹，改为直接调用。如果状态切换失败（权限、状态不匹配），整个 `requestFeedPublic` 交易回滚，彻底杜绝"FeedRequest 已创建但订单仍停留在 MATCHED"的不一致状态
- **`OptionsCore.test.ts`** — 在初始喂价测试中新增 `expect(orderAfterRequest.status).to.equal(3)` 断言，验证 requestFeedPublic 后状态立即切换到 WAITING_INITIAL_FEED
- **`test-full-flow.ts`** — 将 Step 6 的软警告（⚠️ Status still MATCHED）改为硬断言（status !== 3 直接终止脚本），联调时第一时间暴露权限问题
- 47/47 测试全部通过

**[Next Step]**: 部署后确认 `grantRole(FEED_PROTOCOL_ROLE, FeedProtocol地址)` 到 OptionsCore，否则 requestFeedPublic 会 revert

---

## [2026-03-19 14:20] 运维脚本过时逻辑修复

**[Status]**: Done

**[Changes]**:
- **`test-full-flow.ts`** — 完全重写：
  - 从错误的「卖方建单→submitQuote」改为正确的「买方RFQ→卖方报价→acceptQuote」流程
  - 修复 `exerciseDelay: 0` 违反新 T+1 约束（改用买方RFQ流程，无需此参数）
  - 修复 `minMarginRate` 等参数使其符合新 Config 约束
  - 新增 VaultManager USDT 授权步骤
- **`exerciseFeedKeeper.ts`** — 全面更新：
  - 合约地址从旧地址更新为 `0x98BA4261835533FEBf2335a4edA04d1a69D45311`
  - TODO 替换为实际逻辑：检测超时后自动代触发 Final 喂价请求（`requestFeedPublic(orderId, 2, 0)`）
  - 新增 `hasActiveFinalFeedRequest` 防止重复创建请求

**[Next Step]**: 联调时运行 test-full-flow.ts 验证完整流程

---

## [2026-03-19 14:15] 前端表单参数与链上一致性修复

**[Status]**: Done

**[Changes]**:
- **`CreateSellerOrder.tsx`** — UI标签从「补仓时限」改为「仲裁窗口 (Arbitration Window)」，添加说明"结算后买卖方可在此窗口内发起仲裁"，消除用户将 arbitrationWindow 误认为 marginCallDeadline 的歧义
- **`SubmitQuotePage.tsx`** — 移除虚假的 exerciseDelay 交互选择器（合约 submitQuote 不接受此参数），改为只读显示订单的 T+X 值，标注"由订单创建方设定，不可在报价时修改"

**[Next Step]**: 联调验证前端表单数据与链上参数对应

---

## [2026-03-19 14:10] Config 约束链上强制执行

**[Status]**: Done

**[Changes]**:
- **`createBuyerRFQ`** — 新增 4 条 require: minMarginRate ≥ config值、arbitrationWindow ∈ [1h,48h]、marginCallDeadline ∈ [1h,24h]、consecutiveDays ≤ config.maxConsecutiveDays
- **`createSellerOrder`** — 新增 3 条 require: exerciseDelay ∈ [T+1,T+5]、consecutiveDays、arbitrationWindow
- **`submitQuote`** — 新增 2 条 require: 活跃报价数 < maxQuotesPerBuyerOrder(5)、consecutiveDays
- 47/47 测试全部通过

**[Next Step]**: 如需调整约束范围，通过 Config.sol 的 DAO 函数修改

---

## [2026-03-19 13:55] feedRule/VolumeBasedFeed 功能链打通

**[Status]**: Done

**[Changes]**:
- **合约层**:
  - `VolumeBasedFeed.sol` — 添加 `IOptionsCore` 引用、`setOptionsCore` 管理函数、`_callbackOptionsCore` 内部函数（approve/modify 后自动调用 `onFeedRequested` + `processFeedCallback`），新增 `CallbackFailed`/`OptionsCoreUpdated` 事件
  - `FeedProtocol.sol:requestFeedPublic` — 新增 feedRule=VolumeBasedFeed 拦截（revert 提示走 VolumeBasedFeed 合约）
  - 47/47 测试全部通过
- **前端层**:
  - `CreateSellerOrder.tsx` — `executionMode === 'volume'` 映射到 `feedRule: 1`
  - `useFeedAndPoints.ts` — 新增 `submitSuggestedPrice` 写入函数到 `useVolumeBasedFeed` hook
  - `MyOrders.tsx` — `handleInitiateFeed`/`handleExerciseWithFeed`/`handleDynamicFeed` 根据 `order.feedRule` 路由；feedRule=1 弹出跟量成交弹窗（输入建议价格+依据）

**[Next Step]**: 部署后需 `grantRole(FEED_PROTOCOL_ROLE, VolumeBasedFeed地址)` 到 OptionsCore

---

## [2026-03-19 12:50] requestFeedPublic 强校验

**[Status]**: Done

**[Changes]**:
- `FeedProtocol.sol:requestFeedPublic` — 新增 5 项校验：
  - ① 订单存在性（`buyer != address(0)`）
  - ② feedType 与订单状态匹配（`_validateFeedTypeForStatus`）
  - ③ 无重复未完成请求（`_requireNoActiveFeedRequest`）
  - ④ 活跃喂价员 ≥ 所选档位要求（`_countActiveFeeders`）
  - ⑤ `onFeedRequested` 失败可追踪（`FeedRequestStatusSyncFailed` 事件）
- `OptionsCore.test.ts` — “非 LIVE 状态不能执行动态喂价” 测试更新为 expect revert
- 全部 **47/47 测试通过**

**[Next Step]**: 继续处理剩余联调前问题

---

## [2026-03-19 12:35] 清理联调脚本过期内容

**[Status]**: Done

**[Changes]**:
- `integration-test.ts` — 新增 FeedProtocol 合约地址，FEED_PROTOCOL_ROLE 权限检查改为优先检查 FeedProtocol 合约（自动回调路径）
- `test-full-flow.ts` — 完全重写：更新地址、修复 createPublicFeedRequest→requestFeedPublic、feedType Final=2、移除不存在的 matchOrder/adminSetMarginBalance、添加 onFeedRequested 验证
- `quick-test-full-flow.ts` — 更新所有旧合约地址

**[Next Step]**: 联调时运行 `integration-test.ts` 验证权限配置

---

## [2026-03-19 12:30] 统一喂价请求入口与状态同步

**[Status]**: Done

**[Changes]**:
- `IOptionsCore.sol` — 新增 `onFeedRequested(orderId, feedType)` 接口声明
- `OptionsCore.sol` — 实现 `onFeedRequested`（FEED_PROTOCOL_ROLE），Initial→WAITING_INITIAL_FEED、Final→WAITING_FINAL_FEED
- `FeedProtocol.sol` — `requestFeedPublic` 创建 FeedRequest 后 try/catch 调用 `optionsCore.onFeedRequested` 同步状态
- 前端无需改动，继续调 `requestFeedPublic`，链上状态自动同步
- 全部 **47/47 测试通过**

**[Next Step]**: 前端可移除 localStorage 补状态逻辑，改读链上状态

---

## [2026-03-19 12:15] 统一喂价结果回写机制

**[Status]**: Done

**[Changes]**:
- `OptionsCore.sol` — 提取 `_processFeedCallbackInternal` 内部函数，消除三套重复逻辑
- `OptionsCore.sol` — `processInitialFeedResult`/`processFinalFeedResult` 标记 `@deprecated`，内部转发到统一函数
- `OptionsCore.sol` — `processFeedCallback`（FEED_PROTOCOL_ROLE）为正式路径，同样转发
- `feedResultProcessor.ts` — 增加幂等检查、Dynamic/Arbitration 类型支持、明确标识为 FALLBACK 角色
- 全部 **47/47 测试通过**

**[Next Step]**: 联调确认 FeedProtocol 合约地址已被 grant FEED_PROTOCOL_ROLE

---

## [2026-03-19 12:00] processFeedCallback 缺少 Dynamic/Arbitration 分支修复

**[Status]**: Done

**[Changes]**:
- `OptionsCore.sol` — `processFeedCallback` 新增 `Dynamic` 分支：仅更新 `lastFeedPrice`，状态保持 LIVE（供保证金风控使用）
- `OptionsCore.sol` — `processFeedCallback` 新增 `Arbitration` 分支：更新价格并转 `PENDING_SETTLEMENT`
- `OptionsCore.test.ts` — 新增 2 个测试：LIVE状态 Dynamic 更新 lastFeedPrice、非 LIVE 状态 Dynamic 回调静默失败
- 全部 **47/47 测试通过**

**[Next Step]**: 联调验证动态喂价前后端交互

---

## [2026-03-19 11:45] rejectFeed 导致请求卡死修复

**[Status]**: Done

**[Changes]**:
- `FeedProtocol.sol` — `rejectFeed` 增加 `request.submittedCount++`，拒绝也计入响应总数
- `FeedProtocol.sol` — `rejectFeed` 所有人响应后内联检查 `validCount >= effectiveFeeds`，满足则自动 `_finalizeFeed`，否则 emit `FeedFinalizeSkipped`
- `FeedProtocol.sol` — 新增 `FeedFinalizeSkipped` 事件声明
- `FeedProtocol.test.ts` — 新增 3 个测试：3提交+2拒绝自动finalize、2提交+3拒绝emit跳过事件、reject计入submittedCount
- 全部 **45/45 测试通过**

**[Next Step]**: 联调验证 FeedEngine 与链上交互正常

---

## [2026-03-19 11:30] finalizeFeed 安全漏洞修复

**[Status]**: Done

**[Changes]**:
- `FeedProtocol.sol` — `finalizeFeed` (external): 增加 `require(block.timestamp > request.deadline)` 防止 deadline 前任意地址提前调用
- `FeedProtocol.sol` — `_finalizeFeed` (internal): 将 `require(validCount > 0)` 替换为 `require(validCount >= tierConfig.effectiveFeeds)` 强制执行 5-3/7-5/10-7 档位有效喂价门槛
- `FeedProtocol.test.ts` — 新增 3 个安全测试用例，修复偶数中位数测试适配新 deadline 门控
- 全部 **42/42 测试通过**

**[Next Step]**: 联调验证 FeedEngine 与链上 finalizeFeed 的交互是否正常

---

## [2026-03-19 10:30] 核心合约测试重写

**[Status]**: Done

**[Changes]**:
- `OptionsCore.test.ts` 完整重写，覆盖 8 条主链路（买方RFQ→卖方挂单→报价接单→首轮喂价→结算→取消/超时→仲裁→补保证金/强平）
- `FeedProtocol.test.ts` 完整重写，覆盖注册/质押/档位/中位数聚合/finalize回调/拒绝/错误处理
- 发现并修正 FeedType 枚举映射 (0=Initial, 1=Dynamic, 2=Final)
- 全部 **39/39 测试通过**

**[Next Step]**: finalizeFeed 安全漏洞修复
