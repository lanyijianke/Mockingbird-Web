// ════════════════════════════════════════════════════════════════
// JSON-LD 结构化数据工具库
// 依据: Google Search Central — Structured Data
// https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
// ════════════════════════════════════════════════════════════════

const BASE_URL = process.env.SITE_URL || 'https://aigcclub.com.cn';

export interface JsonLdListItemInput {
    name: string;
    url?: string | null;
}

// ── WebSite Schema (嵌入全局 layout) ─────────────────────────
export function buildWebSiteJsonLd(): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '知更鸟知识库',
        alternateName: 'Mockingbird Knowledge',
        url: BASE_URL,
        description: '提供专业的 AI 教程、AI 实践案例、AI 提示词精选及 AI 工具大全。致力于打造全网最全的泛 AI 知识矩阵。',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${BASE_URL}/ai/articles?q={search_term_string}`,
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
        url: BASE_URL,
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
            url: BASE_URL,
        },
    };
}

// ── Article Schema (文章详情页) ───────────────────────────────
// https://developers.google.com/search/docs/appearance/structured-data/article
export interface ArticleJsonLdInput {
    title: string;
    summary?: string | null;
    url: string;
    coverUrl?: string | null;
    createdAt: string;
    updatedAt?: string | null;
    category?: string;
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
            url: BASE_URL,
        },
        publisher: {
            '@type': 'Organization',
            name: '知更鸟知识库',
            url: BASE_URL,
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': article.url,
        },
    };
}

// ── BreadcrumbList Schema ────────────────────────────────────
export interface BreadcrumbItem {
    name: string;
    url?: string;
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

// ── CollectionPage Schema (列表页 / 排行榜) ─────────────────
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
            url: BASE_URL,
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

// ── 渲染 JSON-LD <script> 标签的 React 组件工具 ─────────────
export function serializeJsonLd(data: object | object[]): string {
    const json = JSON.stringify(
        Array.isArray(data) ? data : data,
        null,
        0,
    );

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
