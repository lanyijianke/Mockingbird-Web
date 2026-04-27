'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AcademyLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');

        if (!res.ok) {
          router.push('/login?callbackUrl=/academy');
          return;
        }

        const data = await res.json();
        const user: UserInfo = data.user || data;

        // role is 'user' -> redirect to membership
        if (user.role === 'user') {
          router.push('/membership');
          return;
        }

        // role is 'member' or 'admin' -> allow
        if (user.role === 'member' || user.role === 'admin') {
          setAuthorized(true);
          return;
        }

        // Unknown role -> treat as user
        router.push('/membership');
      } catch {
        router.push('/login?callbackUrl=/academy');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="academy-page">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 0' }}>
          加载中...
        </p>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
