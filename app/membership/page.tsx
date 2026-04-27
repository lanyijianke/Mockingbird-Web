'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSiteBrandConfig } from '@/lib/site-config';
import { hasAcademyAccess } from '@/lib/auth/roles';

const SITE_BRAND = getSiteBrandConfig();

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  membershipExpiresAt?: string | null;
}

export default function MembershipPage() {
  const router = useRouter();
  const [, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          throw new Error('failed to fetch current user');
        }
        const data = await res.json();
        const nextUser: UserInfo | null = data.user ?? null;
        if (!nextUser) {
          router.push('/login?callbackUrl=/membership');
          return;
        }
        setUser(nextUser);

        // Already has academy access -> redirect to academy
        if (hasAcademyAccess(nextUser.role, nextUser.membershipExpiresAt)) {
          router.push('/academy');
          return;
        }
      } catch {
        router.push('/login?callbackUrl=/membership');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('请输入邀请码');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/membership/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '兑换失败，请重试');
        return;
      }

      setSuccess(true);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="membership-page">
        <div className="membership-card">
          <p className="membership-redirect-text">加载中...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="membership-page">
        <div className="membership-card">
          <div className="membership-success" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            欢迎加入{SITE_BRAND.academyName}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            你已成功成为学社成员，可以访问所有学社内容。
          </p>
          <Link
            href="/academy"
            className="auth-button"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            进入学社
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="membership-page">
      <div className="membership-card">
        <h1 className="membership-heading">加入{SITE_BRAND.academyName}</h1>
        <p className="membership-desc">
          输入邀请码，解锁学社会员专属内容。
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <input
            type="text"
            className="auth-input"
            placeholder="输入邀请码"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? '兑换中...' : '兑换邀请码'}
          </button>
        </form>

        <p className="membership-redirect-text">
          没有邀请码？暂时无法加入。{' '}
          <Link href="/" className="auth-link">返回首页</Link>
        </p>
      </div>
    </div>
  );
}
