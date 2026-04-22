export type ArticleSite = 'ai' | 'finance' | string;

export interface ArticleSourceConfig {
    site: ArticleSite;
    source: string;
    rootPath: string;
    manifestPath: string;
}

export type ArticleSourceStatus = 'draft' | 'published' | 'archived';

export interface ArticleSourceCategory {
    code: string;
    name: string;
}

export interface ArticleSourceManifestArticle {
    id: string;
    slug: string;
    title: string;
    summary: string;
    category: string;
    author: string;
    originalUrl: string;
    sourcePlatform: string;
    type: string;
    coverImage: string;
    contentPath: string;
    publishedAt: string;
    updatedAt?: string;
    status: ArticleSourceStatus;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    tags?: string[];
}

export interface ArticleSourceManifest {
    site: ArticleSite;
    source: string;
    updatedAt?: string;
    categories?: ArticleSourceCategory[];
    articles: ArticleSourceManifestArticle[];
}
