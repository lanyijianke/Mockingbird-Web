import { NextRequest, NextResponse } from 'next/server';
import { GetSessionToken, ClearSessionCookie } from '@/app/api/auth/helpers';
import { DeleteSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/auth/logout — 登出
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const token = GetSessionToken(request);
        if (token) {
            await DeleteSession(token);
        }

        return NextResponse.json(
            { success: true, message: '已登出' },
            {
                status: 200,
                headers: { 'Set-Cookie': ClearSessionCookie() },
            },
        );
    } catch (err) {
        console.error('[Logout] Error:', err);
        // 即使出错也清除 cookie
        return NextResponse.json(
            { success: true, message: '已登出' },
            {
                status: 200,
                headers: { 'Set-Cookie': ClearSessionCookie() },
            },
        );
    }
}
