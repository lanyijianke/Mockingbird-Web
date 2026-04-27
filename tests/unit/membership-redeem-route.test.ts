import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

const mockRequireRole = vi.fn();

vi.mock('@/lib/auth/require-role', () => ({
    RequireRole: mockRequireRole,
}));

function createTempDbPath(): string {
    return path.join(
        os.tmpdir(),
        `mockingbird-membership-redeem-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
    );
}

function seedDatabase(dbPath: string): Database.Database {
    const db = new Database(dbPath);
    initDatabase(db);
    return db;
}

async function closeAppDb(): Promise<void> {
    const { closePool } = await import('@/lib/db');
    await closePool();
}

describe('POST /api/membership/redeem', () => {
    let dbPath: string;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.resetModules();
        dbPath = createTempDbPath();
        process.env.SQLITE_DB_PATH = dbPath;
    });

    afterEach(async () => {
        await closeAppDb();
        delete process.env.SQLITE_DB_PATH;
        fs.rmSync(dbPath, { force: true });
    });

    it('upgrades a user to junior_member when redeeming a junior invite', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, 'user', datetime('now'))`,
        ).run('user-1', 'User One', 'user-1@example.com');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, 1, 0, ?)`,
        ).run('JUNIOR-001', 'junior_member', '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-1', role: 'user' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'junior-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'junior_member',
            });
            expect(verifyDb.prepare(`SELECT Role FROM Users WHERE Id = ?`).get('user-1')).toEqual({ Role: 'junior_member' });
            expect(verifyDb.prepare(`SELECT UsedCount FROM InvitationCodes WHERE Code = ?`).get('JUNIOR-001')).toEqual({ UsedCount: 1 });
        } finally {
            verifyDb.close();
        }
    });

    it('allows a junior member to upgrade to senior_member', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, 'junior_member', datetime('now'))`,
        ).run('user-2', 'User Two', 'user-2@example.com');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, 1, 0, ?)`,
        ).run('SENIOR-001', 'senior_member', '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-2', role: 'junior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'SENIOR-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'senior_member',
            });
            expect(verifyDb.prepare(`SELECT Role FROM Users WHERE Id = ?`).get('user-2')).toEqual({ Role: 'senior_member' });
        } finally {
            verifyDb.close();
        }
    });

    it('rejects invite codes that do not upgrade the current role', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, 'senior_member', datetime('now'))`,
        ).run('user-3', 'User Three', 'user-3@example.com');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, 1, 0, ?)`,
        ).run('JUNIOR-002', 'junior_member', '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-3', role: 'senior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'JUNIOR-002' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(400);
            expect(body).toEqual({ error: '当前身份已不低于该邀请码对应等级' });
            expect(verifyDb.prepare(`SELECT Role FROM Users WHERE Id = ?`).get('user-3')).toEqual({ Role: 'senior_member' });
            expect(verifyDb.prepare(`SELECT UsedCount FROM InvitationCodes WHERE Code = ?`).get('JUNIOR-002')).toEqual({ UsedCount: 0 });
        } finally {
            verifyDb.close();
        }
    });

    it('allows a user to upgrade directly to founder_member', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, 'user', datetime('now'))`,
        ).run('user-4', 'User Four', 'user-4@example.com');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, 1, 0, ?)`,
        ).run('FOUNDER-001', 'founder_member', '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-4', role: 'user' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'FOUNDER-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'founder_member',
            });
            expect(verifyDb.prepare(`SELECT Role FROM Users WHERE Id = ?`).get('user-4')).toEqual({ Role: 'founder_member' });
        } finally {
            verifyDb.close();
        }
    });

    it('writes MembershipExpiresAt from invite duration without changing invite ExpiresAt', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, MembershipExpiresAt, EmailVerifiedAt)
             VALUES (?, ?, ?, 'junior_member', ?, datetime('now'))`,
        ).run('user-4b', 'Expired User Four', 'user-4b@example.com', '2024-01-01 00:00:00');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MembershipDurationDays, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, ?, 1, 0, ?)`,
        ).run('YEARLY-001', 'senior_member', 365, '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-4b', role: 'user' });

        const beforeRedeem = Date.now();
        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'yearly-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const afterRedeem = Date.now();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            const userRow = verifyDb
                .prepare(`SELECT Role, MembershipExpiresAt FROM Users WHERE Id = ?`)
                .get('user-4b') as { Role: string; MembershipExpiresAt: string | null };
            const inviteRow = verifyDb
                .prepare(`SELECT ExpiresAt, UsedCount FROM InvitationCodes WHERE Code = ?`)
                .get('YEARLY-001') as { ExpiresAt: string; UsedCount: number };

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'senior_member',
            });
            expect(userRow.Role).toBe('senior_member');
            expect(userRow.MembershipExpiresAt).not.toBeNull();
            expect(new Date(`${userRow.MembershipExpiresAt}Z`).getTime()).toBeGreaterThanOrEqual(
                beforeRedeem + 365 * 86400_000 - 60_000,
            );
            expect(new Date(`${userRow.MembershipExpiresAt}Z`).getTime()).toBeLessThanOrEqual(
                afterRedeem + 365 * 86400_000 + 60_000,
            );
            expect(inviteRow).toEqual({
                ExpiresAt: '2099-01-01 00:00:00',
                UsedCount: 1,
            });
        } finally {
            verifyDb.close();
        }
    });

    it('allows a senior member to upgrade to founder_member', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, 'senior_member', datetime('now'))`,
        ).run('user-5', 'User Five', 'user-5@example.com');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, 1, 0, ?)`,
        ).run('FOUNDER-002', 'founder_member', '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-5', role: 'senior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'FOUNDER-002' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'founder_member',
            });
            expect(verifyDb.prepare(`SELECT Role FROM Users WHERE Id = ?`).get('user-5')).toEqual({ Role: 'founder_member' });
        } finally {
            verifyDb.close();
        }
    });

    it('rejects invite codes that match the current role', async () => {
        const db = seedDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, 'junior_member', datetime('now'))`,
        ).run('user-6', 'User Six', 'user-6@example.com');
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt)
             VALUES (?, ?, 1, 0, ?)`,
        ).run('JUNIOR-003', 'junior_member', '2099-01-01 00:00:00');
        db.close();

        mockRequireRole.mockResolvedValue({ userId: 'user-6', role: 'junior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'JUNIOR-003' }),
        });

        const response = await POST(request as never);
        const body = await response.json();
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(400);
            expect(body).toEqual({ error: '当前身份已不低于该邀请码对应等级' });
            expect(verifyDb.prepare(`SELECT Role FROM Users WHERE Id = ?`).get('user-6')).toEqual({ Role: 'junior_member' });
            expect(verifyDb.prepare(`SELECT UsedCount FROM InvitationCodes WHERE Code = ?`).get('JUNIOR-003')).toEqual({ UsedCount: 0 });
        } finally {
            verifyDb.close();
        }
    });
});
