---
date: 2026-09-19
related: [architecture.md, cross-harness-plugins.md, skill-placeholders-unset-in-cowork.md, cowork-sandbox-environment.md, runbooks.md]
synthesized_from:
  date: 2026-09-19
  topic: "Claude Code session building the done plugin: design, review, Gate 0 smoke tests"
  tool: claude-code
---

# Done plugin: status (2026-09-19)

## Scope

- `done` is a solo-project management plugin, extracted from `starwards-what-now` (helios/starwards-design).
- User's words: "for solo projects management. generic, that can help with any complex backlog or goal". It needs a `what-now` skill and a `goals` skill, and later "different planning or prioritizing approaches", all in the same plugin.
- Planned skills:
  - `init`: scaffold `.done/`, then an interview.
  - `what-now`: sync facts, route one card, prepare it.
  - `goals`: evidence sweep → gaps → milestones → cards.
- v1 ships one strategy, `agent-fleet`: a routing ladder, mode defaults and failure checks.
- Scripts in `lib/` produce facts. The model makes judgments.

## Documents

- Spec: `docs/superpowers/specs/2026-09-15-done-plugin-design.md`
- Plan: `docs/superpowers/plans/2026-09-15-done-plugin.md`. It has 13 tasks. Task 1 (Gate 0, the Cowork smoke test) blocks the rest.

## User decisions

- Name `done`, lowercase.
- Self-report sync is in v1.
- Targets are Claude Code and Cowork: "cowork must install".

A second session (claude-arad-c1) reviewed the design. Its accepted points are in the spec.

## Progress

| Step | State |
|---|---|
| PR #5, stub plus smoke v1 | merged 2026-09-14; released `done` 0.2.0 (PR #6) |
| Smoke v1 in Cowork | read the shell variable only, so no substitution result. `node` v22.23.2, `gh` absent, git 2.34.1 |
| PR #7, smoke v2 | merged, together with KB commit `801ac68` |
| Smoke v2 in Cowork | placeholders substituted to the Windows host path, `ls` through both succeeded. See [skill placeholders in Cowork](skill-placeholders-unset-in-cowork.md) |
| PR #9, KB notes + smoke v3 | merged |
| Smoke v3 | PR #9 merged, released 0.2.2, ran in Cowork |
| Spec §5/§7/§8 + plan revisions | PR #12 (first commit) |
| Tasks 2–8, scripts and templates | PR #12 merged, released `done` 0.3.0 |
| Tasks 9–12, strategy + skills init/what-now/goals | branch `feat/done-skills`, 24 tests pass; `lib/smoke.mjs` removed |
| Task 13, Cowork end-to-end | ran on 0.4.0: [results](done-cowork-e2e-results.md). 3 sync bugs + skill rename fixed in PR #16, released 0.4.1 |
| Card id reuse (found in e2e) | PR #18: validate rejects reused ids; reviewed, approved |

## Decisions after smoke v2 (2026-09-19)

User decisions:
- **Project folder:** "in cowork there is always a folder. init should work on the root of the project folder." `.done/` goes at that root.
- **Sync:** "read git". Local `git log`/`status` in the folder, plus a GitHub MCP connector when one is available. `gh` is optional (Claude Code only). Self-report is the last resort.
- **Generic:** nothing specific to starwards (org, repo, labels) goes into `done`.
- **Paid tests:** each Cowork run costs the user, so every smoke run must probe everything still open.

Implementation details, settled by testing rather than approval:
- Paths: `${CLAUDE_SKILL_DIR}/../../<dir>/...` works for the shell, `node` and the Read tool (smoke v3).
- Writes: shell, node and the Write tool all work in the folder. Deletes need the Cowork delete grant (smoke v3).

## Smoke v3 (ran 2026-09-19, done 0.2.2)

Results: [Cowork smoke v3 results](cowork-smoke-v3-results.md). In short:
- Placeholder paths work for the shell, `node` and the Read tool. No rebuild fallback is needed.
- The folder is at `~/mnt/<name>`, and cwd is the session home.
- Shell, `node` and Write-tool writes work, and so do overwrite and rename, even before the grant.
- Deletes need `mcp__cowork__allow_cowork_file_delete`, once per session.
- Git reads work. `fetch` and HTTPS to GitHub are blocked.
- The GitHub connector works, but its tool names have no `github` in them.

