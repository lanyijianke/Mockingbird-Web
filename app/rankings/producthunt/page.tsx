import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildAbsoluteUrl } from '@/lib/seo/config';
import { buildRankingMetadata } from '@/lib/seo/metadata';
import { getProductHuntRankings } from '@/lib/services/ranking-cache';
import { buildCollectionPageJsonLd, buildItemListJsonLd, JsonLdScript } from '@/lib/seo/schema';

export const metadata: Metadata = buildRankingMetadata({
    title: 'ProductHunt 每日热榜 — 排行榜',
    description: '聚合 ProductHunt 全球最热门的新产品与工具，每 2 小时自动更新。',
    canonicalPath: '/rankings/producthunt',
});

export const revalidate = 600;
const PAGE_URL = buildAbsoluteUrl('/rankings/producthunt');
const INTERNAL_LINKS = [
    {
        href: '/rankings/github',
        title: '查看 GitHub Trending',
        description: '把新产品热度和开源项目趋势放在一起，对比产品化与开发者生态的变化。',
    },
    {
        href: '/prompts/categories/gemini-3',
        title: 'Gemini 3 提示词分类',
        description: '从热榜产品延伸到具体可复用的提示词模板，更快进入实操阶段。',
    },
    {
        href: '/ai/articles/categories/agents',
        title: '智能体文章分类',
        description: '从热榜产品回流到系统化内容页，补充背景、方法论和案例。',
    },
];

function sanitizeExternalUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
        return null;
    }
}

export default async function ProductHuntPage() {
    const rankings = await getProductHuntRankings();
    const itemList = rankings.map((item) => ({
        name: item.title,
        url: sanitizeExternalUrl(item.productUrl),
    }));

    return (
        <div className="zone-producthunt">
            <JsonLdScript data={[
                buildCollectionPageJsonLd('ProductHunt 每日热榜', '聚合 ProductHunt 全球最热门的新产品与工具。', PAGE_URL),
                buildItemListJsonLd('ProductHunt 每日热榜', '聚合 ProductHunt 全球最热门的新产品与工具。', PAGE_URL, itemList),
            ]} />
            <div className="zone-header">
                <h1 className="zone-title zone-title-ph">
                    <i className="bi bi-rocket-takeoff" /> ProductHunt 每日热榜
                </h1>
                <p className="zone-subtitle">
                    聚合 ProductHunt 全球最热门的新产品与工具，每 2 小时自动更新。
                </p>
            </div>

            {rankings.length > 0 ? (
                <div className="ph-grid">
                    {rankings.map((item, index) => (
                        <div key={item.id} className="ph-card">
                            <div className={`rank-badge ${index < 3 ? 'rank-top rank-ph' : ''}`}>
                                #{index + 1}
                            </div>
                            <div className="ph-card-body">
                                <div className="ph-header">
                                    {item.thumbnailUrl ? (
                                        <Image src={item.thumbnailUrl} alt={item.title} width={48} height={48} className="ph-thumb" style={{ objectFit: 'cover' }} loading="lazy" unoptimized referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="ph-thumb-placeholder">
                                            <i className="bi bi-box-seam" />
                                        </div>
                                    )}
                                    <div className="ph-title-group">
                                        <h3 className="product-title">{item.title}</h3>
                                        <p className="ph-tagline">{item.tagline || '暂无描述'}</p>
                                    </div>
                                </div>
                                <div className="card-footer">
                                    <div className="ph-votes">
                                        <i className="bi bi-caret-up-fill" />
                                        <span className="score-value">{item.votesCount}</span>
                                        <span className="score-label">VOTES</span>
                                    </div>
                                    {(() => {
                                        const safeProductUrl = sanitizeExternalUrl(item.productUrl);
                                        if (!safeProductUrl) {
                                            return <span className="btn-visit btn-visit-ph">链接无效</span>;
                                        }
                                        return (
                                            <a href={safeProductUrl} target="_blank" rel="noopener noreferrer" className="btn-visit btn-visit-ph">
                                                查看产品 <i className="bi bi-box-arrow-up-right" />
                                            </a>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <i className="bi bi-cloud-slash" />
                    <p>暂无热榜数据，请稍后再试。</p>
                </div>
            )}

            <section className="home-section" style={{ marginTop: '3rem' }}>
                <div className="section-bar">
                    <h2 className="section-title">热榜解读与延伸探索</h2>
                </div>
                <p className="zone-subtitle" style={{ marginBottom: '1.25rem' }}>
                    ProductHunt 适合捕捉新产品发布节奏，继续结合开源趋势、技能热度和提示词库，可以更快判断哪些方向值得深入。
                </p>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {INTERNAL_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="glass glass-card"
                            style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="pc2-category">继续探索</span>
                                <h3 className="pc2-title" style={{ margin: 0 }}>{link.title}</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    {link.description}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
