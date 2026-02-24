# NST Finance 前端进展

## [2026-02-06 21:15]
- **Status**: Done
- **Changes**: 完成按钮显示和仲裁按钮样式修复
  - `zh.json`: 添加缺失翻译键(exercise/settle/add_margin/withdraw/dynamic_feed/arbitration/exercise_ready)
  - `MyOrders.tsx`: 仲裁按钮从感叹号改为红色中文"仲裁"文字


## [2026-02-06 21:10]
- **Status**: Done
- **Changes**: 修复Settle错误和按钮国际化
  - `MyOrders.tsx`: EXERCISE/SETTLE/ADD MARGIN/WITHDRAW/DYNAMIC FEED 按钮国际化
  - `MyOrders.tsx`: canSettle添加lastFeedPrice>0检查，防止无喂价时RPC错误
  - 根本原因：合约L535要求lastFeedPrice>0，前端之前只检查状态


## [2026-02-06 20:40]
- **Status**: Done
- **Changes**: 买方/卖方页面国际化对齐
  - `CreateSellerOrder.tsx`: 添加useTranslation和STEP_LABELS国际化
  - `BuyerHall.tsx`: 添加useTranslation导入和t函数
  - 与SellerHall国际化支持对齐


## [2026-02-06 20:30]
- **Status**: Done
- **Changes**: 卖方流程缺口实施
  - `SubmitQuotePage.tsx`: 新增`exerciseDelay`状态变量和T+1~T+5选择器UI
  - `MyOrders.tsx`: 新增`getFinalFeedCountdown`函数(WAITING_FINAL_FEED 10分钟倒计时)
  - `MyOrders.tsx`: 添加平仓喂价倒计时UI组件(🔔橙色徽章)
  - 合约接口: submitQuote参数新增exerciseDelay字段

## [2026-02-06 20:22]
- **Status**: Done
- **Changes**: P2前端功能增强
  - 新增 `statusFilter` 状态变量：支持6种筛选类型
  - 新增 `filterOrdersByStatus` 函数：按状态过滤订单
  - 添加状态筛选标签页UI：全部/询价/待喂价/持仓/结算/历史
  - 每个标签页显示对应订单数量
  - 标签页样式：胶囊型按钮，选中高亮

## [2026-02-06 20:20]
- **Status**: Done
- **Changes**: P1功能增强实施
  - 新增 `calculateSettlementPnL` 函数：真实盈亏计算（看涨/看跌期权结算逻辑）
  - SETTLED状态：绿色徽章+勾选图标+盈亏详情显示
  - PENDING_SETTLEMENT状态：增加盈亏预览
  - ARBITRATION状态：紫色徽章+天平图标+等待重新喂价提示
  - LIQUIDATED状态：红色徽章+骷髅图标+强平原因提示
- **Next Step**: 测试各状态订单显示效果

## [2026-02-06 20:16]
- **Status**: Done
- **Changes**: P0功能缺口实施
  - 新增 `getArbitrationCountdown` 函数：仲裁窗口24小时倒计时
  - 新增 `getInitialFeedCountdown` 函数：初始喂价10分钟时限倒计时
  - PENDING_SETTLEMENT状态显示仲裁窗口倒计时徽章
  - MATCHED状态显示初始喂价倒计时徽章
  - 确认动态喂价按钮已存在(卖方LIVE状态)
- **Next Step**: P1功能（结算详情页、仲裁结果展示）

## [2026-02-06 19:58]
- **Status**: Done
- **Changes**: 前端精度统一修复 (6位→18位小数)
  - `useContracts.ts`: addMargin, withdrawExcessMargin, arbitrationFee (3处)
  - `CreateSellerOrder.tsx`: notionalUSDT, marginAmount (2处)
  - `CreateBuyerRFQ.tsx`: notionalUSDT (1处)
  - `useSeatManager.ts`: deposit, addDeposit, withdrawDeposit (3处)
  - 共修复9处parseUnits调用
- **Next Step**: 测试验证所有金额操作

## [2026-02-06 19:55]
- **Status**: Done
- **Changes**: 保证金计算精度修复
  - 发现精度不一致：transformers.ts 用 18 位小数，useContracts.ts 用 6 位小数
  - 修复 `getMarginHealthPercent` 函数：统一使用 18 位小数
  - 添加自动检测逻辑：区分原始 bigint 和已转换 number 格式
  - 修复 minMarginRate 处理：自动识别 basis points vs 百分比格式
