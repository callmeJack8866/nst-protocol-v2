/**
 * MarginRiskChain Regression Tests
 *
 * 覆盖风控链三条路径：
 *  A. 动态喂价后触发追保（Dynamic feed → DynamicFeedMarginAlert → triggerMarginCall）
 *  B. 补保证金后恢复（addMargin → marginCallDeadline 清零）
 *  C. 超时强平（forceLiquidateMarginCall → LIQUIDATED + margin归买方）
 *
 * 公式验证：minRequired = notionalUSDT * minMarginRate / 10000
 * （不是旧错误公式 initialMargin * minMarginRate / 10000）
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// ==================== 常量 ====================
const UNITS = (n: number | string) => ethers.parseUnits(String(n), 18);

describe("MarginRiskChain — 动态喂价→追保→强平", function () {

    // ==================== Fixture ====================
    async function deployFixture() {
        const [admin, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5] =
            await ethers.getSigners();

        // USDT (18 decimals)
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        const MINT = UNITS(500_000);
        for (const s of [admin, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5]) {
            await usdt.mint(s.address, MINT);
        }

        // Config
        const Config = await ethers.getContractFactory("Config");
        const config = await Config.deploy(admin.address);
        await config.waitForDeployment();

        // VaultManager
        const VaultManager = await ethers.getContractFactory("VaultManager");
        const vaultManager = await VaultManager.deploy(await config.getAddress(), admin.address);
        await vaultManager.waitForDeployment();

        // OptionsCore
        const OptionsCore = await ethers.getContractFactory("OptionsCore");
        const optionsCore = await OptionsCore.deploy(
            await config.getAddress(),
            await vaultManager.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await optionsCore.waitForDeployment();

        // OptionsSettlement
        const OptionsSettlement = await ethers.getContractFactory("OptionsSettlement");
        const optionsSettlement = await OptionsSettlement.deploy(
            await optionsCore.getAddress(),
            await config.getAddress(),
            await vaultManager.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await optionsSettlement.waitForDeployment();

        // FeedProtocol（仅用于 Approvals，测试中不走正式路径）
        const FeedProtocol = await ethers.getContractFactory("FeedProtocol");
        const feedProtocol = await FeedProtocol.deploy(
            await config.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await feedProtocol.waitForDeployment();

        // ==================== 角色配置 ====================
        const VAULT_OP          = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
        const SETTLEMENT_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("SETTLEMENT_ROLE"));
        const FEEDER_ROLE       = ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE"));

        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsCore.getAddress());
        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsSettlement.getAddress());
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL_ROLE, await feedProtocol.getAddress());
        await optionsCore.connect(admin).grantRole(SETTLEMENT_ROLE, await optionsSettlement.getAddress());

        // admin 也授 SETTLEMENT_ROLE + FEED_PROTOCOL_ROLE，方便测试直接操作链上状态
        await optionsCore.connect(admin).grantRole(SETTLEMENT_ROLE, admin.address);
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL_ROLE, admin.address);

        await feedProtocol.connect(admin).setOptionsCore(await optionsCore.getAddress());
        for (const f of [feeder1, feeder2, feeder3, feeder4, feeder5]) {
            await feedProtocol.connect(admin).grantRole(FEEDER_ROLE, f.address);
        }

        // ==================== Approvals ====================
        const fpAddr = await feedProtocol.getAddress();
        const vmAddr = await vaultManager.getAddress();
        const ocAddr = await optionsCore.getAddress();
        const osAddr = await optionsSettlement.getAddress();

        for (const s of [buyer, seller]) {
            await usdt.connect(s).approve(ocAddr, MINT);
            await usdt.connect(s).approve(vmAddr, MINT);
            await usdt.connect(s).approve(fpAddr, MINT);
            await usdt.connect(s).approve(osAddr, MINT);
        }

        return {
            usdt, config, vaultManager, optionsCore, optionsSettlement, feedProtocol,
            admin, buyer, seller, feeder1, feeder2, feeder3, feeder4, feeder5,
        };
    }

    // ==================== 通用 Helper ====================

    /**
     * 创建 BuyerRFQ + submitQuote + acceptQuote → MATCHED 状态
     * @param notional  名义本金（USDT）
     * @param marginRate 卖方报价保证金率（basis points, e.g. 1200 = 12%）
     * @param minMarginRate 买方设定的最低保证金率（basis points, e.g. 1000 = 10%）
     */
    async function createMatchedOrder(
        oc: any, buyer: any, seller: any,
        notional = 10_000, marginRate = 3000, minMarginRate = 1000
    ) {
        const exp = (await time.latest()) + 86400 * 30;
        await oc.connect(buyer).createBuyerRFQ(
            "Gold", "XAU", "SH", "CN", "600.00",
            0,                  // direction
            UNITS(notional),    // notionalUSDT
            exp,
            1000,               // maxPremiumRate
            minMarginRate,      // minMarginRate
            0, ethers.ZeroAddress, // sellerType, designatedSeller
            86400, 7200,        // arbitrationWindow, marginCallDeadline(配置窗口，不再写入order)
            false, 0, 3, 10,   // dividendAdjustment, liquidationRule, consecutiveDays, dailyLimitPercent
            0                   // feedRule = NormalFeed
        );
        const orderId = Number(await oc.nextOrderId()) - 1;
        await oc.connect(seller).submitQuote(orderId, 500, marginRate, 0, 3, 10);
        const quoteId = Number(await oc.nextQuoteId()) - 1;
        await oc.connect(buyer).acceptQuote(quoteId);
        return orderId;
    }

    /**
     * 让订单进入 LIVE 状态
     * admin 具备 FEED_PROTOCOL_ROLE，可直接调用 processFeedCallback(Initial)
     * 跳过 FeedProtocol 的喂价员注册/费用支付等前置条件
     */
    async function makeOrderLive(oc: any, admin: any, orderId: number, strikePrice = 600) {
        await oc.connect(admin).processFeedCallback(orderId, 0, UNITS(strikePrice)); // FeedType.Initial=0
    }

    // ==================== 公式验证 ====================
    describe("minRequired 公式 — notionalUSDT * minMarginRate / 10000", function () {
        it("triggerMarginCall 使用正确公式阻止充足保证金的订单", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            // notional=10000, marginRate=3000(30%) → initialMargin=3000
            // minMarginRate=1000(10%) → minRequired = 10000*10% = 1000 USDT
            // currentMargin=3000 > minRequired=1000 → 不应触发追保
            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 3000, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE
            expect(order.currentMargin).to.equal(UNITS(3000));

            // 尝试触发追保 → 应 revert（保证金充足）
            await expect(
                optionsSettlement.triggerMarginCall(orderId, false)
            ).to.be.revertedWith("Settlement: margin sufficient");
        });

        it("旧公式 initialMargin*minMarginRate 会产生错误结果（纯数学回归验证）", async function () {
            // notional=10000, marginRate=3000(30%) → initialMargin=3000
            // minMarginRate=500(5%) → minRequired 应为 notional*5%=500 USDT
            // 旧公式：initialMargin*minMarginRate/10000=3000*500/10000=150（错误，太宽松）
            // 新公式：notional*minMarginRate/10000=10000*500/10000=500（正确）
            const notional      = BigInt(10000) * BigInt(10 ** 18);
            const initialMargin = BigInt(3000)  * BigInt(10 ** 18);
            const minMarginRate = BigInt(500); // 5%

            const oldFormula = (initialMargin * minMarginRate) / 10000n;
            const newFormula = (notional      * minMarginRate) / 10000n;

            expect(oldFormula).to.equal(BigInt(150) * BigInt(10 ** 18)); // 150 USDT（错误）
            expect(newFormula).to.equal(BigInt(500) * BigInt(10 ** 18)); // 500 USDT（正确）
        });
    });

    // ==================== 链路A: 动态喂价后触发追保 ====================
    describe("链路A — 动态喂价后触发追保", function () {
        it("动态喂价后保证金不足 → emit DynamicFeedMarginAlert", async function () {
            const { optionsCore, admin, buyer, seller } = await loadFixture(deployFixture);

            // notional=10000, marginRate=1200(12%), minMarginRate=1000(10%)
            // minRequired = 10000 * 10% = 1000 USDT
            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            let order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE
            expect(order.currentMargin).to.equal(UNITS(1200));

            // 模拟浮亏：将保证金降至 900（低于 minRequired=1000）
            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));

            // 动态喂价 → 应 emit DynamicFeedMarginAlert
            await expect(
                optionsCore.connect(admin).processFeedCallback(orderId, 1, UNITS(610)) // FeedType.Dynamic=1
            ).to.emit(optionsCore, "DynamicFeedMarginAlert")
              .withArgs(orderId, seller.address, UNITS(900), UNITS(1000), UNITS(610));
        });

        it("动态喂价后可链上触发追保 → emit MarginCallTriggered", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            // 降低保证金
            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));

            // 动态喂价（触发 DynamicFeedMarginAlert）
            await optionsCore.connect(admin).processFeedCallback(orderId, 1, UNITS(610));

            // marginKeeper 监听到事件后，调用 triggerMarginCall
            await expect(
                optionsSettlement.triggerMarginCall(orderId, false)
            ).to.emit(optionsSettlement, "MarginCallTriggered");

            const orderAfter = await optionsCore.getOrder(orderId);
            expect(orderAfter.marginCallDeadline).to.be.gt(0);
            expect(orderAfter.status).to.equal(4); // 仍为 LIVE
        });

        it("保证金充足时动态喂价 → 不 emit DynamicFeedMarginAlert", async function () {
            const { optionsCore, admin, buyer, seller } = await loadFixture(deployFixture);

            // marginRate=3000(30%), minRequired=1000 → 1200 初始充足后 3000 更充足
            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 3000, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            // currentMargin=3000 远大于 minRequired=1000，不发 alert
            await expect(
                optionsCore.connect(admin).processFeedCallback(orderId, 1, UNITS(610))
            ).to.not.emit(optionsCore, "DynamicFeedMarginAlert");
        });
    });

    // ==================== 链路B: 补保证金后恢复 ====================
    describe("链路B — 补保证金后恢复", function () {
        it("追保触发后，卖方补足保证金 → marginCallDeadline 自动清零", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            // 降至 900（< minRequired=1000）并触发追保
            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));
            await optionsSettlement.triggerMarginCall(orderId, false);

            let order = await optionsCore.getOrder(orderId);
            expect(order.marginCallDeadline).to.be.gt(0);

            // 卖方补 200 → currentMargin=1100 > minRequired=1000 → deadline 清零
            await optionsSettlement.connect(seller).addMargin(orderId, UNITS(200));

            order = await optionsCore.getOrder(orderId);
            expect(order.marginCallDeadline).to.equal(0);
            expect(order.currentMargin).to.equal(UNITS(1100));
            expect(order.status).to.equal(4); // 仍为 LIVE
        });

        it("补保证金不足 → marginCallDeadline 仍有效", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));
            await optionsSettlement.triggerMarginCall(orderId, false);

            // 只补 50 USDT（总量 950 < minRequired=1000）→ 不够
            await optionsSettlement.connect(seller).addMargin(orderId, UNITS(50));

            const order = await optionsCore.getOrder(orderId);
            expect(order.marginCallDeadline).to.be.gt(0); // 仍有效
            expect(order.currentMargin).to.equal(UNITS(950));
        });
    });

    // ==================== 链路C: 超时强平 ====================
    describe("链路C — 超时强平", function () {
        it("追保超时 → forceLiquidateMarginCall → 订单 LIQUIDATED", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);

            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));
            await optionsSettlement.triggerMarginCall(orderId, false);

            const order = await optionsCore.getOrder(orderId);
            expect(order.marginCallDeadline).to.be.gt(0);

            // 推进时间超过追保截止
            await time.increaseTo(Number(order.marginCallDeadline) + 1);

            // 强平
            await expect(optionsSettlement.forceLiquidateMarginCall(orderId))
                .to.emit(optionsSettlement, "OrderLiquidated");

            const finalOrder = await optionsCore.getOrder(orderId);
            expect(finalOrder.status).to.equal(9); // LIQUIDATED
            expect(finalOrder.currentMargin).to.equal(0);
            expect(finalOrder.marginCallDeadline).to.equal(0);
        });

        it("deadline 未到 → forceLiquidateMarginCall revert", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);
            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));
            await optionsSettlement.triggerMarginCall(orderId, false);

            await expect(
                optionsSettlement.forceLiquidateMarginCall(orderId)
            ).to.be.revertedWith("Settlement: deadline not reached");
        });

        it("保证金被补足后 → forceLiquidateMarginCall revert: no margin call active", async function () {
            const { optionsCore, optionsSettlement, admin, buyer, seller } = await loadFixture(deployFixture);

            const orderId = await createMatchedOrder(optionsCore, buyer, seller, 10000, 1200, 1000);
            await makeOrderLive(optionsCore, admin, orderId, 600);
            await optionsCore.connect(admin).updateOrderMargin(orderId, UNITS(900));
            await optionsSettlement.triggerMarginCall(orderId, false);

            const order = await optionsCore.getOrder(orderId);
            await time.increaseTo(Number(order.marginCallDeadline) + 1);

            // 补足后 deadline=0
            await optionsSettlement.connect(seller).addMargin(orderId, UNITS(200));

            await expect(
                optionsSettlement.forceLiquidateMarginCall(orderId)
            ).to.be.revertedWith("Settlement: no margin call active");
        });
    });
});
