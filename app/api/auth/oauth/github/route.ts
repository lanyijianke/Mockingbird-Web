import { NextRequest, NextResponse } from 'next/server';
import { HandleOAuthLogin, SetSessionCookie } from '@/app/api/auth/helpers';
import { buildAbsoluteUrl } from '@/lib/seo/config';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// GET /api/auth/oauth/github — GitHub OAuth 回调
// ════════════════════════════════════════════════════════════════

const GITHUB_CLIENT_ID = process.env.OAUTH_GITHUB_ID || '';
const GITHUB_CLIENT_SECRET = process.env.OAUTH_GITHUB_SECRET || '';
const GITHUB_REDIRECT_URI = buildAbsoluteUrl('/api/auth/oauth/github');

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            if (!GITHUB_CLIENT_ID) {
                return NextResponse.redirect(new URL('/login?error=oauth_unconfigured', request.url));
            }

            const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
            authorizeUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
            authorizeUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
            authorizeUrl.searchParams.set('scope', 'read:user user:email');
            return NextResponse.redirect(authorizeUrl);
        }

        // 1) 用 code 换 access_token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: GITHUB_REDIRECT_URI,
            }),
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error('[GitHub OAuth] Token exchange failed:', tokenData);
            return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
        }

        // 2) 获取 GitHub 用户信息
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });

        const ghUser = await userResponse.json();

        if (!ghUser.id || !ghUser.login) {
            console.error('[GitHub OAuth] User fetch failed:', ghUser);
            return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
        }

        // 3) 获取用户邮箱（GitHub 可能不公开 email）
        let email = ghUser.email;
        if (!email) {
            const emailsResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                },
            });
            const emails = await emailsResponse.json();
            const primaryEmail = emails.find(
                (e: { primary: boolean; verified: boolean }) => e.primary && e.verified,
            );
            email = primaryEmail?.email || emails[0]?.email;
        }

        if (!email) {
            return NextResponse.redirect(new URL('/login?error=no_email', request.url));
        }

        // 4) 编排 OAuth 登录
        const sessionToken = await HandleOAuthLogin(
            'github',
            String(ghUser.id),
            email,
            ghUser.name || ghUser.login,
            ghUser.avatar_url,
        );

        // 5) 设置 cookie 并跳转首页
        const response = NextResponse.redirect(new URL('/', request.url));
        response.headers.set('Set-Cookie', SetSessionCookie(sessionToken));
        return response;
    } catch (err) {
        console.error('[GitHub OAuth] Error:', err);
        return NextResponse.redirect(new URL('/login?error=oauth_error', request.url));
    }
}
