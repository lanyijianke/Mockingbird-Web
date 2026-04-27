import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SITE_URL = process.env.SITE_URL;
const ORIGINAL_OAUTH_GITHUB_ID = process.env.OAUTH_GITHUB_ID;

describe('GitHub OAuth route', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.SITE_URL = 'http://localhost:5046';
        process.env.OAUTH_GITHUB_ID = 'github-oauth-client-id';
    });

    afterEach(() => {
        if (ORIGINAL_SITE_URL === undefined) {
            delete process.env.SITE_URL;
        } else {
            process.env.SITE_URL = ORIGINAL_SITE_URL;
        }

        if (ORIGINAL_OAUTH_GITHUB_ID === undefined) {
            delete process.env.OAUTH_GITHUB_ID;
        } else {
            process.env.OAUTH_GITHUB_ID = ORIGINAL_OAUTH_GITHUB_ID;
        }
    });

    it('redirects to the GitHub authorization page when the flow is started without a code', async () => {
        const { GET } = await import('@/app/api/auth/oauth/github/route');
        const request = new NextRequest('http://localhost:5046/api/auth/oauth/github');

        const response = await GET(request);
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).toContain('https://github.com/login/oauth/authorize');
        expect(location).toContain('client_id=github-oauth-client-id');
        expect(decodeURIComponent(location ?? '')).toContain(
            'redirect_uri=http://localhost:5046/api/auth/oauth/github',
        );
        expect(location).toContain('scope=read%3Auser+user%3Aemail');
    });
});
