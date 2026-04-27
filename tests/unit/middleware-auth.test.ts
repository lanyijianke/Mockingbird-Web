import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';

describe('auth middleware', () => {
    it('keeps the homepage public for anonymous visitors', () => {
        const request = new NextRequest('http://localhost:5046/');
        const response = middleware(request);

        expect(response.headers.get('x-middleware-next')).toBe('1');
        expect(response.headers.get('location')).toBeNull();
    });

    it('redirects anonymous visitors away from protected pages', () => {
        const request = new NextRequest('http://localhost:5046/profile');
        const response = middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost:5046/login?callbackUrl=%2Fprofile');
    });

    it('lets logged-in users access password recovery pages', () => {
        const request = new NextRequest('http://localhost:5046/forgot-password', {
            headers: {
                cookie: 'session_token=test-session',
            },
        });
        const response = middleware(request);

        expect(response.headers.get('location')).toBeNull();
    });
});
