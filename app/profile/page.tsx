'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSiteBrandConfig } from '@/lib/site-config';
import {
  getMembershipExpiryTimestamp,
  isExpiredMembership,
  isMembershipRole,
} from '@/lib/auth/roles';
import { formatUtcStorageDateTimeBeijing } from '@/lib/utils/time-utils';

const SITE_BRAND = getSiteBrandConfig();

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  createdAt?: string;
  hasPassword?: boolean;
  oauthProviders?: string[];
  membershipExpiresAt?: string | null;
}

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  admin: { label: '管理员', className: 'profile-badge-role-admin' },
  junior_member: { label: '普通会员', className: 'profile-badge-role-member' },
  senior_member: { label: '高级会员', className: 'profile-badge-role-member' },
  founder_member: { label: '创始会员', className: 'profile-badge-role-member' },
  user: { label: '普通用户', className: 'profile-badge-role-user' },
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          throw new Error('failed to fetch current user');
        }
        const data = await res.json();
        const nextUser: UserInfo | null = data.user ?? null;
        if (!nextUser) {
          router.push('/login?callbackUrl=/profile');
          return;
        }
        setUser(nextUser);
      } catch {
        router.push('/login?callbackUrl=/profile');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.user;
  const canRedeemMembership = user.role === 'user' || isExpiredMembership(user.role, user.membershipExpiresAt);
  const membershipExpiryTimestamp = getMembershipExpiryTimestamp(user.membershipExpiresAt);

  // Collect login method tags
  const loginMethods: { label: string; icon: string; tagClass?: string }[] = [];
  if (user.hasPassword) {
    loginMethods.push({ label: '密码', icon: 'bi-key', tagClass: 'profile-tag-password' });
  }
  if (user.oauthProviders && user.oauthProviders.length > 0) {
    for (const provider of user.oauthProviders) {
      if (provider === 'github') {
        loginMethods.push({ label: 'GitHub', icon: 'bi-github' });
      } else if (provider === 'google') {
        loginMethods.push({ label: 'Google', icon: 'bi-google' });
      } else {
        loginMethods.push({ label: provider, icon: 'bi-box-arrow-in-right' });
      }
    }
  }
  if (loginMethods.length === 0) {
    loginMethods.push({ label: 'OAuth', icon: 'bi-box-arrow-in-right' });
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Header: avatar + name + email */}
        <div className="profile-header">
          <div className="profile-avatar-large">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="profile-avatar-img" />
            ) : (
              <span className="profile-avatar-placeholder-lg">
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="profile-header-info">
            <div className="profile-name">{user.name}</div>
            <div className="profile-email">{user.email}</div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="profile-section-title">基本信息</div>
        <div className="profile-info-list">
          <div className="profile-info-row">
            <span className="profile-info-label">角色</span>
            <span className="profile-info-value">
              <span className={`profile-badge ${roleInfo.className}`}>
                {roleInfo.label}
              </span>
            </span>
          </div>

          {isMembershipRole(user.role) && membershipExpiryTimestamp !== null && (
            <div className="profile-info-row">
              <span className="profile-info-label">到期时间</span>
              <span className="profile-info-value">
                {formatUtcStorageDateTimeBeijing(user.membershipExpiresAt)}
              </span>
            </div>
          )}

          <div className="profile-info-row">
            <span className="profile-info-label">邮箱验证</span>
            <span className="profile-info-value">
              <span className={`profile-badge ${user.emailVerified ? 'profile-badge-success' : 'profile-badge-warn'}`}>
                {user.emailVerified ? '已验证' : '未验证'}
              </span>
            </span>
          </div>

          {user.createdAt && (
            <div className="profile-info-row">
              <span className="profile-info-label">注册时间</span>
              <span className="profile-info-value">
                {new Date(user.createdAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Login Methods */}
        <div className="profile-section-title">登录方式</div>
        <div className="profile-info-list">
          <div className="profile-info-row">
            <span className="profile-info-label">绑定账号</span>
            <span className="profile-info-value" style={{ gap: '0.4rem' }}>
              {loginMethods.map((method) => (
                <span key={method.label} className={`profile-tag ${method.tagClass || ''}`}>
                  <i className={`bi ${method.icon}`} style={{ fontSize: '0.75rem' }} />
                  {method.label}
                </span>
              ))}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="profile-actions">
          {canRedeemMembership && (
            <Link href="/membership" className="profile-action-link">
              <i className="bi bi-key" /> 会员兑换
            </Link>
          )}

          <Link href="/" className="profile-action-link">
            <i className="bi bi-house" /> 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
