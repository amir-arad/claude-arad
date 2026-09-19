---
name: what-now-done
description: Route the next unit of work. Syncs facts from git (and GitHub when configured), updates .done/ state, applies the strategy ladder, and returns exactly one card with its first action prepared. Records scope moves made mid-run as owner-call decisions.
argument-hint: "[what changed, or a constraint for this run]"
disable-model-invocation: true
---

# what-now

`LIB` = `${CLAUDE_SKILL_DIR}/../../lib`, `STRATEGY` = `${CLAUDE_SKILL_DIR}/../../strategies/<strategy from project.md>`. Write these paths out in full in every command.
`$ARGUMENTS` is user input for this run.
Every *script* step has a *manual* alternative for when `node` is absent or the script fails for a reason other than exit 2; a run that used any manual step passes `--manual` to log-append (or writes the `manual:` prefix by hand).

## 0. Project root → `ROOT`

- Cowork (`~/mnt/` exists): `ls -a ~/mnt`. Candidates are entries other than `outputs`, `uploads` and dot-dirs. Keep those that contain `.done/`. One → `ROOT`. Several → ask which. None with `.done/` → say `Run /done:init-done` and stop.
- Otherwise: `git rev-parse --show-toplevel`, else the current directory.
- `ROOT/.done/` missing → say `Run /done:init-done` and stop.

Scratch files go in `ROOT/.done/work/` (create it; overwrite files there, never delete them).

## 1. Read

`ROOT/.done/project.md`, `ROOT/.done/state.md` and `ROOT/.done/plan.md` (note each `<!-- version: N -->`), the last 10 lines of `ROOT/.done/log.md`, `STRATEGY/ladder.md`, `STRATEGY/modes.md`, `STRATEGY/failure-checks.md`. `SINCE` = the date of the last `what-now` log line, else 14 days ago.

## 2. Sync — facts only

a. **git** (*script*), whenever `git -C "ROOT" rev-parse` succeeds:
```
node ${CLAUDE_SKILL_DIR}/../../lib/sync-git.mjs "ROOT" --since SINCE > "ROOT/.done/work/git.json"
```
Manual: `git -C "ROOT" log --since=SINCE --format='%h %ad %s' --date=short`. Do not use `git status` (in Cowork it reports host CRLF files as modified).

b. **GitHub** — only when project.md has `sync: github`. First match wins:
1. `gh --version` succeeds (*script*):
   ```
   node ${CLAUDE_SKILL_DIR}/../../lib/sync-github.mjs --repo <sync.repo> --ready-label <sync.labels.ready> --in-progress-label <sync.labels.in_progress> --since SINCE > "ROOT/.done/work/github.json"
   ```
   Exit 2 (e.g. `gh` not authenticated) → try 2.
2. A GitHub MCP connector is available. Find it by function, not by name: its tool names may be `mcp__<uuid>__*` with no `github` in them. Look (including deferred tools) for tools that list pull requests and list issues for a repo (e.g. `list_pull_requests`, `list_issues`). Call them for `<sync.repo>` and save each result's list of items, as returned, as a JSON array (unwrap an outer object such as `{"items": [...]}`; do not rename fields):
   - `ROOT/.done/work/merged.json` ← closed pull requests, most recently updated first, 30 max
   - `ROOT/.done/work/open.json` ← open pull requests
   - `ROOT/.done/work/issues.json` ← open issues
   Then (*script*):
   ```
   node ${CLAUDE_SKILL_DIR}/../../lib/sync-github.mjs --from-dir "ROOT/.done/work" --repo <sync.repo> --ready-label <..> --in-progress-label <..> --since SINCE > "ROOT/.done/work/github.json"
   ```
   Save all three files on every run, even when you expect no change. Never reuse files from an earlier run. Exit 3 means a file is stale: save it again, then rerun once.
   Name the connector tools you used in the Deltas output (`sync: connector <tool names>`).
3. Neither works → git facts only; say `sync: no GitHub access, git only` in Deltas.

c. **self-report** — `sync: self-report`, or no facts at all: ask one question: "What changed since SINCE? Merged, opened, ruled, blocked — one line each." The answer is the facts.

