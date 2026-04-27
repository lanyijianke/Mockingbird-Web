# Membership Role Cleanup And Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy `member` role in favor of `junior_member`, migrate stored membership data safely, and update the top navigation so mobile users enter rankings through `/rankings/topics` while everyone sees a gated academy entry.

**Architecture:** Centralize membership role semantics in `lib/auth/roles.ts`, migrate legacy database rows during schema initialization, and make front-end consumers rely on the shared role helpers instead of duplicating role sets. Keep academy gating centralized at `/academy`, and route mobile rankings traffic to the existing topic hub while preserving desktop dropdown shortcuts.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, better-sqlite3, global CSS

---

### Task 1: Lock The New Role And Nav Behavior With Failing Tests

**Files:**
- Modify: `tests/init-schema.test.ts`
- Modify: `tests/unit/layout-nav.test.ts`
- Modify: `tests/unit/mobile-nav-layout.test.ts`
- Modify: `tests/unit/ranking-topic-page.test.ts`

- [x] **Step 1: Add a schema regression test for legacy `member` migration**

```ts
it('migrates legacy member roles to junior_member during initialization', () => {
    const db = new Database(':memory:');

    db.exec(`
        CREATE TABLE Users (
            Id TEXT PRIMARY KEY,
            Role TEXT NOT NULL DEFAULT 'user',
            MembershipExpiresAt TEXT DEFAULT NULL
        );

        CREATE TABLE InvitationCodes (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            Code TEXT NOT NULL UNIQUE,
            TargetRole TEXT NOT NULL DEFAULT 'member',
            MembershipDurationDays INTEGER NOT NULL DEFAULT 30,
            MaxUses INTEGER NOT NULL DEFAULT 1,
            UsedCount INTEGER NOT NULL DEFAULT 0,
            ExpiresAt TEXT NOT NULL
        );

        INSERT INTO Users (Id, Role) VALUES ('user-1', 'member');
        INSERT INTO InvitationCodes (Code, TargetRole, ExpiresAt)
        VALUES ('LEGACY-001', 'member', '2099-01-01 00:00:00');
    `);

    initDatabase(db);

    expect(db.prepare(`SELECT Role FROM Users WHERE Id = 'user-1'`).get()).toEqual({ Role: 'junior_member' });
    expect(db.prepare(`SELECT TargetRole FROM InvitationCodes WHERE Code = 'LEGACY-001'`).get()).toEqual({
        TargetRole: 'junior_member',
    });
});
```

- [x] **Step 2: Update layout navigation expectations to the new IA**

```ts
it('renders an always-visible academy link and routes mobile rankings through the topics hub', () => {
    const html = renderToStaticMarkup(
        RootLayout({
            children: createElement('div', null, 'test page'),
        })
    );

    expect(html).toContain('href="/academy"');
    expect(html).toContain('>学社<');
    expect(html).toContain('href="/rankings/topics"');
    expect(html).toContain('nav-mobile-only');
    expect(html).toContain('nav-desktop-only');
});
```

- [x] **Step 3: Update the mobile CSS test away from the removed popup menu**

```ts
it('keeps mobile nav scrollable while removing the touch dropdown menu implementation', () => {
    const css = fs.readFileSync(globalsCssPath, 'utf-8');
    const mobileNavBlock = css.match(/\/\* ═══ Nav Mobile ═══ \*\/[\s\S]*?\.main-content \{/);

    expect(mobileNavBlock?.[0]).toContain('overflow-x: auto;');
    expect(mobileNavBlock?.[0]).toContain('.nav-mobile-only');
    expect(mobileNavBlock?.[0]).not.toContain('.nav-mobile-rankings-menu');
});
```

- [x] **Step 4: Add topic-index expectations for direct rankings entry cards**

```ts
expect(indexHtml).toContain('/rankings/github');
expect(indexHtml).toContain('/rankings/producthunt');
expect(indexHtml).toContain('/rankings/skills-trending');
expect(indexHtml).toContain('/rankings/skills-hot');
expect(indexHtml).toContain('榜单入口');
```

- [x] **Step 5: Run the focused tests and confirm they fail for the right reasons**

Run:

