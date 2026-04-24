import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import {
    getRankingTopicPageBySlug,
    getRankingTopicPages,
    type RankingSource,
} from '@/lib/seo/growth-pages';
import { buildRankingMetadata } from '@/lib/seo/metadata';
import {
    buildBreadcrumbJsonLd,
    buildCollectionPageJsonLd,
    buildFaqPageJsonLd,
    buildHowToJsonLd,
    buildItemListJsonLd,
    JsonLdScript,
} from '@/lib/seo/schema';
import {
    getGitHubTrendings,
    getProductHuntRankings,
    getSkillsShRankings,
} from '@/lib/services/ranking-cache';
import type { GitHubTrending, ProductHuntRanking, SkillsShRanking } from '@/lib/types';

type TopicPageParams = {
    params: Promise<{ slug: string }>;
};

type RankingTopicItem = Pick<ProductHuntRanking, 'id' | 'title'>
    | Pick<GitHubTrending, 'id' | 'repoFullName'>
    | Pick<SkillsShRanking, 'id' | 'skillName'>;

function getSourceLabel(source: RankingSource): string {
    if (source === 'github') return 'GitHub';
    if (source === 'producthunt') return 'ProductHunt';
    return 'Skills';
}

function getItemName(item: RankingTopicItem): string {
    if ('title' in item && typeof item.title === 'string' && item.title.length > 0) {
        return item.title;
    }
    if ('repoFullName' in item && typeof item.repoFullName === 'string' && item.repoFullName.length > 0) {
        return item.repoFullName;
    }
    if ('skillName' in item && typeof item.skillName === 'string' && item.skillName.length > 0) {
        return item.skillName;
    }
    return '未知条目';
}

async function loadTopicItems(source: RankingSource): Promise<RankingTopicItem[]> {
    if (source === 'producthunt') return await getProductHuntRankings();
    if (source === 'github') return await getGitHubTrendings();
    if (source === 'skills-hot') return await getSkillsShRankings('hot');
    return await getSkillsShRankings('trending');
}

export async function generateStaticParams() {
    return getRankingTopicPages().map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: TopicPageParams): Promise<Metadata> {
    const { slug } = await params;
    const page = getRankingTopicPageBySlug(slug);

    if (!page) {
        return { title: '热榜专题未找到' };
    }

    return buildRankingMetadata({
        title: page.title,
        description: page.description,
        canonicalPath: page.canonicalPath,
    });
}

export default async function RankingTopicPage({ params }: TopicPageParams) {
    const { slug } = await params;
    const page = getRankingTopicPageBySlug(slug);

    if (!page) {
        notFound();
    }

    const sourceLabel = getSourceLabel(page.rankingSource);
    const items = await loadTopicItems(page.rankingSource);
    const faqItems = page.blocks
        .filter((block) => block.type === 'faq')
        .flatMap((block) => block.items);
    const howToSteps = page.blocks
        .filter((block) => block.type === 'steps')
        .flatMap((block) => block.items);
    const pageUrl = buildAbsoluteUrl(page.canonicalPath);

    return (
        <div className="zone-producthunt">
            <JsonLdScript
                data={[
                    buildBreadcrumbJsonLd([
                        { name: '首页', url: buildAbsoluteUrl('/') },
                        { name: '排行榜', url: buildAbsoluteUrl('/rankings/github') },
                        { name: '热榜专题', url: buildAbsoluteUrl('/rankings/topics') },
                        { name: page.title, url: pageUrl },
                    ]),
                    buildCollectionPageJsonLd(page.title, page.description, pageUrl),
                    buildItemListJsonLd(
                        page.title,
                        page.description,
                        pageUrl,
                        items.slice(0, 10).map((item) => ({
                            name: getItemName(item),
                            url: null,
                        })),
                    ),
                    ...(faqItems.length > 0 ? [buildFaqPageJsonLd(faqItems)] : []),
                    ...(howToSteps.length > 0
                        ? [buildHowToJsonLd(`${page.title} 使用步骤`, page.description, pageUrl, howToSteps)]
                        : []),
                ]}
            />

            <div className="zone-header">
                <h1 className="zone-title zone-title-ph">{page.title}</h1>
                <p className="zone-subtitle">{page.intro}</p>
            </div>

            {page.blocks.map((block, index) => (
                <section key={`${page.slug}-${block.heading}-${index}`} className="glass glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <h2 className="pc2-title" style={{ marginTop: 0 }}>{block.heading}</h2>

                    {block.type === 'definition' ? (
                        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                            {block.body}
                        </p>
                    ) : null}

                    {block.type === 'faq' ? (
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            {block.items.map((entry) => (
                                <div key={entry.question}>
                                    <h3 style={{ margin: '0 0 0.25rem 0' }}>{entry.question}</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        {entry.answer}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.type === 'comparison' ? (
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            {block.rows.map((row) => (
                                <div key={row.label}>
                                    <h3 style={{ margin: '0 0 0.25rem 0' }}>{row.label}</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        {row.summary}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.type === 'steps' ? (
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            {block.items.map((step, stepIndex) => (
                                <div key={`${step.name}-${stepIndex}`}>
                                    <h3 style={{ margin: '0 0 0.25rem 0' }}>
                                        步骤 {stepIndex + 1}: {step.name}
                                    </h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        {step.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.type === 'stats' ? (
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            {block.items.map((item) => (
                                <div key={`${item.label}-${item.value}`}>
                                    <h3 style={{ margin: '0 0 0.25rem 0' }}>{item.label}</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        {item.value}
                                    </p>
                                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }}>
                                        来源: {item.sourceName}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </section>
            ))}

            <section className="glass glass-card" style={{ padding: '1.25rem' }}>
                <span className="pc2-category">{sourceLabel}</span>
                <h2 className="pc2-title" style={{ marginTop: '0.35rem' }}>相关榜单条目</h2>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {items.slice(0, 10).map((item, index) => (
                        <li key={`${page.slug}-${index}`}>{getItemName(item)}</li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
