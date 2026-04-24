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
