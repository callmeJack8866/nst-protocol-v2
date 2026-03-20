/**
 * debug-createbuyer.ts - 精确定位 createBuyerRFQ revert
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const addresses = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"), "utf8")
    );

    const optionsCore = await ethers.getContractAt("OptionsCore", addresses.OptionsCore);
    const vaultManager = await ethers.getContractAt("VaultManager", addresses.VaultManager);
    const config = await ethers.getContractAt("Config", addresses.Config);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", addresses.USDT);

    console.log("OptionsCore:", addresses.OptionsCore);
    console.log("VaultManager:", addresses.VaultManager);
    
    // 1. Check VaultManager has collectFee
    console.log("\n1. VaultManager bytecode check...");
    const vmCode = await ethers.provider.getCode(addresses.VaultManager);
    const collectFeeSig = ethers.id("collectFee(address,address,uint256,string)").slice(0, 10);
    console.log("   collectFee selector:", collectFeeSig);
    console.log("   Found in bytecode:", vmCode.includes(collectFeeSig.slice(2)));

    // 2. Check OptionsCore → VaultManager ref
    const vmRef = await optionsCore.vaultManager();
    console.log("\n2. optionsCore.vaultManager():", vmRef);
    console.log("   Match deployed:", vmRef.toLowerCase() === addresses.VaultManager.toLowerCase());

    // 3. Check OptionsCore → Config ref
    const configRef = await optionsCore.config();
    console.log("\n3. optionsCore.config():", configRef);
    console.log("   Match deployed:", configRef.toLowerCase() === addresses.Config.toLowerCase());

    // 4. Check Config values
    try {
        const fee = await config.creationFee();
        console.log("\n4. Config.creationFee():", ethers.formatEther(fee));
    } catch (e: any) {
        console.log("\n4. Config.creationFee() ERROR:", e.message?.slice(0, 200));
    }

    try {
        const mmr = await config.minMarginRate();
        console.log("   Config.minMarginRate():", mmr.toString());
    } catch (e: any) {
        console.log("   Config.minMarginRate() ERROR:", e.message?.slice(0, 200));
    }

    try {
        const minAW = await config.minArbitrationWindow();
        const maxAW = await config.maxArbitrationWindow();
        console.log("   Config.arbitrationWindow range:", minAW.toString(), "-", maxAW.toString());
    } catch (e: any) {
        console.log("   Config.arbitrationWindow ERROR:", e.message?.slice(0, 200));
    }

    try {
        const minMCD = await config.minMarginCallDeadline();
        const maxMCD = await config.maxMarginCallDeadline();
        console.log("   Config.marginCallDeadline range:", minMCD.toString(), "-", maxMCD.toString());
    } catch (e: any) {
        console.log("   Config.marginCallDeadline ERROR:", e.message?.slice(0, 200));
    }

    // 5. VAULT_OPERATOR_ROLE check
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    const hasRole = await vaultManager.hasRole(VAULT_OPERATOR_ROLE, addresses.OptionsCore);
    console.log("\n5. OptionsCore has VAULT_OPERATOR_ROLE:", hasRole);

    // 6. Allowance check
    const allowance = await usdt.allowance(deployer.address, addresses.VaultManager);
    console.log("6. USDT allowance to VaultManager:", ethers.formatEther(allowance));

    // 7. Try collectFee directly
    console.log("\n7. Testing vaultManager.collectFee via staticCall...");
    try {
        await vaultManager.collectFee.staticCall(deployer.address, addresses.USDT, ethers.parseEther("1"), "test");
        console.log("   ✓ collectFee staticCall OK");
    } catch (e: any) {
        console.log("   ✗ collectFee FAILED:", e.reason || e.message?.slice(0, 200));
    }

    // 8. staticCall createBuyerRFQ
    console.log("\n8. Testing createBuyerRFQ via staticCall...");
    try {
        const now = Math.floor(Date.now() / 1000);
        await optionsCore.createBuyerRFQ.staticCall(
            "Test", "T001", "A股", "CN", "100", 0,
            ethers.parseEther("10"), now + 86400 * 7,
            500, 1000, 0, ethers.ZeroAddress,
            86400, 43200, false, 0, 0, 0, 0
        );
        console.log("   ✓ createBuyerRFQ staticCall OK");
    } catch (e: any) {
        console.log("   ✗ createBuyerRFQ FAILED:", e.reason || e.message?.slice(0, 300));
    }

    console.log("\n=== Done ===");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
