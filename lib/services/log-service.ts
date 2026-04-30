import { execute, query, queryScalar } from '@/lib/db';

// ════════════════════════════════════════════════════════════════
// 持久化日志服务 — 写入 SQLite SystemLogs 表
// 供 logger.ts 自动调用（warn/error 级别）及各模块显式调用
// ════════════════════════════════════════════════════════════════

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SystemLog {
    Id: number;
    Level: string;
    Source: string;
    Message: string;
    Detail: string | null;
    CreatedAt: string;
}

export interface LogQueryOptions {
    level?: LogLevel;
    source?: string;
    since?: string;
    page?: number;
    pageSize?: number;
}

/**
 * 写入一条日志到 SystemLogs 表
 */
export async function writeLog(
    level: LogLevel,
    source: string,
    message: string,
    detail?: string | null
): Promise<void> {
    try {
        await execute(
            `INSERT INTO SystemLogs (Level, Source, Message, Detail, CreatedAt)
             VALUES (?, ?, ?, ?, NOW())`,
            [level, source, message, detail ?? null]
        );
    } catch {
        // 日志写入自身不应抛出异常导致业务中断
        console.error('[LogService] 日志写入失败');
    }
}

/**
 * 将 Error 对象序列化为可存储的 detail 字符串
 */
export function serializeError(err: unknown): string {
    if (err instanceof Error) {
        return err.stack || err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

/**
 * 分页查询日志
 */
export async function queryLogs(options: LogQueryOptions = {}): Promise<{
    items: SystemLog[];
    totalCount: number;
}> {
    const { level, source, since, page = 1, pageSize = 50 } = options;
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (level) {
        conditions.push('Level = ?');
        params.push(level);
    }

    if (source) {
        conditions.push('Source = ?');
        params.push(source);
    }

    if (since) {
        conditions.push('CreatedAt >= ?');
        params.push(since);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;

    const totalCount = await queryScalar<number>(
        `SELECT COUNT(*) FROM SystemLogs WHERE ${whereClause}`,
        params
    ) ?? 0;

    const items = await query<SystemLog>(
        `SELECT * FROM SystemLogs WHERE ${whereClause} ORDER BY CreatedAt DESC LIMIT ?, ?`,
        [...params, offset, pageSize]
    );

    return { items, totalCount };
}

/**
 * 清理过期日志（保留最近 N 天）
 */
export async function purgeOldLogs(retainDays: number = 7): Promise<number> {
    const result = await execute(
        `DELETE FROM SystemLogs WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [retainDays]
    );
    return result.affectedRows;
}
