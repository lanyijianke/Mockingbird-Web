import { NextRequest, NextResponse } from 'next/server';

// ════════════════════════════════════════════════════════════════
// Middleware — 路由保护
// 只保护明确的私有页面，公开内容页默认放行
// /api/ 路径全部放行（由各路由自行处理鉴权）
// ════════════════════════════════════════════════════════════════

const PUBLIC_PREFIXES = [
    '/api/',
    '/prompts/',
    '/articles/',
    '/rankings',
    '/_next/',
    '/content/',
    '/media/',
    '/favicon',
];

const GUEST_ONLY_PATHS = ['/login', '/register'];
const SHARED_AUTH_PATHS = ['/forgot-password', '/reset-password', '/verify-email'];
const PROTECTED_PREFIXES = ['/profile', '/membership'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionToken = request.cookies.get('session_token')?.value;

    // 公开前缀直接放行
    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix) || pathname === prefix.slice(0, -1))) {
        return NextResponse.next();
    }

    // 静态资源和根文件放行
    if (
        pathname.includes('.') && // 有文件扩展名
        !pathname.endsWith('.html')
    ) {
        return NextResponse.next();
    }

    // 登录/注册页面：已登录用户回首页，未登录用户放行
    if (GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
        if (sessionToken) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }

    // 忘记密码 / 重置密码 / 验证邮箱：已登录和未登录都允许访问
    if (SHARED_AUTH_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // 仅私有页面需要登录
    if (!sessionToken && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * 匹配所有路径，除了：
         * - _next/static (静态文件)
         * - _next/image (图片优化)
         * - 但我们要检查 _next/ 本身
         */
        '/((?!_next/static|_next/image).*)',
    ],
};