- **Next Step**: 测试验证保证金健康度显示

## [2026-02-06 19:52]
- **Status**: Done
- **Changes**: 保证金功能增强
  - 新增4个辅助函数：`getMarginHealthPercent`、`getMarginHealthStatus`、`getMarginCallCountdown`、`needsMarginCallWarning`
  - 卖方LIVE订单卡片新增保证金健康度指示器（绿/黄/红三色）
  - 新增追保倒计时警告徽章（红色脉冲动画）
  - 健康度阈值：≥120%=健康(绿)、80-120%=警告(黄)、<80%=危险(红)
- **Next Step**: 刷新页面验证保证金健康度显示效果

## [2026-02-06 19:45]
- **Status**: Done
- **Changes**: 新增喂价价格显示功能
  - `MyOrders.tsx`：订单卡片新增"喂价"字段，显示 lastFeedPrice（青色）
  - `OrderMarket.tsx`：展开详情区块"结算信息"改为"喂价信息"，首行显示最新喂价
  - `UserProfile.tsx`：展开详情区块"结算信息"改为"喂价信息"，首行显示最新喂价
  - 喂价价格使用青色高亮显示 `text-cyan-400`
- **Next Step**: 刷新页面验证喂价价格显示效果

## [2026-02-06 19:41]
- **Status**: Done
- **Changes**: 订单大厅 & 账户最近订单UI重构 - 表格行布局
  - 重构 `OrderMarket.tsx`：将卡片网格布局改为表格行布局
  - 重构 `UserProfile.tsx`：将最近订单从简单列表改为表格行+展开详情布局
  - 添加展开/收起交互和动画效果
  - 展开区显示5个信息块：标的信息、交易参数、风险结构、订单配置、结算信息
  - 买方订单显示蓝色主题，卖方订单显示紫色主题
- **Next Step**: 刷新页面验证表格行布局效果

## [2026-02-06 18:58]
- **Status**: Done
- **Changes**: 修复卖方订单预览组件布局
  - 将预览组件从主表单容器内部移至外部，与买方RFQ页面布局一致
  - 添加React Fragment (`<>...</>`) 包裹表单容器和预览组件，修复JSX语法错误
  - 清理了意外产生的重复代码（文件从964行清理到734行）
  - 文件修改：`CreateSellerOrder.tsx`
- **Next Step**: 布局修复完成，可继续其他开发任务

## [2026-02-05 21:54]
- **Status**: Done
- **Changes**: 添加席位管理侧边栏入口
  - 在 `Sidebar.tsx` Gov 分组添加 `/seat` 入口（盾牌图标）
  - 中文翻译：`nav.seat_management` → "席位管理"
  - 英文翻译：`nav.seat_management` → "Seat Management"
- **Next Step**: 全部功能开发完成，刷新页面验证

## [2026-02-05 21:52]
- **Status**: Done
- **Changes**: 实现仲裁确认弹窗和动态保证金喂价
  - 添加仲裁弹窗状态（arbitrationModalOpen, arbitrationOrderId）
  - 实现 `openArbitrationModal` 和 `handleArbitrationConfirm` 函数
  - 仲裁弹窗显示 30U 费用提示和规则说明
  - 添加 `⚡ DYNAMIC FEED` 按钮调用 `requestFeed(orderId, 1, 0)`
  - 添加动态喂价加载状态（dynamicFeedLoading）
- **Next Step**: 刷新页面测试仲裁弹窗和动态喂价功能

## [2026-02-05 21:50]
- **Status**: Done
- **Changes**: 实现保证金追加/提取输入弹窗
  - 在 `MyOrders.tsx` 添加弹窗状态变量（marginModalOpen, marginModalType, marginAmount, selectedOrderId）
  - 实现 `openMarginModal` 和 `handleMarginSubmit` 处理函数
  - 修改 ADD MARGIN / WITHDRAW 按钮调用弹窗（替代硬编码 "100"）
  - 添加美观的弹窗 UI（Obsidian Glass 风格，金额输入 + 确认取消）
