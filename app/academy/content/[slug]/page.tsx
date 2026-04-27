'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ContentData {
  title: string;
  content: string;
  createdAt?: string;
}

export default function AcademyContentPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch(`/api/academy/content/${slug}`);
        if (!res.ok) {
          setError('内容不存在或加载失败');
          return;
        }
        const data = await res.json();
        setContent(data.item || data.content || data);
      } catch {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchContent();
    }
  }, [slug]);

  /**
   * Basic markdown rendering: headings, paragraphs, bold, italic,
   * links, code blocks, inline code, blockquotes, lists.
   */
  function renderMarkdown(md: string): string {
    let html = md;

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) =>
      `<pre><code>${escapeHtml(code.trim())}</code></pre>`
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Paragraphs: wrap remaining lines that aren't already tags
    html = html.replace(/^(?!<[hupob]|<li|<\/|<pre|<code|<strong|<em|<a )(.+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return (
    <div className="academy-page">
      <Link href="/academy" className="academy-back-link">
        <i className="bi bi-arrow-left" /> 返回学社
      </Link>

      {loading && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
          加载中...
        </p>
      )}

      {error && (
        <div className="auth-error">{error}</div>
      )}

      {!loading && !error && content && (
        <div className="academy-article">
          <h1 className="academy-article-title">{content.title}</h1>
          {content.createdAt && (
            <div className="academy-article-meta">
              <span>{new Date(content.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
          )}
          <div
            className="academy-article-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content.content) }}
          />
        </div>
      )}
    </div>
  );
}
