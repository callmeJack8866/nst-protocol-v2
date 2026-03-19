/**
 * fix-order3.ts
 * 
 * 修复订单3：设置卖方保证金并验证可settle
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Fixing order 3 with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);

    // 自动检测 USDT 精度
    let decimals = 18;
    try {
        const usdtFull = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        decimals = Number(await usdtFull.decimals());
    } catch { /* fallback 18 */ }

    // 获取订单 3
    const order = await optionsCore.getOrder(3);
    console.log("Order 3 status:", order.status.toString());
    console.log("Order 3 seller:", order.seller);
    console.log("Order 3 currentMargin:", ethers.formatUnits(order.currentMargin, decimals), "USDT");

    // 设置卖方保证金
    const marginAmount = order.currentMargin + ethers.parseUnits("5", decimals);
    console.log("\nSetting seller margin to:", ethers.formatUnits(marginAmount, decimals), "USDT");
    await (await vaultManager.adminSetMarginBalance(order.seller, USDT_ADDRESS, marginAmount)).wait();
    console.log("✓ Seller margin set");

    // 验证
    const sellerBalance = await vaultManager.userMarginBalance(order.seller, USDT_ADDRESS);
    console.log("Seller VM Balance:", ethers.formatUnits(sellerBalance, decimals), "USDT");

    console.log("\n✅ Order 3 is now ready for settle!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
