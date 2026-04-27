# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the Next.js App Router UI and route handlers. Key areas include `app/api/` for server endpoints, `app/(auth)/` for auth pages, and content surfaces such as `app/ai/articles/`, `app/prompts/`, and `app/rankings/`.
- `lib/` holds shared modules: `lib/seo/` for metadata and JSON-LD, `lib/auth/` for session/role helpers, `lib/email/` for Resend mailers, `lib/services/` for content and ranking data, and `lib/jobs/` for cron jobs.
- `tests/unit/` contains Vitest coverage. `public/` stores static assets and prompt media. `config/` contains static configuration such as categories.

## Build, Test, and Development Commands
- `npm run dev` starts the local server on port `5046`.
- `npm run build` produces the production build and catches App Router/runtime issues.
- `npm run lint` runs ESLint for TS/Next.js checks.
- `npm test` runs the full Vitest suite once.
- `npm test -- tests/unit/auth-routes.test.ts` runs a focused test file during iteration.

## Coding Style & Naming Conventions
- Use TypeScript throughout. Keep `runtime = 'nodejs'` on API routes that touch SQLite or other Node-only dependencies.
- Follow existing style: 4-space indentation in `lib/` and route handlers, 2-space indentation in many React components; preserve the surrounding file’s style instead of reformatting unrelated code.
- Prefer descriptive PascalCase for React components, camelCase for helpers, and kebab-free route filenames (`route.ts`, `page.tsx`, `layout.tsx`).
- Reuse centralized config (`lib/site-config.ts`, `lib/seo/config.ts`) instead of hardcoding brand names, URLs, or callback origins.

## Testing Guidelines
- Framework: Vitest (`tests/**/*.test.ts`).
- Add regression tests for behavior changes, especially auth, SEO metadata, sitemap output, and route handlers.
- Prefer route-level tests for API behavior and keep temporary DB state isolated with temp `SQLITE_DB_PATH` files.

## Commit & Pull Request Guidelines
- Follow the repository’s existing conventional style: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`.
- Keep commits scoped to one concern.
- PRs should summarize user-facing impact, config/env changes, and exact verification run (`npm test`, `npm run lint`, `npm run build`). Include screenshots for UI/email template changes when relevant.

## Security & Configuration Tips
- Copy `.env.example` to `.env.local`; never commit secrets.
- Treat `SITE_URL`, OAuth credentials, admin tokens, and Resend sender settings as environment-owned values.
- Use `KNOWLEDGE_ADMIN_TOKEN`/`ADMIN_API_TOKEN` for protected job endpoints and verify that new external links or absolute URLs go through existing sanitization/config helpers.
