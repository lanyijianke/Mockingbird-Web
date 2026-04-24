import cron from 'node-cron';
import { rankingCachePolicies } from '@/lib/cache/policies';
import { syncAllAsync as promptSourceSync } from '@/lib/pipelines/prompt-readme-sync';
import { refreshAllRankings } from '@/lib/services/ranking-cache';
import { logger } from '@/lib/utils/logger';

// ════════════════════════════════════════════════════════════════
// 统一 node-cron 调度器 — 替代 Knowledge 的 Quartz Jobs
//
// 调度策略：
//   PromptSyncJob        → 每 60 秒   (README/source 提示词同步)
//   RankingSyncJob       → 每 2 小时  (直采 4 个排行榜并缓存)
//
// 通过 instrumentation.ts 在服务端进程启动时自动调用 startScheduler()。
// ════════════════════════════════════════════════════════════════

const JOB_INTERVALS = {
    promptSync: process.env.JOB_PROMPT_SYNC_CRON || '30 */1 * * * *',       // 每分钟第 30 秒
    rankingSync: process.env.JOB_RANKING_SYNC_CRON || '0 */2 * * *',        // 每 2 小时
};

let isRunning = false;
const tasks: ReturnType<typeof cron.schedule>[] = [];

// 防止重入的运行锁
const locks: Record<string, boolean> = {};

async function runWithLock(name: string, fn: () => Promise<void>): Promise<void> {
    if (locks[name]) {
        logger.debug('Scheduler', `${name} 尚在运行中，跳过`);
        return;
    }
    locks[name] = true;
    try {
        await fn();
    } catch (err) {
        logger.error('Scheduler', `${name} 执行异常`, err);
    } finally {
        locks[name] = false;
    }
}

export function startScheduler(): void {
    if (isRunning) {
        logger.info('Scheduler', '调度器已在运行');
        return;
    }

    logger.persist('Scheduler', '📅 Knowledge 定时任务调度器启动');
    logger.info('Scheduler', '══════════════════════════════════════');

    // ─── 提示词同步任务 ───
    const promptTask = cron.schedule(JOB_INTERVALS.promptSync, async () => {
        await runWithLock('PromptSync', async () => {
            logger.info('PromptSyncJob', '🔄 开始执行...');

            try {
                const sourceReport = await promptSourceSync();
                if (sourceReport.newlyAdded > 0 || sourceReport.updated > 0) {
                    logger.persist('PromptSyncJob', `Sources: 解析 ${sourceReport.totalParsed}, 新增 ${sourceReport.newlyAdded}, 更新 ${sourceReport.updated}, 跳过 ${sourceReport.skipped}`);
                }
            } catch (err) {
                logger.error('PromptSyncJob', 'Source 同步失败:', err);
            }
        });
    }, { scheduled: false } as Record<string, unknown>);

    // ─── 排行榜同步任务 ───
    const rankingTask = cron.schedule(JOB_INTERVALS.rankingSync, async () => {
        await runWithLock('RankingSync', async () => {
            logger.info('RankingSyncJob', '🔄 开始执行...');
            await refreshAllRankings();
            logger.info('RankingSyncJob', '✅ 执行完毕');
        });
    }, { scheduled: false } as Record<string, unknown>);

    // 启动定时任务
    promptTask.start();
    rankingTask.start();
    tasks.push(promptTask, rankingTask);
    isRunning = true;

    logger.info('Scheduler', `  📌 提示词同步:  ${JOB_INTERVALS.promptSync}`);
    logger.info('Scheduler', `  📌 排行榜同步:  ${JOB_INTERVALS.rankingSync}`);
    logger.info('Scheduler', '══════════════════════════════════════');

    if (rankingCachePolicies.some((policy) => policy.warmOnStartup)) {
        // 启动时立即预热排行榜缓存（延迟 5 秒避免阻塞启动）
        setTimeout(async () => {
            logger.info('Scheduler', '🚀 启动预热：刷新排行榜缓存...');
            await runWithLock('RankingSync', async () => {
                await refreshAllRankings();
            });
        }, 5000);
    }
}

export function stopScheduler(): void {
    tasks.forEach(t => t.stop());
    tasks.length = 0;
    isRunning = false;
    logger.info('Scheduler', '调度器已停止');
}

export function isSchedulerRunning(): boolean {
    return isRunning;
}

export interface SchedulerStatus {
    running: boolean;
    jobs: Array<{ name: string; interval: string; locked: boolean }>;
}

export function getSchedulerStatus(): SchedulerStatus {
    return {
        running: isRunning,
        jobs: [
            { name: '提示词同步', interval: JOB_INTERVALS.promptSync, locked: !!locks['PromptSync'] },
            { name: '排行榜同步', interval: JOB_INTERVALS.rankingSync, locked: !!locks['RankingSync'] },
        ],
    };
}
