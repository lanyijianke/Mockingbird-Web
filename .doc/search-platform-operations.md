# Search Platform Operations

## Scope

This runbook covers only repo-controlled SEO launch checks for Knowledge Web.

Google Search Console and Bing Webmaster Tools verification, ownership binding, and sitemap submission can only be completed manually after the real production domain is live.

## Repo-Controlled Launch Readiness

Run the local readiness check from the repo root:

```bash
Scripts/test/check-knowledge-web-seo-launch-readiness.sh
```

The script verifies:

- runtime `robots.txt` exposes the expected sitemap for the exact `BASE_URL`
- runtime `sitemap.xml` is reachable from the same `BASE_URL`
- growth pages render successfully at runtime under the same `BASE_URL`
- this runbook and the README both document the manual post-launch boundary
- the weekly observation log is linked from the repo docs

## Manual Post-Launch Steps

Complete these only after deploying the real `SITE_URL`.

### Google Search Console

1. Add the production property for the live domain.
2. Complete domain ownership verification through DNS TXT or the approved production verification method.
3. Submit `SITE_URL + /sitemap.xml`.
4. Inspect representative article, prompt scenario, and ranking topic URLs.

### Bing Webmaster Tools

1. Add the production site for the live domain.
2. Complete the production verification flow.
3. Submit `SITE_URL + /sitemap.xml`.
4. Inspect representative article, prompt scenario, and ranking topic URLs.

## Weekly Observation Loop

Record the weekly review in `search-platform-observation-log.md`.

Suggested cadence:

1. Review indexed-page coverage by family.
2. Review query-level impressions, CTR, and average position for new growth pages.
3. Decide whether each landing page should be kept, expanded, or reduced.
4. Capture follow-up actions in the observation log before making content or internal-link changes.
