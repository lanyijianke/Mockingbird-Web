import { getSiteBrandConfig } from '@/lib/site-config';

export interface SiteSeoConfig {
    siteUrl: string;
    brandName: string;
    siteName: string;
    alternateName: string;
    icpNumber: string;
    icpUrl: string;
    homeTitle: string;
    homeDescription: string;
    serviceName: string;
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
    const brand = getSiteBrandConfig();

    return {
        siteUrl,
        brandName: brand.brandName,
        siteName: brand.siteName,
        alternateName: brand.alternateName,
        icpNumber: brand.icpNumber,
        icpUrl: brand.icpUrl,
        homeTitle: brand.homeTitle,
        homeDescription: brand.homeDescription,
        serviceName: brand.serviceName,
        locale: 'zh_CN',
        defaultTitle: `${brand.siteName} - AI 教程 | AI 实践 | AI 提示词 | AI 工具`,
        titleTemplate: `%s - ${brand.siteName}`,
        defaultDescription: brand.defaultDescription,
        canIndex: parseBoolean(process.env.SEO_CAN_INDEX, false),
        openGraph: {
            siteName: brand.siteName,
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
