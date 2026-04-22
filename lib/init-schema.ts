import Database from 'better-sqlite3';

// ════════════════════════════════════════════════════════════════
// SQLite 建表 — 应用启动时调用 initDatabase(db) 自动执行
// ════════════════════════════════════════════════════════════════

export function initDatabase(db: Database.Database): void {
    db.exec(`
        DROP TABLE IF EXISTS Articles;

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
            ImagesJson      TEXT    DEFAULT NULL,
            CopyCount       INTEGER DEFAULT 0,
            IsActive        INTEGER DEFAULT 1,
            CreatedAt       TEXT    DEFAULT (datetime('now')),
            UpdatedAt       TEXT    DEFAULT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_prompts_created    ON Prompts(CreatedAt);
        CREATE INDEX IF NOT EXISTS idx_prompts_category   ON Prompts(Category);
        CREATE INDEX IF NOT EXISTS idx_prompts_active     ON Prompts(IsActive);
        CREATE INDEX IF NOT EXISTS idx_prompts_sourceurl  ON Prompts(SourceUrl);
        CREATE INDEX IF NOT EXISTS idx_prompts_rawtitle   ON Prompts(RawTitle);

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
}
