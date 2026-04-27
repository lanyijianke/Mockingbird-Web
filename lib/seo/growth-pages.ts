import { getSiteSeoConfig } from '@/lib/seo/config';

export interface FaqEntry {
    question: string;
    answer: string;
}

export interface ComparisonRow {
    label: string;
    summary: string;
}

export interface StepEntry {
    name: string;
    text: string;
}

export interface StatEntry {
    label: string;
    value: string;
    sourceName: string;
    sourceUrl: string;
}

export type GrowthPageBlock =
    | { type: 'definition'; heading: string; body: string }
    | { type: 'faq'; heading: string; items: FaqEntry[] }
    | { type: 'comparison'; heading: string; rows: ComparisonRow[] }
    | { type: 'steps'; heading: string; items: StepEntry[] }
    | { type: 'stats'; heading: string; items: StatEntry[] };

export interface PromptScenarioPageDefinition {
    slug: string;
    canonicalPath: string;
    title: string;
    description: string;
    intro: string;
    promptCategory: string;
    promptSourceCategory: string;
    promptSearchQuery?: string;
    blocks: GrowthPageBlock[];
}

export type RankingSource =
    | 'github'
    | 'producthunt'
    | 'skills-trending'
    | 'skills-hot';

export interface RankingTopicPageDefinition {
    slug: string;
    canonicalPath: string;
    title: string;
    description: string;
    intro: string;
    rankingSource: RankingSource;
    blocks: GrowthPageBlock[];
}

const SITE_CONFIG = getSiteSeoConfig();

const PROMPT_SCENARIO_PAGES: PromptScenarioPageDefinition[] = [
    {
        slug: 'video-generation',
        canonicalPath: '/prompts/scenarios/video-generation',
        title: '视频生成提示词场景库',
        description: '围绕视频生成任务整理可复用提示词、使用步骤、FAQ 与来源说明。',
        intro: '把视频生成场景拆成可理解、可引用、可继续取数的增长页定义。',
        promptCategory: 'video-generation',
        promptSourceCategory: 'gemini-3',
        promptSearchQuery: 'video generation',
        blocks: [
            {
                type: 'definition',
                heading: '什么是视频生成提示词场景页',
                body: '聚合真实提示词数据，并补上定义、比较、步骤、FAQ 与引用出处。',
            },
            {
                type: 'faq',
                heading: '视频生成提示词常见问题',
                items: [
                    {
                        question: '什么情况下适合使用视频生成提示词？',
                        answer: '当你需要把镜头、动作、风格和时长约束写成可复用模版时。',
                    },
                ],
            },
            {
                type: 'comparison',
                heading: '常见视频生成任务比较',
                rows: [
                    {
                        label: '广告短片',
                        summary: '更强调钩子镜头、品牌元素和结尾 CTA。',
                    },
                ],
            },
            {
                type: 'steps',
                heading: '如何使用本页提示词',
                items: [
                    {
                        name: '选择任务',
                        text: '先选最接近目标镜头和风格的真实提示词样本。',
                    },
                ],
            },
            {
                type: 'stats',
                heading: '数据来源与引用',
                items: [
                    {
                        label: 'Prompt Source',
                        value: `${SITE_CONFIG.alternateName} prompt library category feed`,
                        sourceName: SITE_CONFIG.alternateName,
                        sourceUrl: '/prompts',
                    },
                ],
            },
        ],
    },
];

const RANKING_TOPIC_PAGES: RankingTopicPageDefinition[] = [
    {
        slug: 'ai-launches-producthunt',
        canonicalPath: '/rankings/topics/ai-launches-producthunt',
        title: 'AI 新品发布专题',
        description: '基于 ProductHunt 热榜整理 AI 新品发布趋势、差异和观察维度。',
        intro: '把既有 ProductHunt 榜单数据包装成更稳定的专题页定义。',
        rankingSource: 'producthunt',
        blocks: [
            {
                type: 'definition',
                heading: '专题页提供什么',
                body: '用统一结构解释上榜 AI 产品的定位、亮点和趋势信号。',
            },
            {
                type: 'faq',
                heading: '榜单专题常见问题',
                items: [
                    {
                        question: '这个专题页的数据来自哪里？',
                        answer: '来自现有 ProductHunt ranking source 的缓存与页面层聚合。',
                    },
                ],
            },
            {
                type: 'comparison',
                heading: '上榜产品比较维度',
                rows: [
                    {
                        label: '定位',
                        summary: '比较产品服务的人群、任务场景和核心价值主张。',
                    },
                ],
            },
            {
                type: 'steps',
                heading: '如何阅读专题页',
                items: [
                    {
                        name: '先看摘要',
                        text: '先读专题摘要，再进入具体上榜产品卡片。',
                    },
                ],
            },
            {
                type: 'stats',
                heading: '数据来源与引用',
                items: [
                    {
                        label: 'Ranking Source',
                        value: 'ProductHunt ranking cache',
                        sourceName: 'ProductHunt',
                        sourceUrl: 'https://www.producthunt.com/',
                    },
                ],
            },
        ],
    },
];

export function getPromptScenarioPages(): PromptScenarioPageDefinition[] {
    return PROMPT_SCENARIO_PAGES;
}

export function getPromptScenarioPageBySlug(
    slug: string,
): PromptScenarioPageDefinition | null {
    return PROMPT_SCENARIO_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getRankingTopicPages(): RankingTopicPageDefinition[] {
    return RANKING_TOPIC_PAGES;
}

export function getRankingTopicPageBySlug(
    slug: string,
): RankingTopicPageDefinition | null {
    return RANKING_TOPIC_PAGES.find((page) => page.slug === slug) ?? null;
}
