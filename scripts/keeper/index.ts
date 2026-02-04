/**
 * NST Options Keeper Service - 主入口
 * 
 * 整合所有 Keeper 模块，定时执行链上自动化任务：
 * - RFQ 超时自动取消 (2h)
 * - 追保超时强平
 * - 仲裁窗口自动结算
 * - 初始喂价超时取消 (P0) - NEW
 * - 平仓喂价超时惩罚 (P1)
 * - 连板/涨幅强平监控 (P2)
 * 
 * 运行方式:
 *   npx ts-node scripts/keeper/index.ts
 * 
 * 生产环境建议使用 pm2:
 *   pm2 start "npx ts-node scripts/keeper/index.ts" --name nst-keeper
 */

import { runRfqKeeper } from './rfqKeeper';
import { runMarginKeeper } from './marginKeeper';
import { runSettleKeeper } from './settleKeeper';
import { runInitialFeedKeeper } from './initialFeedKeeper';
import { runExerciseFeedKeeper } from './exerciseFeedKeeper';
import { runLimitUpKeeper } from './limitUpKeeper';
import { runFeedResultProcessor } from './feedResultProcessor';
import { log } from './utils';

const SCAN_INTERVAL_MS = 60 * 1000; // 每 60 秒扫描一次

async function runAllKeepers(): Promise<void> {
    log('MAIN', '========== Starting Keeper Scan Cycle ==========');

    try {
        await Promise.all([
            runRfqKeeper(),
            runMarginKeeper(),
            runSettleKeeper(),
            runInitialFeedKeeper(),  // P0: 成交后10分钟初始喂价超时
            runExerciseFeedKeeper(),
            runLimitUpKeeper(),
        ]);
    } catch (error) {
        log('MAIN', 'Keeper cycle error', { error: (error as Error).message });
    }

    log('MAIN', '========== Keeper Scan Cycle Complete ==========\n');
}

// 启动事件监听器（非轮询，实时监听）
async function startEventListeners(): Promise<void> {
    log('MAIN', 'Starting event listeners...');
    runFeedResultProcessor().catch((err) => {
        log('MAIN', 'FeedResultProcessor error', { error: err.message });
    });
}

async function main(): Promise<void> {
    log('MAIN', 'NST Options Keeper Service Starting...');
    log('MAIN', `Scan interval: ${SCAN_INTERVAL_MS / 1000} seconds`);

    // 启动实时事件监听器（喂价结果处理）
    startEventListeners();

    // 首次立即执行轮询任务
    await runAllKeepers();

    // 定时循环执行
    setInterval(runAllKeepers, SCAN_INTERVAL_MS);
}

// 优雅退出处理
process.on('SIGINT', () => {
    log('MAIN', 'Received SIGINT. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('MAIN', 'Received SIGTERM. Shutting down gracefully...');
    process.exit(0);
});

main().catch((err) => {
    log('MAIN', 'Fatal error', { error: err.message });
    process.exit(1);
});
