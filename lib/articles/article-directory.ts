import fs from 'fs/promises';
import path from 'path';
import { MemoryCache } from '@/lib/utils/memory-cache';
import { loadArticleSourceConfigs } from './source-config';
import type {
    ArticleSourceCategory,
    ArticleSourceConfig,
    ArticleSourceManifest,
    ArticleSourceManifestArticle,
    ArticleSite,
} from './source-types';

export interface ArticleDirectoryEntry {
    id: string;
    site: ArticleSite;
    source: string;
    slug: string;
    title: string;
    summary: string;
    category: string;
    categoryName: string;
    author: string;
    originalUrl: string;
    sourcePlatform: string;
    type: string;
    assetBasePath: string;
    coverImagePath: string;
    coverUrl: string;
    contentPath: string;
    contentFilePath: string;
    publishedAt: string;
    updatedAt: string | null;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    tags?: string[];
}

export interface ArticleDirectorySnapshot {
    entries: ArticleDirectoryEntry[];
    categoriesBySite: Record<string, ArticleSourceCategory[]>;
}

const DIRECTORY_CACHE_KEY = 'github-article-directory';
const ARTICLE_DIRECTORY_TTL_MS = 5 * 60 * 1000;
const ARTICLE_CONTENT_TTL_MS = 30 * 60 * 1000;

const directoryCache = new MemoryCache<ArticleDirectorySnapshot>(ARTICLE_DIRECTORY_TTL_MS, 10);
const contentCache = new MemoryCache<string>(ARTICLE_CONTENT_TTL_MS, 200);

let lastGoodDirectorySnapshot: ArticleDirectorySnapshot | null = null;
const lastGoodContent = new Map<string, string>();
const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
    'ai-tech': 'AI技术',
    'ai-application': 'AI应用',
    'ai-business': 'AI商业',
    'ai-opinion': 'AI观点',
};

function buildAbsoluteSourcePath(config: ArticleSourceConfig, relativePath: string): string {
    return path.join(config.rootPath, relativePath.replace(/^\/+/, ''));
}

function resolveContentRelativePath(contentPath: string, relativePath: string): string {
    if (!relativePath || relativePath.startsWith('/')) {
        return relativePath.replace(/^\/+/, '');
    }

    if (relativePath.startsWith('articles/')) {
        return relativePath;
    }

    const contentSegments = contentPath.split('/');
    contentSegments.pop();
    const baseSegments = contentSegments.filter(Boolean);

    for (const part of relativePath.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            baseSegments.pop();
            continue;
        }
        baseSegments.push(part);
    }

    return baseSegments.join('/');
}

function toAssetRelativePath(contentPath: string, relativePath: string): string {
    const resolvedPath = resolveContentRelativePath(contentPath, relativePath);
    const articleDirectory = path.posix.dirname(contentPath);
    if (resolvedPath.startsWith(`${articleDirectory}/`)) {
        return resolvedPath.slice(articleDirectory.length + 1);
    }
    return resolvedPath;
}

export function buildArticleAssetUrl(
    site: string,
    slug: string,
    relativePath: string,
): string {
    const sanitizedPath = relativePath.replace(/^\/+/, '');
    return `/api/article-assets/${site}/${slug}/${sanitizedPath}`.replace(/\/+/g, '/');
}

function isValidPublishedArticle(article: ArticleSourceManifestArticle): boolean {
    return article.status === 'published';
}

function resolveCategoryName(categories: ArticleSourceCategory[] | undefined, code: string): string {
    return categories?.find((category) => category.code === code)?.name || code;
}

function deriveCategories(manifest: ArticleSourceManifest): ArticleSourceCategory[] {
    if (Array.isArray(manifest.categories) && manifest.categories.length > 0) {
        return manifest.categories;
    }

    return Array.from(new Set(
        manifest.articles
            .filter(isValidPublishedArticle)
            .map((article) => article.category)
            .filter(Boolean)
    )).map((code) => ({
        code,
        name: DEFAULT_CATEGORY_NAMES[code] || code,
    }));
}

function mapManifestArticle(
    config: ArticleSourceConfig,
    manifest: ArticleSourceManifest,
    article: ArticleSourceManifestArticle,
    categories: ArticleSourceCategory[],
): ArticleDirectoryEntry {
    const coverAssetPath = toAssetRelativePath(article.contentPath, article.coverImage);
    const assetBasePath = `/api/article-assets/${manifest.site}/${article.slug}`;

    return {
        id: article.id,
        site: manifest.site,
        source: manifest.source,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        category: article.category,
        categoryName: resolveCategoryName(categories, article.category),
        author: article.author,
        originalUrl: article.originalUrl,
        sourcePlatform: article.sourcePlatform,
        type: article.type,
        assetBasePath,
        coverImagePath: article.coverImage,
        coverUrl: buildArticleAssetUrl(manifest.site, article.slug, coverAssetPath),
        contentPath: article.contentPath,
        contentFilePath: buildAbsoluteSourcePath(config, article.contentPath),
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt ?? null,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        seoKeywords: article.seoKeywords,
        tags: article.tags,
    };
}

