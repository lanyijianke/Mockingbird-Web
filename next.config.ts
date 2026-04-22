import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./lib/security/csp";

const contentSecurityPolicy = buildContentSecurityPolicy(process.env.NODE_ENV !== 'production');

const nextConfig: NextConfig = {
  devIndicators: false,

  // ── next/image 远程图片域名白名单 ───────────────────────────
  images: {
    remotePatterns: [
      // Console API 提供的封面图片
      { protocol: 'https', hostname: 'aigcclub.com.cn' },
      { protocol: 'http', hostname: 'localhost', port: '5299' },
      // 常见外部图床 (GitHub / 微信公众号等)
      { protocol: 'https', hostname: '*.githubusercontent.com' },
      { protocol: 'https', hostname: 'mmbiz.qpic.cn' },
      { protocol: 'https', hostname: 'ph-files.imgix.net' },
    ],
  },

  // ── HTTP 安全头 ─────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default nextConfig;