Also: bash cannot resolve the folder's Windows path, so use `~/mnt/<name>`. Output converts folder paths back to Windows paths.

## Design evidence sources

- `C:/Workspace/helios/starwards-design/.claude/skills/starwards-what-now/SKILL.md`: one commit, 2026-08-02.
- `C:/Workspace/helios/starwards-design/product/hour-playbook.md`: 600 lines, v1–v118, 96 commits. Read it in chunks.
- `C:/Workspace/helios/starwards-design/product/gap-closing-plan.md`: planned conversion fixture.

## Open risks

- Typing `/done:init-done` goes through the Skill tool: a hook reported `Skill "done:init-done" was invoked` (smoke v3 A8). Invoking from the model without the slash command is untested.
- Ladder rule 1's precedence rests on one PR-rot episode (playbook v94).
- The strict card grammar rejects the current starwards playbook. Conversion cost is unmeasured.
- The self-report and `capacity: none` paths have no real-project evidence.
- **Pinned: skill names (init, what-now, goals) collide with generic names.** Evidence (e2e run, 2026-09-19): Cowork shows a typed `/done:init-done` as `/init` with the namespace dropped, but it still ran done's init. So routing uses the full name; the drop is display only. Claude Code has a built-in `/init`, and other plugins may ship `init`. Rename (e.g. `init-done`) only if a bare `/init` in Cowork runs done's init or is ambiguous. Cost of a rename: Claude Code shows `/done:init-done-done`. Result (same run, step 7): the Cowork picker lists two identical `init` entries, done and garden. Only the hover tooltip (description + "Done plugin" / "Garden plugin") tells them apart. Ambiguity confirmed at selection time → rename justified.

## Build decisions in PR #12 (2026-09-19)

Recorded in detail in the plan's "Revisions after Gate 0" section. Summary:
- `lib/sync-git.mjs`: facts from `git log` only (commits since a date, `#N` refs). It skips `git status` because of the CRLF effect in Cowork.
- `lib/sync-github.mjs`: `gh` (Claude Code), or `--from-dir` with `merged.json`/`open.json`/`issues.json` that the model saves from a GitHub MCP connector. It accepts both `gh` and REST shapes.
  - The REST shape was inferred from the GitHub API docs. Task 13 confirmed it: REST field names, labels as plain strings ([e2e results](done-cowork-e2e-results.md)).
- `writeAtomic` (temp file + rename) for every rewrite; no script deletes.
- `init-scaffold` refuses the home dir and `~/mnt/outputs`.
- `project.md` default `sync: git`.
- Plan defects found and fixed:
  - A test contradicted the rule that `ruled` cards are archived like `done`.
  - Watch items were dropped in the same run they were ticked.
  - The log was appended before the write.
  - The parsers did not handle CRLF.

## Host facts found while building

- Checkouts on this Windows host have CRLF working trees (`core.autocrlf=true`). Any parser of `.done/` files must split on `\r?\n`.
- `node --test <dir>` fails on node v22.13.1 on Windows. Use a `*.test.mjs` glob.

## Build decisions in feat/done-skills (2026-09-19)

- Skills resolve the project root first (spec §8). what-now and goals keep only `~/mnt` candidates that contain `.done/`, so a second selected folder without `.done/` causes no question.
- Scratch files live in `ROOT/.done/work/` and are overwritten, never deleted. Reason: on Windows, `node` resolves `/tmp` to `C:	mp` while bash resolves it elsewhere; the project folder is writable in both harnesses. Connector raw output stays there as evidence (`merged.json`, `open.json`, `issues.json`).
- Connector sync: the model saves the item arrays as returned (only an outer wrapper object is unwrapped) so `sync-github.mjs` sees the real shape.
- Bug found and fixed: `state-write` archived done/ruled cards from plan.md but left their ids in other rows' Blocked on, so the next `cards.mjs validate` failed ("blocked on unknown card"). `guardedWrite` now strips archived ids; test added.
- Strategy files carry no starwards issue numbers (generic rule); the evidence stays in spec §2.
- The plan template ships an example card M1.1, so a fresh init routes it (rule 3) until goals replaces it.

