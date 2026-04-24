import Link from 'next/link';
import type { Metadata } from 'next';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { buildPromptsListMetadata } from '@/lib/seo/metadata';
import { getPromptScenarioPages } from '@/lib/seo/growth-pages';
import { buildCollectionPageJsonLd, JsonLdScript } from '@/lib/seo/schema';

const SCENARIO_INDEX_PATH = '/prompts/scenarios';

export const metadata: Metadata = buildPromptsListMetadata({
    title: '提示词场景库',
    description: '按真实提示词供给整理的场景化提示词入口。',
    canonicalPath: SCENARIO_INDEX_PATH,
});

export default function PromptScenarioIndexPage() {
    const scenarioPages = getPromptScenarioPages();
    const pageUrl = buildAbsoluteUrl(SCENARIO_INDEX_PATH);

    return (
        <div className="prompts-page">
            <JsonLdScript
                data={buildCollectionPageJsonLd(
                    '提示词场景库',
                    '按真实提示词供给整理的场景化提示词入口。',
                    pageUrl,
                )}
            />

            <header className="editorial-header">
                <div className="editorial-stats">
                    <span className="stat-badge">{scenarioPages.length} 个场景页</span>
                    <span className="stat-divider">·</span>
                    <span className="stat-badge">稳定场景入口</span>
                </div>
                <h1 className="editorial-headline">提示词场景库</h1>
                <p className="editorial-sub">
                    这些页面按真实提示词供给整理，不直接绑定单一分类命名，适合作为稳定入口继续浏览场景和精选模板。
                </p>
            </header>

            <section className="home-section">
                <div className="section-bar">
                    <h2 className="section-title">全部场景</h2>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {scenarioPages.map((page) => (
                        <Link
                            key={page.slug}
                            href={page.canonicalPath}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="pc2-category">场景页</span>
                                <h2 className="pc2-title" style={{ margin: 0 }}>{page.title}</h2>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    {page.description}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
