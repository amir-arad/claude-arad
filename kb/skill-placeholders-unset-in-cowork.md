---
date: 2026-09-19
related: [cowork-sandbox-environment.md, runbooks.md, glossary.md]
synthesized_from:
  date: 2026-09-19
  topic: "done:init smoke skill run in Cowork: CLAUDE_SKILL_DIR / CLAUDE_PLUGIN_ROOT behaviour"
  tool: cowork
---

# Skill placeholders `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` are unset in the Cowork sandbox

Observed running `/done:init` (smoke) in Cowork on 2026-09-19.

## What happened

1. The skill's text as delivered to the model carried a header line `Base directory for this skill: C:\...\rpm\plugin_01Rkn9mi36M72QHEcZWLSkZX\skills\init` — a Windows host path.
2. In the bash sandbox, `echo "$CLAUDE_SKILL_DIR"` printed empty.
3. `ls "$CLAUDE_SKILL_DIR/../../.claude-plugin/plugin.json"` therefore ran as `ls /../../.claude-plugin/plugin.json` → `No such file or directory`.
4. `env | grep -i -E 'claude|plugin|skill'` matched only `CLAUDE_CODE_TMPDIR`, `CLAUDE_TMPDIR`, `CLAUDE_CODE_HOST_HTTP_PROXY_PORT`, `CLAUDE_CODE_HOST_SOCKS_PROXY_PORT`. No skill or plugin path variable exists.

## What the Cowork system prompt says about the placeholders

Quoted from the `<skills_instructions>` block: plugin skills "refer to their own folders with the placeholders `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}`, which only the Skill tool fills in (they are not environment variables, so a command copied from a file you read yourself runs with them blank)."

The `/done:init` invocation arrived as a `<command-name>` block with the skill body inlined, not through the Skill tool; the placeholders in that body were not substituted (the v2 skill text shows them literally as `[${CLAUDE_SKILL_DIR}]`).

## Where the plugin actually was

`~/mnt/.remote-plugins/plugin_01Rkn9mi36M72QHEcZWLSkZX/` — read-only, containing `.claude-plugin/plugin.json` (name `done`, 0.2.0), `skills/init/SKILL.md`, `CHANGELOG.md`, no `lib/`. The id in the sandbox path equals the id in the Windows header path. Details in [Cowork sandbox environment](cowork-sandbox-environment.md).

## Limits

One plugin, one session, Cowork only. Not tested: whether invoking via the Skill tool (rather than `/plugin:skill` slash form) substitutes the placeholders in Cowork; whether Claude Code CLI behaves the same.
