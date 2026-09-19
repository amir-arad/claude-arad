# `done` plugin — design

Date: 2026-09-15. Status: draft for user review.

Extracts `starwards-what-now` (helios/starwards-design, one commit 2026-08-02, then frozen while its
playbook went v1→v118 over 96 commits) into a generic plugin for solo projects: one decision-maker,
any complex backlog or goal, optional delegates (agents or people).

## 1. Goals and non-goals

Goals:
- `/done:what-now` — sync facts, update state, route one next card, prepare it.
- `/done:goals` — replan: evidence sweep → gap analysis → milestones → cards.
- `/done:init` — scaffold + interview → per-project config.
- Strategies are pluggable folders (ladder + modes + failure checks). v1 ships one: `agent-fleet`.
- Facts by script, judgment by model. Everything the playbook drifted on is derived, not hand-kept.
- Works in Claude Code and Cowork.

Non-goals (v1):
- Persistence switch (git vs not). Files are the store; git is optional recovery.
- Capacity switch. "No delegates" is the degenerate case: dispatch rules idle.
- A second strategy. Folder layout allows it; nothing is built for it.
- Writing code, editing the tracker's scope surface, touching parked items. Same as the source skill.

## 2. Evidence behind each decision

| Decision | Evidence (playbook unless noted) |
|---|---|
| Write guard on by default | Clobbers happened with git: v21–23 lost (recovered v24), v46 mid-edit change, orphan `hour-playbook-PENDING-v90.md` |
| Log appended by script, one line, never model-written | Changelog: paragraphs, out of order (v65–68 after v75), duplicates v46 & v113 |
| READY NOW / IN FLIGHT / DECIDE order derived from cards | Workstream tables 1–10 stale; skill's hardcoded DECIDE order superseded (line 435); label rule changed 08-07 |
| Open cards only in plan.md | Dependency spine became a ~140-line append-only log; 600 lines, unreadable in one pass |
| Ladder keeps precedence; counts inform | "rule N" cited 71× in 37 STATE lines; reviews-first justified by PR rot (v94: 8 PRs 5+ merges behind) |
| Environmental blocker check before the ladder | master red → dispatch freeze (v26), token 403 (v54), sandbox down (v116) |
| Thresholds are config, not invariants | "≥2 in flight" never bound; 4–7 agents ran (v70); bottleneck moved: issues (v42) → review (v89) → write access (v54) |
| Goals = sweep → gaps → milestones | Goals mode never ran (0/96 commit subjects; flagged v27, v45, v66). Replan happened by hand: gap-analysis (08-30) → gap-closing-plan (v95) |
| Scope moves allowed in what-now, tagged | WS10, #2095, #2130–33, #2123, reviewer track all entered as "owner's call" mid-session |
| Persistent watch/debt list in state | "carry as a check" #2158 (v91), #2070 debts (v49), "verify in 2.4 QA hour" |
| Mode split agent-prepares / human-gates in modes.md, per-card override | DISPATCH = file (agent) + label (human); REVIEW = pre-read + ruling; exceptions: 5.1 (Daniel), #2091/#2240 auto-merged, M2.9 human-only |
| Card owner field | Daniel owned 5.1 (line 89) |
| Self-report sync | User asked for use without an issue tracker |

## 3. Plugin layout

```
plugins/done/
  .claude-plugin/plugin.json
  skills/init/SKILL.md
  skills/what-now/SKILL.md
  skills/goals/SKILL.md
  strategies/agent-fleet/ladder.md          precedence rules, thresholds referenced by name
  strategies/agent-fleet/modes.md           mode defaults: who prepares, who gates, done-when
  strategies/agent-fleet/failure-checks.md  checklist run before dispatch / after sync
  assets/project-template.md                FORMAT CONTRACT in HTML comments
  assets/plan-template.md
  assets/state-template.md
  assets/decisions-template.md
  lib/lib.mjs            shared: paths, contract parsing, version stamp
  lib/init-scaffold.mjs  idempotent scaffold, --json
  lib/cards.mjs          parse plan.md → JSON; derive ready/in-flight/blocked/decide-order; validate
  lib/sync-git.mjs       local git → JSON facts (commits since, issue refs in subjects), --json
  lib/sync-github.mjs    GitHub raw JSON (gh CLI, or connector output saved to files) → JSON facts, --json
  lib/state-write.mjs    guarded write of state.md / plan.md (version stamp), --json
  lib/log-append.mjs     append one line to log.md
  lib/counts.mjs         constraint counts from cards + facts → JSON
  CHANGELOG.md           managed by Release Please
```

All skills: `disable-model-invocation: true`. All paths via `${CLAUDE_SKILL_DIR}` (shared files as
`${CLAUDE_SKILL_DIR}/../../<dir>/...`); see §8. Composition by path, as in garden.

## 4. Per-project files: `.done/`

| File | Lifetime | Writer | Reader |
|---|---|---|---|
| `project.md` | config, edited by init/user | init, user | all |
| `plan.md` | open cards only; done cards move to log | goals (structure), what-now (status cells) | cards.mjs |
| `state.md` | one snapshot + persistent watch list | what-now via state-write | what-now |
| `decisions.md` | append-only dated rulings | what-now, goals | goals |
| `log.md` | append-only, one line per run | log-append only | what-now reads last N (default 10) |

