import { parseUtcStorageDate } from '@/lib/utils/time-utils';

const ROLE_RANKS = {
    user: 0,
    junior_member: 1,
    senior_member: 2,
    founder_member: 3,
    admin: 4,
} as const;

export type Role = keyof typeof ROLE_RANKS;
const LEGACY_ROLE_ALIASES: Record<string, Role> = {
    member: 'junior_member',
};

export const MEMBERSHIP_ROLES: Role[] = [
    'junior_member',
    'senior_member',
    'founder_member',
];

export const ACADEMY_ALLOWED_ROLES: Role[] = [
    'junior_member',
    'senior_member',
    'founder_member',
    'admin',
];

export const REDEEM_ALLOWED_ROLES: Role[] = [
    'user',
    'junior_member',
    'senior_member',
    'founder_member',
    'admin',
];

export function normalizeRole(role: string): string {
    return LEGACY_ROLE_ALIASES[role] ?? role;
}

export function getRoleRank(role: string): number {
    return ROLE_RANKS[normalizeRole(role) as Role] ?? -1;
}

export function isMembershipRole(role: string): role is Role {
    return MEMBERSHIP_ROLES.includes(normalizeRole(role) as Role);
}

export function getMembershipExpiryTimestamp(membershipExpiresAt?: string | null): number | null {
    const parsed = parseUtcStorageDate(membershipExpiresAt);
    return parsed ? parsed.getTime() : null;
}

export function isExpiredMembership(role: string, membershipExpiresAt?: string | null): boolean {
    if (!isMembershipRole(role)) {
        return false;
    }

    const expiryTimestamp = getMembershipExpiryTimestamp(membershipExpiresAt);
    return expiryTimestamp !== null && expiryTimestamp <= Date.now();
}

export function hasAcademyAccess(role: string, membershipExpiresAt?: string | null): boolean {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'admin') {
        return true;
    }

    if (!ACADEMY_ALLOWED_ROLES.includes(normalizedRole as Role)) {
        return false;
    }

    return !isExpiredMembership(normalizedRole, membershipExpiresAt);
}

export function getDefaultMembershipDurationDays(role: string): number {
    switch (normalizeRole(role)) {
        case 'founder_member':
            return 999 * 365;
        case 'senior_member':
            return 365;
        case 'junior_member':
            return 30;
        default:
            return 30;
    }
}

export function getEffectiveRole(role: string, membershipExpiresAt?: string | null): string {
    const normalizedRole = normalizeRole(role);

    if (!membershipExpiresAt || !isMembershipRole(normalizedRole)) {
        return normalizedRole;
    }

    const expiresAt = getMembershipExpiryTimestamp(membershipExpiresAt);
    if (expiresAt === null) {
        return normalizedRole;
    }

    return expiresAt <= Date.now() ? 'user' : normalizedRole;
}

export function canUpgradeRole(currentRole: string, targetRole: string): boolean {
    if (!isMembershipRole(targetRole)) {
        return false;
    }

    return getRoleRank(targetRole) > getRoleRank(currentRole);
}
