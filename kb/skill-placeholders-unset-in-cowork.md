---
date: 2026-09-19
related: [cross-harness-plugins.md, cowork-sandbox-environment.md, runbooks.md, glossary.md]
synthesized_from:
  date: 2026-09-19
  topic: "done:init smoke skills v1 and v2 run in Cowork: CLAUDE_SKILL_DIR / CLAUDE_PLUGIN_ROOT behaviour"
  tool: cowork
---

# Skill placeholders `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` in Cowork: substituted in text, absent from the shell

Two different smoke tests ran in Cowork on 2026-09-19. PR #7 is the change between them. They tested different things, so they do not contradict each other.

## Smoke v1: shell variable check (tests nothing about substitution)

v1 ran `echo "$CLAUDE_SKILL_DIR"` and `ls "$CLAUDE_SKILL_DIR/../../.claude-plugin/plugin.json"`. Both read the **shell environment**:
- `echo` printed empty.
- `ls` ran as `ls /../../.claude-plugin/plugin.json` and failed.
- An `env | grep -i -E 'claude|plugin|skill'` probe matched only `CLAUDE_CODE_TMPDIR`, `CLAUDE_TMPDIR`, `CLAUDE_CODE_HOST_HTTP_PROXY_PORT`, `CLAUDE_CODE_HOST_SOCKS_PROXY_PORT`.

Established: no skill or plugin path **environment variable** exists in the Cowork shell. The same is expected in Claude Code, where the placeholders are also text substitutions (inference).

## Smoke v2: substituted text (PR #7)

v2 wrote `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` into the skill text and asked for them to be echoed verbatim. The `/init` run in Cowork reported:

- skill-dir text: `C:/Users/green/AppData/Roaming/Claude/local-agent-mode-sessions/8738a278-cdc2-4613-b151-e51ed4a820e6/4c4d032b-44a5-4eae-b09d-ee055211a274/rpm/plugin_01Rkn9mi36M72QHEcZWLSkZX/skills/init`
- plugin-root text: the same path without `/skills/init`.
- `ls` through each succeeded, reported as `/sessions/practical-great-bell/mnt/.remote-plugins/plugin_01Rkn9mi36M72QHEcZWLSkZX/...`.

Established: both placeholders **are substituted** in Cowork, to the **Windows host path**. Unknown: what turned the host path into the sandbox path. It was either the Cowork shell tool or the Cowork model rewriting the command.

## What the Cowork system prompt says

Quoted from the `<skills_instructions>` block: plugin skills "refer to their own folders with the placeholders `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}`, which only the Skill tool fills in (they are not environment variables, so a command copied from a file you read yourself runs with them blank)."

Consequence: a command a model copies from a SKILL.md it read with a file tool, rather than received through the Skill tool, has the placeholders blank. This applies to skills that call other skills by path, like garden's `maintain`, which reads `survey/SKILL.md` directly (inference).

## Where the plugin actually was

`~/mnt/.remote-plugins/plugin_01Rkn9mi36M72QHEcZWLSkZX/` is read-only. It contains `.claude-plugin/plugin.json` (name `done`, 0.2.0), `skills/init/SKILL.md` and `CHANGELOG.md`, and no `lib/`. The id matches the host path's id. Details: [Cowork sandbox environment](cowork-sandbox-environment.md).

## Limits

One plugin on one machine, Cowork only, with one run of each smoke test. Not tested:
- the Skill-tool route versus the slash form;
- Claude Code CLI behaviour with v2;
- whether the host-to-sandbox path translation applies to `node <path>` calls.
