import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { getPromptScenarioPageBySlug, getPromptScenarioPages } from '@/lib/seo/growth-pages';
import { buildPromptsListMetadata } from '@/lib/seo/metadata';
import {
    buildBreadcrumbJsonLd,
    buildCollectionPageJsonLd,
    buildFaqPageJsonLd,
    buildHowToJsonLd,
    buildItemListJsonLd,
    JsonLdScript,
} from '@/lib/seo/schema';

type ScenarioPageParams = {
    params: Promise<{ slug: string }>;
};

function resolveScenarioQuery(scenario: NonNullable<ReturnType<typeof getPromptScenarioPageBySlug>>) {
    return {
        category: scenario.promptSourceCategory || scenario.promptCategory,
        searchQuery: scenario.promptSourceCategory ? undefined : scenario.promptSearchQuery,
    };
}

function getFaqItems(scenario: NonNullable<ReturnType<typeof getPromptScenarioPageBySlug>>) {
    return scenario.blocks
        .filter((block) => block.type === 'faq')
        .flatMap((block) => block.items);
}

function getHowToSteps(scenario: NonNullable<ReturnType<typeof getPromptScenarioPageBySlug>>) {
    return scenario.blocks
        .filter((block) => block.type === 'steps')
        .flatMap((block) => block.items);
}

export async function generateStaticParams() {
    return getPromptScenarioPages().map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: ScenarioPageParams): Promise<Metadata> {
    const { slug } = await params;
    const scenario = getPromptScenarioPageBySlug(slug);

    if (!scenario) {
        return { title: '提示词场景未找到' };
    }

    return buildPromptsListMetadata({
        title: scenario.title,
        description: scenario.description,
        canonicalPath: scenario.canonicalPath,
    });
}

export default async function PromptScenarioPage({ params }: ScenarioPageParams) {
    const { getPagedPrompts } = await import('@/lib/services/prompt-service');
    const { slug } = await params;
    const scenario = getPromptScenarioPageBySlug(slug);

    if (!scenario) {
        notFound();
    }

    const query = resolveScenarioQuery(scenario);
    const selectedPrompts = await getPagedPrompts(1, 12, query.category, query.searchQuery);
    const pageUrl = buildAbsoluteUrl(scenario.canonicalPath);
    const faqItems = getFaqItems(scenario);
    const howToSteps = getHowToSteps(scenario);

    return (
        <div className="prompts-page">
            <JsonLdScript
                data={[
                    buildBreadcrumbJsonLd([
                        { name: '首页', url: buildAbsoluteUrl('/') },
                        { name: '提示词库', url: buildAbsoluteUrl('/prompts') },
                        { name: '提示词场景页', url: buildAbsoluteUrl('/prompts/scenarios') },
                        { name: scenario.title, url: pageUrl },
                    ]),
                    buildCollectionPageJsonLd(
                        scenario.title,
                        scenario.description,
                        pageUrl,
                    ),
                    buildItemListJsonLd(
                        scenario.title,
                        scenario.description,
                        pageUrl,
                        selectedPrompts.items.map((prompt) => ({
                            name: prompt.title,
                            url: buildAbsoluteUrl(`/prompts/${prompt.id}`),
                        })),
                    ),
                    ...(faqItems.length > 0 ? [buildFaqPageJsonLd(faqItems)] : []),
                    ...(howToSteps.length > 0
                        ? [buildHowToJsonLd(`${scenario.title} 使用步骤`, scenario.description, pageUrl, howToSteps)]
                        : []),
                ]}
            />

            <header className="editorial-header">
                <div className="editorial-stats">
                    <span className="stat-badge">场景页</span>
                    <span className="stat-divider">·</span>
                    <span className="stat-badge">canonical 已固定</span>
                </div>
                <h1 className="editorial-headline">{scenario.title}</h1>
                <p className="editorial-sub">{scenario.intro}</p>
            </header>

            {scenario.blocks.map((block, index) => (
                <section key={`${scenario.slug}-${block.heading}-${index}`} className="home-section">
                    <div className="section-bar">
                        <h2 className="section-title">{block.heading}</h2>
                    </div>

                    {block.type === 'definition' ? (
                        <p className="zone-subtitle">{block.body}</p>
                    ) : null}

                    {block.type === 'faq' ? (
                        <div style={{ display: 'grid', gap: '0.9rem' }}>
                            {block.items.map((item) => (
                                <div key={item.question} className="glass glass-card" style={{ padding: '1rem' }}>
                                    <h3 className="pc2-title" style={{ margin: 0 }}>{item.question}</h3>
                                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                        {item.answer}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.type === 'steps' ? (
                        <div style={{ display: 'grid', gap: '0.9rem' }}>
                            {block.items.map((item, itemIndex) => (
                                <div key={`${item.name}-${itemIndex}`} className="glass glass-card" style={{ padding: '1rem' }}>
                                    <span className="pc2-category">步骤 {itemIndex + 1}</span>
                                    <h3 className="pc2-title" style={{ margin: '0.35rem 0 0' }}>{item.name}</h3>
                                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                        {item.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.type === 'comparison' ? (
                        <div style={{ display: 'grid', gap: '0.9rem' }}>
                            {block.rows.map((row) => (
                                <div key={row.label} className="glass glass-card" style={{ padding: '1rem' }}>
                                    <h3 className="pc2-title" style={{ margin: 0 }}>{row.label}</h3>
                                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                        {row.summary}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.type === 'stats' ? (
                        <div style={{ display: 'grid', gap: '0.9rem' }}>
                            {block.items.map((item) => (
                                <div key={`${item.label}-${item.value}`} className="glass glass-card" style={{ padding: '1rem' }}>
                                    <h3 className="pc2-title" style={{ margin: 0 }}>{item.label}</h3>
                                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                        {item.value}
                                    </p>
                                    {item.sourceUrl ? (
                                        <a
                                            href={item.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ marginTop: '0.5rem', display: 'inline-block' }}
                                        >
                                            {item.sourceName || item.sourceUrl}
                                        </a>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </section>
            ))}

            <section className="home-section">
                <div className="section-bar">
                    <h2 className="section-title">精选提示词</h2>
                    <Link href="/prompts" className="section-more">
                        回到提示词库 →
                    </Link>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {selectedPrompts.items.map((prompt) => (
                        <Link
                            key={prompt.id}
                            href={`/prompts/${prompt.id}`}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="pc2-category">Prompt</span>
                                <h3 className="pc2-title" style={{ margin: 0 }}>{prompt.title}</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    {prompt.description || '暂无描述'}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
