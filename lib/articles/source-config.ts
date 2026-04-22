import path from 'path';
import type { ArticleSourceConfig } from './source-types';

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeConfig(value: unknown, index: number): ArticleSourceConfig {
    if (!value || typeof value !== 'object') {
        throw new Error(`Invalid article source config at index ${index}`);
    }

    const candidate = value as Record<string, unknown>;

    if (!isNonEmptyString(candidate.site)) {
        throw new Error(`Article source ${index} is missing a valid site`);
    }

    if (!isNonEmptyString(candidate.source)) {
        throw new Error(`Article source ${index} is missing a valid source`);
    }

    if (!isNonEmptyString(candidate.rootPath)) {
        throw new Error(`Article source ${index} is missing a valid rootPath`);
    }

    if (!isNonEmptyString(candidate.manifestPath)) {
        throw new Error(`Article source ${index} is missing a valid manifestPath`);
    }

    const rawRootPath = candidate.rootPath.trim();

    return {
        site: candidate.site.trim(),
        source: candidate.source.trim(),
        rootPath: path.isAbsolute(rawRootPath)
            ? rawRootPath
            : path.resolve(process.cwd(), rawRootPath),
        manifestPath: candidate.manifestPath.trim(),
    };
}

export function loadArticleSourceConfigs(
    rawConfig: string | undefined = process.env.ARTICLE_LOCAL_SOURCES
): ArticleSourceConfig[] {
    if (!rawConfig?.trim()) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawConfig);
    } catch (error) {
        throw new Error(`Failed to parse ARTICLE_LOCAL_SOURCES: ${error}`);
    }

    if (!Array.isArray(parsed)) {
        throw new Error('ARTICLE_LOCAL_SOURCES must be a JSON array');
    }

    const configs = parsed.map((entry, index) => normalizeConfig(entry, index));
    const seenPairs = new Set<string>();

    for (const config of configs) {
        const key = `${config.site}::${config.source}`;
        if (seenPairs.has(key)) {
            throw new Error(`Duplicate article source detected for ${key}`);
        }
        seenPairs.add(key);
    }

    return configs;
}
