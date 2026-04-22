/**
 * 排行榜直采模块 — 直接从源站抓取排行榜数据
 * 移植自 Crawler 子系统的 github-trending.ts / producthunt.ts / skills-sh.ts
 *
 * 数据不再经过中间服务转发，由 Knowledge Web 自行直采。
 */
import * as cheerio from 'cheerio';
import type { GitHubTrending, ProductHuntRanking, SkillsShRanking } from '@/lib/types';

// ════════════════════════════════════════════════════════════════
// GitHub Trending
// ════════════════════════════════════════════════════════════════

/**
 * 直采 GitHub Trending 排行榜
 * 使用 fetch + cheerio 解析 SSR 页面（无需浏览器渲染）
 */
export async function scrapeGitHubTrending(maxItems: number = 25): Promise<GitHubTrending[]> {
    const url = 'https://github.com/trending';

    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
        throw new Error(`GitHub Trending 请求失败: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: GitHubTrending[] = [];

    $('article.Box-row').each((index, el) => {
        if (results.length >= maxItems) return false;

        try {
            // 仓库名 (owner/repo)
            const repoLink = $(el).find('h2 a');
            const repoFullName = (repoLink.attr('href') ?? '')
                .replace(/^\//, '')
                .replace(/\s+/g, '')
                .trim();
            const repoUrl = repoFullName ? `https://github.com/${repoFullName}` : '';

            // 描述
            const description = $(el).find('p').text().trim();

            // 编程语言
            const language = $(el).find('[itemprop="programmingLanguage"]').text().trim() || null;

            // Star 总数和 Fork 数
            let starsCount = 0;
            let forksCount = 0;
            $(el).find('a[href*="/stargazers"], a[href*="/forks"]').each((_, linkEl) => {
                const href = $(linkEl).attr('href') ?? '';
                const numText = $(linkEl).text().trim().replace(/[^\d,]/g, '').replace(/,/g, '');
                const num = parseInt(numText, 10) || 0;
                if (href.includes('/stargazers')) starsCount = num;
                else if (href.includes('/forks')) forksCount = num;
            });

            // 今日 Star 增长
            let todayStars = 0;
            const todaySpans = $(el).find('span.d-inline-block.float-sm-right');
            const lastSpan = todaySpans.last();
            if (lastSpan.length) {
                const todayText = lastSpan.text().trim().replace(/[^\d,]/g, '').replace(/,/g, '');
                todayStars = parseInt(todayText, 10) || 0;
            }

            if (!repoFullName) return;

            results.push({
                id: index + 1,
                rank: index + 1,
                repoFullName,
                description,
                language,
                starsCount,
                forksCount,
                todayStars,
                repoUrl,
                sourcePlatform: 'GitHub',
                updatedAt: new Date().toISOString(),
            });
        } catch {
            // 跳过解析失败的条目
        }
    });

    return results;
}

// ════════════════════════════════════════════════════════════════
// ProductHunt
// ════════════════════════════════════════════════════════════════

const PH_GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';
const PH_POSTS_QUERY = `
query {
  posts(order: VOTES, first: 30) {
    edges {
      node {
        id
        name
        tagline
        description
        url
        votesCount
        commentsCount
        website
        createdAt
        thumbnail {
          url
        }
        topics {
          edges {
            node {
              name
            }
          }
        }
        makers {
          name
        }
      }
    }
  }
}`;

/**
 * 直采 ProductHunt 排行榜
 * 使用 OAuth client_credentials 获取 Token，再调用 GraphQL API
 */
