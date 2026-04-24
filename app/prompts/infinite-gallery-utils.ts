export interface PromptInfiniteGalleryQuery {
    page: number;
    pageSize: number;
    category?: string;
    q?: string;
}

export interface PromptInfiniteGalleryResetInput {
    category?: string;
    q?: string;
}

export function hasNextPromptPage(page: number, totalPages: number): boolean {
    return page < totalPages;
}

export function buildPromptPageApiUrl({ page, pageSize, category, q }: PromptInfiniteGalleryQuery): string {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
    });

    if (category) params.set('category', category);
    if (q) params.set('q', q);

    return `/api/prompts?${params.toString()}`;
}

export function buildPromptGalleryResetKey({ category, q }: PromptInfiniteGalleryResetInput): string {
    return `${category || 'all'}::${q || ''}`;
}
