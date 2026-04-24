import { NextRequest, NextResponse } from 'next/server';
import { parsePaginationParams, parseCountParam, parseSearchQuery, parseCategoryParam } from '@/lib/utils/api-validation';

export const runtime = 'nodejs';

// GET /api/prompts?page=1&pageSize=12&category=1&q=search
export async function GET(request: NextRequest) {
    const { getTopPrompts, getPagedPrompts, getAllPromptIds } = await import('@/lib/services/prompt-service');
    const { searchParams } = new URL(request.url);

    // 路由: /api/prompts?action=top&count=6
    if (searchParams.get('action') === 'top') {
        const count = parseCountParam(searchParams, 6);
        const prompts = await getTopPrompts(count);
        return NextResponse.json({ success: true, data: prompts });
    }

    // 路由: /api/prompts?action=ids (SSG 用)
    if (searchParams.get('action') === 'ids') {
        const ids = await getAllPromptIds();
        return NextResponse.json({ success: true, data: ids });
    }

    // 默认: 分页查询（参数已校验：page≥1, pageSize∈[1,100]）
    const { page, pageSize } = parsePaginationParams(searchParams);
    const category = parseCategoryParam(searchParams);
    const q = parseSearchQuery(searchParams);

    const result = await getPagedPrompts(page, pageSize, category, q);
    return NextResponse.json({ success: true, data: result });
}

// POST /api/prompts → track-copy
export async function POST(request: NextRequest) {
    const { trackCopy } = await import('@/lib/services/prompt-service');
    const body = await request.json();
    const { id, action } = body;

    if (action === 'track-copy' && typeof id === 'number' && id > 0) {
        const success = await trackCopy(id);
        return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