export async function scrapeProductHunt(maxItems: number = 30): Promise<ProductHuntRanking[]> {
    const apiKey = process.env.PRODUCTHUNT_API_KEY ?? '';
    const apiSecret = process.env.PRODUCTHUNT_API_SECRET ?? '';

    if (!apiKey || !apiSecret) {
        console.warn('[RankingScraper] ProductHunt 缺少 API Key/Secret，跳过');
        return [];
    }

    // 1. 获取 Access Token
    const tokenRes = await fetch('https://api.producthunt.com/v2/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: apiKey,
            client_secret: apiSecret,
            grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
        throw new Error(`ProductHunt Token API 返回 HTTP ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const bearerToken = tokenData?.access_token;
    if (!bearerToken) {
        throw new Error('未能获取 ProductHunt Access Token');
    }

    // 2. 调用 GraphQL
    const gqlRes = await fetch(PH_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query: PH_POSTS_QUERY }),
        signal: AbortSignal.timeout(10000),
    });

    if (!gqlRes.ok) {
        throw new Error(`ProductHunt GraphQL API 返回 HTTP ${gqlRes.status}`);
    }

    const data = (await gqlRes.json()) as { data?: { posts?: { edges?: Array<{ node: Record<string, unknown> }> } } };
    const posts = data?.data?.posts?.edges ?? [];
    const results: ProductHuntRanking[] = [];

    for (const [index, edge] of posts.slice(0, maxItems).entries()) {
        const node = edge.node;
        if (!node) continue;

        // 提取缩略图 URL
        const thumbnail = node.thumbnail as { url?: string } | null;
        const thumbnailUrl = thumbnail?.url || null;

        results.push({
            id: index + 1,
            rank: index + 1,
            title: (node.name as string) ?? '',
            tagline: (node.tagline as string) ?? (node.description as string) ?? '',
            votesCount: (node.votesCount as number) ?? 0,
            productUrl: (node.website as string) || (node.url as string) || null,
            thumbnailUrl,
            sourcePlatform: 'ProductHunt',
            updatedAt: new Date().toISOString(),
        });
    }

    return results;
}

// ════════════════════════════════════════════════════════════════
// Skills.sh
// ════════════════════════════════════════════════════════════════

/**
 * 直采 Skills.sh 排行榜（trending 或 hot）
 * 使用 fetch + cheerio 解析页面
 * 并行抓取前 N 个技能的简介（来自详情页的第一段文本）
 */
export async function scrapeSkillsSh(
    listType: 'trending' | 'hot' = 'trending',
    maxItems: number = 50,
): Promise<SkillsShRanking[]> {
    const url = `https://skills.sh/${listType}`;

    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });

    if (!res.ok) {
        throw new Error(`Skills.sh ${listType} 请求失败: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SkillsShRanking[] = [];

    $('a[href]').each((_, el) => {
        if (results.length >= maxItems) return false;

        const $el = $(el);
        const href = $el.attr('href') ?? '';

        // 匹配 /{owner}/{repo}/{skill} 格式的 href（至少 3 段路径）
        const pathParts = href.replace(/^\//, '').split('/');
        if (pathParts.length < 3) return;

        // 排除导航链接
        if (href === '/trending' || href === '/hot' || href === '/' || href.startsWith('http')) return;

        // 提取数据
        const divs = $el.children('div');
        if (divs.length < 2) return;

        // 第 1 列：排名
        const rankText = divs.eq(0).find('span').first().text().trim();
        const rank = parseInt(rankText, 10) || 0;
        if (rank === 0) return;

        // 第 2 列：名称和作者
        const nameDiv = divs.eq(1);
        const title = nameDiv.find('h3').first().text().trim();
        if (!title) return;

        // 第 3 列：安装数
        let installCountText: string | null = null;
        if (divs.length >= 3) {
            installCountText = divs.eq(2).find('span').first().text().trim() || null;
        }

        const repoOwner = pathParts[0] || null;
        const repoName = pathParts[1] || null;
        const fullUrl = 'https://skills.sh' + (href.startsWith('/') ? '' : '/') + href;

        results.push({
            id: results.length + 1,
            rank,
            skillName: title,
            description: null,
            repoOwner,
            repoName,
            installCount: installCountText,
            skillUrl: fullUrl,
            listType,
            updatedAt: new Date().toISOString(),
            repoFullName: repoOwner ? `${repoOwner}/${repoName}` : '',
        });
    });

    // ── 并行抓取技能简介 ────────────────────────────────────
    // 对前 20 个技能并行请求详情页，提取第一段文本作为 description
    const TOP_N = 20;
    const CONCURRENCY = 5;
    const topSkills = results.slice(0, TOP_N);

    for (let i = 0; i < topSkills.length; i += CONCURRENCY) {
        const batch = topSkills.slice(i, i + CONCURRENCY);
        const descriptions = await Promise.allSettled(
            batch.map(skill => fetchSkillDescription(skill.skillUrl ?? ''))
        );

        descriptions.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value) {
                topSkills[i + idx].description = result.value;
            }
        });
    }

    return results;
}

/**
 * 抓取单个技能的详情页，提取第一段描述文本
 */
async function fetchSkillDescription(skillUrl: string): Promise<string | null> {
    if (!skillUrl) return null;

    try {
        const res = await fetch(skillUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;

        const html = await res.text();
        const $ = cheerio.load(html);

        // 详情页结构：h1 (技能名) → 安装命令 → h1 (标题) → p (描述)
        // 找到第一个有实质内容的 <p> 标签
        let description: string | null = null;
        $('p').each((_, el) => {
            const text = $(el).text().trim();
            // 跳过太短或是安装命令的段落
            if (text.length > 30 && !text.startsWith('$') && !text.startsWith('npx')) {
                description = text.length > 200 ? text.slice(0, 200) + '...' : text;
                return false; // 取第一个满足条件的
            }
        });

        return description;
    } catch {
        return null;
    }
}
