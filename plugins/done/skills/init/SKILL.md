---
name: init
description: Create .done/ at the project root and fill project.md through a short interview. Idempotent; never overwrites. Optionally converts an existing plan file into the card grammar.
argument-hint: "[root] [--from <legacy plan path>]"
disable-model-invocation: true
---

# init

`LIB` = `${CLAUDE_SKILL_DIR}/../../lib`, `ASSETS` = `${CLAUDE_SKILL_DIR}/../../assets`. Write these paths out in full in every command.

## 0. Project root → `ROOT`

- A root given as the first token of `$ARGUMENTS` wins.
- Cowork (`~/mnt/` exists): `ls -a ~/mnt`. Candidates are entries other than `outputs`, `uploads` and dot-dirs. One → `ROOT=~/mnt/<it>`. Several → list them and ask which. None → call the cowork directory-request tool (`request_cowork_directory`), then re-list. Never use the session home, `~/mnt/outputs`, or the folder's Windows path (bash cannot resolve it).
- Otherwise (Claude Code): `git rev-parse --show-toplevel`, else the current directory.

State `ROOT` in one line before writing anything.

## 1. Scaffold (*script*)

```
node ${CLAUDE_SKILL_DIR}/../../lib/init-scaffold.mjs "ROOT" --json
```

Report `created` and `already_present`. Exit 2 → report the refusal and stop.
Manual (no `node`): for `project`, `plan`, `state`, `decisions`, copy `ASSETS/<name>-template.md` to `ROOT/.done/<name>.md` unless it exists. Create `ROOT/.done/log.md` unless it exists, with the `LOG_HEADER` text from `LIB/log-append.mjs` followed by `- <YYYY-MM-DD> init v1 manual: rule:- card:- scaffolded .done/`. Never overwrite an existing file.

## 2. Interview — one question at a time; stop when project.md is complete

Skip any question whose answer is already in `ROOT/.done/project.md`. Order:

1. Project name, and the goal in one sentence. (→ `name`, `## Goal`)
2. Where is progress visible? Local git only, GitHub issues and PRs, or nowhere (you tell me each run)? (→ `sync: git | github | self-report`; github → `sync.repo: owner/repo`)
3. If GitHub: which label means "ready for a worker", which "in progress"? (→ `sync.labels.ready`, `sync.labels.in_progress`)
4. Who does work besides you: agents, people, nobody? (→ `capacity: agents | people | none`)
5. If agents or people: how many should be busy at once? (→ `thresholds.max_in_flight`)
6. Which files or surfaces must this plugin never edit? (→ `never`, comma-separated)

Edit only the lines inside the fenced block of project.md and the `## Goal` paragraph; keep the FORMAT CONTRACT comment. `strategy: agent-fleet` (the only one shipped). Do not ask about gates or `rebase_after`; defaults apply until the user edits project.md.

## 3. Legacy plan conversion (only with `--from <path>`)

Read the file. For every table row or list item that is a unit of work, draft one card in the grammar at the top of `ASSETS/plan-template.md`:
- Struck (`~~`) or done rows → omit; list them in the reply as "already done, not carried over".
- Free-text "Blocked on" → `ext:<text>`; tell the user so they can replace it with a card id.
- Unknown mode → nearest of DECIDE / DISPATCH / REVIEW / QA / DO; say which you guessed.
- Rulings found inline → one line each in `ROOT/.done/decisions.md`.

Write the draft to `ROOT/.done/work/plan.md`, then:

```
node ${CLAUDE_SKILL_DIR}/../../lib/cards.mjs validate "ROOT/.done/work/plan.md"
```

Fix what it lists and re-run until `ok`. Then install it (plan.md from the scaffold is version 1):

```
node ${CLAUDE_SKILL_DIR}/../../lib/state-write.mjs "ROOT/.done/plan.md" --expect-version 1 --from "ROOT/.done/work/plan.md" --root "ROOT" --json
```

Manual: check each row against the grammar by hand, write plan.md directly, and say `manual:` in the report.

## 4. Report

Root, files created / present, the project.md block as written, cards converted (count) and rows dropped. `.done/work/` holds scratch files; suggest adding it to `.gitignore`. End with: `Run /done:what-now`. Nothing is committed.
