# Runbooks: known failures and how plugins find their own files

Each entry names its source. Entries marked "observed" were seen in a real run; entries marked "documented" come from README/CLAUDE.md and have not been reproduced here.

## Release PR never opens

Cause: a stale `autorelease: pending` label on an old PR. Release Please tracks its PR by that label, not the title.
Fix: remove the label from the old PR, re-run the workflow.
Source: documented — `README.md` §4, `CLAUDE.md` Commit Convention.

## Plugin never gets a version bump

Cause: directory name ≠ `plugin.json` `name`. `generateReleaseConfig()` looks for `plugins/<marketplace name>/.claude-plugin/plugin.json`, warns `Plugin <name> directory not found, skipping`, and emits no package.
Fix: rename the directory to match `name`. Also fix the entry in `marketplace.json` and `.release-please-manifest.json` (sync only adds/updates, never removes).
Verify: `node scripts/generate-release-config.js` prints `Generated release-please-config.json with N package(s)` with the expected N.
Source: documented — `CLAUDE.md`, `scripts/generate-release-config.js`.

## Workflow run fails with 403

Cause: repository Actions settings do not allow the workflow to write or to create PRs.
Fix: README §3 settings; keep `main` free of PR-required / signed-commit / linear-history rules.
Source: documented — `README.md` §3.

## Squash-merged PR produced no bump

Cause: with squash-merge, the PR title is the commit message Release Please parses; a title without `feat:`/`fix:` is ignored.
Fix: retitle before merging, or push a follow-up conventional commit.
Source: documented — `README.md` §4.

## Stale marketplace entry after deleting a plugin

Cause: `syncMarketplace()` only adds and updates.
Fix: delete the entry from `.claude-plugin/marketplace.json` by hand; the next CI run regenerates the release config without it.
Source: documented — `CLAUDE.md`.

## `${CLAUDE_SKILL_DIR}` / `${CLAUDE_PLUGIN_ROOT}` are empty in a skill's shell command

Cause: the placeholders are text substitutions in the SKILL.md body, never environment variables. `$CLAUDE_SKILL_DIR` in a shell command is always empty; write `${CLAUDE_SKILL_DIR}` so it is substituted before the command runs. In Cowork it is substituted to the Windows host path.
Fallback: the plugin tree is at `~/mnt/.remote-plugins/plugin_<id>/`, read-only; the id matches the Windows base-directory path in the skill header.
Full record: [skill placeholders in Cowork](skill-placeholders-unset-in-cowork.md). Practice for both harnesses: [cross-harness plugins](cross-harness-plugins.md).
Source: observed 2026-09-19 — `done:init` smoke.

## Cowork sandbox facts a plugin script may depend on

Node 22 / npm 10 / Python 3.10 / git 2.34 present, `gh` absent; `~/mnt/outputs` allows create but not delete; `~/mnt/uploads` read-only; all egress via authenticated localhost proxy; no repo reachable until a folder is selected.
Full record: [Cowork sandbox environment](cowork-sandbox-environment.md).
Source: observed 2026-09-19 — environment probe.

Related: [setup](setup.md), [deployment](deployment.md), [architecture](architecture.md).
