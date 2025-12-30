import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Config, VaultManager, OptionsCore } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OptionsCore", function () {
    // Test fixtures
    async function deployOptionsCoreFixture() {
        const [owner, buyer, seller, feeder, admin] = await ethers.getSigners();

        // Deploy mock USDT
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        // Mint USDT to test accounts
        const mintAmount = ethers.parseUnits("1000000", 18);
        await usdt.mint(buyer.address, mintAmount);
        await usdt.mint(seller.address, mintAmount);

        // Deploy Config
        const Config = await ethers.getContractFactory("Config");
        const config = await Config.deploy(admin.address);
        await config.waitForDeployment();

        // Deploy VaultManager
        const VaultManager = await ethers.getContractFactory("VaultManager");
        const vaultManager = await VaultManager.deploy(
            await config.getAddress(),
            admin.address
        );
        await vaultManager.waitForDeployment();

        // Deploy OptionsCore
        const OptionsCore = await ethers.getContractFactory("OptionsCore");
        const optionsCore = await OptionsCore.deploy(
            await config.getAddress(),
            await vaultManager.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await optionsCore.waitForDeployment();

        // Approve USDT for OptionsCore
        await usdt.connect(buyer).approve(await optionsCore.getAddress(), mintAmount);
        await usdt.connect(seller).approve(await optionsCore.getAddress(), mintAmount);

        return { optionsCore, config, vaultManager, usdt, owner, buyer, seller, feeder, admin };
    }

    describe("Deployment", function () {
        it("Should deploy with correct config and vaultManager", async function () {
            const { optionsCore, config, vaultManager } = await loadFixture(deployOptionsCoreFixture);

            expect(await optionsCore.config()).to.equal(await config.getAddress());
            expect(await optionsCore.vaultManager()).to.equal(await vaultManager.getAddress());
        });

        it("Should start with orderId = 1", async function () {
            const { optionsCore } = await loadFixture(deployOptionsCoreFixture);
            expect(await optionsCore.nextOrderId()).to.equal(1);
        });

        it("Should start with quoteId = 1", async function () {
            const { optionsCore } = await loadFixture(deployOptionsCoreFixture);
            expect(await optionsCore.nextQuoteId()).to.equal(1);
        });
    });

    describe("createBuyerRFQ", function () {
        it("Should create a buyer RFQ successfully", async function () {
            const { optionsCore, buyer } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now

            const tx = await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金",                    // underlyingName
                "XAU",                    // underlyingCode
                "CN",                     // market
                "CN",                     // country
                "2000.00",                // refPrice
                0,                        // direction: Call
                ethers.parseUnits("10000", 18),  // notionalUSDT
                expiryTimestamp,          // expiryTimestamp
                800,                      // maxPremiumRate (8%)
                1000,                     // minMarginRate (10%)
                0,                        // acceptedSellerType: FreeSeller
                ethers.ZeroAddress,       // designatedSeller
                86400,                    // arbitrationWindow (24h)
                7200,                     // marginCallDeadline (2h)
                false                     // dividendAdjustment
            );

            await expect(tx).to.emit(optionsCore, "OrderCreated");

            const order = await optionsCore.getOrder(1);
            expect(order.buyer).to.equal(buyer.address);
            expect(order.underlyingName).to.equal("黄金");
            expect(order.underlyingCode).to.equal("XAU");
            expect(order.status).to.equal(0); // RFQ_CREATED
        });

        it("Should increment orderId after creating RFQ", async function () {
            const { optionsCore, buyer } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            expect(await optionsCore.nextOrderId()).to.equal(2);
        });

        it("Should fail if notional is zero", async function () {
            const { optionsCore, buyer } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "黄金", "XAU", "CN", "CN", "2000.00", 0,
                    0, expiryTimestamp,  // notionalUSDT = 0
                    800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
                )
            ).to.be.revertedWith("OptionsCore: notional must be positive");
        });

        it("Should fail if expiry is in the past", async function () {
            const { optionsCore, buyer } = await loadFixture(deployOptionsCoreFixture);

            const pastTimestamp = Math.floor(Date.now() / 1000) - 86400;

            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "黄金", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), pastTimestamp,
                    800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
                )
            ).to.be.revertedWith("OptionsCore: expiry must be in future");
        });

        it("Should track buyer orders correctly", async function () {
            const { optionsCore, buyer } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            const buyerOrders = await optionsCore.getBuyerOrders(buyer.address);
            expect(buyerOrders.length).to.equal(1);
            expect(buyerOrders[0]).to.equal(1n);
        });
    });

    describe("createSellerOrder", function () {
        it("Should create a seller order successfully", async function () {
            const { optionsCore, seller } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            const tx = await optionsCore.connect(seller).createSellerOrder(
                "Apple Inc.",             // underlyingName
                "AAPL",                   // underlyingCode
                "US",                     // market
                "US",                     // country
                "170.00",                 // refPrice
                1,                        // direction: Put
                ethers.parseUnits("50000", 18),   // notionalUSDT
                expiryTimestamp,          // expiryTimestamp
                700,                      // premiumRate (7%)
                ethers.parseUnits("5000", 18),    // marginAmount
                0,                        // liquidationRule: NoLiquidation
                0,                        // consecutiveDays
                0,                        // dailyLimitPercent
                86400,                    // arbitrationWindow
                false                     // dividendAdjustment
            );

            await expect(tx).to.emit(optionsCore, "OrderCreated");

            const order = await optionsCore.getOrder(1);
            expect(order.seller).to.equal(seller.address);
            expect(order.underlyingName).to.equal("Apple Inc.");
            expect(order.direction).to.equal(1); // Put
        });

        it("Should track seller orders correctly", async function () {
            const { optionsCore, seller } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            await optionsCore.connect(seller).createSellerOrder(
                "AAPL", "AAPL", "US", "US", "170.00", 1,
                ethers.parseUnits("50000", 18), expiryTimestamp,
                700, ethers.parseUnits("5000", 18), 0, 0, 0, 86400, false
            );

            const sellerOrders = await optionsCore.getSellerOrders(seller.address);
            expect(sellerOrders.length).to.equal(1);
        });
    });

    describe("submitQuote", function () {
        it("Should submit quote to buyer RFQ", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            // Create buyer RFQ
            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            // Submit quote
            const quoteExpiry = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

            const tx = await optionsCore.connect(seller).submitQuote(
                1,                        // orderId
                750,                      // premiumRate (7.5%)
                1500,                     // marginRate (15%)
                0,                        // liquidationRule
                0,                        // consecutiveDays
                0                         // dailyLimitPercent
            );

            await expect(tx).to.emit(optionsCore, "QuoteSubmitted");

            const quote = await optionsCore.quotes(1);
            expect(quote.seller).to.equal(seller.address);
            expect(quote.premiumRate).to.equal(750);
        });

        it("Should update order status to QUOTING", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;
            const quoteExpiry = Math.floor(Date.now() / 1000) + 1800;

            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            await optionsCore.connect(seller).submitQuote(
                1, 750, 1500, 0, 0, 0
            );

            const order = await optionsCore.getOrder(1);
            expect(order.status).to.equal(1); // QUOTING
        });
    });

    describe("acceptQuote", function () {
        it("Should match order when buyer accepts quote", async function () {
            const { optionsCore, buyer, seller, usdt } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;
            const quoteExpiry = Math.floor(Date.now() / 1000) + 1800;

            // Create buyer RFQ
            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            // Seller submits quote
            await optionsCore.connect(seller).submitQuote(
                1, 700, 1500, 0, 0, 0
            );

            // Buyer accepts quote
            const tx = await optionsCore.connect(buyer).acceptQuote(1);

            await expect(tx).to.emit(optionsCore, "OrderMatched");

            const order = await optionsCore.getOrder(1);
            expect(order.status).to.equal(2); // MATCHED
            expect(order.seller).to.equal(seller.address);
        });
    });

    describe("cancelRFQ", function () {
        it("Should allow buyer to cancel RFQ before match", async function () {
            const { optionsCore, buyer } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            const tx = await optionsCore.connect(buyer).cancelRFQ(1);

            await expect(tx).to.emit(optionsCore, "OrderCancelled");

            const order = await optionsCore.getOrder(1);
            expect(order.status).to.equal(10); // CANCELLED
        });

        it("Should fail if non-buyer tries to cancel", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            await expect(
                optionsCore.connect(seller).cancelRFQ(1)
            ).to.be.revertedWith("OptionsCore: not buyer");
        });
    });

    describe("Margin Management", function () {
        it("Should reject addMargin when order is not LIVE", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployOptionsCoreFixture);

            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30;

            // Create and match order (status becomes MATCHED, not LIVE)
            await optionsCore.connect(buyer).createBuyerRFQ(
                "黄金", "XAU", "CN", "CN", "2000.00", 0,
                ethers.parseUnits("10000", 18), expiryTimestamp,
                800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false
            );

            await optionsCore.connect(seller).submitQuote(
                1, 700, 1500, 0, 0, 0
            );

            await optionsCore.connect(buyer).acceptQuote(1);

            // Verify order is in MATCHED status
            const order = await optionsCore.getOrder(1);
            expect(order.status).to.equal(2); // MATCHED

            // Try to add margin - should fail because order is not LIVE
            const addAmount = ethers.parseUnits("500", 18);
            await expect(
                optionsCore.connect(seller).addMargin(1, addAmount)
            ).to.be.revertedWith("OptionsCore: order not live");
        });
    });
});
