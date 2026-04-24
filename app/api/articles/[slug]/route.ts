import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/articles/[slug]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const site = new URL(request.url).searchParams.get('site') || 'ai';
    const { getArticleBySlug } = await import('@/lib/services/article-service');
    const article = await getArticleBySlug(slug, { site });

    if (!article) {
        return NextResponse.json(
            { success: false, error: 'Article not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({ success: true, data: article });
}
