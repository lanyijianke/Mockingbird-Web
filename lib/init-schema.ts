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

    // ════════════════════════════════════════════════════════════════
    // 用户与认证
    // ════════════════════════════════════════════════════════════════

    db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            Id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            Name            TEXT    NOT NULL DEFAULT '',
            Email           TEXT    NOT NULL UNIQUE,
            PasswordHash    TEXT    DEFAULT NULL,
            AvatarUrl       TEXT    DEFAULT NULL,
            Role            TEXT    NOT NULL DEFAULT 'user',
            MembershipExpiresAt TEXT DEFAULT NULL,
            EmailVerifiedAt TEXT    DEFAULT NULL,
            CreatedAt       TEXT    DEFAULT (datetime('now')),
            UpdatedAt       TEXT    DEFAULT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON Users(Email);
        CREATE INDEX IF NOT EXISTS idx_users_role  ON Users(Role);

        CREATE TABLE IF NOT EXISTS Sessions (
            Id        INTEGER PRIMARY KEY AUTOINCREMENT,
            Token     TEXT    NOT NULL UNIQUE,
            UserId    TEXT    NOT NULL REFERENCES Users(Id),
            ExpiresAt TEXT    NOT NULL,
            CreatedAt TEXT    DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_token    ON Sessions(Token);
        CREATE INDEX IF NOT EXISTS idx_sessions_userId   ON Sessions(UserId);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON Sessions(ExpiresAt);

        CREATE TABLE IF NOT EXISTS OauthAccounts (
            Id                INTEGER PRIMARY KEY AUTOINCREMENT,
            Provider          TEXT    NOT NULL,
            ProviderAccountId TEXT    NOT NULL,
            UserId            TEXT    NOT NULL REFERENCES Users(Id),
            CreatedAt         TEXT    DEFAULT (datetime('now')),
            UNIQUE(Provider, ProviderAccountId)
        );

        CREATE INDEX IF NOT EXISTS idx_oauth_userId ON OauthAccounts(UserId);

        CREATE TABLE IF NOT EXISTS EmailVerificationTokens (
            Id        INTEGER PRIMARY KEY AUTOINCREMENT,
            Token     TEXT    NOT NULL UNIQUE,
            UserId    TEXT    NOT NULL REFERENCES Users(Id),
            ExpiresAt TEXT    NOT NULL,
            CreatedAt TEXT    DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_emailverify_token ON EmailVerificationTokens(Token);

        CREATE TABLE IF NOT EXISTS PasswordResetTokens (
            Id        INTEGER PRIMARY KEY AUTOINCREMENT,
            Token     TEXT    NOT NULL UNIQUE,
            UserId    TEXT    NOT NULL REFERENCES Users(Id),
            ExpiresAt TEXT    NOT NULL,
            CreatedAt TEXT    DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_pwdreset_token ON PasswordResetTokens(Token);
    `);

    ensureColumn(db, 'Users', 'MembershipExpiresAt', 'TEXT DEFAULT NULL');

    db.exec(`
        UPDATE Users
        SET Role = 'junior_member'
        WHERE Role = 'member'
    `);

    // ════════════════════════════════════════════════════════════════
    // 会员邀请
    // ════════════════════════════════════════════════════════════════

    db.exec(`
        CREATE TABLE IF NOT EXISTS InvitationCodes (
            Id         INTEGER PRIMARY KEY AUTOINCREMENT,
            Code       TEXT    NOT NULL UNIQUE,
            TargetRole TEXT    NOT NULL DEFAULT 'junior_member',
            MembershipDurationDays INTEGER NOT NULL DEFAULT 30,
            MaxUses    INTEGER NOT NULL DEFAULT 1,
            UsedCount  INTEGER NOT NULL DEFAULT 0,
            ExpiresAt  TEXT    NOT NULL,
            CreatedAt  TEXT    DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_invite_code ON InvitationCodes(Code);

        CREATE TABLE IF NOT EXISTS InvitationRedemptions (
            Id                INTEGER PRIMARY KEY AUTOINCREMENT,
            InvitationCodeId  INTEGER NOT NULL REFERENCES InvitationCodes(Id),
            UserId            TEXT    NOT NULL REFERENCES Users(Id),
            RedeemedAt        TEXT    DEFAULT (datetime('now')),
            UNIQUE(InvitationCodeId, UserId)
        );

        CREATE INDEX IF NOT EXISTS idx_redemption_user ON InvitationRedemptions(UserId);
    `);

    ensureColumn(db, 'InvitationCodes', 'TargetRole', `TEXT NOT NULL DEFAULT 'junior_member'`);
    ensureColumn(db, 'InvitationCodes', 'MembershipDurationDays', 'INTEGER NOT NULL DEFAULT 30');

    db.exec(`
        UPDATE InvitationCodes
        SET TargetRole = 'junior_member'
        WHERE TargetRole IS NULL OR trim(TargetRole) = '' OR TargetRole = 'member'
    `);

    db.exec(`
        UPDATE InvitationCodes
        SET MembershipDurationDays = CASE
            WHEN TargetRole = 'founder_member' THEN ${999 * 365}
            WHEN TargetRole = 'senior_member' THEN 365
            ELSE 30
        END
        WHERE MembershipDurationDays IS NULL OR MembershipDurationDays <= 0
    `);

    // ════════════════════════════════════════════════════════════════
    // 学院内容
    // ════════════════════════════════════════════════════════════════

    db.exec(`
        CREATE TABLE IF NOT EXISTS AcademyContent (
            Id           INTEGER PRIMARY KEY AUTOINCREMENT,
            Slug         TEXT    NOT NULL UNIQUE,
            Title        TEXT    NOT NULL,
            Summary      TEXT    DEFAULT '',
            Content      TEXT    DEFAULT '',
            Category     TEXT    DEFAULT '',
            CoverImageUrl TEXT   DEFAULT NULL,
            Status       TEXT    NOT NULL DEFAULT 'draft',
            PublishedAt  TEXT    DEFAULT NULL,
            CreatedAt    TEXT    DEFAULT (datetime('now')),
            UpdatedAt    TEXT    DEFAULT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_academy_slug    ON AcademyContent(Slug);
        CREATE INDEX IF NOT EXISTS idx_academy_status  ON AcademyContent(Status);
    `);
}
