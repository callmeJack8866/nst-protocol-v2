/**
 * FeedProtocol Unit Tests
 *
 * 覆盖：注册、质押、喂价提交、中位数聚合、finalize 回调、拒绝、档位配置
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FeedProtocol", function () {
    // ==================== Fixture ====================
    async function deployFeedProtocolFixture() {
        const [owner, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller, admin] =
            await ethers.getSigners();

        // Mock USDT
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        const AMOUNT = ethers.parseUnits("100000", 18);
        for (const s of [feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller]) {
            await usdt.mint(s.address, AMOUNT);
        }

        // Config
        const Config = await ethers.getContractFactory("Config");
        const config = await Config.deploy(admin.address);
        await config.waitForDeployment();

        // VaultManager (needed for OptionsCore)
        const VaultManager = await ethers.getContractFactory("VaultManager");
        const vaultManager = await VaultManager.deploy(await config.getAddress(), admin.address);
        await vaultManager.waitForDeployment();

        // OptionsCore (needed for callback)
        const OptionsCore = await ethers.getContractFactory("OptionsCore");
        const optionsCore = await OptionsCore.deploy(
            await config.getAddress(), await vaultManager.getAddress(),
            await usdt.getAddress(), admin.address
        );
        await optionsCore.waitForDeployment();

        // FeedProtocol
        const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
        const feedProtocol = await FeedProtocol.deploy(
            await config.getAddress(), await usdt.getAddress(), admin.address
        );
        await feedProtocol.waitForDeployment();

        // Roles
        const VAULT_OP = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const FEED_PROTOCOL = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsCore.getAddress());
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL, await feedProtocol.getAddress());
        await feedProtocol.connect(admin).setOptionsCore(await optionsCore.getAddress());

        // Approvals
        const fp = await feedProtocol.getAddress();
        const vm = await vaultManager.getAddress();
        for (const f of [feeder1, feeder2, feeder3, feeder4, feeder5]) {
            await usdt.connect(f).approve(fp, AMOUNT);
        }
        await usdt.connect(buyer).approve(vm, AMOUNT);
        await usdt.connect(buyer).approve(fp, AMOUNT);
        await usdt.connect(seller).approve(vm, AMOUNT);

        return {
            feedProtocol, config, usdt, optionsCore, vaultManager,
            owner, feeder1, feeder2, feeder3, feeder4, feeder5,
            buyer, seller, admin,
        };
    }

    // ==================== Helpers ====================
    async function registerFeeders(fp: any, feeders: SignerWithAddress[]) {
        const stake = ethers.parseUnits("100", 18);
        for (const f of feeders) {
            await fp.connect(f).registerFeeder(stake);
        }
    }

    /** Create a matched order and return orderId */
    async function createMatchedOrder(oc: any, buyer: SignerWithAddress, seller: SignerWithAddress) {
        const exp = (await time.latest()) + 86400 * 30;
        await oc.connect(buyer).createBuyerRFQ(
            "Gold", "XAU", "CN", "CN", "2000.00", 0,
            ethers.parseUnits("10000", 18), exp,
            800, 1000, 0, ethers.ZeroAddress, 86400, 7200, false, 0, 0, 0, 0
        );
        const oid = Number(await oc.nextOrderId()) - 1;
        await oc.connect(seller).submitQuote(oid, 700, 1500, 0, 0, 0);
        await oc.connect(buyer).acceptQuote(1);
        return oid;
    }

    // ======================================================================
    // 部署
    // ======================================================================
    describe("部署", function () {
        it("Config 地址正确", async function () {
            const { feedProtocol, config } = await loadFixture(deployFeedProtocolFixture);
            expect(await feedProtocol.config()).to.equal(await config.getAddress());
        });

        it("nextRequestId 初始为 1", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);
            expect(await feedProtocol.nextRequestId()).to.equal(1);
        });
    });

    // ======================================================================
    // 喂价员注册
    // ======================================================================
    describe("喂价员注册", function () {
        it("满足最低质押可注册", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);
            const stake = ethers.parseUnits("100", 18);

            await expect(feedProtocol.connect(feeder1).registerFeeder(stake))
                .to.emit(feedProtocol, "FeederRegistered");

            const f = await feedProtocol.feeders(feeder1.address);
            expect(f.isActive).to.equal(true);
            expect(f.stakedAmount).to.equal(stake);
        });

        it("低于最低质押 revert", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);
            await expect(
                feedProtocol.connect(feeder1).registerFeeder(ethers.parseUnits("10", 18))
            ).to.be.revertedWith("FeedProtocol: insufficient stake");
        });

        it("重复注册 revert", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);
            const stake = ethers.parseUnits("100", 18);
            await feedProtocol.connect(feeder1).registerFeeder(stake);

            await expect(
                feedProtocol.connect(feeder1).registerFeeder(stake)
            ).to.be.revertedWith("FeedProtocol: already registered");
        });

        it("追加质押", async function () {
            const { feedProtocol, feeder1 } = await loadFixture(deployFeedProtocolFixture);
            const initial = ethers.parseUnits("100", 18);
            const add = ethers.parseUnits("50", 18);
            await feedProtocol.connect(feeder1).registerFeeder(initial);
            await feedProtocol.connect(feeder1).addStake(add);

            const f = await feedProtocol.feeders(feeder1.address);
            expect(f.stakedAmount).to.equal(initial + add);
        });
    });

    // ======================================================================
    // 档位配置
    // ======================================================================
    describe("档位配置", function () {
        it("Tier 5-3 正确", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);
            const t = await feedProtocol.tierConfigs(0);
            expect(t.totalFeeders).to.equal(5);
            expect(t.effectiveFeeds).to.equal(3);
            expect(t.totalFee).to.equal(ethers.parseUnits("3", 18));
        });

        it("Tier 7-5 正确", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);
            const t = await feedProtocol.tierConfigs(1);
            expect(t.totalFeeders).to.equal(7);
            expect(t.effectiveFeeds).to.equal(5);
            expect(t.totalFee).to.equal(ethers.parseUnits("5", 18));
        });

        it("Tier 10-7 正确", async function () {
            const { feedProtocol } = await loadFixture(deployFeedProtocolFixture);
            const t = await feedProtocol.tierConfigs(2);
            expect(t.totalFeeders).to.equal(10);
            expect(t.effectiveFeeds).to.equal(7);
            expect(t.totalFee).to.equal(ethers.parseUnits("8", 18));
        });
    });

    // ======================================================================
    // 喂价提交 + 中位数聚合 + Finalize + Callback
    // ======================================================================
    describe("喂价提交→聚合→Finalize→回调", function () {
        it("5 个喂价员提交后自动 finalize，中位数正确", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);

            // Create matched order
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            // requestFeedPublic → creates request
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // Submit 5 different prices [1980, 1990, 2000, 2010, 2020]
            // Sorted: [1980, 1990, 2000, 2010, 2020] → median = 2000
            const prices = [1980, 2020, 1990, 2010, 2000].map(p => ethers.parseUnits(String(p), 18));
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, prices[i]);
            }

            // Verify finalized
            const request = await feedProtocol.getFeedRequest(reqId);
            expect(request.finalized).to.equal(true);
            expect(request.finalPrice).to.equal(ethers.parseUnits("2000", 18));
        });

        it("偶数个提交取平均中位数", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller, admin } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // Submit only 4 prices then manually finalize
            const prices = [1980, 1990, 2010, 2020].map(p => ethers.parseUnits(String(p), 18));
            for (let i = 0; i < 4; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, prices[i]);
            }

            // 需要先推进时间到 deadline 之后才能外部调用 finalizeFeed
            const request = await feedProtocol.getFeedRequest(reqId);
            await time.increaseTo(Number(request.deadline) + 1);

            // Manually finalize (4 >= 3 effectiveFeeds for Tier_5_3)
            await feedProtocol.finalizeFeed(reqId);

            const finalizedReq = await feedProtocol.getFeedRequest(reqId);
            expect(finalizedReq.finalized).to.equal(true);
            // [1980, 1990, 2010, 2020] → median = (1990+2010)/2 = 2000
            expect(finalizedReq.finalPrice).to.equal(ethers.parseUnits("2000", 18));
        });

        it("emit FeedSubmitted 和 FeedFinalized 事件", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // First 4 submissions
            for (let i = 0; i < 4; i++) {
                await expect(
                    feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18))
                ).to.emit(feedProtocol, "FeedSubmitted");
            }

            // 5th triggers finalize
            await expect(
                feedProtocol.connect(feeders[4]).submitFeed(reqId, ethers.parseUnits("2000", 18))
            ).to.emit(feedProtocol, "FeedFinalized");
        });

        it("重复提交 revert", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            await feedProtocol.connect(feeder1).submitFeed(reqId, ethers.parseUnits("2000", 18));

            await expect(
                feedProtocol.connect(feeder1).submitFeed(reqId, ethers.parseUnits("2000", 18))
            ).to.be.revertedWith("FeedProtocol: already submitted");
        });

        it("price=0 revert", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            await expect(
                feedProtocol.connect(feeder1).submitFeed(reqId, 0)
            ).to.be.revertedWith("FeedProtocol: price must be positive");
        });
    });

    // ======================================================================
    // 喂价拒绝
    // ======================================================================
    describe("喂价拒绝", function () {
        it("活跃喂价员可以拒绝，计入 rejectedFeeds", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            await expect(
                feedProtocol.connect(feeder1).rejectFeed(reqId, "price not verifiable")
            ).to.emit(feedProtocol, "FeedRejected");

            const f = await feedProtocol.feeders(feeder1.address);
            expect(f.rejectedFeeds).to.equal(1);
        });

        it("3 提交 + 2 拒绝 → 所有人响应后自动 finalize（满足 effectiveFeeds=3）", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // 3 个有效报价
            await feedProtocol.connect(feeder1).submitFeed(reqId, ethers.parseUnits("1990", 18));
            await feedProtocol.connect(feeder2).submitFeed(reqId, ethers.parseUnits("2000", 18));
            await feedProtocol.connect(feeder3).submitFeed(reqId, ethers.parseUnits("2010", 18));

            // 1 拒绝（此时 submittedCount=4, 还没到 totalFeeders=5）
            await feedProtocol.connect(feeder4).rejectFeed(reqId, "unavailable");

            // 第 5 个拒绝 → submittedCount=5 >= totalFeeders=5 → 自动 finalize（validCount=3 >= effectiveFeeds=3 ✓）
            await expect(
                feedProtocol.connect(feeder5).rejectFeed(reqId, "cannot verify")
            ).to.emit(feedProtocol, "FeedFinalized");

            const request = await feedProtocol.getFeedRequest(reqId);
            expect(request.finalized).to.equal(true);
            // median of [1990, 2000, 2010] = 2000
            expect(request.finalPrice).to.equal(ethers.parseUnits("2000", 18));
        });

        it("2 提交 + 3 拒绝 → 有效报价不足 → emit FeedFinalizeSkipped，请求保持 un-finalized", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // 2 个有效报价
            await feedProtocol.connect(feeder1).submitFeed(reqId, ethers.parseUnits("2000", 18));
            await feedProtocol.connect(feeder2).submitFeed(reqId, ethers.parseUnits("2010", 18));

            // 3 个拒绝
            await feedProtocol.connect(feeder3).rejectFeed(reqId, "no");
            await feedProtocol.connect(feeder4).rejectFeed(reqId, "no");

            // 第 5 个拒绝 → submittedCount=5 >= totalFeeders=5 → 检查门槛 → validCount=2 < effectiveFeeds=3 → 跳过
            await expect(
                feedProtocol.connect(feeder5).rejectFeed(reqId, "no")
            ).to.emit(feedProtocol, "FeedFinalizeSkipped");

            const request = await feedProtocol.getFeedRequest(reqId);
            expect(request.finalized).to.equal(false); // 保持 un-finalized
        });

        it("reject 也计入 submittedCount", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            await feedProtocol.connect(feeder1).rejectFeed(reqId, "no");
            await feedProtocol.connect(feeder2).submitFeed(reqId, ethers.parseUnits("2000", 18));

            const request = await feedProtocol.getFeedRequest(reqId);
            expect(request.submittedCount).to.equal(2); // reject + submit both counted
        });
    });

    // ======================================================================
    // finalizeFeed 安全加固
    // ======================================================================
    describe("finalizeFeed 安全加固", function () {
        it("deadline 前外部调用 finalizeFeed 被拒绝", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // 3 个有效报价（满足 effectiveFeeds=3），但 deadline 未到
            for (let i = 0; i < 3; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            // 外部调用 finalizeFeed → 应被拒绝（deadline not reached）
            await expect(
                feedProtocol.finalizeFeed(reqId)
            ).to.be.revertedWith("FeedProtocol: deadline not reached");
        });

        it("有效报价数不足 effectiveFeeds 时 finalize 被拒绝", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // 只提交 2 个（Tier_5_3 需 effectiveFeeds=3）
            for (let i = 0; i < 2; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            // 推进时间到 deadline 之后
            const request = await feedProtocol.getFeedRequest(reqId);
            await time.increaseTo(Number(request.deadline) + 1);

            // 外部调用 finalizeFeed → 应被拒绝（insufficient valid feeds）
            await expect(
                feedProtocol.finalizeFeed(reqId)
            ).to.be.revertedWith("FeedProtocol: insufficient valid feeds for tier");
        });

        it("deadline 后且满足门槛可以 finalize", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // 提交 3 个（= effectiveFeeds Tier_5_3）
            for (let i = 0; i < 3; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            // 推进时间到 deadline 之后
            const request = await feedProtocol.getFeedRequest(reqId);
            await time.increaseTo(Number(request.deadline) + 1);

            // 外部调用 finalizeFeed → 应成功
            await expect(feedProtocol.finalizeFeed(reqId))
                .to.emit(feedProtocol, "FeedFinalized");

            const finalized = await feedProtocol.getFeedRequest(reqId);
            expect(finalized.finalized).to.equal(true);
        });
    });

    // ======================================================================
    // Finalize 回调 OptionsCore
    // ======================================================================
    describe("Finalize → OptionsCore 回调", function () {
        it("初始喂价完成后 OptionsCore 订单状态变为 LIVE", async function () {
            const { feedProtocol, optionsCore, feeder1, feeder2, feeder3, feeder4, feeder5, buyer, seller } =
                await loadFixture(deployFeedProtocolFixture);

            const feeders = [feeder1, feeder2, feeder3, feeder4, feeder5];
            await registerFeeders(feedProtocol, feeders);
            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            // Request initial feed
            await feedProtocol.connect(buyer).requestFeedPublic(orderId, 0, 0);
            const reqId = Number(await feedProtocol.nextRequestId()) - 1;

            // Submit all 5
            for (let i = 0; i < 5; i++) {
                await feedProtocol.connect(feeders[i]).submitFeed(reqId, ethers.parseUnits("2000", 18));
            }

            // Verify callback effect
            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE
            expect(order.strikePrice).to.equal(ethers.parseUnits("2000", 18));
        });
    });
});
