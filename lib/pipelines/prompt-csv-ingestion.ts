import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { queryOne, execute } from '@/lib/db';
import { logger } from '@/lib/utils/logger';
import {
    resolvePath, ensureDir,
    type PipelineReport, createEmptyReport,
} from './pipeline-shared';
import { downloadMedia, downloadVideoViaYtDlp, getMediaDir } from './media-pipeline';
import { extractFirstFrame } from '@/lib/utils/media-processor';

// ════════════════════════════════════════════════════════════════
// CSV 提示词批量入库管线
// 从本地投递目录读取 CSV，自给自足完成提示词入库
// 支持 SourceMedia / SourceVideos / cover_image_url / video_preview_url
// 下载外部资源后自动压缩（视频 720p / 图片 WebP）
// ════════════════════════════════════════════════════════════════

const DEFAULT_PROMPT_CSV_DIR = './raw-incoming/prompts';

interface CsvPromptRow {
    title?: string;
    description?: string;
    content?: string;
    author?: string;
    source_url?: string;
    cover_image_url?: string;
    video_preview_url?: string;
    images?: string;
    category?: string;
    // 老格式兼容
    SourceMedia?: string;
    SourceVideos?: string;
    SourceLink?: string;
    'Source Link'?: string;
}

interface PromptCsvDirectories {
    rootDir: string;
    inboxDir: string;
    processedDir: string;
    failedDir: string;
}

function getPromptCsvDirectories(): PromptCsvDirectories {
    const rootDir = resolvePath(process.env.PROMPT_CSV_DIR, DEFAULT_PROMPT_CSV_DIR);
    return {
        rootDir,
        inboxDir: path.join(rootDir, 'inbox'),
        processedDir: path.join(rootDir, 'processed'),
        failedDir: path.join(rootDir, 'failed'),
    };
}

