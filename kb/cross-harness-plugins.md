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

- In v2 and v3, the shell, `node` and the Read tool all resolved the host path to the sandbox path. In v3, the run's model said the shell tool did the translation. See [smoke v3 results](cowork-smoke-v3-results.md).
- Docs name `${CLAUDE_SKILL_DIR}` for skills generally ([Creating custom skills](https://claude.com/docs/skills/how-to)) and `${CLAUDE_PLUGIN_ROOT}` for Claude Code. Cowork substituted both.

`done` design:
1. All paths use `${CLAUDE_SKILL_DIR}/../../<dir>/...` (works, smoke v3).
2. No rebuild fallback: it was not needed in smoke v3.

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
| user-selected folder (`mcp__cowork__request_cowork_directory`) | create, overwrite and rename ok for shell, node and Write. Delete denied until `mcp__cowork__allow_cowork_file_delete`, per session. Use `~/mnt/<name>`; the Windows path fails in bash |

Per-project state belongs in a user-selected folder.

## Git

helios `CLAUDE.md` (2026-09-04): in a Cowork-mounted repo, git strands `.git/*.lock` unless `mcp__cowork__allow_cowork_file_delete` is granted first.

Smoke v3: `rev-parse`, `log`, `status` and `remote` in the selected folder left no `.git/*.lock`. Inference: git removes a lock file by deleting it, and deletes are blocked before the grant, which would explain stranded locks. Only read-only git was tested; commit and checkout are untested.

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

Run it in both harnesses. Smoke v2 (0.2.x) covered 1–5. Smoke v3 (PR #9) covers all six plus node, the Read tool, git and GitHub access. See [done status](done-plugin-status.md).

## GitHub access from Cowork

Evidence: one `starwards-what-now` run in Cowork (2026-09-19), as reported by that session:
- The sandbox had no network to GitHub, so `git pull` failed.
- The GitHub MCP connector (claude.ai GitHub app) worked: it listed PRs and issues, read issues and PRs, and wrote an issue.
- The connector reads are live API calls.

Consequence for `done` sync: local git in the folder, plus the connector when present. `gh` is absent in Cowork.

Smoke v3: `curl api.github.com` got a 403 from the proxy, and `git fetch` over SSH failed. The connector tools are named `mcp__<uuid>__*`, with no `github` in the name. `list_pull_requests` worked.
