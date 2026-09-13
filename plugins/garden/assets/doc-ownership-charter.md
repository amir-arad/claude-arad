# Document Ownership Charter

Adopt this as written or amend it deliberately. Its purpose is to make ownership a specific,
bounded, ten-minute-per-quarter commitment rather than an open-ended obligation people
reasonably decline.

---

## What an owner is

**A named person.** Not a team, not an alias, not a distribution list, not a role with no
current occupant. Teams may be recorded as a secondary routing field, but the review
notification goes to a human, because notifications sent to groups are read by nobody.

## What an owner is accountable for

1. **Accuracy at the review interval** for the doc's tier.
2. **Deciding the doc's fate at review time** — keep, update, merge, or archive. "Keep
   as-is" is a valid and common outcome.
3. **Answering or routing questions** the doc generates.
4. **Explicit handover** when changing role. An unhanded-over doc is unowned.

## What an owner is NOT accountable for

- Writing all the content themselves
- Being the deepest subject expert
- Personally fielding every question
- Anything outside the review interval

## Tiers and intervals

| Tier | Test: if this were wrong for six months... | Review every | Stale at |
|------|-------------------------------------------|--------------|----------|
| Critical | someone takes a harmful action | 90 days | 120 days |
| Core | someone does their job badly and does not know | 180 days | 270 days |
| Reference | someone is mildly inconvenienced | 365 days | 540 days |
| Archive | nothing happens | never | never |

Tier by consequence, not by traffic. A rarely-read runbook is Critical; a popular FAQ is
Reference.

## The ten-minute review

1. **Is anything here now wrong?** No → re-date and you are done.
2. **Is anything missing that readers keep asking about?** Add it, or note it.
3. **Does this doc still deserve to exist?** No → merge or archive.

Most reviews end at step 1 — the common case is a doc that is still correct. If a review
routinely takes an hour, the doc is too large; split it.

## Escalation when reviews go overdue

| Overdue by | What happens |
|-----------|--------------|
| 0-30 days | Reminder to the owner |
| 30-60 days | Reminder copies the owner's manager |
| 60-90 days (Critical) | Raised as a risk item; doc shows a reader-visible "unverified" banner |
| 90+ days | Ownership reassigned, or the doc is archived |

The visible banner is the point: it converts a hidden risk into one the reader can see.

## Handover

On role change, the outgoing owner either names a successor or returns the doc to the
domain hub owner for reassignment. Docs returned and unclaimed after two rounds are
deletion candidates — non-acceptance is real information about whether the doc matters.

## Deletion

**Who may delete:** a named human holding deletion authority under this charter. Automated
audits and agent-driven runs never delete; they archive or redirect and leave the decision
here. Record below who holds the authority.

Docs with zero inbound links and zero 90-day traffic are deleted, not archived. Version
history preserves them. Archive is for material with historical or compliance value, not for
material we are reluctant to delete.

If 90-day traffic is not available for this KB, the zero-traffic condition cannot be
evaluated and the rule above does not fire — such docs get read and judged, not deleted on
the link count alone.

Docs with inbound links are redirected, never removed silently. A 404 on a bookmarked doc
costs more trust than the stale doc did.

---

## Acceptance

| Doc or space | Owner (named person) | Team | Tier | Accepted on |
|---------------|---------------------|------|------|-------------|
| | | | | |

Ownership is assigned on an **opt-out** basis: you are the owner of the docs listed above
unless you reply saying otherwise. Opt-out is used because the default outcome of silence is
then coverage rather than a gap — and the docs nobody will claim even under opt-out are
exactly the docs worth retiring.

**Deletion authority under this charter:** <named person or role>. Nobody else deletes.
