#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

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

function resolveDbPath() {
    loadEnvLocal();

    const configuredPath = process.env.SQLITE_DB_PATH || path.join('data', 'knowledge.db');
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(process.cwd(), configuredPath);
}

function formatSqliteDate(date) {
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
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

function ensureColumn(db, tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (columns.some((column) => column.name === columnName)) {
        return;
    }

    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function ensureInvitationSchema(db) {
    const tableExists = db
        .prepare(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table' AND name = 'InvitationCodes'`,
        )
        .get();

    if (!tableExists) {
        throw new Error('InvitationCodes table does not exist in the target SQLite database');
    }

    const columns = db.prepare('PRAGMA table_info(InvitationCodes)').all();
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('TargetRole')) {
        ensureColumn(db, 'InvitationCodes', 'TargetRole', `TEXT NOT NULL DEFAULT 'junior_member'`);
    }

    if (!columnNames.has('MembershipDurationDays')) {
        ensureColumn(db, 'InvitationCodes', 'MembershipDurationDays', 'INTEGER NOT NULL DEFAULT 30');
    }

    db.exec(`
        UPDATE InvitationCodes
        SET TargetRole = 'junior_member'
        WHERE TargetRole IS NULL OR trim(TargetRole) = ''
    `);

    db.exec(`
        UPDATE InvitationCodes
        SET MembershipDurationDays = CASE
            WHEN TargetRole = 'founder_member' THEN ${FOUNDER_DURATION_DAYS}
            WHEN TargetRole = 'senior_member' THEN ${TERM_DURATION_DAYS.yearly}
            ELSE ${TERM_DURATION_DAYS.monthly}
        END
        WHERE MembershipDurationDays IS NULL OR MembershipDurationDays <= 0
    `);
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

function main() {
    const { role, term, count, days } = parseArgs(process.argv.slice(2));
    const membership = resolveMembershipTerm(role, term);
    const dbPath = resolveDbPath();
    const db = new Database(dbPath);

    try {
        ensureInvitationSchema(db);

        const inviteExpiresAt = formatSqliteDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
        const insertStatement = db.prepare(
            `INSERT INTO InvitationCodes (Code, TargetRole, MaxUses, UsedCount, ExpiresAt, MembershipDurationDays)
             VALUES (?, ?, 1, 0, ?, ?)`,
        );
        const existingCodes = new Set();
        const codes = [];

        const insertMany = db.transaction(() => {
            for (let index = 0; index < count; index += 1) {
                let inserted = false;

                while (!inserted) {
                    const code = generateUniqueCode(existingCodes);

                    try {
                        insertStatement.run(code, role, inviteExpiresAt, membership.durationDays);
                        codes.push(code);
                        inserted = true;
                    } catch (error) {
                        existingCodes.delete(code);
                        if (!String(error.message).includes('UNIQUE constraint failed: InvitationCodes.Code')) {
                            throw error;
                        }
                    }
                }
            }
        });

        insertMany();

        console.log(`DB: ${dbPath}`);
        console.log(`Role: ${role}`);
        console.log(`Term: ${membership.termLabel}`);
        console.log(`InviteExpiry(GMT+8): ${formatBeijingDisplay(new Date(Date.now() + days * 24 * 60 * 60 * 1000))}`);
        console.log('GeneratedCodes:');
        for (const code of codes) {
            console.log(code);
        }
    } finally {
        db.close();
    }
}

try {
    main();
} catch (error) {
    console.error(`Failed to generate invite codes: ${error.message}`);
    process.exit(1);
}
