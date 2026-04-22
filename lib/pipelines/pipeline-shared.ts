import fs from 'fs/promises';
import path from 'path';

// ════════════════════════════════════════════════════════════════
// 管线共享工具
// 仅保留仍被提示词/媒体管线使用的基础能力
// ════════════════════════════════════════════════════════════════

/**
 * 解析路径：相对路径基于 cwd 解析
 */
export function resolvePath(configPath: string | undefined, defaultPath: string): string {
    const raw = configPath || defaultPath;
    if (path.isAbsolute(raw)) return raw;
    return path.resolve(process.cwd(), raw);
}

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 删除文件（带错误容忍）
 */
export async function safeDelete(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch {
        // 文件可能已不存在
    }
}

export interface PipelineReport {
    totalParsed: number;
    newlyAdded: number;
    updated: number;
    skipped: number;
}

export function createEmptyReport(): PipelineReport {
    return { totalParsed: 0, newlyAdded: 0, updated: 0, skipped: 0 };
}
