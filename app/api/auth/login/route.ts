import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { SetSessionCookie } from '@/app/api/auth/helpers';
import { CreateSession } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/auth/login — 邮箱密码登录
// ════════════════════════════════════════════════════════════════

interface UserRow {
    Id: string;
    Email: string;
    Name: string;
    Role: string;
    PasswordHash: string | null;
    AvatarUrl: string | null;
    EmailVerifiedAt: string | null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: '请输入邮箱和密码' }, { status: 400 });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // 查找用户
        const user = await queryOne<UserRow>(
            `SELECT Id, Email, Name, Role, PasswordHash, AvatarUrl, EmailVerifiedAt
             FROM Users WHERE Email = ?`,
            [trimmedEmail],
        );

        if (!user) {
            return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 });
        }

        // 检查密码
        if (!user.PasswordHash) {
            return NextResponse.json(
                { error: '该账号使用第三方登录，请使用对应方式登录' },
                { status: 400 },
            );
        }

        const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!passwordMatch) {
            return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 });
        }

        // 创建会话
        const sessionToken = await CreateSession(user.Id);

        return NextResponse.json(
            {
                success: true,
                user: {
                    id: user.Id,
                    email: user.Email,
                    name: user.Name,
                    role: user.Role,
                    avatarUrl: user.AvatarUrl,
                    emailVerified: !!user.EmailVerifiedAt,
                },
            },
            {
                status: 200,
                headers: { 'Set-Cookie': SetSessionCookie(sessionToken) },
            },
        );
    } catch (err) {
        console.error('[Login] Error:', err);
        return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
    }
}