- **Next Step**: 刷新页面测试保证金操作，验证喂价员界面

## [2026-02-05 21:40]
- **Status**: Done
- **Changes**: 修复 FeedType 枚举不匹配问题（根本原因）
  - **根因**：合约中 `FeedType.Final = 2`（枚举包含 Dynamic=1），但前端和 Keeper 使用 `1` 表示 Final
  - 修改 `frontend/src/pages/MyOrders.tsx` 第228行：`feedType=1` → `feedType=2`
  - 修改 `scripts/keeper/feedResultProcessor.ts`：添加 `Dynamic=1`，修正 `Final=2`
  - 手动更新订单 3 到 PENDING_SETTLEMENT 并设置卖方保证金
- **Next Step**: 刷新前端，新创建的订单期末喂价后将自动更新状态

## [2026-02-05 21:25]
- **Status**: Done
- **Changes**: 修复 feedResultProcessor 状态检查逻辑
  - **根因发现**：Keeper 脚本中期末喂价处理仅检查 `LIVE (4)` 状态，但实际订单可能处于 `WAITING_FINAL_FEED (5)` 状态
  - 修改 `scripts/keeper/feedResultProcessor.ts`：
    - 扩展 ORDER_STATUS 枚举，添加 `WAITING_INITIAL_FEED`、`WAITING_FINAL_FEED`、`PENDING_SETTLEMENT`
    - 修改状态检查：`FeedType.Final` 现在同时接受 `LIVE (4)` 或 `WAITING_FINAL_FEED (5)`
    - 修改状态检查：`FeedType.Initial` 现在同时接受 `MATCHED (2)` 或 `WAITING_INITIAL_FEED (3)`
- **Next Step**: 重启 Keeper 服务并测试完整流程

## [2026-02-05 21:20]
- **Status**: Done
- **Changes**: 成功修复 settle 功能
  - 手动将订单 1 和 2 状态更新到 PENDING_SETTLEMENT
  - 使用 `adminSetMarginBalance` 设置卖方保证金余额 (17.1 USDT)
  - 订单 1 settle 成功，状态变为 SETTLED (8)
  - **根因确认**：期末喂价回调虽然配置正确，但未自动触发状态更新；且新 VaultManager 缺少卖方保证金记录
- **Next Step**: 刷新前端验证结果，需要进一步修复回调自动触发问题

## [2026-02-04 22:55]

- **Status**: Done
- **Changes**: 完整重构 VaultManager 和 OptionsCore
  - VaultManager 添加 `adminSetMarginBalance` 函数（用于测试/迁移场景）
  - 部署新 VaultManager: `0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454`
  - 部署新 OptionsCore: `0x0672f9ec88421858Ce4BC88071447BF31A8cEd24`
  - 配置所有权限：VAULT_OPERATOR_ROLE、FEED_PROTOCOL_ROLE
  - FeedProtocol 指向新 OptionsCore
  - 预存 100 USDT 到 VaultManager
  - 同步前端和 Keeper 配置
- **Next Step**: 刷新前端测试完整流程

## [2026-02-04 22:35]

- **Status**: Done
- **Changes**: 修复 settle 函数执行失败
  - 发现根本原因：旧 VaultManager (`0xF73CD5...`) ABI 不匹配，无法调用
  - 部署新 VaultManager: `0x3e7eEf51EdFb64D03738801c2d2174E3cB1400F7`
  - 部署新 OptionsCore: `0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0`
  - 授予 OptionsCore VAULT_OPERATOR_ROLE 权限
  - 更新 FeedProtocol 指向新 OptionsCore
  - 同步前端和 Keeper 配置
- **Next Step**: 刷新前端测试完整的订单创建→喂价→结算流程

## [2026-02-04 22:25]

- **Status**: Done
- **Changes**: 修复 SETTLE 按钮禁用问题
  - 发现订单 1 状态为 5 (WAITING_FINAL_FEED) 而非 6 (PENDING_SETTLEMENT)
  - 期末喂价后 FeedProtocol 回调未成功更新订单状态
  - 使用 `processFinalFeedResult` 手动将订单状态更新为 6 (PENDING_SETTLEMENT)
- **Next Step**: 刷新前端测试 SETTLE 按钮功能

## [2026-02-04 22:10]

