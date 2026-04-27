import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRankingTopicPages = vi.fn();
const mockGetRankingTopicPageBySlug = vi.fn();
const mockGetProductHuntRankings = vi.fn();
const mockGetGitHubTrendings = vi.fn();
const mockGetSkillsShRankings = vi.fn();

vi.mock('next/link', async () => {
    const ReactModule = await import('react');

    return {
        default: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => ReactModule.createElement('a', { href, ...props }, children),
    };
});

vi.mock('@/lib/seo/growth-pages', () => ({
    getRankingTopicPages: mockGetRankingTopicPages,
    getRankingTopicPageBySlug: mockGetRankingTopicPageBySlug,
}));

vi.mock('@/lib/services/ranking-cache', () => ({
    getProductHuntRankings: mockGetProductHuntRankings,
    getGitHubTrendings: mockGetGitHubTrendings,
    getSkillsShRankings: mockGetSkillsShRankings,
}));

const rankingTopics = [
    {
        slug: 'ai-launches-producthunt',
        title: 'AI 新品发布观察',
        description: '基于 ProductHunt 热榜整理 AI 新品趋势、对比与上榜解读。',
        canonicalPath: '/rankings/topics/ai-launches-producthunt',
        intro: '复用现有 ProductHunt 热榜数据，并补上更适合搜索与 AI 引用的专题说明。',
        rankingSource: 'producthunt',
        blocks: [
            {
                type: 'steps',
                heading: '如何阅读专题页',
                items: [
                    {
                        name: '先看摘要',
                        text: '先读专题摘要，再看榜单条目。',
                    },
                ],
            },
            {
                type: 'faq',
                heading: 'AI 新品发布常见问题',
                items: [
                    {
                        question: '页面多久更新一次？',
                        answer: '跟随 ProductHunt 热榜缓存刷新节奏。',
                    },
                ],
            },
        ],
    },
    {
        slug: 'github-agent-frameworks',
        title: 'GitHub Agent Frameworks',
        description: '追踪 GitHub 上的 Agent Framework 热度。',
        canonicalPath: '/rankings/topics/github-agent-frameworks',
        intro: '围绕 GitHub 上的 Agent Framework 生态进行跟踪。',
        rankingSource: 'github',
        blocks: [],
    },
    {
        slug: 'skills-agent-workflows',
        title: 'Skills Agent Workflows',
        description: '追踪 Skills 生态里的 Agent Workflow 热门主题。',
        canonicalPath: '/rankings/topics/skills-agent-workflows',
        intro: '围绕 Skills 生态中的热门工作流进行跟踪。',
        rankingSource: 'skills-trending',
        blocks: [],
    },
];

describe('ranking topic page family', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        mockGetRankingTopicPages.mockReturnValue(rankingTopics);
        mockGetRankingTopicPageBySlug.mockImplementation((slug: string) => {
            return rankingTopics.find((topic) => topic.slug === slug) ?? null;
        });

        mockGetProductHuntRankings.mockResolvedValue([
            {
                id: 1,
                title: 'Launch Copilot',
                sourcePlatform: 'ProductHunt',
            },
        ]);
        mockGetGitHubTrendings.mockResolvedValue([
            {
                id: 2,
                repoFullName: 'microsoft/autogen',
                sourcePlatform: 'GitHub',
            },
        ]);
        mockGetSkillsShRankings.mockResolvedValue([
            {
                id: 3,
                skillName: 'Agent Workflow Kit',
                sourcePlatform: 'Skills',
            },
        ]);
    });

    it('keeps topic pages reachable without exposing them as a rankings tab', async () => {
        const layoutModule = await import('@/app/rankings/layout');
        const indexModule = await import('@/app/rankings/topics/page');

        const layoutHtml = renderToStaticMarkup(
            layoutModule.default({
                children: React.createElement('div', null, 'topics body'),
            }) as React.ReactElement
        );
        const indexHtml = renderToStaticMarkup(indexModule.default() as React.ReactElement);

        expect(layoutHtml).toContain('/rankings/github');
        expect(layoutHtml).toContain('/rankings/producthunt');
        expect(layoutHtml).toContain('/rankings/skills-trending');
        expect(layoutHtml).toContain('/rankings/skills-hot');
        expect(layoutHtml).not.toContain('/rankings/topics');
        expect(indexHtml).toContain('榜单入口');
        expect(indexHtml).toContain('/rankings/github');
        expect(indexHtml).toContain('/rankings/producthunt');
        expect(indexHtml).toContain('/rankings/skills-trending');
        expect(indexHtml).toContain('/rankings/skills-hot');
        expect(indexHtml).toContain('AI 新品发布观察');
        expect(indexHtml).toContain('/rankings/topics/ai-launches-producthunt');
    });

    it('renders ranking topic detail metadata and AI SEO blocks against ProductHunt fields', async () => {
        const pageModule = await import('@/app/rankings/topics/[slug]/page');

        const metadata = await pageModule.generateMetadata({
            params: Promise.resolve({ slug: 'ai-launches-producthunt' }),
        });
        const element = await pageModule.default({
            params: Promise.resolve({ slug: 'ai-launches-producthunt' }),
        });
        const html = renderToStaticMarkup(element as React.ReactElement);

        expect(metadata.alternates?.canonical).toBe('/rankings/topics/ai-launches-producthunt');
        expect(html).toContain('AI 新品发布常见问题');
        expect(html).toContain('Launch Copilot');
        expect(html).toContain('ProductHunt');
        expect(html).toContain('HowTo');
    });

    it('renders ranking topic detail pages against GitHub and Skills item naming differences', async () => {
        const pageModule = await import('@/app/rankings/topics/[slug]/page');

        const githubElement = await pageModule.default({
            params: Promise.resolve({ slug: 'github-agent-frameworks' }),
        });
        const githubHtml = renderToStaticMarkup(githubElement as React.ReactElement);

        const skillsElement = await pageModule.default({
            params: Promise.resolve({ slug: 'skills-agent-workflows' }),
        });
        const skillsHtml = renderToStaticMarkup(skillsElement as React.ReactElement);

        expect(githubHtml).toContain('microsoft/autogen');
        expect(githubHtml).toContain('GitHub');
        expect(skillsHtml).toContain('Agent Workflow Kit');
        expect(skillsHtml).toContain('Skills');
    });
});
