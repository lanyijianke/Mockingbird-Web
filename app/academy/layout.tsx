'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { hasAcademyAccess } from '@/lib/auth/roles';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  membershipExpiresAt?: string | null;
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
          throw new Error('failed to fetch current user');
        }

        const data = await res.json();
        const user: UserInfo | null = data.user ?? null;
        if (!user) {
          router.push('/login?callbackUrl=/academy');
          return;
        }

        if (hasAcademyAccess(user.role, user.membershipExpiresAt)) {
          setAuthorized(true);
          return;
        }

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