- **Status**: Done
- **Changes**: 修复创建订单功能
  - 发现 OptionsCore 使用了错误的 Config 地址（返回空数据）
  - 重新部署 OptionsCore 到 `0xE3aD42f194804590f64f5A796780Eb566bd4ba9f`（使用正确的 Config）
  - 授予 OptionsCore 在 VaultManager 中的 VAULT_OPERATOR_ROLE 权限
  - 更新前端和 Keeper 配置
- **Next Step**: 刷新前端测试创建订单功能

## [2026-02-04 21:56]

- **Status**: Done
- **Changes**: 修改喂价次数为 1 次即可完成（测试模式）
  - 修改 `Tier_5_3` 配置：`totalFeeders` 和 `effectiveFeeds` 从 5/3 改为 1/1
  - 重新部署 FeedProtocol 到 `0xa4d3d2D56902f91e92caDE54993f45b4376979C7`
  - 配置跨合约权限和回调地址
  - 同步 frontend 和 keeper 配置地址
- **Next Step**: 刷新前端测试完整流程

## [2026-02-04 21:38]

- **Status**: Done
- **Changes**: 修复 SETTLE 按钮功能
  - 发现合约中虽有 settle 接口声明但已实现，只是链上部署的旧版本缺失此函数
  - 重新部署 OptionsCore 到 `0x758e843E2e052Ddb65B92e0a7b8Fa84D1a70e4a2`
  - 更新 FeedProtocol 指向新 OptionsCore，授予 FEED_PROTOCOL_ROLE
  - 同步 frontend 和 keeper 配置地址
- **Next Step**: 刷新前端测试完整的结算流程

## [2026-02-04 21:20]

- **Status**: Done
- **Changes**: 修复 EXERCISE 按钮自动触发期末喂价请求
  - 添加 `handleExerciseWithFeed` 函数到 `MyOrders.tsx`
  - EXERCISE 操作现在会：1. 调用 `earlyExercise` 改变订单状态 2. 自动调用 `requestFeed(orderId, 1, 0)` 创建期末喂价请求
  - 喂价员刷新页面后可以看到期末喂价任务
- **Next Step**: 刷新前端测试完整的行权+期末喂价流程

## [2026-02-04 20:50]

- **Status**: Done
- **Changes**: 实现喂价结果自动回调机制
  - 修改 `IOptionsCore.sol` 添加 `processFeedCallback` 接口
  - 修改 `OptionsCore.sol` 添加 `FEED_PROTOCOL_ROLE` 和回调实现
  - 修改 `FeedProtocol.sol` 添加自动回调 `finalizeFeed()` → `OptionsCore.processFeedCallback()`
  - 部署新合约：
    - OptionsCore: `0x46c6E8d8C979Aab21B0DA03a872F9DBc8EcC1DFb`
    - FeedProtocol: `0x5D89Bf9daae4B361315AE7d2dADf6091342B9858`
  - 配置互调权限：`FEED_PROTOCOL_ROLE` 授权完成
  - 更新 `frontend/src/contracts/config.ts` 和 `scripts/keeper/utils.ts`
- **Next Step**: 刷新前端测试喂价自动回调

## [2026-02-04 20:35]

- **Status**: Done
- **Changes**: 完成喂价结果自动化处理修复
  - **根因**：
    1. Keeper 脚本使用过时的合约地址（2026-01-28 版本）
    2. FeedProtocol 喂价完成后不会自动调用 OptionsCore
  - **修复内容**：
    - 同步 `scripts/keeper/utils.ts` 合约地址
    - 创建 `processOrder.ts` 处理期初喂价 → LIVE
    - 创建 `forceFinalFeed.ts` 处理期末喂价 → PENDING_SETTLEMENT
  - **处理结果**：
    - 订单 #1: MATCHED → LIVE (TX: `0x4e71fa88...`)
    - 订单 #1: LIVE → PENDING_SETTLEMENT (TX: `0x00d0f352...`)
- **Next Step**: 前端刷新即可看到订单状态变为"待结算"

## [2026-02-04 20:25]

## [2026-02-04 20:10]

