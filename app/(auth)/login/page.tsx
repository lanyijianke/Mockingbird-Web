'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSiteBrandConfig } from '@/lib/site-config';

const SITE_BRAND = getSiteBrandConfig();

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败，请重试');
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">登录</h1>
        <p className="auth-subtitle">欢迎回到 {SITE_BRAND.brandName}</p>

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

          <div>
            <label className="auth-label" htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              className="auth-input"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div style={{ textAlign: 'right' }}>
            <Link href="/forgot-password" className="auth-link">忘记密码？</Link>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="auth-divider">或</div>

        <div className="auth-oauth-group">
          <a href="/api/auth/oauth/github" className="auth-oauth-button auth-oauth-button--github">
            <i className="bi bi-github" /> GitHub 登录
          </a>
          <a href="/api/auth/oauth/google" className="auth-oauth-button auth-oauth-button--google">
            <i className="bi bi-google" /> Google 登录
          </a>
        </div>

        <div className="auth-toggle-text">
          没有账户？<Link href="/register" className="auth-link">注册</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
