# Membership Roles And Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed invite codes that upgrade users into `junior_member`, `senior_member`, or `founder_member`, while keeping academy access shared across all member tiers and admin.

**Architecture:** Keep the existing single `Users.Role` field and add a role hierarchy helper plus an invite `TargetRole` column. Use one local script to generate one-time invite codes, and update backend/frontend checks to use the new hierarchy instead of the old `member` boolean-style role.

**Tech Stack:** Next.js App Router, TypeScript, better-sqlite3, Vitest

---

### Task 1: Define role hierarchy and invite target model
- Add a shared role helper in `lib/auth/roles.ts` for role ordering, labels, academy access checks, and upgrade validation.
- Extend `InvitationCodes` with `TargetRole` in `lib/init-schema.ts`.
- Update any role checks that currently assume only `member`/`admin`.

### Task 2: Make redeem flow upgrade by invite target
- Update `app/api/membership/redeem/route.ts` to read `TargetRole`, reject non-upgrades, and atomically promote the user to the target role.
- Keep invite usage one-time by default through the generator script, but preserve `MaxUses` support in storage.
- Return a success message that reflects the upgraded role.

### Task 3: Update UI for new member tiers
- Replace hardcoded `member` checks in `app/NavAuthButton.tsx`, `app/profile/page.tsx`, `app/membership/page.tsx`, `app/academy/layout.tsx`, and academy API guards.
- Show distinct labels for `junior_member`, `senior_member`, and `founder_member`, while keeping academy access identical for now.

### Task 4: Add invite generation helper
- Create `scripts/generate-invite-codes.js` to generate one-time invite codes for a target role.
- Support a minimal CLI like `node scripts/generate-invite-codes.js --role senior_member --count 5 --days 30`.
- Add an `npm` script entry for easier local use.

### Task 5: Lock behavior with tests
- Add route-level tests for invite redemption upgrades and non-upgrade rejection.
- Add helper-level tests for academy access and role ordering if needed.
- Keep the existing auth tests green: registration still requires email verification before login.
