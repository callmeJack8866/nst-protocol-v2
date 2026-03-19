/**
 * FinalFeedTimeBasis — 终轮喂价时间基准测试
 *
 * 验证：
 *  1. earlyExercise 后 order.finalFeedRequestedAt = block.timestamp
 *  2. onFeedRequested(Final) 后 order.finalFeedRequestedAt = block.timestamp
 *  3. updateOrderFinalFeedRequestedAt 权限检查（非 SETTLEMENT_ROLE revert）
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const UNITS = (n: number | string) => ethers.parseUnits(String(n), 18);

describe("FinalFeedTimeBasis — 终轮喂价时间基准", function () {

    async function deployFixture() {
        const [admin, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5] =
            await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        const MINT = UNITS(500_000);
        for (const s of [admin, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5]) {
            await usdt.mint(s.address, MINT);
        }

        const Config = await ethers.getContractFactory("Config");
        const config = await Config.deploy(admin.address);
        await config.waitForDeployment();

        const VaultManager = await ethers.getContractFactory("VaultManager");
        const vaultManager = await VaultManager.deploy(await config.getAddress(), admin.address);
        await vaultManager.waitForDeployment();

        const OptionsCore = await ethers.getContractFactory("OptionsCore");
        const optionsCore = await OptionsCore.deploy(
            await config.getAddress(), await vaultManager.getAddress(),
            await usdt.getAddress(), admin.address
        );
        await optionsCore.waitForDeployment();

        const OptionsSettlement = await ethers.getContractFactory("OptionsSettlement");
        const optionsSettlement = await OptionsSettlement.deploy(
            await optionsCore.getAddress(), await config.getAddress(),
            await vaultManager.getAddress(), await usdt.getAddress(), admin.address
        );
        await optionsSettlement.waitForDeployment();

        const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
        const feedProtocol = await FeedProtocol.deploy(
            await config.getAddress(), await usdt.getAddress(), admin.address
        );
        await feedProtocol.waitForDeployment();

        // 角色配置
        const VAULT_OP = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
        const SETTLEMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));

        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsCore.getAddress());
        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsSettlement.getAddress());
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL_ROLE, await feedProtocol.getAddress());
        await optionsCore.connect(admin).grantRole(SETTLEMENT_ROLE, await optionsSettlement.getAddress());
        // admin 也授 SETTLEMENT_ROLE + FEED_PROTOCOL_ROLE 方便测试
        await optionsCore.connect(admin).grantRole(SETTLEMENT_ROLE, admin.address);
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL_ROLE, admin.address);
        await feedProtocol.connect(admin).setOptionsCore(await optionsCore.getAddress());

        // Approvals
        const ocAddr = await optionsCore.getAddress();
        const vmAddr = await vaultManager.getAddress();
        const osAddr = await optionsSettlement.getAddress();
        for (const s of [buyer, seller]) {
            await usdt.connect(s).approve(ocAddr, MINT);
            await usdt.connect(s).approve(vmAddr, MINT);
            await usdt.connect(s).approve(osAddr, MINT);
        }

        return {
            usdt, config, vaultManager, optionsCore, optionsSettlement, feedProtocol,
            admin, buyer, seller, feeder1,
        };
    }

    /** 创建已匹配订单（exerciseDelay=0 方便测试提前行权不需等待） */
    async function createMatchedOrder(oc: any, buyer: any, seller: any) {
        const exp = (await time.latest()) + 86400 * 30;
        await oc.connect(buyer).createBuyerRFQ(
            "Gold", "XAU", "SH", "CN", "600.00",
            0, UNITS(10000), exp,
            1000, 1000,
            0, ethers.ZeroAddress,
            86400, 7200,
            false, 0, 0, 0, // exerciseDelay=0 (通过 consecutiveDays=0)
            0
        );
        const orderId = Number(await oc.nextOrderId()) - 1;
        await oc.connect(seller).submitQuote(orderId, 500, 1200, 0, 0, 0);
        const quoteId = Number(await oc.nextQuoteId()) - 1;
        await oc.connect(buyer).acceptQuote(quoteId);
        return orderId;
    }

    /** admin 直接调 processFeedCallback(Initial) 进入 LIVE */
    async function makeOrderLive(oc: any, admin: any, orderId: number) {
        await oc.connect(admin).processFeedCallback(orderId, 0, UNITS(600));
    }

    // ==================== 测试 ====================

    describe("earlyExercise 写入 finalFeedRequestedAt", function () {
        it("earlyExercise 后 finalFeedRequestedAt 等于 block.timestamp", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);
            await makeOrderLive(optionsCore, admin, orderId);

            // 确认初始状态 finalFeedRequestedAt = 0
            let order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE
            expect(order.finalFeedRequestedAt).to.equal(0);

            // 买方提前行权
            await optionsSettlement.connect(buyer).earlyExercise(orderId);

            // 验证
            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(5); // WAITING_FINAL_FEED
            expect(order.finalFeedRequestedAt).to.be.gt(0);

            // finalFeedRequestedAt 应接近当前 block.timestamp
            const latestTime = await time.latest();
            expect(order.finalFeedRequestedAt).to.equal(latestTime);
        });
    });

    describe("onFeedRequested(Final) 写入 finalFeedRequestedAt", function () {
        it("FeedProtocol 路径请求终轮喂价后 finalFeedRequestedAt 被写入", async function () {
            const { optionsCore, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);
            await makeOrderLive(optionsCore, admin, orderId);

            // 确认初始
            let order = await optionsCore.getOrder(orderId);
            expect(order.finalFeedRequestedAt).to.equal(0);

            // admin 具备 FEED_PROTOCOL_ROLE，模拟 FeedProtocol 调用 onFeedRequested
            await optionsCore.connect(admin).onFeedRequested(orderId, 2); // FeedType.Final=2

            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(5); // WAITING_FINAL_FEED
            expect(order.finalFeedRequestedAt).to.be.gt(0);

            const latestTime = await time.latest();
            expect(order.finalFeedRequestedAt).to.equal(latestTime);
        });
    });

    describe("权限控制", function () {
        it("非 SETTLEMENT_ROLE 不能调用 updateOrderFinalFeedRequestedAt", async function () {
            const { optionsCore, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);

            // buyer 无 SETTLEMENT_ROLE → 应 revert
            await expect(
                optionsCore.connect(buyer).updateOrderFinalFeedRequestedAt(orderId, 12345)
            ).to.be.reverted;
        });
    });

    describe("字段不被其他操作意外覆盖", function () {
        it("processFeedCallback(Final) 不会覆盖已写入的 finalFeedRequestedAt", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller);
            await makeOrderLive(optionsCore, admin, orderId);

            // earlyExercise 写入 finalFeedRequestedAt
            await optionsSettlement.connect(buyer).earlyExercise(orderId);
            let order = await optionsCore.getOrder(orderId);
            const originalRequestedAt = order.finalFeedRequestedAt;
            expect(originalRequestedAt).to.be.gt(0);

            // 推进 5 秒后 processFeedCallback(Final) → PENDING_SETTLEMENT
            await time.increase(5);
            await optionsCore.connect(admin).processFeedCallback(orderId, 2, UNITS(650)); // FeedType.Final=2

            // finalFeedRequestedAt 应保持不变（喂价完成不覆盖请求发起时间）
            order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(6); // PENDING_SETTLEMENT
            expect(order.finalFeedRequestedAt).to.equal(originalRequestedAt);
        });
    });
});
