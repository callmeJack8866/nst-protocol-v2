/**
 * set-margin-and-settle.ts
 * 
 * 设置卖方保证金余额并测试 settle
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Operating with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
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

    console.log("\n=== Step 1: Check VaultManager USDT Balance ===");
    const vmBalance = await usdt.balanceOf(VAULT_MANAGER_ADDRESS);
    console.log("VaultManager USDT:", ethers.formatUnits(vmBalance, decimals));

    console.log("\n=== Step 2: Set Seller Margin Balance ===");

    // 获取订单 1 的 currentMargin
    const order1 = await optionsCore.getOrder(1);
    const order2 = await optionsCore.getOrder(2);

    const totalNeeded = order1.currentMargin + order2.currentMargin;
    console.log("Order 1 currentMargin:", ethers.formatUnits(order1.currentMargin, decimals), "USDT");
    console.log("Order 2 currentMargin:", ethers.formatUnits(order2.currentMargin, decimals), "USDT");
    console.log("Total needed:", ethers.formatUnits(totalNeeded, decimals), "USDT");

    // 使用 adminSetMarginBalance 设置卖方余额（需要手动转 USDT 到 VaultManager）
    if (vmBalance < totalNeeded) {
        const diff = totalNeeded - vmBalance + ethers.parseUnits("10", decimals); // 多 10 USDT
        console.log("Need to transfer", ethers.formatUnits(diff, decimals), "more USDT to VaultManager");
        await (await usdt.transfer(VAULT_MANAGER_ADDRESS, diff)).wait();
        console.log("✓ USDT transferred");
    }

    // 设置卖方余额
    console.log("Setting seller margin balance...");
    await (await vaultManager.adminSetMarginBalance(SELLER_ADDRESS, USDT_ADDRESS, totalNeeded)).wait();
    console.log("✓ Seller margin set to", ethers.formatUnits(totalNeeded, decimals), "USDT");

    // 验证
    const sellerBalance = await vaultManager.userMarginBalance(SELLER_ADDRESS, USDT_ADDRESS);
    console.log("Seller VM Balance:", ethers.formatUnits(sellerBalance, decimals), "USDT");

    console.log("\n=== Step 3: Check Order Status ===");
    const updatedOrder1 = await optionsCore.getOrder(1);
    console.log("Order 1 Status:", updatedOrder1.status.toString(), "(should be 6)");

    console.log("\n=== Step 4: Test settle via staticCall ===");
    try {
        await optionsCore.settle.staticCall(1);
        console.log("✓ settle staticCall succeeded!");

        console.log("\n=== Step 5: Execute settle ===");
        const tx = await optionsCore.settle(1);
        await tx.wait();
        console.log("✓ settle executed!");

        const finalOrder = await optionsCore.getOrder(1);
        console.log("Order 1 Final Status:", finalOrder.status.toString(), "(should be 8=SETTLED)");
    } catch (e: any) {
        console.log("✗ settle failed:", e.message?.slice(0, 400));
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
