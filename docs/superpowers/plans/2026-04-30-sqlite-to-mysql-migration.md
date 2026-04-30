# SQLite → MySQL 迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Mockingbird Knowledge Web 的数据库从 SQLite（better-sqlite3）替换为 MySQL（mysql2），保持所有业务逻辑不变。

**Architecture:** 重写 `lib/db.ts` 连接层为 mysql2 连接池；适配 `lib/init-schema.ts` 中的 SQL 语法差异；将 `membership/redeem` 中的同步事务改为异步；其余路由层因已使用 async wrapper 而几乎无改动。

**Tech Stack:** mysql2/promise, crypto.randomUUID(), Vitest

---

## 文件变更总览

| 文件 | 操作 | 职责 |
|------|------|------|
| `lib/db.ts` | 重写 | mysql2 连接池 + query/queryOne/queryScalar/execute/transaction/closePool |
| `lib/init-schema.ts` | 重写 | MySQL 语法建表 + INFORMATION_SCHEMA 列迁移 |
| `app/api/membership/redeem/route.ts` | 修改 | getDb().transaction() → await transaction() |
| `lib/services/log-service.ts` | 修改 | datetime('now') → NOW(), 日期计算语法 |
| `lib/auth/session.ts` | 修改 | datetime('now') → NOW() |
| `app/api/auth/verify-email/route.ts` | 修改 | datetime('now') → NOW() |
| `app/api/auth/reset-password/route.ts` | 修改 | datetime('now') → NOW() |
| `lib/pipelines/prompt-sources/remote-sync.ts` | 修改 | datetime('now') → NOW() |
| `app/api/auth/register/route.ts` | 修改 | INSERT Users 增加 Id 字段（crypto.randomUUID） |
| `app/api/auth/helpers.ts` | 修改 | INSERT Users 增加 Id 字段 |
| `scripts/generate-invite-codes.mjs` | 重写 | better-sqlite3 → mysql2 |
| `scripts/gen-invite.ts` | 重写 | better-sqlite3 → mysql2 |
| `scripts/migrate-sqlite-to-mysql.ts` | 新建 | 一次性数据迁移脚本 |
| `tests/init-schema.test.ts` | 重写 | MySQL 测试 |
| `tests/unit/init-schema-prompt-preview.test.ts` | 重写 | MySQL 测试 |
| `tests/unit/auth-routes.test.ts` | 重写 | MySQL 测试 |
| `tests/unit/membership-redeem-route.test.ts` | 重写 | MySQL 测试 |
| `.env.example` | 修改 | SQLITE_DB_PATH → MYSQL_URL |
| `package.json` | 修改 | 依赖替换 |
| `CLAUDE.md` | 修改 | 更新数据库文档 |
| `.gitignore` | 修改 | 移除 data/ 条目 |

---

### Task 1: 安装 mysql2 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 mysql2**

```bash
npm install mysql2
```

- [ ] **Step 2: 验证安装**

Run: `node -e "const mysql = require('mysql2/promise'); console.log('mysql2 OK')"`
Expected: "mysql2 OK"

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mysql2 dependency for SQLite→MySQL migration"
```

---

### Task 2: 重写 lib/db.ts — 连接层

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: 重写 lib/db.ts**

将 `lib/db.ts` 的全部内容替换为：

```typescript
import mysql from 'mysql2/promise';
import { initDatabase } from './init-schema';

// ────────────────────────────────────────────────────────────────
// MySQL 数据库 — mysql2/promise 连接池
// ────────────────────────────────────────────────────────────────

type QueryParams = (string | number | boolean | null | Buffer | Date)[];

let pool: mysql.Pool | null = null;

async function getPool(): Promise<mysql.Pool> {
    if (!pool) {
        const url = process.env.MYSQL_URL;
        if (!url) {
            throw new Error('MYSQL_URL 环境变量未设置');
        }

        pool = mysql.createPool(url, {
            waitForConnections: true,
            connectionLimit: 10,
            charset: 'utf8mb4',
        });

        // 自动建表
        const conn = await pool.getConnection();
        try {
            await initDatabase(conn);
            console.log('[DB] MySQL 已连接');
        } finally {
            conn.release();
        }
    }
    return pool;
}

/**
 * 查询多行数据
 */
export async function query<T = Record<string, unknown>>(
    sql: string,
    params?: QueryParams
): Promise<T[]> {
    const [rows] = await (await getPool()).query(sql, params);
    return rows as T[];
}

/**
 * 查询单行数据
 */
export async function queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: QueryParams
): Promise<T | null> {
    const [rows] = await (await getPool()).query(sql, params);
    const arr = rows as T[];
    return arr.length > 0 ? arr[0] : null;
}

/**
 * 查询标量值（COUNT 等聚合）
 */
export async function queryScalar<T = number>(
    sql: string,
    params?: QueryParams
): Promise<T | null> {
    const [rows] = await (await getPool()).query(sql, params);
    const arr = rows as Record<string, unknown>[];
    if (arr.length === 0) return null;
    return arr[0][Object.keys(arr[0])[0]] as T;
}

/**
 * 执行写操作 (INSERT / UPDATE / DELETE)
 */
export async function execute(
    sql: string,
    params?: QueryParams
): Promise<{ affectedRows: number; insertId: number }> {
    const [result] = await (await getPool()).query(sql, params);
    const rs = result as mysql.ResultSetHeader;
    return { affectedRows: rs.affectedRows, insertId: rs.insertId };
}

/**
 * 异步事务封装
 */