## Claude Code check (2026-09-19)

Headless `claude -p "/done:what-now" --plugin-dir plugins/done` in a temp git repo with a card at `pr #3` and a commit `feat: start (#3)`: git sync matched the ref, set the card done, state-write archived it, state.md v2, plan.md v3, one log line `what-now v2 rule:4 card:M1.2`, output in the §8 shape. init and goals were not run headlessly (the interview and the confirmation gate need a user).

## Remaining after plan Task 13 (2026-09-19)

All 13 plan tasks are done. The plugin is not yet finished against the objective:

1. Nothing since 0.4.0 has run in Cowork (the renamed commands, the sync fixes, the id check). Needs one paid run.
2. Untested paths:
   - the `gh` exit-2 fallback
   - a connector result wrapped in an outer object
   - `|` inside a cell (known to break parsing, not fixed)
   - `sync: self-report`
   - `capacity: none`
3. No real-project use: `init --from` conversion has never run, and the starwards playbook conversion cost is unmeasured.
4. Later scope: other planning or prioritizing strategies. Only `agent-fleet` exists.
5. Small items:
   - goals could delete the template example card instead of cutting it; cutting it makes the first real card M1.2
   - does the sandbox-to-Windows path rewrite apply to tool output, or only to what the user sees?

Items 1 and 3 decide whether the plugin is usable. Item 4 is new work.

## Fixes before the second Cowork run (fix/done-pre-e2e-2, 2026-09-19)

- **`|` in a cell**: previously the row failed with `expected 6 cells, got 7`. Now `\|` is the escape (GitHub table syntax). `cards.mjs` splits cells on unescaped pipes and unescapes them; `state-write` uses the same split when it rewrites Blocked on. The plan template grammar says so. Tests added.
- **Wrapped connector result**: `buildFacts` would have crashed on `.map` of an object. `sync-github --from-dir` now takes the only array property of a wrapping object (e.g. `{"total_count":1,"items":[...]}`). An object with zero or several arrays → exit 1, `must be a JSON array...`. Test added. The skill's "unwrap it yourself" instruction stays.
- **what-now on a plan that is already invalid**: the old text ("fix the rows it names (your step-3 edits)") did not cover problems in rows the run did not edit, such as the M1.1 reuse left by the first e2e. Now: show the problems, say `Plan invalid: run /done:goals-done reconcile`, and write nothing.
- **Template card**: goals deletes the template's example row (Action `Replace me`) instead of cutting it, so the first real card is M1.1.
- 32 tests pass.

## `gh` exit-2 fallback: checked on the host (2026-09-19)

Headless `claude -p "/done:what-now-done" --plugin-dir plugins/done` in a temp git repo, with `sync: github`, repo `amir-arad/claude-arad`, `capacity: none`, and gh logged out (`GH_CONFIG_DIR` pointing to an empty dir, `GH_TOKEN` and `GITHUB_TOKEN` empty).
- `sync-github` exited 2 with `gh unavailable: To get started with GitHub CLI...`. The model then called the claude.ai GitHub connector (`mcp__claude_ai_github_copilot__list_pull_requests` twice, `list_issues` once), saved `merged.json` (19 PRs), `open.json` and `issues.json`, and `--from-dir` exited 0. State went to v2, with one log line.
- Evidence: in Claude Code, claude.ai connectors are loaded in `-p` runs, so path 2 is reachable there too.
- The model deviated from rule 3 on the template card M1.1: "placeholder, no decision to packet, route to goals". It logged this as `deviation:`. That is acceptable per the ladder's deviation rule.
- Harness gotcha: on this host, Claude Code runs shell commands with the **PowerShell** tool. The first attempt allowlisted only `Bash(node:*)`, so every script was blocked and the model fell back to manual steps. Allow `PowerShell` in headless runs.
- `capacity: none` caused no error. Nothing in that run depended on it.

The next Cowork run is designed in [done-cowork-e2e-2.md](done-cowork-e2e-2.md).
