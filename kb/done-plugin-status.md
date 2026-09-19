---
date: 2026-09-19
related: [architecture.md, skill-placeholders-unset-in-cowork.md, cowork-sandbox-environment.md, runbooks.md]
synthesized_from:
  date: 2026-09-19
  topic: "Claude Code session building the done plugin: design, review, Gate 0 smoke tests"
  tool: claude-code
---

# Done plugin: where the work stands (2026-09-19)

## What it is

`done` is a solo-project management plugin extracted from the `starwards-what-now` skill (helios/starwards-design). User's framing: "for solo projects management. generic, that can help with any complex backlog or goal", with a `what-now` skill, a `goals` skill, and room for other planning or prioritising approaches later, all in one plugin.

Planned skills: `init` (scaffold `.done/` + interview), `what-now` (sync facts, route one card, prepare it), `goals` (evidence sweep → gaps → milestones → cards). One strategy ships in v1: `agent-fleet` (ladder, modes, failure checks). Scripts in `lib/` derive facts; the model makes judgments.

## Documents

- Design spec: `docs/superpowers/specs/2026-09-15-done-plugin-design.md` — evidence table from the starwards playbook, `.done/` file layout, strict card grammar, skill procedures, harness section.
- Implementation plan: `docs/superpowers/plans/2026-09-15-done-plugin.md` — 13 tasks; Task 1 is Gate 0 (Cowork smoke test), which blocks all later tasks.

## Decisions made by the user

- Name: `done`, lowercase.
- Self-report sync (no issue tracker) is in v1.
- Targets: Claude Code and Cowork. "cowork must install."
- The design was reviewed by a second Claude session (claude-arad-c1); its accepted points and rebuttals are folded into the spec.

## Progress

| Step | State |
|---|---|
| PR #5 `feat(done): scaffold plugin with Cowork smoke init` | merged 2026-09-14; released as `done` 0.2.0 (PR #6) |
| Smoke v1 in Cowork | ran; `CLAUDE_SKILL_DIR` empty. The test was flawed: it read a shell variable, but the placeholder is text substitution. Established: `node` v22.23.2 present, `gh` absent, git 2.34.1 |
| PR #7 `fix(done): smoke test reads substituted skill path, not env var` | merged; smoke v2 echoes the substituted placeholder text, env, and searches for the plugin on disk |
| Smoke v2 / environment probe in Cowork | ran; placeholders substituted to the Windows host path; results in [skill placeholders in Cowork](skill-placeholders-unset-in-cowork.md) and [Cowork sandbox environment](cowork-sandbox-environment.md) |
| Knowledge base commit `801ac68 docs: add knowledge base and garden state` | pushed onto the PR #7 branch; a squash-merge files it under the `fix(done)` title unless split out |
| Tasks 2–13 (scripts, templates, strategy, real skills) | not started |

## Changes Claude proposed after the Cowork findings (not yet approved)

1. **Plugin root resolution:** each skill first uses `${CLAUDE_SKILL_DIR}` if substituted; otherwise locates the plugin with `grep -l '"name": *"done"' ~/mnt/.remote-plugins/*/.claude-plugin/plugin.json` and takes that directory's parent's parent.
2. **`.done/` placement:** `init` refuses the session home and `outputs/`; in Cowork it requires a selected project folder.
3. **Writes:** bash writes into the selected folder are untested. The next smoke adds a bash write/delete probe there; on failure, scripts would print content and the model writes it with Write, the version-stamp check still run by script.
4. PR #7 to gain the root-resolution step and the write probe, or be closed in favour of doing this in the first real skill — user's choice pending.

## Open questions for the user

- Approve the three Cowork changes above.
- PR #7: extend or close.
- Merge PR #7 with the KB commit inside it, or split the KB commit into its own `docs:` PR.

## Where the design evidence came from

- Original skill: `C:/Workspace/helios/starwards-design/.claude/skills/starwards-what-now/SKILL.md` (one commit, 2026-08-02).
- Playbook it maintained: `C:/Workspace/helios/starwards-design/product/hour-playbook.md` (600 lines, v1–v118, 96 commits). Read in chunks.
- Successor plan in the card format, planned as a conversion fixture: `C:/Workspace/helios/starwards-design/product/gap-closing-plan.md`.

## Could still be wrong (as stated in the session)

- Whether a Skill-tool invocation (not the `/done:init` slash form) substitutes the placeholders in Cowork was not tested.
- Precedence of ladder rule 1 rests on one PR-rot episode in the starwards playbook (v94).
- The strict card grammar rejects the current starwards playbook; conversion cost is unmeasured.
- The self-report and `capacity: none` paths have no real-project evidence.
