export interface PromptPreviewVideoElement {
    currentTime: number;
    play: () => Promise<unknown> | unknown;
    pause: () => void;
}

export function resolvePromptCardPreviewUrl(
    cardPreviewVideoUrl: string | null | undefined,
    videoPreviewUrl: string | null | undefined
): string | null {
    return cardPreviewVideoUrl || videoPreviewUrl || null;
}

export async function activatePromptCardPreview(
    video: PromptPreviewVideoElement | null | undefined,
    pointerType: string,
    hoverCapable: boolean
): Promise<boolean> {
    if (!video || !hoverCapable || pointerType !== 'mouse') return false;

    try {
        await video.play();
        return true;
    } catch {
        return false;
    }
}

export function deactivatePromptCardPreview(
    video: PromptPreviewVideoElement | null | undefined
): void {
    if (!video) return;

    video.pause();
    video.currentTime = 0;
}
