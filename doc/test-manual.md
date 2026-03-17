# NST × FeedEngine 联调测试手册

> 更新时间：2026-03-12
> 测试目标：验证 OptionsCore + OptionsSettlement + FeedProtocol 三合约架构完整性

---

## 一、合约地址 (BSC Testnet, ChainID: 97)

| 合约 | 地址 |
|------|------|
| OptionsCore | `0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a` |
| OptionsSettlement | `0x8DF881593368FD8be3F40722fcb9f555593a8257` |
| FeedProtocol | `0x98BA4261835533FEBf2335a4edA04d1a69D45311` |
| Config | `0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea` |
| VaultManager | `0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454` |
| USDT | `0x6ae0833E637D1d99F3FCB6204860386f6a6713C0` |
| FeedEngine钱包 | `0xFF486124612662E74F3055a71f45EAD3451d1CD9` |

---

## 二、服务启动指南

### 2.1 NST 前端 (Vite + React)

```powershell
# 终端1：进入前端目录并启动
cd F:\Unstandardized_Products\NST\frontend
npm run dev
```

启动成功标志：
```
VITE v7.3.0  ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

配置文件：`frontend/src/contracts/config.ts` — 合约地址配置
ABI文件：`frontend/src/contracts/abis.ts` — 包含 OptionsCoreABI + OptionsSettlementABI

### 2.2 FeedEngine 后端 (Express + Prisma)

```powershell
# 终端2：进入FeedEngine后端目录并启动
cd F:\Unstandardized_Products\FeedEngine\feed-engine-backend
npm run dev
```

启动成功标志：
```
🚀 Feed Engine Backend running on port 3001
📡 WebSocket server ready
⛓️ Blockchain services initialized
NST_OPTIONS_CORE: 0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a
📡 Event listeners started for all contracts
```

> ⚠️ Redis 重连警告可以忽略，后端有内存降级模式。

配置文件：`feed-engine-backend/.env` — 包含 `NST_OPTIONS_CORE_CONTRACT` 和 `NST_FEED_PROTOCOL_CONTRACT` 地址

### 2.3 FeedEngine 前端 (Vite + React)

```powershell
# 终端3：进入FeedEngine前端目录并启动
cd F:\Unstandardized_Products\FeedEngine\feed-engine
npx vite --port 5174
```

启动成功标志：
```
VITE ready
  ➜  Local:   http://localhost:5174/
```

### 2.4 端口总览

| 服务 | 端口 | 地址 |
|------|------|------|
| NST 前端 | 5173 | http://localhost:5173 |
| FeedEngine 前端 | 5174 | http://localhost:5174 |
| FeedEngine 后端 | 3001 | http://localhost:3001 |

### 2.5 验证所有服务是否运行

```powershell
netstat -aon | findstr "LISTENING" | findstr "5173 5174 3001"
```

期望输出包含三个端口的 LISTENING 状态。

### 2.6 启动前检查清单

- [ ] MetaMask 已安装并切换到 BSC Testnet (ChainId 97)
- [ ] 测试钱包有足够 tBNB（用于gas费）
- [ ] 测试钱包有 USDT（用于建仓费、保证金等）
- [ ] 三个服务都已启动

---

## 三、测试用例

### TC-01：NST前端 — 连接钱包

**操作**：打开 http://localhost:5173 → 点击连接钱包

**验证**：
- [ ] MetaMask 弹窗请求连接
- [ ] 连接成功后显示钱包地址
- [ ] F12控制台输出：
  ```
  OptionsCore contract initialized: 0x98505ce9...
  OptionsSettlement contract initialized: 0x8df88159...
  ```
- [ ] 无报错

> **如果只看到 `OptionsCore initialized` 但没有 `OptionsSettlement initialized`**：
> 检查 `config.ts` 是否有 OptionsSettlement 地址

---

### TC-02：FeedEngine前端 — 连接钱包

**操作**：打开 http://localhost:5174 → 点击 ENGAGE NODE 连接钱包

**验证**：
- [ ] MetaMask 弹窗
- [ ] 登录成功，界面切换到已登录状态
- [ ] 无 CORS 报错

> **如果报 `Failed to fetch` CORS 错误**：
> 1. 确认 FeedEngine 后端 `src/index.ts` 中 CORS origin 包含 `http://localhost:5174`
> 2. 确认 `cors()` 中间件在 `helmet()` 之前
> 3. 重启后端

