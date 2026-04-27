import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email/send';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/auth/forgot-password — 申请重置密码
// 无论邮箱是否存在，始终返回统一成功消息（防枚举）
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: '请输入邮箱地址' }, { status: 400 });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // 查找用户 — 不暴露是否存在
        const user = await queryOne<{ Id: string; Email: string }>(
            `SELECT Id, Email FROM Users WHERE Email = ?`,
            [trimmedEmail],
        );

        if (user) {
            // 生成重置 token
            const resetToken = nanoid(32);
            const expiresAt = new Date(Date.now() + 3600_000) // 1 小时有效
                .toISOString()
                .replace('T', ' ')
                .replace(/\.\d{3}Z$/, '');

            await execute(
                `INSERT INTO PasswordResetTokens (Token, UserId, ExpiresAt) VALUES (?, ?, ?)`,
                [resetToken, user.Id, expiresAt],
            );

            // 发送邮件 — 等待结果，失败时返回中文错误
            const emailResult = await sendPasswordResetEmail(user.Email, resetToken);
            if (!emailResult.success) {
                return NextResponse.json(
                    { error: `重置邮件发送失败：${emailResult.error}` },
                    { status: 500 },
                );
            }
        }

        // 始终返回统一消息（防枚举攻击）
        return NextResponse.json({
            success: true,
            message: '如果该邮箱已注册，重置密码邮件已发送',
        });
    } catch (err) {
        console.error('[ForgotPassword] Error:', err);
        return NextResponse.json({ error: '操作失败，请稍后重试' }, { status: 500 });
    }
}
