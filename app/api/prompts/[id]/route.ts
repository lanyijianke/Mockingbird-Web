import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/prompts/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const promptId = parseInt(id, 10);

    if (isNaN(promptId)) {
        return NextResponse.json(
            { success: false, error: 'Invalid prompt ID' },
            { status: 400 }
        );
    }

    const { getPromptById } = await import('@/lib/services/prompt-service');
    const prompt = await getPromptById(promptId);

    if (!prompt) {
        return NextResponse.json(
            { success: false, error: 'Prompt not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({ success: true, data: prompt });
}