---

### TC-03：创建买方RFQ (→ OptionsCore)

**操作**：NST前端 → 创建订单页面 → 填写：
- 标的：Apple / 600519 等
- 方向：看涨 (Call)
- 名义本金：100 USDT
- 到期时间：7天后
- 最高费率：5%，最低保证金率：10%

**验证**：
- [ ] 首次需要 USDT 授权（Approve交易）
- [ ] 建仓费 1 USDT 扣除（Config.creationFee）
- [ ] 交易成功，订单状态 = `RFQ_CREATED`
- [ ] 订单出现在"买方订单"列表

> 此操作调用 **OptionsCore.createBuyerRFQ**

---

### TC-04：卖方报价 + 接受报价 (→ OptionsCore)

**操作**：
1. 找到 TC-03 的订单 → 提交报价（费率3%，保证金率15%）
2. 买方接受报价

**验证**：
- [ ] submitQuote 交易成功
- [ ] acceptQuote 交易成功
- [ ] 订单状态变为 `MATCHED`

> 此操作调用 **OptionsCore.submitQuote** 和 **OptionsCore.acceptQuote**

---

### TC-05：发起喂价请求 (→ FeedProtocol → FeedEngine)

**前置**：订单为 MATCHED 状态

**操作**：在订单详情中点击"发起喂价" → **弹出喂价档位选择弹窗** → 选择档位（BASIC/STANDARD/PREMIUM） → 确认

**验证**：
- [ ] 弹窗正确显示三个档位及费用
- [ ] requestFeedPublic 交易成功（USDT 扣除喂价费）
- [ ] 前端按钮变为「⏳ 喂价请求已发起，等待喂价员提交价格...」
- [ ] **FeedEngine 后端日志**显示收到 `FeedRequested` 事件
- [ ] 事件数据包含真实的 underlyingName/underlyingCode（不再是空字符串）

> **这是 NST × FeedEngine 联调核心验证点**
> 如果 FeedEngine 没收到事件：
> 1. 检查 `.env` 中 `NST_FEED_PROTOCOL_CONTRACT` = `0x98BA4261835533FEBf2335a4edA04d1a69D45311`
> 2. 确认后端已重启
> 3. 注意：喂价请求通过 **FeedProtocol.requestFeedPublic** 发起，事件名称是 `FeedRequested`（不是 `FeedRequestEmitted`）

---

### TC-06：喂价完成回调 (→ FeedProtocol → OptionsCore)

**前置**：TC-05 完成

**操作**：喂价员在 FeedEngine 前端提交价格 → 达到法定人数后 FeedProtocol._finalizeFeed 自动回调

**验证**：
- [ ] FeedProtocol 自动调用 OptionsCore.processFeedCallback 成功
- [ ] 订单状态 → `LIVE`（期初喂价后）
- [ ] `lastFeedPrice` 更新为喂价结果
- [ ] NST 前端刷新后订单从「等待喂价」变为「持仓中」

---

### TC-07：追加保证金 (→ OptionsSettlement) ⭐

**前置**：订单为 LIVE 状态

**操作**：卖方点击"追加保证金" → 输入金额

**验证**：
- [ ] addMargin 交易成功
- [ ] currentMargin 增加
- [ ] 触发 MarginChanged 事件

> ⭐ 这是首次验证 **OptionsSettlement** 合约写操作

---

### TC-08：提取超额保证金 (→ OptionsSettlement)

**前置**：保证金有超额