### project.md
```
name, root, strategy: agent-fleet
sync: git | github {repo, labels: {ready, in-progress}} | self-report
capacity: agents | people | none
thresholds: {max_in_flight, rebase_after, ...}      # overrides strategy defaults
gates: {dispatch: human, review-ruling: human, ...} # overrides modes.md
never: [paths/surfaces the model may not edit]
```

### plan.md card grammar (strict; validated by cards.mjs)
```
## <Milestone id> — <title>            (milestones ordered; rows parallel unless blocked)
| Card | Action | Mode | Owner | Blocked on | Status |
```
- `Card`: `M2.3` style id, unique.
- `Mode`: one of the strategy's modes (agent-fleet: DECIDE, DISPATCH, REVIEW, QA, DO).
  Per-card gate override: `(gate: <who>)` suffix.
- `Owner`: empty = the user; else a name.
- `Blocked on`: comma list of card ids, `ext:<text>`, or `owner:<name>`. Nothing else. Validator rejects
  free text (the playbook had "playtest evidence", "merges", "needs an issue" there).
- `Status`: `open | filed #N | dispatched #N | pr #N | ruled <date> | done <date>`. Struck rows are not used;
  done rows are moved to log.md by state-write on the next run.
- Derived, never written by hand: READY NOW (open, unblocked), IN FLIGHT (dispatched/pr), DECIDE order
  (DECIDE cards by count of transitive dependents, desc).

### state.md
```
<!-- version: N -->        # stamp; state-write refuses if file changed since read
## Snapshot <date>          # facts: counts table, blockers, deltas since last run
## Watch list               # persistent; each item has an added date and a close condition
## Next                     # the one routed card + first action
```

### decisions.md
`- <date> — <card|scope> — <ruling> — by <owner> [owner-call]`. `[owner-call]` tags scope moves made
in what-now; goals reconciles them.

### log.md
`- <date> <run:what-now|goals> v<N> rule:<k|deviation:reason> card:<id> <one line>` — written by
log-append.mjs from JSON the skill hands it. Never a paragraph.

## 5. Skills

### init
1. `node lib/init-scaffold.mjs <root> --json` — creates `.done/` from templates if absent, never
   overwrites, reports what exists.
2. Interview (dream-style, one question at a time): project name, goal in one sentence, strategy
   (only agent-fleet), sync (git | github repo + labels | self-report), capacity, never-touch surfaces,
   thresholds to override. Write project.md.
3. If a legacy playbook/plan path is given: offer to convert cards; run cards.mjs validate; list
   rejected rows for the user to fix. No silent rewrite.

### what-now
1. **Read** project.md, state.md (note version), plan.md, last N log lines.
2. **Sync**: always `node lib/sync-git.mjs <root> --json` when `<root>` is a git repo. `sync: github` adds
   GitHub facts: `gh` present → `node lib/sync-github.mjs --repo X --json`; else a GitHub MCP connector
   (found by tool function, e.g. `list_pull_requests`) → model saves raw results to files →
   `node lib/sync-github.mjs --from-dir <dir> --json`; neither → git facts only, say so. `self-report` → ask the user for
   deltas in one prompt ("what changed since <last run>?") and treat the answer as facts.
