import { nanoid } from 'nanoid';
import { execute, queryOne } from '@/lib/db';

// ════════════════════════════════════════════════════════════════
// Session 管理 — token 存 HttpOnly cookie，DB 存映射
// ════════════════════════════════════════════════════════════════

const SESSION_TTL_DAYS = 30;

export interface SessionRow {
    Id: number;
    Token: string;
    UserId: string;
    ExpiresAt: string;
    CreatedAt: string;
}

/**
 * 创建新会话：生成 nanoid token，写入 sessions 表，返回 token 字符串
 */
export async function CreateSession(userId: string): Promise<string> {
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, '');

    await execute(
        `INSERT INTO Sessions (Token, UserId, ExpiresAt) VALUES (?, ?, ?)`,
        [token, userId, expiresAt],
    );

    return token;
}

/**
 * 根据 token 查找有效会话，返回会话行或 null
 */
export async function GetSession(token: string): Promise<SessionRow | null> {
    if (!token) return null;

    const session = await queryOne<SessionRow>(
        `SELECT Id, Token, UserId, ExpiresAt, CreatedAt
         FROM Sessions
         WHERE Token = ? AND ExpiresAt > NOW()`,
        [token],
    );

    return session;
}

/**
 * 删除指定 token 的会话（登出用）
 */
export async function DeleteSession(token: string): Promise<void> {
    if (!token) return;
    await execute(`DELETE FROM Sessions WHERE Token = ?`, [token]);
}