```bash
npm test -- tests/init-schema.test.ts tests/unit/layout-nav.test.ts tests/unit/mobile-nav-layout.test.ts tests/unit/ranking-topic-page.test.ts
```

Expected:
- FAIL because legacy `member` rows are not migrated yet
- FAIL because the layout still renders the mobile dropdown trigger instead of a `/rankings/topics` link
- FAIL because the mobile CSS still contains `.nav-mobile-rankings-menu`
- FAIL because the topic index page does not yet render a dedicated rankings entry section

### Task 2: Remove `member` From The Role Model And Migrate Legacy Data

**Files:**
- Modify: `lib/auth/roles.ts`
- Modify: `lib/init-schema.ts`
- Modify: `app/api/academy/content/route.ts`
- Modify: `app/api/academy/content/[slug]/route.ts`

- [x] **Step 1: Simplify the canonical role model**

```ts
const ROLE_RANKS = {
    user: 0,
    junior_member: 1,
    senior_member: 2,
    founder_member: 3,
    admin: 4,
} as const;

export const MEMBERSHIP_ROLES: Role[] = [
    'junior_member',
    'senior_member',
    'founder_member',
];

export const ACADEMY_ALLOWED_ROLES: Role[] = [
    'junior_member',
    'senior_member',
    'founder_member',
    'admin',
];

export const REDEEM_ALLOWED_ROLES: Role[] = [
    'user',
    'junior_member',
    'senior_member',
    'founder_member',
    'admin',
];
```

- [x] **Step 2: Remove `member` from default-duration logic**

```ts
export function getDefaultMembershipDurationDays(role: string): number {
    switch (role) {
        case 'founder_member':
            return 999 * 365;
        case 'senior_member':
            return 365;
        case 'junior_member':
            return 30;
        default:
            return 30;
    }
}
```

- [x] **Step 3: Migrate legacy `member` rows during schema initialization**

```ts
db.exec(`
    UPDATE Users
    SET Role = 'junior_member'
    WHERE Role = 'member'
`);

db.exec(`
    UPDATE InvitationCodes
    SET TargetRole = 'junior_member'
    WHERE TargetRole = 'member'
`);
```

- [x] **Step 4: Align academy API comments with the new role semantics**

```ts
// GET /api/academy/content — 获取学院内容列表（需 junior_member+ 或 admin）
// GET /api/academy/content/[slug] — 获取单篇学院内容（需 junior_member+ 或 admin）
```

- [x] **Step 5: Re-run the focused tests for green**

Run:

```bash
npm test -- tests/init-schema.test.ts tests/unit/auth-routes.test.ts tests/unit/membership-redeem-route.test.ts
```

Expected:
- PASS
- register flow still creates `user`
- expired members are still exposed as `user`
- invite redemption continues to honor the `user -> junior_member -> senior_member -> founder_member` ladder

### Task 3: Reuse Shared Role Helpers In Front-End Gatekeeping

**Files:**
- Modify: `app/academy/layout.tsx`
- Modify: `app/NavAuthButton.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/membership/page.tsx`

- [x] **Step 1: Replace duplicated role sets with shared imports**

```ts
import {
  ACADEMY_ALLOWED_ROLES,
  MEMBERSHIP_ROLES,
} from '@/lib/auth/roles';
```

- [x] **Step 2: Normalize membership and academy checks against the shared arrays**

```ts
const membershipRoles = new Set(MEMBERSHIP_ROLES);
const academyRoles = new Set(ACADEMY_ALLOWED_ROLES);
```

- [x] **Step 3: Update profile labels to remove `member` and rename `junior_member`**

```ts
const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  admin: { label: '管理员', className: 'profile-badge-role-admin' },
  junior_member: { label: '普通会员', className: 'profile-badge-role-member' },
  senior_member: { label: '高级会员', className: 'profile-badge-role-member' },
  founder_member: { label: '创始会员', className: 'profile-badge-role-member' },
  user: { label: '普通用户', className: 'profile-badge-role-user' },
};
```

- [x] **Step 4: Keep academy gating centralized**

```ts
if (!user) {
  router.push('/login?callbackUrl=/academy');
  return;
}

if (hasAcademyAccess(user)) {
  setAuthorized(true);
  return;
}

router.push('/membership');
```

