import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const webRoot = path.resolve(__dirname, '../..');

describe('article ingestion removal', () => {
    it('removes article ingestion and AI pipeline files from Knowledge Web', () => {
        expect(fs.existsSync(path.join(webRoot, 'lib/ai/chat-client.ts'))).toBe(false);
        expect(fs.existsSync(path.join(webRoot, 'lib/pipelines/article-pipeline.ts'))).toBe(false);
    });

    it('keeps remaining pipelines off the legacy pipeline-base module', () => {
        const dependentFiles = [
            'lib/pipelines/media-pipeline.ts',
            'lib/pipelines/prompt-readme-sync.ts',
        ];

        for (const relativePath of dependentFiles) {
            const source = fs.readFileSync(path.join(webRoot, relativePath), 'utf-8');
            expect(source).not.toContain('pipeline-base');
        }
    });

    it('removes console API and transmuter-workshop leftovers from prompt ingestion', () => {
        expect(fs.existsSync(path.join(webRoot, 'lib/utils/console-client.ts'))).toBe(false);

        const gitignoreSource = fs.readFileSync(path.join(webRoot, '.gitignore'), 'utf-8');
        const readmePath = path.join(webRoot, 'README.md');
        const readmeSource = fs.existsSync(readmePath)
            ? fs.readFileSync(readmePath, 'utf-8')
            : '';

        expect(fs.existsSync(path.join(webRoot, 'lib/pipelines/prompt-csv-ingestion.ts'))).toBe(false);
        expect(readmeSource).not.toContain('CONSOLE_API_BASE_URL');
        expect(gitignoreSource).not.toContain('transmuter-workshop/');
    });
});
