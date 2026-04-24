import { Octokit } from '@octokit/rest';
import path from 'path';
import { queryOne, execute } from '@/lib/db';
import { logger } from '@/lib/utils/logger';
import {
    ensureDir,
    type PipelineReport, createEmptyReport,
} from './pipeline-shared';
import { downloadMedia, downloadVideoViaYtDlp, getMediaDir } from './media-pipeline';
import { createCardPreviewVideo, extractFirstFrame } from '@/lib/utils/media-processor';

// ════════════════════════════════════════════════════════════════
// GitHub README 提示词同步管线
// 从配置的 GitHub 仓库 README 解析提示词，按仓库映射分类入库
// 支持图片（<img src> / markdown）和视频（<a href="...mp4">）提取
// ════════════════════════════════════════════════════════════════

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

/** 单个同步仓库配置 */
interface RepoConfig {
    owner: string;
    repo: string;
    branch: string;
    /** README 文件名（支持 README_zh.md 等非默认文件） */
    file: string;
    /** 入库时使用的分类编码（如 seedance-2, gemini-3） */
    category: string;
}

/** 从环境变量 PROMPT_SYNC_REPOS 加载仓库列表 */
function loadRepoConfigs(): RepoConfig[] {
    const raw = process.env.PROMPT_SYNC_REPOS || '';
    if (!raw) {
        logger.warn('PromptSync', '未配置 PROMPT_SYNC_REPOS 环境变量，跳过同步');
        return [];
    }
    try {
        return JSON.parse(raw) as RepoConfig[];
    } catch (err) {
        logger.error('PromptSync', 'PROMPT_SYNC_REPOS 解析失败', err);
        return [];
    }
}

interface ParsedPrompt {
    rawTitle: string;
    content: string;
    description: string;
    author: string;
    images: string[];
    videos: string[];
    sourceUrl: string;
    originalSourceUrl?: string;
}

interface ExistingPromptRecord {
    Id: number;
    CoverImageUrl: string | null;
    VideoPreviewUrl: string | null;
    CardPreviewVideoUrl: string | null;
    ImagesJson: string | null;
}

interface ResolvedPromptMedia {
    coverImageUrl: string | null;
    videoPreviewUrl: string | null;
    cardPreviewVideoUrl: string | null;
    imagesJson: string | null;
}

