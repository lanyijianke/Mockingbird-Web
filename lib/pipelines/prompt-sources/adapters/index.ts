import type { PromptSourceAdapter, PromptSourceConfig } from '../types';
import { githubReadmeYouMindAdapter } from './github-readme-yoomind';

export const promptSourceAdapters: PromptSourceAdapter[] = [
    githubReadmeYouMindAdapter,
];

export function selectPromptSourceAdapter(source: PromptSourceConfig): PromptSourceAdapter | null {
    if (source.adapter) {
        return promptSourceAdapters.find((adapter) => adapter.id === source.adapter) || null;
    }

    return promptSourceAdapters.find((adapter) => adapter.canHandle(source)) || null;
}