- [x] **Step 5: Run the auth and membership-focused tests**

Run:

```bash
npm test -- tests/unit/auth-routes.test.ts tests/unit/membership-redeem-route.test.ts
```

Expected:
- PASS with no behavior regression for registration, expiration, or invite redemption

### Task 4: Replace The Mobile Rankings Dropdown And Add The Academy Nav Link

**Files:**
- Modify: `app/layout.tsx`
- Delete: `app/TopNavMobileRankingsMenu.tsx`
- Modify: `app/rankings/topics/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/unit/layout-nav.test.ts`
- Modify: `tests/unit/mobile-nav-layout.test.ts`
- Modify: `tests/unit/ranking-topic-page.test.ts`

- [x] **Step 1: Simplify the layout nav structure**

```tsx
<Link href="/prompts" className="nav-link">提示词</Link>
<Link href="/rankings/topics" className="nav-link nav-mobile-only">热榜</Link>

<div className="nav-dropdown nav-desktop-only">
  <Link href="/rankings/github" className="nav-link nav-dropdown-trigger">
    热榜 <i className="bi bi-chevron-down nav-dropdown-arrow" />
  </Link>
  ...
</div>

<Link href="/academy" className="nav-link">学社</Link>
<NavAuthButton />
```

- [x] **Step 2: Remove the obsolete mobile dropdown component and CSS**

```css
.nav-mobile-only {
  display: none;
}

@media (max-width: 900px) {
  .nav-mobile-only {
    display: inline-flex;
  }

  .nav-desktop-only {
    display: none;
  }
}
```

- [x] **Step 3: Promote `/rankings/topics` into a true second-level hub**

```tsx
const rankingEntries = [
  { href: '/rankings/github', label: 'GitHub Trending', icon: 'bi-github', accent: '#58a6ff' },
  { href: '/rankings/producthunt', label: 'ProductHunt', icon: 'bi-rocket-takeoff', accent: '#ff6154' },
  { href: '/rankings/skills-trending', label: 'Skills Trending', icon: 'bi-fire', accent: '#f0883e' },
  { href: '/rankings/skills-hot', label: 'Skills Hot', icon: 'bi-lightning-charge', accent: '#a371f7' },
];
```

- [x] **Step 4: Render a dedicated “榜单入口” section above the topic cards**

```tsx
<section style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
  <div>
    <h2 className="section-title">榜单入口</h2>
    <p className="zone-subtitle">先选榜单来源，再进入更细的热榜专题。</p>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
    {rankingEntries.map((entry) => (
      <Link key={entry.href} href={entry.href} className="glass glass-card" ...>
        ...
      </Link>
    ))}
  </div>
</section>
```

- [x] **Step 5: Run the nav and rankings tests**

Run:

```bash
npm test -- tests/unit/layout-nav.test.ts tests/unit/mobile-nav-layout.test.ts tests/unit/ranking-topic-page.test.ts
```

Expected:
- PASS
- layout exposes `/academy` and the mobile `/rankings/topics` link
- mobile CSS no longer references the removed dropdown menu
- rankings topic index renders both the direct rankings entry cards and the existing topic cards

### Task 5: Full Verification For The Touched Surface

**Files:**
- Modify: `docs/superpowers/plans/2026-04-27-membership-role-cleanup-and-nav.md`

- [x] **Step 1: Mark completed tasks in this plan file**

```md
- [x] ...
```

- [x] **Step 2: Run the combined targeted verification**

Run:

```bash
npm test -- tests/init-schema.test.ts tests/unit/auth-routes.test.ts tests/unit/membership-redeem-route.test.ts tests/unit/layout-nav.test.ts tests/unit/mobile-nav-layout.test.ts tests/unit/ranking-topic-page.test.ts
```

Expected:
- PASS with 0 failures on all touched role, migration, nav, and ranking-topic tests

- [x] **Step 3: Run lint on the changed surface**

Run:

```bash
npm run lint
```

Expected:
- exit 0

- [x] **Step 4: Run a production build**

Run:

```bash
npm run build
```

Expected:
- exit 0
