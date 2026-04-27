import { NextRequest } from 'next/server';
import { GetSessionToken } from '@/app/api/auth/helpers';
import { GetSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db';

// ════════════════════════════════════════════════════════════════
// 角色守卫 — 用于需要特定角色的 API 路由
// ════════════════════════════════════════════════════════════════

interface UserProfile {
    Id: string;
    Role: string;
}

interface RoleCheckResult {
    userId: string;
    role: string;
}

/**
 * 检查当前请求的用户是否拥有允许的角色之一。
 * 成功返回 { userId, role }，失败返回 JSON Response (401 / 403)。
 */
export async function RequireRole(
    request: NextRequest,
    allowedRoles: string[],
): Promise<RoleCheckResult | Response> {
    const token = GetSessionToken(request);
    if (!token) {
        return new Response(JSON.stringify({ error: '请先登录' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const session = await GetSession(token);
    if (!session) {
        return new Response(JSON.stringify({ error: '会话已过期，请重新登录' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const user = await queryOne<UserProfile>(
        `SELECT Id, Role FROM Users WHERE Id = ?`,
        [session.UserId],
    );

    if (!user) {
        return new Response(JSON.stringify({ error: '用户不存在' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!allowedRoles.includes(user.Role)) {
        return new Response(JSON.stringify({ error: '权限不足' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return { userId: user.Id, role: user.Role };
}
