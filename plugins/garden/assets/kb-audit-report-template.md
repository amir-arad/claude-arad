# Knowledge Base Audit — <scope>

**As-of date:** <YYYY-MM-DD> (required — an undated audit cannot be trended)
**Scope:** <run root / spaces / directories included>
**Previous audit:** <date> | **Prepared by:** <name>

---

## Headline

<Two sentences. What the run showed in operational terms, and the one thing that would change
it most. Not a summary of the tables below. There is no score and no band — if you find
yourself wanting to write one, write the dominant rule and its count instead.>

## Run totals

Straight from the tools. Every number here is countable and reproducible from the same
`--as-of`.

| | This audit | Previous |
|---|---|---|
| Docs scanned | | |
| Docs with findings | | |
| Total findings | | |

### Severity histogram

All five keys, zeros included.

| critical | high | medium | low | info |
|---|---|---|---|---|
| | | | | |

### Findings by rule

One row per rule that fired. A single rule holding most of the total is one policy decision,
not N tasks — say which case this is.

| Rule | Count | Read as |
|------|-------|---------|
| `stale-doc` | | |
| `review-overdue` | | |
| `missing-updated` | | |
| `future-updated` | | |
| `unowned` | | |
| `alias-owner` | | |
| `thin-doc` | | |
| `duplicate-title` | | |
| `dead-link` | | |
| `orphan-doc` | | |

### Worst offenders

| Doc | Findings | Highest severity |
|-----|----------|------------------|
| | | |

## Inventory by tier

Tier is the consequence if the doc is wrong (`critical` `core` `reference` `archive`) — not a
finding severity.

| Tier | Docs | Within SLA | Stale | Unowned |
|------|------|-----------|-------|---------|
| Critical | | | | |
| Core | | | | |
| Reference | | | | |
| Archive | | n/a | n/a | n/a |

## Critical-tier exceptions

Every stale or unowned Critical-tier doc, listed individually. These are risk items,
not backlog items.

| Doc | Owner | Age | Rule | Remediation owner | Due |
|-----|-------|-----|------|-------------------|-----|
| | | | | | |

## Structural findings

**Inbound links:** <n> of <total> docs have at least one inbound link. Note this is the
inbound-link test, not reachability from the root doc — a doc linked only from unreachable
docs passes here and is still unreachable.

| Finding | Count | Notes |
|---------|-------|-------|
| `orphan-doc`, high traffic | | Findability bug — link from a hub urgently. *Needs traffic data* |
| `orphan-doc`, zero traffic | | Dead weight — retire, deleting only with confirmed authority. *Needs traffic data* |
| `orphan-doc`, traffic unknown | | Read and judge each. This is the whole column when scanning a directory |
| `dead-link` | | Fix first; cheapest and most visible |
| `duplicate-title` | | Merge into the most-linked path |
| Hubs (at `--hub-threshold`) | | Confirm each has a named owner |

### Duplicate clusters

| Title | Paths | Merge target (most inbound links) | Owner |
|-------|-------|-----------------------------------|-------|
| | | | |

## Remediation plan

Findings reconciled into work items, then ranked: Critical-tier staleness first, then
traffic × severity where traffic is known, then cheap wins. Several findings on one doc are
one work item. Take the top 10 into one sprint; the rest is a measurement instrument, not
a plan.

| # | Work item | Doc | Done when | Effort | Owner |
|---|-----------|-----|-----------|--------|-------|
| 1 | | | | | |

**Sprint effort:** <n> hours | **Deferred:** <n> items | **Dropped as low-value:** <n> items

### Findings deliberately not turned into work items

<E.g. `unowned` firing on every doc because the KB records no owners at all. A finding that
matches everything distinguishes nothing; answer it once with a policy decision and say so
here rather than carrying it as a backlog.>

## Deletions proposed

<List. State explicitly who holds deletion authority. If nobody does, say so — every
retirement then becomes a merge-and-redirect, and the plan above assumes an answer.>

## Decisions needed

- [ ] <Decision> — owner: <name>, needed by: <date>

## Next audit

**Date:** <date, one quarter out> | **Same `--as-of` convention:** yes

Compare each count above separately. A falling `high` count with a flat total is progress; a
falling total driven entirely by `missing-updated` disappearing is bookkeeping.
