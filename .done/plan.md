<!-- version: 4 -->
<!-- FORMAT CONTRACT (done plugin)
Milestones: `## <ID> — <title>` in priority order. ID = letters+digits, e.g. M1.
Cards: one table row per card under a milestone, columns exactly:
| Card | Action | Mode | Owner | Blocked on | Status |
Card: `<milestone>.<n>` unique (M1.2), never reused: not from the cut list, not from cards archived in log.md. Action: free text, one line; write a literal pipe as `\|`.
Mode: DECIDE | DISPATCH | REVIEW | QA | DO, optional suffix `(gate: <who>)`.
Owner: empty = the project owner; else a name.
Blocked on: comma list of card ids, `ext:<text>`, `owner:<name>`. Nothing else.
Status: open | filed #N | dispatched #N | pr #N | ruled YYYY-MM-DD | done YYYY-MM-DD
Done rows are moved to log.md by state-write. No strikethrough anywhere.
`## Cut list` holds `- <what> — <why> (<date>)` lines; a cut card starts with its id (`- M1.3 <action> — ...`); never delete, only append.
Derived, never hand-written: READY NOW, IN FLIGHT, DECIDE order (cards.mjs derive).
-->
# Plan

## M1 — Proven in Cowork on 0.5.0

Exit: all 6 steps of kb/done-cowork-e2e-2.md pass, or every failure has a merged fix.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M1.1 | Run the second Cowork e2e (kb/done-cowork-e2e-2.md), paste transcript + screenshots | QA |  |  | open |
| M1.2 | Read both .done/ folders on host, record results in kb, fix failures in a fix(done): PR | DO |  | M1.1 | open |

## M2 — Used on a real project

Exit: one real milestone of a real project is finished using done; conversion cost and friction recorded in kb.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M2.1 | Pick the first real project (starwards playbook via init --from, or this repo only); consumed by M2.2 | DECIDE |  |  | open |
| M2.2 | Run init --from on the chosen project; record conversion cost and dropped rows in kb | DO |  | M2.1 | open |
| M2.3 | Finish one real milestone of the chosen project using what-now; log each friction point in kb | DO |  | M2.2 | open |
| M2.4 | Merge or close #22 (tracks this repo with done; .done/ is public) | REVIEW |  |  | pr #22 |

## M3 — Next scope

Exit: the next strategy beyond value-ladder is chosen, with a goals run scoping it.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M3.1 | Check whether the sandbox→Windows path rewrite applies to tool output or only to what the user sees | DO |  |  | open |
| M3.2 | Pick the next planning/prioritizing strategy; consumed by the next goals run | DECIDE |  | M2.3 | open |

## Cut list
