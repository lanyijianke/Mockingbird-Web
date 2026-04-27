# Prompt Source Expansion Playbook

Last updated: 2026-04-24

This document records the repeatable workflow for expanding the prompt library from an external link. Use it whenever a new prompt collection should be added to the project.

## What This System Does

The prompt ingestion system is now source-adapter based:

```text
external link / source config
  -> prompt source loader
  -> source adapter
  -> normalized PromptImportRecord[]
  -> shared remote sync runner
  -> Prompts table
  -> /prompts gallery
```

The first source implemented with this system is:

```text
https://github.com/YouMind-OpenLab/awesome-gpt-image-2
```

That source uses the `github-readme-yoomind` adapter and currently imports the public README-visible GPT Image 2 prompts.

## Important Product Rule

Keep two types of prompt pages separate:

- Reader-facing gallery/list pages use `/prompts` and `/prompts?category=<code>`.
- SEO landing pages use `/prompts/categories/<code>`.

Do not link normal homepage/gallery UX directly to `/prompts/categories/<code>`. Those pages should stay available for search engines, sitemaps, and intentional SEO/internal-link surfaces, but the main reader flow should stay inside the prompt gallery.

## Current Files

Core source framework:

```text
lib/pipelines/prompt-sources/types.ts
lib/pipelines/prompt-sources/source-config.ts
lib/pipelines/prompt-sources/remote-sync.ts
lib/pipelines/prompt-sources/adapters/index.ts
lib/pipelines/prompt-sources/adapters/github-readme-yoomind.ts
```

Source configs:

```text
content-sources/prompts/yoomind-gpt-image-2.json
```

Existing public entrypoint:

```text
lib/pipelines/prompt-readme-sync.ts
```

`syncAllAsync()` remains the remote prompt sync entrypoint. Internally it delegates to the source framework.

## Adding A New Prompt Source

### 1. Inspect The Source

For a new link, first answer:

- Is it a GitHub README, CSV, JSON API, RSS feed, or something else?
- Are prompts visible in the public source, or hidden behind an API/CMS?
- Are images/videos public URLs?
- Is there author/source/license metadata?
- Does the source expose categories/tags?
- Is the content localized, and which locale should we import?

If the public source is truncated, document the limitation. Example: GPT Image 2 reports 1526 total prompts, but the public README exposes 126 prompt sections. Full import needs YouMind CMS credentials.

### 2. Choose Or Create An Adapter

Use an existing adapter when the structure matches:

```text
github-readme-yoomind
```

Create a new adapter when the source layout is different. New adapters must implement:

```ts
interface PromptSourceAdapter {
    id: string;
    canHandle(source: PromptSourceConfig): boolean;
    fetchSource(source: PromptSourceConfig): Promise<string | Buffer>;
    parse(input: string | Buffer, source: PromptSourceConfig): Promise<PromptImportRecord[]>;
}
```

Adapter output must normalize into:

```ts
interface PromptImportRecord {
    externalId: string;
    title: string;
    rawTitle?: string;
    description?: string;
    content: string;
    category: string;
    tags?: string[];
    author?: string;
    sourceUrl?: string;
    sourcePublishedAt?: string;
    mediaUrls?: string[];
    videoUrls?: string[];
    flags?: string[];
    metadata?: Record<string, unknown>;
}
```

### 3. Add A Source Config

Create a JSON file under:

```text
content-sources/prompts/
```

Example:

```json
{
  "id": "yoomind-gpt-image-2",
  "type": "github-readme",
  "owner": "YouMind-OpenLab",
  "repo": "awesome-gpt-image-2",
  "branch": "main",
  "file": "README_zh.md",
  "adapter": "github-readme-yoomind",
  "locale": "zh-CN",
  "defaultCategory": "gpt-image-2",
  "enabled": true
}
```

Rules:

- `id` must be stable and unique.
- `defaultCategory` must exist in `config/categories.json`.
- Prefer localized README files when the front-end audience benefits from them.
- Set `enabled: false` for unfinished or experimental sources.

