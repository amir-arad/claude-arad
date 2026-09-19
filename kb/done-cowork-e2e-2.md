---
date: 2026-09-19
related: [done-cowork-e2e.md, done-cowork-e2e-results.md, done-plugin-status.md]
---

# Done plugin: second Cowork run (done 0.5.0)

This is one paid Cowork session. It covers everything that has not yet run in Cowork since 0.4.0:
- the renamed commands
- a what-now repeated on the same day (the `SINCE 00:00` fix and re-saving the raw files, with exit 3 on stale files)
- the card id check, including a plan that already reuses an id
- two folders that both have `.done/`, so the skills ask which one
- `sync: self-report`
- 0.5 scope cut: the value-ladder strategy, an init without capacity or label questions, and an old project.md (`strategy: agent-fleet`, capacity and label keys) falling back to value-ladder
- `\|` inside a cell
- goals deleting the template card instead of cutting it

The `gh` exit-2 fallback was checked on the host instead (see [status](done-plugin-status.md)). It cannot happen in Cowork because `gh` is absent there.

## Setup (host, before the session)

- 0.5.0 is released. In Cowork, update the marketplace and check that the picker lists `init-done`, `what-now-done` and `goals-done` under done.
- Folder A `C:\scratch\done-e2e`: keep it as the first run left it. Its plan reuses the cut id M1.1, so it fails validation. Its raw files (`work/{merged,open,issues}.json`) are hours old, so they are stale.
- Folder B `C:\scratch\done-other`: empty, not a git repo.
- The GitHub connector is enabled. Select both folders.

## Steps

| # | User types | Expected | Probes |
|---|---|---|---|
| 1 | `/done:what-now-done` | No folder question: only A has `.done/`. Git sync: `git.json` includes the seed commit even though the last what-now ran today. Connector sync saves all three raw files again (new mtimes); if the model skips that, exit 3. Validation then fails on `M1.1 reuses a cut card id` → output `Plan invalid: run /done:goals-done reconcile`. Deltas or output say `agent-fleet` is missing → value-ladder. state.md and log.md are unchanged | renamed command, same-day SINCE, raw re-save or exit 3, id check, stop rule, strategy fallback |
| 2 | `/done:goals-done reconcile` | Confirmation gate. The reused id gets a new, unused number (M1.3 or later, never M1.1). Validates with `--log`. plan.md v3, log line `goals v3` | goals on an invalid plan |
| 3 | `/done:what-now-done` | Routes the license DECIDE card under its new id (rule 2). state.md v4 | repeat same day |
| 4 | `/done:init-done` | Asks which folder → B. Interview has 3 questions only: name `other`; sync `self-report`; never: none. No capacity or label question. `B/.done/project.md` has `strategy: value-ladder`, `sync: self-report` | init on the second folder |
| 5 | `/done:goals-done replace the example with milestone M1 "choose a license": one DECIDE card "compare MIT \| Apache-2.0" and one DO card "add LICENSE file" blocked on it` (type the pipe as is, without a backslash) | Asks which folder: both have `.done/` now → B. The template row is deleted, not cut, so the cards are M1.1 and M1.2. The Action cell holds `MIT \| Apache-2.0` and validates. Cut list empty | several `.done/` → ask; template deletion; pipe escape |
| 6 | `/done:what-now-done` | Asks which folder → B. No git, sync self-report → asks "What changed since …?" → answer `nothing`. Routes M1.1 (rule 2). No dispatch, ticket or label talk | self-report, value-ladder |

## After the run

Paste the whole transcript and the screenshots. Claude Code then reads both `.done/` folders on the host: the mtimes of `A/.done/work/*.json`, `git.json`, both `plan.md` and `log.md`, and B's `project.md`.
