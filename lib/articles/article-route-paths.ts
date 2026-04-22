export function getArticleListPath(site: string): string {
    return `/${site}/articles`;
}

export function getArticleDetailPath(site: string, slug: string): string {
    return `/${site}/articles/${slug}`;
}
