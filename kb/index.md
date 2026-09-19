# Knowledge base index

Hub for `claude-arad`. One entry per doc; link text carries a word from the doc's own title.

## Structure

- [Architecture: marketplace layout and release flow](architecture.md) — what the repo contains, the `plugin.json` → `marketplace.json` → Release Please data flow, plugin inventory, layout constraints.

## Working on it

- [Setup: working on the marketplace locally](setup.md) — prerequisites (Node 22), the one repo-level command, installing plugins into Claude Code, adding a plugin.
- [Deployment: the release pipeline](deployment.md) — `release.yml` step by step, Release Please config, version bumps, required GitHub settings.

## When something breaks

- [Runbooks: known failures and how plugins find their own files](runbooks.md) — Release PR not opening, silent skip on name mismatch, 403, squash-merge, and the Cowork sandbox findings (`${CLAUDE_SKILL_DIR}` empty, plugin mount path, outputs delete restriction).

## Work in progress

- [Done plugin: Cowork end-to-end protocol](done-cowork-e2e.md) — plan Task 13: one Cowork session that runs init, what-now, goals and probes the connector output shape, several selected folders and non-slash invocation.
- [Done plugin: Cowork e2e results](done-cowork-e2e-results.md) — Task 13 run on 0.4.0: connector output shape (REST, string labels, no approval prompt), several folders, invocation without the slash command, picker name collision, sync bugs fixed.
- [Done plugin: second Cowork run](done-cowork-e2e-2.md) — protocol for 0.5.0: renamed commands, same-day what-now, stale raw files, card id check on an invalid plan, two `.done/` folders, self-report, value-ladder and the agent-fleet fallback, `\|` in a cell, template card deletion.
- [Done plugin: where the work stands](done-plugin-status.md) — the `done` solo-project plugin: spec and plan paths, user decisions, PRs and releases so far, Cowork smoke results, proposed changes and open questions; 0.5 scope cut to one person (value-ladder).

## Observed environments

- [Cross-harness plugins: writing skills that work in both Claude Code and Cowork](cross-harness-plugins.md) — distribution, where plugin files live, placeholder substitution, scripts, writable locations, smoke-test recipe.
- [Cowork sandbox environment facts](cowork-sandbox-environment.md) — probe of the Cowork Linux sandbox: shell, tools, proxy, `~/mnt` folders and their write permissions, plugin location on disk, cowork tools.
- [Skill placeholders `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` in Cowork](skill-placeholders-unset-in-cowork.md) — smoke v1 (shell variable, empty) vs v2 (substituted to the Windows host path), the system-prompt wording, where the plugin actually was.
- [Cowork smoke v3 results](cowork-smoke-v3-results.md) — done 0.2.2 in Cowork: placeholder paths for the shell, node and the Read tool, the selected-folder mount, writes versus deletes, git, GitHub proxy block, connector tool naming.
- [Cowork raw run outputs, 2026-09-19](cowork-raw-runs-2026-09-19.md) — verbatim pastes: smoke v2 rerun, GitHub connector report, smoke v3, post-grant follow-up, fresh-session script and output.

## Reference

- [Glossary: terms used across this marketplace](glossary.md) — marketplace, plugin, skill, hook, placeholders, Release Please, sync commit, Cowork.
