import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/auth/verify-email — 验证邮箱
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: '缺少验证 token' }, { status: 400 });
        }

        // 查找有效的验证 token
        const verification = await queryOne<{
            Id: number;
            UserId: string;
            ExpiresAt: string;
        }>(
            `SELECT Id, UserId, ExpiresAt
             FROM EmailVerificationTokens
             WHERE Token = ? AND ExpiresAt > NOW()`,
            [token],
        );

        if (!verification) {
            return NextResponse.json({ error: '验证链接无效或已过期' }, { status: 400 });
        }

        // 更新用户邮箱验证时间
        await execute(
            `UPDATE Users SET EmailVerifiedAt = NOW() WHERE Id = ?`,
            [verification.UserId],
        );

        // 删除已使用的 token
        await execute(`DELETE FROM EmailVerificationTokens WHERE Id = ?`, [verification.Id]);

        return NextResponse.json({
            success: true,
            message: '邮箱验证成功',
        });
    } catch (err) {
        console.error('[VerifyEmail] Error:', err);
        return NextResponse.json({ error: '验证失败，请稍后重试' }, { status: 500 });
    }
}
