import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout from '@/app/layout';

describe('root layout navigation', () => {
    it('renders a homepage link in the right-side navigation', () => {
        const html = renderToStaticMarkup(
            RootLayout({
                children: createElement('div', null, 'test page'),
            })
        );

        const navRightMatch = html.match(/<div class="nav-right">([\s\S]*?)<\/div>/);
        expect(navRightMatch?.[1]).toContain('>首页<');
        expect(navRightMatch?.[1]).toContain('href="/"');
    });

    it('renders a mobile rankings hub link and desktop dropdown links', () => {
        const html = renderToStaticMarkup(
            RootLayout({
                children: createElement('div', null, 'test page'),
            })
        );

        expect(html).toContain('href="/rankings/topics"');
        expect(html).toContain('nav-mobile-only');
        expect(html).toContain('热榜');
        expect(html).toContain('href="/rankings/producthunt"');
        expect(html).toContain('href="/rankings/skills-trending"');
        expect(html).toContain('href="/rankings/skills-hot"');
        expect(html).toContain('nav-desktop-only');
    });
});
