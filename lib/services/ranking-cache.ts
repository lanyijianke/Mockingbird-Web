import { GitHubTrending, ProductHuntRanking, SkillsShRanking } from '@/lib/types';
import { scrapeGitHubTrending, scrapeProductHunt, scrapeSkillsSh } from './ranking-scrapers';
import { cacheKeys, cacheTags } from '@/lib/cache/keys';
import { cachePolicies, rankingCachePolicies } from '@/lib/cache/policies';
import { getCacheManager } from '@/lib/cache/runtime';
import { logger } from '@/lib/utils/logger';

// ════════════════════════════════════════════════════════════════
// 排行榜共享缓存 — 直采模式
// 直接从源站抓取数据，2h TTL 统一 MemoryCache
// ════════════════════════════════════════════════════════════════

type RankingLoader<T> = () => Promise<T[]>;

async function loadRankings<T>(
    policy: typeof rankingCachePolicies[number],
    keyParts: readonly (string | number | boolean)[],
    sourceName: string,
    loader: RankingLoader<T>
): Promise<T[]> {
    try {
        return await getCacheManager().getOrLoad(
            policy,
            keyParts,
            async () => {
                const result = await loader();
                if (result.length === 0) {
                    logger.warn('RankingCache', `${sourceName} 直采未获取到数据`);
                    return result;
                }

                logger.info('RankingCache', `✅ ${sourceName} 直采成功: ${result.length} 条`);
                return result;
            },
            {
                tags: [cacheTags.rankings],
                isEmpty: (value) => Array.isArray(value) && value.length === 0,
            }
        );
    } catch (err) {
        logger.error('RankingCache', `${sourceName} 抓取失败`, err);
        return [];
    }
}

// ════════════════════════════════════════════════════════════════
// GitHub Trending
// ════════════════════════════════════════════════════════════════

export async function getGitHubTrendings(): Promise<GitHubTrending[]> {
    return loadRankings(
        cachePolicies.rankingsGithub,
        cacheKeys.rankings.github(),
        'GitHub Trending',
        scrapeGitHubTrending
    );
}

// ════════════════════════════════════════════════════════════════
// ProductHunt
// ════════════════════════════════════════════════════════════════

export async function getProductHuntRankings(): Promise<ProductHuntRanking[]> {
    return loadRankings(
        cachePolicies.rankingsProductHunt,
        cacheKeys.rankings.producthunt(),
        'ProductHunt',
        scrapeProductHunt
    );
}

// ════════════════════════════════════════════════════════════════
// Skills.sh
// ════════════════════════════════════════════════════════════════

export async function getSkillsShRankings(listType: string = 'trending'): Promise<SkillsShRanking[]> {
    const validType = listType === 'hot' ? 'hot' : 'trending';
    const policy = validType === 'hot'
        ? cachePolicies.rankingsSkillsHot
        : cachePolicies.rankingsSkillsTrending;

    return loadRankings(
        policy,
        cacheKeys.rankings.skills(validType),
        `Skills.sh ${validType}`,
        async () => scrapeSkillsSh(validType)
    );
}

// ════════════════════════════════════════════════════════════════
// 主动刷新（供定时任务调用）
// ════════════════════════════════════════════════════════════════

/**
 * 强制刷新所有排行榜缓存（无论是否过期）
 * 供定时任务 RankingSyncJob 调用
 */
export async function refreshAllRankings(): Promise<void> {
    logger.info('RankingCache', '🔄 开始刷新所有排行榜...');

    const tasks = [
        {
            name: 'GitHub Trending',
            fn: async () => {
                const result = await getCacheManager().warm(
                    cachePolicies.rankingsGithub,
                    cacheKeys.rankings.github(),
                    scrapeGitHubTrending,
                    {
                        tags: [cacheTags.rankings],
                        isEmpty: (value) => Array.isArray(value) && value.length === 0,
                    }
                );
                return result.length;
            },
        },
        {
            name: 'ProductHunt',
            fn: async () => {
                const result = await getCacheManager().warm(
                    cachePolicies.rankingsProductHunt,
                    cacheKeys.rankings.producthunt(),
                    scrapeProductHunt,
                    {
                        tags: [cacheTags.rankings],
                        isEmpty: (value) => Array.isArray(value) && value.length === 0,
                    }
                );
                return result.length;
            },
        },
        {
            name: 'Skills.sh Trending',
            fn: async () => {
                const result = await getCacheManager().warm(
                    cachePolicies.rankingsSkillsTrending,
                    cacheKeys.rankings.skills('trending'),
                    async () => scrapeSkillsSh('trending'),
                    {
                        tags: [cacheTags.rankings],
                        isEmpty: (value) => Array.isArray(value) && value.length === 0,
                    }
                );
                return result.length;
            },
        },
        {
            name: 'Skills.sh Hot',
            fn: async () => {
                const result = await getCacheManager().warm(
                    cachePolicies.rankingsSkillsHot,
                    cacheKeys.rankings.skills('hot'),
                    async () => scrapeSkillsSh('hot'),
                    {
                        tags: [cacheTags.rankings],
                        isEmpty: (value) => Array.isArray(value) && value.length === 0,
                    }
                );
                return result.length;
            },
        },
    ];

    for (const task of tasks) {
        try {
            const count = await task.fn();
            logger.info('RankingCache', `  ✅ ${task.name}: ${count} 条`);
        } catch (err) {
            logger.error('RankingCache', `  ❌ ${task.name} 失败:`, err);
        }
    }

    logger.info('RankingCache', '🔄 排行榜刷新完毕');
}
