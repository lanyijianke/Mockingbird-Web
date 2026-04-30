# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mockingbird Knowledge Web (知更鸟知识库) — a Next.js knowledge platform featuring AI articles, prompt galleries, trend rankings, and a membership system. Chinese-language, editorial magazine-style design.

## Commands

```bash
npm run dev          # Dev server on port 5046
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all Vitest tests
npm run test:watch   # Vitest in watch mode
npm test -- tests/unit/auth-routes.test.ts  # Single test file
npm run invite:generate  # Generate membership invite codes
```

## Architecture

**Stack:** Next.js 16 App Router + React 19 + TypeScript + better-sqlite3 + Vitest

### Two main directories
- `app/` — Next.js App Router pages, layouts, route handlers, and API endpoints
- `lib/` — Shared business logic, services, utilities, and configuration

### Key `lib/` modules
| Directory | Purpose |
|-----------|---------|
| `lib/auth/` | Session management, role hierarchy, route protection |
| `lib/services/` | Business logic for prompts, articles, rankings, logs |
| `lib/articles/` | Article directory service (local markdown files, not DB) |
| `lib/seo/` | Metadata builders, JSON-LD schemas, sitemap config |
| `lib/email/` | Resend email templates (verification, password reset) |
| `lib/jobs/` | Cron scheduler (prompt sync every 60s, rankings every 2h) |
| `lib/cache/` | In-memory cache with TTL, namespace isolation, tag invalidation |
| `lib/pipelines/` | Content sync from GitHub repos via adapters |
| `lib/security/` | CSP headers |

### Database
- **SQLite** via better-sqlite3 at `./data/knowledge.db` (configurable via `SQLITE_DB_PATH`)
- Schema auto-initialized in `lib/init-schema.ts` — tables: Users, Sessions, OauthAccounts, Prompts, SystemLogs, InvitationCodes, InvitationRedemptions
- WAL mode enabled, foreign keys enforced

### Role hierarchy (ascending)
`user` → `junior_member` (30d) → `senior_member` (365d) → `founder_member` (lifetime) → `admin`

### Authentication
- Email/password + OAuth (GitHub, Google)
- Session-based with HTTP-only cookies (nanoid tokens, 30-day TTL)
- Route protection via `middleware.ts` — `/profile`, `/membership`, `/academy` require auth; academy requires active membership

### Content sources
- **Articles:** Local markdown directories with frontmatter, multi-site support (`ai`, `finance`), served via manifest-based indexing
- **Prompts:** Synced from GitHub repos into SQLite, configured in `content-sources/prompts/*.json`
- **Rankings:** Scraped from GitHub Trending, ProductHunt, Skills.sh, cached 2 hours

### API routes (`app/api/`)
- `auth/*` — register, login, logout, me, verify-email, forgot/reset-password, oauth
- `articles`, `prompts`, `rankings` — content endpoints
- `article-assets/[site]/[slug]/[...assetPath]` — article media
- `jobs` — admin job scheduler control (requires `KNOWLEDGE_ADMIN_TOKEN`)
- `membership/redeem` — invite code redemption
- `health` — health check

## Conventions

- All API routes use `export const runtime = 'nodejs'` for SQLite access
- **4-space** indentation in `lib/` and route handlers; **2-space** in React components — match surrounding file style
- Reuse centralized config (`lib/site-config.ts`, `lib/seo/config.ts`) for brand names, URLs, callbacks
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Tests go in `tests/unit/`; use temp `SQLITE_DB_PATH` for isolation
- Never commit secrets — use `.env.local` (see `.env.example`)
