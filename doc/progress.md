# FeedEngine Order Sync Progress

## [2026-03-24 16:15] Status: Done

### 修复 1: 喂价后订单消失 ✅
- `App.tsx` handleComplete: NST 订单更新状态而非删除

### 修复 2: NST 订单不受 tab 过滤 ✅
- `App.tsx` filteredOrders: NST 检查移到 tab 过滤之前

### 修复 3: 链上回写失败（submitter 未注册）✅
- `registerFeeder.ts` 注册 submitter 为活跃喂价员

### 修复 4: 过期请求阻塞新请求创建 ✅
- `FeedProtocol.sol` `_requireNoActiveFeedRequest`: 增加 `block.timestamp <= req.deadline` 检查
- 重新部署 FeedProtocol: `0x3ADc2a24943d3B9ADd5570A7ad2035Ef547c6E45`
- 设置 `setOptionsCore`, 配置 Tier(1 feeder), 授予所有角色

### 修复 5: nst-sync FINAL 请求被同 orderId 的 Initial 跳过 ✅
- `nst-sync.service.ts` 去重从 `externalOrderId` 改为 `externalOrderId + feedType`
- 增加过期请求跳过（`deadline > 0 && nowSec > deadline`）

### 修复 6: FeedEngine 按钮"协议繁忙" ✅
- `OrderDetailModal.tsx` 按钮只在 EXPIRED 状态禁用，其余都可操作

### 链上端到端验证 ✅
- requestFeedPublic(18, 2, 0) → req3 成功
- submitFeed(3, 200) → finalized=true, finalPrice=200.0
- OptionsCore: status 5→6 (WAITING_FINAL_FEED → PENDING_SETTLEMENT)

### Next Step
- 用户重启 FeedEngine 后端（代码+.env 改动）
- 在 NST 前端创建新订单测试完整流程
