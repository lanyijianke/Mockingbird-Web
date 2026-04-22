import { getArticleSitemapEntries } from '@/lib/services/article-service';
import { getPromptSitemapEntries } from '@/lib/services/prompt-service';

export interface SitemapUrlEntry {
    url: string;
    lastModified: string;
    changeFrequency?: 'daily' | 'weekly' | 'monthly';
    priority?: number;
}

const BASE_URL = process.env.SITE_URL || 'https://aigcclub.com.cn';
const DEFAULT_CHUNK_SIZE = 5000;

export function getSitemapChunkSize(): number {
    const raw = Number.parseInt(process.env.SITEMAP_CHUNK_SIZE || '', 10);
    if (Number.isNaN(raw) || raw <= 0) return DEFAULT_CHUNK_SIZE;
    return Math.min(raw, 50000);
}

function toIsoOrFallback(value: string | null | undefined, fallbackIso: string): string {
    if (!value) return fallbackIso;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallbackIso : parsed.toISOString();
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

function buildStaticSitemapEntries(now: string): SitemapUrlEntry[] {
    return [
        { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
        { url: `${BASE_URL}/ai/articles`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        { url: `${BASE_URL}/finance/articles`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        { url: `${BASE_URL}/prompts`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        { url: `${BASE_URL}/rankings/github`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
        { url: `${BASE_URL}/rankings/producthunt`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
        { url: `${BASE_URL}/rankings/skills-trending`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
        { url: `${BASE_URL}/rankings/skills-hot`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    ];
}

export async function listSitemapChunkNames(): Promise<string[]> {
    const [articles, prompts] = await Promise.all([
        getArticleSitemapEntries(),
        getPromptSitemapEntries(),
    ]);

    const chunkSize = getSitemapChunkSize();
    const articleChunks = chunkArray(articles, chunkSize).length;
    const promptChunks = chunkArray(prompts, chunkSize).length;

    const names = ['static'];
    for (let i = 1; i <= articleChunks; i += 1) names.push(`articles-${i}`);
    for (let i = 1; i <= promptChunks; i += 1) names.push(`prompts-${i}`);

    return names;
}

export async function buildSitemapIndexUrls(): Promise<string[]> {
    const names = await listSitemapChunkNames();
    return names.map((name) => `${BASE_URL}/sitemaps/${name}.xml`);
}

export async function buildSitemapChunkEntries(chunkName: string): Promise<SitemapUrlEntry[] | null> {
    const now = new Date().toISOString();

    if (chunkName === 'static') {
        return buildStaticSitemapEntries(now);
    }

    const articleMatch = /^articles-(\d+)$/.exec(chunkName);
    if (articleMatch) {
        const index = Number.parseInt(articleMatch[1], 10) - 1;
        const articles = await getArticleSitemapEntries();
        const chunks = chunkArray(articles, getSitemapChunkSize());
        if (index < 0 || index >= chunks.length) return null;

        return chunks[index].map((article) => ({
            url: `${BASE_URL}${article.path}`,
            lastModified: toIsoOrFallback(article.lastModified, now),
            changeFrequency: 'weekly',
            priority: 0.7,
        }));
    }

    const promptMatch = /^prompts-(\d+)$/.exec(chunkName);
    if (promptMatch) {
        const index = Number.parseInt(promptMatch[1], 10) - 1;
        const prompts = await getPromptSitemapEntries();
        const chunks = chunkArray(prompts, getSitemapChunkSize());
        if (index < 0 || index >= chunks.length) return null;

        return chunks[index].map((prompt) => ({
            url: `${BASE_URL}/prompts/${prompt.id}`,
            lastModified: toIsoOrFallback(prompt.lastModified, now),
            changeFrequency: 'weekly',
            priority: 0.6,
        }));
    }

    return null;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function renderSitemapIndexXml(urls: string[]): string {
    const body = urls.map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function renderSitemapUrlSetXml(entries: SitemapUrlEntry[]): string {
    const body = entries
        .map((entry) => {
            const freq = entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : '';
            const priority = typeof entry.priority === 'number' ? `<priority>${entry.priority.toFixed(1)}</priority>` : '';
            return `<url><loc>${escapeXml(entry.url)}</loc><lastmod>${escapeXml(entry.lastModified)}</lastmod>${freq}${priority}</url>`;
        })
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}
