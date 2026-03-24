/**
 * 在 FeedProtocol 上注册 submitter 为活跃喂价员
 * 
 * 步骤：
 * 1. 检查 submitter USDT 余额
 * 2. Approve USDT 到 FeedProtocol
 * 3. 调用 registerFeeder(100 ether)
 * 
 * 使用方式：npx ts-node --transpile-only scripts/registerFeeder.ts
 */

import { ethers } from "ethers";

const RPC_URL = "https://bsc-testnet-rpc.publicnode.com";
const FEED_PROTOCOL_ADDR = "0x45E4ee36e6fA443a7318cd549c6AC20d83b6C1A7";
const PRIVATE_KEY = "fbb24f682d7fd3fdd46337d72d8b1b2b8170848f5558885b8c5e076e637ca8ec";

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
];

const FEED_PROTOCOL_ABI = [
    "function registerFeeder(uint256 stakeAmount) external",
    "function feeders(address) view returns (address feederAddress, uint256 stakedAmount, uint256 completedFeeds, uint256 rejectedFeeds, uint256 registeredAt, bool isActive, bool isBlacklisted)",
    "function config() view returns (address)",
];

const CONFIG_ABI = [
    "function minFeederStake() view returns (uint256)",
    "function paymentToken() view returns (address)",
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("Submitter address:", wallet.address);

    const feedProtocol = new ethers.Contract(FEED_PROTOCOL_ADDR, FEED_PROTOCOL_ABI, wallet);

    // 1. 检查是否已注册
    const feederInfo = await feedProtocol.feeders(wallet.address);
    console.log("Current feeder status:", {
        isActive: feederInfo.isActive,
        stakedAmount: ethers.formatUnits(feederInfo.stakedAmount, 18),
        registeredAt: Number(feederInfo.registeredAt),
    });

    if (feederInfo.isActive) {
        console.log("✅ 已是活跃喂价员，无需注册");
        return;
    }

    // 2. 获取 Config
    const configAddr = await feedProtocol.config();
    console.log("Config address:", configAddr);
    const config = new ethers.Contract(configAddr, CONFIG_ABI, provider);
    const minStake = await config.minFeederStake();
    console.log("Min stake:", ethers.formatUnits(minStake, 18), "USDT");

    const paymentToken = await config.paymentToken();
    console.log("Payment token (USDT):", paymentToken);

    // 3. 检查 USDT 余额
    const usdt = new ethers.Contract(paymentToken, ERC20_ABI, wallet);
    const balance = await usdt.balanceOf(wallet.address);
    console.log("USDT balance:", ethers.formatUnits(balance, 18));

    if (balance < minStake) {
        console.error(`❌ USDT 余额不足！需要 ${ethers.formatUnits(minStake, 18)} USDT，当前 ${ethers.formatUnits(balance, 18)}`);
        console.log("请先给 submitter 钱包转入足够的测试 USDT");
        return;
    }

    // 4. Approve
    const allowance = await usdt.allowance(wallet.address, FEED_PROTOCOL_ADDR);
    if (allowance < minStake) {
        console.log("Approving USDT...");
        const approveTx = await usdt.approve(FEED_PROTOCOL_ADDR, minStake);
        await approveTx.wait();
        console.log("✅ USDT approved");
    }

    // 5. Register
    console.log("Registering as feeder...");
    const regTx = await feedProtocol.registerFeeder(minStake);
    const receipt = await regTx.wait();
    console.log(`✅ 注册成功！tx=${receipt.hash}`);

    // 6. 验证
    const updated = await feedProtocol.feeders(wallet.address);
    console.log("Updated feeder status:", {
        isActive: updated.isActive,
        stakedAmount: ethers.formatUnits(updated.stakedAmount, 18),
    });
}

main().catch(console.error);
