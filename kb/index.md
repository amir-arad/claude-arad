# Knowledge base index

Hub for `claude-arad`. One entry per doc; link text carries a word from the doc's own title.

## Structure

- [Architecture: marketplace layout and release flow](architecture.md) — what the repo contains, the `plugin.json` → `marketplace.json` → Release Please data flow, plugin inventory, layout constraints.

## Working on it

- [Setup: working on the marketplace locally](setup.md) — prerequisites (Node 22), the one repo-level command, installing plugins into Claude Code, adding a plugin.
- [Deployment: the release pipeline](deployment.md) — `release.yml` step by step, Release Please config, version bumps, required GitHub settings.

## When something breaks

- [Runbooks: known failures and how plugins find their own files](runbooks.md) — Release PR not opening, silent skip on name mismatch, 403, squash-merge, and the Cowork sandbox findings (`${CLAUDE_SKILL_DIR}` empty, plugin mount path, outputs delete restriction).

## Observed environments

- [Cowork sandbox environment facts](cowork-sandbox-environment.md) — probe of the Cowork Linux sandbox: shell, tools, proxy, `~/mnt` folders and their write permissions, plugin location on disk, cowork tools.
- [Skill placeholders `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` unset in Cowork](skill-placeholders-unset-in-cowork.md) — what `done:init` saw, the system-prompt wording on substitution, where the plugin actually was.

## Reference

- [Glossary: terms used across this marketplace](glossary.md) — marketplace, plugin, skill, hook, placeholders, Release Please, sync commit, Cowork.
