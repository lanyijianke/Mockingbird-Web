'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ContentItem {
  slug: string;
  title: string;
  summary?: string;
  createdAt?: string;
}

export default function AcademyPage() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch('/api/academy/content');
        if (!res.ok) {
          setError('加载内容失败');
          return;
        }
        const data = await res.json();
        setContents(data.items || data.content || data || []);
      } catch {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, []);

  return (
    <div className="academy-page">
      <div className="academy-header">
        <h1 className="academy-title">知更鸟学社</h1>
        <p className="academy-subtitle">学社成员专属内容，持续学习、深度成长</p>
      </div>

      {loading && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
          加载中...
        </p>
      )}

      {error && (
        <div className="auth-error">{error}</div>
      )}

      {!loading && !error && contents.length === 0 && (
        <div className="academy-empty">
          <i className="bi bi-journal-bookmark" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }} />
          暂无学社内容，敬请期待
        </div>
      )}

      {!loading && !error && contents.length > 0 && (
        <div className="academy-content-grid">
          {contents.map((item) => (
            <Link
              key={item.slug}
              href={`/academy/content/${item.slug}`}
              className="academy-content-card"
            >
              <h3 className="academy-card-title">{item.title}</h3>
              {item.summary && (
                <p className="academy-card-summary">{item.summary}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