**操作**：卖方点击"提取超额保证金" → 输入金额

**验证**：
- [ ] withdrawExcessMargin 交易成功
- [ ] currentMargin 减少
- [ ] USDT 余额增加

---

### TC-09：提前行权 (→ OptionsSettlement)

**前置**：订单为 LIVE 状态

**操作**：买方点击"提前行权"

**验证**：
- [ ] earlyExercise 交易成功（或正确revert提示原因）

---

### TC-10：到期结算 (→ OptionsSettlement)

**前置**：订单为 PENDING_SETTLEMENT 状态

**操作**：点击"结算" 或等待 settleKeeper 自动执行

**验证**：
- [ ] settle 交易成功
- [ ] 订单状态 → `SETTLED`
- [ ] buyerPayout / sellerPayout 正确

---

### TC-11：发起仲裁 (→ OptionsSettlement)

**前置**：订单为 PENDING_SETTLEMENT 状态（结算前窗口期）

**操作**：一方点击"发起仲裁"

**验证**：
- [ ] initiateArbitration 交易成功（收取 30 USDT 仲裁费）
- [ ] 订单状态 → `ARBITRATION`

---

## 四、合约函数归属速查

| 函数 | 合约 | 说明 |
|------|------|------|
| createBuyerRFQ | OptionsCore | 创建买方询价 |
| createSellerOrder | OptionsCore | 创建卖方挂单 |
| submitQuote | OptionsCore | 卖方报价 |
| acceptQuote | OptionsCore | 接受报价 |
| cancelRFQ | OptionsCore | 取消询价 |
| requestFeed | OptionsCore | 发起喂价（内部路径） |
| **requestFeedPublic** | **FeedProtocol** | **发起喂价（前端路径，emit 真实数据）** |
| acceptSellerOrder | OptionsCore | 承接卖方单 |
| processFeedCallback | OptionsCore | FeedEngine回调 |
| **settle** | **OptionsSettlement** | 到期结算 |
| **earlyExercise** | **OptionsSettlement** | 提前行权 |
| **addMargin** | **OptionsSettlement** | 追加保证金 |
| **withdrawExcessMargin** | **OptionsSettlement** | 提取超额保证金 |
| **initiateArbitration** | **OptionsSettlement** | 发起仲裁 |
| **forceLiquidate** | **OptionsSettlement** | 强制清算 |
| **triggerMarginCall** | **OptionsSettlement** | 触发追保 |

---

## 五、故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| 前端报 `Contract not initialized` | 钱包未连接或合约地址为空 | 检查 `config.ts` |
| 控制台只有 OptionsCore initialized | OptionsSettlement 地址缺失 | 确认 `config.ts` 有 OptionsSettlement |
| addMargin/settle 失败 | 调用了错误的合约 | 确认 `useContracts.ts` 调用 `optionsSettlement` |
| `VAULT_OPERATOR_ROLE` 错误 | VaultManager 未授权 | 运行 `scripts/grant-vault-operator.ts` |
| FeedEngine 收不到事件 | 监听旧 FeedProtocol 地址 | 更新 `.env` 中 `NST_FEED_PROTOCOL_CONTRACT` 并重启 |
| 喂价事件数据为空 | 使用旧版 FeedProtocol | 确认 FeedProtocol 地址为 `0x98BA...` |
| 喂价档位弹窗费用显示 "..." | 合约无 getFeedFee 或地址错 | 检查 config.ts FeedProtocol 地址 |
| settle revert | 订单状态不对 | 确认订单经过完整喂价流程 |
| FeedEngine CORS 错误 | 后端CORS未配置5174 | 确认 `index.ts` 中 cors 在 helmet 前 |

---

## 六、自动化联调测试（已通过）

```powershell
cd F:\Unstandardized_Products\NST
npx hardhat run scripts/integration-test.ts --network bscTestnet
```

已通过 24/24 测试项，覆盖：合约部署、角色权限、读写操作、跨合约调用、撮合流程。
