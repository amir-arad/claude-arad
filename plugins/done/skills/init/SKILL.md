---
name: init
description: Smoke check for the done plugin (temporary). Prints the skill directory and tool availability. Replaced by the real init in the next release.
disable-model-invocation: true
---

# init (smoke)

Run each command and report its exact output, one line each. Do not interpret, do not fix.

1. `echo "$CLAUDE_SKILL_DIR"` — expected: an absolute path ending in `skills/init`. If empty, say `CLAUDE_SKILL_DIR: unset`.
2. `ls "$CLAUDE_SKILL_DIR/../../.claude-plugin/plugin.json"` — expected: the path. If missing, say so.
3. `node --version` — or `node: absent`.
4. `gh --version | head -1` — or `gh: absent`.
5. `git --version` — or `git: absent`.
6. `pwd` and `ls -a` of the working directory.

Output format: six lines, `<check>: <result>`. Nothing else.
