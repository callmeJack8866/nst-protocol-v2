/**
 * full-diagnosis.ts
 * 
 * 完整诊断订单状态和回调问题
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Diagnosing with account:", deployer.address);

    const OPTIONS_CORE_ADDRESS = "0x0672f9ec88421858Ce4BC88071447BF31A8cEd24";
    const FEED_PROTOCOL_ADDRESS = "0xa4d3d2D56902f91e92caDE54993f45b4376979C7";
    const VAULT_MANAGER_ADDRESS = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    const USDT_ADDRESS = "0x6ae0833e637d1d99f3fcb6204860386f6a6713c0";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);
    const feedProtocol = await ethers.getContractAt("FeedProtocol", FEED_PROTOCOL_ADDRESS);
    const vaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);

    // 自动检测 USDT 精度
    let decimals = 18;
    try {
        const usdtFull = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        decimals = Number(await usdtFull.decimals());
    } catch { /* fallback 18 */ }

    console.log("\n=== Checking All Orders ===");
    const nextOrderId = await optionsCore.nextOrderId();
    console.log("Total orders:", (Number(nextOrderId) - 1));

    for (let i = 1; i < Number(nextOrderId); i++) {
        console.log(`\n--- Order ${i} ---`);
        const order = await optionsCore.getOrder(i);
        console.log("  Status:", order.status.toString());
        console.log("  StatusName:", ['RFQ_CREATED', 'QUOTING', 'MATCHED', 'WAITING_INITIAL_FEED', 'LIVE', 'WAITING_FINAL_FEED', 'PENDING_SETTLEMENT', 'ARBITRATION', 'SETTLED', 'LIQUIDATED', 'CANCELLED'][Number(order.status)]);
        console.log("  Buyer:", order.buyer);
        console.log("  Seller:", order.seller);
        console.log("  lastFeedPrice:", order.lastFeedPrice.toString());
        console.log("  currentMargin:", ethers.formatUnits(order.currentMargin, decimals), "USDT");

        // 检查卖方在 VaultManager 中的余额
        try {
            const sellerBalance = await vaultManager.userMarginBalance(order.seller, USDT_ADDRESS);
            console.log("  Seller VM Balance:", ethers.formatUnits(sellerBalance, decimals), "USDT");
        } catch (e) {
            console.log("  Seller VM Balance: Error reading");
        }
    }

    console.log("\n=== Checking Permissions ===");

    // FeedProtocol -> OptionsCore
    const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
    const hasRole = await optionsCore.hasRole(FEED_PROTOCOL_ROLE, FEED_PROTOCOL_ADDRESS);
    console.log("FeedProtocol has FEED_PROTOCOL_ROLE:", hasRole);

    // OptionsCore -> VaultManager
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    const hasVaultRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, OPTIONS_CORE_ADDRESS);
    console.log("OptionsCore has VAULT_OPERATOR_ROLE:", hasVaultRole);

    // FeedProtocol.optionsCore
    const ocInFP = await feedProtocol.optionsCore();
    console.log("FeedProtocol.optionsCore:", ocInFP);
    console.log("Expected:", OPTIONS_CORE_ADDRESS);
    console.log("Match:", ocInFP.toLowerCase() === OPTIONS_CORE_ADDRESS.toLowerCase());

    // 如果有订单在 WAITING_FINAL_FEED 状态，手动更新
    if (Number(nextOrderId) > 1) {
        for (let i = 1; i < Number(nextOrderId); i++) {
            const order = await optionsCore.getOrder(i);
            if (Number(order.status) === 5) { // WAITING_FINAL_FEED
                console.log(`\n=== Updating Order ${i} to PENDING_SETTLEMENT ===`);
                const finalPrice = order.lastFeedPrice > 0
                    ? order.lastFeedPrice
                    : ethers.parseUnits("100", 18);

                try {
                    const tx = await optionsCore.processFinalFeedResult(i, finalPrice);
                    await tx.wait();
                    console.log("✓ Order", i, "updated to PENDING_SETTLEMENT");
                } catch (e: any) {
                    console.log("Error updating order", i, ":", e.message?.slice(0, 200));
                }
            }
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
