# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mockingbird Knowledge Web — a Next.js 16 content site that publishes articles, AI prompts (multimodal), and hot rankings (GitHub Trending / ProductHunt / Skills.sh). The codebase originated from a C# monorepo and now runs as a standalone repo after the split.

## Commands

```bash
npm run dev          # Start dev server on port 5046
npm run lint         # ESLint (core-web-vitals + typescript)
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run build        # Production build
```

Run a single test:
```bash
npx vitest run tests/unit/<test-file>.test.ts
```

Pre-commit quality gates (CI enforces these in order): `lint` → `scripts/check-knowledge-web-guards.sh` → `test` → `build`

## Architecture

### Routing Structure (App Router)

The site serves three content verticals, each with its own URL prefix:

- **Articles** — `/ai/articles`, `/finance/articles` (multi-site, each backed by an `ARTICLE_LOCAL_SOURCES` config pointing to a local directory tree with `manifest.json` + Markdown files)
- **Prompts** — `/prompts` (stored in SQLite `Prompts` table; media in `CONTENT_PROMPTS_MEDIA_DIR`)
- **Rankings** — `/rankings/github`, `/rankings/producthunt`, `/rankings/skills-trending`, `/rankings/skills-hot` (scraped and cached in-memory)

SEO landing pages exist at `/prompts/categories/[category]`, `/prompts/scenarios/[slug]`, `/ai/articles/categories/[category]`, `/rankings/topics/[slug]`.

### Data Layer

- **SQLite** (`better-sqlite3`) — WAL mode, auto-creates schema on first connection via `lib/init-schema.ts`. Access through `lib/db.ts` helpers (`query`, `queryOne`, `queryScalar`, `execute`). Articles are no longer in SQLite — they come from filesystem sources.
- **Category config** — `config/categories.json` (static JSON, loaded by `lib/categories.ts`). No database table.
- **In-memory cache** — `lib/cache/` provides a `CacheManager` with namespace-based policies, tag-based invalidation, and stale-on-error fallback. Rankings and prompt lists use this heavily.

### Content Pipelines

- **Prompt sync** — `lib/pipelines/prompt-readme-sync.ts` orchestrates adapters in `lib/pipelines/prompt-sources/adapters/` (currently `github-readme-yoomind`). Each adapter parses remote content and upserts into the `Prompts` table. Runs every minute via scheduler.
- **Media processing** — `lib/utils/media-processor.ts` and `lib/pipelines/media-pipeline.ts` handle image/video download, compression, and WebP conversion. Requires system tools: `ffmpeg`, `yt-dlp`, `cwebp`.
- **Article loading** — `lib/articles/article-directory.ts` reads from local filesystem directories defined by `ARTICLE_LOCAL_SOURCES`. Each source has a `manifest.json` + Markdown articles in `articles/published/<slug>/index.md`.

### Job Scheduler

`lib/jobs/scheduler.ts` uses `node-cron` to run two recurring jobs (prompt sync + ranking refresh). Started automatically via `instrumentation.ts` when `NEXT_RUNTIME === 'nodejs'`. Jobs use re-entrancy locks to prevent overlap.

### API Routes

All under `app/api/`:
- `articles/route.ts`, `articles/[slug]/route.ts` — article listing/detail
- `prompts/route.ts`, `prompts/[id]/route.ts` — prompt listing/detail
- `rankings/route.ts` — ranking data
- `jobs/route.ts` — scheduler control (admin-only POST)
- `health/route.ts` — health check
- `article-assets/[site]/[slug]/[...assetPath]/route.ts` — article image proxy
- `content/prompts/media/[fileName]/route.ts` — prompt media serving

Admin write endpoints require token auth (`verifyAdminHeaders` from `lib/utils/admin-auth.ts`): `x-admin-token` header or `authorization: Bearer`.

### SEO System

`lib/seo/` contains:
- `metadata.ts` — shared `generateMetadata` builders for all page types
- `schema.tsx` — JSON-LD output (Article, CreativeWork, CollectionPage, ItemList, BreadcrumbList)
- `internal-links.ts` — cross-linking between articles, prompts, and rankings
- `growth-pages.ts` — SEO landing page definitions
- `config.ts` — central SEO configuration

`app/robots.ts` and `app/sitemap.xml/` handle crawl directives. Search parameter pages (`q=`) are `noindex,follow`.

### Security

- CSP built in `lib/security/csp.ts`, applied globally via `next.config.ts` headers
- `sanitizeExternalUrl` must be used on all external links — enforced by `scripts/check-knowledge-web-guards.sh`
- `allowDangerousHtml: true` is banned — also enforced by the guard script
- Admin POST routes must call `verifyAdminHeaders` — enforced by the guard script
- `MEDIA_DOWNLOAD_MAX_BYTES` prevents SSRF via oversized media downloads

## Key Conventions

- Path alias: `@/` maps to project root (configured in both `tsconfig.json` and `vitest.config.ts`)
- All API routes use `runtime = 'nodejs'` (no Edge runtime — SQLite is Node-only)
- Test files live in `tests/unit/` matching the pattern `*.test.ts`
- Types for all data models are in `lib/types.ts`; article source types in `lib/articles/source-types.ts`
- Environment variables are documented in `.env.example`; copy to `.env.local` for local development
