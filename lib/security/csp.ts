export function buildContentSecurityPolicy(isDev: boolean): string {
    const scriptSrc = isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'";

    const connectSrc = isDev
        ? "connect-src 'self' https: http: ws: wss:"
        : "connect-src 'self' https:";

    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
        connectSrc,
        "media-src 'self' https: blob:",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
    ].join('; ');
}
