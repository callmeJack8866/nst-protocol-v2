/**
 * VolumeBasedFeed Unit Tests
 *
 * 覆盖：submitSuggestedPrice 四类失败场景安全校验
 *   1. 买方冒充卖方提交 → revert
 *   2. 不存在的订单 → revert
 *   3. 错误状态提交（feedType 与当前状态不匹配）→ revert
 *   4. 重复请求（同 orderId + feedType 已有 Pending）→ revert
 *
 * 以及正常流程：approve / modifyPrice / rejectPrice 基础覆盖
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("VolumeBasedFeed", function () {

    // ==================== Fixture ====================
    async function deployVBFFixture() {
        const [admin, buyer, seller, stranger, feeder] = await ethers.getSigners();

        // Mock USDT (18 decimals)
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("USDT", "USDT", 18);
        await usdt.waitForDeployment();

        const AMOUNT = ethers.parseUnits("100000", 18);
        for (const s of [admin, buyer, seller, stranger, feeder]) {
            await usdt.mint(s.address, AMOUNT);
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

        // VolumeBasedFeed
        const VBF = await ethers.getContractFactory("VolumeBasedFeed");
        const vbf = await VBF.deploy(
            await config.getAddress(),
            await usdt.getAddress(),
            admin.address
        );
        await vbf.waitForDeployment();

        // 角色配置
        const VAULT_OP = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
        const FEED_PROTOCOL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE"));
        const FEEDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE"));

        await vaultManager.connect(admin).grantRole(VAULT_OP, await optionsCore.getAddress());
        await optionsCore.connect(admin).grantRole(FEED_PROTOCOL_ROLE, await vbf.getAddress());
        await vbf.connect(admin).grantRole(FEEDER_ROLE, feeder.address);
        await vbf.connect(admin).setOptionsCore(await optionsCore.getAddress());

        // Approvals（VaultManager 需要的 approve，用于划转保证金/权利金）
        const ocAddr = await optionsCore.getAddress();
        const vmAddr = await vaultManager.getAddress();
        await usdt.connect(buyer).approve(ocAddr, AMOUNT);
        await usdt.connect(buyer).approve(vmAddr, AMOUNT);
        await usdt.connect(seller).approve(ocAddr, AMOUNT);
        await usdt.connect(seller).approve(vmAddr, AMOUNT);

        return {
            vbf, optionsCore, vaultManager, config, usdt,
            admin, buyer, seller, stranger, feeder,
        };
    }

    // ==================== 帮助函数 ====================

    /** 创建 VolumeBasedFeed（feedRule=1）的卖方订单并返回 orderId */
    async function createSellerVBFOrder(oc: any, seller: any) {
        const exp = (await time.latest()) + 86400 * 30;
        await oc.connect(seller).createSellerOrder(
            "Gold", "XAU", "SH", "CN", "600",
            0,                                    // direction=Call
            ethers.parseUnits("1000", 18),        // notionalUSDT
            exp,                                  // expiryTimestamp
            500,                                  // premiumRate 5%
            2000,                                 // marginRate 20%
            0,                                    // liquidationRule=NoLiquidation
            3,                                    // consecutiveDays
            10,                                   // dailyLimitPercent
            86400,                                // arbitrationWindow
            false,                                // dividendAdjustment
            1,                                    // exerciseDelay T+1
            1                                     // feedRule=VolumeBasedFeed
        );
        return Number(await oc.nextOrderId()) - 1;
    }

    /** 创建卖方 VBF 订单并让买方买入（返回 MATCHED 状态的 orderId） */
    async function createMatchedVBFOrder(oc: any, buyer: any, seller: any) {
        const orderId = await createSellerVBFOrder(oc, seller);
        // 买方接受（SellerOrder 无需报价，直接 acceptQuote → 不适用；需走 RFQ 流程）
        // 实际上 SellerOrder 是 "广播订单"，买方通过 submitQuote 报价后卖方 acceptQuote
        // 为简化：buyer 提交报价，seller 用 acceptQuote 买方报价 — 或直接用 createBuyerRFQ + 卖方报价
        // 简单起见改用 BuyerRFQ + submitQuote 走 VolumeBasedFeed feedRule
        return orderId;
    }

    /** 创建 BuyerRFQ(feedRule=VolumeBasedFeed=1) + 卖方报价 + 成交，返回 MATCHED orderId */
    async function createMatchedVBFOrderViaRFQ(oc: any, buyer: any, seller: any) {
        const exp = (await time.latest()) + 86400 * 30;
        await oc.connect(buyer).createBuyerRFQ(
            "Gold", "XAU", "SH", "CN", "600.00", 0,
            ethers.parseUnits("1000", 18), exp,
            800, 1000, 0, ethers.ZeroAddress,
            86400, 7200, false, 0, 0, 0,
            1 // feedRule=VolumeBasedFeed
        );
        const orderId = Number(await oc.nextOrderId()) - 1;
        await oc.connect(seller).submitQuote(orderId, 700, 1500, 0, 3, 10);
        const quoteId = Number(await oc.nextQuoteId()) - 1;
        await oc.connect(buyer).acceptQuote(quoteId);
        return orderId;
    }

    // ======================================================================
    // 1. 买方冒充卖方提交 → revert
    // ======================================================================
    describe("安全校验 — 买方冒充卖方", function () {
        it("买方调用 submitSuggestedPrice → revert: caller is not order seller", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            // 买方冒充卖方提交建议价格
            await expect(
                vbf.connect(buyer).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("605", 18),
                    "买方伪造的建议价格",
                    0, // FeedType.Initial
                    true
                )
            ).to.be.revertedWith("VolumeBasedFeed: caller is not order seller");
        });

        it("第三方（stranger）调用 submitSuggestedPrice → revert: caller is not order seller", async function () {
            const { vbf, optionsCore, buyer, seller, stranger } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            await expect(
                vbf.connect(stranger).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("605", 18),
                    "陌生人伪造的建议价格",
                    0,
                    true
                )
            ).to.be.revertedWith("VolumeBasedFeed: caller is not order seller");
        });
    });

    // ======================================================================
    // 2. 不存在的订单 → revert
    // ======================================================================
    describe("安全校验 — 不存在的订单", function () {
        it("orderId=0 → revert: order does not exist", async function () {
            const { vbf, seller } = await loadFixture(deployVBFFixture);

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    0, // orderId=0 是无效的（OptionsCore 从 1 开始）
                    ethers.parseUnits("600", 18),
                    "虚假订单",
                    0,
                    true
                )
            ).to.be.revertedWith("VolumeBasedFeed: order does not exist");
        });

        it("orderId=99999（从未创建）→ revert: order does not exist", async function () {
            const { vbf, seller } = await loadFixture(deployVBFFixture);

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    99999,
                    ethers.parseUnits("600", 18),
                    "不存在订单的建议价格",
                    0,
                    true
                )
            ).to.be.revertedWith("VolumeBasedFeed: order does not exist");
        });

        it("NormalFeed 订单（feedRule=0）→ revert: order feedRule is not VolumeBasedFeed", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);

            // 创建 feedRule=NormalFeed(0) 订单
            const exp = (await time.latest()) + 86400 * 30;
            await optionsCore.connect(buyer).createBuyerRFQ(
                "Gold", "XAU", "SH", "CN", "600.00", 0,
                ethers.parseUnits("1000", 18), exp,
                800, 1000, 0, ethers.ZeroAddress,
                86400, 7200, false, 0, 0, 0,
                0 // feedRule=NormalFeed
            );
            const orderId = Number(await optionsCore.nextOrderId()) - 1;
            await optionsCore.connect(seller).submitQuote(orderId, 700, 1500, 0, 3, 10);
            const quoteId = Number(await optionsCore.nextQuoteId()) - 1;
            await optionsCore.connect(buyer).acceptQuote(quoteId);

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("600", 18),
                    "正常订单走 VBF 路径",
                    0,
                    true
                )
            ).to.be.revertedWith("VolumeBasedFeed: order feedRule is not VolumeBasedFeed");
        });
    });

    // ======================================================================
    // 3. 错误状态提交（feedType 与当前状态不匹配）→ revert
    // ======================================================================
    describe("安全校验 — 错误状态提交", function () {
        it("订单处于 MATCHED 状态，提交 FeedType.Final → revert: order not in correct status for final feed", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);
            // 此时状态应为 MATCHED (2)
            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(2); // MATCHED

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("605", 18),
                    "错误状态提交终轮喂价",
                    2, // FeedType.Final
                    false
                )
            ).to.be.revertedWith("VolumeBasedFeed: order not in correct status for final feed");
        });

        it("订单处于 MATCHED 状态，提交 FeedType.Dynamic → revert: order must be LIVE for dynamic feed", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("605", 18),
                    "错误状态提交动态喂价",
                    1, // FeedType.Dynamic
                    false
                )
            ).to.be.revertedWith("VolumeBasedFeed: order must be LIVE for dynamic feed");
        });

        it("订单处于 MATCHED(非 LIVE/WAITING_FINAL_FEED)，提交 FeedType.Initial 成功（合法场景）", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            // MATCHED → 可以提交 Initial feed
            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("600", 18),
                    "上海黄金交易所实时成交价",
                    0, // FeedType.Initial
                    true
                )
            ).to.emit(vbf, "SuggestedPriceSubmitted");
        });
    });

    // ======================================================================
    // 4. 重复请求（同 orderId + feedType 已有 Pending）→ revert
    // ======================================================================
    describe("安全校验 — 重复请求防护", function () {
        it("同一订单同一 feedType 第二次提交 → revert: pending request already exists", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            // 第一次提交成功
            await vbf.connect(seller).submitSuggestedPrice(
                orderId,
                ethers.parseUnits("600", 18),
                "第一次建议价格",
                0, // FeedType.Initial
                true
            );

            // 第二次提交同一 feedType → revert
            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId,
                    ethers.parseUnits("601", 18),
                    "第二次重复提交",
                    0, // FeedType.Initial（同类型）
                    true
                )
            ).to.be.revertedWith("VolumeBasedFeed: pending request already exists for this order and feedType");
        });

        it("不同 feedType 可以各自提交（Initial + Dynamic 不互斥）", async function () {
            const { vbf, optionsCore, buyer, seller, admin, feeder } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            // 提交 Initial
            const tx1 = await vbf.connect(seller).submitSuggestedPrice(
                orderId, ethers.parseUnits("600", 18), "Initial 建议价格", 0, true
            );
            const req1 = await tx1.wait();
            const reqId1 = Number(await vbf.nextRequestId()) - 1;

            // Feeder approve → Initial finalized → 订单变 LIVE
            await vbf.connect(feeder).approvePrice(reqId1);

            // 此时订单状态应为 LIVE（通过回调）
            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE

            // 提交 Dynamic（不同 feedType，且订单已 LIVE）
            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId, ethers.parseUnits("602", 18), "Dynamic 调整价格", 1, false
                )
            ).to.emit(vbf, "SuggestedPriceSubmitted");
        });

        it("Pending 请求被拒绝后，可以重新提交同一 feedType", async function () {
            const { vbf, optionsCore, buyer, seller, feeder } = await loadFixture(deployVBFFixture);

            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            // 第一次提交
            await vbf.connect(seller).submitSuggestedPrice(
                orderId, ethers.parseUnits("600", 18), "第一次建议价格", 0, true
            );
            const reqId1 = Number(await vbf.nextRequestId()) - 1;

            // 喂价员拒绝（Pending → Rejected）
            await vbf.connect(feeder).rejectPrice(reqId1, 4, "价格不合理"); // RejectReason.PRICE_UNREASONABLE=4

            // 现在没有 Pending 请求了，可以重新提交
            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId, ethers.parseUnits("595", 18), "修正后的建议价格", 0, true
                )
            ).to.emit(vbf, "SuggestedPriceSubmitted");
        });
    });

    // ======================================================================
    // 5. approvePrice / modifyPrice / rejectPrice 基础覆盖
    // ======================================================================
    describe("喂价员操作 — approve / modify / reject", function () {
        async function submitAndGetReqId(vbf: any, optionsCore: any, buyer: any, seller: any) {
            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);
            await vbf.connect(seller).submitSuggestedPrice(
                orderId, ethers.parseUnits("600", 18), "上海黄金交易所成交价", 0, true
            );
            const reqId = Number(await vbf.nextRequestId()) - 1;
            return { orderId, reqId };
        }

        it("approvePrice → emit PriceApproved + 订单状态变 LIVE", async function () {
            const { vbf, optionsCore, buyer, seller, feeder } = await loadFixture(deployVBFFixture);
            const { orderId, reqId } = await submitAndGetReqId(vbf, optionsCore, buyer, seller);

            await expect(vbf.connect(feeder).approvePrice(reqId))
                .to.emit(vbf, "PriceApproved");

            // 回调成功：订单应变为 LIVE
            const order = await optionsCore.getOrder(orderId);
            expect(order.status).to.equal(4); // LIVE

            // 请求状态应为 Finalized
            const req = await vbf.getRequest(reqId);
            expect(req.status).to.equal(5); // Finalized
        });

        it("modifyPrice → emit PriceModified + finalPrice 为修正价格", async function () {
            const { vbf, optionsCore, buyer, seller, feeder } = await loadFixture(deployVBFFixture);
            const { orderId, reqId } = await submitAndGetReqId(vbf, optionsCore, buyer, seller);

            const modifiedPrice = ethers.parseUnits("598", 18);
            await expect(vbf.connect(feeder).modifyPrice(reqId, modifiedPrice, "市场实际成交价偏低"))
                .to.emit(vbf, "PriceModified");

            const req = await vbf.getRequest(reqId);
            expect(req.finalPrice).to.equal(modifiedPrice);
            expect(req.status).to.equal(5); // Finalized
        });

        it("rejectPrice → emit PriceRejected，请求变为 Rejected", async function () {
            const { vbf, optionsCore, buyer, seller, feeder } = await loadFixture(deployVBFFixture);
            const { reqId } = await submitAndGetReqId(vbf, optionsCore, buyer, seller);

            await expect(vbf.connect(feeder).rejectPrice(reqId, 1, "无成交量"))
                .to.emit(vbf, "PriceRejected");

            const req = await vbf.getRequest(reqId);
            expect(req.status).to.equal(2); // Rejected
        });

        it("非 FEEDER_ROLE 调用 approvePrice → revert", async function () {
            const { vbf, optionsCore, buyer, seller, stranger } = await loadFixture(deployVBFFixture);
            const { reqId } = await submitAndGetReqId(vbf, optionsCore, buyer, seller);

            await expect(
                vbf.connect(stranger).approvePrice(reqId)
            ).to.be.revertedWith("VolumeBasedFeed: not authorized feeder");
        });

        it("Pending 请求过期后无法 approve → revert: request expired", async function () {
            const { vbf, optionsCore, buyer, seller, feeder } = await loadFixture(deployVBFFixture);
            const { reqId } = await submitAndGetReqId(vbf, optionsCore, buyer, seller);

            // 推进时间超过 verificationTimeout (30 minutes)
            await time.increase(31 * 60);

            await expect(
                vbf.connect(feeder).approvePrice(reqId)
            ).to.be.revertedWith("VolumeBasedFeed: request expired");
        });

        it("price=0 时 revert: price must be positive", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);
            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId, 0, "零价建议", 0, true
                )
            ).to.be.revertedWith("VolumeBasedFeed: price must be positive");
        });

        it("priceEvidence 为空时 revert: evidence required", async function () {
            const { vbf, optionsCore, buyer, seller } = await loadFixture(deployVBFFixture);
            const orderId = await createMatchedVBFOrderViaRFQ(optionsCore, buyer, seller);

            await expect(
                vbf.connect(seller).submitSuggestedPrice(
                    orderId, ethers.parseUnits("600", 18), "", 0, true
                )
            ).to.be.revertedWith("VolumeBasedFeed: evidence required");
        });
    });
});
