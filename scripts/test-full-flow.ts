/**
 * test-full-flow.ts
 * 
 * 在当前合约上测试完整的 买方RFQ→卖方报价→成交→初始喂价→行权→终轮喂价 流程
 * 验证回调自动化是否正常工作
 * 
 * 日志分类：
 *   [链上逻辑] — 合约 revert 或状态不符预期
 *   [参数问题] — USDT 余额/精度/传参不匹配
 *   [权限配置] — FEED_PROTOCOL_ROLE / SETTLEMENT_ROLE 等缺失
 *   [信息]     — 正常流程信息
 * 
 * 地址来源: deployed-addresses.json
 * 用法: npx hardhat run scripts/test-full-flow.ts --network bscTestnet
 */

// ==================== 日志分类 ====================
const LOG = {
    CHAIN:  '[链上逻辑]',
    PARAM:  '[参数问题]',
    PERM:   '[权限配置]',
    INFO:   '[信息]',
} as const;

/** 分类错误原因 */
function classifyError(msg: string): string {
    if (msg.includes('not authorized') || msg.includes('AccessControl') || msg.includes('role') || msg.includes('not settlement') || msg.includes('not feeder')) {
        return LOG.PERM;
    }
    if (msg.includes('insufficient') || msg.includes('exceeds balance') || msg.includes('余额不足')) {
        return LOG.PARAM;
    }
    if (msg.includes('Config:') || msg.includes('too ')) {
        return LOG.PARAM;
    }
    return LOG.CHAIN;
}

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // ==================== 合约地址（来自 deployed-addresses.json）====================
    const OPTIONS_CORE_ADDRESS = "0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a";
    const FEED_PROTOCOL_ADDRESS = "0x45E4ee36e6fA443a7318cd549c6AC20d83b6C1A7";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT_ADDRESS);

    // ==================== 权限自检 ====================
    console.log("\n=== Pre-check: FEED_PROTOCOL_ROLE ===");
    const FEED_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const hasFeedRole = await optionsCore.hasRole(FEED_ROLE, FEED_PROTOCOL_ADDRESS);
    console.log(`FeedProtocol (${FEED_PROTOCOL_ADDRESS}) has FEED_PROTOCOL_ROLE:`, hasFeedRole);
    if (!hasFeedRole) {
        console.log("⚠️ FeedProtocol 合约没有 FEED_PROTOCOL_ROLE，自动回调和 onFeedRequested 将无法工作！");
        console.log("   请先运行: optionsCore.grantRole(FEED_PROTOCOL_ROLE, feedProtocolAddress)");
    }

    // ==================== 工具函数 ====================
    /** 带重试的发送交易 */
    async function safeSendTx(
        label: string,
        txFn: (overrides: { nonce: number }) => Promise<any>,
    ): Promise<any> {
        const nonce = await deployer.getNonce();
        const feeData = await ethers.provider.getFeeData();
        // BSC Testnet: 用 gasPrice 模式，加 20% 防止 underpriced
        const gasPrice = (feeData.gasPrice || 5000000000n) * 120n / 100n;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const tx = await txFn({ nonce, gasPrice } as any);
                const receipt = await tx.wait();
                return receipt;
            } catch (e: any) {
                const msg = e.message || '';
                if (attempt < 3 && (msg.includes('underpriced') || msg.includes('nonce') || msg.includes('already known'))) {
                    console.log(`${LOG.INFO} ⚠ ${label} 第 ${attempt} 次失败 (${msg.slice(0, 80)})，等待 3s 重试...`);
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }
                throw e;
            }
        }
    }

    /** 检查 allowance 并在不足时 approve */
    async function ensureAllowance(spender: string, spenderName: string, required: bigint) {
        const current = await usdt.allowance(deployer.address, spender);
        if (current >= required) {
            console.log(`${LOG.INFO} ✓ ${spenderName} allowance 充足 (${ethers.formatEther(current)})，跳过 approve`);
            return;
        }
        console.log(`${LOG.INFO} ${spenderName} allowance 不足 (${ethers.formatEther(current)} < ${ethers.formatEther(required)})，发送 approve...`);
        await safeSendTx(`approve(${spenderName})`, (overrides) =>
            usdt.approve(spender, required, overrides)
        );
        console.log(`${LOG.INFO} ✓ ${spenderName} approved ${ethers.formatEther(required)}`);
    }

    console.log("\n=== Step 1: Approve USDT (allowance-aware) ===");
    const approveAmount = ethers.parseEther("10000");
    await ensureAllowance(VAULT_MANAGER_ADDRESS, "VaultManager", approveAmount);
    await ensureAllowance(FEED_PROTOCOL_ADDRESS, "FeedProtocol", approveAmount);
    console.log("✓ USDT allowance 就绪");

    // ==================== 买方创建 RFQ ====================
    console.log("\n=== Step 2: Create Buyer RFQ ===");
    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + 86400 * 30; // 30 days

    let orderId: bigint;
    try {
        const tx = await optionsCore.createBuyerRFQ(
            "测试标的",                 // underlyingName
            "TEST001",                 // underlyingCode
            "A股",                     // market
            "CN",                      // country
            "100",                     // refPrice
            0,                         // direction (Call)
            ethers.parseEther("10"),   // notionalUSDT (10 USDT)
            expiryTimestamp,           // expiryTimestamp
            500,                       // maxPremiumRate (5%)
            1000,                      // minMarginRate (10%) — config 最低 10%
            0,                         // acceptedSellerType (FreeSeller)
            ethers.ZeroAddress,        // designatedSeller (any)
            12 * 3600,                 // arbitrationWindow (12h) — 需在 [1h, 48h]
            2 * 3600,                  // marginCallDeadline (2h) — 需在 [1h, 24h]
            false,                     // dividendAdjustment
            0,                         // liquidationRule
            3,                         // consecutiveDays (≤ 10)
            10,                        // dailyLimitPercent
            0                          // feedRule (NormalFeed)
        );
        const receipt = await tx.wait();
        orderId = (await optionsCore.nextOrderId()) - 1n;
        console.log("✓ Buyer RFQ created! OrderId:", orderId.toString(), "TX:", receipt?.hash?.slice(0, 16));
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 创建 Buyer RFQ 失败: ${msg.slice(0, 300)}`);
        return;
    }

    let order = await optionsCore.getOrder(orderId);
    console.log("Order status:", order.status.toString(), "(expected: 0 = RFQ_CREATED)");

    // ==================== 卖方提交报价 ====================
    console.log("\n=== Step 3: Submit Quote (deployer as seller) ===");
    let quoteId: bigint;
    try {
        const quoteTx = await optionsCore.submitQuote(
            orderId,
            300,    // premiumRate (3%) — 需 ≤ maxPremiumRate
            1500,   // marginRate (15%) — 需 ≥ minMarginRate
            0,      // liquidationRule
            3,      // consecutiveDays (≤ 10)
            10      // dailyLimitPercent
        );
        await quoteTx.wait();
        quoteId = (await optionsCore.nextQuoteId()) - 1n;
        console.log("✓ Quote submitted! QuoteId:", quoteId.toString());

        order = await optionsCore.getOrder(orderId);
        console.log("Order status:", order.status.toString(), "(expected: 1 = QUOTING)");
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 提交报价失败: ${msg.slice(0, 300)}`);
        return;
    }

    // ==================== 买方接受报价 ====================
    console.log("\n=== Step 4: Accept Quote (deployer as buyer) ===");
    try {
        await (await optionsCore.acceptQuote(quoteId)).wait();
        order = await optionsCore.getOrder(orderId);
        console.log("✓ Quote accepted! Status:", order.status.toString(), "(expected: 2 = MATCHED)");
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 接受报价失败: ${msg.slice(0, 300)}`);
        return;
    }

    // ==================== 注册喂价员 ====================
    console.log("\n=== Step 5: Register as Feeder (if needed) ===");
    try {
        const feeder = await feedProtocol.getFeeder(deployer.address);
        if (!feeder.isActive) {
            console.log("Registering as feeder...");
            const stakeAmount = ethers.parseEther("100");
            await (await feedProtocol.registerFeeder(stakeAmount)).wait();
            console.log("✓ Registered as feeder");
        } else {
            console.log("✓ Already registered as feeder");
        }
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 喂价员注册检查失败: ${msg.slice(0, 200)}`);
        console.log(`${LOG.PERM}   请确认 FeedProtocol 合约是否已部署且地址正确`);
    }

    // ==================== 初始喂价 ====================
    console.log("\n=== Step 6: Create Initial Feed Request ===");
    let requestId;
    try {
        // requestFeedPublic(orderId, feedType, tier)
        // feedType: 0=Initial, 1=Dynamic, 2=Final
        const tx = await feedProtocol.requestFeedPublic(orderId, 0, 0); // Initial, Tier 0
        const receipt = await tx.wait();
        requestId = (await feedProtocol.nextRequestId()) - 1n;
        console.log("✓ Initial feed request created, ID:", requestId.toString());

        // 强制断言：requestFeedPublic 后订单状态必须已切换
        order = await optionsCore.getOrder(orderId);
        const statusAfterRequest = Number(order.status);
        console.log("Order status after requestFeedPublic:", statusAfterRequest);
        if (statusAfterRequest !== 3) {
            console.log("✗ FATAL: 订单状态未切换到 WAITING_INITIAL_FEED (3)！当前:", statusAfterRequest);
            console.log("  可能原因: FeedProtocol 缺少 FEED_PROTOCOL_ROLE 或 onFeedRequested 回滚");
            return;
        }
        console.log("✓ 订单状态已切换到 WAITING_INITIAL_FEED (3)");
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 创建初始喂价请求失败: ${msg.slice(0, 200)}`);
        if (msg.includes('role') || msg.includes('authorized')) {
            console.log(`${LOG.PERM}   → FeedProtocol 合约需要 FEED_PROTOCOL_ROLE: optionsCore.grantRole(FEED_PROTOCOL_ROLE, feedProtocolAddress)`);
        }
        if (msg.includes('VolumeBasedFeed') || msg.includes('feedRule')) {
            console.log(`${LOG.PARAM}   → 订单 feedRule=1 (跟量成交) 不能走 FeedProtocol，应走 VolumeBasedFeed 合约`);
        }
        return;
    }

    console.log("\n=== Step 7: Submit Initial Feed ===");
    const initialPrice = ethers.parseUnits("100", 18); // 100 USD
    try {
        await (await feedProtocol.submitFeed(requestId, initialPrice)).wait();
        console.log("✓ Initial feed submitted");

        order = await optionsCore.getOrder(orderId);
        console.log("Order status after initial feed:", order.status.toString());
        if (Number(order.status) === 4) {
            console.log("✓ processFeedCallback worked! Status → LIVE");
        } else {
            console.log("⚠️ Status not LIVE. Check CallbackFailed events.");
        }
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 提交初始喂价失败: ${msg.slice(0, 200)}`);
        if (msg.includes('not feeder') || msg.includes('not authorized')) {
            console.log(`${LOG.PERM}   → deployer 未注册为喂价员，请先注册`);
        }
    }

    // ==================== 终轮喂价 ====================
    console.log("\n=== Step 8: Create Final Feed Request ===");
    try {
        // feedType=2 (Final), tier=0
        await (await feedProtocol.requestFeedPublic(orderId, 2, 0)).wait();
        requestId = (await feedProtocol.nextRequestId()) - 1n;
        console.log(`${LOG.INFO} ✓ Final feed request created, ID: ${requestId.toString()}`);

        // 强制断言：requestFeedPublic 后订单状态必须切换到 WAITING_FINAL_FEED
        order = await optionsCore.getOrder(orderId);
        const statusAfterFinalReq = Number(order.status);
        console.log(`${LOG.INFO} 订单状态 after requestFeedPublic(Final): ${statusAfterFinalReq}`);
        if (statusAfterFinalReq !== 5) {
            console.log(`${LOG.CHAIN} ✗ FATAL: 订单状态未切换到 WAITING_FINAL_FEED (5)！当前: ${statusAfterFinalReq}`);
            console.log(`${LOG.PERM}   → 可能原因: FeedProtocol 缺少 FEED_PROTOCOL_ROLE 或 onFeedRequested 回滚`);
            return;
        }
        console.log(`${LOG.INFO} ✓ 订单状态已切换到 WAITING_FINAL_FEED (5)`);
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 创建终轮喂价请求失败: ${msg.slice(0, 200)}`);
        if (msg.includes('not live') || msg.includes('not in correct status')) {
            console.log(`${LOG.CHAIN}   → 订单当前状态不允许发起终轮喂价，请检查订单是否已进入 LIVE 状态`);
        }
        return;
    }

    console.log("\n=== Step 9: Submit Final Feed ===");
    const finalPrice = ethers.parseUnits("105", 18); // 105 USD (5% profit)
    try {
        await (await feedProtocol.submitFeed(requestId, finalPrice)).wait();
        console.log("✓ Final feed submitted");

        order = await optionsCore.getOrder(orderId);
        console.log("Order status after final feed:", order.status.toString());

        if (Number(order.status) === 6) {
            console.log("\n🎉 FULL FLOW SUCCESS! Status auto-updated to PENDING_SETTLEMENT");
        } else {
            console.log("\n⚠️ Callback did not update status. Current:", order.status.toString());

            // 检查 CallbackFailed 事件
            const filter = feedProtocol.filters.CallbackFailed();
            const events = await feedProtocol.queryFilter(filter, -1000);
            if (events.length > 0) {
                console.log("CallbackFailed events found:");
                for (const event of events) {
                    console.log("  Reason:", (event as any).args?.[2]);
                }
            }
        }
    } catch (e: any) {
        const msg = e.message || '';
        console.log(`${classifyError(msg)} 提交终轮喂价失败: ${msg.slice(0, 300)}`);
        if (msg.includes('not feeder') || msg.includes('not authorized')) {
            console.log(`${LOG.PERM}   → deployer 未注册为喂价员`);
        }
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
