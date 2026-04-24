import { notFound } from 'next/navigation';
import { getCategoryName } from '@/lib/categories';
import type { Metadata } from 'next';
import { getSiteSeoConfig } from '@/lib/seo/config';
import { buildPromptDetailMetadata } from '@/lib/seo/metadata';
import { buildPromptInternalLinkGroup, buildRankingInternalLinkGroup } from '@/lib/seo/internal-links';
import { buildBreadcrumbJsonLd, buildPromptJsonLd, JsonLdScript } from '@/lib/seo/schema';
import PromptDetailClient from './PromptDetailClient';
import { safeJsonParse } from '../safeJsonParse';
import './prompt-detail.css';

const SITE_URL = getSiteSeoConfig().siteUrl;

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function generateStaticParams() {
    const { getAllPromptIds } = await import('@/lib/services/prompt-service');
    const ids = await getAllPromptIds();
    // 只预生成最新 100 个，其余按需生成
    return ids.slice(0, 100).map((id) => ({ id: String(id) }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { getPromptById } = await import('@/lib/services/prompt-service');
    const { id } = await params;
    const prompt = await getPromptById(parseInt(id, 10));
    if (!prompt) return { title: '提示词未找到' };

    return buildPromptDetailMetadata({
        id,
        title: prompt.title,
        description: prompt.description,
        content: prompt.content,
        coverImageUrl: prompt.coverImageUrl,
    });
}

export default async function PromptDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { getPromptById, getRelatedPrompts } = await import('@/lib/services/prompt-service');
    const { id } = await params;
    const prompt = await getPromptById(parseInt(id, 10));
    if (!prompt) notFound();

    // 获取同分类推荐提示词
    const relatedPrompts = await getRelatedPrompts(prompt.category, prompt.id, 6);

    // 解析图片 JSON
    let images: string[] = [];
    if (prompt.imagesJson) {
        images = safeJsonParse<string[]>(prompt.imagesJson, []);
    }

    // 检测是否为 JSON 内容
    const isJson = prompt.content.trim().startsWith('{') || prompt.content.trim().startsWith('[');

    const dateStr = new Date(prompt.createdAt).toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const promptLinks = buildPromptInternalLinkGroup({
        categorySlug: prompt.category,
        categoryLabel: getCategoryName(prompt.category),
        promptId: prompt.id,
        promptTitle: prompt.title,
    });
    const rankingLinks = buildRankingInternalLinkGroup();
    const promptDescription = prompt.description || prompt.content.slice(0, 160);
    const promptListCategoryHref = `/prompts?category=${encodeURIComponent(prompt.category)}`;
    const explorationLinks = [
        {
            href: promptListCategoryHref,
            title: promptLinks.links[1].label,
            description: `回到提示词列表并按 ${getCategoryName(prompt.category)} 筛选，继续浏览同类模板。`,
        },
        {
            href: '/ai/articles/categories/prompts',
            title: '提示词相关文章',
            description: '从提示词分类延伸到配套教程、最佳实践和案例分析。',
        },
        {
            href: rankingLinks.links[1].href,
            title: rankingLinks.links[1].label,
            description: '观察正在增长的 AI 产品，再反向寻找适合它们的提示词玩法。',
        },
    ];

    return (
        <>
            {/* SEO: BreadcrumbList JSON-LD */}
            <JsonLdScript data={[
                buildPromptJsonLd({
                    id: prompt.id,
                    title: prompt.title,
                    description: promptDescription,
                    content: prompt.content,
                    url: `${SITE_URL}/prompts/${id}`,
                    coverImageUrl: prompt.coverImageUrl,
                    category: getCategoryName(prompt.category),
                    createdAt: prompt.createdAt,
                    updatedAt: prompt.updatedAt,
                }),
                buildBreadcrumbJsonLd([
                    { name: '首页', url: SITE_URL },
                    { name: '提示词', url: `${SITE_URL}/prompts` },
                    { name: prompt.title, url: `${SITE_URL}/prompts/${id}` },
                ]),
            ]} />

            <PromptDetailClient
                images={images}
                content={prompt.content}
                videoUrl={prompt.videoPreviewUrl}
                title={prompt.title}
                categoryName={getCategoryName(prompt.category)}
                description={prompt.description || ''}
                author={prompt.author || ''}
                copyCount={prompt.copyCount}
                dateStr={dateStr}
                sourceUrl={prompt.sourceUrl}
                isJson={isJson}
                relatedPrompts={relatedPrompts.map(p => ({
                    id: p.id,
                    title: p.title,
                    coverImageUrl: p.coverImageUrl,
                    category: getCategoryName(p.category),
                    copyCount: p.copyCount,
                }))}
                explorationLinks={explorationLinks}
            />
        </>
    );
}
