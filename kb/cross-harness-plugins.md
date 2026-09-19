---
date: 2026-09-19
related: [skill-placeholders-unset-in-cowork.md, cowork-sandbox-environment.md, runbooks.md, done-plugin-status.md, architecture.md]
synthesized_from:
  date: 2026-09-19
  topic: "Building the done plugin for Claude Code and Claude Cowork: docs read, two Cowork smoke tests"
  tool: claude-code
---

# Cross-harness plugins: writing skills that work in both Claude Code and Cowork

Evidence base: docs, plus one run each of two smoke tests of `done` in Cowork, on one Windows host, 2026-09-19.

## Distribution

- Cowork installs from a GitHub repo marketplace: Customize → Plugins → Add marketplace, `owner/repo`. See [Install plugins](https://claude.com/docs/cowork/guide/plugins).
- `amir-arad/claude-arad` installed. `done` 0.2.0 ran.
- After a release, click **Update** on the marketplace in Cowork.
- `plugin.json` and `marketplace.json` needed no Cowork-specific change.

## Plugin files

| Side | Path |
|---|---|
| Cowork sandbox | `~/mnt/.remote-plugins/plugin_<id>/`, read-only |
| Windows host | `C:/Users/<user>/AppData/Roaming/Claude/local-agent-mode-sessions/<uuid>/<uuid>/rpm/plugin_<id>/` |

- `<id>` is opaque and the same on both sides.
- The plugin name is not in the path, so `find -path '*<plugin-name>*'` fails.

## Placeholders `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`

- They are text substitutions, never environment variables, so `$CLAUDE_SKILL_DIR` in a shell is empty.
- A smoke test must print the text, e.g. `[${CLAUDE_SKILL_DIR}]`.
- Cowork system prompt: the Skill tool alone fills them in, and a SKILL.md read with a file tool keeps them blank. Quote: [skill placeholders in Cowork](skill-placeholders-unset-in-cowork.md).

| Smoke | Tested | Cowork result |
|---|---|---|
| v1 | shell `$CLAUDE_SKILL_DIR` | empty. No substitution result |
| v2 (PR #7) | text `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}` | both substituted, to the Windows host path |

- In v2, `ls` through the host path succeeded against the sandbox path. The mapper is unknown: the shell tool or the model.
- Docs name `${CLAUDE_SKILL_DIR}` for skills generally ([Creating custom skills](https://claude.com/docs/skills/how-to)) and `${CLAUDE_PLUGIN_ROOT}` for Claude Code. Cowork substituted both.

`done` design (unverified):
1. All paths use `${CLAUDE_SKILL_DIR}/../../<dir>/...`.
2. If the path doesn't exist, rebuild it as `~/mnt/.remote-plugins/plugin_<id>/...`. With no id, grep `~/mnt/.remote-plugins/*/.claude-plugin/plugin.json` for `"name"`.

`garden` uses `${CLAUDE_PLUGIN_ROOT}` and is untested in Cowork.

## Scripts

- Cowork sandbox: Ubuntu 22.04, `/bin/sh`, `node` v22.23.2, npm 10.9.8, python3 3.10.12, git 2.34.1. `gh` absent.
- All egress goes through an authenticated localhost proxy. See [Cowork sandbox environment](cowork-sandbox-environment.md).
- Docs: skills may ship Python, Node.js or Bash scripts.
- `done` approach:
  - zero-dependency Node `.mjs`;
  - `gh` absent → self-report sync;
  - a manual fallback per script step, logged as `manual:`.

## Writable locations (Cowork)

| Location | Behaviour |
|---|---|
| `/sessions/<name>` (home) | per session; the name changed between runs |
| `~/mnt/outputs/` | create ok, `rm` denied |
| `~/mnt/uploads/` | read-only |
| plugin tree | read-only |
| user-selected folder (`mcp__cowork__request_cowork_directory`) | Write/Edit ok; shell writes untested |

Per-project state belongs in a user-selected folder.

## Git

helios `CLAUDE.md` (2026-09-04): in a Cowork-mounted repo, git strands `.git/*.lock` unless `mcp__cowork__allow_cowork_file_delete` is granted first.

## Frontmatter

`name`, `description`, `disable-model-invocation: true` and `argument-hint` work in Cowork (`done:init`) and Claude Code (`garden`). Other fields are untested in Cowork.

## Smoke-test recipe

A temporary skill prints one line per check:
1. `[${CLAUDE_SKILL_DIR}]`, `[${CLAUDE_PLUGIN_ROOT}]`
2. `ls` of `plugin.json` through each
3. `env | grep -i -E 'claude|plugin|skill'`
4. `node`, `gh`, `git`, `python3` versions
5. `pwd`
6. write-then-delete in the state folder

Run it in both harnesses. `plugins/done/skills/init/SKILL.md` at 0.2.x covers 1–5.
