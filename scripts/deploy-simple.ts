import { ethers, network } from "hardhat";
import * as fs from "fs";

/**
 * 获取最新部署的合约地址
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    // 使用 18 位 Mock USDT
    const usdt = "0x6ae0833E637D1d99F3FCB6204860386f6a6713C0";
    const nstToken = ethers.ZeroAddress;

    console.log("部署中...");

    // 1. Deploy Config
    const Config = await ethers.getContractFactory("Config");
    const config = await Config.deploy(deployer.address);
    await config.waitForDeployment();
    const configAddress = await config.getAddress();

    // 2. Deploy VaultManager
    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = await VaultManager.deploy(configAddress, deployer.address);
    await vaultManager.waitForDeployment();
    const vaultManagerAddress = await vaultManager.getAddress();

    // 3. Deploy FeedProtocol
    const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
    const feedProtocol = await FeedProtocol.deploy(configAddress, usdt, deployer.address);
    await feedProtocol.waitForDeployment();
    const feedProtocolAddress = await feedProtocol.getAddress();

    // 4. Deploy SeatManager
    const SeatManager = await ethers.getContractFactory("SeatManager");
    const seatManager = await SeatManager.deploy(configAddress, usdt, nstToken, deployer.address);
    await seatManager.waitForDeployment();
    const seatManagerAddress = await seatManager.getAddress();

    // 5. Deploy PointsManager
    const PointsManager = await ethers.getContractFactory("PointsManager");
    const pointsManager = await PointsManager.deploy(configAddress, nstToken, deployer.address);
    await pointsManager.waitForDeployment();
    const pointsManagerAddress = await pointsManager.getAddress();

    // 6. Deploy OptionsCore
    const OptionsCore = await ethers.getContractFactory("OptionsCore");
    const optionsCore = await OptionsCore.deploy(configAddress, vaultManagerAddress, usdt, deployer.address);
    await optionsCore.waitForDeployment();
    const optionsCoreAddress = await optionsCore.getAddress();

    // 7. Configure
    await config.setUsdtAddress(usdt);
    await config.setVaultManagerAddress(vaultManagerAddress);
    await config.setOptionsCoreAddress(optionsCoreAddress);
    await config.setFeedProtocolAddress(feedProtocolAddress);
    await config.setSeatManagerAddress(seatManagerAddress);
    await config.setPointsManagerAddress(pointsManagerAddress);

    // 8. Grant roles
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    await vaultManager.grantRole(VAULT_OPERATOR_ROLE, optionsCoreAddress);

    const PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE"));
    await feedProtocol.grantRole(PROTOCOL_ROLE, optionsCoreAddress);

    const addresses = {
        USDT: usdt,
        Config: configAddress,
        VaultManager: vaultManagerAddress,
        OptionsCore: optionsCoreAddress,
        FeedProtocol: feedProtocolAddress,
        SeatManager: seatManagerAddress,
        PointsManager: pointsManagerAddress,
    };

    // Save to file
    fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));

    console.log("\n✅ 部署完成！地址已保存到 deployed-addresses.json");
    console.log(JSON.stringify(addresses, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
