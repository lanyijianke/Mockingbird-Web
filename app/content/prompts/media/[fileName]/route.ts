import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { cacheHttpHeaders } from '@/lib/cache/policies';
import { getMediaDir } from '@/lib/pipelines/media-pipeline';

export const runtime = 'nodejs';

function getContentType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        case '.mp4':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        default:
            return 'application/octet-stream';
    }
}

function resolveMediaFilePath(fileName: string): string | null {
    if (!fileName || fileName !== path.basename(fileName) || fileName.includes('\\')) {
        return null;
    }

    const mediaDir = path.resolve(getMediaDir());
    const filePath = path.resolve(mediaDir, fileName);
    if (filePath !== path.join(mediaDir, fileName)) {
        return null;
    }

    return filePath;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ fileName: string }> }
) {
    const { fileName } = await params;
    const filePath = resolveMediaFilePath(fileName);

    if (!filePath) {
        return new NextResponse('Not Found', { status: 404 });
    }

    try {
        const buffer = await fs.readFile(filePath);
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': getContentType(filePath),
                'Cache-Control': cacheHttpHeaders.articleAsset,
            },
        });
    } catch {
        return new NextResponse('Not Found', { status: 404 });
    }
}
