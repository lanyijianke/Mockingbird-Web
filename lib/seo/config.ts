export interface SiteSeoConfig {
    siteUrl: string;
    siteName: string;
    locale: string;
    defaultTitle: string;
    titleTemplate: string;
    defaultDescription: string;
    canIndex: boolean;
    openGraph: {
        siteName: string;
        locale: string;
        type: 'website';
    };
    twitter: {
        card: 'summary_large_image';
    };
}

const DEFAULT_SITE_URL = 'http://localhost:5046';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;

    return fallback;
}

function normalizeSiteUrl(value: string | undefined): string {
    const input = value?.trim() || DEFAULT_SITE_URL;
    const normalized = new URL(input);

    normalized.pathname = '/';
    normalized.search = '';
    normalized.hash = '';

    return normalized.toString().replace(/\/$/, '');
}

export function getSiteSeoConfig(): SiteSeoConfig {
    const siteUrl = normalizeSiteUrl(process.env.SITE_URL);

    return {
        siteUrl,
        siteName: '知更鸟知识库',
        locale: 'zh_CN',
        defaultTitle: '知更鸟知识库 - AI 教程 | AI 实践 | AI 提示词 | AI 工具',
        titleTemplate: '%s - 知更鸟知识库',
        defaultDescription: '知更鸟知识库：提供专业的 AI 教程、AI 实践案例、AI 提示词精选及 AI 工具大全。致力于打造全网最全的泛 AI 知识矩阵。',
        canIndex: parseBoolean(process.env.SEO_CAN_INDEX, false),
        openGraph: {
            siteName: '知更鸟知识库',
            locale: 'zh_CN',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
        },
    };
}

export function getDefaultIndexability(): { index: boolean; follow: boolean } {
    return getSiteSeoConfig().canIndex
        ? { index: true, follow: true }
        : { index: false, follow: false };
}

export function buildAbsoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//.test(pathOrUrl)) {
        return pathOrUrl;
    }

    return new URL(pathOrUrl, `${getSiteSeoConfig().siteUrl}/`).toString();
}
