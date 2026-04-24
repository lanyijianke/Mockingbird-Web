import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    getArticleCategoryLandingPath,
    getArticleDetailPath,
    getArticleListPath,
} from '@/lib/articles/article-route-paths';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { buildArticleCategoryLandingMetadata } from '@/lib/seo/metadata';
import { buildArticleInternalLinkGroup, buildRankingInternalLinkGroup } from '@/lib/seo/internal-links';
import {
    buildBreadcrumbJsonLd,
    buildCollectionPageJsonLd,
    buildItemListJsonLd,
    JsonLdScript,
} from '@/lib/seo/schema';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ category: string }>;
}) {
    const { getArticleCategories } = await import('@/lib/services/article-service');
    const { category } = await params;
    const categories = await getArticleCategories('ai');
    const matched = categories.find((item) => item.code === category);

    if (!matched) {
        return { title: '文章分类未找到' };
    }

    return buildArticleCategoryLandingMetadata({
        categoryName: matched.name,
        canonicalPath: getArticleCategoryLandingPath('ai', category),
        title: `${matched.name} AI 文章`,
        description: `集中浏览 ${matched.name} 相关的 AI 文章、案例与方法论，适合作为专题入口页。`,
    });
}

export default async function AiArticleCategoryLandingPage({
    params,
}: {
    params: Promise<{ category: string }>;
}) {
    const { getArticleCategories, getPagedArticles } = await import('@/lib/services/article-service');
    const { category } = await params;
    const categories = await getArticleCategories('ai');
    const matched = categories.find((item) => item.code === category);

    if (!matched) {
        notFound();
    }

    const canonicalPath = getArticleCategoryLandingPath('ai', category);
    const pageUrl = buildAbsoluteUrl(canonicalPath);
    const result = await getPagedArticles(1, 20, category, undefined, { site: 'ai' });
    const articleLinks = buildArticleInternalLinkGroup({
        site: 'ai',
        categorySlug: category,
        categoryLabel: matched.name,
        articleSlug: result.items[0]?.slug ?? 'overview',
        articleTitle: result.items[0]?.title ?? `${matched.name} AI 文章`,
    });
    const rankingLinks = buildRankingInternalLinkGroup();

    return (
        <div className="articles-page">
            <JsonLdScript data={[
                buildBreadcrumbJsonLd([
                    { name: '首页', url: buildAbsoluteUrl('/') },
                    { name: 'AI 文章', url: buildAbsoluteUrl(getArticleListPath('ai')) },
                    { name: `${matched.name} AI 文章`, url: pageUrl },
                ]),
                buildCollectionPageJsonLd(
                    `${matched.name} AI 文章`,
                    `集中浏览 ${matched.name} 相关的 AI 文章、案例与方法论。`,
                    pageUrl,
                ),
                buildItemListJsonLd(
                    `${matched.name} AI 文章`,
                    `集中浏览 ${matched.name} 相关的 AI 文章、案例与方法论。`,
                    pageUrl,
                    result.items.map((item) => ({
                        name: item.title,
                        url: buildAbsoluteUrl(getArticleDetailPath('ai', item.slug)),
                    })),
                ),
            ]} />

            <header className="editorial-header">
                <div className="editorial-stats">
                    <span className="stat-badge">{result.totalCount} 篇文章</span>
                    <span className="stat-divider">·</span>
                    <span className="stat-badge">专题落地页</span>
                </div>
                <h1 className="editorial-headline">{matched.name} AI 文章</h1>
                <p className="editorial-sub">
                    集中浏览 {matched.name} 相关的 AI 文章、案例与方法论，适合作为专题入口页和搜索落地页。
                </p>
            </header>

            <section className="home-section">
                <div className="section-bar">
                    <h2 className="section-title">专题内文章</h2>
                    <Link href={`${getArticleListPath('ai')}?category=${category}`} className="section-more">
                        在列表页按此分类查看 →
                    </Link>
                </div>
                <div className="articles-list">
                    {result.items.map((article, index) => (
                        <div
                            key={article.id}
                            className="animate-emerge"
                            style={{ animationDelay: `${(index * 0.08).toFixed(2)}s` }}
                        >
                            <Link
                                href={getArticleDetailPath('ai', article.slug)}
                                className="article-item glass glass-card"
                            >
                                <div className="article-info" style={{ width: '100%' }}>
                                    <div className="article-meta">
                                        <span className="category">{article.categoryName}</span>
                                        <span className="dot">·</span>
                                        <span className="date">
                                            {new Date(article.createdAt).toLocaleDateString('zh-CN', {
                                                timeZone: 'Asia/Shanghai',
                                            })}
                                        </span>
                                    </div>
                                    <h2 className="article-title">{article.title}</h2>
                                    <p className="article-summary">{article.summary}</p>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </section>

            <section className="home-section">
                <div className="section-bar">
                    <h2 className="section-title">延伸探索</h2>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {articleLinks.links.slice(0, 2).map((link) => (
                        <Link
                            key={link.id}
                            href={link.href}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="pc2-category">文章入口</span>
                                <h3 className="pc2-title" style={{ margin: 0 }}>{link.label}</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    {link.description}
                                </p>
                            </div>
                        </Link>
                    ))}
                    <Link
                        href="/prompts/categories/gemini-3"
                        className="glass glass-card"
                        style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                    >
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <span className="pc2-category">提示词专题</span>
                            <h3 className="pc2-title" style={{ margin: 0 }}>Gemini 3 提示词</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                从文章专题切到可直接复用的多模态提示词模板。
                            </p>
                        </div>
                    </Link>
                    <Link
                        href={rankingLinks.links[1].href}
                        className="glass glass-card"
                        style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                    >
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <span className="pc2-category">热榜入口</span>
                            <h3 className="pc2-title" style={{ margin: 0 }}>{rankingLinks.links[1].label}</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                {rankingLinks.links[1].description}
                            </p>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}
