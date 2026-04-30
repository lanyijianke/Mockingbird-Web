import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

const TEST_MYSQL_URL = process.env.MYSQL_URL;

const mockSendVerificationEmail = vi.fn();

vi.mock('@/lib/email/send', () => ({
    sendVerificationEmail: mockSendVerificationEmail,
}));

describe.skipIf(!TEST_MYSQL_URL)('auth routes', () => {
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
        mockSendVerificationEmail.mockResolvedValue({ success: true });
    });

    afterEach(async () => {
        await closeAppDb();
        delete process.env.MYSQL_URL;
    });

    it('POST /api/auth/register creates the user and verification token without logging the user in', async () => {
        const dbName = await createTestDatabase();
        const setupConn = await setupDatabase(dbName);
        await setupConn.end();

        process.env.MYSQL_URL = TEST_MYSQL_URL;
        // Point the pool at our test database by patching the URL
        const { default: getPool, closePool } = await import('@/lib/db');

        // Re-create pool pointing at the test database
        delete process.env.MYSQL_URL;
        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/auth/register/route');
        const request = new Request('http://localhost:5046/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'new-user@example.com',
                password: 'correct-horse-battery',
                name: 'New User',
            }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        // Verify via direct connection
        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [userRows] = await verifyConn.query<
                Array<{ Id: string; Email: string; Name: string; PasswordHash: string }>
            >(`SELECT Id, Email, Name, PasswordHash FROM Users WHERE Email = 'new-user@example.com'`);
            const [tokenRows] = await verifyConn.query<
                Array<{ Token: string; UserId: string }>
            >(`SELECT Token, UserId FROM EmailVerificationTokens LIMIT 1`);
            const [sessionCount] = await verifyConn.query<Array<{ count: number }>>(
                `SELECT COUNT(*) AS count FROM Sessions`,
            );

            expect(response.status).toBe(201);
            expect(body).toMatchObject({
                success: true,
                message: '注册成功，请先验证邮箱',
                user: {
                    email: 'new-user@example.com',
                    name: 'New User',
                },
            });
            expect(userRows.length).toBeGreaterThan(0);
            expect(userRows[0].Name).toBe('New User');
            expect(userRows[0].PasswordHash).not.toBe('correct-horse-battery');
            expect(tokenRows.length).toBeGreaterThan(0);
            expect(tokenRows[0].UserId).toBe(userRows[0].Id);
            expect(mockSendVerificationEmail).toHaveBeenCalledWith('new-user@example.com', tokenRows[0].Token);
            expect(sessionCount[0].count).toBe(0);
            expect(response.headers.get('set-cookie')).toBeNull();
        } finally {
            await verifyConn.end();
        }
    });

    it('POST /api/auth/login returns 200 and writes a session cookie for an existing user with the correct password', async () => {
        const dbName = await createTestDatabase();
        const userId = crypto.randomUUID();
        const setupConn = await setupDatabase(dbName);
        const passwordHash = await bcrypt.hash('correct-horse-battery', 12);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role, EmailVerifiedAt)
             VALUES (?, 'Existing User', 'existing-user@example.com', ?, 'user', NOW())`,
            [userId, passwordHash],
        );
        await setupConn.end();

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/auth/login/route');
        const request = new Request('http://localhost:5046/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'existing-user@example.com',
                password: 'correct-horse-battery',
            }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        // Verify session via direct connection
        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [sessionRows] = await verifyConn.query<
                Array<{ Token: string; UserId: string }>
            >(`SELECT Token, UserId FROM Sessions WHERE UserId = ?`, [userId]);

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                user: {
                    id: userId,
                    email: 'existing-user@example.com',
                    name: 'Existing User',
                    role: 'user',
                    emailVerified: true,
                },
            });
            expect(sessionRows.length).toBeGreaterThan(0);
            expect(response.headers.get('set-cookie')).toContain(`session_token=${sessionRows[0]?.Token}`);
        } finally {
            await verifyConn.end();
        }
    });

    it('POST /api/auth/login rejects password login when the email is not verified', async () => {
        const dbName = await createTestDatabase();
        const userId = crypto.randomUUID();
        const setupConn = await setupDatabase(dbName);
        const passwordHash = await bcrypt.hash('correct-horse-battery', 12);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role, EmailVerifiedAt)
             VALUES (?, 'Pending User', 'pending-user@example.com', ?, 'user', NULL)`,
            [userId, passwordHash],
        );
        await setupConn.end();

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { POST } = await import('@/app/api/auth/login/route');
        const request = new Request('http://localhost:5046/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'pending-user@example.com',
                password: 'correct-horse-battery',
            }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        // Verify no session via direct connection
        const verifyConn = await mysql.createConnection({ ...parseMySqlUrl(TEST_MYSQL_URL!), database: dbName });
        try {
            const [sessionCount] = await verifyConn.query<Array<{ count: number }>>(
                `SELECT COUNT(*) AS count FROM Sessions`,
            );

            expect(response.status).toBe(403);
            expect(body).toEqual({ error: '请先验证邮箱后再登录' });
            expect(sessionCount[0].count).toBe(0);
            expect(response.headers.get('set-cookie')).toBeNull();
        } finally {
            await verifyConn.end();
        }
    });

    it('GET /api/auth/me returns a null user with 200 for anonymous requests', async () => {
        const dbName = await createTestDatabase();
        await setupDatabase(dbName);

        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { GET } = await import('@/app/api/auth/me/route');
        const request = new NextRequest('http://localhost:5046/api/auth/me');

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ user: null });
    });

    it('GET /api/auth/me returns membershipExpiresAt and treats expired members as user', async () => {
        const dbName = await createTestDatabase();
        const userId = crypto.randomUUID();
        const setupConn = await setupDatabase(dbName);
        await setupConn.query(
            `INSERT INTO Users (Id, Name, Email, Role, MembershipExpiresAt, EmailVerifiedAt)
             VALUES (?, 'Expired Member', 'expired-member@example.com', 'senior_member', '2024-01-01 00:00:00', NOW())`,
            [userId],
        );
        await setupConn.end();

        // Create session directly
        const testUrl = buildTestUrl(TEST_MYSQL_URL!, dbName);
        process.env.MYSQL_URL = testUrl;

        const { CreateSession } = await import('@/lib/auth/session');
        const { SetSessionCookie } = await import('@/app/api/auth/helpers');
        const token = await CreateSession(userId);

        const { GET } = await import('@/app/api/auth/me/route');
        const request = new NextRequest('http://localhost:5046/api/auth/me', {
            headers: {
                cookie: SetSessionCookie(token),
            },
        });

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            user: {
                id: userId,
                email: 'expired-member@example.com',
                name: 'Expired Member',
                role: 'user',
                avatarUrl: null,
                emailVerified: true,
                hasPassword: false,
                membershipExpiresAt: '2024-01-01 00:00:00',
                oauthProviders: [],
            },
        });
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
