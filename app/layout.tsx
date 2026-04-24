import Link from 'next/link';
import TopNavMobileRankingsMenu from '@/app/TopNavMobileRankingsMenu';
import { getArticleListPath } from '@/lib/articles/article-route-paths';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { buildRootMetadata } from '@/lib/seo/metadata';
import { buildWebSiteJsonLd, JsonLdScript } from '@/lib/seo/schema';
import './globals.css';

// ════════════════════════════════════════════════════════════════
// 全局元数据 — Next.js Metadata API
// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
// ════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';
export const metadata = buildRootMetadata();
const SITE_HOST = new URL(buildAbsoluteUrl('/')).host;

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
            <TopNavMobileRankingsMenu />

            {/* ═══ 热榜 — 父子菜单 ═══ */}
            <div className="nav-dropdown nav-desktop-only">
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
          <div>© 2026 知更鸟知识库 · Mockingbird Knowledge · {SITE_HOST}</div>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="site-footer-icp"
          >
            冀ICP备2024081438号
          </a>
        </footer>

        {/* ═══ WebSite JSON-LD (全局结构化数据) ═══ */}
        <JsonLdScript data={buildWebSiteJsonLd()} />
      </body>
    </html>
  );
}
