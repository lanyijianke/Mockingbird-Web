import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

// ════════════════════════════════════════════════════════════════
// 生成邀请码 — CLI 工具
// 用法: npx tsx scripts/gen-invite.ts [--count N] [--expires 7d]
// ════════════════════════════════════════════════════════════════

// 解析过期时间字符串（如 "7d", "30d", "24h"）
function parseExpires(value: string): number {
    const match = value.match(/^(\d+)(d|h)$/);
    if (!match) {
        throw new Error(`无效的过期时间格式: ${value}，请使用如 7d 或 24h`);
    }
    const num = parseInt(match[1], 10);
    const unit = match[2];
    return unit === 'd' ? num * 86400_000 : num * 3600_000;
}

// 从 .env.local 读取环境变量
function loadEnvLocal(): void {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('错误: 找不到 .env.local 文件');
        process.exit(1);
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function main(): Promise<void> {
    loadEnvLocal();

    // 解析命令行参数
    const args = process.argv.slice(2);
    let count = 1;
    let expiresStr = '7d';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--count' && args[i + 1]) {
            count = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--expires' && args[i + 1]) {
            expiresStr = args[i + 1];
            i++;
        }
    }

    if (count < 1 || count > 100) {
        console.error('错误: --count 应在 1-100 之间');
        process.exit(1);
    }

    const expiresMs = parseExpires(expiresStr);

    const url = process.env.MYSQL_URL;
    if (!url) {
        console.error('错误: MYSQL_URL 环境变量未设置');
        process.exit(1);
    }

    const conn = await mysql.createConnection(url);

    try {
        const expiresAt = new Date(Date.now() + expiresMs)
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d{3}Z$/, '');

        const codes: string[] = [];

        await conn.beginTransaction();

        try {
            for (let i = 0; i < count; i++) {
                const code = crypto.randomBytes(4).toString('hex').toUpperCase();
                await conn.query(
                    `INSERT INTO InvitationCodes (Code, MaxUses, UsedCount, ExpiresAt) VALUES (?, 1, 0, ?)`,
                    [code, expiresAt],
                );
                codes.push(code);
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        }

        console.log(`\n已生成 ${count} 个邀请码（有效期 ${expiresStr}）：\n`);
        for (const code of codes) {
            console.log(`  ${code}`);
        }
        console.log(`\n过期时间: ${expiresAt}`);
        console.log(`每人限用: 1 次\n`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('生成邀请码失败:', err);
    process.exit(1);
});
