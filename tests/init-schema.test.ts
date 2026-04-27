import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

function getTableNames(db: Database.Database): Array<{ name: string }> {
    return db
        .prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `)
        .all() as Array<{ name: string }>;
}

describe('initDatabase', () => {
    it('removes the legacy Articles table while keeping active tables available', () => {
        const db = new Database(':memory:');
        db.exec(`
            CREATE TABLE Articles (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Title TEXT NOT NULL DEFAULT ''
            );
        `);

        initDatabase(db);

        const tableNames = getTableNames(db).map((row) => row.name);
        expect(tableNames).not.toContain('Articles');
        expect(tableNames).toContain('Prompts');
        expect(tableNames).toContain('SystemLogs');

        db.close();
    });

    it('migrates legacy member roles to junior_member during initialization', () => {
        const db = new Database(':memory:');
        initDatabase(db);

        db.prepare(
            `INSERT INTO Users (Id, Name, Email, Role)
             VALUES ('user-1', 'Legacy Member', 'legacy-member@example.com', 'member')`,
        ).run();
        db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, ExpiresAt)
             VALUES ('LEGACY-001', 'member', '2099-01-01 00:00:00')`,
        ).run();

        initDatabase(db);

        expect(db.prepare(`SELECT Role FROM Users WHERE Id = 'user-1'`).get()).toEqual({
            Role: 'junior_member',
        });
        expect(db.prepare(`SELECT TargetRole FROM InvitationCodes WHERE Code = 'LEGACY-001'`).get()).toEqual({
            TargetRole: 'junior_member',
        });

        db.close();
    });
});
