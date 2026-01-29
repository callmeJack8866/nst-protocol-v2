/**
 * 使用原生 https 模块的 BSC Testnet 部署脚本
 * 绕过 undici 的连接超时问题
 */

require('dotenv').config();
const https = require('https');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 配置
const RPC_URL = "https://lb.drpc.live/bsc-testnet/Ag-nIvHP5U9dvYvuRGoZQwldtM7y0C4R8K6HOmy9-kY5";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const BSC_TESTNET_CONFIG = {
    Config: '0x751C17032D38b0b877171cB96039678710b3c76F',
    VaultManager: '0x9FD199A71a1f19Cc095090D5509B9FF6eB49294C',
    USDT: '0x9f2140319726F9b851073a303415f13EC0cdA269',
};

// 自定义 fetch 函数使用原生 https
function customFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: 120000 // 120秒超时
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(data)),
                    text: () => Promise.resolve(data)
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// 自定义 JsonRpcProvider 使用原生 https
class CustomJsonRpcProvider extends ethers.JsonRpcProvider {
    async _send(payload) {
        const isBatch = Array.isArray(payload);
        const response = await customFetch(this._getConnection().url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        // ethers v6 expects an array for _send
        if (isBatch) {
            return result;
        }
        return [result];
    }
}

async function main() {
    console.log("=".repeat(60));
    console.log("NST Options MVP - OptionsCore Upgrade (Native HTTPS)");
    console.log("=".repeat(60));

    if (!PRIVATE_KEY) {
        console.error("❌ 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    // 创建 provider 和 signer
    const provider = new CustomJsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Deployer: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} BNB`);
    console.log("=".repeat(60));

    // 读取编译后的合约
    const artifactPath = path.join(__dirname, '../artifacts/contracts/core/OptionsCore.sol/OptionsCore.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // 部署合约
    console.log("\n🚀 Deploying upgraded OptionsCore...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    const contract = await factory.deploy(
        BSC_TESTNET_CONFIG.Config,
        BSC_TESTNET_CONFIG.VaultManager,
        BSC_TESTNET_CONFIG.USDT,
        wallet.address
    );

    console.log(`📝 Transaction hash: ${contract.deploymentTransaction().hash}`);
    console.log("⏳ Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`✅ OptionsCore deployed: ${address}`);

    // 输出配置更新提示
    console.log("\n" + "=".repeat(60));
    console.log("📋 Update frontend/src/contracts/config.ts:");
    console.log("=".repeat(60));
    console.log(`OptionsCore: '${address}',`);
    console.log("=".repeat(60));
}

main().catch(console.error);
