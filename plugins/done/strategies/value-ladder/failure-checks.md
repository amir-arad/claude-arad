# value-ladder — failure checks

Each check comes from a failure recorded in a real project (2026-08/09).

## After sync (per run)
- [ ] Green CI is not scenario evidence: a REVIEW pre-read says what was actually exercised.
- [ ] Junk drafts: bot-authored or draft PRs with no linked card → list under deltas as "unclaimed"; never route to them.
- [ ] Untracked work: an open PR that no card references → add a card with status `pr #N`, tag the decision `[owner-call]`.
- [ ] Duplicate claim: two open PRs close the same issue → blocker.
- [ ] Single writer: if state.md's version changed since read, stop and re-run; never merge by hand.
