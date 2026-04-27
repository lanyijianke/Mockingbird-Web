'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '请求失败，请重试');
        return;
      }

      setSuccess(true);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">邮件已发送</h1>
          <div className="auth-success" style={{ marginBottom: '1.5rem' }}>
            如果邮箱存在，重置邮件已发送
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            请检查你的收件箱（包括垃圾邮件），点击邮件中的链接重置密码。
          </p>
          <Link href="/login" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">忘记密码</h1>
        <p className="auth-subtitle">输入注册邮箱，我们将发送重置链接</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div>
            <label className="auth-label" htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? '发送中...' : '发送重置链接'}
          </button>
        </form>

        <div className="auth-toggle-text">
          <Link href="/login" className="auth-link">返回登录</Link>
        </div>
      </div>
    </div>
  );
}
