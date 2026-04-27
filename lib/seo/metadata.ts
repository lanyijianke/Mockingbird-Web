import type { Metadata } from 'next';
import { buildAbsoluteUrl, getDefaultIndexability, getSiteSeoConfig } from '@/lib/seo/config';

interface ListMetadataInput {
    title: string;
    description: string;
    canonicalPath: string;
    searchQuery?: string;
}

interface ArticleDetailMetadataInput {
    title: string;
    description?: string | null;
    canonicalPath: string;
    coverImageUrl?: string | null;
    createdAt?: string;
    updatedAt?: string | null;
    keywords?: string | string[];
}

interface PromptDetailMetadataInput {
    id: number | string;
    title: string;
    description?: string | null;
    content?: string | null;
    coverImageUrl?: string | null;
}

interface RankingMetadataInput {
    title: string;
    description: string;
    canonicalPath: string;
}

interface CategoryLandingMetadataInput {
    categoryName: string;
    canonicalPath: string;
    title?: string;
    description?: string;
    keywords?: string | string[];
}

function buildIndexableRobots(): NonNullable<Metadata['robots']> {
    const { canIndex } = getSiteSeoConfig();

    if (!canIndex) {
        return {
            index: false,
            follow: false,
            googleBot: {
                index: false,
                follow: false,
                'max-image-preview': 'none',
                'max-snippet': 0,
            },
        };
    }

    return {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    };
}

function buildSearchRobots(): NonNullable<Metadata['robots']> {
    return {
        index: false,
        follow: true,
        googleBot: {
            index: false,
            follow: true,
        },
    };
}

function resolveRobots(robots: Metadata['robots'] | undefined): Metadata['robots'] | undefined {
    const indexability = getDefaultIndexability();

    if (!indexability.index) {
        return buildIndexableRobots();
    }

    return robots;
}

function buildWebsiteMetadata(input: {
    title: string;
    description?: string;
    canonicalPath: string;
    openGraphType?: 'website' | 'article';
    images?: string[];
    publishedTime?: string;
    modifiedTime?: string;
    keywords?: string | string[];
    robots?: Metadata['robots'];
}): Metadata {
    const config = getSiteSeoConfig();
    const absoluteUrl = buildAbsoluteUrl(input.canonicalPath);

    return {
        title: input.title,
        description: input.description,
        keywords: input.keywords,
        alternates: {
            canonical: input.canonicalPath,
        },
        robots: resolveRobots(input.robots),
        openGraph: {
            siteName: config.openGraph.siteName,
            locale: config.openGraph.locale,
            type: input.openGraphType || config.openGraph.type,
            title: input.title,
            description: input.description,
            url: absoluteUrl,
            images: input.images,
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
        },
        twitter: {
            card: config.twitter.card,
            title: input.title,
            description: input.description,
            images: input.images,
        },
    };
}

export function buildRootMetadata(): Metadata {
    const config = getSiteSeoConfig();

    return {
        metadataBase: new URL(buildAbsoluteUrl('/')),
        title: {
            default: config.defaultTitle,
            template: config.titleTemplate,
        },
        description: config.defaultDescription,
        openGraph: {
            siteName: config.openGraph.siteName,
            locale: config.openGraph.locale,
            type: config.openGraph.type,
            url: buildAbsoluteUrl('/'),
            title: config.homeTitle,
            description: config.homeDescription,
        },
        twitter: {
            card: config.twitter.card,
            title: config.siteName,
            description: config.homeDescription,
        },
        alternates: {
            canonical: '/',
        },
        robots: buildIndexableRobots(),
    };
}

export function buildHomePageMetadata(): Metadata {
    const config = getSiteSeoConfig();

    return buildWebsiteMetadata({
        title: config.homeTitle,
        description: config.homeDescription,
        canonicalPath: '/',
        robots: buildIndexableRobots(),
    });
}

export function buildArticlesListMetadata(input: ListMetadataInput): Metadata {
    return buildWebsiteMetadata({
        title: input.title,
        description: input.description,
        canonicalPath: input.canonicalPath,
        robots: input.searchQuery ? buildSearchRobots() : undefined,
    });
}

export function buildPromptsListMetadata(input: ListMetadataInput): Metadata {
    return buildWebsiteMetadata({
        title: input.title,
        description: input.description,
        canonicalPath: input.canonicalPath,
        robots: input.searchQuery ? buildSearchRobots() : undefined,
    });
}

export function buildArticleDetailMetadata(input: ArticleDetailMetadataInput): Metadata {
    return buildWebsiteMetadata({
        title: input.title,
        description: input.description || undefined,
        canonicalPath: input.canonicalPath,
        openGraphType: 'article',
        images: input.coverImageUrl ? [input.coverImageUrl] : undefined,
        publishedTime: input.createdAt,
        modifiedTime: input.updatedAt || undefined,
        keywords: input.keywords,
    });
}

export function buildPromptDetailMetadata(input: PromptDetailMetadataInput): Metadata {
    const canonicalPath = `/prompts/${input.id}`;
    const description = input.description || input.content?.slice(0, 160) || undefined;

    return buildWebsiteMetadata({
        title: `${input.title} — 提示词`,
        description: description || '提示词详情',
        canonicalPath,
        openGraphType: 'article',
        images: input.coverImageUrl ? [input.coverImageUrl] : undefined,
    });
}

export function buildRankingsLayoutMetadata(): Metadata {
    const { siteName } = getSiteSeoConfig();

    return {
        title: `排行榜 — ${siteName}`,
        description: '查看 GitHub Trending、ProductHunt 热榜、Skills.sh 排行',
    };
}

export function buildRankingMetadata(input: RankingMetadataInput): Metadata {
    return buildWebsiteMetadata({
        title: input.title,
        description: input.description,
        canonicalPath: input.canonicalPath,
    });
}

function buildCategoryLandingMetadata(input: {
    categoryName: string;
    canonicalPath: string;
    title: string;
    description: string;
    keywords: string[];
}): Metadata {
    return buildWebsiteMetadata({
        title: input.title,
        description: input.description,
        canonicalPath: input.canonicalPath,
        keywords: input.keywords,
    });
}

export function buildArticleCategoryLandingMetadata(input: CategoryLandingMetadataInput): Metadata {
    const { siteName } = getSiteSeoConfig();
    const title = input.title || `${input.categoryName}文章 - ${siteName}`;
    const description = input.description || `聚合${siteName}内与 ${input.categoryName} 相关的精选文章、教程与实践案例。`;
    const keywords = Array.isArray(input.keywords)
        ? input.keywords
        : input.keywords
            ? [input.keywords]
            : [input.categoryName, `${input.categoryName}文章`, 'AI 教程', 'AI 实践'];

    return buildCategoryLandingMetadata({
        categoryName: input.categoryName,
        canonicalPath: input.canonicalPath,
        title,
        description,
        keywords,
    });
}

export function buildPromptCategoryLandingMetadata(input: CategoryLandingMetadataInput): Metadata {
    const { siteName } = getSiteSeoConfig();
    const title = input.title || `${input.categoryName}提示词 - ${siteName}`;
    const description = input.description || `探索${siteName}内与 ${input.categoryName} 相关的高质量提示词、示例与创作灵感。`;
    const keywords = Array.isArray(input.keywords)
        ? input.keywords
        : input.keywords
            ? [input.keywords]
            : [input.categoryName, `${input.categoryName}提示词`, 'AI 提示词', '提示词模板'];

    return buildCategoryLandingMetadata({
        categoryName: input.categoryName,
        canonicalPath: input.canonicalPath,
        title,
        description,
        keywords,
    });
}
