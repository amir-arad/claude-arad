---
name: goals
description: Replan. Restates the intended change, sweeps evidence, lists gaps, rewrites milestones and cards in .done/plan.md, reconciles owner-call decisions, records reversals. Confirms with you before writing.
argument-hint: "<the change: new goal, cut, re-prioritise, or 'reconcile'>"
disable-model-invocation: true
---

# goals

`LIB` = `${CLAUDE_SKILL_DIR}/../../lib`, `ASSETS` = `${CLAUDE_SKILL_DIR}/../../assets`. Write these paths out in full in every command.

## Project root → `ROOT`

Same rule as what-now:
- Cowork (`~/mnt/` exists): `ls -a ~/mnt`; candidates are entries other than `outputs`, `uploads` and dot-dirs that contain `.done/`. One → `ROOT`. Several → ask which. None → `Run /done:init`, stop.
- Otherwise: `git rev-parse --show-toplevel`, else the current directory.
- `ROOT/.done/` missing → `Run /done:init`, stop.

Scratch files go in `ROOT/.done/work/` (overwrite, never delete).

## 0. Confirmation gate

Read `ROOT/.done/project.md` (goal), `ROOT/.done/plan.md` (note its version), `ROOT/.done/decisions.md`, all of `ROOT/.done/log.md`. Restate `$ARGUMENTS` as one sentence and name the goal line or recorded decision it touches. If it contradicts a decisions.md line, ask once: new information, or a reversal? Wait for yes before step 1.

## 1. Sweep

For each area the change touches, read the evidence the user names (code, docs, notes, tracker). One sweep per area; two lines each: what exists, what is missing.

## 2. Gaps

`| Gap | Evidence (file/line or fact) | Severity (blocks goal / degrades / cosmetic) | Candidate card(s) |`. No gap without evidence.

## 3. Milestones

Strictly ordered. Each: id, title, one `Exit:` line. Rows inside a milestone are parallel unless blocked.

## 4. Cards

In the grammar at the top of `ASSETS/plan-template.md`. Every DISPATCH names an issue (`filed #N`) or states in its Action that one must be filed; every DECIDE names in its Action who consumes the ruling. Cuts go to `## Cut list` with a reason, never silently dropped.
Reconcile every `[owner-call]` line in decisions.md dated after the last `goals` log line: each becomes a card, a cut-list line, or is superseded (say which).
Reversal → append `- <date> — <what> — reversed: <old> → <new> — by <owner>` to decisions.md.

## 5. Validate and write (*script*, guarded)

Write the new plan to `ROOT/.done/work/plan.md`, then:
```
node ${CLAUDE_SKILL_DIR}/../../lib/cards.mjs validate "ROOT/.done/work/plan.md"
node ${CLAUDE_SKILL_DIR}/../../lib/state-write.mjs "ROOT/.done/plan.md" --expect-version <version from step 0> --from "ROOT/.done/work/plan.md" --json
node ${CLAUDE_SKILL_DIR}/../../lib/log-append.mjs "ROOT" --run goals --version <new plan version> --card - --rule - --text "<one line: what changed>"
```
Validation exit 2 → fix and re-run. Write exit 2 (`version mismatch`) → report and restart from step 0 once.
If the goal itself changed, edit the `## Goal` paragraph of project.md.
Manual: as in what-now step 7; log line with `manual:`. Nothing is committed.

## 6. Output

Milestones with exit criteria, card count per milestone, cut-list additions, reversals recorded, then `Next: run /done:what-now`.
