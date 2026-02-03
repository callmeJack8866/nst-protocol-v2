import { ethers, run, network } from "hardhat";

/**
 * NST Options MVP - 部署脚本
 * 
 * 部署顺序：
 * 1. Config (参数配置)
 * 2. VaultManager (资金池管理)
 * 3. FeedProtocol (喂价协议)
 * 4. SeatManager (席位管理)
 * 5. PointsManager (积分管理)
 * 6. OptionsCore (期权核心)
 * 7. 配置合约地址关联
 */

interface DeployedContracts {
    config: string;
    vaultManager: string;
    feedProtocol: string;
    seatManager: string;
    pointsManager: string;
    optionsCore: string;
    usdt: string;
}

// BSC Testnet Mock USDT (18 decimals) - 用于测试
const BSC_TESTNET_USDT = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";
const BSC_MAINNET_USDT = "0x55d398326f99059fF775485246999027B3197955";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("NST Options MVP - Contract Deployment");
    console.log("=".repeat(60));
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
    console.log("=".repeat(60));

    const isMainnet = network.name === "bscMainnet";
    const usdtAddress = isMainnet ? BSC_MAINNET_USDT : BSC_TESTNET_USDT;

    // For local/hardhat network, deploy mock USDT and NST
    let usdt: string;
    let nstToken: string;
    if (network.name === "hardhat" || network.name === "localhost") {
        console.log("\n🔧 Deploying Mock tokens for local testing...");
        const MockERC20 = await ethers.getContractFactory("MockERC20");

        // Deploy Mock USDT
        const mockUsdt = await MockERC20.deploy("USDT", "USDT", 18);
        await mockUsdt.waitForDeployment();
        usdt = await mockUsdt.getAddress();
        console.log(`✅ Mock USDT deployed: ${usdt}`);

        // Mint some USDT for testing
        const mintAmount = ethers.parseUnits("1000000", 18);
        await mockUsdt.mint(deployer.address, mintAmount);
        console.log(`   Minted ${ethers.formatUnits(mintAmount, 18)} USDT to deployer`);

        // Deploy Mock NST Token
        const mockNst = await MockERC20.deploy("NST Token", "NST", 18);
        await mockNst.waitForDeployment();
        nstToken = await mockNst.getAddress();
        console.log(`✅ Mock NST deployed: ${nstToken}`);
        await mockNst.mint(deployer.address, mintAmount);
    } else {
        usdt = usdtAddress;
        // TODO: Set actual NST token address for production
        nstToken = ethers.ZeroAddress;
        console.log(`\n📋 Using existing USDT: ${usdt}`);
        console.log(`📋 NST Token: ${nstToken} (set after TGE)`);
    }

    // 1. Deploy Config
    console.log("\n1️⃣ Deploying Config...");
    const Config = await ethers.getContractFactory("Config");
    const config = await Config.deploy(deployer.address);
    await config.waitForDeployment();
    const configAddress = await config.getAddress();
    console.log(`   ✅ Config deployed: ${configAddress}`);

    // 2. Deploy VaultManager
    console.log("\n2️⃣ Deploying VaultManager...");
    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = await VaultManager.deploy(configAddress, deployer.address);
    await vaultManager.waitForDeployment();
    const vaultManagerAddress = await vaultManager.getAddress();
    console.log(`   ✅ VaultManager deployed: ${vaultManagerAddress}`);

    // 3. Deploy FeedProtocol
    console.log("\n3️⃣ Deploying FeedProtocol...");
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(configAddress, usdt, deployer.address);
    await feedProtocol.waitForDeployment();
    const feedProtocolAddress = await feedProtocol.getAddress();
    console.log(`   ✅ FeedProtocol deployed: ${feedProtocolAddress}`);

    // 4. Deploy SeatManager (requires nstToken for NST staking feature)
    console.log("\n4️⃣ Deploying SeatManager...");
    const SeatManager = await ethers.getContractFactory("SeatManager");
    const seatManager = await SeatManager.deploy(configAddress, usdt, nstToken, deployer.address);
    await seatManager.waitForDeployment();
    const seatManagerAddress = await seatManager.getAddress();
    console.log(`   ✅ SeatManager deployed: ${seatManagerAddress}`);

    // 5. Deploy PointsManager (requires nstToken for airdrop distribution)
    console.log("\n5️⃣ Deploying PointsManager...");
    const PointsManager = await ethers.getContractFactory("PointsManager");
    const pointsManager = await PointsManager.deploy(configAddress, nstToken, deployer.address);
    await pointsManager.waitForDeployment();
    const pointsManagerAddress = await pointsManager.getAddress();
    console.log(`   ✅ PointsManager deployed: ${pointsManagerAddress}`);

    // 6. Deploy OptionsCore
    console.log("\n6️⃣ Deploying OptionsCore...");
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(
        configAddress,
        vaultManagerAddress,
        usdt,
        deployer.address
    );
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();
    console.log(`   ✅ OptionsCore deployed: ${optionsCoreAddress}`);

    // 7. Configure contract addresses
    console.log("\n7️⃣ Configuring contract addresses...");

    await config.setUsdtAddress(usdt);
    console.log("   - USDT address set");

    await config.setVaultManagerAddress(vaultManagerAddress);
    console.log("   - VaultManager address set");

    await config.setOptionsCoreAddress(optionsCoreAddress);
    console.log("   - OptionsCore address set");

    await config.setFeedProtocolAddress(feedProtocolAddress);
    console.log("   - FeedProtocol address set");

    await config.setSeatManagerAddress(seatManagerAddress);
    console.log("   - SeatManager address set");

    await config.setPointsManagerAddress(pointsManagerAddress);
    console.log("   - PointsManager address set");

    // 8. Grant roles
    console.log("\n8️⃣ Granting roles...");

    // Grant VaultManager operator role to OptionsCore
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    await vaultManager.grantRole(VAULT_OPERATOR_ROLE, optionsCoreAddress);
    console.log("   - OptionsCore granted VAULT_OPERATOR_ROLE");

    // Grant Protocol role to OptionsCore in FeedProtocol
    const PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE"));
    await feedProtocol.grantRole(PROTOCOL_ROLE, optionsCoreAddress);
    console.log("   - OptionsCore granted PROTOCOL_ROLE in FeedProtocol");

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));

    const deployedContracts: DeployedContracts = {
        config: configAddress,
        vaultManager: vaultManagerAddress,
        feedProtocol: feedProtocolAddress,
        seatManager: seatManagerAddress,
        pointsManager: pointsManagerAddress,
        optionsCore: optionsCoreAddress,
        usdt: usdt,
    };

    console.log(JSON.stringify(deployedContracts, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("✅ Deployment completed successfully!");
    console.log("=".repeat(60));

    // Verify contracts on testnet/mainnet
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\n🔍 Starting contract verification...");
        await verifyContracts(deployedContracts, deployer.address);
    }

    return deployedContracts;
}

