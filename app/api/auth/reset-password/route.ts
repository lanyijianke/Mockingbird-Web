import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/auth/reset-password — 通过 token 重置密码
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, password } = body;

        if (!token || !password) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 });
        }

        // 验证 token
        const resetToken = await queryOne<{
            Id: number;
            UserId: string;
            ExpiresAt: string;
        }>(
            `SELECT Id, UserId, ExpiresAt
             FROM PasswordResetTokens
             WHERE Token = ? AND ExpiresAt > datetime('now')`,
            [token],
        );

        if (!resetToken) {
            return NextResponse.json({ error: '重置链接无效或已过期' }, { status: 400 });
        }

        // 哈希新密码
        const passwordHash = await bcrypt.hash(password, 12);

        // 更新密码
        await execute(`UPDATE Users SET PasswordHash = ? WHERE Id = ?`, [
            passwordHash,
            resetToken.UserId,
        ]);

        // 删除已使用的 token
        await execute(`DELETE FROM PasswordResetTokens WHERE Id = ?`, [resetToken.Id]);

        return NextResponse.json({
            success: true,
            message: '密码重置成功',
        });
    } catch (err) {
        console.error('[ResetPassword] Error:', err);
        return NextResponse.json({ error: '重置失败，请稍后重试' }, { status: 500 });
    }
}