export async function transaction<T>(
    fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
    const p = await getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

export default getPool;
```

- [ ] **Step 2: Commit**

```bash
git add lib/db.ts
git commit -m "feat: rewrite lib/db.ts to use mysql2 connection pool"
```

---

### Task 3: 重写 lib/init-schema.ts — MySQL 语法适配

**Files:**
- Modify: `lib/init-schema.ts`

- [ ] **Step 1: 重写 lib/init-schema.ts**

将 `lib/init-schema.ts` 的全部内容替换为：

```typescript
import type { PoolConnection } from 'mysql2/promise';

interface ColumnRow {
    COLUMN_NAME: string;
}

async function ensureColumn(
    conn: PoolConnection,
    tableName: string,
    columnName: string,
    columnDefinition: string
): Promise<void> {
    const [rows] = await conn.query<ColumnRow[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    if (rows.length > 0) {
        return;
    }

    await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

async function dropLegacyTables(conn: PoolConnection): Promise<void> {
    await conn.query('DROP TABLE IF EXISTS Articles');
}

// ════════════════════════════════════════════════════════════════
// MySQL 建表 — 应用启动时调用 initDatabase(conn) 自动执行
// ════════════════════════════════════════════════════════════════

export async function initDatabase(conn: PoolConnection): Promise<void> {
    await dropLegacyTables(conn);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS Prompts (
            Id              INT PRIMARY KEY AUTO_INCREMENT,
            Title           VARCHAR(500) NOT NULL DEFAULT '',
            RawTitle        VARCHAR(500) DEFAULT '',
            Description     TEXT DEFAULT NULL,
            Content         LONGTEXT DEFAULT NULL,
            Category        VARCHAR(100) DEFAULT 'multimodal-prompts',
            Source          VARCHAR(200) DEFAULT NULL,
            Author          VARCHAR(200) DEFAULT NULL,
            SourceUrl       VARCHAR(1000) DEFAULT NULL,
            CoverImageUrl   VARCHAR(1000) DEFAULT NULL,
            VideoPreviewUrl VARCHAR(1000) DEFAULT NULL,
            CardPreviewVideoUrl VARCHAR(1000) DEFAULT NULL,
            ImagesJson      LONGTEXT DEFAULT NULL,
            CopyCount       INT DEFAULT 0,
            IsActive        TINYINT(1) DEFAULT 1,
            CreatedAt       DATETIME DEFAULT NOW(),
            UpdatedAt       DATETIME DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS SystemLogs (
            Id          INT PRIMARY KEY AUTO_INCREMENT,
            Level       VARCHAR(20) NOT NULL DEFAULT 'info',
            Source      VARCHAR(200) NOT NULL DEFAULT '',
            Message     TEXT NOT NULL,
            Detail      TEXT DEFAULT NULL,
            CreatedAt   DATETIME DEFAULT NOW()
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
        CREATE INDEX idx_systemlogs_level   ON SystemLogs(Level);
        CREATE INDEX idx_systemlogs_source  ON SystemLogs(Source);
        CREATE INDEX idx_systemlogs_created ON SystemLogs(CreatedAt)
    `);

    await ensureColumn(conn, 'Prompts', 'Title', `VARCHAR(500) NOT NULL DEFAULT ''`);
    await ensureColumn(conn, 'Prompts', 'RawTitle', `VARCHAR(500) DEFAULT ''`);
    await ensureColumn(conn, 'Prompts', 'Description', `TEXT DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'Content', `LONGTEXT DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'Category', `VARCHAR(100) DEFAULT 'multimodal-prompts'`);
    await ensureColumn(conn, 'Prompts', 'Source', `VARCHAR(200) DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'Author', `VARCHAR(200) DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'SourceUrl', `VARCHAR(1000) DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'CoverImageUrl', `VARCHAR(1000) DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'VideoPreviewUrl', `VARCHAR(1000) DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'CardPreviewVideoUrl', `VARCHAR(1000) DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'ImagesJson', `LONGTEXT DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'CopyCount', `INT DEFAULT 0`);
    await ensureColumn(conn, 'Prompts', 'IsActive', `TINYINT(1) DEFAULT 1`);
    await ensureColumn(conn, 'Prompts', 'CreatedAt', `DATETIME DEFAULT NULL`);
    await ensureColumn(conn, 'Prompts', 'UpdatedAt', `DATETIME DEFAULT NULL`);

    await conn.query(`
        UPDATE Prompts
        SET CreatedAt = NOW()
        WHERE CreatedAt IS NULL
    `);

    await conn.query(`
        CREATE INDEX idx_prompts_created   ON Prompts(CreatedAt);
        CREATE INDEX idx_prompts_category  ON Prompts(Category);
        CREATE INDEX idx_prompts_active    ON Prompts(IsActive);
        CREATE INDEX idx_prompts_sourceurl ON Prompts(SourceUrl);
        CREATE INDEX idx_prompts_rawtitle  ON Prompts(RawTitle)
    `);

    // ════════════════════════════════════════════════════════════════
    // 用户与认证
    // ════════════════════════════════════════════════════════════════

    await conn.query(`
        CREATE TABLE IF NOT EXISTS Users (
            Id              VARCHAR(36) PRIMARY KEY,
            Name            VARCHAR(200) NOT NULL DEFAULT '',
            Email           VARCHAR(255) NOT NULL,
            PasswordHash    VARCHAR(255) DEFAULT NULL,
            AvatarUrl       VARCHAR(1000) DEFAULT NULL,
            Role            VARCHAR(50) NOT NULL DEFAULT 'user',
            MembershipExpiresAt DATETIME DEFAULT NULL,
            EmailVerifiedAt DATETIME DEFAULT NULL,
            CreatedAt       DATETIME DEFAULT NOW(),
            UpdatedAt       DATETIME DEFAULT NULL,
            UNIQUE INDEX idx_users_email (Email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`CREATE INDEX idx_users_role ON Users(Role)`);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS Sessions (
            Id        INT PRIMARY KEY AUTO_INCREMENT,
            Token     VARCHAR(200) NOT NULL,
            UserId    VARCHAR(36) NOT NULL,
            ExpiresAt DATETIME NOT NULL,
            CreatedAt DATETIME DEFAULT NOW(),
            UNIQUE INDEX idx_sessions_token (Token),
            INDEX idx_sessions_userId (UserId),
            INDEX idx_sessions_expires (ExpiresAt),
            FOREIGN KEY (UserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS OauthAccounts (
            Id                INT PRIMARY KEY AUTO_INCREMENT,
            Provider          VARCHAR(50) NOT NULL,
            ProviderAccountId VARCHAR(255) NOT NULL,
            UserId            VARCHAR(36) NOT NULL,
            CreatedAt         DATETIME DEFAULT NOW(),
            UNIQUE INDEX idx_oauth_provider (Provider, ProviderAccountId),
            INDEX idx_oauth_userId (UserId),
            FOREIGN KEY (UserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS EmailVerificationTokens (
            Id        INT PRIMARY KEY AUTO_INCREMENT,
            Token     VARCHAR(200) NOT NULL,
            UserId    VARCHAR(36) NOT NULL,
            ExpiresAt DATETIME NOT NULL,
            CreatedAt DATETIME DEFAULT NOW(),
            UNIQUE INDEX idx_emailverify_token (Token),
            FOREIGN KEY (UserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS PasswordResetTokens (
            Id        INT PRIMARY KEY AUTO_INCREMENT,
            Token     VARCHAR(200) NOT NULL,
            UserId    VARCHAR(36) NOT NULL,
            ExpiresAt DATETIME NOT NULL,
            CreatedAt DATETIME DEFAULT NOW(),
            UNIQUE INDEX idx_pwdreset_token (Token),
            FOREIGN KEY (UserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureColumn(conn, 'Users', 'MembershipExpiresAt', 'DATETIME DEFAULT NULL');

    await conn.query(`
        UPDATE Users
        SET Role = 'junior_member'
        WHERE Role = 'member'
    `);

    // ════════════════════════════════════════════════════════════════
    // 会员邀请
    // ════════════════════════════════════════════════════════════════

    await conn.query(`
        CREATE TABLE IF NOT EXISTS InvitationCodes (
            Id         INT PRIMARY KEY AUTO_INCREMENT,
            Code       VARCHAR(50) NOT NULL,
            TargetRole VARCHAR(50) NOT NULL DEFAULT 'junior_member',
            MembershipDurationDays INT NOT NULL DEFAULT 30,
            MaxUses    INT NOT NULL DEFAULT 1,
            UsedCount  INT NOT NULL DEFAULT 0,
            ExpiresAt  DATETIME NOT NULL,
            CreatedAt  DATETIME DEFAULT NOW(),
            UNIQUE INDEX idx_invite_code (Code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS InvitationRedemptions (
            Id                INT PRIMARY KEY AUTO_INCREMENT,
            InvitationCodeId  INT NOT NULL,
            UserId            VARCHAR(36) NOT NULL,
            RedeemedAt        DATETIME DEFAULT NOW(),
            UNIQUE INDEX idx_redemption_unique (InvitationCodeId, UserId),
            INDEX idx_redemption_user (UserId),
            FOREIGN KEY (InvitationCodeId) REFERENCES InvitationCodes(Id),
            FOREIGN KEY (UserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureColumn(conn, 'InvitationCodes', 'TargetRole', `VARCHAR(50) NOT NULL DEFAULT 'junior_member'`);
    await ensureColumn(conn, 'InvitationCodes', 'MembershipDurationDays', 'INT NOT NULL DEFAULT 30');

    await conn.query(`
        UPDATE InvitationCodes
        SET TargetRole = 'junior_member'
        WHERE TargetRole IS NULL OR TRIM(TargetRole) = '' OR TargetRole = 'member'
    `);

    await conn.query(`
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

    await conn.query(`
        CREATE TABLE IF NOT EXISTS AcademyContent (
            Id           INT PRIMARY KEY AUTO_INCREMENT,
            Slug         VARCHAR(200) NOT NULL,
            Title        VARCHAR(500) NOT NULL,
            Summary      TEXT DEFAULT NULL,
            Content      LONGTEXT DEFAULT NULL,
            Category     VARCHAR(100) DEFAULT '',
            CoverImageUrl VARCHAR(1000) DEFAULT NULL,
            Status       VARCHAR(50) NOT NULL DEFAULT 'draft',
            PublishedAt  DATETIME DEFAULT NULL,
            CreatedAt    DATETIME DEFAULT NOW(),
            UpdatedAt    DATETIME DEFAULT NULL,
            UNIQUE INDEX idx_academy_slug (Slug),
            INDEX idx_academy_status (Status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/init-schema.ts
git commit -m "feat: rewrite init-schema.ts with MySQL syntax"
```

---

### Task 4: 适配 membership/redeem 事务

**Files:**
- Modify: `app/api/membership/redeem/route.ts`

这是唯一一个使用同步 `getDb().transaction()` 的路由。需要改为 `await transaction()`。

- [ ] **Step 1: 替换事务代码**

在 `app/api/membership/redeem/route.ts` 中：

1. 将第 4 行 `import getDb from '@/lib/db';` 改为：
```typescript
import { queryOne, transaction } from '@/lib/db';
```

2. 将第 86-104 行的事务代码：

```typescript
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
```

替换为：

```typescript
        await transaction(async (conn) => {
            await conn.query(
                `UPDATE InvitationCodes SET UsedCount = UsedCount + 1 WHERE Id = ?`,
                [invitation.Id],
            );
            await conn.query(
                `INSERT INTO InvitationRedemptions (InvitationCodeId, UserId) VALUES (?, ?)`,
                [invitation.Id, userId],
            );
            await conn.query(
                `UPDATE Users SET Role = ?, MembershipExpiresAt = ? WHERE Id = ?`,
                [invitation.TargetRole, membershipExpiresAt, userId],
            );
        });
```

- [ ] **Step 2: Commit**

```bash
git add app/api/membership/redeem/route.ts
git commit -m "feat: convert membership redeem to async MySQL transaction"
```

---

### Task 5: 适配 SQL 语法 — datetime('now') → NOW()

**Files:**
- Modify: `lib/services/log-service.ts`
- Modify: `lib/auth/session.ts`
- Modify: `app/api/auth/verify-email/route.ts`
- Modify: `app/api/auth/reset-password/route.ts`
- Modify: `lib/pipelines/prompt-sources/remote-sync.ts`

- [ ] **Step 1: 修改 lib/services/log-service.ts**

将第 39 行的 `datetime('now')` 替换为 `NOW()`：
```typescript
// 之前
`INSERT INTO SystemLogs (Level, Source, Message, Detail, CreatedAt) VALUES (?, ?, ?, ?, datetime('now'))`
// 之后
`INSERT INTO SystemLogs (Level, Source, Message, Detail, CreatedAt) VALUES (?, ?, ?, ?, NOW())`
```

将第 112 行的 SQLite 日期计算替换为 MySQL 语法：
```typescript
// 之前
`DELETE FROM SystemLogs WHERE CreatedAt < datetime('now', '-' || ? || ' days')`
// 之后
`DELETE FROM SystemLogs WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL ? DAY)`
```

- [ ] **Step 2: 修改 lib/auth/session.ts**

将第 45 行的 `datetime('now')` 替换为 `NOW()`：
```typescript
// 之前
WHERE Token = ? AND ExpiresAt > datetime('now')
// 之后
WHERE Token = ? AND ExpiresAt > NOW()
```

- [ ] **Step 3: 修改 app/api/auth/verify-email/route.ts**

将第 27 行的 `datetime('now')` 替换为 `NOW()`：
```typescript
// 之前
WHERE Token = ? AND ExpiresAt > datetime('now')
// 之后
WHERE Token = ? AND ExpiresAt > NOW()
```

将第 37 行的 `datetime('now')` 替换为 `NOW()`：
```typescript
// 之前
`UPDATE Users SET EmailVerifiedAt = datetime('now') WHERE Id = ?`
// 之后
`UPDATE Users SET EmailVerifiedAt = NOW() WHERE Id = ?`
```

- [ ] **Step 4: 修改 app/api/auth/reset-password/route.ts**

将第 32 行的 `datetime('now')` 替换为 `NOW()`：
```typescript
// 之前
WHERE Token = ? AND ExpiresAt > datetime('now')
// 之后
WHERE Token = ? AND ExpiresAt > NOW()
```

- [ ] **Step 5: 修改 lib/pipelines/prompt-sources/remote-sync.ts**

将第 145 行的 `datetime('now')` 替换为 `NOW()`：
```typescript
// 之前
VALUES (?, ?, ?, ?, ?, 'github', ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
// 之后
VALUES (?, ?, ?, ?, ?, 'github', ?, ?, ?, ?, ?, ?, ?, 1, NOW())
```

- [ ] **Step 6: Commit**

```bash
git add lib/services/log-service.ts lib/auth/session.ts app/api/auth/verify-email/route.ts app/api/auth/reset-password/route.ts lib/pipelines/prompt-sources/remote-sync.ts
git commit -m "feat: replace SQLite datetime('now') with MySQL NOW()"
```

---

### Task 6: 适配 Users 表 Id 生成 — crypto.randomUUID()

**Files:**
- Modify: `app/api/auth/register/route.ts`
- Modify: `app/api/auth/helpers.ts`

SQLite 版本的 Users 表使用 `DEFAULT (lower(hex(randomblob(16))))` 自动生成 Id。MySQL 版本改为 TEXT 主键不带默认值，需要在 INSERT 时由应用层生成。

- [ ] **Step 1: 修改 app/api/auth/register/route.ts**

1. 在文件顶部的 import 区域（第 2 行之后）添加：
```typescript
import crypto from 'node:crypto';
```

2. 将第 51-54 行的 INSERT 改为包含 Id：
```typescript
// 之前
await execute(
    `INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (?, ?, ?, 'user')`,
    [trimmedName, trimmedEmail, passwordHash],
);

const user = await queryOne<{ Id: string }>(
    `SELECT Id FROM Users WHERE Email = ?`,
    [trimmedEmail],
);

// 之后
const userId = crypto.randomUUID();

await execute(
    `INSERT INTO Users (Id, Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?, 'user')`,
    [userId, trimmedName, trimmedEmail, passwordHash],
);
```

3. 将第 56-59 行的 SELECT 查询删除（不再需要），并将第 61 行的 `if (!user)` 改为直接使用 `userId`：

将第 61-89 行替换为：
```typescript
        // 生成邮箱验证 token
        const verifyToken = nanoid(32);
        const verifyExpires = new Date(Date.now() + 24 * 86400_000)
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d{3}Z$/, '');

        await execute(
            `INSERT INTO EmailVerificationTokens (Token, UserId, ExpiresAt) VALUES (?, ?, ?)`,
            [verifyToken, userId, verifyExpires],
        );

        // 发送验证邮件
        const emailResult = await sendVerificationEmail(trimmedEmail, verifyToken);
        if (!emailResult.success) {
            return NextResponse.json(
                { error: `注册成功但验证邮件发送失败：${emailResult.error}` },
                { status: 201 },
            );
        }

        return NextResponse.json({
            success: true,
            message: '注册成功，请先验证邮箱',
            user: { id: userId, email: trimmedEmail, name: trimmedName },
        }, { status: 201 });
```

- [ ] **Step 2: 修改 app/api/auth/helpers.ts**

1. 在文件顶部的 import 区域添加：
```typescript
import crypto from 'node:crypto';
```

2. 找到 HandleOAuthLogin 函数中 INSERT Users 的位置（约第 88 行），将：
```typescript
await execute(
    `INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)`,
    [providerName, email, null, 'user'],
);

const user = await queryOne<{ Id: string }>(
    `SELECT Id FROM Users WHERE Email = ?`,
    [email],
);
```

替换为：
```typescript
const userId = crypto.randomUUID();

await execute(
    `INSERT INTO Users (Id, Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?, ?)`,
    [userId, providerName, email, null, 'user'],
);
```

3. 将后续引用 `user.Id` 的地方改为 `userId`。具体来说，第 92 行之后的 `user.Id` 和第 98-101 行中引用的 `user.Id` 都需要改为 `userId`。

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/register/route.ts app/api/auth/helpers.ts
git commit -m "feat: generate User Id with crypto.randomUUID() for MySQL TEXT PK"
```

---

### Task 7: 适配脚本 — generate-invite-codes.mjs

**Files:**
- Modify: `scripts/generate-invite-codes.mjs`

- [ ] **Step 1: 重写 scripts/generate-invite-codes.mjs**

将文件内容替换为：

```javascript
#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_ROLES = new Set(['junior_member', 'senior_member', 'founder_member']);
const TERM_DURATION_DAYS = {
    monthly: 30,
    yearly: 365,
};
const FOUNDER_DURATION_DAYS = 999 * 365;
const DEFAULT_COUNT = 5;
const DEFAULT_DAYS = 30;
const BEIJING_TIMEZONE = 'Asia/Shanghai';

function loadEnvLocal() {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        return;
    }

    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function printUsage() {
    console.log(
        [
            'Usage:',
            '  node scripts/generate-invite-codes.mjs --role <junior_member|senior_member> --term <monthly|yearly> [--count 5] [--days 30]',
            '  node scripts/generate-invite-codes.mjs --role founder_member [--count 5] [--days 30]',
            '',
            'Options:',
            '  --role   Target role for all generated invite codes. Required.',
            '  --term   Membership term. junior_member/senior_member require monthly|yearly; founder_member is fixed to 999 years.',
            '  --count  Number of codes to generate. Default: 5.',
            '  --days   Invite-code validity window in days. Default: 30.',
        ].join('\n'),
    );
}

function parseArgs(argv) {
    const options = {
        role: '',
        term: '',
        count: DEFAULT_COUNT,
        days: DEFAULT_DAYS,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }

        if (arg === '--role' && argv[index + 1]) {
            options.role = argv[index + 1].trim().toLowerCase();
            index += 1;
            continue;
        }

        if (arg === '--count' && argv[index + 1]) {
            options.count = Number.parseInt(argv[index + 1], 10);
            index += 1;
            continue;
        }

        if (arg === '--term' && argv[index + 1]) {
            options.term = argv[index + 1].trim().toLowerCase();
            index += 1;
            continue;
        }

        if (arg === '--days' && argv[index + 1]) {
            options.days = Number.parseInt(argv[index + 1], 10);
            index += 1;
            continue;
        }

        throw new Error(`Unknown or incomplete argument: ${arg}`);
    }

    if (!ALLOWED_ROLES.has(options.role)) {
        throw new Error('`--role` is required and must be one of: junior_member, senior_member, founder_member');
    }

    if (!Number.isInteger(options.count) || options.count < 1) {
        throw new Error('`--count` must be a positive integer');
    }

    if (!Number.isInteger(options.days) || options.days < 1) {
        throw new Error('`--days` must be a positive integer');
    }

    return options;
}

function resolveMembershipTerm(role, term) {
    if (role === 'founder_member') {
        if (term) {
            throw new Error('`founder_member` is fixed to 999 years and does not accept `--term`');
        }

        return {
            termLabel: '999_years',
            durationDays: FOUNDER_DURATION_DAYS,
        };
    }

    if (!Object.hasOwn(TERM_DURATION_DAYS, term)) {
        throw new Error('`--term` is required for junior_member/senior_member and must be one of: monthly, yearly');
    }

    return {
        termLabel: term,
        durationDays: TERM_DURATION_DAYS[term],
    };
}

function formatBeijingDisplay(date) {
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone: BEIJING_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date);
}

function generateUniqueCode(existingCodes) {
    while (true) {
        const code = crypto.randomBytes(8).toString('hex').slice(0, 10).toUpperCase();
        if (code.length === 10 && !existingCodes.has(code)) {
            existingCodes.add(code);
            return code;
        }
    }
}

async function main() {
    const { role, term, count, days } = parseArgs(process.argv.slice(2));
    const membership = resolveMembershipTerm(role, term);

    loadEnvLocal();

    const url = process.env.MYSQL_URL;
    if (!url) {
        throw new Error('MYSQL_URL 环境变量未设置，请检查 .env.local');
    }

    const conn = await mysql.createConnection(url);
    try {
        // 确保表存在
        const [tables] = await conn.query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InvitationCodes'`
        );
        if (tables.length === 0) {
            throw new Error('InvitationCodes 表不存在');
        }

        const inviteExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const existingCodes = new Set();
        const codes = [];

        await conn.beginTransaction();
        try {
            for (let index = 0; index < count; index += 1) {
                let inserted = false;

                while (!inserted) {
                    const code = generateUniqueCode(existingCodes);

                    try {
                        await conn.query(
                            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt, MembershipDurationDays) VALUES (?, ?, 1, 0, ?, ?)`,
                            [code, role, inviteExpiresAt, membership.durationDays]
                        );
                        codes.push(code);
                        inserted = true;
                    } catch (error) {
                        existingCodes.delete(code);
                        if (!String(error.message).includes('Duplicate entry')) {
                            throw error;
                        }
                    }
                }
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        }

        console.log(`Role: ${role}`);
        console.log(`Term: ${membership.termLabel}`);
        console.log(`InviteExpiry(GMT+8): ${formatBeijingDisplay(inviteExpiresAt)}`);
        console.log('GeneratedCodes:');
        for (const code of codes) {
            console.log(code);
        }
    } finally {
        await conn.end();
    }
}

try {
    await main();
} catch (error) {
    console.error(`Failed to generate invite codes: ${error.message}`);
    process.exit(1);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-invite-codes.mjs
git commit -m "feat: rewrite generate-invite-codes.mjs to use mysql2"
```

---

### Task 8: 适配脚本 — gen-invite.ts

**Files:**
- Modify: `scripts/gen-invite.ts`

- [ ] **Step 1: 重写 scripts/gen-invite.ts**

将文件内容替换为：

```typescript
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

// ════════════════════════════════════════════════════════════════
// 生成邀请码 — CLI 工具
// 用法: npx tsx scripts/gen-invite.ts [--count N] [--expires 7d]
// ════════════════════════════════════════════════════════════════

function parseExpires(value: string): number {
    const match = value.match(/^(\d+)(d|h)$/);
    if (!match) {
        throw new Error(`无效的过期时间格式: ${value}，请使用如 7d 或 24h`);
    }
    const num = parseInt(match[1], 10);
    const unit = match[2];
    return unit === 'd' ? num * 86400_000 : num * 3600_000;
}

function loadEnvLocal(): void {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('错误: 找不到 .env.local 文件');
        process.exit(1);
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function main(): Promise<void> {
    loadEnvLocal();

    // 解析命令行参数
    const args = process.argv.slice(2);
    let count = 1;
    let expiresStr = '7d';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--count' && args[i + 1]) {
            count = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--expires' && args[i + 1]) {
            expiresStr = args[i + 1];
            i++;
        }
    }

    if (count < 1 || count > 100) {
        console.error('错误: --count 应在 1-100 之间');
        process.exit(1);
    }

    const expiresMs = parseExpires(expiresStr);

    const url = process.env.MYSQL_URL;
    if (!url) {
        console.error('错误: MYSQL_URL 环境变量未设置');
        process.exit(1);
    }

    const conn = await mysql.createConnection(url);

    try {
        const expiresAt = new Date(Date.now() + expiresMs);

        const codes: string[] = [];

        await conn.beginTransaction();
        try {
            for (let i = 0; i < count; i++) {
                const code = crypto.randomBytes(4).toString('hex').toUpperCase();
                await conn.query(
                    `INSERT INTO InvitationCodes (Code, MaxUses, UsedCount, ExpiresAt) VALUES (?, 1, 0, ?)`,
                    [code, expiresAt]
                );
                codes.push(code);
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        }

        console.log(`\n已生成 ${count} 个邀请码（有效期 ${expiresStr}）：\n`);
        for (const code of codes) {
            console.log(`  ${code}`);
        }
        console.log(`\n过期时间: ${expiresAt.toISOString()}`);
        console.log(`每人限用: 1 次\n`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('生成邀请码失败:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/gen-invite.ts
git commit -m "feat: rewrite gen-invite.ts to use mysql2"
```

---

### Task 9: 新建数据迁移脚本

**Files:**
- Create: `scripts/migrate-sqlite-to-mysql.ts`

- [ ] **Step 1: 创建迁移脚本**

创建 `scripts/migrate-sqlite-to-mysql.ts`，内容如下：

```typescript
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// ════════════════════════════════════════════════════════════════
// SQLite → MySQL 一次性数据迁移脚本
// 用法: npx tsx scripts/migrate-sqlite-to-mysql.ts
//
// 前置条件：
//   1. .env.local 中设置 MYSQL_URL
//   2. 本地 data/knowledge.db 存在且含数据
// ════════════════════════════════════════════════════════════════

function loadEnvLocal(): void {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('错误: 找不到 .env.local 文件');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

const BATCH_SIZE = 500;

const TABLE_ORDER = [
    'Users',
    'Sessions',
    'OauthAccounts',
    'EmailVerificationTokens',
    'PasswordResetTokens',
    'Prompts',
    'SystemLogs',
    'InvitationCodes',
    'InvitationRedemptions',
    'AcademyContent',
] as const;

async function migrateTable(
    sqliteDb: Database.Database,
    mysqlConn: mysql.Connection,
    tableName: string,
): Promise<{ source: number; target: number }> {
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];
    const sourceCount = rows.length;

    if (sourceCount === 0) {
        const [targetRows] = await mysqlConn.query(`SELECT COUNT(*) AS cnt FROM ${tableName}`) as [Array<{ cnt: number }>];
        return { source: 0, target: targetRows[0].cnt };
    }

    // 获取列名
    const columns = Object.keys(rows[0]);

    // Users 表需要处理 Id 生成
    if (tableName === 'Users') {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            for (const row of batch) {
                if (!row.Id) {
                    row.Id = crypto.randomUUID();
                }
            }
            const values = batch.map(row => columns.map(col => row[col]));
            const placeholders = values.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
            const flatValues = values.flat();
            await mysqlConn.query(
                `INSERT INTO Users (${columns.join(', ')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE Id=Id`,
                flatValues,
            );
        }
    } else {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const values = batch.map(row => columns.map(col => row[col]));
            const placeholders = values.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
            const flatValues = values.flat();
            await mysqlConn.query(
                `INSERT IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`,
                flatValues,
            );
        }
    }

    const [targetRows] = await mysqlConn.query(`SELECT COUNT(*) AS cnt FROM ${tableName}`) as [Array<{ cnt: number }>];
    return { source: sourceCount, target: targetRows[0].cnt };
}

async function main(): Promise<void> {
    loadEnvLocal();

    const sqlitePath = process.env.SQLITE_DB_PATH || path.join('data', 'knowledge.db');
    const resolvedPath = path.isAbsolute(sqlitePath) ? sqlitePath : path.resolve(process.cwd(), sqlitePath);

    if (!fs.existsSync(resolvedPath)) {
        console.error(`SQLite 数据库不存在: ${resolvedPath}`);
        process.exit(1);
    }

    const mysqlUrl = process.env.MYSQL_URL;
    if (!mysqlUrl) {
        console.error('MYSQL_URL 环境变量未设置');
        process.exit(1);
    }

    console.log(`SQLite 源: ${resolvedPath}`);
    console.log(`MySQL 目标: ${mysqlUrl.replace(/:([^@]+)@/, ':****@')}\n`);

    const sqliteDb = new Database(resolvedPath, { readonly: true });
    const mysqlConn = await mysql.createConnection(mysqlUrl);

    try {
        console.log('开始迁移...\n');

        for (const tableName of TABLE_ORDER) {
            const sqliteCount = (sqliteDb.prepare(`SELECT COUNT(*) AS cnt FROM ${tableName}`).get() as { cnt: number }).cnt;
            if (sqliteCount === 0) {
                console.log(`  ${tableName}: 源表为空，跳过`);
                continue;
            }

            await mysqlConn.beginTransaction();
            try {
                const result = await migrateTable(sqliteDb, mysqlConn, tableName);
                await mysqlConn.commit();

                const status = result.source === result.target ? 'OK' : `MISMATCH (${result.source} → ${result.target})`;
                console.log(`  ${tableName}: ${result.source} 行 → ${result.target} 行 [${status}]`);
            } catch (err) {
                await mysqlConn.rollback();
                console.error(`  ${tableName}: 迁移失败 - ${err.message}`);
            }
        }

        console.log('\n迁移完成。');
    } finally {
        sqliteDb.close();
        await mysqlConn.end();
    }
}

main().catch((err) => {
    console.error('迁移失败:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-sqlite-to-mysql.ts
git commit -m "feat: add SQLite to MySQL data migration script"
```

---

### Task 10: 重写测试 — tests/init-schema.test.ts

**Files:**
- Modify: `tests/init-schema.test.ts`

- [ ] **Step 1: 重写 tests/init-schema.test.ts**

将文件内容替换为：

```typescript
import mysql from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

const TEST_MYSQL_URL = process.env.MYSQL_URL;

describe.skipIf(!TEST_MYSQL_URL)('initDatabase (MySQL)', () => {
    let conn: mysql.Connection;

    async function createTestDb(suffix: string): Promise<mysql.Connection> {
        const c = await mysql.createConnection(TEST_MYSQL_URL!);
        const dbName = `mockingbird_test_${suffix}`;
        await c.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await c.query(`USE ${dbName}`);
        return c;
    }

    async function dropTestDb(conn: mysql.Connection, suffix: string): Promise<void> {
        const dbName = `mockingbird_test_${suffix}`;
        await conn.query(`DROP DATABASE IF EXISTS ${dbName}`);
    }

    it('removes the legacy Articles table while keeping active tables available', async () => {
        const suffix = `init_${Date.now()}`;
        conn = await createTestDb(suffix);

        await conn.query(`
            CREATE TABLE Articles (
                Id INT PRIMARY KEY AUTO_INCREMENT,
                Title VARCHAR(200) NOT NULL DEFAULT ''
            )
        `);

        await initDatabase(conn);

        const [tables] = await conn.query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
        ) as [Array<{ TABLE_NAME: string }>];
        const tableNames = tables.map(r => r.TABLE_NAME);

        expect(tableNames).not.toContain('Articles');
        expect(tableNames).toContain('Prompts');
        expect(tableNames).toContain('SystemLogs');

        await dropTestDb(conn, suffix);
        await conn.end();
    });

    it('migrates legacy member roles to junior_member during initialization', async () => {
        const suffix = `roles_${Date.now()}`;
        conn = await createTestDb(suffix);

        await initDatabase(conn);

        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role) VALUES (?, ?, ?, 'member')`,
            ['user-1', 'Legacy Member', 'legacy-member@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, ExpiresAt) VALUES (?, 'member', '2099-01-01')`,
            ['LEGACY-001']
        );

        // Re-run to trigger migration
        await initDatabase(conn);

        const [users] = await conn.query(
            `SELECT Role FROM Users WHERE Id = 'user-1'`
        ) as Array<{ Role: string }>;
        const [invites] = await conn.query(
            `SELECT TargetRole FROM InvitationCodes WHERE Code = 'LEGACY-001'`
        ) as Array<{ TargetRole: string }>;

        expect(users[0]?.Role).toBe('junior_member');
        expect(invites[0]?.TargetRole).toBe('junior_member');

        await dropTestDb(conn, suffix);
        await conn.end();
    });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/init-schema.test.ts
git commit -m "test: rewrite init-schema tests for MySQL"
```

---

### Task 11: 重写测试 — tests/unit/init-schema-prompt-preview.test.ts

**Files:**
- Modify: `tests/unit/init-schema-prompt-preview.test.ts`

- [ ] **Step 1: 重写测试文件**

将文件内容替换为：

```typescript
import mysql from 'mysql2/promise';
import { afterEach, describe, expect, it } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

const TEST_MYSQL_URL = process.env.MYSQL_URL;

describe.skipIf(!TEST_MYSQL_URL)('initDatabase prompt preview migration (MySQL)', () => {
    let conn: mysql.Connection;
    let dbName: string;

    beforeEach(async () => {
        dbName = `mockingbird_prompt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        conn = await mysql.createConnection(TEST_MYSQL_URL!);
        await conn.query(`CREATE DATABASE ${dbName}`);
        await conn.query(`USE ${dbName}`);
    });

    afterEach(async () => {
        await conn.query(`DROP DATABASE IF EXISTS ${dbName}`);
        await conn.end();
    });

    it('adds CardPreviewVideoUrl to an existing Prompts table without dropping data', async () => {
        await conn.query(`
            CREATE TABLE Prompts (
                Id INT PRIMARY KEY AUTO_INCREMENT,
                Title VARCHAR(500) NOT NULL DEFAULT '',
                VideoPreviewUrl VARCHAR(1000) DEFAULT NULL
            )
        `);
        await conn.query(
            `INSERT INTO Prompts (Title, VideoPreviewUrl) VALUES ('existing prompt', '/content/prompts/media/full.mp4')`
        );

        await initDatabase(conn);

        const [columns] = await conn.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Prompts'`
        ) as Array<{ COLUMN_NAME: string }>;
        const columnNames = columns.map(c => c.COLUMN_NAME);

        expect(columnNames).toContain('CardPreviewVideoUrl');

        const [rows] = await conn.query(
            `SELECT Title, VideoPreviewUrl, CardPreviewVideoUrl FROM Prompts`
        ) as Array<{ Title: string; VideoPreviewUrl: string | null; CardPreviewVideoUrl: string | null }>;

        expect(rows[0]).toEqual({
            Title: 'existing prompt',
            VideoPreviewUrl: '/content/prompts/media/full.mp4',
            CardPreviewVideoUrl: null,
        });
    });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/unit/init-schema-prompt-preview.test.ts
git commit -m "test: rewrite init-schema-prompt-preview tests for MySQL"
```

---

### Task 12: 重写测试 — tests/unit/auth-routes.test.ts

**Files:**
- Modify: `tests/unit/auth-routes.test.ts`

- [ ] **Step 1: 重写测试文件**

将文件内容替换为：

```typescript
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetSessionCookie } from '@/app/api/auth/helpers';
import { CreateSession } from '@/lib/auth/session';
import { initDatabase } from '@/lib/init-schema';

const mockSendVerificationEmail = vi.fn();

vi.mock('@/lib/email/send', () => ({
    sendVerificationEmail: mockSendVerificationEmail,
}));

const TEST_MYSQL_URL = process.env.MYSQL_URL;

describe.skipIf(!TEST_MYSQL_URL)('auth routes (MySQL)', () => {
    let conn: mysql.Connection;
    let dbName: string;

    async function setupTestDb(): Promise<void> {
        dbName = `mockingbird_auth_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        conn = await mysql.createConnection(TEST_MYSQL_URL!);
        await conn.query(`CREATE DATABASE ${dbName}`);
        await conn.query(`USE ${dbName}`);
        await initDatabase(conn);
    }

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.resetModules();
        process.env.MYSQL_URL = TEST_MYSQL_URL!;
        mockSendVerificationEmail.mockResolvedValue({ success: true });
        await setupTestDb();
    });

    afterEach(async () => {
        try {
            await conn.query(`DROP DATABASE IF EXISTS ${dbName}`);
            await conn.end();
        } catch {}
        delete process.env.MYSQL_URL;
        vi.resetModules();
        const { closePool } = await import('@/lib/db');
        await closePool();
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

        const [users] = await conn.query(
            `SELECT Id, Email, Name, PasswordHash FROM Users WHERE Email = ?`,
            ['new-user@example.com']
        ) as Array<{ Id: string; Email: string; Name: string; PasswordHash: string }>;
        const [tokens] = await conn.query(
            `SELECT Token, UserId FROM EmailVerificationTokens`
        ) as Array<{ Token: string; UserId: string }>;

        expect(response.status).toBe(201);
        expect(body).toMatchObject({
            success: true,
            message: '注册成功，请先验证邮箱',
            user: {
                email: 'new-user@example.com',
                name: 'New User',
            },
        });
        expect(users.length).toBe(1);
        expect(users[0].Name).toBe('New User');
        expect(users[0].PasswordHash).not.toBe('correct-horse-battery');
        expect(tokens.length).toBe(1);
        expect(tokens[0].UserId).toBe(users[0].Id);
        expect(mockSendVerificationEmail).toHaveBeenCalledWith('new-user@example.com', tokens[0].Token);

        const [sessions] = await conn.query(`SELECT COUNT(*) AS cnt FROM Sessions`) as Array<{ cnt: number }>;
        expect(sessions[0].cnt).toBe(0);
        expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('POST /api/auth/login returns 200 and writes a session cookie for an existing user with the correct password', async () => {
        const passwordHash = await bcrypt.hash('correct-horse-battery', 12);
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role, EmailVerifiedAt) VALUES (?, ?, ?, ?, 'user', NOW())`,
            [userId, 'Existing User', 'existing-user@example.com', passwordHash]
        );

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
        const [sessionRows] = await conn.query(
            `SELECT Token, UserId FROM Sessions WHERE UserId = ?`,
            [userId]
        ) as Array<{ Token: string; UserId: string }>;

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
        expect(sessionRows.length).toBe(1);
        expect(response.headers.get('set-cookie')).toContain(`session_token=${sessionRows[0].Token}`);
    });

    it('POST /api/auth/login rejects password login when the email is not verified', async () => {
        const passwordHash = await bcrypt.hash('correct-horse-battery', 12);
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, PasswordHash, Role, EmailVerifiedAt) VALUES (?, ?, ?, ?, 'user', NULL)`,
            [userId, 'Pending User', 'pending-user@example.com', passwordHash]
        );

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

        const [sessions] = await conn.query(`SELECT COUNT(*) AS cnt FROM Sessions`) as Array<{ cnt: number }>;
        expect(response.status).toBe(403);
        expect(body).toEqual({ error: '请先验证邮箱后再登录' });
        expect(sessions[0].cnt).toBe(0);
        expect(response.headers.get('set-cookie')).toBeNull();
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
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, MembershipExpiresAt, EmailVerifiedAt) VALUES (?, ?, ?, 'senior_member', ?, NOW())`,
            [userId, 'Expired Member', 'expired-member@example.com', '2024-01-01']
        );

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
                membershipExpiresAt: expect.any(String,
                oauthProviders: [],
            },
        });
    });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/unit/auth-routes.test.ts
git commit -m "test: rewrite auth-routes tests for MySQL"
```

---

### Task 13: 重写测试 — tests/unit/membership-redeem-route.test.ts

**Files:**
- Modify: `tests/unit/membership-redeem-route.test.ts`

- [ ] **Step 1: 重写测试文件**

将文件内容替换为：

```typescript
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDatabase } from '@/lib/init-schema';

const mockRequireRole = vi.fn();

vi.mock('@/lib/auth/require-role', () => ({
    RequireRole: mockRequireRole,
}));

const TEST_MYSQL_URL = process.env.MYSQL_URL;

describe.skipIf(!TEST_MYSQL_URL)('POST /api/membership/redeem (MySQL)', () => {
    let conn: mysql.Connection;
    let dbName: string;

    async function setupTestDb(): Promise<void> {
        dbName = `mockingbird_redeem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        conn = await mysql.createConnection(TEST_MYSQL_URL!);
        await conn.query(`CREATE DATABASE ${dbName}`);
        await conn.query(`USE ${dbName}`);
        await initDatabase(conn);
    }

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.resetModules();
        process.env.MYSQL_URL = TEST_MYSQL_URL!;
        await setupTestDb();
    });

    afterEach(async () => {
        try {
            await conn.query(`DROP DATABASE IF EXISTS ${dbName}`);
            await conn.end();
        } catch {}
        delete process.env.MYSQL_URL;
        vi.resetModules();
        const { closePool } = await import('@/lib/db');
        await closePool();
    });

    it('upgrades a user to junior_member when redeeming a junior invite', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, ?, ?, 'user', NOW())`,
            [userId, 'User One', 'user-1@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, 1, 0, ?)`,
            ['JUNIOR-001', 'junior_member', '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'user' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'junior-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const [users] = await conn.query(
            `SELECT Role FROM Users WHERE Id = ?`, [userId]
        ) as Array<{ Role: string }>;
        const [codes] = await conn.query(
            `SELECT UsedCount FROM InvitationCodes WHERE Code = ?`, ['JUNIOR-001']
        ) as Array<{ UsedCount: number }>;

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, role: 'junior_member' });
        expect(users[0].Role).toBe('junior_member');
        expect(codes[0].UsedCount).toBe(1);
    });

    it('allows a junior member to upgrade to senior_member', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, ?, ?, 'junior_member', NOW())`,
            [userId, 'User Two', 'user-2@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, 1, 0, ?)`,
            ['SENIOR-001', 'senior_member', '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'junior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'SENIOR-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const [users] = await conn.query(`SELECT Role FROM Users WHERE Id = ?`, [userId]) as Array<{ Role: string }>;
        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, role: 'senior_member' });
        expect(users[0].Role).toBe('senior_member');
    });

    it('rejects invite codes that do not upgrade the current role', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, ?, ?, 'senior_member', NOW())`,
            [userId, 'User Three', 'user-3@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, 1, 0, ?)`,
            ['JUNIOR-002', 'junior_member', '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'senior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'JUNIOR-002' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const [users] = await conn.query(`SELECT Role FROM Users WHERE Id = ?`, [userId]) as Array<{ Role: string }>;
        const [codes] = await conn.query(`SELECT UsedCount FROM InvitationCodes WHERE Code = ?`, ['JUNIOR-002']) as Array<{ UsedCount: number }>;

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: '当前身份已不低于该邀请码对应等级' });
        expect(users[0].Role).toBe('senior_member');
        expect(codes[0].UsedCount).toBe(0);
    });

    it('allows a user to upgrade directly to founder_member', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, ?, ?, 'user', NOW())`,
            [userId, 'User Four', 'user-4@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, 1, 0, ?)`,
            ['FOUNDER-001', 'founder_member', '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'user' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'FOUNDER-001' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const [users] = await conn.query(`SELECT Role FROM Users WHERE Id = ?`, [userId]) as Array<{ Role: string }>;
        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, role: 'founder_member' });
        expect(users[0].Role).toBe('founder_member');
    });

    it('writes MembershipExpiresAt from invite duration without changing invite ExpiresAt', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, MembershipExpiresAt, EmailVerifiedAt) VALUES (?, ?, ?, 'junior_member', ?, NOW())`,
            [userId, 'Expired User Four', 'user-4b@example.com', '2024-01-01']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MembershipDurationDays, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, ?, 1, 0, ?)`,
            ['YEARLY-001', 'senior_member', 365, '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'user' });

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

        const [userRows] = await conn.query(
            `SELECT Role, MembershipExpiresAt FROM Users WHERE Id = ?`, [userId]
        ) as Array<{ Role: string; MembershipExpiresAt: string | null }>;
        const [inviteRows] = await conn.query(
            `SELECT ExpiresAt, UsedCount FROM InvitationCodes WHERE Code = ?`, ['YEARLY-001']
        ) as Array<{ ExpiresAt: string; UsedCount: number }>;

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, role: 'senior_member' });
        expect(userRows[0].Role).toBe('senior_member');
        expect(userRows[0].MembershipExpiresAt).not.toBeNull();
        expect(new Date(userRows[0].MembershipExpiresAt!).getTime()).toBeGreaterThanOrEqual(
            beforeRedeem + 365 * 86400_000 - 60_000,
        );
        expect(new Date(userRows[0].MembershipExpiresAt!).getTime()).toBeLessThanOrEqual(
            afterRedeem + 365 * 86400_000 + 60_000,
        );
        expect(inviteRows[0].ExpiresAt.substring(0, 10)).toBe('2099-01-01');
        expect(inviteRows[0].UsedCount).toBe(1);
    });

    it('allows a senior member to upgrade to founder_member', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, ?, ?, 'senior_member', NOW())`,
            [userId, 'User Five', 'user-5@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, 1, 0, ?)`,
            ['FOUNDER-002', 'founder_member', '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'senior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'FOUNDER-002' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const [users] = await conn.query(`SELECT Role FROM Users WHERE Id = ?`, [userId]) as Array<{ Role: string }>;
        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, role: 'founder_member' });
        expect(users[0].Role).toBe('founder_member');
    });

    it('rejects invite codes that match the current role', async () => {
        const userId = crypto.randomUUID();
        await conn.query(
            `INSERT INTO Users (Id, Name, Email, Role, EmailVerifiedAt) VALUES (?, ?, ?, 'junior_member', NOW())`,
            [userId, 'User Six', 'user-6@example.com']
        );
        await conn.query(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt) VALUES (?, ?, 1, 0, ?)`,
            ['JUNIOR-003', 'junior_member', '2099-01-01']
        );

        mockRequireRole.mockResolvedValue({ userId, role: 'junior_member' });

        const { POST } = await import('@/app/api/membership/redeem/route');
        const request = new Request('http://localhost:5046/api/membership/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'JUNIOR-003' }),
        });

        const response = await POST(request as never);
        const body = await response.json();

        const [users] = await conn.query(`SELECT Role FROM Users WHERE Id = ?`, [userId]) as Array<{ Role: string }>;
        const [codes] = await conn.query(`SELECT UsedCount FROM InvitationCodes WHERE Code = ?`, ['JUNIOR-003']) as Array<{ UsedCount: number }>;

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: '当前身份已不低于该邀请码对应等级' });
        expect(users[0].Role).toBe('junior_member');
        expect(codes[0].UsedCount).toBe(0);
    });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/unit/membership-redeem-route.test.ts
git commit -m "test: rewrite membership-redeem tests for MySQL"
```

---

### Task 14: 更新配置文件

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`
- Modify: `.gitignore`

- [ ] **Step 1: 更新 .env.example**

将数据库部分：
```
# ── 数据库 ──

# 本地 SQLite 数据库路径
SQLITE_DB_PATH=./data/knowledge.db
```

替换为：
```
# ── 数据库 ──

# MySQL 连接地址（mysql2 格式）
MYSQL_URL=mysql://user:password@localhost:3306/mockingbird_knowledge
```

- [ ] **Step 2: 更新 CLAUDE.md**

将 Database 部分从：
```
### Database
- **SQLite** via better-sqlite3 at `./data/knowledge.db` (configurable via `SQLITE_DB_PATH`)
- Schema auto-initialized in `lib/init-schema.ts` — tables: Users, Sessions, OauthAccounts, Prompts, SystemLogs, InvitationCodes, InvitationRedemptions
- WAL mode enabled, foreign keys enforced
```

替换为：
```
### Database
- **MySQL** via mysql2/promise connection pool at `mockingbird_knowledge` (configurable via `MYSQL_URL`)
- Schema auto-initialized in `lib/init-schema.ts` — tables: Users, Sessions, OauthAccounts, Prompts, SystemLogs, InvitationCodes, InvitationRedemptions
- Tests require `MYSQL_URL` env var pointing to a MySQL instance with CREATE DATABASE permission
```

将 Commands 部分：
```
npm run invite:generate  # Generate membership invite codes
```
保持不变。

- [ ] **Step 3: 更新 .gitignore**

查找并移除 `/data/` 和 `db_backups/` 相关条目（如果存在）。

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md .gitignore
git commit -m "docs: update config for MySQL migration"
```

---

### Task 15: 移除 better-sqlite3 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 卸载 better-sqlite3**

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: 运行测试**

```bash
MYSQL_URL=mysql://user:password@localhost:3306/mockingbird_test npm test
```

Expected: All MySQL tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove better-sqlite3 dependency"
```

---

### Task 16: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
MYSQL_URL=mysql://user:password@localhost:3306/mockingbird_knowledge npm run dev
```

- [ ] **Step 2: 验证健康检查**

```bash
curl http://localhost:5046/api/health
```

Expected: `{"status":"healthy",...}` with database status "ok".

- [ ] **Step 3: 验证数据迁移（如需）**

```bash
npx tsx scripts/migrate-sqlite-to-mysql.ts
```

Expected: 所有表数据迁移完成，行数一致。

- [ ] **Step 4: 验证邀请码生成**

```bash
npx tsx scripts/gen-invite.ts --count 1 --expires 7d
```

Expected: 成功生成邀请码。
