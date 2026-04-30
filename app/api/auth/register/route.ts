import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email/send';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/auth/register — 注册新用户
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, name } = body;

        // 基本校验
        if (!email || !password || !name) {
            return NextResponse.json({ error: '请填写所有必填项' }, { status: 400 });
        }

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 });
        }

        if (trimmedName.length < 2) {
            return NextResponse.json({ error: '昵称至少 2 个字符' }, { status: 400 });
        }

        // 检查邮箱唯一性
        const existing = await queryOne<{ Id: string }>(
            `SELECT Id FROM Users WHERE Email = ?`,
            [trimmedEmail],
        );
        if (existing) {
            return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 });
        }

        // 哈希密码
        const passwordHash = await bcrypt.hash(password, 12);

        // 插入用户
        const userId = crypto.randomUUID();

        await execute(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?, 'user')`,
            [userId, trimmedName, trimmedEmail, passwordHash],
        );

        // 生成邮箱验证 token
        const verifyToken = nanoid(32);
        const verifyExpires = new Date(Date.now() + 24 * 86400_000)
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d{3}Z$/, '');

        await execute(
            `INSERT INTO EmailVerificationTokens (Token, UserId, ExpiresAt) VALUES (?, ?, ?)`,
            [verifyToken, userId, verifyExpires],
        );

        // 发送验证邮件
        const emailResult = await sendVerificationEmail(trimmedEmail, verifyToken);
        if (!emailResult.success) {
            return NextResponse.json(
                { error: `注册成功但验证邮件发送失败：${emailResult.error}` },
                { status: 201 },
            );
        }

        return NextResponse.json({
            success: true,
            message: '注册成功，请先验证邮箱',
            user: { id: userId, email: trimmedEmail, name: trimmedName },
        }, { status: 201 });
    } catch (err) {
        console.error('[Register] Error:', err);
        return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }
}
