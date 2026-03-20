/**
 * quick-test-full-flow.ts
 * 
 * 快速测试卖方建单流程
 * 自动检测 USDT 精度，避免精度不匹配导致假异常
 * 
 * 用法: npx hardhat run scripts/quick-test-full-flow.ts --network bscTestnet
 */

import { ethers } from "hardhat";

// ==================== 日志分类 ====================
const LOG_PREFIX = {
    CHAIN:  '[链上逻辑]',
    PARAM:  '[参数问题]',
    PERM:   '[权限配置]',
    INFO:   '[信息]',
} as const;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("═══════════════════════════════════════════════");
    console.log("  NST 快速联调 — 卖方建单流程");
    console.log(`  测试钱包: ${deployer.address}`);
    console.log("═══════════════════════════════════════════════\n");

    // 合约地址（来自 deployed-addresses.json）
    const OPTIONS_CORE_ADDRESS = "0x78F4600D6963044cCE956DC2322A92cB58142129";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT_ADDRESS = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT_ADDRESS);

    // ==================== 安全交易工具函数 ====================
    /** 带重试的发送交易（防止 replacement transaction underpriced） */
    async function safeSendTx(
        label: string,
        txFn: (overrides: { nonce: number; gasPrice: bigint }) => Promise<any>,
    ): Promise<any> {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // 每次重试都获取最新 nonce 和 gasPrice，避免 stale nonce
                const nonce = await deployer.getNonce();
                const feeData = await ethers.provider.getFeeData();
                const gasPrice = (feeData.gasPrice || 5000000000n) * 120n / 100n;
                const tx = await txFn({ nonce, gasPrice } as any);
                const receipt = await tx.wait();
                return receipt;
            } catch (e: any) {
                const msg = e.message || '';
                if (attempt < 3 && (msg.includes('underpriced') || msg.includes('nonce') || msg.includes('already known'))) {
                    console.log(`${LOG_PREFIX.INFO} ⚠ ${label} 第 ${attempt} 次失败 (${msg.slice(0, 80)})，等待 3s 重试...`);
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }
                throw e;
            }
        }
    }

    /** 检查 allowance 并在不足时 approve（跳过已足够的 allowance） */
    async function ensureAllowance(spender: string, spenderName: string, required: bigint) {
        const current = await usdt.allowance(deployer.address, spender);
        if (current >= required) {
            console.log(`${LOG_PREFIX.INFO} ✓ ${spenderName} allowance 充足 (${ethers.formatUnits(current, decimals)})，跳过 approve`);
            return;
        }
        console.log(`${LOG_PREFIX.INFO} ${spenderName} allowance 不足 (${ethers.formatUnits(current, decimals)} < ${ethers.formatUnits(required, decimals)})，发送 approve...`);
        await safeSendTx(`approve(${spenderName})`, (overrides) =>
            usdt.approve(spender, required, overrides)
        );
        console.log(`${LOG_PREFIX.INFO} ✓ ${spenderName} approved ${ethers.formatUnits(required, decimals)}`);
    }

    // ==================== Step 1: 自动检测 USDT 精度 ====================
    console.log("=== Step 1: 环境自检 ===");
    let decimals: number;
    try {
        const usdtFull = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        decimals = Number(await usdtFull.decimals());
        console.log(`${LOG_PREFIX.INFO} USDT decimals = ${decimals}`);
    } catch {
        // 回退：如果不是 MockERC20，尝试用标准 ERC20 接口
        try {
            const usdtABI = await ethers.getContractAt(
                ["function decimals() view returns (uint8)"] as any,
                USDT_ADDRESS
            );
            decimals = Number(await (usdtABI as any).decimals());
            console.log(`${LOG_PREFIX.INFO} USDT decimals = ${decimals} (via ERC20 interface)`);
        } catch {
            decimals = 18;
            console.log(`${LOG_PREFIX.PARAM} ⚠️ 无法读取 USDT decimals，默认使用 ${decimals}`);
        }
    }

    const nextOrderId = await optionsCore.nextOrderId();
    console.log(`${LOG_PREFIX.INFO} 当前 nextOrderId = ${nextOrderId}`);

    const usdtBalance = await usdt.balanceOf(deployer.address);
    console.log(`${LOG_PREFIX.INFO} 钱包 USDT 余额: ${ethers.formatUnits(usdtBalance, decimals)}`);

    const vmBalance = await usdt.balanceOf(VAULT_MANAGER_ADDRESS);
    console.log(`${LOG_PREFIX.INFO} VaultManager USDT 余额: ${ethers.formatUnits(vmBalance, decimals)}`);

    // 最低余额检查
    const minBalance = ethers.parseUnits("20", decimals); // 至少 20 USDT
    if (usdtBalance < minBalance) {
        console.log(`${LOG_PREFIX.PARAM} ❌ USDT 余额不足 (<20)，无法执行建单测试。请先 mint 测试 USDT。`);
        return;
    }

    // ==================== Step 2: Approve ====================
    console.log("\n=== Step 2: Approve USDT ===");
    const approveAmount = ethers.parseUnits("10000", decimals);
    await ensureAllowance(VAULT_MANAGER_ADDRESS, "VaultManager", approveAmount);

    // ==================== Step 3: 卖方建单 ====================
    console.log("\n=== Step 3: 创建卖方订单 ===");

    const now = Math.floor(Date.now() / 1000);
    const expiryTimestamp = now + 86400 * 30; // 30 days
    const notionalUSDT = ethers.parseUnits("10", decimals); // 10 USDT

    try {
        const receipt = await safeSendTx("createSellerOrder", (overrides) =>
            optionsCore.createSellerOrder(
                "测试标的",          // underlyingName
                "TEST001",          // underlyingCode
                "A股",              // market
                "CN",               // country
                "100",              // refPrice
                0,                  // direction (Call)
                notionalUSDT,       // notionalUSDT
                expiryTimestamp,    // expiryTimestamp
                500,                // premiumRate (5%)
                ethers.parseUnits("2", decimals),  // marginAmount (notional 的 20% = 2 USDT)
                0,                  // liquidationRule
                3,                  // consecutiveDays (≤ 10)
                10,                 // dailyLimitPercent
                86400,              // arbitrationWindow (24h)
                false,              // dividendAdjustment
                1,                  // exerciseDelay (T+1)
                0,                  // feedRule (NormalFeed)
                overrides
            )
        );
        const newOrderId = (await optionsCore.nextOrderId()) - 1n;
        console.log(`${LOG_PREFIX.INFO} ✓ 卖方订单创建成功 OrderId=${newOrderId} TX=${receipt?.hash?.slice(0, 16)}...`);

        // 验证
        const order = await optionsCore.getOrder(newOrderId);
        console.log(`${LOG_PREFIX.INFO}   status=${order.status} (预期 0=RFQ_CREATED)`);
        console.log(`${LOG_PREFIX.INFO}   seller=${order.seller}`);
        console.log(`${LOG_PREFIX.INFO}   notionalUSDT=${ethers.formatUnits(order.notionalUSDT, decimals)}`);
        console.log(`${LOG_PREFIX.INFO}   feedRule=${order.feedRule}`);
        console.log(`${LOG_PREFIX.INFO}   exerciseDelay=T+${order.exerciseDelay}`);

        if (Number(order.status) !== 0) {
            console.log(`${LOG_PREFIX.CHAIN} ⚠️ 订单状态异常，预期 0 (RFQ_CREATED)，实际 ${order.status}`);
        }
    } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes("not authorized") || msg.includes("AccessControl") || msg.includes("role")) {
            console.log(`${LOG_PREFIX.PERM} ❌ 权限问题: ${msg.slice(0, 300)}`);
            console.log(`${LOG_PREFIX.PERM}    请检查 deployer 是否有建单权限，VaultManager 是否授权给 OptionsCore`);
        } else if (msg.includes("insufficient") || msg.includes("exceeds balance")) {
            console.log(`${LOG_PREFIX.PARAM} ❌ 余额不足: ${msg.slice(0, 300)}`);
        } else if (msg.includes("Config:") || msg.includes("too ")) {
            console.log(`${LOG_PREFIX.PARAM} ❌ 参数超出 Config 约束: ${msg.slice(0, 300)}`);
            console.log(`${LOG_PREFIX.PARAM}    请检查 exerciseDelay、consecutiveDays、arbitrationWindow 等是否在合法范围`);
        } else {
            console.log(`${LOG_PREFIX.CHAIN} ❌ 合约 revert: ${msg.slice(0, 500)}`);
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