async function verifyContracts(contracts: DeployedContracts, admin: string) {
    const isMainnet = network.name === "bscMainnet";
    const usdt = isMainnet ? BSC_MAINNET_USDT : BSC_TESTNET_USDT;

    const contractsToVerify = [
        { name: "Config", address: contracts.config, args: [admin] },
        { name: "VaultManager", address: contracts.vaultManager, args: [contracts.config, admin] },
        { name: "FeedProtocol", address: contracts.feedProtocol, args: [contracts.config, usdt, admin] },
        { name: "SeatManager", address: contracts.seatManager, args: [contracts.config, usdt, admin] },
        { name: "PointsManager", address: contracts.pointsManager, args: [contracts.config, admin] },
        { name: "OptionsCore", address: contracts.optionsCore, args: [contracts.config, contracts.vaultManager, usdt, admin] },
    ];

    for (const contract of contractsToVerify) {
        try {
            console.log(`   Verifying ${contract.name}...`);
            await run("verify:verify", {
                address: contract.address,
                constructorArguments: contract.args,
            });
            console.log(`   ✅ ${contract.name} verified`);
        } catch (error: any) {
            if (error.message.includes("Already Verified")) {
                console.log(`   ℹ️ ${contract.name} already verified`);
            } else {
                console.log(`   ❌ ${contract.name} verification failed: ${error.message}`);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
