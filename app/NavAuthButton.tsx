'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isExpiredMembership } from '@/lib/auth/roles';
import { useToast } from '@/app/ToastContext';


interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  hasPassword?: boolean;
  membershipExpiresAt?: string | null;
}

export default function NavAuthButton() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        setUser(data.user ?? null);
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setOpen(false);
      window.location.href = '/';
    } catch {
      // Force reload on error
      window.location.href = '/';
    }
  }

  if (loading) {
    return null;
  }

  // Not logged in
  if (!user) {
    return (
      <a
        href="/login"
        className="nav-auth-login"
        onClick={(e) => {
          e.preventDefault();
          showToast('功能建设中，敬请期待 🛠');
        }}
      >
        登录
      </a>
    );
  }

  // Logged in
  const canRedeemMembership = user.role === 'user' || isExpiredMembership(user.role, user.membershipExpiresAt);

  return (
    <div className="nav-auth" ref={wrapperRef} data-open={open ? 'true' : 'false'}>
      <button
        className="nav-auth-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="nav-auth-avatar" />
        ) : (
          <span className="nav-auth-avatar-placeholder">
            {user.name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
        <span className="nav-auth-name">{user.name}</span>
        <i className={`bi bi-chevron-down nav-auth-chevron`} />
      </button>

      {open && (
        <div className="nav-auth-dropdown">
          <div className="nav-auth-dropdown-header">
            <span className="nav-auth-dropdown-name">{user.name}</span>
            <span className="nav-auth-dropdown-email">{user.email}</span>
          </div>

          <Link
            href="/profile"
            className="nav-auth-dropdown-item"
            onClick={() => setOpen(false)}
          >
            <i className="bi bi-person" /> 个人中心
          </Link>

          {canRedeemMembership && (
            <Link
              href="/membership"
              className="nav-auth-dropdown-item"
              onClick={() => setOpen(false)}
            >
              <i className="bi bi-key" /> 会员兑换
            </Link>
          )}

          {user.hasPassword && (
            <Link
              href="/forgot-password"
              className="nav-auth-dropdown-item"
              onClick={() => setOpen(false)}
            >
              <i className="bi bi-key" /> 修改密码
            </Link>
          )}

          <div className="nav-auth-dropdown-divider" />

          <button
            className="nav-auth-dropdown-item nav-auth-dropdown-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <i className="bi bi-box-arrow-right" /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}
