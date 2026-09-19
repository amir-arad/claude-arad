---
name: init
description: Smoke check for the done plugin (temporary). Reports how the plugin's own path reaches the skill, and tool availability. Replaced by the real init in a later release.
disable-model-invocation: true
---

# init (smoke v2)

Report each check as one line, `<check>: <result>`. Do not interpret, do not fix, nothing else.

1. skill-dir text: copy verbatim the text between the brackets: [${CLAUDE_SKILL_DIR}]
2. plugin-root text: copy verbatim the text between the brackets: [${CLAUDE_PLUGIN_ROOT}]
3. skill-dir ls: run `ls "${CLAUDE_SKILL_DIR}/../../.claude-plugin/plugin.json"` and report output or error.
4. plugin-root ls: run `ls "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json"` and report output or error.
5. env: run `env | grep -i -E 'claude|plugin|skill' | cut -c1-200` and report every line (or `none`).
6. find: run `find / -path '*done*' -name plugin.json 2>/dev/null | head -5` and report every line (or `none`).
7. node: `node --version` or `absent`.
8. gh: `gh --version | head -1` or `absent`.
9. git: `git --version` or `absent`.
10. cwd: `pwd`.
