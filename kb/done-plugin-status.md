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
| PR #9, KB notes | open |
| Tasks 2–13 | not started |

## Pending user approval

Proposed after smoke v2:
1. Resolve paths via `${CLAUDE_SKILL_DIR}`. If the path is a drive-letter path that doesn't exist, rebuild it as `~/mnt/.remote-plugins/plugin_<id>/...`.
2. In Cowork, `.done/` goes only in a user-selected folder. `init` refuses the session home and `outputs/`.
3. Shell writes into a selected folder are untested. A failed write is treated as a refusal, and the model then writes with Write.
4. `gh` is absent, so Cowork runs use self-report sync.

## Design evidence sources

- `C:/Workspace/helios/starwards-design/.claude/skills/starwards-what-now/SKILL.md`: one commit, 2026-08-02.
- `C:/Workspace/helios/starwards-design/product/hour-playbook.md`: 600 lines, v1–v118, 96 commits. Read it in chunks.
- `C:/Workspace/helios/starwards-design/product/gap-closing-plan.md`: planned conversion fixture.

## Open risks

- Untested whether invoking through the Skill tool behaves differently from the `/done:init` slash form.
- Ladder rule 1's precedence rests on one PR-rot episode (playbook v94).
- The strict card grammar rejects the current starwards playbook. Conversion cost is unmeasured.
- The self-report and `capacity: none` paths have no real-project evidence.
