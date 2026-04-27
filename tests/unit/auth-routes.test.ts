import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetSessionCookie } from '@/app/api/auth/helpers';
import { CreateSession } from '@/lib/auth/session';
import { initDatabase } from '@/lib/init-schema';

const mockSendVerificationEmail = vi.fn();

vi.mock('@/lib/email/send', () => ({
    sendVerificationEmail: mockSendVerificationEmail,
}));

function createTempDbPath(): string {
    return path.join(
        os.tmpdir(),
        `mockingbird-auth-routes-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
    );
}

function setupDatabase(dbPath: string): Database.Database {
    const db = new Database(dbPath);
    initDatabase(db);
    return db;
}

async function closeAppDb(): Promise<void> {
    const { closePool } = await import('@/lib/db');
    await closePool();
}

describe('auth routes', () => {
    let dbPath: string;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.resetModules();
        dbPath = createTempDbPath();
        process.env.SQLITE_DB_PATH = dbPath;
        mockSendVerificationEmail.mockResolvedValue({ success: true });
    });

    afterEach(async () => {
        await closeAppDb();
        delete process.env.SQLITE_DB_PATH;
        fs.rmSync(dbPath, { force: true });
    });

    it('POST /api/auth/register creates the user and verification token without logging the user in', async () => {
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
        const db = new Database(dbPath, { readonly: true });
        try {
            const user = db
                .prepare(`SELECT Id, Email, Name, PasswordHash FROM Users WHERE Email = ?`)
                .get('new-user@example.com') as
                | { Id: string; Email: string; Name: string; PasswordHash: string }
                | undefined;
            const tokenRow = db
                .prepare(`SELECT Token, UserId FROM EmailVerificationTokens`)
                .get() as { Token: string; UserId: string } | undefined;
            expect(response.status).toBe(201);
            expect(body).toMatchObject({
                success: true,
                message: '注册成功，请先验证邮箱',
                user: {
                    email: 'new-user@example.com',
                    name: 'New User',
                },
            });
            expect(user).toBeDefined();
            expect(user?.Name).toBe('New User');
            expect(user?.PasswordHash).not.toBe('correct-horse-battery');
            expect(tokenRow).toBeDefined();
            expect(tokenRow?.UserId).toBe(user?.Id);
            expect(mockSendVerificationEmail).toHaveBeenCalledWith('new-user@example.com', tokenRow?.Token);
            expect(db.prepare(`SELECT COUNT(*) as count FROM Sessions`).get()).toEqual({ count: 0 });
            expect(response.headers.get('set-cookie')).toBeNull();
        } finally {
            db.close();
        }
    });

    it('POST /api/auth/login returns 200 and writes a session cookie for an existing user with the correct password', async () => {
        const passwordHash = await bcrypt.hash('correct-horse-battery', 12);
        const db = setupDatabase(dbPath);

        db.prepare(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, ?, 'user', datetime('now'))`,
        ).run('user-1', 'Existing User', 'existing-user@example.com', passwordHash);
        db.close();

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
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            const sessionRow = verifyDb
                .prepare(`SELECT Token, UserId FROM Sessions WHERE UserId = ?`)
                .get('user-1') as { Token: string; UserId: string } | undefined;

            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                user: {
                    id: 'user-1',
                    email: 'existing-user@example.com',
                    name: 'Existing User',
                    role: 'user',
                    emailVerified: true,
                },
            });
            expect(sessionRow).toBeDefined();
            expect(response.headers.get('set-cookie')).toContain(`session_token=${sessionRow?.Token}`);
        } finally {
            verifyDb.close();
        }
    });

    it('POST /api/auth/login rejects password login when the email is not verified', async () => {
        const passwordHash = await bcrypt.hash('correct-horse-battery', 12);
        const db = setupDatabase(dbPath);

        db.prepare(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role, EmailVerifiedAt)
             VALUES (?, ?, ?, ?, 'user', NULL)`,
        ).run('user-2', 'Pending User', 'pending-user@example.com', passwordHash);
        db.close();

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
        const verifyDb = new Database(dbPath, { readonly: true });
        try {
            expect(response.status).toBe(403);
            expect(body).toEqual({ error: '请先验证邮箱后再登录' });
            expect(verifyDb.prepare(`SELECT COUNT(*) as count FROM Sessions`).get()).toEqual({ count: 0 });
            expect(response.headers.get('set-cookie')).toBeNull();
        } finally {
            verifyDb.close();
        }
    });

    it('GET /api/auth/me returns a null user with 200 for anonymous requests', async () => {
        const { GET } = await import('@/app/api/auth/me/route');
        const request = new NextRequest('http://localhost:5046/api/auth/me');

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ user: null });
    });

    it('GET /api/auth/me returns membershipExpiresAt and treats expired members as user', async () => {
        const db = setupDatabase(dbPath);
        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role, MembershipExpiresAt, EmailVerifiedAt)
             VALUES (?, ?, ?, 'senior_member', ?, datetime('now'))`,
        ).run('user-expired', 'Expired Member', 'expired-member@example.com', '2024-01-01 00:00:00');
        db.close();

        const token = await CreateSession('user-expired');
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
                id: 'user-expired',
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