async function fetchSourceManifest(config: ArticleSourceConfig): Promise<ArticleSourceManifest> {
    const manifestFilePath = buildAbsoluteSourcePath(config, config.manifestPath);
    const manifest = JSON.parse(await fs.readFile(manifestFilePath, 'utf-8')) as ArticleSourceManifest;
    return manifest;
}

function sortEntriesNewestFirst(entries: ArticleDirectoryEntry[]): ArticleDirectoryEntry[] {
    return [...entries].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.publishedAt).getTime();
        const rightTime = new Date(right.updatedAt || right.publishedAt).getTime();
        return rightTime - leftTime;
    });
}

export async function fetchAggregatedArticleDirectory(options?: {
    forceRefresh?: boolean;
}): Promise<ArticleDirectorySnapshot> {
    if (!options?.forceRefresh) {
        const cached = directoryCache.get(DIRECTORY_CACHE_KEY);
        if (cached) return cached;
    }

    const configs = loadArticleSourceConfigs();
    if (configs.length === 0) {
        const emptySnapshot: ArticleDirectorySnapshot = { entries: [], categoriesBySite: {} };
        directoryCache.set(DIRECTORY_CACHE_KEY, emptySnapshot);
        lastGoodDirectorySnapshot = emptySnapshot;
        return emptySnapshot;
    }

    try {
        const manifests = await Promise.all(
            configs.map(async (config) => ({ config, manifest: await fetchSourceManifest(config) }))
        );

        const categoriesBySite: Record<string, ArticleSourceCategory[]> = {};
        const entries: ArticleDirectoryEntry[] = [];

        for (const { config, manifest } of manifests) {
            const categories = deriveCategories(manifest);
            categoriesBySite[manifest.site] = categories;

            for (const article of manifest.articles.filter(isValidPublishedArticle)) {
                entries.push(mapManifestArticle(config, manifest, article, categories));
            }
        }

        const snapshot: ArticleDirectorySnapshot = {
            entries: sortEntriesNewestFirst(entries),
            categoriesBySite,
        };

        directoryCache.set(DIRECTORY_CACHE_KEY, snapshot);
        lastGoodDirectorySnapshot = snapshot;
        return snapshot;
    } catch (error) {
        if (lastGoodDirectorySnapshot) {
            return lastGoodDirectorySnapshot;
        }
        throw error;
    }
}

export async function fetchArticleMarkdown(
    entry: Pick<ArticleDirectoryEntry, 'contentFilePath'>,
    options?: { forceRefresh?: boolean }
): Promise<string> {
    if (!options?.forceRefresh) {
        const cached = contentCache.get(entry.contentFilePath);
        if (cached) return cached;
    }

    try {
        const markdown = await fs.readFile(entry.contentFilePath, 'utf-8');
        contentCache.set(entry.contentFilePath, markdown);
        lastGoodContent.set(entry.contentFilePath, markdown);
        return markdown;
    } catch (error) {
        const fallback = lastGoodContent.get(entry.contentFilePath);
        if (fallback) return fallback;
        throw error;
    }
}

export async function getArticleDirectoryEntry(
    site: string,
    slug: string,
): Promise<ArticleDirectoryEntry | null> {
    const snapshot = await fetchAggregatedArticleDirectory();
    return snapshot.entries.find((entry) => entry.site === site && entry.slug === slug) || null;
}

export function resolveEntryAssetFilePath(entry: ArticleDirectoryEntry, relativePath: string): string {
    const articleDirectory = path.dirname(entry.contentFilePath);
    const normalizedPath = path.normalize(path.join(articleDirectory, relativePath));
    const normalizedArticleDirectory = path.normalize(articleDirectory);

    if (!normalizedPath.startsWith(`${normalizedArticleDirectory}${path.sep}`) && normalizedPath !== normalizedArticleDirectory) {
        throw new Error('Asset path escapes article directory');
    }

    return normalizedPath;
}

export function clearArticleDirectoryCache(): void {
    directoryCache.clear();
    contentCache.clear();
    lastGoodDirectorySnapshot = null;
    lastGoodContent.clear();
}
