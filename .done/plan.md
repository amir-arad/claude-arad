<!-- version: 1 -->
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

## M1 — First milestone

Exit: what must be true to call M1 done.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M1.1 | Replace me | DECIDE |  |  | open |

## Cut list
