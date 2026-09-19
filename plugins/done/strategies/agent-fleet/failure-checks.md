# agent-fleet — failure checks

Each check comes from a failure recorded in a real agent-fleet project (2026-08/09).

## Before dispatch (per ticket)
- [ ] Self-contained: a worker with only the code repo can act. No "see design doc" (a ticket like that produced 6+ no-op worker runs).
- [ ] No angle-bracket placeholders, no "TBD". Body is write-once: rewriting after dispatch may not re-trigger the worker.
- [ ] Sized for one worker run. Size, not quality, is what blocks workers.
- [ ] No duplicate claim: no open PR already references the issue.
- [ ] Label flip is listed for the owner, never performed by the agent.

## After sync (per run)
- [ ] Stale labels: in-progress label, no PR, quiet > 3 days → watch item; do not count it as in flight.
- [ ] Branch behind base ≥ rebase_after → rule 1 priority.
- [ ] Green CI is not scenario evidence: a REVIEW pre-read says what was actually exercised.
- [ ] Junk drafts: bot-authored or draft PRs with no linked card → list under deltas as "unclaimed"; never route to them.
- [ ] Label without worker: ready label > 3 days, no PR → blocker.
- [ ] Untracked dispatch: an open PR that no card references → add a card with status `pr #N`, tag the decision `[owner-call]`.
- [ ] Single writer: if state.md's version changed since read, stop and re-run; never merge by hand.
