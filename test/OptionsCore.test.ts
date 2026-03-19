/**
 * OptionsCore + OptionsSettlement Integration Tests
 *
 * 覆盖 8 条主链路：
 *   1. 买方 RFQ 创建
 *   2. 卖方挂单
 *   3. 报价、接单、成交
 *   4. 首轮喂价 → LIVE
 *   5. 终轮喂价 → PENDING_SETTLEMENT → 结算
 *   6. 取消 / 退款 / 超时
 *   7. 仲裁
 *   8. 补保证金 / 强平
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OptionsCore + OptionsSettlement Integration", function () {
    // ==================== Shared Fixture ====================
    async function deployFullSystemFixture() {
        const [owner, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, admin] =
            await ethers.getSigners();

        // --- Mock USDT ---
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        const MILLION = ethers.parseUnits("1000000", 18);
        await usdt.mint(buyer.address, MILLION);
        await usdt.mint(seller.address, MILLION);
        for (const f of [feeder1, feeder2, feeder3, feeder4, feeder5]) {
            await usdt.mint(f.address, MILLION);
        }

        // --- Config ---
        const Config = await ethers.getContractFactory("Config");
        const config = await Config.deploy(admin.address);
        await config.waitForDeployment();

        // --- VaultManager ---
        const VaultManager = await ethers.getContractFactory("VaultManager");
        const vaultManager = await VaultManager.deploy(
            await config.getAddress(),
            admin.address
        );
        await vaultManager.waitForDeployment();

        // --- OptionsCore ---
        const OptionsCore = await ethers.getContractFactory("OptionsCore");
        const optionsCore = await OptionsCore.deploy(
            await config.getAddress(),
            await vaultManager.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await optionsCore.waitForDeployment();

        // --- FeedProtocol ---
        const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
        const feedProtocol = await FeedProtocol.deploy(
            await config.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await feedProtocol.waitForDeployment();

        // --- OptionsSettlement ---
        const OptionsSettlement = await ethers.getContractFactory("OptionsSettlement");
        const optionsSettlement = await OptionsSettlement.deploy(
            await optionsCore.getAddress(),
            await config.getAddress(),
            await vaultManager.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await optionsSettlement.waitForDeployment();

        // ==================== Role Grants ====================
        const VAULT_OP = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const SETTLEMENT = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
        const FEED_PROTOCOL = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));

        // VaultManager → OptionsCore + OptionsSettlement are operators
        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsCore.getAddress());
        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsSettlement.getAddress());

        // OptionsCore → OptionsSettlement is SETTLEMENT_ROLE
        await optionsCore.connect(admin).grantRole(SETTLEMENT, await optionsSettlement.getAddress());

        // OptionsCore → FeedProtocol is FEED_PROTOCOL_ROLE
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL, await feedProtocol.getAddress());

        // FeedProtocol → set optionsCore for callback
        await feedProtocol.connect(admin).setOptionsCore(await optionsCore.getAddress());

        // ==================== Approvals ====================
        const vmAddr = await vaultManager.getAddress();
        const fpAddr = await feedProtocol.getAddress();
        await usdt.connect(buyer).approve(vmAddr, MILLION);
        await usdt.connect(seller).approve(vmAddr, MILLION);
        for (const f of [feeder1, feeder2, feeder3, feeder4, feeder5]) {
            await usdt.connect(f).approve(fpAddr, MILLION);
        }

        return {
            usdt, config, vaultManager, optionsCore, feedProtocol, optionsSettlement,
            owner, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, admin,
        };
    }

    // ==================== Helpers ====================

    /** Create a buyer RFQ (returns orderId = 1) */
    async function createRFQ(
        optionsCore: any,
        buyer: SignerWithAddress,
        opts: { direction?: number; notional?: bigint; maxPremiumRate?: number; minMarginRate?: number } = {}
    ) {
        const expiryTimestamp = (await time.latest()) + 86400 * 30;
        const {
            direction = 0,
            notional = ethers.parseUnits("10000", 18),
            maxPremiumRate = 800,
            minMarginRate = 1000,
        } = opts;

        await optionsCore.connect(buyer).createBuyerRFQ(
            "Gold", "XAU", "CN", "CN", "2000.00",
            direction, notional, expiryTimestamp,
            maxPremiumRate, minMarginRate,
            0, ethers.ZeroAddress,
            86400, 7200,
            false,
            0, 0, 0, 0
        );
        return Number(await optionsCore.nextOrderId()) - 1;
    }

    /** Full flow: RFQ → Quote → Accept → order is MATCHED */
    async function createMatchedOrder(
        optionsCore: any,
        buyer: SignerWithAddress,
        seller: SignerWithAddress,
        opts: { direction?: number; premiumRate?: number; marginRate?: number; liquidationRule?: number } = {}
    ) {
        const { direction = 0, premiumRate = 700, marginRate = 1500, liquidationRule = 0 } = opts;
        const orderId = await createRFQ(optionsCore, buyer, { direction });
        await optionsCore.connect(seller).submitQuote(orderId, premiumRate, marginRate, liquidationRule, 0, 0);
        await optionsCore.connect(buyer).acceptQuote(1); // quoteId = 1
        return orderId;
    }

    /** Register N feeders and make them active */
    async function registerFeeders(feedProtocol: any, feeders: SignerWithAddress[]) {
        const stakeAmount = ethers.parseUnits("100", 18);
        for (const f of feeders) {
            await feedProtocol.connect(f).registerFeeder(stakeAmount);
        }
    }

    /**
     * Simulate initial feed: 5 feeders submit, creating a Tier_5_3 request,
     * then finalize → OptionsCore processFeedCallback → order becomes LIVE
     */
    async function doInitialFeed(
        feedProtocol: any,
        optionsCore: any,
        buyer: SignerWithAddress,
        orderId: number,
        feeders: SignerWithAddress[],
        prices: bigint[],
        admin: SignerWithAddress
    ) {
        // Create feed request via FeedProtocol (uses requestFeedPublic)
        const usdt = await ethers.getContractAt("MockERC20", await feedProtocol.usdt());
        const fpAddr = await feedProtocol.getAddress();
        // Buyer needs to approve USDT for FeedProtocol (for feed fee)
        await usdt.connect(buyer).approve(fpAddr, ethers.parseUnits("100", 18));

        await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0); // FeedType.Initial, Tier_5_3
        const requestId = Number(await feedProtocol.nextRequestId()) - 1;

        // Feeders submit prices
        for (let i = 0; i < feeders.length && i < prices.length; i++) {
            await feedProtocol.connect(feeders[i]).submitFeed(requestId, prices[i]);
        }

        return requestId;
    }

    // ======================================================================
    // 1. 买方 RFQ 创建
    // ======================================================================
    describe("1. 买方 RFQ 创建", function () {
        it("应成功创建 RFQ，状态为 RFQ_CREATED（0）", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);

            const order = await optionsCore.getOrder(orderId);
            expect(order.buyer).to.equal(buyer.address);
            expect(order.status).to.equal(0); // RFQ_CREATED
            expect(order.underlyingCode).to.equal("XAU");
        });

        it("orderId 自增", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            expect(await optionsCore.nextOrderId()).to.equal(1);

            await createRFQ(optionsCore, buyer);
            expect(await optionsCore.nextOrderId()).to.equal(2);
        });

        it("notional=0 应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;

            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    0, exp, 800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false, 0, 0, 0, 0
                )
            ).to.be.revertedWith("OptionsCore: notional must be positive");
        });

        it("过期时间在过去应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const past = (await time.latest()) - 86400;

            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), past,
                    800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false, 0, 0, 0, 0
                )
            ).to.be.revertedWith("OptionsCore: expiry must be in future");
        });

        it("emit OrderCreated 事件", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;

            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false, 0, 0, 0, 0
                )
            ).to.emit(optionsCore, "OrderCreated");
        });
    });

    // ======================================================================
    // 2. 卖方挂单
    // ======================================================================
    describe("2. 卖方挂单", function () {
        it("应成功创建卖方单", async function () {
            const { optionsCore, seller } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;

            const tx = await optionsCore.connect(seller).createSellerOrder(
                "Apple", "AAPL", "US", "US", "170.00",
                1, // Put
                ethers.parseUnits("50000", 18), exp,
                700, ethers.parseUnits("5000", 18),
                0, 0, 0, 86400, false, 1, 0
            );
            await expect(tx).to.emit(optionsCore, "OrderCreated");

            const order = await optionsCore.getOrder(1);
            expect(order.seller).to.equal(seller.address);
            expect(order.direction).to.equal(1);
        });

        it("卖方订单应正确追踪", async function () {
            const { optionsCore, seller } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;

            await optionsCore.connect(seller).createSellerOrder(
                "AAPL", "AAPL", "US", "US", "170.00", 1,
                ethers.parseUnits("50000", 18), exp,
                700, ethers.parseUnits("5000", 18), 0, 0, 0, 86400, false, 1, 0
            );

            const orders = await optionsCore.getSellerOrders(seller.address);
            expect(orders.length).to.equal(1);
        });
    });

    // ======================================================================
    // 3. 报价、接单、成交
    // ======================================================================
    describe("3. 报价→接单→成交", function () {
        it("卖方报价后状态变为 QUOTING（1）", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);

            await optionsCore.connect(seller).submitQuote(orderId, 750, 1500, 0, 0, 0);

            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(1); // QUOTING

            const quote = await optionsCore.quotes(1);
            expect(quote.seller).to.equal(seller.address);
            expect(quote.premiumRate).to.equal(750);
        });

        it("买方接受报价后状态变为 MATCHED（2），保证金正确锁定", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(2); // MATCHED
            expect(order.seller).to.equal(seller.address);
            // marginRate=1500(15%), notional=10000 → margin = 1500
            expect(order.currentMargin).to.equal(ethers.parseUnits("1500", 18));
        });

        it("emit OrderMatched 事件", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);
            await optionsCore.connect(seller).submitQuote(orderId, 700, 1500, 0, 0, 0);

            await expect(optionsCore.connect(buyer).acceptQuote(1))
                .to.emit(optionsCore, "OrderMatched");
        });
    });

    // ======================================================================
    // 4. 首轮喂价 → LIVE
    // ======================================================================
    describe("4. 首轮喂价→LIVE", function () {
        it("5 个喂价员提交价格后，订单状态从 MATCHED → LIVE，strikePrice 被设置", async function () {
            const { optionsCore, feedProtocol, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, admin, usdt } =
                await loadFixture(deployFullSystemFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);
            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);

            // Buyer approves USDT for FeedProtocol
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));

            // Create feed request (Initial=0, Tier_5_3=0)
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const requestId = Number(await feedProtocol.nextRequestId()) - 1;

            // requestFeedPublic 后订单必须切到 WAITING_INITIAL_FEED (3)
            const orderAfterRequest = await optionsCore.getOrder(orderId);
            expect(orderAfterRequest.status).to.equal(3); // WAITING_INITIAL_FEED

            // Submit 5 prices (中位数 = 2000)
            const prices = [
                ethers.parseUnits("1980", 18),
                ethers.parseUnits("1990", 18),
                ethers.parseUnits("2000", 18),
                ethers.parseUnits("2010", 18),
                ethers.parseUnits("2020", 18),
            ];
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(requestId, prices[i]);
            }

            // After 5 submissions → auto-finalize → callback → LIVE
            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE
            expect(order.strikePrice).to.equal(ethers.parseUnits("2000", 18)); // median
            expect(order.lastFeedPrice).to.equal(ethers.parseUnits("2000", 18));
        });
    });

    // ======================================================================
    // 4b. 动态喂价（Dynamic Feed）→ 仅更新 lastFeedPrice
    // ======================================================================
    describe("4b. 动态喂价 → lastFeedPrice 更新，状态保持 LIVE", function () {
        it("LIVE 订单动态喂价后 lastFeedPrice 更新，状态仍为 LIVE", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, usdt,
            } = fixture;

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);

            // Get to MATCHED state
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            // Initial feed → LIVE
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0); // Initial
            let reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }
            let order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE
            expect(order.lastFeedPrice).to.equal(ethers.parseUnits("2000", 18));

            // Dynamic feed (FeedType=1) → 更新 lastFeedPrice to 2100, 状态保持 LIVE
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 1, 0); // Dynamic=1
            reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2100", 18));
            }

            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // still LIVE
            expect(order.lastFeedPrice).to.equal(ethers.parseUnits("2100", 18)); // updated
            expect(order.strikePrice).to.equal(ethers.parseUnits("2000", 18)); // unchanged
        });

        it("非 LIVE 状态不能执行动态喂价", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, usdt,
            } = fixture;

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);

            // Order is MATCHED (not LIVE)
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            // Try Dynamic feed on MATCHED order → should revert with status mismatch
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));
            await expect(
                feedProtocol.connect(buyer).requestFeedPublic(orderId, 1, 0) // Dynamic=1
            ).to.be.revertedWith("FeedProtocol: order not LIVE for Dynamic feed");

            // Order state unchanged
            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(2); // still MATCHED
            expect(order.lastFeedPrice).to.equal(0); // not updated
        });
    });

    // ======================================================================
    // 5. 终轮喂价 → PENDING_SETTLEMENT → 结算
    // ======================================================================
    describe("5. 结算（Call 盈利 / Put 盈利 / 卖方盈利）", function () {
        /**
         * Helper: get a fully LIVE order with known strike price,
         * then do final feed + settle
         */
        async function getSettleableOrder(fixture: any) {
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, admin, usdt,
            } = fixture;

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, { direction: 0 });
            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);

            // Buyer approves USDT for FeedProtocol
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("200", 18));

            // Initial feed → LIVE (strike = 2000)
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const req1 = Number(await feedProtocol.nextRequestId()) - 1;
            const initialPrices = [
                ethers.parseUnits("1980", 18),
                ethers.parseUnits("1990", 18),
                ethers.parseUnits("2000", 18),
                ethers.parseUnits("2010", 18),
                ethers.parseUnits("2020", 18),
            ];
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(req1, initialPrices[i]);
            }

            return { orderId, feeders };
        }

        it("Call 买方盈利：finalPrice > strikePrice → buyer 获利", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, usdt,
            } = fixture;

            const { orderId, feeders } = await getSettleableOrder(fixture);

            // Verify LIVE
            let order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE

            // earlyExercise (T+0 exerciseDelay)
            await optionsSettlement.connect(buyer).earlyExercise(orderId);
            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(5); // WAITING_FINAL_FEED

            // Final feed → PENDING_SETTLEMENT (finalPrice = 2200, 10% profit)
            // FeedType enum: 0=Initial, 1=Dynamic, 2=Final
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 2, 0);
            const req2 = Number(await feedProtocol.nextRequestId()) - 1;
            const finalPrices = [
                ethers.parseUnits("2180", 18),
                ethers.parseUnits("2190", 18),
                ethers.parseUnits("2200", 18),
                ethers.parseUnits("2210", 18),
                ethers.parseUnits("2220", 18),
            ];
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(req2, finalPrices[i]);
            }

            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(6); // PENDING_SETTLEMENT
            expect(order.lastFeedPrice).to.equal(ethers.parseUnits("2200", 18));

            // Settle
            const buyerBefore = await usdt.balanceOf(buyer.address);
            const sellerBefore = await usdt.balanceOf(seller.address);

            await expect(optionsSettlement.settle(orderId))
                .to.emit(optionsSettlement, "OrderSettled");

            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(8); // SETTLED

            // buyerProfit = (2200-2000)*10000/2000 = 1000 USDT
            // currentMargin was 1500, so buyerPayout=1000, seller=500
            const buyerAfter = await usdt.balanceOf(buyer.address);
            const sellerAfter = await usdt.balanceOf(seller.address);

            expect(buyerAfter - buyerBefore).to.equal(ethers.parseUnits("1000", 18));
            expect(sellerAfter - sellerBefore).to.equal(ethers.parseUnits("500", 18));
        });

        it("卖方盈利：finalPrice <= strikePrice → 卖方拿回全部保证金", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, usdt,
            } = fixture;

            const { orderId, feeders } = await getSettleableOrder(fixture);

            // earlyExercise
            await optionsSettlement.connect(buyer).earlyExercise(orderId);

            // Final feed with lower price (finalPrice=1900 < strike=2000, Call = no profit for buyer)
            // FeedType enum: 2=Final
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 2, 0);
            const req2 = Number(await feedProtocol.nextRequestId()) - 1;
            const finalPrices = [
                ethers.parseUnits("1880", 18),
                ethers.parseUnits("1890", 18),
                ethers.parseUnits("1900", 18),
                ethers.parseUnits("1910", 18),
                ethers.parseUnits("1920", 18),
            ];
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(req2, finalPrices[i]);
            }

            const sellerBefore = await usdt.balanceOf(seller.address);
            await optionsSettlement.settle(orderId);
            const sellerAfter = await usdt.balanceOf(seller.address);

            // Buyer profit = 0 → seller gets full margin back (1500 USDT)
            expect(sellerAfter - sellerBefore).to.equal(ethers.parseUnits("1500", 18));
        });
    });

    // ======================================================================
    // 6. 取消 / 退款 / 超时
    // ======================================================================
    describe("6. 取消 / 退款 / 超时", function () {
        it("买方可取消未成交的 RFQ", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);

            await expect(optionsCore.connect(buyer).cancelRFQ(orderId))
                .to.emit(optionsCore, "OrderCancelled");

            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(10); // CANCELLED
        });

        it("非买方不能取消", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);

            await expect(
                optionsCore.connect(seller).cancelRFQ(orderId)
            ).to.be.revertedWith("OptionsCore: not buyer");
        });

        it("初始喂价超时 → cancelOrderDueToFeedTimeout（权利金退还 + 卖方扣违约金）", async function () {
            const { optionsCore, optionsSettlement, buyer, seller, config, admin, usdt } =
                await loadFixture(deployFullSystemFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            // Fast-forward past initialFeedDeadline
            const deadline = await config.initialFeedDeadline();
            await time.increase(Number(deadline) + 1);

            await expect(optionsSettlement.cancelOrderDueToFeedTimeout(orderId))
                .to.emit(optionsSettlement, "OrderCancelled");

            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(10); // CANCELLED
        });
    });

    // ======================================================================
    // 7. 仲裁
    // ======================================================================
    describe("7. 仲裁", function () {
        it("MATCHED 状态不能发起仲裁", async function () {
            const { optionsCore, optionsSettlement, buyer, seller } =
                await loadFixture(deployFullSystemFixture);
            await createMatchedOrder(optionsCore, buyer, seller);

            await expect(
                optionsSettlement.connect(buyer).initiateArbitration(1)
            ).to.be.revertedWith("Settlement: cannot initiate arbitration");
        });

        it("完整仲裁流程：initiateArbitration → resolveArbitration", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5,
                admin, usdt,
            } = fixture;

            // Get order to PENDING_SETTLEMENT
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);
            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("200", 18));

            // Initial feed → LIVE
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            let reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            // earlyExercise → WAITING_FINAL_FEED
            await optionsSettlement.connect(buyer).earlyExercise(orderId);

            // Final feed → PENDING_SETTLEMENT
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 2, 0);
            reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2100", 18));
            }

            let order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(6); // PENDING_SETTLEMENT

            // Buyer approves arbitration fee
            const arbFee = await fixture.config.arbitrationFee();
            await usdt.connect(buyer).approve(await fixture.vaultManager.getAddress(), arbFee);

            // Initiate arbitration
            await optionsSettlement.connect(buyer).initiateArbitration(orderId);
            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(7); // ARBITRATION

            // Admin resolves with same price (no reward transfer needed)
            await expect(
                optionsSettlement.connect(admin).resolveArbitration(
                    orderId,
                    ethers.parseUnits("2100", 18),
                    [admin.address]
                )
            ).to.emit(optionsSettlement, "ArbitrationResolved");

            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(8); // SETTLED
        });
    });

    // ======================================================================
    // 8. 补保证金 / 强平
    // ======================================================================
    describe("8. 补保证金 / 强平", function () {
        it("MATCHED 状态不能 addMargin", async function () {
            const { optionsCore, optionsSettlement, buyer, seller } =
                await loadFixture(deployFullSystemFixture);
            await createMatchedOrder(optionsCore, buyer, seller);

            await expect(
                optionsSettlement.connect(seller).addMargin(1, ethers.parseUnits("500", 18))
            ).to.be.revertedWith("Settlement: order not live");
        });

        it("LIVE 状态可以 addMargin", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, usdt
            } = fixture;

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);
            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));

            // Initial feed → LIVE
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            let order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE

            // Seller approves USDT for VaultManager then adds margin
            await usdt.connect(seller).approve(await fixture.vaultManager.getAddress(), ethers.parseUnits("500", 18));
            await expect(
                optionsSettlement.connect(seller).addMargin(orderId, ethers.parseUnits("500", 18))
            ).to.emit(optionsSettlement, "MarginChanged");

            order = await optionsCore.getOrder(orderId);
            expect(order.currentMargin).to.equal(ethers.parseUnits("2000", 18)); // 1500 + 500
        });

        it("非 LIVE 状态不能 forceLiquidate", async function () {
            const { optionsCore, optionsSettlement, buyer, seller, admin } =
                await loadFixture(deployFullSystemFixture);
            await createMatchedOrder(optionsCore, buyer, seller);

            await expect(
                optionsSettlement.connect(admin).forceLiquidate(1)
            ).to.be.revertedWith("Settlement: order not live");
        });

        it("无强平规则的订单不能 forceLiquidate", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, admin, usdt
            } = fixture;

            // Create order with liquidationRule=0 (NoLiquidation)
            const orderId = await createMatchedOrder(optionsCore, buyer, seller, { liquidationRule: 0 });
            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));

            // Initial feed → LIVE
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            await expect(
                optionsSettlement.connect(admin).forceLiquidate(orderId)
            ).to.be.revertedWith("Settlement: no liquidation rule set");
        });

        it("有强平规则的 LIVE 订单可以被 forceLiquidate → 保证金赔付买方", async function () {
            const fixture = await loadFixture(deployFullSystemFixture);
            const {
                optionsCore, feedProtocol, optionsSettlement,
                buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5, admin, usdt
            } = fixture;

            // Create order with liquidationRule=1
            const orderId = await createMatchedOrder(optionsCore, buyer, seller, { liquidationRule: 1 });
            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            await usdt.connect(buyer).approve(await feedProtocol.getAddress(), ethers.parseUnits("100", 18));

            // Initial feed → LIVE
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            const buyerBefore = await usdt.balanceOf(buyer.address);

            await expect(
                optionsSettlement.connect(admin).forceLiquidate(orderId)
            ).to.emit(optionsSettlement, "OrderLiquidated");

            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(9); // LIQUIDATED
            expect(order.currentMargin).to.equal(0);

            // Buyer should receive full margin (1500)
            const buyerAfter = await usdt.balanceOf(buyer.address);
            expect(buyerAfter - buyerBefore).to.equal(ethers.parseUnits("1500", 18));
        });
    });

    // ======================================================================
    // 9. Config 约束边界校验
    // ======================================================================
    describe("9. Config 约束边界校验", function () {

        // ---- createBuyerRFQ 约束 ----

        it("createBuyerRFQ: minMarginRate 低于 config 最小值应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.minMarginRate = 1000 (10%), 传 999 应失败
            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 999, 0, ethers.ZeroAddress, 86400, 7200, false, 0, 3, 10, 0
                )
            ).to.be.revertedWith("OptionsCore: minMarginRate below config minimum");
        });

        it("createBuyerRFQ: arbitrationWindow 超上限应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.maxArbitrationWindow = 48h = 172800, 传 172801 应失败
            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 1000, 0, ethers.ZeroAddress, 172801, 7200, false, 0, 3, 10, 0
                )
            ).to.be.revertedWith("OptionsCore: arbitrationWindow out of config range");
        });

        it("createBuyerRFQ: arbitrationWindow 低于下限应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.minArbitrationWindow = 1h = 3600, 传 3599 应失败
            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 1000, 0, ethers.ZeroAddress, 3599, 7200, false, 0, 3, 10, 0
                )
            ).to.be.revertedWith("OptionsCore: arbitrationWindow out of config range");
        });

        it("createBuyerRFQ: marginCallDeadline 超上限应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.maxMarginCallDeadline = 24h = 86400, 传 86401 应失败
            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 1000, 0, ethers.ZeroAddress, 86400, 86401, false, 0, 3, 10, 0
                )
            ).to.be.revertedWith("OptionsCore: marginCallDeadline out of config range");
        });

        it("createBuyerRFQ: consecutiveDays 超上限应 revert", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.maxConsecutiveDays = 10, 传 11 应失败
            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false, 0, 11, 10, 0
                )
            ).to.be.revertedWith("OptionsCore: consecutiveDays exceeds config maximum");
        });

        it("createBuyerRFQ: 所有参数在合法边界值应成功", async function () {
            const { optionsCore, buyer } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // minMarginRate=1000, arbitrationWindow=3600(1h), marginCallDeadline=3600(1h), consecutiveDays=10
            await expect(
                optionsCore.connect(buyer).createBuyerRFQ(
                    "Gold", "XAU", "CN", "CN", "2000.00", 0,
                    ethers.parseUnits("10000", 18), exp,
                    800, 1000, 0, ethers.ZeroAddress, 3600, 3600, false, 0, 10, 10, 0
                )
            ).to.emit(optionsCore, "OrderCreated");
        });

        // ---- createSellerOrder 约束 ----

        it("createSellerOrder: exerciseDelay 低于 T+1 应 revert", async function () {
            const { optionsCore, seller } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.minExerciseDelay = 1, 传 0 应失败
            await expect(
                optionsCore.connect(seller).createSellerOrder(
                    "AAPL", "AAPL", "US", "US", "170.00", 1,
                    ethers.parseUnits("50000", 18), exp,
                    700, ethers.parseUnits("5000", 18), 0, 3, 10, 86400, false, 0, 0
                )
            ).to.be.revertedWith("OptionsCore: exerciseDelay out of config range");
        });

        it("createSellerOrder: exerciseDelay 超 T+5 应 revert", async function () {
            const { optionsCore, seller } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // config.maxExerciseDelay = 5, 传 6 应失败
            await expect(
                optionsCore.connect(seller).createSellerOrder(
                    "AAPL", "AAPL", "US", "US", "170.00", 1,
                    ethers.parseUnits("50000", 18), exp,
                    700, ethers.parseUnits("5000", 18), 0, 3, 10, 86400, false, 6, 0
                )
            ).to.be.revertedWith("OptionsCore: exerciseDelay out of config range");
        });

        it("createSellerOrder: arbitrationWindow 超上限应 revert", async function () {
            const { optionsCore, seller } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            await expect(
                optionsCore.connect(seller).createSellerOrder(
                    "AAPL", "AAPL", "US", "US", "170.00", 1,
                    ethers.parseUnits("50000", 18), exp,
                    700, ethers.parseUnits("5000", 18), 0, 3, 10, 172801, false, 1, 0
                )
            ).to.be.revertedWith("OptionsCore: arbitrationWindow out of config range");
        });

        it("createSellerOrder: 合法边界值应成功", async function () {
            const { optionsCore, seller } = await loadFixture(deployFullSystemFixture);
            const exp = (await time.latest()) + 86400 * 30;
            // exerciseDelay=5(T+5 上限), consecutiveDays=10, arbitrationWindow=172800(48h 上限)
            await expect(
                optionsCore.connect(seller).createSellerOrder(
                    "AAPL", "AAPL", "US", "US", "170.00", 1,
                    ethers.parseUnits("50000", 18), exp,
                    700, ethers.parseUnits("5000", 18), 0, 10, 10, 172800, false, 5, 0
                )
            ).to.emit(optionsCore, "OrderCreated");
        });

        // ---- submitQuote 约束 ----

        it("submitQuote: consecutiveDays 超上限应 revert", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);
            // config.maxConsecutiveDays = 10, 传 11 应失败
            await expect(
                optionsCore.connect(seller).submitQuote(orderId, 750, 1500, 0, 11, 10)
            ).to.be.revertedWith("OptionsCore: consecutiveDays exceeds config maximum");
        });

        it("submitQuote: marginRate 低于 config 最小值应 revert", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);
            // config.minMarginRate = 1000 (10%), 传 999 应失败
            await expect(
                optionsCore.connect(seller).submitQuote(orderId, 750, 999, 0, 3, 10)
            ).to.be.revertedWith("OptionsCore: marginRate below config minimum");
        });

        it("submitQuote: 超过最大报价数应 revert", async function () {
            const { optionsCore, buyer, seller, admin, feeder1, feeder2, feeder3, feeder4, feeder5, usdt, vaultManager } =
                await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);

            // 为所有报价 signer 铸 USDT 并授权 VaultManager（submitQuote 需要 depositMargin）
            const MILLION = ethers.parseUnits("1000000", 18);
            const vmAddr = await vaultManager.getAddress();
            await usdt.mint(admin.address, MILLION);
            for (const s of [seller, admin, feeder1, feeder2, feeder3, feeder4]) {
                await usdt.connect(s).approve(vmAddr, MILLION);
            }

            // config.maxQuotesPerBuyerOrder = 5, 提交 5 个报价后第 6 个应失败
            const signers = [seller, admin, feeder1, feeder2, feeder3];
            for (const s of signers) {
                await optionsCore.connect(s).submitQuote(orderId, 750, 1500, 0, 3, 10);
            }
            await expect(
                optionsCore.connect(feeder4).submitQuote(orderId, 750, 1500, 0, 3, 10)
            ).to.be.revertedWith("OptionsCore: max active quotes reached for this order");
        });

        it("submitQuote: 合法参数应成功", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFullSystemFixture);
            const orderId = await createRFQ(optionsCore, buyer);
            // marginRate=1000(10% 边界值), consecutiveDays=10(上限)
            await expect(
                optionsCore.connect(seller).submitQuote(orderId, 750, 1000, 0, 10, 10)
            ).to.emit(optionsCore, "QuoteSubmitted");
        });
    });
});