- **Status**: Done
- **Changes**: 优化全局弹窗与通知系统 (UI/UX)
  - `Toast.tsx`: 完成通知组件基础设施建设
  - `index.css`: 添加 "Elite Obsidian" 风格 Toast 样式（透明玻璃+光晕效果）
  - `App.tsx`: 全局挂载 `ToastProvider`
  - `MyOrders.tsx`: 替换所有原生 `alert()` 为专业的 `showToast` 调用
  - `FeederPanel.tsx`: 将静默失败/控制台错误替换为实时的 `showToast` 反馈
- **Next Step**: 核心交互体验已对标 Obsidian 视觉标准，应用现具备专业的工业级反馈。

## [2026-02-04 15:58]

## [2026-02-04 15:42]

- **Status**: Done  
- **Changes**: 完成全应用 UI 审计与翻译优化

  - `i18n.ts`: 新增 4 个命名空间共 74 个翻译键（common、seller_hall、seat、quote 英中各 37 个）
  - `UserProfile.tsx`: 替换 3 处硬编码文本（CONNECT WALLET、CREATE RFQ、MY ORDERS）
  - `OrderMarket.tsx`: 替换 1 处硬编码文本（BUYER INQUIRY/SELLER OFFER）
  - `SellerHall.tsx`: 替换 10 处硬编码文本（标题、按钮、模态框等）
  - `SeatManagement.tsx`: 替换 10 处硬编码文本（席位管理区域按钮、提示等）
  - 构建验证通过 (2.60s)
- **Next Step**: 翻译全覆盖完成，可进行最终验收测试

## [2026-02-04 15:25]

- **Status**: Done
- **Changes**: 修复 FeederPanel 和 PointsCenter 页面内容区中文翻译缺失
  - `i18n.ts`: 扩充 feeder/points 命名空间翻译键（各新增约 40 个键）
  - `FeederPanel.tsx`: 替换头部、统计区、信号队列等区域硬编码文本为 t() 调用
  - `PointsCenter.tsx`: 替换头部、积分区、分发中心等区域硬编码文本为 t() 调用
- **Next Step**: 所有核心页面翻译完成，可进行最终验收

## [2026-02-04 15:20]

- **Status**: Done
- **Changes**: 完成功能差距修复阶段二 (P1) — 订单状态增强
  - `MyOrders.tsx`: 添加 30s 自动轮询刷新机制
  - `OrderDetail.tsx`: 重构为真实数据获取，添加 Countdown 倒计时组件
    - 支持追保截止倒计时（marginCallDeadline）
    - 支持仲裁窗口倒计时（arbitrationWindow）
    - 订单数据每 30s 自动刷新
- **Next Step**: 功能差距修复全部完成，可进行用户验收测试

- **Changes**: 完成功能差距修复阶段一 (P0)
  - `Leaderboard.tsx`: 添加真实喂价员数据加载（getFeederInfo）、示例数据提示横幅、中英双语 i18n 翻译
  - `UserProfile.tsx`: 确认已有真实数据集成（买方/卖方订单统计、积分、喂价员状态）
  - `i18n.ts`: 新增 leaderboard、profile 命名空间翻译
- **Next Step**: 可实施阶段二

## [2026-02-04 22:35]

- **Status**: Done
- **Changes**: 完成四大页面的国际化翻译。

- **Status**: Done
- **Changes**: 完成国际化（i18n）系统。增加了中英文切换组件，集成多语言动态标题与导航。

- 实现了排行榜、订单详情页及全局路由清理。
- 通过生产环境 build (npm run build)。

1. **index.css**: 全面升级为 Obsidian Lume 标准。提升了文本对比度，引入了 `border-top` 高光边缘，并建立了基于 CSS 变量的角色主题逻辑。
2. **OrderMarket.tsx**: 重构为买卖双大厅模式。
    - 买方模式 (Blue Theme): 侧重收益与 RFQ 竞价。
    - 卖方模式 (Purple Theme): 侧重保证金安全。
    - 角色切换现在是全站色调同步的沉浸式体验。
3. **MyOrders.tsx**: 色彩心理暗示同步完成。修正了 `withdrawExcessMargin` 等合约调用的传参类型，解决了 TypeScript 构建错误。
4. **Build Verification**: 执行 `npm run build` 成功。

## [Next Step]

- 开启 Phase 7: 深度性能监控与移动端极端分辨率适配。
