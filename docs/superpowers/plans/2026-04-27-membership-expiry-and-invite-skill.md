# Membership Expiry And Invite Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add membership expiration to invite-based role upgrades, support monthly/yearly/founder invite terms, and provide a reusable skill for generating invite codes locally.

**Architecture:** Keep the single `Users.Role` approach, but add `Users.MembershipExpiresAt` plus `InvitationCodes.MembershipDurationDays`. Derive effective access from role + expiration together, so expired members lose academy access and are treated like `user` until upgraded again. Extend the invite generator CLI with term semantics and document it in a local skill.

**Tech Stack:** Next.js App Router, TypeScript, better-sqlite3, Vitest, local Codex skill files

---

### Task 1: Add membership expiration data model
- Extend `Users` with `MembershipExpiresAt`.
- Extend `InvitationCodes` with `MembershipDurationDays`.
- Keep `InvitationCodes.ExpiresAt` as invite-code validity, separate from membership lifetime.

### Task 2: Centralize effective-role and expiry logic
- Expand `lib/auth/roles.ts` with:
  - role hierarchy
  - academy access checks
  - upgrade checks
  - effective role resolution from `Role + MembershipExpiresAt`
  - duration helpers for `monthly`, `yearly`, and founder lifetime (`999` years)

### Task 3: Apply expiry logic to auth and academy access
- Update `lib/auth/require-role.ts` and `app/api/auth/me/route.ts` to use effective role.
- Expired membership should behave as `user` for access checks and frontend rendering.
- Expose `membershipExpiresAt` in `/api/auth/me` for UI display.

### Task 4: Apply expiry logic to invite redemption
- Update `app/api/membership/redeem/route.ts` to set `MembershipExpiresAt` from invite duration.
- Keep upgrade-only behavior: no downgrade, no same-level redemption.
- Founder invites should grant `999` years.

### Task 5: Upgrade the invite generator CLI
- Extend `scripts/generate-invite-codes.mjs` with a required/validated term model:
  - `junior_member` / `senior_member`: `monthly` or `yearly`
  - `founder_member`: founder lifetime only
- Preserve invite-code expiry (`--days`) separately from membership duration.

### Task 6: Update frontend display and local skill
- Show differentiated role labels and membership expiry in profile/membership views where useful.
- Keep academy access unified across all member tiers.
- Create a local skill documenting how to generate invite codes and what term flags mean.

### Task 7: Lock with regression tests
- Extend auth and membership tests for expiry behavior.
- Add tests for invite duration mapping and expired members losing academy access.
