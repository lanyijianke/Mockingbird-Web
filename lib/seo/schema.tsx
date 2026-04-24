import { buildAbsoluteUrl, getSiteSeoConfig } from '@/lib/seo/config';

export interface JsonLdListItemInput {
    name: string;
    url?: string | null;
}

export interface ArticleJsonLdInput {
    title: string;
    summary?: string | null;
    url: string;
    coverUrl?: string | null;
    createdAt: string;
    updatedAt?: string | null;
    category?: string;
}

export interface PromptObjectJsonLdInput {
    id: number | string;
    title: string;
    description?: string | null;
    content?: string | null;
    url?: string;
    coverImageUrl?: string | null;
    category?: string | null;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string | null;
}

export interface BreadcrumbItem {
    name: string;
    url?: string;
}

export interface FaqJsonLdInput {
    question: string;
    answer: string;
}

export interface HowToStepInput {
    name: string;
    text: string;
}

function getBaseUrl(): string {
    return getSiteSeoConfig().siteUrl;
}

export function buildWebSiteJsonLd(): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '知更鸟知识库',
        alternateName: 'Mockingbird Knowledge',
        url: getBaseUrl(),
        description: '提供专业的 AI 教程、AI 实践案例、AI 提示词精选及 AI 工具大全。致力于打造全网最全的泛 AI 知识矩阵。',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: buildAbsoluteUrl('/ai/articles?q={search_term_string}'),
            },
            'query-input': 'required name=search_term_string',
        },
    };
}

export function buildOrganizationJsonLd(): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '知更鸟知识库',
        alternateName: 'Mockingbird Knowledge',
        url: getBaseUrl(),
    };
}

export function buildWebPageJsonLd(
    name: string,
    description: string,
    url: string,
): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name,
        description,
        url,
        isPartOf: {
            '@type': 'WebSite',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
    };
}

export function buildArticleJsonLd(article: ArticleJsonLdInput): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.summary || undefined,
        url: article.url,
        image: article.coverUrl || undefined,
        datePublished: article.createdAt,
        dateModified: article.updatedAt || article.createdAt,
        author: {
            '@type': 'Organization',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
        publisher: {
            '@type': 'Organization',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': article.url,
        },
    };
}

export function buildPromptObjectJsonLd(prompt: PromptObjectJsonLdInput): object {
    const url = prompt.url || buildAbsoluteUrl(`/prompts/${prompt.id}`);

    return {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: prompt.title,
        description: prompt.description || undefined,
        url,
        image: prompt.coverImageUrl || undefined,
        text: prompt.content || undefined,
        genre: prompt.category || undefined,
        keywords: prompt.tags?.length ? prompt.tags : undefined,
        dateCreated: prompt.createdAt || undefined,
        dateModified: prompt.updatedAt || prompt.createdAt || undefined,
        inLanguage: 'zh-CN',
        author: {
            '@type': 'Organization',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
        isPartOf: {
            '@type': 'WebSite',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
        publisher: {
            '@type': 'Organization',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': url,
        },
    };
}

export function buildPromptJsonLd(prompt: PromptObjectJsonLdInput): object {
    return buildPromptObjectJsonLd(prompt);
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url || undefined,
        })),
    };
}

export function buildCollectionPageJsonLd(
    name: string,
    description: string,
    url: string,
): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        description,
        url,
        isPartOf: {
            '@type': 'WebSite',
            name: '知更鸟知识库',
            url: getBaseUrl(),
        },
    };
}

export function buildItemListJsonLd(
    name: string,
    description: string,
    url: string,
    items: JsonLdListItemInput[],
): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        description,
        url,
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: item.url || undefined,
        })),
    };
}

export function buildFaqPageJsonLd(items: FaqJsonLdInput[]): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };
}

export function buildHowToJsonLd(
    name: string,
    description: string,
    url: string,
    steps: HowToStepInput[],
): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name,
        description,
        url,
        step: steps.map((step) => ({
            '@type': 'HowToStep',
            name: step.name,
            text: step.text,
        })),
    };
}

export function serializeJsonLd(data: object | object[]): string {
    const json = JSON.stringify(Array.isArray(data) ? data : data, null, 0);

    return json
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

export function JsonLdScript({ data }: { data: object | object[] }) {
    const jsonString = serializeJsonLd(data);

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonString }}
        />
    );
}
