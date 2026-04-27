import { NextRequest, NextResponse } from 'next/server';
import { RequireRole } from '@/lib/auth/require-role';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// GET /api/academy/content — 获取学院内容列表（需 member 或 admin）
// ════════════════════════════════════════════════════════════════

interface ContentRow {
    Id: number;
    Slug: string;
    Title: string;
    Summary: string;
    Category: string;
    CoverImageUrl: string | null;
    PublishedAt: string;
}

export async function GET(request: NextRequest) {
    try {
        const authResult = await RequireRole(request, ['member', 'admin']);
        if (authResult instanceof Response) return authResult;

        const contents = await query<ContentRow>(
            `SELECT Id, Slug, Title, Summary, Category, CoverImageUrl, PublishedAt
             FROM AcademyContent
             WHERE Status = 'published'
             ORDER BY PublishedAt DESC`,
        );

        return NextResponse.json({ contents });
    } catch (err) {
        console.error('[AcademyContent] Error:', err);
        return NextResponse.json({ error: '获取内容失败' }, { status: 500 });
    }
}
