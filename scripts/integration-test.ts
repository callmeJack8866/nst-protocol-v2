/**
 * integration-test.ts
 * 
 * 合约拆分后联调测试脚本
 * 验证 OptionsCore + OptionsSettlement 双合约架构完整性
 * 
 * 测试项目：
 * 1. 合约部署验证（地址、角色）
 * 2. OptionsCore 读写测试（createBuyerRFQ）
 * 3. OptionsSettlement 跨合约调用测试
 * 4. 完整链路：创建 → 报价 → 撮合
 * 
 * 用法: npx hardhat run scripts/integration-test.ts --network bscTestnet
 */

import { ethers } from "hardhat";

// ==================== 合约地址（来自 deployed-addresses.json）====================
const ADDRESSES = {
    OptionsCore: '0x98505CE913E9Dc70142Ca6C9ca0c9a1af3EfA19a',
    OptionsSettlement: '0x8DF881593368FD8be3F40722fcb9f555593a8257',
    Config: '0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea',
    VaultManager: '0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454',
    USDT: '0x6ae0833E637D1d99F3FCB6204860386f6a6713C0',
    FeedProtocol: '0x45E4ee36e6fA443a7318cd549c6AC20d83b6C1A7',
    // FeedEngine 后端钱包（非合约，仅供参考）
    FeedEngine: '0xFF486124612662E74F3055a71f45EAD3451d1CD9',
};

// ==================== 计数器 ====================
let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name: string) {
    passed++;
    console.log(`  ✅ ${name}`);
}
/** 分类失败原因并标记 */
function fail(name: string, reason: string) {
    failed++;
    let tag = '[链上逻辑]';
    if (reason.includes('not authorized') || reason.includes('AccessControl') || reason.includes('role') || reason.includes('not settlement')) {
        tag = '[权限配置]';
    } else if (reason.includes('insufficient') || reason.includes('exceeds balance') || reason.includes('余额不足') || reason.includes('Config:')) {
        tag = '[参数问题]';
    }
    console.log(`  ❌ ${tag} ${name}: ${reason}`);
}
function skip(name: string, reason: string) {
    skipped++;
    console.log(`  ⏭️  ${name}: ${reason}`);
}

