# Architecture: marketplace layout and release flow

Audience: an engineer new to this repo. Everything here was read from the files named; nothing is inferred from directory names alone.

## What the repository is

A Claude Code plugin marketplace. The marketplace manifest is `.claude-plugin/marketplace.json`; each plugin is a directory under `plugins/<name>/` whose only required file is `.claude-plugin/plugin.json`. There is no application runtime, no `package.json`, and no dependency manifest (`scan` reports `tech_stack: []`, `dependencies: 0`). The "code" is:

| Kind | Where | Runtime |
|---|---|---|
| CI sync script | `scripts/generate-release-config.js` (CommonJS) | Node 22 in GitHub Actions |
| Plugin libraries | `plugins/garden/lib/*.mjs`, `plugins/other-models/lib/ask.mjs`, `plugins/done/lib/*.mjs` | Node, invoked by skills via `${CLAUDE_PLUGIN_ROOT}` (garden) or `${CLAUDE_SKILL_DIR}/../../lib` (done) |
| Skill scripts | `plugins/base-plugin/skills/skill-creator/scripts/*.py` | Python (Anthropic's skill-creator, Apache-2.0) |
| Hook | `plugins/base-plugin/hooks/example-guard.sh` | Bash, PreToolUse on `Bash`; no-op (`exit 0`) |
| Skills | `plugins/*/skills/<skill>/SKILL.md` | Markdown instructions read by Claude |

## Source of truth and data flow

```
plugins/<name>/.claude-plugin/plugin.json      (source of truth: name, version, description, keywords)
        │
        │  scripts/generate-release-config.js  (runs in CI on every non-bot push to main)
        ▼
.claude-plugin/marketplace.json                (plugins[] entries synced: source, description, version, keywords)
release-please-config.json                     (one package per marketplace entry; extra-files → plugin.json $.version)
.release-please-manifest.json                  (plugins/<name> → version; existing manifest values win over plugin.json)
        │
        ▼
googleapis/release-please-action@v4            (Release PR per plugin; on merge: tag `<component>-v<version>`, CHANGELOG.md)
```

Edges above come from `discoverPlugins()`, `syncMarketplace()`, and `generateReleaseConfig()` in `scripts/generate-release-config.js` and from `.github/workflows/release.yml`.

Two things the script does **not** do, per its own comments: remove marketplace entries (sync only adds/updates — see `CLAUDE.md`), and reach entries whose `source` is not a local directory. The `likec4-dsl` entry in `marketplace.json` has a `git-subdir` source pointing at `likec4/likec4` and no `plugins/likec4-dsl/` directory; `generateReleaseConfig()` logs a warning and skips it, so it has no release-please package.

## Plugins present

From `marketplace.json` and `plugins/`:

| Plugin | Version | Contents |
|---|---|---|
| `base-plugin` | 0.1.0 | `skill-creator` skill (Anthropic, Apache-2.0), sample no-op hook |
| `garden` | 3.0.0 | KB skills (init, survey, tend, maintain, review, capture, restructure, dream), `lib/*.mjs` fact scripts, `references/`, `assets/` |
| `likec4` | 0.2.0 | `architecture-model` skill; `.mcp.json` runs `npx -y @likec4/mcp`; declares dependency on `likec4-dsl` |
| `context` | 0.1.0 | `carryout` skill |
| `other-models` | 0.2.0 | `ask-model` skill, `lib/ask.mjs` (drives `agy` / `codex` CLIs headlessly) |
| `done` | 0.2.2 (0.3.0 after PR #12) | `init` skill (smoke v3 until Task 10), `lib/*.mjs` fact and write scripts, `assets/` templates, `test/` (node:test) |
| `likec4-dsl` | — (external) | tracked from `likec4/likec4` `main`, path `skills`, `strict: false` |

## Constraints that shape the layout

- Directory name must equal `plugin.json` `name` — otherwise `generateReleaseConfig()` builds `pluginPath = plugins/${plugin.name}`, finds no `plugin.json` there, warns, and skips (`CLAUDE.md` calls this "silently skips"). Note the asymmetry: `syncMarketplace()` uses the directory name for `source`, `generateReleaseConfig()` uses the marketplace `name`.
- Release Please's `extra-files` paths are relative to the plugin folder, so it cannot bump the root `marketplace.json`; the sync script's re-run after a Release PR merge propagates the version (comment in `release.yml`).
- Skills reference their plugin's files through `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}`, which the Skill tool fills in. See [runbooks](runbooks.md) for what happens when they are empty.

## Not covered

No linter, lockfile or task runner exists; the only tests are `done`'s (`node --test plugins/done/test/*.test.mjs`) (`setup-check`), so there is no build graph to describe. The `docs/superpowers/` folder holds a design spec and plan for the `done` plugin dated 2026-09-15; it is not part of the marketplace and is not summarised here.

Related: [setup](setup.md), [deployment](deployment.md), [glossary](glossary.md).
