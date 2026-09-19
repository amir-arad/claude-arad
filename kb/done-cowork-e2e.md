---
date: 2026-09-19
related: [done-plugin-status.md, cowork-smoke-v3-results.md, cross-harness-plugins.md]
---

# Done plugin: Cowork end-to-end protocol (plan Task 13)

One paid Cowork session. It covers the real skills plus three questions still open:
1. The real GitHub connector output shape vs `sync-github.mjs` REST normalisation.
2. Behaviour with several selected folders.
3. What happens when the user asks for a skill in words, without the slash command (`disable-model-invocation: true`).

## Setup (host, before the session)

- Release containing `skills/{init,what-now,goals}` is installed (update the marketplace in Cowork).
- Folder A: new empty dir, e.g. `C:\scratch\done-e2e`, then `git init` and one commit whose subject contains `(#1)`.
- Folder B: any second dir, e.g. `C:\scratch\done-other`.
- The GitHub connector is enabled.

## Steps (one Cowork session, both folders selected)

| # | User types | Expected | Probes |
|---|---|---|---|
| 1 | `what should I work on next? use the done plugin's what-now` | The model cannot invoke the skill (disable-model-invocation). Record exactly what it says or does | open question 3 |
| 2 | `/done:init-done` | Lists both folders, asks which one → answer A. Scaffolds `A/.done/` | open question 2, root rule |
| 3 | Interview answers: name `e2e`; GitHub `amir-arad/claude-arad`; labels `agent-ready` / `agent-in-progress`; capacity `agents`; max 2; never: none | project.md filled, `sync: github` | init interview |
| 4 | `/done:what-now-done` | Asks which folder only if both have `.done/` (they should not → no question). Git sync, then connector sync: saves `A/.done/work/{merged,open,issues}.json`, runs `sync-github --from-dir`, names the connector tools. Routes the template's example card M1.1 (DECIDE, rule 3) | open question 1 |
| 5 | `/done:goals-done replace the example with milestone M1: one DO card "write README" and one DECIDE card "pick license" that blocks it` | Confirmation gate, then plan.md version bumped, log line | goals, guarded write |
| 6 | `/done:what-now-done` | Routes "pick license" (rule 3), state.md version bumped again | derive + ladder |
| 7 | bare `/init` (no namespace) | Record what the picker offers and what runs | skill-name collision (pinned in done-plugin-status.md) |

## After the run

Paste the whole transcript. Claude Code then reads `A/.done/` on the host directly: `work/*.json` (raw connector shape), `work/github.json` (normalised facts), `log.md`, the stamps. Any mismatch → `fix(done):` PR.
