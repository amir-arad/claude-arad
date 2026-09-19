# Setup: working on the marketplace locally

## Prerequisites

| Tool | Version | Evidence |
|---|---|---|
| Node.js | 22 | `.github/workflows/release.yml` (`setup-node` `node-version: '22'`); no `.nvmrc` or `engines` exists |
| git | any | repo is git; Release Please reads commit messages |
| Python 3 | unspecified | only for `plugins/base-plugin/skills/skill-creator/scripts/*.py`; no `pyproject.toml` or `requirements.txt` |
| Claude Code | current | to install and exercise plugins |

There is no `package.json`, lockfile, `Makefile`, `.env.example`, linter config, or test suite (`setup-check`: 4 pass / 6 warn / 1 fail, the fail being `missing-env-template`). The script and libs have zero npm dependencies (`scan`: `dependencies.runtime_count: 0`).

## Steps

**1. Clone**

```bash
git clone https://github.com/amir-arad/claude-arad
cd claude-arad
```

**2. Run the sync script locally (optional)**

This is the only repo-level command. It is idempotent and writes `marketplace.json`, `release-please-config.json`, `.release-please-manifest.json`.

```bash
node scripts/generate-release-config.js
```

Expected stdout (from the script's `console.log` calls): `Discovered N plugin(s) in plugins/`, optional `Updated <name>: <fields>` / `Added new plugin: <name>`, then `Generated release-please-config.json with N package(s)` and `Updated .release-please-manifest.json`.

**3. Install the marketplace into Claude Code**

From `README.md`:

```
/plugin marketplace add amir-arad/claude-arad
/plugin install <plugin-name>@claude-arad
```

`claude-arad` is the `name` field in `.claude-plugin/marketplace.json`.

**4. Add a plugin**

Create only `plugins/<name>/.claude-plugin/plugin.json` using the template in `CLAUDE.md`. Directory name must equal `name`. Commit with a conventional prefix (`feat:` / `fix:`). Everything else is generated in CI — see [deployment](deployment.md).

## Verify

- [ ] `node scripts/generate-release-config.js` exits 0 and `git status` shows no unexpected changes to the three generated files.
- [ ] After `/plugin install`, the plugin's skills appear in Claude Code's skill list (e.g. `garden:init`, `done:init`).

## Known gaps

- No documented command runs the Python skill-creator scripts or the `.mjs` libs outside a Claude session; each skill's `SKILL.md` gives the invocation via `${CLAUDE_PLUGIN_ROOT}`.
- `.gitignore` excludes `.claude/`, so a local `.claude/` settings directory is never committed.

Related: [architecture](architecture.md), [runbooks](runbooks.md).
