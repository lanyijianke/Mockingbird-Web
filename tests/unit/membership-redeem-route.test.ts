import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

const TEST_MYSQL_URL = process.env.MYSQL_URL;

const mockRequireRole = vi.fn();

vi.mock('@/lib/auth/require-role', () => ({
    RequireRole: mockRequireRole,
}));

describe.skipIf(!TEST_MYSQL_URL)('POST /api/membership/redeem', () => {
    let adminConn: mysql.Connection;
    const testDatabases: string[] = [];

    beforeAll(async () => {
        adminConn = await mysql.createConnection(TEST_MYSQL_URL!);
    });

    afterAll(async () => {
        for (const dbName of testDatabases) {
            try {
                await adminConn.query(`DROP DATABASE ${dbName}`);
            } catch {
                // ignore
            }
        }
        await adminConn.end();
    });

    async function createTestDatabase(): Promise<string> {
        const dbName = `mockingbird_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await adminConn.query(`CREATE DATABASE ${dbName}`);
        testDatabases.push(dbName);
        return dbName;
    }

    async function setupDatabase(dbName: string): Promise<mysql.Connection> {
        const conn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        await initDatabase(conn);
        return conn;
    }

    async function closeAppDb(): Promise<void> {
        const { closePool } = await import('@/lib/db');
        await closePool();
    }

    beforeEach(() => {
        vi.resetAllMocks();
        vi.resetModules();
    });

    afterEach(async () => {
        await closeAppDb();
        delete process.env.MYSQL_URL;
    });

    it('upgrades a user to junior_member when redeeming a junior invite', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, 'User One', 'user-1@example.com', 'user', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES ('JUNIOR-001', 'junior_member', 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'user' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'junior-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        // Verify via direct connection
        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<Array<{ Role: string }>>(
                `SELECT Role FROM Users WHERE Id = ?`,
                [userId],
            );
            const [inviteRows] = await verifyConn.query<Array<{ UsedCount: number }>>(
                `SELECT UsedCount FROM InvitationCodes WHERE Code = 'JUNIOR-001'`,
            );

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'junior_member',
            });
            expect(userRows[0].Role).toBe('junior_member');
            expect(inviteRows[0].UsedCount).toBe(1);
        } finally {
            await verifyConn.end();
        }
    });

    it('allows a junior member to upgrade to senior_member', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, 'User Two', 'user-2@example.com', 'junior_member', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES ('SENIOR-001', 'senior_member', 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'junior_member' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'SENIOR-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<Array<{ Role: string }>>(
                `SELECT Role FROM Users WHERE Id = ?`,
                [userId],
            );

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'senior_member',
            });
            expect(userRows[0].Role).toBe('senior_member');
        } finally {
            await verifyConn.end();
        }
    });

    it('rejects invite codes that do not upgrade the current role', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, 'User Three', 'user-3@example.com', 'senior_member', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES ('JUNIOR-002', 'junior_member', 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'senior_member' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'JUNIOR-002' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<Array<{ Role: string }>>(
                `SELECT Role FROM Users WHERE Id = ?`,
                [userId],
            );
            const [inviteRows] = await verifyConn.query<Array<{ UsedCount: number }>>(
                `SELECT UsedCount FROM InvitationCodes WHERE Code = 'JUNIOR-002'`,
            );

            expect(response.status).toBe(400);
            expect(body).toEqual({ error: '当前身份已不低于该邀请码对应等级' });
            expect(userRows[0].Role).toBe('senior_member');
            expect(inviteRows[0].UsedCount).toBe(0);
        } finally {
            await verifyConn.end();
        }
    });

    it('allows a user to upgrade directly to founder_member', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, 'User Four', 'user-4@example.com', 'user', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES ('FOUNDER-001', 'founder_member', 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'user' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'FOUNDER-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<Array<{ Role: string }>>(
                `SELECT Role FROM Users WHERE Id = ?`,
                [userId],
            );

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'founder_member',
            });
            expect(userRows[0].Role).toBe('founder_member');
        } finally {
            await verifyConn.end();
        }
    });

    it('writes MembershipExpiresAt from invite duration without changing invite ExpiresAt', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, MembershipExpiresAt, EmailVerifiedAt) VALUES (?, 'Expired User Four', 'user-4b@example.com', 'junior_member', '2024-01-01 00:00:00', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MembershipDurationDays, MaxUses, UsedCount, ExpiresAt) VALUES ('YEARLY-001', 'senior_member', 365, 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'user' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

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

        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<
                Array<{ Role: string; MembershipExpiresAt: string | null }>
            >(`SELECT Role, MembershipExpiresAt FROM Users WHERE Id = ?`, [userId]);
            const [inviteRows] = await verifyConn.query<
                Array<{ ExpiresAt: string; UsedCount: number }>
            >(`SELECT ExpiresAt, UsedCount FROM InvitationCodes WHERE Code = 'YEARLY-001'`);

            const userRow = userRows[0];
            const inviteRow = inviteRows[0];

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
            await verifyConn.end();
        }
    });

    it('allows a senior member to upgrade to founder_member', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, 'User Five', 'user-5@example.com', 'senior_member', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES ('FOUNDER-002', 'founder_member', 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'senior_member' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'FOUNDER-002' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<Array<{ Role: string }>>(
                `SELECT Role FROM Users WHERE Id = ?`,
                [userId],
            );

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                role: 'founder_member',
            });
            expect(userRows[0].Role).toBe('founder_member');
        } finally {
            await verifyConn.end();
        }
    });

    it('rejects invite codes that match the current role', async () => {
        const userId = crypto.randomUUID();
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, 'User Six', 'user-6@example.com', 'junior_member', NOW())`,
            [userId],
        );
        await setupConn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES ('JUNIOR-003', 'junior_member', 1, 0, '2099-01-01 00:00:00')`,
        );
        await setupConn.end();

        mockRequireRole.mockResolvedValue({ userId, role: 'junior_member' });

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'JUNIOR-003' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<Array<{ Role: string }>>(
                `SELECT Role FROM Users WHERE Id = ?`,
                [userId],
            );
            const [inviteRows] = await verifyConn.query<Array<{ UsedCount: number }>>(
                `SELECT UsedCount FROM InvitationCodes WHERE Code = 'JUNIOR-003'`,
            );

            expect(response.status).toBe(400);
            expect(body).toEqual({ error: '当前身份已不低于该邀请码对应等级' });
            expect(userRows[0].Role).toBe('junior_member');
            expect(inviteRows[0].UsedCount).toBe(0);
        } finally {
            await verifyConn.end();
        }
    });
});

function parseMySqlUrl(url: string): { host: string; port: number; user: string; password: string } {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '3306', 10),
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
    };
}

function buildTestUrl(baseUrl: string, database: string): string {
    const parsed = new URL(baseUrl);
    parsed.pathname = database;
    return parsed.toString();
}
