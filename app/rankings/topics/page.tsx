import Link from 'next/link';
import type { Metadata } from 'next';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { getRankingTopicPages } from '@/lib/seo/growth-pages';
import { buildRankingMetadata } from '@/lib/seo/metadata';
import {
    buildBreadcrumbJsonLd,
    buildCollectionPageJsonLd,
    JsonLdScript,
} from '@/lib/seo/schema';

export const metadata: Metadata = buildRankingMetadata({
    title: '热榜专题',
    description: '围绕 GitHub、ProductHunt 和 Skills 热榜衍生的专题页入口。',
    canonicalPath: '/rankings/topics',
});

const rankingEntries = [
    { href: '/rankings/github', icon: 'bi-github', accent: '#58a6ff', label: 'GitHub Trending' },
    { href: '/rankings/producthunt', icon: 'bi-rocket-takeoff', accent: '#ff6154', label: 'ProductHunt' },
    { href: '/rankings/skills-trending', icon: 'bi-fire', accent: '#f0883e', label: 'Skills Trending' },
    { href: '/rankings/skills-hot', icon: 'bi-lightning-charge', accent: '#a371f7', label: 'Skills Hot' },
];

export default function RankingTopicIndexPage() {
    const topicPages = getRankingTopicPages();
    const pageUrl = buildAbsoluteUrl('/rankings/topics');

    return (
        <div className="zone-producthunt">
            <JsonLdScript
                data={[
                    buildBreadcrumbJsonLd([
                        { name: '首页', url: buildAbsoluteUrl('/') },
                        { name: '排行榜', url: buildAbsoluteUrl('/rankings/github') },
                        { name: '热榜专题', url: pageUrl },
                    ]),
                    buildCollectionPageJsonLd(
                        '热榜专题',
                        '围绕 GitHub、ProductHunt 和 Skills 热榜衍生的专题页入口。',
                        pageUrl,
                    ),
                ]}
            />

            <div className="zone-header">
                <h1 className="zone-title zone-title-ph">
                    <i className="bi bi-journal-text" /> 热榜专题
                </h1>
                <p className="zone-subtitle">
                    从热榜数据进一步拆到可阅读、可追踪的话题页，方便按主题而不是按榜单来源浏览。
                </p>
            </div>

            <section style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h2 className="section-title">榜单入口</h2>
                    <p className="zone-subtitle">
                        先按榜单来源进入，再沿着对应主题页继续深挖。
                    </p>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {rankingEntries.map((entry) => (
                        <Link
                            key={entry.href}
                            href={entry.href}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                                <span className="pc2-category">Ranking</span>
                                <h3
                                    className="pc2-title"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', margin: 0 }}
                                >
                                    <i className={`bi ${entry.icon}`} style={{ color: entry.accent }} />
                                    <span>{entry.label}</span>
                                </h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    直接查看 {entry.label} 的最新热榜，并从对应榜单回流到更细的话题专题。
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                }}
            >
                {topicPages.map((page) => (
                    <Link
                        key={page.slug}
                        href={page.canonicalPath}
                        className="glass glass-card"
                        style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                    >
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <span className="pc2-category">Topic</span>
                            <h2 className="pc2-title" style={{ margin: 0 }}>{page.title}</h2>
                            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                {page.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
