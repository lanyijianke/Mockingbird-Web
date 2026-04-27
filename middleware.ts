import { NextRequest, NextResponse } from 'next/server';

// ════════════════════════════════════════════════════════════════
// Middleware — 路由保护
// 公开前缀下的路径直接放行，其余路径需要登录
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

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

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

    // 检查是否有 session cookie
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
        // 未登录 — 如果已经在登录相关页面，放行
        if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
            return NextResponse.next();
        }

        // 其他页面跳转到登录页，带上回调地址
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 已登录 — 如果在登录/注册页面，跳转到首页
    if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/', request.url));
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
