import {
    getArticleCategoryLandingPath,
    getArticleDetailPath,
    getArticleListPath,
} from '@/lib/articles/article-route-paths';

export interface SeoInternalLink {
    id: string;
    href: string;
    label: string;
    description: string;
}

export interface ArticleInternalLinkGroup {
    kind: 'article';
    title: '相关文章';
    links: [SeoInternalLink, SeoInternalLink, SeoInternalLink];
}

export interface PromptInternalLinkGroup {
    kind: 'prompt';
    title: '相关提示词';
    links: [SeoInternalLink, SeoInternalLink, SeoInternalLink, SeoInternalLink];
}

export interface RankingInternalLinkGroup {
    kind: 'ranking';
    title: '相关热榜';
    links: [SeoInternalLink, SeoInternalLink, SeoInternalLink, SeoInternalLink];
}

export interface BuildArticleInternalLinkGroupInput {
    site: string;
    categorySlug: string;
    categoryLabel: string;
    articleSlug: string;
    articleTitle: string;
}

export interface BuildPromptInternalLinkGroupInput {
    categorySlug: string;
    categoryLabel: string;
    promptId: number | string;
    promptTitle: string;
}

export interface BuildSeoInternalLinkGroupsInput {
    article?: BuildArticleInternalLinkGroupInput;
    prompt?: BuildPromptInternalLinkGroupInput;
    rankings?: boolean;
}

export interface SeoInternalLinkGroups {
    article?: ArticleInternalLinkGroup;
    prompt?: PromptInternalLinkGroup;
    ranking?: RankingInternalLinkGroup;
}

export function buildArticleInternalLinkGroup(
    input: BuildArticleInternalLinkGroupInput
): ArticleInternalLinkGroup {
    const siteLabel = input.site.toUpperCase();

    return {
        kind: 'article',
        title: '相关文章',
        links: [
            {
                id: 'article-list',
                href: getArticleListPath(input.site),
                label: `全部 ${siteLabel} 文章`,
                description: `返回 ${siteLabel} 文章栏目，继续浏览更多分类与长文。`,
            },
            {
                id: 'article-category',
                href: getArticleCategoryLandingPath(input.site, input.categorySlug),
                label: `${input.categoryLabel} 文章`,
                description: `进入 ${input.categoryLabel} 分类落地页，集中浏览同主题内容。`,
            },
            {
                id: 'article-detail',
                href: getArticleDetailPath(input.site, input.articleSlug),
                label: input.articleTitle,
                description: '回到当前文章详情页。',
            },
        ],
    };
}

export function buildPromptInternalLinkGroup(
    input: BuildPromptInternalLinkGroupInput
): PromptInternalLinkGroup {
    return {
        kind: 'prompt',
        title: '相关提示词',
        links: [
            {
                id: 'prompt-list',
                href: '/prompts',
                label: '全部提示词',
                description: '浏览全部提示词，按模型与场景继续筛选。',
            },
            {
                id: 'prompt-category',
                href: `/prompts/categories/${input.categorySlug}`,
                label: `${input.categoryLabel} 提示词`,
                description: `进入 ${input.categoryLabel} 分类页，查看同类提示词合集。`,
            },
            {
                id: 'prompt-scenarios',
                href: '/prompts/scenarios',
                label: '提示词场景库',
                description: '进入场景化提示词入口，按任务浏览提示词组合。',
            },
            {
                id: 'prompt-detail',
                href: `/prompts/${input.promptId}`,
                label: input.promptTitle,
                description: '回到当前提示词详情页。',
            },
        ],
    };
}

export function buildRankingInternalLinkGroup(): RankingInternalLinkGroup {
    return {
        kind: 'ranking',
        title: '相关热榜',
        links: [
            {
                id: 'ranking-github',
                href: '/rankings/github',
                label: 'GitHub Trending',
                description: '查看开源项目热度变化。',
            },
            {
                id: 'ranking-producthunt',
                href: '/rankings/producthunt',
                label: 'ProductHunt',
                description: '查看新产品发布热度。',
            },
            {
                id: 'ranking-skills-trending',
                href: '/rankings/skills-trending',
                label: 'Skills Trending',
                description: '查看技能与工具的趋势热度。',
            },
            {
                id: 'ranking-skills-hot',
                href: '/rankings/skills-hot',
                label: 'Skills Hot',
                description: '查看技能与工具的短期爆发热度。',
            },
        ],
    };
}

export function buildSeoInternalLinkGroups(
    input: BuildSeoInternalLinkGroupsInput
): SeoInternalLinkGroups {
    return {
        article: input.article ? buildArticleInternalLinkGroup(input.article) : undefined,
        prompt: input.prompt ? buildPromptInternalLinkGroup(input.prompt) : undefined,
        ranking: input.rankings ? buildRankingInternalLinkGroup() : undefined,
    };
}
