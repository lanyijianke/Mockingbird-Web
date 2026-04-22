import Link from 'next/link';
import Image from 'next/image';
import { getArticleCategories, getTopArticles, getTotalCount as getArticleCount } from '@/lib/services/article-service';
import { getArticleDetailPath, getArticleListPath } from '@/lib/articles/article-route-paths';
import { getTopPrompts } from '@/lib/services/prompt-service';
import { getCategoryName } from '@/lib/categories';
import { queryScalar } from '@/lib/db';
import { formatBeijingDate } from '@/lib/utils/time-utils';
import { buildOrganizationJsonLd, buildWebPageJsonLd, JsonLdScript } from '@/lib/utils/json-ld';

export const runtime = 'nodejs';
export const revalidate = 300; // ISR: 5 minutes
const SITE_URL = process.env.SITE_URL || 'https://aigcclub.com.cn';

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof getTopArticles>> = [];
  let prompts: Awaited<ReturnType<typeof getTopPrompts>> = [];
  let articleCount = 0;
  let promptCount = 0;
  let articleCategories: Awaited<ReturnType<typeof getArticleCategories>> = [];

  try {
    [articles, prompts, articleCount, promptCount, articleCategories] = await Promise.all([
      getTopArticles(15, { site: 'ai' }),
      getTopPrompts(8),
      getArticleCount({ site: 'ai' }),
      (queryScalar<number>('SELECT COUNT(*) FROM Prompts WHERE IsActive = 1')).then(v => v ?? 0),
      getArticleCategories('ai'),
    ]);
  } catch (err) {
    console.error('[HomePage] 数据加载失败，使用空数据降级渲染:', err);
  }

  // Hero (center): first article with cover image
  const heroArticle = articles.find(a => a.coverUrl && a.coverUrl !== '/images/default-cover.png') || articles[0];
  // Left column: next 2 articles
  const leftArticles = articles.filter(a => a !== heroArticle).slice(0, 2);
  // Right column "Recent Essays": next 4 articles
  const recentArticles = articles.filter(a => a !== heroArticle && !leftArticles.includes(a)).slice(0, 4);
  // Group ALL articles by category for the category showcase (independent of editorial grid)
  const categoryGroups = new Map<string, typeof articles>();
  for (const article of articles) {
    const cat = article.category || 'industry-news';
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(article);
  }

  return (
    <>
      <JsonLdScript data={[
        buildOrganizationJsonLd(),
        buildWebPageJsonLd(
          '知更鸟知识库 - 泛 AI 知识平台',
          '深度文章、提示词精选与实时热榜，助你立于 AI 前沿。',
          SITE_URL,
        ),
      ]} />

      {/* ═══ 01 Editorial Header ═══ */}
      <header className="editorial-header">
        <div className="editorial-stats">
          <span className="stat-badge">{articleCount} 篇文章</span>
          <span className="stat-divider">·</span>
          <span className="stat-badge">{promptCount} 个提示词</span>
        </div>
        <h1 className="editorial-headline">泛 AI 知识平台</h1>
        <p className="editorial-sub">深度文章、提示词精选与实时热榜，助你立于 AI 前沿</p>
      </header>

      {/* ═══ 02 Editorial 3-Column Grid ═══ */}
      <section className="editorial-grid">
        {/* Left Column: Side articles */}
        <div className="editorial-left">
          {leftArticles.map(article => (
            <Link key={article.id} href={getArticleDetailPath('ai', article.slug)} className="side-card">
              {article.coverUrl && (
                <div className="side-card-cover">
                  <Image src={article.coverUrl || '/images/default-cover.png'} alt={article.title} fill sizes="(max-width: 768px) 100vw, 280px" style={{ objectFit: 'cover' }} />
                </div>
              )}
              <div className="side-card-info">
                <span className="side-card-meta">
                  {formatBeijingDate(article.createdAt)} IN <span className="meta-category">{article.categoryName}</span>
                </span>
                <h3 className="side-card-title">{article.title}</h3>
              </div>
            </Link>
          ))}
        </div>

        {/* Center Column: Hero article */}
        <div className="editorial-center">
          {heroArticle && (
            <Link href={getArticleDetailPath('ai', heroArticle.slug)} className="hero-card">
              {heroArticle.coverUrl && (
                <div className="hero-card-cover">
                  <Image src={heroArticle.coverUrl || '/images/default-cover.png'} alt={heroArticle.title} fill sizes="(max-width: 768px) 100vw, 560px" style={{ objectFit: 'cover' }} />
                </div>
              )}
              <div className="hero-card-info">
                <span className="hero-card-meta">
                  {formatBeijingDate(heroArticle.createdAt)} IN <span className="meta-category">{heroArticle.categoryName}</span>
                </span>
                <h2 className="hero-card-title">{heroArticle.title}</h2>
                {heroArticle.summary && (
                  <p className="hero-card-summary">{heroArticle.summary}</p>
                )}
              </div>
            </Link>
          )}
        </div>

        {/* Right Column: Recent Essays */}
        <aside className="editorial-right">
          <div className="recent-header">
            <span>最新文章</span>
            <Link href={getArticleListPath('ai')} className="recent-arrow">→</Link>
          </div>
          <div className="recent-list">
            {recentArticles.map(article => (
              <Link key={article.id} href={getArticleDetailPath('ai', article.slug)} className="recent-item">
                <div className="recent-thumb">
                  <Image src={article.coverUrl || '/images/default-cover.png'} alt={article.title} fill sizes="56px" style={{ objectFit: 'cover' }} />
                </div>
                <div className="recent-info">
                  <h4 className="recent-title">{article.title}</h4>
                  <span className="recent-category">{article.categoryName}</span>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      {/* ═══ 03 Category Articles Showcase ═══ */}
      <section className="home-section">
        <div className="section-bar">
          <h2 className="section-title">分类文章精选</h2>
          <Link href={getArticleListPath('ai')} className="section-more">
            浏览全部 →
          </Link>
        </div>

        <div className="category-showcase">
          {articleCategories.slice(0, 3).map((category) => {
            const catCode = category.code;
            const catArticles = categoryGroups.get(catCode) || [];
            return (
              <div key={catCode} className="category-group">
                <div className="category-group-header">
                  <span className="category-group-name">{category.name}</span>
                  <span className="category-group-count">{catArticles.length} 篇</span>
                </div>
                {catArticles.length > 0 ? (
                  <div className="category-group-list">
                    {catArticles.slice(0, 3).map(article => (
                      <Link key={article.id} href={getArticleDetailPath('ai', article.slug)} className="category-article-card">
                        <div className="category-article-cover">
                          <Image
                            src={article.coverUrl || '/images/default-cover.png'}
                            alt={article.title}
                            fill
                            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                        <div className="category-article-info">
                          <h3 className="category-article-title">{article.title}</h3>
                          {article.summary && (
                            <p className="category-article-summary">{article.summary}</p>
                          )}
                          <span className="category-article-date">{formatBeijingDate(article.createdAt)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="category-group-empty">
                    <i className="bi bi-journal-text" />
                    <span>精彩内容即将上线，敬请期待</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ 04 Section Divider ═══ */}
      <div className="section-divider" />

      {/* ═══ 05 Prompt Showcase ═══ */}
      <section className="home-section">
        <div className="section-bar">
          <h2 className="section-title">最新提示词精选</h2>
          <Link href="/prompts" className="section-more">
            查看全部 →
          </Link>
        </div>

        <div className="prompts-masonry">
          {prompts.map((prompt, idx) => (
            <Link
              key={prompt.id}
              href={`/prompts/${prompt.id}`}
              className="prompt-card-v2"
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className="pc2-cover">
                {prompt.coverImageUrl ? (
                  <Image
                    src={prompt.coverImageUrl}
                    alt={prompt.title}
                    fill
                    sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 25vw"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className="pc2-cover-empty">
                    <i className="bi bi-lightbulb" />
                  </div>
                )}

                <span className="pc2-stat">
                  <i className="bi bi-clipboard" /> {prompt.copyCount.toLocaleString()}
                </span>

                <div className="pc2-overlay">
                  <span className="pc2-category">{getCategoryName(prompt.category)}</span>
                  <h3 className="pc2-title">{prompt.title}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