3. **Reconcile** facts → card status cells (merged → done, PR opened → pr #N, label → dispatched).
   Run `failure-checks.md` "after sync" list (stale labels, duplicate claims, PR behind base,
   junk drafts, label without worker, untracked dispatch). Each hit → watch-list item or delta line.
4. **Derive**: `node lib/cards.mjs derive --json` (ready/in-flight/decide-order) and
   `node lib/counts.mjs --json` (constraint counts).
5. **Blocker check** (ladder rule 0): any environmental blocker in facts, watch list, or user
   input → the routed card is "clear the blocker"; skip the ladder.
6. **Ladder** (strategy ladder.md, precedence order; counts and thresholds feed conditions).
   Deviation allowed with a reason, which goes in the log line.
7. **Prepare** the card per modes.md: DECIDE → options packet (2–3 options, numbers, one-line
   recommendation, sourced from files read); DISPATCH → self-contained ticket body ready to file
   (no placeholders) + the label flip listed for the human; REVIEW → pre-read notes; QA → checklist;
   DO → the concrete first step.
8. **Scope move requested mid-run** → record in decisions.md with `[owner-call]`, add/cut the card,
   continue. Do not refuse and do not run goals.
9. **Write**: state-write (guarded), log-append. Refused write → report, do not retry blindly.
10. **Output**: deltas (one line each), `Next: <card> — <what>`, why (one sentence), first action.
    Nothing else.

### goals
Confirmation gate: state the intended change in one sentence and the principles it touches; wait
for yes. No model gating.
1. **Sweep**: read project.md, plan.md, decisions.md, log.md in full, plus the evidence sources the
   user names (code, docs, notes). For a new goal: one sweep per area the goal touches.
2. **Gaps**: table of gap → evidence → severity → candidate card(s).
3. **Milestones**: strictly ordered; exit criteria stated; rows parallel unless blocked.
4. **Cards**: in the grammar; validate with cards.mjs; every DISPATCH names or will file an issue;
   every DECIDE names its consumer; cuts go to a cut list in plan.md with a reason.
5. **Reconcile** `[owner-call]` decisions since the last goals run into the plan or the cut list.
6. Contradicting a recorded decision → name it, ask once: new information or reversal. Reversals get
   a dated decisions.md line.
7. Write plan.md (guarded), decisions.md, log line. End with the one next action.

## 6. Strategy `agent-fleet`

ladder.md (precedence; thresholds by name, defaults in file, overridable in project.md):
0. Environmental blocker present → clear it.
1. Delegate output awaiting the user's gate (PR review, ruling) → that, oldest first; PRs behind
   base by ≥ `rebase_after` merges first.
2. In-flight below `max_in_flight` and a READY NOW DISPATCH card exists → prepare ticket(s) up to
   the gap; human flips labels.
3. Top DECIDE by derived order → options packet.
4. READY NOW QA / DO card → do it or prepare it.
5. Nothing → say so; suggest goals.

modes.md: per mode — who prepares, who gates, done-when, artifact shape. Defaults: DISPATCH prepares
agent / gates human (label); REVIEW prepares agent (pre-read) / gates human (ruling); DECIDE prepares
agent (packet) / gates human; QA prepares agent (checklist) / gates human (ran it); DO agent / none.

failure-checks.md: before dispatch — ticket self-contained, no placeholders, body write-once, sized for
one worker run, no duplicate claim. After sync — stale labels, branch behind base, green CI ≠ scenario
evidence, junk drafts, label without worker, untracked dispatch, single-writer conflict.

## 7. Scripts

Node ≥ 18, no dependencies, `--json` output, exit 0 facts / 1 usage / 2 refused (validation or stamp).
- `cards.mjs parse|validate|derive <plan.md>`
- `counts.mjs <root>` → `{awaiting_gate, in_flight, ready_dispatch, ready_decide, ready_qa, blockers}`
- `sync-git.mjs <root> [--since D]` → commits since D (sha, date, subject, `#N` refs). Reads `git log` only;
  `git status` is not used (Cowork git reports host CRLF files as modified).
- `sync-github.mjs --repo X --labels a,b | --from-dir <dir>` → PRs merged since last run, open PRs (author, behind-by),
  issues with labels. Accepts gh JSON and GitHub REST JSON (connector) shapes. `gh` absent without
  `--from-dir` → exit 2 with message.
- All writes: overwrite or temp file + rename. Never delete (Cowork blocks unlink before a per-session grant).
- `state-write.mjs <file> --expect-version N --from <json|stdin>` → writes, bumps stamp, moves done
  cards to log when file is plan.md.
- `log-append.mjs <root> --run what-now --rule 3 --card M4.1 --text "..."`
- `init-scaffold.mjs <root> --json`

Tests: node:test per script with fixture plans (valid, invalid blocked-on, stale stamp, done-row move).
The starwards gap-closing-plan.md converted to the grammar is a fixture.

## 8. Harness — Cowork install is a requirement, not a check

Evidence: Cowork runs 2026-09-19 (kb/cowork-smoke-v3-results.md, kb/cowork-raw-runs-2026-09-19.md).
- `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` are substituted to the Windows host path; the shell,
  `node` and the Read tool resolve it to `~/mnt/.remote-plugins/plugin_<id>/...`. node v22, git 2.34, no `gh`.
- The selected project folder is `~/mnt/<name>`; cwd is the session home. The folder's Windows path does
  not resolve in bash.
- In the folder: create, overwrite, rename work; unlink needs `mcp__cowork__allow_cowork_file_delete`, per session.
- GitHub: HTTPS blocked by the proxy, SSH fetch fails. The GitHub MCP connector works; its tools are
  `mcp__<uuid>__*` (no `github` in the name).
- Cowork git sees host CRLF working-tree files as modified.

Design rules:
- Paths: `${CLAUDE_SKILL_DIR}/../../<dir>/...`. No rebuild fallback.
- Project root: in Claude Code, the cwd repo root. In Cowork, the single entry under `~/mnt/` other than
  `outputs`, `uploads` and dot-dirs; several → ask; none → call `request_cowork_directory`. Never the
  session home, `outputs/` or the Windows path. `.done/` lives at the project root. Scripts take the
  root as an argument.
- Writes: overwrite or temp + rename; no script deletes. No delete grant needed.
- Sync: see §5 what-now step 2. Generic: no org or repo is built in; labels are project.md config.
- Every script step keeps a manual fallback, log line prefixed `manual:`.
- Skill frontmatter: only `name`, `description`, `disable-model-invocation`, `argument-hint`.

## 9. Open risks
- Strict grammar rejects the current playbook; conversion is manual. Cost unmeasured.
- Precedence rule 1 rests on one rot episode (v94).
- All evidence is one project with one fleet workflow; self-report and capacity=none are untested.
- Cowork: one machine, one folder. Multiple selected folders and model-invoked (non-slash) skills untested.
