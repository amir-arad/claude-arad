<!-- version: 2 -->
<!-- FORMAT CONTRACT (done plugin)
Written only by lib/state-write.mjs. Version stamp must match the value read before the run.
Snapshot is replaced every run. Watch list persists; each item: `- [ ] <text> (added YYYY-MM-DD; close when <condition>)`; tick and leave for one run, then state-write drops ticked items.
Next holds exactly one card.
-->
# State

## Snapshot 2026-09-19

| awaiting_gate | ready_review | ready_decide | ready_qa | ready_do | blockers |
|---|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 1 | 0 |

Blockers: none
- #23 merged, done 0.5.0 released (#24)
- untracked PR #22 → card M2.4 pr #22 [owner-call]
- plan v3 from goals: 0.5 header, M2 exit = one real milestone

## Watch list

- [ ] .done/ is public if #22 merges (added 2026-09-19; close when #22 is merged or closed)

## Next

M2.4 — Merge or close #22. First action: decide merge vs close from the pre-read.
