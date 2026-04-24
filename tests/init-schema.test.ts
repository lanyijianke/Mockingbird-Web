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
});
