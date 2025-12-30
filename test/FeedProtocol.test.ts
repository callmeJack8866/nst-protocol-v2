import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("FeedProtocol", function () {
    // Test fixtures
    async function deployFeedProtocolFixture() {
        const [owner, feeder1, feeder2, feeder3, admin] = await ethers.getSigners();

        // Deploy mock USDT
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        // Mint USDT to feeders
        const mintAmount = ethers.parseUnits("10000", 18);
        await usdt.mint(feeder1.address, mintAmount);
        await usdt.mint(feeder2.address, mintAmount);
        await usdt.mint(feeder3.address, mintAmount);

        // Deploy Config
        const Config = await ethers.getContractFactory("Config");
        const config = await Config.deploy(admin.address);
        await config.waitForDeployment();

        // Deploy FeedProtocol
        const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
        const feedProtocol = await FeedProtocol.deploy(
            await config.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await feedProtocol.waitForDeployment();

        // Approve USDT for FeedProtocol
        await usdt.connect(feeder1).approve(await feedProtocol.getAddress(), mintAmount);
        await usdt.connect(feeder2).approve(await feedProtocol.getAddress(), mintAmount);
        await usdt.connect(feeder3).approve(await feedProtocol.getAddress(), mintAmount);

        return { feedProtocol, config, usdt, owner, feeder1, feeder2, feeder3, admin };
    }

    describe("Deployment", function () {
        it("Should deploy with correct config", async function () {
            const { feedProtocol, config } = await loadFixture(deployFeedProtocolFixture);
            expect(await feedProtocol.config()).to.equal(await config.getAddress());
        });

        it("Should start with nextRequestId = 1", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);
            expect(await feedProtocol.nextRequestId()).to.equal(1);
        });
    });

    describe("Feeder Registration", function () {
        it("Should allow feeder registration with sufficient stake", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);

            // minFeederStake in Config is 100 ether
            const stakeAmount = ethers.parseUnits("100", 18);
            const tx = await feedProtocol.connect(feeder1).registerFeeder(stakeAmount);

            await expect(tx).to.emit(feedProtocol, "FeederRegistered");

            const feeder = await feedProtocol.feeders(feeder1.address);
            expect(feeder.isActive).to.equal(true);
            expect(feeder.stakedAmount).to.equal(stakeAmount);
        });

        it("Should fail registration with insufficient stake", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);

            const lowStake = ethers.parseUnits("10", 18); // Too low (< 100U min)
            await expect(
                feedProtocol.connect(feeder1).registerFeeder(lowStake)
            ).to.be.revertedWith("FeedProtocol: insufficient stake");
        });

        it("Should prevent duplicate registration", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);

            const stakeAmount = ethers.parseUnits("100", 18);
            await feedProtocol.connect(feeder1).registerFeeder(stakeAmount);

            await expect(
                feedProtocol.connect(feeder1).registerFeeder(stakeAmount)
            ).to.be.revertedWith("FeedProtocol: already registered");
        });
    });

    describe("Stake Management", function () {
        it("Should allow adding stake", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);

            const initialStake = ethers.parseUnits("100", 18);
            await feedProtocol.connect(feeder1).registerFeeder(initialStake);

            const additionalStake = ethers.parseUnits("50", 18);
            const tx = await feedProtocol.connect(feeder1).addStake(additionalStake);

            const feeder = await feedProtocol.feeders(feeder1.address);
            expect(feeder.stakedAmount).to.equal(initialStake + additionalStake);
        });
    });

    describe("Tier Configuration", function () {
        it("Should have correct tier 5-3 configuration", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);

            // FeedTier.Tier_5_3 = 0
            const tierConfig = await feedProtocol.tierConfigs(0);
            expect(tierConfig.totalFeeders).to.equal(5);
            expect(tierConfig.effectiveFeeds).to.equal(3);
            expect(tierConfig.totalFee).to.equal(ethers.parseUnits("3", 18));
        });

        it("Should have correct tier 7-5 configuration", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);

            // FeedTier.Tier_7_5 = 1
            const tierConfig = await feedProtocol.tierConfigs(1);
            expect(tierConfig.totalFeeders).to.equal(7);
            expect(tierConfig.effectiveFeeds).to.equal(5);
            expect(tierConfig.totalFee).to.equal(ethers.parseUnits("5", 18));
        });

        it("Should have correct tier 10-7 configuration", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);

            // FeedTier.Tier_10_7 = 2
            const tierConfig = await feedProtocol.tierConfigs(2);
            expect(tierConfig.totalFeeders).to.equal(10);
            expect(tierConfig.effectiveFeeds).to.equal(7);
            expect(tierConfig.totalFee).to.equal(ethers.parseUnits("8", 18));
        });
    });
});
