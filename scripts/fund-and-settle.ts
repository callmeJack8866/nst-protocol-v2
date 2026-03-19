/**
 * fund-and-settle.ts
 * 
 * 为卖方在 VaultManager 中充值保证金，然后测试 settle
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Operating with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x9EF0D757F9168f42628Ca99C622c0ACDd403B1F0";
    const VAULT_MANAGER_ADDRESS = "0x3e7eEf51EdFb64D03738801c2d2174E3cB1400F7";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";
    const SELLER_ADDRESS = "0xFF486124612662E74F3055a71f45EAD3451d1CD9";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    // 自动检测 USDT 精度
    let decimals = 18;
    try {
        const usdtFull = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        decimals = Number(await usdtFull.decimals());
    } catch { /* fallback 18 */ }

    console.log("\n=== Step 1: Check Order 1 ===");
    const order = await optionsCore.getOrder(1);
    console.log("Status:", order.status.toString(), "(should be 6)");
    console.log("CurrentMargin:", ethers.formatUnits(order.currentMargin, decimals), "USDT");
    console.log("Seller:", order.seller);

    console.log("\n=== Step 2: Check VaultManager Seller Balance ===");
    try {
        const sellerBalance = await vaultManager.userMarginBalance(SELLER_ADDRESS, USDT_ADDRESS);
        console.log("Seller margin in VM:", ethers.formatUnits(sellerBalance, decimals), "USDT");

        if (sellerBalance < order.currentMargin) {
            console.log("\n⚠️ Seller margin insufficient!");
            console.log("Required:", ethers.formatUnits(order.currentMargin, decimals), "USDT");

            // 需要为卖方存入保证金
            // 方案1: 直接转 USDT 到 VaultManager 并手动更新余额
            // 方案2: 通过 depositMargin (需要 VAULT_OPERATOR_ROLE)

            console.log("\n=== Step 3: Funding Seller Margin ===");

            // 首先确保 deployer 有 VAULT_OPERATOR_ROLE
            const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
            const hasRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, deployer.address);
            console.log("Deployer has VAULT_OPERATOR_ROLE:", hasRole);

            if (!hasRole) {
                console.log("Granting role...");
                await (await vaultManager.grantRole(VAULT_OPERATOR_ROLE, deployer.address)).wait();
                console.log("✓ Role granted");
            }

            // 先把 USDT approve 给 VaultManager
            const amount = order.currentMargin + ethers.parseUnits("1", decimals); // 多 1 USDT 余量
            console.log("Approving", ethers.formatUnits(amount, decimals), "USDT to VaultManager...");
            await (await usdt.approve(VAULT_MANAGER_ADDRESS, amount)).wait();
            console.log("✓ Approved");

            // 现在需要模拟 depositMargin
            // 但 depositMargin 需要从用户地址转账，这里我们直接转账给 VaultManager
            // 然后手动增加卖方余额
            console.log("Transferring USDT to VaultManager...");
            await (await usdt.transfer(VAULT_MANAGER_ADDRESS, amount)).wait();
            console.log("✓ USDT transferred");

            // 使用低级调用手动设置余额（不标准但用于测试）
            // 更好的方案是在 VaultManager 添加 adminDeposit 函数，但这需要重新部署

            // 暂时跳过手动设置，而是修改 settle 逻辑或使用其他方式
            console.log("\nNote: VaultManager 需要 depositMargin 才能正确记录余额");
            console.log("这需要卖方自己调用 depositMargin，或者 OptionsCore 在创建订单时调用");
        }
    } catch (e: any) {
        console.log("Error:", e.message?.slice(0, 200));
    }

    console.log("\n=== Step 4: Try settle ===");
    try {
        await optionsCore.settle.staticCall(1);
        console.log("✓ settle staticCall succeeded!");

        const tx = await optionsCore.settle(1);
        await tx.wait();
        console.log("✓ settle executed!");

        const finalOrder = await optionsCore.getOrder(1);
        console.log("Final status:", finalOrder.status.toString());
    } catch (e: any) {
        console.log("✗ settle failed:", e.message?.slice(0, 300));
        if (e.reason) {
            console.log("Reason:", e.reason);
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
