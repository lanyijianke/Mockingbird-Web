export const runtime = 'nodejs';

/**
 * Next.js Instrumentation Hook
 * 服务端进程启动时自动执行，用于初始化定时任务调度器
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // 仅在 Node.js 运行时（非 Edge）启动调度器
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startScheduler } = await import('@/lib/jobs/scheduler');
        startScheduler();
    }
}
