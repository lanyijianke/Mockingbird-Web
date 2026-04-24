import type { MetadataRoute } from 'next';
import { buildAbsoluteUrl, getSiteSeoConfig } from '@/lib/seo/config';

// ════════════════════════════════════════════════════════════════
// robots.txt — 搜索引擎爬虫控制
// https://developers.google.com/search/docs/crawling-indexing/robots/intro
// ════════════════════════════════════════════════════════════════

const BLOCK_BAIDU = (process.env.ROBOTS_BLOCK_BAIDU || 'false').toLowerCase() === 'true';

export default function robots(): MetadataRoute.Robots {
    const config = getSiteSeoConfig();

    if (!config.canIndex) {
        return {
            rules: [
                {
                    userAgent: '*',
                    disallow: '/',
                },
            ],
        };
    }

    const rules: MetadataRoute.Robots['rules'] = [
        {
            // 默认爬虫策略：允许全站，禁爬 API
            userAgent: '*',
            allow: '/',
            disallow: ['/api/'],
        },
    ];

    if (BLOCK_BAIDU) {
        rules.push({
            // 按环境变量开关决定是否屏蔽 Baidu
            userAgent: 'Baiduspider',
            disallow: '/',
        });
    } else {
        rules.push({
            userAgent: 'Baiduspider',
            allow: '/',
            disallow: ['/api/'],
        });
    }

    return {
        rules,
        sitemap: buildAbsoluteUrl('/sitemap.xml'),
    };
}
