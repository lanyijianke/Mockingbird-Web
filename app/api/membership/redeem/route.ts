import { NextRequest, NextResponse } from 'next/server';
import { RequireRole } from '@/lib/auth/require-role';
import { queryOne } from '@/lib/db';
import getDb from '@/lib/db';
import {
    canUpgradeRole,
    getDefaultMembershipDurationDays,
    REDEEM_ALLOWED_ROLES,
} from '@/lib/auth/roles';

export const runtime = 'nodejs';

// ════════════════════════════════════════════════════════════════
// POST /api/membership/redeem — 兑换邀请码成为会员
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        // 要求已登录
        const authResult = await RequireRole(request, REDEEM_ALLOWED_ROLES);
        if (authResult instanceof Response) return authResult;

        const { userId, role: currentRole } = authResult;
        const body = await request.json();
        const { code } = body;

        if (!code) {
            return NextResponse.json({ error: '请输入邀请码' }, { status: 400 });
        }

        // 查找邀请码
        const invitation = await queryOne<{
            Id: number;
            Code: string;
            TargetRole: string;
            MembershipDurationDays: number | null;
            MaxUses: number;
            UsedCount: number;
            ExpiresAt: string;
        }>(
            `SELECT Id, Code, TargetRole, MembershipDurationDays, MaxUses, UsedCount, ExpiresAt
             FROM InvitationCodes
             WHERE Code = ?`,
            [code.trim().toUpperCase()],
        );

        if (!invitation) {
            return NextResponse.json({ error: '邀请码不存在' }, { status: 404 });
        }

        // 检查过期
        const now = new Date();
        const expiresAt = new Date(invitation.ExpiresAt + 'Z');
        if (expiresAt < now) {
            return NextResponse.json({ error: '邀请码已过期' }, { status: 400 });
        }

        // 检查使用次数
        if (invitation.UsedCount >= invitation.MaxUses) {
            return NextResponse.json({ error: '邀请码已被使用完' }, { status: 400 });
        }

        if (!canUpgradeRole(currentRole, invitation.TargetRole)) {
            return NextResponse.json({ error: '当前身份已不低于该邀请码对应等级' }, { status: 400 });
        }

        // 检查是否已兑换过
        const existingRedemption = await queryOne<{ Id: number }>(
            `SELECT Id FROM InvitationRedemptions WHERE UserId = ? AND InvitationCodeId = ?`,
            [userId, invitation.Id],
        );
        if (existingRedemption) {
            return NextResponse.json({ error: '您已使用过该邀请码' }, { status: 400 });
        }

        const membershipDurationDays =
            invitation.MembershipDurationDays && invitation.MembershipDurationDays > 0
                ? invitation.MembershipDurationDays
                : getDefaultMembershipDurationDays(invitation.TargetRole);
        const membershipExpiresAt = new Date(Date.now() + membershipDurationDays * 86400_000)
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d{3}Z$/, '');

        // 原子事务：递增使用次数 + 记录兑换 + 升级角色
        const db = getDb();
        const redeem = db.transaction(() => {
            const updateCode = db.prepare(
                `UPDATE InvitationCodes SET UsedCount = UsedCount + 1 WHERE Id = ?`,
            );
            updateCode.run(invitation.Id);

            const insertRedemption = db.prepare(
                `INSERT INTO InvitationRedemptions (InvitationCodeId, UserId) VALUES (?, ?)`,
            );
            insertRedemption.run(invitation.Id, userId);

            const updateRole = db.prepare(
                `UPDATE Users SET Role = ?, MembershipExpiresAt = ? WHERE Id = ?`,
            );
            updateRole.run(invitation.TargetRole, membershipExpiresAt, userId);
        });

        redeem();

        return NextResponse.json({
            success: true,
            role: invitation.TargetRole,
            message: '恭喜！您已成为会员',
        });
    } catch (err) {
        console.error('[Redeem] Error:', err);
        return NextResponse.json({ error: '兑换失败，请稍后重试' }, { status: 500 });
    }
}