async function listInboxCsvFiles(inboxDir: string): Promise<string[]> {
    const entries = await fs.readdir(inboxDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function archiveCsvFile(sourcePath: string, targetDir: string): Promise<string> {
    const parsed = path.parse(sourcePath);
    let targetPath = path.join(targetDir, parsed.base);

    if (await pathExists(targetPath)) {
        targetPath = path.join(targetDir, `${parsed.name}-${Date.now()}${parsed.ext}`);
    }

    await fs.rename(sourcePath, targetPath);
    return targetPath;
}

function mergeReport(target: PipelineReport, current: PipelineReport): void {
    target.totalParsed += current.totalParsed;
    target.newlyAdded += current.newlyAdded;
    target.updated += current.updated;
    target.skipped += current.skipped;
}

export async function ingestFromCsvAsync(): Promise<PipelineReport> {
    const report = createEmptyReport();
    const directories = getPromptCsvDirectories();

    await Promise.all([
        ensureDir(directories.inboxDir),
        ensureDir(directories.processedDir),
        ensureDir(directories.failedDir),
    ]);

    const fileNames = await listInboxCsvFiles(directories.inboxDir);
    if (fileNames.length === 0) {
        return report;
    }

    logger.info('CsvIngestion', `从本地目录读取到 ${fileNames.length} 个 CSV 文件`);

    for (const fileName of fileNames) {
        const sourcePath = path.join(directories.inboxDir, fileName);

        try {
            const fileReport = await processSingleCsvAsync(sourcePath);
            mergeReport(report, fileReport);
            await archiveCsvFile(sourcePath, directories.processedDir);
            logger.info('CsvIngestion', `已处理: ${fileName}`);
        } catch (err) {
            logger.error('CsvIngestion', `处理 CSV 失败: ${fileName}`, err);

            if (await pathExists(sourcePath)) {
                await archiveCsvFile(sourcePath, directories.failedDir);
            }
        }
    }

    return report;
}

async function processSingleCsvAsync(csvPath: string): Promise<PipelineReport> {
    const report = createEmptyReport();
    const csvContent = await fs.readFile(csvPath, 'utf-8');

    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
    }) as CsvPromptRow[];

    report.totalParsed = records.length;
    logger.info('CsvIngestion', `解析 ${path.basename(csvPath)}: ${records.length} 条记录`);

    const mediaDir = getMediaDir();
    await ensureDir(mediaDir);

    for (const row of records) {
        const rawTitle = row.title?.trim();
        const content = row.content?.trim();

        if (!rawTitle || !content || content.length < 5) {
            report.skipped++;
            continue;
        }

        try {
            // 检查是否已存在（按 sourceUrl 去重，如无 sourceUrl 则按 title 去重）
            const sourceUrl = row.source_url?.trim() || row.SourceLink?.trim() || row['Source Link']?.trim() || '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let existing: any = null;

            if (sourceUrl) {
                existing = await queryOne(
                    'SELECT Id FROM Prompts WHERE SourceUrl = ?', [sourceUrl]
                );
            }

            if (!existing) {
                existing = await queryOne(
                    'SELECT Id FROM Prompts WHERE RawTitle = ?', [rawTitle]
                );
            }

            if (existing) {
                report.skipped++;
                continue;
            }

            // 直接使用原始标题和描述，不调用 AI 翻译
            const title = rawTitle;
            const description = row.description || '';

            // 分类编码
            const category = row.category?.trim() || 'multimodal-prompts';

            // ─── 媒体资源处理 ───────────────────────────────
            let coverImageUrl: string | null = null;
            let videoPreviewUrl: string | null = null;
            let imagesJson: string | null = null;

            // 处理 SourceMedia / cover_image_url（图片）
            const mediaStr = row.SourceMedia?.trim() || row.cover_image_url?.trim() || '';
            if (mediaStr) {
                if (mediaStr.startsWith('[')) {
                    // JSON 数组格式（老版 CSV）
                    try {
                        const images: string[] = JSON.parse(mediaStr);
                        if (images.length > 0) {
                            // 下载第一张作为封面
                            coverImageUrl = await downloadMedia(images[0], mediaDir);

                            // 下载剩余图片
                            const localImages: string[] = [];
                            if (coverImageUrl) localImages.push(coverImageUrl);
                            for (let i = 1; i < images.length; i++) {
                                const localImg = await downloadMedia(images[i], mediaDir);
                                if (localImg) localImages.push(localImg);
                            }
                            imagesJson = JSON.stringify(localImages);
                        }
                    } catch { /* 解析失败，忽略 */ }
                } else if (mediaStr.startsWith('http')) {
                    // 单个 URL
                    coverImageUrl = await downloadMedia(mediaStr, mediaDir);
                }
            }

            // 处理 SourceVideos / video_preview_url（视频）
            const videoStr = row.SourceVideos?.trim() || row.video_preview_url?.trim() || '';
            if (videoStr) {
                if (videoStr.startsWith('[')) {
                    // JSON 数组格式（老版 CSV，取第一个视频的 url 字段）
                    try {
                        const videos = JSON.parse(videoStr);
                        if (Array.isArray(videos) && videos.length > 0) {
                            const firstVideo = videos[0];
                            videoPreviewUrl = typeof firstVideo === 'string'
                                ? firstVideo
                                : firstVideo?.url || null;
                        }
                    } catch { /* 解析失败，忽略 */ }
                } else if (videoStr.startsWith('http')) {
                    videoPreviewUrl = videoStr;
                }
            }

            // 视频下载策略：优先 yt-dlp（合并音轨），fallback 到直接 HTTP 下载
            if (videoPreviewUrl && videoPreviewUrl.startsWith('http')) {
                // 先尝试 yt-dlp 下载完整视频（含音轨合并）
                const ytDlpResult = await downloadVideoViaYtDlp(videoPreviewUrl, mediaDir);

                // yt-dlp 成功则使用其结果，否则 fallback 到直接下载 + 压缩
                videoPreviewUrl = ytDlpResult || await downloadMedia(videoPreviewUrl, mediaDir);
            }

            // 无封面但有视频 → 提取视频首帧作为封面
            if (!coverImageUrl && videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
                const absoluteVideoPath = path.join(mediaDir, path.basename(videoPreviewUrl));
                logger.info('CsvIngestion', `无图片封面，从视频提取首帧: ${rawTitle}`);
                const coverFileName = await extractFirstFrame(absoluteVideoPath, mediaDir);
                if (coverFileName) {
                    coverImageUrl = `/content/prompts/media/${coverFileName}`;
                    logger.info('CsvIngestion', `首帧封面提取成功: ${coverImageUrl}`);
                }
            }

            // 处理 images 字段（JSON 数组或单 URL）
            if (!imagesJson && row.images?.trim()) {
                imagesJson = row.images.trim();
            }

            // ─── 入库 ─────────────────────────────────────
            const initialCopyCount = Math.floor(Math.random() * 9900) + 100;
            await execute(
                `INSERT INTO Prompts (Title, RawTitle, Description, Content, Category, Source, Author, SourceUrl, CoverImageUrl, VideoPreviewUrl, ImagesJson, CopyCount, IsActive, CreatedAt)
         VALUES (?, ?, ?, ?, ?, 'csv', ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
                [
                    title, rawTitle, description, content,
                    category, row.author || null, sourceUrl || null,
                    coverImageUrl || null,
                    videoPreviewUrl || null,
                    imagesJson || null,
                    initialCopyCount,
                ]
            );

            report.newlyAdded++;
        } catch (err) {
            logger.error('CsvIngestion', `入库失败: ${rawTitle}`, err);
        }
    }

    return report;
}
