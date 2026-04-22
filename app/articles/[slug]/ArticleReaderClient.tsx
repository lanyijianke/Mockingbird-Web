'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface TocItem {
    id: string;
    text: string;
    level: number;
}

interface RelatedArticle {
    href: string;
    slug: string;
    title: string;
    coverUrl: string | null | undefined;
    category: string;
    summary: string;
}

interface ArticleReaderClientProps {
    renderedHtml: string;
    toc: TocItem[];
    title: string;
    categoryName: string;
    dateStr: string;
    readingMinutes: number;
    summary: string;
    articleUrl: string;
    backHref: string;
    relatedArticles: RelatedArticle[];
}

export default function ArticleReaderClient({
    renderedHtml,
    toc,
    title,
    categoryName,
    dateStr,
    readingMinutes,
    summary,
    articleUrl,
    backHref,
    relatedArticles,
}: ArticleReaderClientProps) {
    const [activeId, setActiveId] = useState<string>('');
    const [showBackTop, setShowBackTop] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // ═══ Reading Progress Bar ═══
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            const bar = document.querySelector('.reading-progress-bar') as HTMLElement;
            if (bar) bar.style.width = `${Math.min(progress, 100)}%`;
            setShowBackTop(scrollTop > 500);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ═══ TOC ScrollSpy ═══
    useEffect(() => {
        if (toc.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                }
            },
            { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
        );
        toc.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [toc]);

    // ═══ Code Block Enhancement + Image Lightbox + Reveal Animation ═══
    useEffect(() => {
        const container = contentRef.current;
        if (!container) return;

        // --- Code blocks: inject terminal header ---
        container.querySelectorAll('pre').forEach((pre) => {
            if (pre.querySelector('.code-block-header')) return; // already enhanced
            const code = pre.querySelector('code');
            const lang = code?.className?.match(/language-(\w+)/)?.[1] || 'code';

            const header = document.createElement('div');
            header.className = 'code-block-header';
            header.innerHTML = `
                <div class="code-block-dots">
                    <span class="dot-red"></span>
                    <span class="dot-yellow"></span>
                    <span class="dot-green"></span>
                </div>
                <span class="code-block-lang">${lang}</span>
                <button class="code-copy-btn" title="复制代码">
                    <i class="bi bi-clipboard"></i> 复制
                </button>
            `;
            pre.insertBefore(header, pre.firstChild);

            // Copy button handler
            const btn = header.querySelector('.code-copy-btn')!;
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const text = code?.textContent || '';
                try {
                    await navigator.clipboard.writeText(text);
                    btn.innerHTML = '<i class="bi bi-check2"></i> 已复制';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = '<i class="bi bi-clipboard"></i> 复制';
                        btn.classList.remove('copied');
                    }, 2000);
                } catch { /* fallback not needed for modern browsers */ }
            });
        });

        // --- Images: lightbox click handler ---
        container.querySelectorAll('img').forEach((img) => {
            if (img.dataset.lightboxBound) return;
            img.dataset.lightboxBound = 'true';
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', () => {
                setLightboxSrc(img.src);
            });
        });

        // --- Reveal animation: IntersectionObserver ---
        const revealTargets = container.querySelectorAll('h2, h3, h4, h5, p, pre, blockquote, ul, ol, table');
        revealTargets.forEach((el) => el.classList.add('reveal'));
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );
        revealTargets.forEach((el) => revealObserver.observe(el));
        return () => revealObserver.disconnect();
    }, [renderedHtml]);

    const scrollToId = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        const offset = 100;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    }, []);

    const handleShare = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(articleUrl);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 3000);
        } catch { /* ignored */ }
    }, [articleUrl]);

    return (
        <>
            {/* 阅读进度条 */}
            <div className="reading-progress-track">
                <div className="reading-progress-bar" />
            </div>

            <div className="reader-container">
                {/* 左侧大纲导航 */}
                {toc.length > 0 && (
                    <aside className="article-toc glass">
                        <div className="toc-header">
                            <i className="bi bi-list-ul" /> 目录大纲
                        </div>
                        <nav className="toc-list">
                            {toc.map((item) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    className={`toc-item level-${item.level} ${activeId === item.id ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToId(item.id);
                                    }}
                                >
                                    {item.text}
                                </a>
                            ))}
                        </nav>
                    </aside>
                )}

                <article className="article-reader">
                    {/* 文章头部 */}
                    <header className="reader-header">
                        <div className="reader-meta">
                            <span className="category">{categoryName}</span>
                            <span className="dot">·</span>
                            <span className="date">{dateStr}</span>
                            <span className="dot">·</span>
                            <span className="reading-time">
                                <i className="bi bi-clock" /> 约 {readingMinutes} 分钟
                            </span>
                        </div>
                        <h1 className="reader-title">{title}</h1>
                        <p className="reader-summary">{summary}</p>
                    </header>

                    {/* 文章正文 */}
                    <div
                        ref={contentRef}
                        className="reader-content glass"
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />

                    {/* 底部操作 */}
                    <footer className="reader-footer">
                        <div className="footer-actions">
                            <button className="btn-share" onClick={handleShare}>
                                <i className="bi bi-share" />{' '}
                                {shareSuccess ? '链接已复制' : '分享文章'}
                            </button>
                            <div className="back-link">
                                <Link href={backHref}>
                                    <i className="bi bi-arrow-left" /> 返回列表
                                </Link>
                            </div>
                        </div>
                    </footer>
                </article>
            </div>

            {/* ═══ 推荐阅读 (placed outside reader-container for full width) ═══ */}
            {relatedArticles.length > 0 && (
                <section className="related-section">
                    <div className="related-header">
                        <h2 className="related-title"><i className="bi bi-bookmark-star" /> 推荐阅读</h2>
                    </div>
                    <div className="related-grid">
                        {relatedArticles.map(article => (
                            <Link key={article.slug} href={article.href} className="related-card">
                                <div className="related-card-cover">
                                    <Image
                                        src={article.coverUrl || '/images/default-cover.png'}
                                        alt={article.title}
                                        fill
                                        sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
                                        style={{ objectFit: 'cover' }}
                                    />
                                </div>
                                <div className="related-card-info">
                                    <span className="related-card-category">{article.category}</span>
                                    <h3 className="related-card-title">{article.title}</h3>
                                    {article.summary && (
                                        <p className="related-card-summary">{article.summary}</p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* 返回顶部 */}
            {showBackTop && (
                <button
                    className="back-to-top"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label="返回顶部"
                >
                    <i className="bi bi-chevron-up" />
                </button>
            )}

            {/* 图片灯箱 */}
            {lightboxSrc && (
                <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
                    <Image
                        src={lightboxSrc}
                        alt="放大查看"
                        width={1920}
                        height={1080}
                        className="lightbox-img"
                        unoptimized
                    />
                    <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>
                        <i className="bi bi-x-lg" />
                    </button>
                </div>
            )}

            {/* 分享成功 Toast */}
            {shareSuccess && (
                <div className="share-toast">
                    <i className="bi bi-check-circle-fill" /> 分享链接已复制到剪贴板
                </div>
            )}
        </>
    );
}
