---
date: 2026-09-19
related: [done-cowork-e2e.md, done-plugin-status.md, cowork-smoke-v3-results.md]
---

# Done plugin: Cowork e2e results (2026-09-19, done 0.4.0)

This was one Cowork session (model Fable 5.1, Low) running the [e2e protocol](done-cowork-e2e.md). Two folders were selected: `C:\scratch\done-e2e` (git, one commit `chore: seed (#1)`) and `C:\scratch\done-other` (empty). The GitHub connector was enabled. Claude Code then read the output files on the host.

## Results per step

| # | Result | Evidence |
|---|---|---|
| 1 | A request in plain words cannot reach the skill. The model said "No done plugin is installed in this session" and offered `starwards-what-now` instead. So `disable-model-invocation` skills are invisible to the model, not merely blocked. | transcript |
| 2 | `/done:init` worked. Cowork shows the typed command as `/init`, without the namespace. It asked which folder in a form (done-e2e / done-other), with the interview questions in the same form. | screenshot |
| 3 | project.md matched the answers: `sync: github`, labels, `capacity: agents`, `max_in_flight: 2`. log.md has `init v1`; plan.md and state.md have `version: 1`. ROOT = `~/mnt/done-e2e`. | host files |
| 4 | what-now: `gh` was absent, so it used the connector. The model named the tools `list_pull_requests` and `list_issues`, and **Cowork asked for no approval**. It saved `merged.json` (15 PRs), `open.json` `[]` and `issues.json` `[]`; `github.json` was correct. It routed M1.1 under rule 3, wrote state.md v2 and the log line `what-now v2 rule:3 card:M1.1`. The second folder caused no question. | host files |
| 5 | goals: showed the confirmation gate, then wrote plan.md v2 (M1.1 DECIDE pick license → M1.2 DO write README), cut the placeholder, and logged `goals v2`. project.md and decisions.md were untouched. | host files |
| 6 | what-now: routed M1.1 under rule 3 and wrote state.md v3. **Two sync bugs showed up** (see below). | host files, mtimes |
| 7 | Bare `/init`: the picker lists two identical `init` entries, from done and garden. Only the hover tooltip ("Done plugin" / "Garden plugin") tells them apart. | screenshots |

## Connector output shape (open question 1, answered)

The saved `merged.json` holds REST-shaped items: `number, title, state, merged_at, closed_at, updated_at, user.login, labels, head.ref, base.ref, html_url, draft`. **Labels are plain strings** (`"autorelease: tagged"`), not `{name}` objects. `sync-github.mjs` already accepted strings.

Unknown: whether the connector itself returns this trimmed field set, or the model trimmed it before saving. The SKILL says "as returned, do not rename fields", and the names are REST names.

## Bugs found and fixed in the same PR

- **Stale connector files were reused.** In step 6 the model said "merged.json from the previous run is still current" and did not save the connector output again. The mtimes of `merged/open/issues.json` stayed at 17:09 from step 4. `github.json` was rebuilt from that old data; the result was right only because nothing had changed on GitHub.
  - Fix: `sync-github --from-dir` exits 3 if any raw file is more than 15 minutes old. The what-now skill now says to save all three files on every run.
  - This also covers most of the earlier "stale github.json passed to counts" risk, because counts only uses facts after a sync that exited 0.
- **`git log --since=<date>` drops commits made earlier the same day.** git reads a bare date as that date at the current time of day. With SINCE = 2026-09-19 at 17:15, the seed commit from 17:0x was left out (`git.json` had `commits: []`). Any repeat run on the same day hits this.
  - Fix: `--since="<date> 00:00"`.
- **Merged PRs from the connector are not filtered by date.** The `gh` path uses `merged:>=since`; the connector returns closed PRs regardless of date.
  - Fix: `buildFacts` drops merged PRs whose `merged_at` date is before `since`.
- **Skill names collide in the Cowork picker** (step 7). All three skills were renamed with a plugin suffix, a user decision: `init-done`, `what-now-done`, `goals-done`. Claude Code now shows `/done:init-done`.
  - The `log.md` run tokens (`init`, `what-now`, `goals`) are unchanged.

## Still open

- **Card id reuse** — fixed in the follow-up PR (fix/done-card-id-reuse): `cards.mjs validate` rejects a card id that starts a cut-list line, and with `--log` one archived in log.md; goals and what-now pass `--log`; the plan grammar says ids are never reused and cut card lines start with their id. Checked on the real e2e plan: `line 23: M1.1 reuses a cut card id`, exit 2. Side effect: a plan that already reuses an id fails validation until renumbered.
- **The fixes have not run in Cowork.** They are covered by tests only (27 pass).
- Planned but still unobserved:
  - the `gh` exit-2 fallback
  - a connector result wrapped in an outer object
  - a `|` inside a cell
