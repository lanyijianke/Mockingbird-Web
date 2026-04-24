export function getArticleListPath(site: string): string {
    return `/${site}/articles`;
}

export function getArticleCategoryLandingPath(site: string, category: string): string {
    return `${getArticleListPath(site)}/categories/${category}`;
}

export function getArticleDetailPath(site: string, slug: string): string {
    return `/${site}/articles/${slug}`;
}
