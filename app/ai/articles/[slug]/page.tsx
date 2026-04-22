import { notFound } from 'next/navigation';
import { getArticleBySlug, getAllSlugs, getRelatedArticles } from '@/lib/services/article-service';
import { getArticleDetailPath, getArticleListPath } from '@/lib/articles/article-route-paths';
import type { Metadata } from 'next';
import { buildArticleJsonLd, buildBreadcrumbJsonLd, JsonLdScript } from '@/lib/utils/json-ld';
import ArticleReaderClient from '@/app/articles/[slug]/ArticleReaderClient';
import '@/app/articles/[slug]/article-reader.css';

const SITE_URL = process.env.SITE_URL || 'https://aigcclub.com.cn';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function generateStaticParams() {
    const slugs = await getAllSlugs('ai');
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = await getArticleBySlug(slug, { site: 'ai' });
    if (!article) return { title: '文章未找到' };

    const canonicalPath = getArticleDetailPath('ai', slug);

    return {
        title: article.seoTitle || article.title,
        description: article.seoDescription || article.summary,
        keywords: article.seoKeywords || undefined,
        alternates: { canonical: canonicalPath },
        openGraph: {
            title: article.title,
            description: article.summary || undefined,
            type: 'article',
            url: `${SITE_URL}${canonicalPath}`,
            images: article.coverUrl ? [article.coverUrl] : undefined,
            publishedTime: article.createdAt,
            modifiedTime: article.updatedAt || undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.summary || undefined,
            images: article.coverUrl ? [article.coverUrl] : undefined,
        },
    };
}

interface TocItem {
    id: string;
    text: string;
    level: number;
}

function extractToc(markdown: string): TocItem[] {
    const headingRegex = /^(#{1,5})\s+(.+)$/gm;
    const toc: TocItem[] = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(markdown)) !== null) {
        const level = match[1].length;
        const text = match[2]
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            .trim();
        const id = text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        if (text && id) {
            toc.push({ id, text, level });
        }
    }
    return toc;
}

function estimateReadingMinutes(content: string): number {
    const plain = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[#*\[\]()\>|_~`\-!]/g, '')
        .replace(/\s+/g, '');
    return Math.max(1, Math.ceil(plain.length / 600));
}

export default async function AiArticleDetailPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const article = await getArticleBySlug(slug, { site: 'ai' });
    if (!article) notFound();

    const content = article.content || '';
    const toc = extractToc(content);
    const readingMinutes = estimateReadingMinutes(content);
    const relatedArticles = await getRelatedArticles(article.category, slug, 6, { site: 'ai' });

    const dateStr = new Date(article.createdAt).toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkGfm = (await import('remark-gfm')).default;
    const remarkRehype = (await import('remark-rehype')).default;
    const rehypeSlug = (await import('rehype-slug')).default;
    const rehypeHighlight = (await import('rehype-highlight')).default;
    const rehypeStringify = (await import('rehype-stringify')).default;

    const result = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeSlug)
        .use(rehypeHighlight, { detect: true, ignoreMissing: true })
        .use(rehypeStringify)
        .process(content);

    const renderedHtml = String(result).replace(/<img /g, '<img loading="lazy" ');
    const articleUrl = `${SITE_URL}${getArticleDetailPath('ai', slug)}`;

    return (
        <>
            <JsonLdScript data={[
                buildArticleJsonLd({
                    title: article.title,
                    summary: article.summary,
                    url: articleUrl,
                    coverUrl: article.coverUrl,
                    createdAt: article.createdAt,
                    updatedAt: article.updatedAt,
                    category: article.category,
                }),
                buildBreadcrumbJsonLd([
                    { name: '首页', url: SITE_URL },
                    { name: 'AI 文章', url: `${SITE_URL}${getArticleListPath('ai')}` },
                    { name: article.title, url: articleUrl },
                ]),
            ]} />

            <ArticleReaderClient
                renderedHtml={renderedHtml}
                toc={toc}
                title={article.title}
                categoryName={article.categoryName}
                dateStr={dateStr}
                readingMinutes={readingMinutes}
                summary={article.summary ?? ''}
                articleUrl={articleUrl}
                backHref={getArticleListPath('ai')}
                relatedArticles={relatedArticles.map((item) => ({
                    href: getArticleDetailPath('ai', item.slug),
                    slug: item.slug,
                    title: item.title,
                    coverUrl: item.coverUrl,
                    category: item.categoryName,
                    summary: item.summary,
                }))}
            />
        </>
    );
}