// ==================== 主测试 ====================
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("═══════════════════════════════════════════════");
    console.log("  NST 合约拆分联调测试");
    console.log(`  测试钱包: ${deployer.address}`);
    console.log("═══════════════════════════════════════════════\n");

    // 获取合约实例
    const optionsCore = await ethers.getContractAt("OptionsCore", ADDRESSES.OptionsCore);
    const optionsSettlement = await ethers.getContractAt("OptionsSettlement", ADDRESSES.OptionsSettlement);
    const config = await ethers.getContractAt("Config", ADDRESSES.Config);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);

    // ==================== Test 1: 合约部署验证 ====================
    console.log("📋 Test 1: 合约部署验证");

    try {
        const coreCode = await ethers.provider.getCode(ADDRESSES.OptionsCore);
        if (coreCode !== '0x') pass("OptionsCore 合约存在");
        else fail("OptionsCore 合约存在", "无bytecode");
    } catch (e: any) { fail("OptionsCore 合约存在", e.message); }

    try {
        const settlementCode = await ethers.provider.getCode(ADDRESSES.OptionsSettlement);
        if (settlementCode !== '0x') pass("OptionsSettlement 合约存在");
        else fail("OptionsSettlement 合约存在", "无bytecode");
    } catch (e: any) { fail("OptionsSettlement 合约存在", e.message); }

    // ==================== Test 2: 角色验证 ====================
    console.log("\n📋 Test 2: 角色权限验证");

    try {
        const SETTLEMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
        const hasSettlement = await optionsCore.hasRole(SETTLEMENT_ROLE, ADDRESSES.OptionsSettlement);
        if (hasSettlement) pass("OptionsSettlement 拥有 SETTLEMENT_ROLE");
        else fail("OptionsSettlement 拥有 SETTLEMENT_ROLE", "角色未授予");
    } catch (e: any) { fail("SETTLEMENT_ROLE 验证", e.message); }

    try {
        const FEED_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
        // ★ 关键检查：FeedProtocol 合约地址必须拥有此角色（自动回调路径）
        const hasFeedProtocol = await optionsCore.hasRole(FEED_ROLE, ADDRESSES.FeedProtocol);
        if (hasFeedProtocol) pass("FeedProtocol 合约拥有 FEED_PROTOCOL_ROLE（自动回调路径）");
        else fail("FeedProtocol 合约拥有 FEED_PROTOCOL_ROLE", `合约 ${ADDRESSES.FeedProtocol} 未被授权，自动回调和 onFeedRequested 将无法工作`);

        // 可选：FeedEngine 后端钱包（旧 keeper 后备路径）
        const hasFeedEngine = await optionsCore.hasRole(FEED_ROLE, ADDRESSES.FeedEngine);
        if (hasFeedEngine) pass("FeedEngine 钱包拥有 FEED_PROTOCOL_ROLE（keeper 后备）");
        else skip("FeedEngine 钱包 FEED_PROTOCOL_ROLE", "未授予（keeper 后备路径，非必需）");
    } catch (e: any) { fail("FEED_PROTOCOL_ROLE 验证", e.message); }

    try {
        const vaultManager = await ethers.getContractAt("VaultManager", ADDRESSES.VaultManager);
        const VAULT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const hasVaultCore = await vaultManager.hasRole(VAULT_ROLE, ADDRESSES.OptionsCore);
        const hasVaultSettlement = await vaultManager.hasRole(VAULT_ROLE, ADDRESSES.OptionsSettlement);
        if (hasVaultCore) pass("OptionsCore 拥有 VAULT_OPERATOR_ROLE");
        else fail("OptionsCore 拥有 VAULT_OPERATOR_ROLE", "角色未授予");
        if (hasVaultSettlement) pass("OptionsSettlement 拥有 VAULT_OPERATOR_ROLE");
        else fail("OptionsSettlement 拥有 VAULT_OPERATOR_ROLE", "角色未授予");
    } catch (e: any) { fail("VAULT_OPERATOR_ROLE 验证", e.message); }

    // ==================== Test 3: OptionsCore 读函数 ====================
    console.log("\n📋 Test 3: OptionsCore 读函数");

    let nextOrderId: bigint;
    try {
        nextOrderId = await optionsCore.nextOrderId();
        pass(`nextOrderId() = ${nextOrderId}`);
    } catch (e: any) {
        fail("nextOrderId()", e.message);
        nextOrderId = 1n;
    }

    try {
        const nextQuoteId = await optionsCore.nextQuoteId();
        pass(`nextQuoteId() = ${nextQuoteId}`);
    } catch (e: any) { fail("nextQuoteId()", e.message); }

    // 如果有订单，测试 getOrder
    if (nextOrderId > 1n) {
        try {
            const order = await optionsCore.getOrder(1);
            pass(`getOrder(1) → buyer=${order.buyer.slice(0, 10)}..., status=${order.status}`);
        } catch (e: any) { fail("getOrder(1)", e.message); }
    } else {
        skip("getOrder(1)", "暂无订单");
    }

    // ==================== Test 4: OptionsSettlement 跨合约读取 ====================
    console.log("\n📋 Test 4: OptionsSettlement 跨合约读取");

    try {
        const settlementCoreAddr = await optionsSettlement.optionsCore();
        if (settlementCoreAddr.toLowerCase() === ADDRESSES.OptionsCore.toLowerCase()) {
            pass(`OptionsSettlement.optionsCore() 指向正确的 OptionsCore`);
        } else {
            fail("OptionsSettlement.optionsCore()", `指向 ${settlementCoreAddr}，应为 ${ADDRESSES.OptionsCore}`);
        }
    } catch (e: any) { fail("OptionsSettlement.optionsCore()", e.message); }

    try {
        const settlementConfig = await optionsSettlement.config();
        if (settlementConfig.toLowerCase() === ADDRESSES.Config.toLowerCase()) {
            pass(`OptionsSettlement.config() 指向正确的 Config`);
        } else {
            fail("OptionsSettlement.config()", `指向 ${settlementConfig}，应为 ${ADDRESSES.Config}`);
        }
    } catch (e: any) { fail("OptionsSettlement.config()", e.message); }

    // ==================== Test 5: Config 参数读取 ====================
    console.log("\n📋 Test 5: Config 参数读取");

    try {
        const creationFee = await config.creationFee();
        pass(`Config.creationFee() = ${ethers.formatEther(creationFee)} USDT`);
    } catch (e: any) { fail("Config.creationFee()", e.message); }

    try {
        const arbitrationFee = await config.arbitrationFee();
        pass(`Config.arbitrationFee() = ${ethers.formatEther(arbitrationFee)} USDT`);
    } catch (e: any) { fail("Config.arbitrationFee()", e.message); }

    // ==================== Test 6: 创建买方RFQ (写操作) ====================
    console.log("\n📋 Test 6: OptionsCore 写操作 (createBuyerRFQ)");

    try {
        // 检查 USDT 余额
        const balance = await usdt.balanceOf(deployer.address);
        const creationFee = await config.creationFee();
        console.log(`    USDT余额: ${ethers.formatEther(balance)}, 建仓费: ${ethers.formatEther(creationFee)}`);

        if (balance < creationFee) {
            skip("createBuyerRFQ", `USDT余额不足 (${ethers.formatEther(balance)} < ${ethers.formatEther(creationFee)})`);
        } else {
            // 先 approve USDT
            const allowance = await usdt.allowance(deployer.address, ADDRESSES.VaultManager);
            if (allowance < creationFee) {
                console.log("    → 授权 USDT...");
                const approveTx = await usdt.approve(ADDRESSES.VaultManager, ethers.parseEther("100"));
                await approveTx.wait();
                pass("USDT approve 成功");
            }

            // 创建 RFQ
            const expiryTime = Math.floor(Date.now() / 1000) + 86400 * 7; // 7天后
            const notional = ethers.parseEther("100"); // 100 USDT

            console.log("    → 创建买方RFQ...");
            const tx = await optionsCore.createBuyerRFQ(
                "TEST-INTEGRATION",    // underlyingName
                "TEST",                // underlyingCode
                "TEST_MARKET",         // market
                "CN",                  // country
                "100.00",              // refPrice
                0,                     // direction (Call)
                notional,              // notionalUSDT
                expiryTime,            // expiryTimestamp
                500,                   // maxPremiumRate (5%)
                1000,                  // minMarginRate (10%)
                0,                     // acceptedSellerType (FreeSeller)
                ethers.ZeroAddress,    // designatedSeller
                86400,                 // arbitrationWindow (24h)
                43200,                 // marginCallDeadline (12h)
                false,                 // dividendAdjustment
                0,                     // liquidationRule (NoLiquidation)
                0,                     // consecutiveDays
                0,                     // dailyLimitPercent
                0                      // feedRule (NormalFeed)
            );
            const receipt = await tx.wait();
            const newOrderId = await optionsCore.nextOrderId();
            pass(`createBuyerRFQ 成功 → OrderId=${Number(newOrderId) - 1}, txHash=${receipt?.hash?.slice(0, 16)}...`);

            // 验证订单
            const createdOrderId = Number(newOrderId) - 1;
            const order = await optionsCore.getOrder(createdOrderId);

            if (order.buyer.toLowerCase() === deployer.address.toLowerCase()) {
                pass(`订单验证: buyer=${order.buyer.slice(0, 10)}...`);
            } else {
                fail("订单buyer验证", `buyer=${order.buyer}, 预期=${deployer.address}`);
            }

            if (Number(order.status) === 0) { // RFQ_CREATED
                pass(`订单状态: RFQ_CREATED (${order.status})`);
            } else {
                fail("订单状态", `status=${order.status}, 预期=0`);
            }

            if (order.underlyingName === "TEST-INTEGRATION") {
                pass(`订单标的: ${order.underlyingName}`);
            } else {
                fail("订单标的", `name=${order.underlyingName}`);
            }

            // ==================== Test 7: 卖方报价 + 买方接受 ====================
            console.log("\n📋 Test 7: 卖方报价 + 买方接受 (submitQuote + acceptQuote)");

            // 用同一个钱包模拟卖方（测试网环境）
            // 需要先 approve marginAmount 给 OptionsCore
            const premiumRate = 300; // 3%
            const marginRate = 1500; // 15%
            const premiumAmount = (notional * BigInt(premiumRate)) / 10000n;
            const marginAmount = (notional * BigInt(marginRate)) / 10000n;
            const totalNeeded = premiumAmount + marginAmount;

            const sellerBalance = await usdt.balanceOf(deployer.address);
            if (sellerBalance < totalNeeded) {
                skip("submitQuote", `USDT余额不足: ${ethers.formatEther(sellerBalance)} < ${ethers.formatEther(totalNeeded)}`);
            } else {
                // approve for margin deposit
                const currentAllowance = await usdt.allowance(deployer.address, ADDRESSES.VaultManager);
                if (currentAllowance < totalNeeded) {
                    const approveTx2 = await usdt.approve(ADDRESSES.VaultManager, ethers.parseEther("1000"));
                    await approveTx2.wait();
                }

                console.log("    → 卖方提交报价...");
                const quoteTx = await optionsCore.submitQuote(
                    createdOrderId,
                    premiumRate,
                    marginRate,
                    0, // liquidationRule
                    0, // consecutiveDays
                    0  // dailyLimitPercent
                );
                await quoteTx.wait();
                const newQuoteId = await optionsCore.nextQuoteId();
                const quoteId = Number(newQuoteId) - 1;
                pass(`submitQuote 成功 → QuoteId=${quoteId}`);

                // 验证报价
                const quote = await optionsCore.quotes(quoteId);
                if (Number(quote.premiumRate) === premiumRate) {
                    pass(`报价费率: ${premiumRate} 基点`);
                } else {
                    fail("报价费率", `${quote.premiumRate}, 预期=${premiumRate}`);
                }

                // 买方接受报价
                console.log("    → 买方接受报价...");
                // Premium需要额外approve
                const premiumAllowance = await usdt.allowance(deployer.address, ADDRESSES.VaultManager);
                if (premiumAllowance < premiumAmount) {
                    const approveTx3 = await usdt.approve(ADDRESSES.VaultManager, ethers.parseEther("1000"));
                    await approveTx3.wait();
                }

                const acceptTx = await optionsCore.acceptQuote(quoteId);
                await acceptTx.wait();

                // 验证订单状态变为 MATCHED
                const matchedOrder = await optionsCore.getOrder(createdOrderId);
                if (Number(matchedOrder.status) === 2) { // MATCHED
                    pass(`acceptQuote 成功 → 订单状态: MATCHED`);
                } else {
                    fail("acceptQuote 状态", `status=${matchedOrder.status}, 预期=2(MATCHED)`);
                }

                // ==================== Test 8: OptionsSettlement 跨合约调用测试 ====================
                console.log("\n📋 Test 8: OptionsSettlement 跨合约读取已撮合订单");

                // Settlement 通过 optionsCore.getOrder 读取
                // 但无法直接调用 settle（因为状态要求 PENDING_SETTLEMENT）
                // 测试它能否正确读到订单数据
                try {
                    // 直接调用 settle 应该 revert（因为状态不是 PENDING_SETTLEMENT）
                    try {
                        await optionsSettlement.settle.staticCall(createdOrderId);
                        fail("settle revert检查", "应该revert但没有");
                    } catch (e: any) {
                        if (e.message.includes("not pending settlement") || e.message.includes("reverted")) {
                            pass(`settle(${createdOrderId}) 正确revert: 订单非PENDING_SETTLEMENT状态`);
                        } else {
                            fail("settle revert检查", e.message);
                        }
                    }

                    // 测试 earlyExercise revert（状态不是 LIVE）
                    try {
                        await optionsSettlement.earlyExercise.staticCall(createdOrderId);
                        fail("earlyExercise revert检查", "应该revert但没有");
                    } catch (e: any) {
                        if (e.message.includes("not live") || e.message.includes("reverted")) {
                            pass(`earlyExercise(${createdOrderId}) 正确revert: 订单非LIVE状态`);
                        } else {
                            fail("earlyExercise revert检查", e.message);
                        }
                    }
                } catch (e: any) {
                    fail("Settlement跨合约读取", e.message);
                }
            }
        }
    } catch (e: any) {
        fail("createBuyerRFQ", e.message);
    }

    // ==================== Test 9: OptionsCore update函数权限验证 ====================
    console.log("\n📋 Test 9: OptionsCore update函数权限验证 (仅 SETTLEMENT_ROLE)");

    try {
        // 非SETTLEMENT_ROLE调用 updateOrderStatus 应该 revert
        try {
            await optionsCore.updateOrderStatus.staticCall(1, 7); // SETTLED
            fail("updateOrderStatus 权限", "非SETTLEMENT_ROLE调用应该revert");
        } catch (e: any) {
            if (e.message.includes("not settlement") || e.message.includes("reverted") || e.message.includes("AccessControl")) {
                pass("updateOrderStatus 正确拒绝非SETTLEMENT_ROLE调用");
            } else {
                fail("updateOrderStatus 权限检查", e.message);
            }
        }

        try {
            await optionsCore.updateOrderMargin.staticCall(1, ethers.parseEther("10"));
            fail("updateOrderMargin 权限", "非SETTLEMENT_ROLE调用应该revert");
        } catch (e: any) {
            if (e.message.includes("not settlement") || e.message.includes("reverted") || e.message.includes("AccessControl")) {
                pass("updateOrderMargin 正确拒绝非SETTLEMENT_ROLE调用");
            } else {
                fail("updateOrderMargin 权限检查", e.message);
            }
        }
    } catch (e: any) {
        fail("权限验证", e.message);
    }

    // ==================== 测试报告 ====================
    console.log("\n═══════════════════════════════════════════════");
    console.log(`  测试完成: ✅ ${passed} 通过, ❌ ${failed} 失败, ⏭️  ${skipped} 跳过`);
    console.log("═══════════════════════════════════════════════");

    if (failed > 0) {
        console.log("\n⚠️  有测试失败，请检查上方错误信息");
        process.exit(1);
    } else {
        console.log("\n🎉 所有测试通过！合约拆分联调验证成功");
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
