import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryName, getSubcategories } from '@/lib/categories';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { buildPromptCategoryLandingMetadata } from '@/lib/seo/metadata';
import { buildPromptInternalLinkGroup, buildRankingInternalLinkGroup } from '@/lib/seo/internal-links';
import {
    buildBreadcrumbJsonLd,
    buildCollectionPageJsonLd,
    buildItemListJsonLd,
    JsonLdScript,
} from '@/lib/seo/schema';

export const runtime = 'nodejs';
export const revalidate = 3600;

const VALID_PROMPT_CATEGORIES = new Set(
    getSubcategories('multimodal-prompts').map((item) => item.code)
);

function getPromptCategoryPath(category: string): string {
    return `/prompts/categories/${category}`;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ category: string }>;
}) {
    const { category } = await params;

    if (!VALID_PROMPT_CATEGORIES.has(category)) {
        return { title: '提示词分类未找到' };
    }

    const categoryName = getCategoryName(category);

    return buildPromptCategoryLandingMetadata({
        categoryName,
        canonicalPath: getPromptCategoryPath(category),
        title: `${categoryName} 提示词`,
        description: `汇总 ${categoryName} 相关的高质量提示词模板、案例与延伸入口，适合继续筛选和复用。`,
    });
}

export default async function PromptCategoryLandingPage({
    params,
}: {
    params: Promise<{ category: string }>;
}) {
    const { getPagedPrompts } = await import('@/lib/services/prompt-service');
    const { category } = await params;

    if (!VALID_PROMPT_CATEGORIES.has(category)) {
        notFound();
    }

    const categoryName = getCategoryName(category);
    const canonicalPath = getPromptCategoryPath(category);
    const pageUrl = buildAbsoluteUrl(canonicalPath);
    const result = await getPagedPrompts(1, 20, category);
    const promptLinks = buildPromptInternalLinkGroup({
        categorySlug: category,
        categoryLabel: categoryName,
        promptId: result.items[0]?.id ?? 0,
        promptTitle: result.items[0]?.title ?? `${categoryName} 提示词`,
    });
    const rankingLinks = buildRankingInternalLinkGroup();

    return (
        <div className="prompts-page">
            <JsonLdScript data={[
                buildBreadcrumbJsonLd([
                    { name: '首页', url: buildAbsoluteUrl('/') },
                    { name: '提示词库', url: buildAbsoluteUrl('/prompts') },
                    { name: `${categoryName} 提示词`, url: pageUrl },
                ]),
                buildCollectionPageJsonLd(
                    `${categoryName} 提示词`,
                    `汇总 ${categoryName} 相关的高质量提示词模板、案例与延伸入口。`,
                    pageUrl,
                ),
                buildItemListJsonLd(
                    `${categoryName} 提示词`,
                    `汇总 ${categoryName} 相关的高质量提示词模板、案例与延伸入口。`,
                    pageUrl,
                    result.items.map((item) => ({
                        name: item.title,
                        url: buildAbsoluteUrl(`/prompts/${item.id}`),
                    })),
                ),
            ]} />

            <header className="editorial-header">
                <div className="editorial-stats">
                    <span className="stat-badge">{result.totalCount} 个提示词</span>
                    <span className="stat-divider">·</span>
                    <span className="stat-badge">专题落地页</span>
                </div>
                <h1 className="editorial-headline">{categoryName} 提示词</h1>
                <p className="editorial-sub">
                    汇总 {categoryName} 相关的高质量提示词模板、案例与延伸入口，方便你从专题页直接进入复用。
                </p>
            </header>

            <section className="home-section">
                <div className="section-bar">
                    <h2 className="section-title">专题内提示词</h2>
                    <Link href={`/prompts?category=${category}`} className="section-more">
                        在列表页按此分类查看 →
                    </Link>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {result.items.map((prompt) => (
                        <Link
                            key={prompt.id}
                            href={`/prompts/${prompt.id}`}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                                <span className="pc2-category">{categoryName}</span>
                                <h3 className="pc2-title" style={{ margin: 0 }}>{prompt.title}</h3>
                                {prompt.description ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        {prompt.description}
                                    </p>
                                ) : null}
                            </div>
                        </Link>
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
                    {promptLinks.links.slice(0, 2).map((link) => (
                        <Link
                            key={link.id}
                            href={link.href}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="pc2-category">提示词入口</span>
                                <h3 className="pc2-title" style={{ margin: 0 }}>{link.label}</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    {link.description}
                                </p>
                            </div>
                        </Link>
                    ))}
                    <Link
                        href="/ai/articles/categories/prompts"
                        className="glass glass-card"
                        style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                    >
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <span className="pc2-category">相关文章</span>
                            <h3 className="pc2-title" style={{ margin: 0 }}>提示词相关文章</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                从专题提示词延伸到相关教程、技巧与工作流拆解。
                            </p>
                        </div>
                    </Link>
                    <Link
                        href={rankingLinks.links[2].href}
                        className="glass glass-card"
                        style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                    >
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <span className="pc2-category">热榜入口</span>
                            <h3 className="pc2-title" style={{ margin: 0 }}>{rankingLinks.links[2].label}</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                {rankingLinks.links[2].description}
                            </p>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}
