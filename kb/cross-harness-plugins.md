---
date: 2026-09-19
related: [skill-placeholders-unset-in-cowork.md, cowork-sandbox-environment.md, runbooks.md, done-plugin-status.md, architecture.md]
synthesized_from:
  date: 2026-09-19
  topic: "Building the done plugin for Claude Code and Claude Cowork: docs read, two Cowork smoke runs"
  tool: claude-code
---

# Writing plugins and skills that work in both Claude Code and Cowork

What is known about making one plugin from this marketplace run in both harnesses. Each point is marked as **evidence** (docs read or output observed) or **inference**. The evidence is thin: one run each of two smoke tests of one plugin (`done`) on one Windows machine, 2026-09-19.

## Distribution: the same marketplace serves both

- **Evidence (docs):** Cowork installs plugins from a GitHub repository used as a marketplace (Customize → Plugins → Add marketplace, `owner/repo` form). Plugins are "fully supported" in Cowork. [Install plugins](https://claude.com/docs/cowork/guide/plugins), [Plugins overview](https://claude.com/docs/plugins/overview).
- **Evidence (observed):** `amir-arad/claude-arad` installed in Cowork, and `done` 0.2.0 ran there. After a release, Cowork needs **Update** on the marketplace before it sees the new version.
- No change to `plugin.json` or `marketplace.json` was needed for Cowork.

## Where the plugin's own files are

- **Evidence (observed):** in Cowork the installed plugin is a read-only tree at `~/mnt/.remote-plugins/plugin_<id>/`. `<id>` is opaque (`plugin_01Rkn9mi36M72QHEcZWLSkZX`) and not the plugin name. So `find ... -path '*<plugin-name>*'` finds nothing.
- **Evidence (observed):** the host-side copy is `C:/Users/<user>/AppData/Roaming/Claude/local-agent-mode-sessions/<uuid>/<uuid>/rpm/plugin_<id>/`, and the id is the same on both sides.

## Path placeholders `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}`

- **Evidence (Cowork system prompt, quoted in [skill placeholders in Cowork](skill-placeholders-unset-in-cowork.md)):** they are text substitutions that "only the Skill tool fills in". They are not environment variables. Neither harness exports them to the shell, so `echo "$CLAUDE_SKILL_DIR"` is always empty. A smoke test must print the substituted text instead, e.g. `[${CLAUDE_SKILL_DIR}]`.
- **Evidence (observed, two different smoke tests, PR #7 is the change between them):**

| Smoke | What it tested | Result in Cowork |
|---|---|---|
| v1 | shell variable `$CLAUDE_SKILL_DIR` | empty. Says nothing about substitution |
| v2 | substituted text `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}` | both substituted, to the **Windows host path** |

- **Evidence (observed, v2):** the substituted text was the host path, yet the `ls` commands ran against the sandbox path `/sessions/<name>/mnt/.remote-plugins/plugin_<id>/...` and succeeded. **Unknown:** whether the Cowork shell tool translates host paths or the Cowork model rewrote the command.
- **Evidence (docs):** `${CLAUDE_SKILL_DIR}` is the documented cross-product variable ([Creating custom skills](https://claude.com/docs/skills/how-to)). `${CLAUDE_PLUGIN_ROOT}` is documented for Claude Code, and v2 showed Cowork substitutes it too.
- **Inference (from the system-prompt quote):** a SKILL.md read with a file tool, rather than received through the Skill tool, keeps its placeholders blank. That affects skills that compose other skills by path.

**Practice adopted for `done` (design, not yet verified in Cowork):**
1. Reference every file through `${CLAUDE_SKILL_DIR}`, reaching shared plugin files as `${CLAUDE_SKILL_DIR}/../../<dir>/...`.
2. Give each skill a fallback rule. If the path is empty, literal, or a drive-letter path that does not exist, take the `plugin_<id>/...` suffix and put `~/mnt/.remote-plugins/` in front of it. With no id, grep `~/mnt/.remote-plugins/*/.claude-plugin/plugin.json` for the plugin's `"name"`.
3. `garden` uses `${CLAUDE_PLUGIN_ROOT}` throughout. v2 shows Cowork substitutes it, but garden itself is untested in Cowork, including its path composition in `maintain`.

## Running scripts

- **Evidence (observed):** the Cowork sandbox has `node` v22.23.2, npm 10.9.8, python3 3.10.12 and git 2.34.1. `gh` is absent. The shell is `/bin/sh` on Ubuntu 22.04, and all egress goes through an authenticated localhost proxy. Details are in [Cowork sandbox environment](cowork-sandbox-environment.md).
- **Evidence (docs):** skills may ship Python, JavaScript/Node.js or Bash scripts.
- **Practice:** zero-dependency Node `.mjs` scripts run in both harnesses. Anything that needs `gh` must degrade, as `done` does by switching to self-report sync. Every script step in a SKILL.md gets a manual fallback the model can follow if `node` is missing, and the log marks those runs `manual:`.
- **Inference:** windows-only assumptions such as backslash paths, `cmd`, or PowerShell break in Cowork, which runs Linux. Scripts developed on Windows for Claude Code must use `path` APIs and forward slashes.

## Where a skill can write

- **Evidence (observed):**

| Location | Behaviour |
|---|---|
| Home `/sessions/<name>` | per-session temporary folder; its name changed between runs |
| `~/mnt/outputs/` | create works, `rm` is denied |
| `~/mnt/uploads/` | read-only |
| Plugin tree | read-only |
| User-selected folder (`mcp__cowork__request_cowork_directory`) | writable with Claude's Write/Edit tools; writing from the shell is untested |

- **Practice:** any per-project state (like `.done/`) must live in a folder the user selected. A skill should refuse to create it in the session home or `outputs/`, where it would not persist.
- **Inference:** a script that deletes or renames files, such as a temp-file-then-rename write, may fail in `outputs/` and possibly elsewhere. Prefer writing in place, and treat a failed write as a refusal.

## Git

- **Evidence (helios `CLAUDE.md`, 2026-09-04):** in a Cowork-mounted repo, git strands `.git/*.lock` files unless file-delete permission is granted first with `mcp__cowork__allow_cowork_file_delete`. A plugin that runs git in Cowork inherits this.

## Frontmatter

- `name`, `description`, `disable-model-invocation: true` and `argument-hint` loaded in both harnesses (`done:init` in Cowork, garden in Claude Code). Other fields are untested in Cowork.

## Smoke-test recipe for a new plugin

Ship a temporary skill that prints, one line each:
1. The substituted text of each placeholder, in brackets.
2. `ls` of `plugin.json` through each placeholder.
3. `env | grep -i -E 'claude|plugin|skill'`.
4. The versions of `node`, `gh`, `git`, `python3`.
5. `pwd`.
6. A write-then-delete probe in the folder where state will live.

Run it in both harnesses before writing real skills. `plugins/done/skills/init/SKILL.md` at `done` 0.2.x is a working example of items 1–5.
