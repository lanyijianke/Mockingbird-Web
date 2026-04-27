import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { CreateSession } from '@/lib/auth/session';

// ════════════════════════════════════════════════════════════════
// Auth 辅助函数 — cookie 读写 + OAuth 登录编排
// ════════════════════════════════════════════════════════════════

const SESSION_COOKIE_NAME = 'session_token';
const SESSION_TTL_SECONDS = 30 * 86400; // 30 天

/**
 * 从请求的 cookie 中读取 session_token
 */
export function GetSessionToken(request: NextRequest): string | undefined {
    return request.cookies.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * 生成 Set-Cookie header 字符串：写入 session token
 */
export function SetSessionCookie(token: string): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return [
        `${SESSION_COOKIE_NAME}=${token}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=${SESSION_TTL_SECONDS}`,
        secure,
    ]
        .filter(Boolean)
        .join('; ');
}

/**
 * 生成 Set-Cookie header 字符串：清除 session token
 */
export function ClearSessionCookie(): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return [
        `${SESSION_COOKIE_NAME}=`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=0`,
        secure,
    ]
        .filter(Boolean)
        .join('; ');
}

/**
 * OAuth 登录编排：
 * 1. 按 provider + providerAccountId 查 oauth_accounts
 * 2. 匹配到 → 拿到 UserId；没匹配到 → 按 email 找/建 Users，再建 oauth_accounts
 * 3. 创建 session，返回 token
 */
export async function HandleOAuthLogin(
    provider: string,
    providerAccountId: string,
    email: string,
    name: string,
    avatarUrl?: string,
): Promise<string> {
    // 1) 看已有绑定
    const existing = await queryOne<{ UserId: string }>(
        `SELECT UserId FROM OauthAccounts WHERE Provider = ? AND ProviderAccountId = ?`,
        [provider, providerAccountId],
    );

    let userId: string;

    if (existing) {
        // 已绑定 — 更新用户头像（如果提供了新的）
        userId = existing.UserId;
        if (avatarUrl) {
            await query(`UPDATE Users SET AvatarUrl = ? WHERE Id = ? AND (AvatarUrl IS NULL OR AvatarUrl = '')`, [
                avatarUrl,
                userId,
            ]);
        }
    } else {
        // 2) 未绑定 — 按 email 找或建用户
        let user = await queryOne<{ Id: string }>(`SELECT Id FROM Users WHERE Email = ?`, [email]);

        if (!user) {
            const result = await query(
                `INSERT INTO Users (Name, Email, Role) VALUES (?, ?, 'user')`,
                [name, email],
            );
            // better-sqlite3 通过 getDb().prepare().run() 返回 lastInsertRowid
            // 但 query() 返回的是 stmt.all()，所以用 queryOne 再查
            user = await queryOne<{ Id: string }>(`SELECT Id FROM Users WHERE Email = ?`, [email]);
        }

        userId = user!.Id;

        // 建立 OAuth 绑定
        await query(
            `INSERT INTO OauthAccounts (Provider, ProviderAccountId, UserId) VALUES (?, ?, ?)`,
            [provider, providerAccountId, userId],
        );
    }

    // 3) 创建 session
    return CreateSession(userId);
}
