# Glossary: terms used across this marketplace

**Marketplace** — a git repo with `.claude-plugin/marketplace.json` listing plugins. Installed in Claude Code with `/plugin marketplace add <owner>/<repo>`; this one is named `claude-arad`.

**Plugin** — `plugins/<name>/` with `.claude-plugin/plugin.json` (required) and optionally `skills/`, `hooks/`, `lib/`, `.mcp.json`, `CHANGELOG.md`. Installed as `<plugin>@<marketplace>`.

**plugin.json** — per-plugin metadata: `name`, `version`, `description`, `author`, `keywords`, optional `dependencies` (e.g. `likec4` → `likec4-dsl`). Source of truth for the sync script.

**marketplace.json** — root manifest. Its `plugins[]` entries are synced from each `plugin.json` by CI; the `likec4-dsl` entry is hand-written (`git-subdir` source, `strict: false`).

**Skill** — `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, optional `disable-model-invocation`) and instructions. Invoked as `/<plugin>:<skill>` or by the model when the description matches.

**`${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}`** — placeholders in SKILL.md that the Skill tool replaces with the plugin's / skill's absolute path. They are not shell environment variables. See [runbooks](runbooks.md).

**Hook** — `hooks/hooks.json` wiring a command to a Claude Code event (`PreToolUse` with `matcher: Bash` in `base-plugin`). Exit 0 allows, exit 2 blocks.

**MCP server (`.mcp.json`)** — a plugin-bundled Model Context Protocol server; `likec4` runs `npx -y @likec4/mcp`.

**Release Please** — `googleapis/release-please-action@v4`; opens one Release PR per plugin from conventional commits, tags `<component>-v<version>` on merge. See [deployment](deployment.md).

**Conventional commit** — `feat:` minor, `fix:` patch, `feat!:`/`BREAKING CHANGE:` major.

**Release PR** — the bot's PR titled `chore(release): <component> <version>`, tracked by the `autorelease: pending` label.

**Sync commit** — `chore: sync marketplace and release config`, pushed by `github-actions[bot]` when `scripts/generate-release-config.js` changes any generated file.

**Knowledge base (KB)** — `kb/` in this repo, managed by the `garden` plugin; `.garden/backlog.md` and `.garden/synonyms.md` are its working files.

**Cowork** — the Claude desktop app mode this repo's plugins are also run in; it has a Linux bash sandbox distinct from the Windows host. Facts in [runbooks](runbooks.md).

**skill-creator** — Anthropic's skill, Apache-2.0, shipped in `base-plugin`; the only non-Unlicense code here.

Related: [architecture](architecture.md).