### 4. Add Or Reuse A Category

Prompt model categories live in:

```text
config/categories.json
```

Add new model categories under `multimodal-prompts`.

Homepage model order is intentionally separate from raw category order. If a new model should be promoted on the homepage, update the homepage priority list in:

```text
app/page.tsx
```

Reader-facing model links should go to:

```text
/prompts?category=<code>
```

Not:

```text
/prompts/categories/<code>
```

## Syncing Data

Preferred local trigger through the app:

```bash
curl -X POST \
  -H 'x-admin-token: <ADMIN_API_TOKEN>' \
  'http://localhost:5046/api/jobs?action=trigger-prompt-sync'
```

If local `.env.local` has no admin token, restart dev with a temporary token:

```bash
ADMIN_API_TOKEN=local-sync-token npm run dev
```

Then trigger:

```bash
curl -X POST \
  -H 'x-admin-token: local-sync-token' \
  'http://localhost:5046/api/jobs?action=trigger-prompt-sync'
```

Expected response shape:

```json
{
  "message": "提示词同步已执行",
  "report": {
    "sources": {
      "totalParsed": 126,
      "newlyAdded": 0,
      "updated": 0,
      "skipped": 126
    }
  }
}
```

`skipped` can be correct when rows already exist. The sync runner dedupes by `SourceUrl`, then falls back to title matching where applicable.

## Verification Checklist

Run focused tests:

```bash
npm test -- \
  ../Tests/knowledge-web/unit/prompt-source-config.test.ts \
  ../Tests/knowledge-web/unit/prompt-readme-sync.test.ts \
  ../Tests/knowledge-web/unit/prompt-source-remote-sync.test.ts
```

Run prompt gallery tests when changing `/prompts` UX:

```bash
npm test -- \
  ../Tests/knowledge-web/unit/prompt-infinite-gallery-utils.test.ts \
  ../Tests/knowledge-web/unit/seo-regression.test.ts
```

Run lint:

```bash
npm run lint
```

Verify database counts:

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database('data/knowledge.db'); console.log(db.prepare(\"SELECT Category, COUNT(*) count FROM Prompts GROUP BY Category ORDER BY count DESC\").all()); db.close();"
```

Verify a category page:

```bash
curl -I 'http://localhost:5046/prompts?category=gpt-image-2'
```

Verify the reader-facing page does not route users into SEO category pages:

```bash
curl -s 'http://localhost:5046/' | rg '/prompts/categories/'
```

Expected: no matches for normal homepage prompt-gallery links.

## Common Failure Modes

### Category Switching Looks Stuck

If `/prompts` category filters change the URL but cards do not update, check `PromptInfiniteGallery`.

The infinite gallery keeps client state. It must reset when `category` or `q` changes. Current guard:

```text
buildPromptGalleryResetKey({ category, q })
```

The server page also passes that key to the gallery component to force remounts during soft navigation.

### Source Parses But Imports Nothing

Check:

- Adapter returns `PromptImportRecord[]`.
- `content` is not empty and has at least 5 characters.
- `sourceUrl` is stable and not colliding with an unrelated existing row.
- `defaultCategory` exists in `config/categories.json`.

### README Says More Prompts Than We Import

Check whether the README is truncated. GitHub README collections may show only a limited visible subset while the full dataset lives behind a CMS/API.

Record that limitation in the source config PR or implementation notes.

## When The User Says "Expand This Link"

Follow this sequence:

1. Inspect the link and identify source type.
2. Confirm public data availability and expected count.
3. Choose an existing adapter or create a new one.
4. Add source config under `content-sources/prompts/`.
5. Add or reuse category in `config/categories.json`.
6. Add tests for parser/config behavior.
7. Trigger sync locally.
8. Verify `/prompts?category=<code>`.
9. Keep homepage links reader-facing.
10. Leave SEO landing pages intact unless explicitly asked to change SEO.