export function inferCloudflareVideoDownloadUrl(imageUrl: string): string | null {
    try {
        const parsed = new URL(imageUrl);
        if (!parsed.hostname.endsWith('cloudflarestream.com')) {
            return null;
        }

        const match = parsed.pathname.match(/^\/([a-f0-9]+)\/thumbnails\//i);
        if (!match) {
            return null;
        }

        return `https://${parsed.hostname}/${match[1]}/downloads/default.mp4`;
    } catch {
        return null;
    }
}

async function resolvePromptMedia(
    prompt: ParsedPrompt,
    mediaDir: string,
    existing?: ExistingPromptRecord
): Promise<ResolvedPromptMedia> {
    let coverImageUrl = existing?.CoverImageUrl || null;
    let videoPreviewUrl = existing?.VideoPreviewUrl || null;
    let cardPreviewVideoUrl = existing?.CardPreviewVideoUrl || null;
    let imagesJson = existing?.ImagesJson || null;

    if ((!coverImageUrl || !imagesJson) && prompt.images.length > 0) {
        const localImages: string[] = [];

        for (const imgUrl of prompt.images) {
            if (!imgUrl.startsWith('http')) continue;

            const localPath = await downloadMedia(imgUrl, mediaDir);
            if (localPath && !localPath.startsWith('http')) {
                localImages.push(localPath);
                if (!coverImageUrl) coverImageUrl = localPath;
            }
        }

        if (!imagesJson && localImages.length > 0) {
            imagesJson = JSON.stringify(localImages);
        }
    }

    if (!videoPreviewUrl && prompt.videos.length > 0) {
        const videoUrl = prompt.videos[0];
        if (videoUrl.startsWith('http')) {
            console.log(`[DEBUG] 处理视频, 原始链接: ${prompt.originalSourceUrl}`);

            if (
                prompt.originalSourceUrl &&
                (prompt.originalSourceUrl.includes('x.com') || prompt.originalSourceUrl.includes('twitter.com'))
            ) {
                logger.info('PromptSync', `发现原始来源 URL，尝试用 yt-dlp 获取音轨视频: ${prompt.originalSourceUrl}`);
                const ytDlpResult = await downloadVideoViaYtDlp(prompt.originalSourceUrl, mediaDir);
                if (ytDlpResult) {
                    videoPreviewUrl = ytDlpResult;
                }
            }

            if (!videoPreviewUrl) {
                const directPath = await downloadMedia(videoUrl, mediaDir);
                if (directPath && !directPath.startsWith('http')) {
                    videoPreviewUrl = directPath;
                }
            }
        }
    }

    if (!cardPreviewVideoUrl && videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
        const absoluteVideoPath = path.join(mediaDir, path.basename(videoPreviewUrl));
        const previewFileName = await createCardPreviewVideo(absoluteVideoPath);
        if (previewFileName) {
            cardPreviewVideoUrl = `/content/prompts/media/${previewFileName}`;
        }
    }

    if (!coverImageUrl && videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
        const absoluteVideoPath = path.join(mediaDir, path.basename(videoPreviewUrl));
        logger.info('PromptSync', `无图片封面，从视频提取首帧: ${prompt.rawTitle}`);
        const coverFileName = await extractFirstFrame(absoluteVideoPath, mediaDir);
        if (coverFileName) {
            coverImageUrl = `/content/prompts/media/${coverFileName}`;
        }
    }

    return {
        coverImageUrl,
        videoPreviewUrl,
        cardPreviewVideoUrl,
        imagesJson,
    };
}

export async function syncAllAsync(): Promise<PipelineReport> {
    const { syncConfiguredPromptSources } = await import('./prompt-sources/remote-sync');
    return syncConfiguredPromptSources();
}

async function syncSingleRepoAsync(config: RepoConfig): Promise<PipelineReport> {
    const report = createEmptyReport();

    const readme = await fetchFileContent(config.owner, config.repo, config.branch, config.file);
    if (!readme) {
        logger.warn('PromptSync', `无法获取 ${config.owner}/${config.repo}/${config.file}`);
        return report;
    }

    const repoUrl = `https://github.com/${config.owner}/${config.repo}`;
    const prompts = parseReadmeToPrompts(readme, repoUrl);
    report.totalParsed = prompts.length;
    logger.info('PromptSync', `从 ${config.owner}/${config.repo} 解析出 ${prompts.length} 个提示词 → 分类: ${config.category}`);

    const mediaDir = getMediaDir();
    await ensureDir(mediaDir);

    for (const prompt of prompts) {
        try {
            // 检查是否已存在（按 sourceUrl 去重）
            const existing = await queryOne<ExistingPromptRecord>(
                'SELECT Id, CoverImageUrl, VideoPreviewUrl, CardPreviewVideoUrl, ImagesJson FROM Prompts WHERE SourceUrl = ?',
                [prompt.sourceUrl]
            );

            // 直接使用原始标题和描述，不调用 AI 翻译
            const title = prompt.rawTitle;
            const description = prompt.description;

            // 使用仓库配置中指定的分类
            const category = config.category;

            const media = await resolvePromptMedia(prompt, mediaDir, existing || undefined);

            if (existing) {
                const updates: string[] = [];
                const updateArgs: Array<string | number | null> = [];

                if (!existing.CoverImageUrl && media.coverImageUrl) {
                    updates.push('CoverImageUrl = ?');
                    updateArgs.push(media.coverImageUrl);
                }
                if (!existing.VideoPreviewUrl && media.videoPreviewUrl) {
                    updates.push('VideoPreviewUrl = ?');
                    updateArgs.push(media.videoPreviewUrl);
                }
                if (!existing.CardPreviewVideoUrl && media.cardPreviewVideoUrl) {
                    updates.push('CardPreviewVideoUrl = ?');
                    updateArgs.push(media.cardPreviewVideoUrl);
                }
                if (!existing.ImagesJson && media.imagesJson) {
                    updates.push('ImagesJson = ?');
                    updateArgs.push(media.imagesJson);
                }

                if (updates.length === 0) {
                    report.skipped++;
                    continue;
                }

                updates.push('UpdatedAt = datetime(\'now\')');
                await execute(
                    `UPDATE Prompts SET ${updates.join(', ')} WHERE Id = ?`,
                    [...updateArgs, existing.Id]
                );

                report.updated++;
                continue;
            }

            // 入库（含 VideoPreviewUrl）
            await execute(
                `INSERT INTO Prompts (Title, RawTitle, Description, Content, Category, Source, Author, SourceUrl, CoverImageUrl, VideoPreviewUrl, CardPreviewVideoUrl, ImagesJson, CopyCount, IsActive, CreatedAt)
         VALUES (?, ?, ?, ?, ?, 'github', ?, ?, ?, ?, ?, ?, ${Math.floor(Math.random() * 9900) + 100}, 1, datetime('now'))`,
                [
                    title, prompt.rawTitle, description, prompt.content,
                    category, prompt.author, prompt.sourceUrl,
                    media.coverImageUrl || null,
                    media.videoPreviewUrl || null,
                    media.cardPreviewVideoUrl || null,
                    media.imagesJson || null,
                ]
            );

            report.newlyAdded++;
        } catch (err) {
            logger.error('PromptSync', `入库失败: ${prompt.rawTitle}`, err);
        }
    }

    return report;
}

/**
 * 获取 GitHub 仓库中指定文件的内容
 * 支持 README_zh.md 等非默认文件名
 */
async function fetchFileContent(
    owner: string, repo: string, branch: string, filePath: string
): Promise<string | null> {
    try {
        if (!GITHUB_TOKEN) {
            // 匿名访问 raw.githubusercontent.com
            const res = await fetch(
                `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
            );
            if (!res.ok) return null;
            return await res.text();
        }

        const octokit = new Octokit({ auth: GITHUB_TOKEN });
        const { data } = await octokit.repos.getContent({
            owner, repo, ref: branch, path: filePath,
        });

        // getContent 返回文件时 data 是对象，含 content (base64)
        if ('content' in data && typeof data.content === 'string') {
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }

        return null;
    } catch (err) {
        logger.error('PromptSync', `获取 ${owner}/${repo}/${filePath} 失败`, err);
        return null;
    }
}

/**
 * 解析 README 中的提示词条目
 *
 * YouMind-OpenLab 仓库 README 结构（每个提示词）：
 *   ### No. X: 标题
 *   #### 📖 描述      ← 说明文字（存为 description）
 *   #### 📝 提示词     ← 纯 prompt 在 ``` 代码块里（存为 content）
 *   #### 🎬 视频      ← 视频链接 + 缩略图
 *   #### 📌 详情      ← 作者、来源等
 *
 * 核心提取规则：content 只取代码块内的纯文本，其余为元数据。
 */
export function parseReadmeToPrompts(readme: string, repoUrl: string): ParsedPrompt[] {
    const prompts: ParsedPrompt[] = [];
    // 按 ### 级标题切分（匹配 "### No. 1: ..." 等格式）
    const sections = readme.split(/^###\s+/m).filter(s => s.trim());

    for (const section of sections) {
        const lines = section.split('\n');
        const titleLine = lines[0]?.trim();
        if (!titleLine || titleLine.length < 3) continue;

        // 跳过非提示词的章节标题（目录、贡献、许可等）
        if (/^(📖|📊|🤝|📄|🙏|⭐|📚|🌐|🤔|🚀|🔥|🎬|📋|🐛)/.test(titleLine)) continue;

        const sectionContent = lines.slice(1).join('\n').trim();
        if (sectionContent.length < 10) continue;

        // ─── 提取纯 prompt 文本（只取 ``` 代码块内容） ───
        const codeBlocks: string[] = [];
        const codeBlockRegex = /```[^\n]*\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(sectionContent)) !== null) {
            const blockContent = match[1].trim();
            if (blockContent.length > 5) {
                codeBlocks.push(blockContent);
            }
        }

        // 如果没找到代码块，跳过（不是有效的提示词条目）
        if (codeBlocks.length === 0) continue;

        // 合并所有代码块为最终 prompt content
        const promptContent = codeBlocks.join('\n\n');

        // ─── 提取 📖 描述段落 ───────────────────────────
        let description = '';
        const descMatch = sectionContent.match(/####\s*📖\s*描述\s*\n([\s\S]*?)(?=####|$)/i);
        if (descMatch) {
            description = descMatch[1]
                .replace(/!\[.*?\]\(.*?\)/g, '')          // 移除图片
                .replace(/<img\s[^>]*>/gi, '')             // 移除 img 标签
                .replace(/!\[.*?\]\[.*?\]/g, '')           // badge 引用
                .replace(/\[.*?\]\(.*?\)/g, '')            // 移除链接
                .replace(/<[^>]+>/g, '')                    // 移除所有 HTML 标签
                .replace(/\n{2,}/g, '\n')                  // 压缩空行
                .trim()
                .slice(0, 300);
        }
        if (!description) {
            description = promptContent.slice(0, 200).replace(/\n/g, ' ');
        }

        // ─── 提取 📌 详情中的真实作者和来源 ─────────────────────
        let author = repoUrl.split('/')[3] || 'Unknown';
        const authorMatch = sectionContent.match(/\*\*作者:\*\*\s*\[(.+?)\]/);
        if (authorMatch) {
            author = authorMatch[1];
        }
        
        let originalSourceUrl: string | undefined;
        const sourceMatch = sectionContent.match(/\*\*来源:\*\*\s*\[.*?\]\((.*?)\)/);
        if (sourceMatch) {
            originalSourceUrl = sourceMatch[1];
        } else {
            console.log(`[PromptSync Regex Debug] 未匹配来源. Section fragment: ${sectionContent.substring(sectionContent.indexOf('详情'), sectionContent.indexOf('详情') + 150)}`);
        }

        // ─── 提取图片 URL ───────────────────────────────
        const images: string[] = [];
        // HTML <img src="..."> 格式（YouMind 仓库使用此格式展示缩略图）
        const htmlImgRegex = /<img\s[^>]*src=["'](.*?)["'][^>]*>/gi;
        while ((match = htmlImgRegex.exec(sectionContent)) !== null) {
            images.push(match[1]);
        }
        // 过滤掉 badge/shield 图片
        const filteredImages = images.filter(url =>
            !url.includes('shields.io') && !url.includes('badge')
        );

        // ─── 提取视频 URL ───────────────────────────────
        const videos: string[] = [];
        const videoLinkRegex = /<a\s[^>]*href=["'](.*?\.mp4)["'][^>]*>/gi;
        while ((match = videoLinkRegex.exec(sectionContent)) !== null) {
            videos.push(match[1]);
        }

        if (videos.length === 0) {
            const inferredVideoUrl = filteredImages
                .map((imageUrl) => inferCloudflareVideoDownloadUrl(imageUrl))
                .find((videoUrl): videoUrl is string => Boolean(videoUrl));

            if (inferredVideoUrl) {
                videos.push(inferredVideoUrl);
            }
        }

        // 清理 "No. X: " 前缀后的标题
        const cleanTitle = titleLine.replace(/^No\.\s*\d+:\s*/, '').trim();

        prompts.push({
            rawTitle: cleanTitle || titleLine,
            content: promptContent,
            description,
            author,
            images: filteredImages,
            videos,
            sourceUrl: `${repoUrl}#${encodeURIComponent(titleLine.toLowerCase().replace(/\s+/g, '-'))}`,
            originalSourceUrl
        });
    }

    return prompts;
}
