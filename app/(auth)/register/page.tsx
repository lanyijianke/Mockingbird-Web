'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { getSiteBrandConfig } from '@/lib/site-config';

const SITE_BRAND = getSiteBrandConfig();

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    if (password.length < 8) {
      setError('密码至少 8 个字符');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '注册失败，请重试');
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
          <h1 className="auth-title">注册成功</h1>
          <div className="auth-success" style={{ marginBottom: '1.5rem' }}>
            注册成功！请检查邮箱验证
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            我们已向你的邮箱发送了一封验证邮件，请点击邮件中的链接完成验证。
          </p>
          <Link href="/login" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">注册</h1>
        <p className="auth-subtitle">加入 {SITE_BRAND.siteName}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div>
            <label className="auth-label" htmlFor="name">姓名</label>
            <input
              id="name"
              type="text"
              className="auth-input"
              placeholder="你的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

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
              placeholder="至少 8 个字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="auth-label" htmlFor="confirm-password">确认密码</label>
            <input
              id="confirm-password"
              type="password"
              className="auth-input"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="auth-toggle-text">
          已有账户？<Link href="/login" className="auth-link">登录</Link>
        </div>
      </div>
    </div>
  );
}
