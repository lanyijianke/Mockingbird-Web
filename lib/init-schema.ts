import Database from 'better-sqlite3';

interface TableColumnRow {
    name: string;
}

function ensureColumn(
    db: Database.Database,
    tableName: string,
    columnName: string,
    columnDefinition: string
): void {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnRow[];
    if (columns.some((column) => column.name === columnName)) {
        return;
    }

    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

function dropLegacyTables(db: Database.Database): void {
    // Articles has been fully migrated to the local directory source model.
    db.exec('DROP TABLE IF EXISTS Articles');
}

// ════════════════════════════════════════════════════════════════
// SQLite 建表 — 应用启动时调用 initDatabase(db) 自动执行
// ════════════════════════════════════════════════════════════════

export function initDatabase(db: Database.Database): void {
    dropLegacyTables(db);

    db.exec(`
        CREATE TABLE IF NOT EXISTS Prompts (
            Id              INTEGER PRIMARY KEY AUTOINCREMENT,
            Title           TEXT    NOT NULL DEFAULT '',
            RawTitle        TEXT    DEFAULT '',
            Description     TEXT    DEFAULT '',
            Content         TEXT    DEFAULT '',
            Category        TEXT    DEFAULT 'multimodal-prompts',
            Source          TEXT    DEFAULT NULL,
            Author          TEXT    DEFAULT NULL,
            SourceUrl       TEXT    DEFAULT NULL,
            CoverImageUrl   TEXT    DEFAULT NULL,
            VideoPreviewUrl TEXT    DEFAULT NULL,
            CardPreviewVideoUrl TEXT DEFAULT NULL,
            ImagesJson      TEXT    DEFAULT NULL,
            CopyCount       INTEGER DEFAULT 0,
            IsActive        INTEGER DEFAULT 1,
            CreatedAt       TEXT    DEFAULT (datetime('now')),
            UpdatedAt       TEXT    DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS SystemLogs (
            Id          INTEGER PRIMARY KEY AUTOINCREMENT,
            Level       TEXT    NOT NULL DEFAULT 'info',
            Source      TEXT    NOT NULL DEFAULT '',
            Message     TEXT    NOT NULL DEFAULT '',
            Detail      TEXT    DEFAULT NULL,
            CreatedAt   TEXT    DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_systemlogs_level     ON SystemLogs(Level);
        CREATE INDEX IF NOT EXISTS idx_systemlogs_source    ON SystemLogs(Source);
        CREATE INDEX IF NOT EXISTS idx_systemlogs_created   ON SystemLogs(CreatedAt);
    `);

    ensureColumn(db, 'Prompts', 'Title', `TEXT NOT NULL DEFAULT ''`);
    ensureColumn(db, 'Prompts', 'RawTitle', `TEXT DEFAULT ''`);
    ensureColumn(db, 'Prompts', 'Description', `TEXT DEFAULT ''`);
    ensureColumn(db, 'Prompts', 'Content', `TEXT DEFAULT ''`);
    ensureColumn(db, 'Prompts', 'Category', `TEXT DEFAULT 'multimodal-prompts'`);
    ensureColumn(db, 'Prompts', 'Source', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'Author', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'SourceUrl', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'CoverImageUrl', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'VideoPreviewUrl', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'CardPreviewVideoUrl', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'ImagesJson', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'CopyCount', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'Prompts', 'IsActive', 'INTEGER DEFAULT 1');
    ensureColumn(db, 'Prompts', 'CreatedAt', 'TEXT DEFAULT NULL');
    ensureColumn(db, 'Prompts', 'UpdatedAt', 'TEXT DEFAULT NULL');

    db.exec(`
        UPDATE Prompts
        SET CreatedAt = datetime('now')
        WHERE CreatedAt IS NULL
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_prompts_created    ON Prompts(CreatedAt);
        CREATE INDEX IF NOT EXISTS idx_prompts_category   ON Prompts(Category);
        CREATE INDEX IF NOT EXISTS idx_prompts_active     ON Prompts(IsActive);
        CREATE INDEX IF NOT EXISTS idx_prompts_sourceurl  ON Prompts(SourceUrl);
        CREATE INDEX IF NOT EXISTS idx_prompts_rawtitle   ON Prompts(RawTitle);
    `);
}
