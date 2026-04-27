'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    () => token ? 'loading' : 'error',
  );
  const [message, setMessage] = useState(
    () => token ? '' : '缺少验证令牌，请检查邮件中的链接是否完整。',
  );

  useEffect(() => {
    if (!token) return;

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || '验证失败，请重试');
          return;
        }

        setStatus('success');
        setMessage('邮箱验证成功！');
      } catch {
        setStatus('error');
        setMessage('网络错误，请稍后重试');
      }
    }
    verify();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">邮箱验证</h1>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <p>正在验证...</p>
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="auth-success" style={{ marginBottom: '1.5rem' }}>
              {message}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              你的邮箱已成功验证，现在可以登录了。
            </p>
            <Link href="/login" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              前往登录
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="auth-error" style={{ marginBottom: '1.5rem' }}>
              {message}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              验证链接可能已过期，请重新发送验证邮件。
            </p>
            <Link href="/login" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              返回登录
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
