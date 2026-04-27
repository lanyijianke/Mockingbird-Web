---
name: knowledge-invite-codes
description: Generate membership invite codes for the Knowledge project with the correct role, term, invite expiry, and SQLite fields.
---

# knowledge-invite-codes

## When to use

Use this skill when you need to generate membership invite codes for the Knowledge repo, especially if the request mentions:

- junior, senior, founder membership codes
- invite-code expiry days
- membership term or duration
- writing `InvitationCodes.MembershipDurationDays`

## Command

Run from the repository root:

```bash
npm run invite:generate -- --role junior_member --term monthly --count 5 --days 30
```

```bash
npm run invite:generate -- --role senior_member --term yearly --count 2 --days 14
```

```bash
npm run invite:generate -- --role founder_member --count 1 --days 7
```

## Term rules

- `junior_member`: must provide `--term monthly` or `--term yearly`
- `senior_member`: must provide `--term monthly` or `--term yearly`
- `founder_member`: do not provide `--term`; membership is fixed to `999_years`
- `--days`: controls invite-code expiry only, not membership duration

## DB behavior

The generator writes:

- `TargetRole`
- `ExpiresAt`
- `MembershipDurationDays`

## Output

The script prints:

- `Role`
- `Term`
- `InviteExpiry`
- `GeneratedCodes`
