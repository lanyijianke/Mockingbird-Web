import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticleListPath } from '@/lib/articles/article-route-paths';
import { buildWebSiteJsonLd, JsonLdScript } from '@/lib/utils/json-ld';
import './globals.css';

// ════════════════════════════════════════════════════════════════
// 全局元数据 — Next.js Metadata API
// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
// ════════════════════════════════════════════════════════════════

const SITE_URL = process.env.SITE_URL || 'https://aigcclub.com.cn';

export const runtime = 'nodejs';
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '知更鸟知识库 - AI 教程 | AI 实践 | AI 提示词 | AI 工具',
    template: '%s - 知更鸟知识库',
  },
  description: '知更鸟知识库：提供专业的 AI 教程、AI 实践案例、AI 提示词精选及 AI 工具大全。致力于打造全网最全的泛 AI 知识矩阵。',
  openGraph: {
    siteName: '知更鸟知识库',
    locale: 'zh_CN',
    type: 'website',
    url: SITE_URL,
    title: '知更鸟知识库 - 泛 AI 知识平台',
    description: '深度文章、提示词精选与实时热榜，助你立于 AI 前沿',
  },
  twitter: {
    card: 'summary_large_image',
    title: '知更鸟知识库',
    description: '深度文章、提示词精选与实时热榜，助你立于 AI 前沿',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
      </head>
      <body>
        {/* ═══ Top Navigation (Every.to Style) ═══ */}
        <nav className="top-nav">
          <div className="nav-left" />

          <div className="nav-center">
            <div className="nav-divider" />
            <div className="nav-brand-name">
              <Link href="/">知更鸟</Link>
            </div>
            <div className="nav-divider" />
          </div>

          <div className="nav-right">
            <Link href="/" className="nav-link">首页</Link>
            <Link href={getArticleListPath('ai')} className="nav-link">AI文章</Link>
            <Link href={getArticleListPath('finance')} className="nav-link">金融文章</Link>
            <Link href="/prompts" className="nav-link">提示词</Link>

            {/* ═══ 热榜 — 父子菜单 ═══ */}
            <div className="nav-dropdown">
              <Link href="/rankings/github" className="nav-link nav-dropdown-trigger">
                热榜 <i className="bi bi-chevron-down nav-dropdown-arrow" />
              </Link>
              <div className="nav-dropdown-menu">
                <Link href="/rankings/github" className="nav-dropdown-item">
                  <i className="bi bi-github" style={{ color: '#58a6ff' }} />
                  <span>GitHub Trending</span>
                </Link>
                <Link href="/rankings/producthunt" className="nav-dropdown-item">
                  <i className="bi bi-rocket-takeoff" style={{ color: '#ff6154' }} />
                  <span>ProductHunt</span>
                </Link>
                <Link href="/rankings/skills-trending" className="nav-dropdown-item">
                  <i className="bi bi-fire" style={{ color: '#f0883e' }} />
                  <span>Skills Trending</span>
                </Link>
                <Link href="/rankings/skills-hot" className="nav-dropdown-item">
                  <i className="bi bi-lightning-charge" style={{ color: '#a371f7' }} />
                  <span>Skills Hot</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* ═══ Main Content ═══ */}
        <main className="main-content">
          <div className="container">
            {children}
          </div>
        </main>

        {/* ═══ Footer ═══ */}
        <footer className="site-footer">
          © 2026 知更鸟知识库 · Mockingbird Knowledge · aigcclub.com.cn
        </footer>

        {/* ═══ WebSite JSON-LD (全局结构化数据) ═══ */}
        <JsonLdScript data={buildWebSiteJsonLd()} />
      </body>
    </html>
  );
}
