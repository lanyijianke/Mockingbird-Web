import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { GetSessionToken, ClearSessionCookie } from '@/app/api/auth/helpers';
import { GetSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// GET /api/auth/me — 获取当前登录用户信息
// ════════════════════════════════════════════════════════════════

interface UserRow {
    Id: string;
    Email: string;
    Name: string;
    Role: string;
    AvatarUrl: string | null;
    PasswordHash: string | null;
    EmailVerifiedAt: string | null;
}

interface OauthRow {
    Provider: string;
}

export async function GET(request: NextRequest) {
    try {
        const token = GetSessionToken(request);
        if (!token) {
            return NextResponse.json(
                { error: '未登录' },
                { status: 401, headers: { 'Set-Cookie': ClearSessionCookie() } },
            );
        }

        const session = await GetSession(token);
        if (!session) {
            return NextResponse.json(
                { error: '会话已过期' },
                { status: 401, headers: { 'Set-Cookie': ClearSessionCookie() } },
            );
        }

        const user = await queryOne<UserRow>(
            `SELECT Id, Email, Name, Role, AvatarUrl, PasswordHash, EmailVerifiedAt
             FROM Users WHERE Id = ?`,
            [session.UserId],
        );

        if (!user) {
            return NextResponse.json(
                { error: '用户不存在' },
                { status: 401, headers: { 'Set-Cookie': ClearSessionCookie() } },
            );
        }

        // 获取 OAuth 绑定列表
        const oauthRows = await query<OauthRow>(
            `SELECT Provider FROM OauthAccounts WHERE UserId = ?`,
            [user.Id],
        );

        return NextResponse.json({
            user: {
                id: user.Id,
                email: user.Email,
                name: user.Name,
                role: user.Role,
                avatarUrl: user.AvatarUrl,
                emailVerified: !!user.EmailVerifiedAt,
                hasPassword: !!user.PasswordHash,
                oauthProviders: oauthRows.map((r) => r.Provider),
            },
        });
    } catch (err) {
        console.error('[Me] Error:', err);
        return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
    }
}