## 3. Reconcile facts → plan.md status cells

- Merged PR, or a git commit whose `#N` ref matches a card's `pr #N` / `filed #N` / `dispatched #N` → `done <date>`.
- New open PR referencing a card's issue → `pr #N`. Ready label on a card's issue → `dispatched #N`.
- A ruling from the user → `ruled <date>` plus a decisions.md line.
- Run every "After sync" check in `STRATEGY/failure-checks.md`; each hit becomes a delta line, a watch-list item, or a blocker.
- Scope change requested in `$ARGUMENTS` or during the run → add or cut the card now and append `- <date> — <card|scope> — <ruling> — by <owner> [owner-call]` to `ROOT/.done/decisions.md`. Do not refuse. Do not run goals.

If any cell changed, write the new plan to `ROOT/.done/work/plan.md`.

## 4. Derive (*script*)

`PLAN` = `ROOT/.done/work/plan.md` if step 3 wrote it, else `ROOT/.done/plan.md`.
```
node ${CLAUDE_SKILL_DIR}/../../lib/cards.mjs validate "PLAN" --log "ROOT/.done/log.md"
node ${CLAUDE_SKILL_DIR}/../../lib/cards.mjs derive "PLAN" --json
node ${CLAUDE_SKILL_DIR}/../../lib/counts.mjs "PLAN" --project "ROOT/.done/project.md" [--facts "ROOT/.done/work/github.json"] --json
```
Validation exit 2 → fix the rows it names (your step-3 edits), re-run. Pass `--facts` only when a `sync-github.mjs` call in this run's step 2b exited 0 (a failed call leaves `github.json` empty, and an earlier run's file may be stale).
Manual: READY NOW = open cards whose card blockers are all done/ruled and with no `ext:`/`owner:` blocker; IN FLIGHT = `dispatched`/`pr`; AWAITING GATE = `pr`; DECIDE order = ready DECIDE cards by number of cards transitively blocked on them, descending, then plan order.

## 5. Route

Apply `STRATEGY/ladder.md` top down with the counts, the watch list and `$ARGUMENTS`. Deviating → state the reason; it goes in the log line.

## 6. Prepare the routed card per `STRATEGY/modes.md`

Read the files the card needs before writing the packet, ticket, pre-read or checklist. Before a DISPATCH ticket, run the "Before dispatch" checklist and show it ticked. Never flip a label, merge, or edit anything listed under `never:` in project.md; list those actions for the owner.

## 7. Write (*script*, guarded)

Compose the new state.md in `ROOT/.done/work/state.md`, keeping its FORMAT CONTRACT comment: `## Snapshot <date>` (counts table, blockers, deltas one per line), `## Watch list` (carry items forward; tick closed ones), `## Next` (the card and its first action). Then, in this order:
```
node ${CLAUDE_SKILL_DIR}/../../lib/state-write.mjs "ROOT/.done/plan.md" --expect-version <plan version from step 1> --from "ROOT/.done/work/plan.md" --json    # only if step 3 changed plan.md
node ${CLAUDE_SKILL_DIR}/../../lib/state-write.mjs "ROOT/.done/state.md" --expect-version <state version from step 1> --from "ROOT/.done/work/state.md" --json
node ${CLAUDE_SKILL_DIR}/../../lib/log-append.mjs "ROOT" --run what-now --version <new state version> --card <id|-> (--rule <k> | --deviation "<why>") --text "<one line>"
```
Exit 2 with `version mismatch` → another writer changed the file; report it and restart from step 1 once. Never overwrite by hand.
Manual: re-read the file; only if its version stamp is still the one from step 1, write it with the stamp +1 (move `done`/`ruled` rows of plan.md to log.md lines `- <date> archive card:<id> <status> — <action>` and drop their ids from other rows' Blocked on). Append the run line to log.md by hand with `manual:`.

## 8. Output — nothing else

```
Deltas: <one line each, or "none">
Blockers: <or "none">
Next: <card id> — <action>
Why: <one sentence: rule k, or the deviation reason>
First action: <the prepared artifact: packet / ticket + label command / pre-read / checklist / step>
```
