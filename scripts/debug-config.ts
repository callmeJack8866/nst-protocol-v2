/**
 * debug-config.ts
 * 
 * 检查 Config 合约配置
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    // 合约地址
    const OPTIONS_CORE_ADDRESS = "0x758e843E2e052Ddb65B92e0a7b8Fa84D1a70e4a2";
    const CONFIG_ADDRESS = "0xf8d98e07d6d6ded08a0ef2abbe4bde64bec32a38";

    const optionsCore = await ethers.getContractAt("OptionsCore", OPTIONS_CORE_ADDRESS);

    // 获取 OptionsCore 中的 Config 地址
    const configInCore = await optionsCore.config();
    console.log("\n=== Config Address ===");
    console.log("Config in OptionsCore:", configInCore);
    console.log("Expected Config:", CONFIG_ADDRESS);
    console.log("Match:", configInCore.toLowerCase() === CONFIG_ADDRESS.toLowerCase());

    // 尝试读取 Config
    try {
        const config = await ethers.getContractAt("Config", configInCore);

        console.log("\n=== Config Values ===");

        try {
            const tradingFeeRate = await config.tradingFeeRate();
            console.log("tradingFeeRate:", tradingFeeRate.toString());
        } catch (e: any) {
            console.log("Error reading tradingFeeRate:", e.message?.slice(0, 200));
        }

        try {
            const arbitrationFee = await config.arbitrationFee();
            console.log("arbitrationFee:", arbitrationFee.toString());
        } catch (e: any) {
            console.log("Error reading arbitrationFee:", e.message?.slice(0, 200));
        }

    } catch (e: any) {
        console.log("Error attaching to Config:", e.message?.slice(0, 200));
    }

    // 直接用 OptionsCore 中的配置地址尝试读取
    console.log("\n=== Trying Direct Read ===");
    const configOld = "0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea";
    try {
        const config2 = await ethers.getContractAt("Config", configOld);
        const rate = await config2.tradingFeeRate();
        console.log("tradingFeeRate from old config:", rate.toString());
    } catch (e: any) {
        console.log("Error:", e.message?.slice(0, 200));
    }

    console.log("\n=== Done ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
