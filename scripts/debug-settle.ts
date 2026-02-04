/**
 * debug-settle.ts
 * 
 * 调试 settle 函数失败原因
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Debugging with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0xE3aD42f194804590f64f5A796780Eb566bd4ba9f";
    const VAULT_MANAGER_ADDRESS = "0xF73CD5f50E7F0ce0A6FE8b08C8d1e671b9A5Bb59";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    console.log("\n=== Order 1 Details ===");
    const order = await optionsCore.getOrder(1);
    console.log("Status:", order.status.toString(), "(should be 6)");
    console.log("lastFeedPrice:", order.lastFeedPrice.toString());
    console.log("refPrice:", order.refPrice);
    console.log("direction:", order.direction.toString(), "(0=Call, 1=Put)");
    console.log("notionalUSDT:", order.notionalUSDT.toString());
    console.log("currentMargin:", order.currentMargin.toString());
    console.log("buyer:", order.buyer);
    console.log("seller:", order.seller);
    console.log("dividendAdjustment:", order.dividendAdjustment);
    console.log("dividendAmount:", order.dividendAmount?.toString() || "N/A");

    console.log("\n=== Checking strikePrice calculation ===");
    // 模拟 _parsePrice 逻辑
    const refPriceStr = order.refPrice;
    if (!refPriceStr || refPriceStr === "") {
        console.log("⚠️ refPrice is empty! This will cause divide by zero");
    } else {
        let strikePrice = 0;
        try {
            strikePrice = parseInt(refPriceStr);
            console.log("Parsed strikePrice:", strikePrice);
            if (strikePrice === 0) {
                console.log("⚠️ strikePrice is 0! This will cause divide by zero in profit calc");
            }
        } catch (e) {
            console.log("⚠️ Failed to parse refPrice:", refPriceStr);
        }
    }

    console.log("\n=== Checking VaultManager Balance ===");
    // 使用简化的 ABI
    const VM_ABI = [
        "function userMarginBalance(address, address) view returns (uint256)",
        "function marginPoolBalance(address) view returns (uint256)"
    ];
    const vm = new ethers.Contract(VAULT_MANAGER_ADDRESS, VM_ABI, deployer);

    try {
        const sellerBalance = await vm.userMarginBalance(order.seller, USDT_ADDRESS);
        console.log("Seller margin in VaultManager:", ethers.formatUnits(sellerBalance, 6), "USDT");

        const poolBalance = await vm.marginPoolBalance(USDT_ADDRESS);
        console.log("Total margin pool:", ethers.formatUnits(poolBalance, 6), "USDT");

        if (sellerBalance < order.currentMargin) {
            console.log("⚠️ Seller margin balance is less than currentMargin!");
        }
    } catch (e: any) {
        console.log("Error reading VaultManager:", e.message?.slice(0, 200));
    }

    console.log("\n=== Trying settle via staticCall ===");
    try {
        await optionsCore.settle.staticCall(1);
        console.log("✓ staticCall succeeded!");
    } catch (e: any) {
        console.log("✗ staticCall failed!");
        console.log("Error:", e.message?.slice(0, 500));
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
