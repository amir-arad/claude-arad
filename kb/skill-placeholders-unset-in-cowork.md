---
date: 2026-09-19
related: [cross-harness-plugins.md, cowork-sandbox-environment.md, runbooks.md, glossary.md]
synthesized_from:
  date: 2026-09-19
  topic: "done:init smoke skills v1 and v2 run in Cowork: CLAUDE_SKILL_DIR / CLAUDE_PLUGIN_ROOT behaviour"
  tool: cowork
---

# Skill placeholders `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` in Cowork: substituted in text, absent from the shell

Two different smoke tests ran in Cowork on 2026-09-19. PR #7 is the change between them.

## Smoke v1: shell variable

- `echo "$CLAUDE_SKILL_DIR"` printed empty.
- `ls "$CLAUDE_SKILL_DIR/../../.claude-plugin/plugin.json"` ran as `ls /../../.claude-plugin/plugin.json` and failed.
- `env | grep -i -E 'claude|plugin|skill'` matched only `CLAUDE_CODE_TMPDIR`, `CLAUDE_TMPDIR`, `CLAUDE_CODE_HOST_HTTP_PROXY_PORT`, `CLAUDE_CODE_HOST_SOCKS_PROXY_PORT`.

Result: the Cowork shell has no path environment variable. v1 tested nothing about substitution.

## Smoke v2: substituted text

| Check | Output |
|---|---|
| `[${CLAUDE_SKILL_DIR}]` | `C:/Users/green/AppData/Roaming/Claude/local-agent-mode-sessions/8738a278-cdc2-4613-b151-e51ed4a820e6/4c4d032b-44a5-4eae-b09d-ee055211a274/rpm/plugin_01Rkn9mi36M72QHEcZWLSkZX/skills/init` |
| `[${CLAUDE_PLUGIN_ROOT}]` | same path without `/skills/init` |
| `ls` through each | succeeded, reported as `/sessions/practical-great-bell/mnt/.remote-plugins/plugin_01Rkn9mi36M72QHEcZWLSkZX/...` |

Result: both placeholders are substituted, to the Windows host path.

Smoke v3 update: plugin-path input is rewritten to the sandbox path, and the project folder's Windows path is not (bash cannot resolve it). See [smoke v3 results](cowork-smoke-v3-results.md).

## Cowork system prompt, `<skills_instructions>`

> plugin skills refer to their own folders with the placeholders `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}`, which only the Skill tool fills in (they are not environment variables, so a command copied from a file you read yourself runs with them blank)

## Plugin on disk

`~/mnt/.remote-plugins/plugin_01Rkn9mi36M72QHEcZWLSkZX/` is read-only. It holds `.claude-plugin/plugin.json` (`done` 0.2.0), `skills/init/SKILL.md` and `CHANGELOG.md`. The id matches the host path. See [Cowork sandbox environment](cowork-sandbox-environment.md).

## Not tested

- Skill-tool route versus slash form: the slash form goes through the Skill tool (smoke v3 A8). Invoking from the model is untested.
- v2 in Claude Code CLI.
- ~~Host-to-sandbox mapping for `node <path>` and the Read tool~~: works (smoke v3 A6, A7).

## Smoke v2 rerun

A second v2 run in the same session (`practical-great-bell`) produced the same output. `find` returned none, and cwd was `/sessions/practical-great-bell`, the session home, not the selected folder.
