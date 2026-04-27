import { NextRequest, NextResponse } from 'next/server';
import { RequireRole } from '@/lib/auth/require-role';
import { queryOne } from '@/lib/db';
import { ACADEMY_ALLOWED_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// GET /api/academy/content/[slug] — 获取单篇学院内容（需 junior_member+ 或 admin）
// ════════════════════════════════════════════════════════════════

interface ContentDetailRow {
    Id: number;
    Slug: string;
    Title: string;
    Summary: string;
    Content: string;
    Category: string;
    CoverImageUrl: string | null;
    PublishedAt: string;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const authResult = await RequireRole(request, ACADEMY_ALLOWED_ROLES);
        if (authResult instanceof Response) return authResult;

        const { slug } = await params;

        const content = await queryOne<ContentDetailRow>(
            `SELECT Id, Slug, Title, Summary, Content, Category, CoverImageUrl, PublishedAt
             FROM AcademyContent
             WHERE Slug = ? AND Status = 'published'`,
            [slug],
        );

        if (!content) {
            return NextResponse.json({ error: '内容不存在' }, { status: 404 });
        }

        return NextResponse.json({ content });
    } catch (err) {
        console.error('[AcademyContentDetail] Error:', err);
        return NextResponse.json({ error: '获取内容失败' }, { status: 500 });
    }
}
