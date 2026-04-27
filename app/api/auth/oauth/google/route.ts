import { NextRequest, NextResponse } from 'next/server';
import { HandleOAuthLogin, SetSessionCookie } from '@/app/api/auth/helpers';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// GET /api/auth/oauth/google — Google OAuth 回调
// ════════════════════════════════════════════════════════════════

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.redirect(new URL('/login?error=oauth_denied', request.url));
        }

        // 1) 用 code 换 token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: `${process.env.SITE_URL || 'http://localhost:5046'}/api/auth/oauth/google`,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenResponse.json();
        const idToken = tokenData.id_token;

        if (!idToken) {
            console.error('[Google OAuth] Token exchange failed:', tokenData);
            return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
        }

        // 2) 解码 id_token 获取用户信息（JWT payload）
        const payloadB64 = idToken.split('.')[1];
        const payload = JSON.parse(
            Buffer.from(payloadB64, 'base64url').toString('utf-8'),
        );

        const googleUserId = payload.sub;
        const email = payload.email;
        const name = payload.name || email;
        const avatarUrl = payload.picture;

        if (!googleUserId || !email) {
            console.error('[Google OAuth] Missing user info in id_token:', payload);
            return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
        }

        // 3) 编排 OAuth 登录
        const sessionToken = await HandleOAuthLogin(
            'google',
            googleUserId,
            email,
            name,
            avatarUrl,
        );

        // 4) 设置 cookie 并跳转首页
        const response = NextResponse.redirect(new URL('/', request.url));
        response.headers.set('Set-Cookie', SetSessionCookie(sessionToken));
        return response;
    } catch (err) {
        console.error('[Google OAuth] Error:', err);
        return NextResponse.redirect(new URL('/login?error=oauth_error', request.url));
    }
}
