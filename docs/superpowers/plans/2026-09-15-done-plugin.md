# `done` Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> On execution start, copy this file to `docs/superpowers/plans/2026-09-15-done-plugin.md` in the repo so the plan travels with the spec.

**Goal:** Ship `plugins/done/` — a generic solo-project management plugin with `init`, `what-now`, `goals` skills, one `agent-fleet` strategy, and script-derived state — installable in Claude Code and Cowork.

**Architecture:** Skills are prose procedures (SKILL.md) that call zero-dependency Node scripts in `lib/` for facts (parse cards, derive readiness, sync GitHub, guarded writes, log append) and make judgments themselves. Per-project state lives in `.done/` (project.md, plan.md, state.md, decisions.md, log.md). Strategy files (`strategies/agent-fleet/`) hold the routing ladder, mode defaults, and failure checklists; skills read them by path.

**Tech Stack:** Node ≥ 18 ESM (`.mjs`), `node:test` + `node:assert`, `gh` CLI (optional), markdown with HTML-comment FORMAT CONTRACTs. No package.json, no dependencies (matches `plugins/garden/`).

**Spec:** `docs/superpowers/specs/2026-09-15-done-plugin-design.md`

## Context

`starwards-what-now` (helios/starwards-design) routed the user's free hours for 6 weeks; its playbook went v1→v118 while the skill stayed frozen. Evidence in the spec §2 shows what drifted when the model hand-maintained derived data (READY NOW lists, DECIDE order, changelog), what clobbered (concurrent writes, with git), and what never ran (goals mode). This plugin makes facts script-derived, writes guarded, logs script-appended, and replanning procedure-shaped. Design was reviewed by a second session; all decisions are in the spec.

## Revisions after Gate 0 (2026-09-19)

Gate 0 ran (smoke v2, v3, fresh session; kb/cowork-smoke-v3-results.md). Spec §5, §7, §8 updated. Deltas that override the task text below:
- Task 1: done (PRs #5, #7, #9; `done` 0.2.2). The init stub is smoke v3 plus `lib/smoke.mjs`; Task 10 replaces the stub and removes `smoke.mjs`.
- Tests run as `node --test plugins/done/test/*.test.mjs` (node 22 on Windows rejects a directory argument).
- Task 4: `derive().done` includes `ruled` cards (settled, archived like done). Parsers split on `?
`.
- Task 7: the log is appended after the write succeeds. `state.md`: drop only watch items already ticked in the file on disk.
- Task 8: also refuses the home directory and `~/mnt/outputs`.
- Decision table result: placeholders substituted, node present, `gh` absent → script steps primary.
- Task 2: `parseProject` accepts `sync: git | github | self-report`; default `git`. Add `writeAtomic(file, text)` (temp file in the same dir + `renameSync`); every script write uses it or `appendFileSync`. No script calls `unlink`/`rm`.
- Task 3: project template `sync: git`.
- Task 5: `sync-github.mjs` gains `--from-dir <dir>` reading `merged.json`, `open.json`, `issues.json` saved by the model from a GitHub MCP connector. `buildFacts` normalises gh and REST shapes (`author.login|user.login`, `mergedAt|merged_at`, `updatedAt|updated_at`, `headRefName|head.ref`, `isDraft|draft`). Manual check uses `amir-arad/claude-arad`.
- Task 5b (new): `lib/sync-git.mjs <root> [--since D] [--json]` → `{source: "git", root, since, commits: [{sha, date, subject, refs}], errors}` from `git log` only. `buildGitFacts(logText)` is pure and tested. Not a repo → exit 2.
- Task 6: `counts` also accepts git facts (no blockers from them).
- Task 7: `guardedWrite` writes via `writeAtomic`.
- Task 10: init resolves the project root per spec §8 before scaffolding.
- Task 11: sync step per spec §5 step 2.
- Tasks 10–12 (as built): skills write scratch files to `ROOT/.done/work/`, not `/tmp`. `state-write` also strips archived card ids from other rows' Blocked on. Task 13 protocol: kb/done-cowork-e2e.md.

## Global Constraints

- Plugin dir `plugins/done/` and `plugin.json` `name` must both be `done` (repo CLAUDE.md).
- Only `plugins/done/.claude-plugin/plugin.json` is hand-created for release plumbing; marketplace.json and release-please config are CI-synced. Do not edit them.
- Conventional commits; each PR title carries `feat(done):` / `fix(done):` / `chore(done):`. Squash-merge.
- Branch before committing (on `main` now).
- All SKILL.md frontmatter: `name`, `description`, `disable-model-invocation: true`, optional `argument-hint`. Nothing else.
- Every path in SKILL.md uses `${CLAUDE_SKILL_DIR}`; shared files as `${CLAUDE_SKILL_DIR}/../../lib/...`, `.../strategies/...`, `.../assets/...`. **Never** `${CLAUDE_PLUGIN_ROOT}`.
- Every script step in a SKILL.md has a "no node" manual fallback whose log line is prefixed `manual:`.
- Scripts: `#!/usr/bin/env node`, ESM, `--json` flag, `--help`, exit 0 ok / 1 usage / 2 refused (validation failure or stale version stamp). Bare invocation prints help, exit 0.
- Tests: `node --test plugins/done/test/` from repo root. No package.json.
- Commit attribution lines from the session's system reminder go at the end of every commit message.
- Gate 0 (Task 1) blocks all later tasks: the user must run the stub in Cowork and report output.

## File Structure

```
plugins/done/
  .claude-plugin/plugin.json
  CHANGELOG.md                       (not created; Release Please owns it)
  skills/init/SKILL.md               scaffold + interview + optional legacy conversion
  skills/what-now/SKILL.md           sync → reconcile → derive → route → prepare → write
  skills/goals/SKILL.md              confirm → sweep → gaps → milestones → cards → write
  strategies/agent-fleet/ladder.md
  strategies/agent-fleet/modes.md
  strategies/agent-fleet/failure-checks.md
  assets/project-template.md         FORMAT CONTRACT + YAML-ish key: value block
  assets/plan-template.md            FORMAT CONTRACT + one example milestone + Cut list section
  assets/state-template.md           version stamp + Snapshot/Watch list/Next
  assets/decisions-template.md       FORMAT CONTRACT + example line
  lib/lib.mjs                        parseArgs, fail, emit, readText, exists, parseProject, VERSION_RE, readVersion
  lib/cards.mjs                      parse | validate | derive
  lib/counts.mjs                     constraint counts from derive output + facts JSON
  lib/sync-github.mjs                gh → facts JSON
  lib/state-write.mjs                guarded write; plan.md done-row migration to log
  lib/log-append.mjs                 one-line append
  lib/init-scaffold.mjs              idempotent .done/ scaffold
  test/fixtures/plan-valid.md
  test/fixtures/plan-invalid.md
  test/fixtures/plan-starwards.md    gap-closing-plan.md converted to the grammar
  test/lib.test.mjs
  test/cards.test.mjs
  test/counts.test.mjs
  test/state-write.test.mjs
  test/log-append.test.mjs
  test/init-scaffold.test.mjs
  test/sync-github.test.mjs          parses recorded gh JSON; never calls gh
```

`lib/lib.mjs` copies (not imports) `parseArgs`, `fail`, `readText`, `exists` from `plugins/garden/lib/lib.mjs:57,52,93,141` — plugins install independently, so no cross-plugin import.

---

### Task 1: Stub plugin + Cowork smoke gate (Gate 0)

**Files:**
- Create: `plugins/done/.claude-plugin/plugin.json`
- Create: `plugins/done/skills/init/SKILL.md` (temporary smoke body; Task 9 replaces it)

**Interfaces:**
- Produces: the plugin's identity (`name: done`, version `0.1.0`) and the answer to: does Cowork expose `${CLAUDE_SKILL_DIR}`, `node`, `gh`.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/done-plugin-stub
```

- [ ] **Step 2: Write plugin.json**

```json
{
  "name": "done",
  "version": "0.1.0",
  "description": "Solo project management for any complex backlog or goal: init, what-now, goals. Facts by script, judgment by model.",
  "author": { "name": "Amir Arad", "email": "greenshade@gmail.com" },
  "keywords": ["planning", "backlog", "solo", "routing", "agents"]
}
```

- [ ] **Step 3: Write the smoke SKILL.md**

```markdown
---
name: init
description: Smoke check for the done plugin (temporary). Prints the skill directory and tool availability. Replaced by the real init in the next release.
disable-model-invocation: true
---

# init (smoke)

Run each command and report its exact output, one line each. Do not interpret, do not fix.

1. `echo "$CLAUDE_SKILL_DIR"` — expected: an absolute path ending in `skills/init`. If empty, say `CLAUDE_SKILL_DIR: unset`.
2. `ls "$CLAUDE_SKILL_DIR/../../.claude-plugin/plugin.json"` — expected: the path. If missing, say so.
3. `node --version` — or `node: absent`.
4. `gh --version | head -1` — or `gh: absent`.
5. `git --version` — or `git: absent`.
6. `pwd` and `ls -a` of the working directory.

Output format: six lines, `<check>: <result>`. Nothing else.
```

- [ ] **Step 4: Validate the marketplace sync locally (read-only dry run)**

Run: `node scripts/generate-release-config.js` then `git diff --stat`
Expected: `.claude-plugin/marketplace.json` gains a `done` entry; `release-please-config.json` gains a `plugins/done` component. Revert those two generated files before committing (`git checkout -- .claude-plugin/marketplace.json release-please-config.json .release-please-manifest.json`); CI regenerates them.

- [ ] **Step 5: Commit and open PR**

```bash
git add plugins/done
git commit -m "feat(done): scaffold plugin with Cowork smoke init"
git push -u origin feat/done-plugin-stub
gh pr create --title "feat(done): scaffold plugin with Cowork smoke init" --body "Gate 0 for the done plugin: stub init prints CLAUDE_SKILL_DIR, node, gh availability so Cowork support can be verified before the real skills land. Spec: docs/superpowers/specs/2026-09-15-done-plugin-design.md"
```

- [ ] **Step 6: STOP. User action required.**

After squash-merge, the user: Cowork → Customize → Plugins → Add marketplace `amir-arad/claude-arad` (or Update) → install `done` → run `/done:init` in any folder → paste the six lines back. Also run `/done:init` in Claude Code for a baseline.

Record the result in the plan file under this task. Decision table:

| Cowork result | Consequence for Tasks 9–11 |
|---|---|
| `CLAUDE_SKILL_DIR` set, node present | Script steps primary; manual fallbacks stay as written |
| `CLAUDE_SKILL_DIR` set, node absent | Manual fallback becomes the primary path in Cowork; SKILL.md text says "if `node` is absent" first |
| `CLAUDE_SKILL_DIR` unset | Skills must locate the plugin by another means; stop and re-plan paths with the user |
| `gh` absent | Already covered: self-report for the run |

---

### Task 2: `lib/lib.mjs` — shared helpers

**Files:**
- Create: `plugins/done/lib/lib.mjs`
- Test: `plugins/done/test/lib.test.mjs`

**Interfaces (produces):**
- `parseArgs(argv, {flags: string[], options: string[]}) → {[k]: true|string, _: string[]}`; unknown flag → `fail`.
- `fail(message, code = 2) → never` (stderr `Error: <message>`, exit `code`).
- `emit(obj, {json}) → void` (json: pretty JSON to stdout; else caller prints text).
- `readText(p) → string|null`, `exists(p) → boolean`.
- `VERSION_RE = /^<!-- version: (\d+) -->\s*$/m`; `readVersion(text) → number|null`; `bumpVersion(text) → string` (replaces or prepends stamp).
- `parseProject(text) → {name, root, strategy, sync: {kind, repo?, labels?}, capacity, thresholds: {}, gates: {}, never: []}` parsing the `key: value` block of project.md (see Task 3 template). Unknown keys kept under `extra`.
- `doneDir(root) → path` (`<root>/.done`).
- `todayIso(args) → 'YYYY-MM-DD'` honouring `--as-of`.

- [ ] **Step 1: Write failing tests**

```js
// plugins/done/test/lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, readVersion, bumpVersion, parseProject } from '../lib/lib.mjs';

test('parseArgs handles flags, options, positionals', () => {
  const a = parseArgs(['root', '--json', '--as-of', '2026-09-15', '--repo=o/r'], { flags: ['json'], options: ['as-of', 'repo'] });
  assert.equal(a.json, true);
  assert.equal(a['as-of'], '2026-09-15');
  assert.equal(a.repo, 'o/r');
  assert.deepEqual(a._, ['root']);
});

test('readVersion / bumpVersion', () => {
  assert.equal(readVersion('<!-- version: 4 -->\n# x'), 4);
  assert.equal(readVersion('# no stamp'), null);
  assert.match(bumpVersion('<!-- version: 4 -->\n# x'), /^<!-- version: 5 -->/);
  assert.match(bumpVersion('# no stamp'), /^<!-- version: 1 -->\n# no stamp/);
});

test('parseProject reads the config block', () => {
  const text = `<!-- FORMAT CONTRACT -->\n# Project\n\n\`\`\`\nname: demo\nroot: .\nstrategy: agent-fleet\nsync: github\nsync.repo: o/r\nsync.labels.ready: agent-ready\nsync.labels.in_progress: agent-in-progress\ncapacity: agents\nthresholds.max_in_flight: 3\ngates.dispatch: human\nnever: roadmap.md, docs/adr/\n\`\`\`\n`;
  const p = parseProject(text);
  assert.equal(p.name, 'demo');
  assert.equal(p.sync.kind, 'github');
  assert.equal(p.sync.repo, 'o/r');
  assert.equal(p.sync.labels.ready, 'agent-ready');
  assert.equal(p.thresholds.max_in_flight, 3);
  assert.equal(p.gates.dispatch, 'human');
  assert.deepEqual(p.never, ['roadmap.md', 'docs/adr/']);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test plugins/done/test/lib.test.mjs`
Expected: FAIL, cannot find module `../lib/lib.mjs`.

- [ ] **Step 3: Implement**

```js
// plugins/done/lib/lib.mjs
import fs from 'node:fs';
import path from 'node:path';

export function fail(message, code = 2) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const res = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { res._.push(...argv.slice(i + 1)); break; }
    if (!a.startsWith('--')) { res._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (flags.includes(key)) { res[key] = true; continue; }
    if (!options.includes(key)) fail(`unknown option --${key}`, 1);
    const val = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (val === undefined) fail(`--${key} needs a value`, 1);
    res[key] = val;
  }
  return res;
}

export function emit(obj, { json } = {}) {
  if (json) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

export const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
export const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
export const doneDir = (root) => path.join(root, '.done');

export const VERSION_RE = /^<!-- version: (\d+) -->[ \t]*$/m;
export function readVersion(text) {
  const m = VERSION_RE.exec(text);
  return m ? Number(m[1]) : null;
}
export function bumpVersion(text) {
  const v = readVersion(text);
  if (v === null) return `<!-- version: 1 -->\n${text}`;
  return text.replace(VERSION_RE, `<!-- version: ${v + 1} -->`);
}

export function todayIso(args) {
  if (args['as-of']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args['as-of'])) fail('--as-of must be YYYY-MM-DD', 1);
    return args['as-of'];
  }
  return new Date().toISOString().slice(0, 10);
}

const NUMERIC = /^-?\d+(\.\d+)?$/;
export function parseProject(text) {
  const block = /```\n([\s\S]*?)```/.exec(text);
  const lines = (block ? block[1] : text).split('\n');
  const out = { name: '', root: '.', strategy: 'agent-fleet', sync: { kind: 'self-report', labels: {} }, capacity: 'none', thresholds: {}, gates: {}, never: [], extra: {} };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    const num = NUMERIC.test(val) ? Number(val) : val;
    if (key === 'sync') out.sync.kind = val;
    else if (key === 'sync.repo') out.sync.repo = val;
    else if (key.startsWith('sync.labels.')) out.sync.labels[key.slice(12)] = val;
    else if (key.startsWith('thresholds.')) out.thresholds[key.slice(11)] = num;
    else if (key.startsWith('gates.')) out.gates[key.slice(6)] = val;
    else if (key === 'never') out.never = val.split(',').map((s) => s.trim()).filter(Boolean);
    else if (['name', 'root', 'strategy', 'capacity'].includes(key)) out[key] = val;
    else out.extra[key] = num;
  }
  return out;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test plugins/done/test/lib.test.mjs`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/done-plugin-lib   # from main after Task 1 merged
git add plugins/done/lib/lib.mjs plugins/done/test/lib.test.mjs
git commit -m "feat(done): shared script helpers"
```

---

### Task 3: Assets (templates with FORMAT CONTRACTs)

**Files:**
- Create: `plugins/done/assets/project-template.md`, `plan-template.md`, `state-template.md`, `decisions-template.md`

**Interfaces (produces):** the exact text `init-scaffold.mjs` (Task 8) copies and `cards.mjs` (Task 4) parses. Contracts are the single source of truth; scripts must accept these files unchanged.

- [ ] **Step 1: project-template.md**

```markdown
<!-- FORMAT CONTRACT (done plugin)
One `key: value` per line inside the single fenced block. Dotted keys nest.
sync: github | self-report.  capacity: agents | people | none.
thresholds.* and gates.* override strategies/<strategy>/ladder.md and modes.md defaults.
never: comma-separated paths or surfaces the model must not edit.
Edited by /done:init and by hand. Never by what-now or goals.
-->
# Project

```
name: 
root: .
strategy: agent-fleet
sync: self-report
sync.repo: 
sync.labels.ready: agent-ready
sync.labels.in_progress: agent-in-progress
capacity: none
thresholds.max_in_flight: 2
thresholds.rebase_after: 5
gates.dispatch: human
gates.review: human
gates.decide: human
gates.qa: human
never: 
```

## Goal

One sentence. Edited only by /done:goals or the user.
```

- [ ] **Step 2: plan-template.md**

```markdown
<!-- version: 1 -->
<!-- FORMAT CONTRACT (done plugin)
Milestones: `## <ID> — <title>` in priority order. ID = letters+digits, e.g. M1.
Cards: one table row per card under a milestone, columns exactly:
| Card | Action | Mode | Owner | Blocked on | Status |
Card: `<milestone>.<n>` unique (M1.2). Action: free text, one line.
Mode: DECIDE | DISPATCH | REVIEW | QA | DO, optional suffix `(gate: <who>)`.
Owner: empty = the project owner; else a name.
Blocked on: comma list of card ids, `ext:<text>`, `owner:<name>`. Nothing else.
Status: open | filed #N | dispatched #N | pr #N | ruled YYYY-MM-DD | done YYYY-MM-DD
Done rows are moved to log.md by state-write. No strikethrough anywhere.
`## Cut list` holds `- <what> — <why> (<date>)` lines; never delete, only append.
Derived, never hand-written: READY NOW, IN FLIGHT, DECIDE order (cards.mjs derive).
-->
# Plan

## M1 — First milestone

Exit: what must be true to call M1 done.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M1.1 | Replace me | DECIDE |  |  | open |

## Cut list
```

- [ ] **Step 3: state-template.md**

```markdown
<!-- version: 1 -->
<!-- FORMAT CONTRACT (done plugin)
Written only by lib/state-write.mjs. Version stamp must match the value read before the run.
Snapshot is replaced every run. Watch list persists; each item: `- [ ] <text> (added YYYY-MM-DD; close when <condition>)`; tick and leave for one run, then state-write drops ticked items.
Next holds exactly one card.
-->
# State

## Snapshot

(no run yet)

## Watch list

## Next

(no run yet)
```

- [ ] **Step 4: decisions-template.md**

```markdown
<!-- FORMAT CONTRACT (done plugin)
Append-only. One line per ruling:
- YYYY-MM-DD — <card id | scope> — <ruling> — by <owner> [owner-call]
`[owner-call]` marks a scope move made during what-now; /done:goals reconciles these.
-->
# Decisions
```

- [ ] **Step 5: Commit**

```bash
git add plugins/done/assets
git commit -m "feat(done): state file templates with format contracts"
```

---

### Task 4: `lib/cards.mjs` — parse, validate, derive

**Files:**
- Create: `plugins/done/lib/cards.mjs`
- Create: `plugins/done/test/fixtures/plan-valid.md`, `plan-invalid.md`
- Test: `plugins/done/test/cards.test.mjs`

**Interfaces (produces):**
- CLI: `node cards.mjs <parse|validate|derive> <plan.md> [--json]`. `validate` exit 2 on any problem, listing them.
- `parsePlan(text) → {version, milestones: [{id, title, exit, cards: [Card]}], cut: string[], problems: string[]}`
- `Card = {id, milestone, action, mode, gate: string|null, owner: string|null, blockedOn: [{kind: 'card'|'ext'|'owner', ref}], status: {kind, ref?}, line}`
- `derive(plan) → {ready: id[], inFlight: id[], awaitingGate: id[], blocked: {[id]: string[]}, decideOrder: id[], done: id[]}`
  - ready: status open, no blockers, or all card-blockers done/ruled.
  - inFlight: status dispatched|pr.
  - awaitingGate: status pr (a delegate produced something the owner must gate).
  - decideOrder: DECIDE cards in ready order sorted by transitive dependents desc, then milestone order.
- Exported regexes: `CARD_ID = /^[A-Za-z]+\d+\.\d+$/`, `MILESTONE_HEAD = /^## ([A-Za-z]+\d+) — (.+)$/`.

- [ ] **Step 1: Fixtures**

`plan-valid.md`:
```markdown
<!-- version: 3 -->
# Plan

## M1 — Unstrand
Exit: reviews done.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M1.1 | Review PR batch | REVIEW |  |  | pr #2205 |
| M1.2 | Close stale issues | DO |  |  | done 2026-09-02 |

## M2 — Seats
Exit: five browsers hold seats.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M2.1 | Ratify binding model | DECIDE |  |  | ruled 2026-09-05 |
| M2.2 | Registry in admin room | DISPATCH |  | M2.1 | dispatched #2131 |
| M2.3 | Assign command | DISPATCH |  | M2.2 | open |
| M2.4 | Wave terminal condition | DECIDE |  |  | open |
| M2.5 | Ammo retune | DECIDE |  | M2.4 | open |
| M2.6 | Windows exe check | QA (gate: Daniel) | Daniel | ext:M2.2 merged | open |
| M2.7 | Card with owner blocker | DO |  | owner:Daniel | open |

## Cut list
- Morale system — week slipped (2026-08-07)
```

`plan-invalid.md`:
```markdown
<!-- version: 1 -->
# Plan

## M1 — Bad
| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M1.1 | Free-text blocker | DISPATCH |  | playtest evidence | open |
| M1.1 | Duplicate id | QA |  |  | open |
| M1.3 | Unknown mode | SHIP |  |  | open |
| M1.4 | Unknown status | DO |  |  | ~~done~~ |
| M1.5 | Dangling ref | DO |  | M9.9 | open |
```

- [ ] **Step 2: Failing tests**

```js
// plugins/done/test/cards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlan, derive } from '../lib/cards.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, 'fixtures', f), 'utf8');

test('parsePlan reads milestones, cards, cut list, version', () => {
  const p = parsePlan(read('plan-valid.md'));
  assert.equal(p.version, 3);
  assert.deepEqual(p.problems, []);
  assert.equal(p.milestones.length, 2);
  assert.equal(p.milestones[0].exit, 'reviews done.');
  const m22 = p.milestones[1].cards.find((c) => c.id === 'M2.2');
  assert.deepEqual(m22.blockedOn, [{ kind: 'card', ref: 'M2.1' }]);
  assert.deepEqual(m22.status, { kind: 'dispatched', ref: '2131' });
  const m26 = p.milestones[1].cards.find((c) => c.id === 'M2.6');
  assert.equal(m26.mode, 'QA');
  assert.equal(m26.gate, 'Daniel');
  assert.deepEqual(m26.blockedOn, [{ kind: 'ext', ref: 'M2.2 merged' }]);
  assert.deepEqual(p.cut, ['Morale system — week slipped (2026-08-07)']);
});

test('parsePlan reports every grammar violation', () => {
  const p = parsePlan(read('plan-invalid.md'));
  const text = p.problems.join('\n');
  assert.match(text, /M1\.1.*Blocked on/);
  assert.match(text, /duplicate card id M1\.1/);
  assert.match(text, /M1\.3.*Mode/);
  assert.match(text, /M1\.4.*Status/);
  assert.match(text, /M1\.5.*unknown card M9\.9/);
});

test('derive computes ready, in-flight, gate, decide order', () => {
  const d = derive(parsePlan(read('plan-valid.md')));
  assert.deepEqual(d.inFlight.sort(), ['M1.1', 'M2.2']);
  assert.deepEqual(d.awaitingGate, ['M1.1']);
  assert.deepEqual(d.done, ['M1.2']);
  assert.ok(d.ready.includes('M2.4'));
  assert.ok(!d.ready.includes('M2.3'));       // blocked on in-flight M2.2
  assert.ok(!d.ready.includes('M2.5'));       // blocked on open M2.4
  assert.ok(!d.ready.includes('M2.6'));       // ext blocker never auto-clears
  assert.ok(!d.ready.includes('M2.7'));       // owner blocker never auto-clears
  assert.deepEqual(d.blocked['M2.3'], ['M2.2']);
  assert.deepEqual(d.decideOrder, ['M2.4']);  // M2.5 not ready; M2.1 ruled
});
```

- [ ] **Step 3: Run, expect failure**

Run: `node --test plugins/done/test/cards.test.mjs` → FAIL, module not found.

- [ ] **Step 4: Implement**

```js
#!/usr/bin/env node
// plugins/done/lib/cards.mjs
import { parseArgs, fail, emit, readText, readVersion } from './lib.mjs';

export const CARD_ID = /^[A-Za-z]+\d+\.\d+$/;
export const MILESTONE_HEAD = /^## ([A-Za-z]+\d+) — (.+)$/;
export const MODES = ['DECIDE', 'DISPATCH', 'REVIEW', 'QA', 'DO'];
const STATUS_RE = /^(open|filed #(\d+)|dispatched #(\d+)|pr #(\d+)|ruled (\d{4}-\d{2}-\d{2})|done (\d{4}-\d{2}-\d{2}))$/;
const HEADER = ['Card', 'Action', 'Mode', 'Owner', 'Blocked on', 'Status'];

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
}

export function parsePlan(text) {
  const out = { version: readVersion(text), milestones: [], cut: [], problems: [] };
  const lines = text.split('\n');
  let ms = null;
  let inCut = false;
  let headerSeen = false;
  const ids = new Map();
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const n = i + 1;
    if (line.startsWith('## Cut list')) { inCut = true; ms = null; return; }
    const mh = MILESTONE_HEAD.exec(line);
    if (mh) { ms = { id: mh[1], title: mh[2], exit: '', cards: [] }; out.milestones.push(ms); inCut = false; headerSeen = false; return; }
    if (inCut) { if (line.startsWith('- ')) out.cut.push(line.slice(2)); return; }
    if (!ms) return;
    if (line.startsWith('Exit:')) { ms.exit = line.slice(5).trim(); return; }
    if (!line.startsWith('|')) return;
    const c = cells(line);
    if (c[0] === 'Card') {
      headerSeen = true;
      if (c.join('|') !== HEADER.join('|')) out.problems.push(`line ${n}: table header must be | ${HEADER.join(' | ')} |`);
      return;
    }
    if (/^-+$/.test(c[0])) return;
    if (!headerSeen) { out.problems.push(`line ${n}: card row before table header`); return; }
    if (c.length !== 6) { out.problems.push(`line ${n}: expected 6 cells, got ${c.length}`); return; }
    const [id, action, modeCell, owner, blocked, status] = c;
    const card = { id, milestone: ms.id, action, mode: null, gate: null, owner: owner || null, blockedOn: [], status: null, line: n };
    if (!CARD_ID.test(id)) out.problems.push(`line ${n}: bad card id "${id}"`);
    if (ids.has(id)) out.problems.push(`line ${n}: duplicate card id ${id}`); else ids.set(id, card);
    const mm = /^([A-Z]+)(?:\s*\(gate:\s*([^)]+)\))?$/.exec(modeCell);
    if (!mm || !MODES.includes(mm[1])) out.problems.push(`line ${n}: ${id} Mode "${modeCell}" not one of ${MODES.join('|')}`);
    else { card.mode = mm[1]; card.gate = mm[2] ? mm[2].trim() : null; }
    if (blocked) {
      for (const part of blocked.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (CARD_ID.test(part)) card.blockedOn.push({ kind: 'card', ref: part });
        else if (part.startsWith('ext:')) card.blockedOn.push({ kind: 'ext', ref: part.slice(4).trim() });
        else if (part.startsWith('owner:')) card.blockedOn.push({ kind: 'owner', ref: part.slice(6).trim() });
        else out.problems.push(`line ${n}: ${id} Blocked on "${part}" must be a card id, ext:<text> or owner:<name>`);
      }
    }
    const sm = STATUS_RE.exec(status);
    if (!sm) out.problems.push(`line ${n}: ${id} Status "${status}" not in open|filed #N|dispatched #N|pr #N|ruled DATE|done DATE`);
    else {
      const kind = sm[1].split(' ')[0];
      card.status = { kind, ref: sm[2] || sm[3] || sm[4] || sm[5] || sm[6] || undefined };
    }
    ms.cards.push(card);
  });
  const all = out.milestones.flatMap((m) => m.cards);
  for (const card of all) for (const b of card.blockedOn) {
    if (b.kind === 'card' && !ids.has(b.ref)) out.problems.push(`line ${card.line}: ${card.id} blocked on unknown card ${b.ref}`);
  }
  return out;
}

export function derive(plan) {
  const cards = plan.milestones.flatMap((m) => m.cards);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const settled = (id) => { const s = byId.get(id)?.status?.kind; return s === 'done' || s === 'ruled'; };
  const res = { ready: [], inFlight: [], awaitingGate: [], blocked: {}, decideOrder: [], done: [] };
  for (const c of cards) {
    const k = c.status?.kind;
    if (k === 'done' || k === 'ruled') { res.done.push(c.id); continue; }
    if (k === 'dispatched' || k === 'pr') res.inFlight.push(c.id);
    if (k === 'pr') res.awaitingGate.push(c.id);
    const open = c.blockedOn.filter((b) => b.kind !== 'card' || !settled(b.ref));
    if (open.length) res.blocked[c.id] = open.map((b) => (b.kind === 'card' ? b.ref : `${b.kind}:${b.ref}`));
    else if (k === 'open') res.ready.push(c.id);
  }
  const dependents = new Map(cards.map((c) => [c.id, 0]));
  const rev = new Map();
  for (const c of cards) for (const b of c.blockedOn) if (b.kind === 'card') (rev.get(b.ref) ?? rev.set(b.ref, []).get(b.ref)).push(c.id);
  const countTransitive = (id, seen = new Set()) => {
    for (const d of rev.get(id) ?? []) if (!seen.has(d)) { seen.add(d); countTransitive(d, seen); }
    return seen.size;
  };
  for (const id of dependents.keys()) dependents.set(id, countTransitive(id));
  const order = new Map(cards.map((c, i) => [c.id, i]));
  res.decideOrder = res.ready
    .filter((id) => byId.get(id).mode === 'DECIDE')
    .sort((a, b) => dependents.get(b) - dependents.get(a) || order.get(a) - order.get(b));
  return res;
}

const HELP = `cards.mjs — parse, validate or derive from a done plan.md

Usage:
  node cards.mjs parse    <plan.md> [--json]
  node cards.mjs validate <plan.md> [--json]     exit 2 and list problems if the grammar is violated
  node cards.mjs derive   <plan.md> [--json]     ready / in-flight / awaiting-gate / blocked / decide order
Exit codes: 0 ok, 1 usage, 2 validation failed.
`;

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href.replace(/file:\/\/\/?/, 'file:///')) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'] });
  if (args.help || args._.length === 0) { process.stdout.write(HELP); process.exit(0); }
  const [cmd, file] = args._;
  if (!['parse', 'validate', 'derive'].includes(cmd) || !file) fail('usage: cards.mjs <parse|validate|derive> <plan.md>', 1);
  const text = readText(file);
  if (text === null) fail(`cannot read ${file}`, 1);
  const plan = parsePlan(text);
  if (cmd === 'validate' || plan.problems.length) {
    if (plan.problems.length) {
      if (args.json) emit({ ok: false, problems: plan.problems }, args);
      else process.stderr.write(plan.problems.map((p) => `- ${p}`).join('\n') + '\n');
      process.exit(2);
    }
    if (cmd === 'validate') { if (args.json) emit({ ok: true, problems: [] }, args); else process.stdout.write('ok\n'); process.exit(0); }
  }
  const out = cmd === 'derive' ? derive(plan) : plan;
  if (args.json) emit(out, args); else process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
```

Note on the main-module guard: the `import.meta.url` comparison above is fragile on Windows. Use this helper in `lib.mjs` instead and call `if (isMain(import.meta.url))`:

```js
import { fileURLToPath } from 'node:url';
export const isMain = (metaUrl) => process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(metaUrl));
```

Add `isMain` to lib.mjs in this task and use it in every later script.

- [ ] **Step 5: Run, expect pass**

Run: `node --test plugins/done/test/cards.test.mjs` → 3 passing.
Run: `node plugins/done/lib/cards.mjs validate plugins/done/test/fixtures/plan-invalid.md; echo $?` → problems on stderr, exit 2.
Run: `node plugins/done/lib/cards.mjs validate plugins/done/assets/plan-template.md` → `ok` (template must validate; the version stamp and contract comment are ignored by the parser).

- [ ] **Step 6: Commit**

```bash
git add plugins/done/lib plugins/done/test
git commit -m "feat(done): card parser, validator and readiness derivation"
```

---

### Task 5: `lib/sync-github.mjs` — gh facts

**Files:**
- Create: `plugins/done/lib/sync-github.mjs`
- Create: `plugins/done/test/fixtures/gh-prs-open.json`, `gh-prs-merged.json`, `gh-issues.json`
- Test: `plugins/done/test/sync-github.test.mjs`

**Interfaces (produces):**
- CLI: `node sync-github.mjs --repo o/r --ready-label agent-ready --in-progress-label agent-in-progress [--since YYYY-MM-DD] [--json]`.
- Output JSON `Facts`:
```
{ source: 'github', repo, since,
  merged: [{number, title, mergedAt, author}],
  openPrs: [{number, title, author, updatedAt, isBot, behindBy: number|null, headRef}],
  readyNoPr: [{number, title, updatedAt}],      // has ready label, no open PR references it
  inProgress: [{number, title, updatedAt, prs: number[]}],
  duplicateClaims: [{issue, prs: number[]}],    // >1 open PR references one issue
  staleLabels: [{number, label, updatedAt}],    // in-progress label, no open PR, updated > 3 days ago
  errors: [] }
```
- `buildFacts({repo, since, mergedRaw, openRaw, issuesRaw, labels, now}) → Facts` (pure; tested).
- `gh` absent or non-zero → exit 2 with `Error: gh unavailable: <reason>` so the skill falls back to self-report.

- [ ] **Step 1: Fixtures** — three small JSON arrays in `gh` output shape: `gh pr list --json number,title,mergedAt,author`; `gh pr list --state open --json number,title,author,updatedAt,headRefName,body,isDraft`; `gh issue list --json number,title,labels,updatedAt`. Include: one bot PR (`author.login` ends with `[bot]`), two open PRs whose body says `Closes #2131`, one issue with the ready label and no PR, one with in-progress label updated 10 days ago and no PR.

- [ ] **Step 2: Failing test**

```js
// plugins/done/test/sync-github.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { buildFacts } from '../lib/sync-github.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const j = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));

test('buildFacts classifies PRs and issues', () => {
  const f = buildFacts({
    repo: 'o/r', since: '2026-09-01', now: new Date('2026-09-15T00:00:00Z'),
    mergedRaw: j('gh-prs-merged.json'), openRaw: j('gh-prs-open.json'), issuesRaw: j('gh-issues.json'),
    labels: { ready: 'agent-ready', in_progress: 'agent-in-progress' },
  });
  assert.equal(f.source, 'github');
  assert.ok(f.openPrs.some((p) => p.isBot));
  assert.deepEqual(f.duplicateClaims, [{ issue: 2131, prs: [2225, 2226] }]);
  assert.equal(f.readyNoPr.length, 1);
  assert.equal(f.staleLabels.length, 1);
  assert.deepEqual(f.errors, []);
});
```

- [ ] **Step 3: Run, expect failure** → module not found.

- [ ] **Step 4: Implement**

```js
#!/usr/bin/env node
// plugins/done/lib/sync-github.mjs
import { execFileSync } from 'node:child_process';
import { parseArgs, fail, emit, isMain, todayIso } from './lib.mjs';

const REF_RE = /(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s+#(\d+)/gi;
const DAY = 86400000;

export function buildFacts({ repo, since, now = new Date(), mergedRaw, openRaw, issuesRaw, labels }) {
  const refs = (body) => [...(body || '').matchAll(REF_RE)].map((m) => Number(m[1]));
  const openPrs = openRaw.map((p) => ({
    number: p.number, title: p.title, author: p.author?.login ?? '', updatedAt: p.updatedAt,
    isBot: /\[bot\]$|^copilot|^dependabot/i.test(p.author?.login ?? ''), headRef: p.headRefName, behindBy: p.behindBy ?? null,
    refs: refs(p.body), isDraft: !!p.isDraft,
  }));
  const prsByIssue = new Map();
  for (const p of openPrs) for (const n of p.refs) (prsByIssue.get(n) ?? prsByIssue.set(n, []).get(n)).push(p.number);
  const has = (i, l) => (i.labels || []).some((x) => x.name === l);
  const readyNoPr = [], inProgress = [], staleLabels = [];
  for (const i of issuesRaw) {
    const prs = prsByIssue.get(i.number) ?? [];
    if (has(i, labels.ready) && prs.length === 0) readyNoPr.push({ number: i.number, title: i.title, updatedAt: i.updatedAt });
    if (has(i, labels.in_progress)) {
      inProgress.push({ number: i.number, title: i.title, updatedAt: i.updatedAt, prs });
      if (prs.length === 0 && now - new Date(i.updatedAt) > 3 * DAY) staleLabels.push({ number: i.number, label: labels.in_progress, updatedAt: i.updatedAt });
    }
  }
  const duplicateClaims = [...prsByIssue].filter(([, prs]) => prs.length > 1).map(([issue, prs]) => ({ issue, prs: prs.sort((a, b) => a - b) }));
  return {
    source: 'github', repo, since,
    merged: mergedRaw.map((p) => ({ number: p.number, title: p.title, mergedAt: p.mergedAt, author: p.author?.login ?? '' })),
    openPrs: openPrs.map(({ refs, ...p }) => p),
    readyNoPr, inProgress, duplicateClaims, staleLabels, errors: [],
  };
}

function gh(args) {
  try { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (e) { fail(`gh unavailable: ${e.stderr?.toString().trim() || e.message}`, 2); }
}

const HELP = `sync-github.mjs — GitHub facts for /done:what-now.
Usage: node sync-github.mjs --repo owner/repo [--ready-label L] [--in-progress-label L] [--since YYYY-MM-DD] [--json]
Exit: 0 facts, 1 usage, 2 gh unavailable (fall back to self-report).
`;

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['repo', 'ready-label', 'in-progress-label', 'since', 'as-of'] });
  if (args.help || !args.repo) { process.stdout.write(HELP); process.exit(args.repo ? 0 : 1); }
  const since = args.since ?? new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10);
  const labels = { ready: args['ready-label'] ?? 'agent-ready', in_progress: args['in-progress-label'] ?? 'agent-in-progress' };
  const facts = buildFacts({
    repo: args.repo, since, labels,
    mergedRaw: gh(['pr', 'list', '--repo', args.repo, '--state', 'merged', '--limit', '30', '--search', `merged:>=${since}`, '--json', 'number,title,mergedAt,author']),
    openRaw: gh(['pr', 'list', '--repo', args.repo, '--state', 'open', '--limit', '50', '--json', 'number,title,author,updatedAt,headRefName,body,isDraft']),
    issuesRaw: gh(['issue', 'list', '--repo', args.repo, '--state', 'open', '--limit', '100', '--json', 'number,title,labels,updatedAt']),
  });
  emit(facts, { json: true });
}
```

`behindBy` stays `null` in v1: `gh pr list` does not expose it and per-PR calls are slow. The skill asks the user or reads it from PR pre-read notes. Record this in the script's HELP.

- [ ] **Step 5: Run tests** → pass. Manual: `node plugins/done/lib/sync-github.mjs --repo starwards/starwards --json | head -30` shows real facts (requires `gh auth`).

- [ ] **Step 6: Commit** — `feat(done): github sync facts script`

---

### Task 6: `lib/counts.mjs` — constraint counts

**Files:**
- Create: `plugins/done/lib/counts.mjs`
- Test: `plugins/done/test/counts.test.mjs`

**Interfaces:**
- Consumes: `derive()` output (Task 4), `Facts` (Task 5) or `null` for self-report, project thresholds (Task 2).
- Produces: `counts({derived, facts, plan, project}) → {awaiting_gate, in_flight, ready_dispatch, ready_decide, ready_qa, ready_do, max_in_flight, dispatch_gap, blockers: string[]}` where `blockers` lists fact-derived environmental problems: `duplicateClaims`, `staleLabels`, `facts.errors`, and every ready DISPATCH card whose issue is in `readyNoPr` longer than 3 days ("label without worker").
- CLI: `node counts.mjs <plan.md> --project <project.md> [--facts facts.json] [--json]`.

- [ ] **Step 1: Failing test**

```js
// plugins/done/test/counts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parsePlan, derive } from '../lib/cards.mjs';
import { counts } from '../lib/counts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const plan = parsePlan(fs.readFileSync(path.join(here, 'fixtures', 'plan-valid.md'), 'utf8'));

test('counts without facts', () => {
  const c = counts({ derived: derive(plan), plan, facts: null, project: { thresholds: { max_in_flight: 3 } } });
  assert.equal(c.in_flight, 2);
  assert.equal(c.awaiting_gate, 1);
  assert.equal(c.ready_decide, 1);
  assert.equal(c.dispatch_gap, 1);
  assert.deepEqual(c.blockers, []);
});

test('counts surfaces fact blockers', () => {
  const facts = { duplicateClaims: [{ issue: 2131, prs: [1, 2] }], staleLabels: [{ number: 9, label: 'agent-in-progress', updatedAt: '2026-09-01' }], readyNoPr: [], errors: [] };
  const c = counts({ derived: derive(plan), plan, facts, project: { thresholds: {} } });
  assert.equal(c.blockers.length, 2);
  assert.equal(c.max_in_flight, 2);   // default when threshold absent
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/done/lib/counts.mjs
import { parseArgs, fail, emit, readText, isMain, parseProject } from './lib.mjs';
import { parsePlan, derive } from './cards.mjs';

export function counts({ derived, plan, facts, project }) {
  const cards = new Map(plan.milestones.flatMap((m) => m.cards).map((c) => [c.id, c]));
  const readyBy = (mode) => derived.ready.filter((id) => cards.get(id).mode === mode).length;
  const max = Number(project?.thresholds?.max_in_flight ?? 2);
  const blockers = [];
  if (facts) {
    for (const d of facts.duplicateClaims ?? []) blockers.push(`duplicate claim: issue #${d.issue} has PRs ${d.prs.map((n) => '#' + n).join(', ')}`);
    for (const s of facts.staleLabels ?? []) blockers.push(`stale label: #${s.number} carries ${s.label}, no PR, last update ${s.updatedAt}`);
    for (const e of facts.errors ?? []) blockers.push(`sync error: ${e}`);
    const threeDays = 3 * 86400000;
    for (const r of facts.readyNoPr ?? []) if (Date.now() - new Date(r.updatedAt) > threeDays) blockers.push(`label without worker: #${r.number} ready since ${r.updatedAt}`);
  }
  return {
    awaiting_gate: derived.awaitingGate.length,
    in_flight: derived.inFlight.length,
    ready_dispatch: readyBy('DISPATCH'), ready_decide: readyBy('DECIDE'), ready_qa: readyBy('QA'), ready_do: readyBy('DO'),
    max_in_flight: max, dispatch_gap: Math.max(0, max - derived.inFlight.length), blockers,
  };
}

const HELP = `counts.mjs — constraint counts for the routing ladder.
Usage: node counts.mjs <plan.md> --project <project.md> [--facts <facts.json>] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['project', 'facts'] });
  if (args.help || !args._[0] || !args.project) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  const planText = readText(args._[0]); if (planText === null) fail(`cannot read ${args._[0]}`, 1);
  const plan = parsePlan(planText); if (plan.problems.length) fail(`plan invalid:\n${plan.problems.join('\n')}`, 2);
  const project = parseProject(readText(args.project) ?? '');
  const facts = args.facts ? JSON.parse(readText(args.facts) ?? 'null') : null;
  emit(counts({ derived: derive(plan), plan, facts, project }), { json: true });
}
```

- [ ] **Step 4: Run → pass. Commit** — `feat(done): constraint counts script`

---

### Task 7: `lib/state-write.mjs` and `lib/log-append.mjs` — guarded writes

**Files:**
- Create: `plugins/done/lib/state-write.mjs`, `plugins/done/lib/log-append.mjs`
- Test: `plugins/done/test/state-write.test.mjs`, `plugins/done/test/log-append.test.mjs`

**Interfaces:**
- `state-write.mjs <file> --expect-version N (--from <file> | stdin) [--root <dir>] [--as-of D] [--json]`
  - Refuses (exit 2, `Error: version mismatch: file is at M, expected N`) when the file's current stamp ≠ N.
  - Writes new content with the stamp bumped to N+1. Content supplied without a stamp gets one.
  - When basename is `plan.md`: validates via `parsePlan` (exit 2 on problems); rows with `done`/`ruled` status are removed from the written plan and each appended to `<root>/.done/log.md` as `- <date> archive card:<id> <status> — <action>`.
  - When basename is `state.md`: watch-list items `- [x] ...` in the *current* file are dropped from the written content (the skill copies them forward ticked once; the script drops them on the next write).
  - JSON result `{ok: true, file, version: N+1, archived: id[]}`.
- `log-append.mjs <root> --run <what-now|goals|init> --version N --card <id|-> (--rule <k> | --deviation "<reason>") --text "<one line>" [--manual] [--as-of D]`
  - Appends `- <date> <run> v<N> <rule:k|deviation:reason> card:<id> <text>` (prefixed `manual: ` when `--manual`). Rejects text containing newlines (exit 1). Creates log.md with the contract header if absent.
- Both export pure functions: `guardedWrite({file, expectVersion, content, root, date}) → result` and `formatLogLine({...}) → string`.

- [ ] **Step 1: Failing tests**

```js
// plugins/done/test/state-write.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { guardedWrite } from '../lib/state-write.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'done-'));

test('refuses on stale version', () => {
  const root = tmp(); const dir = path.join(root, '.done'); fs.mkdirSync(dir);
  const f = path.join(dir, 'state.md'); fs.writeFileSync(f, '<!-- version: 3 -->\n# State\n');
  const r = guardedWrite({ file: f, expectVersion: 2, content: '# new', root, date: '2026-09-15' });
  assert.equal(r.ok, false); assert.match(r.error, /version mismatch: file is at 3, expected 2/);
  assert.equal(fs.readFileSync(f, 'utf8'), '<!-- version: 3 -->\n# State\n');
});

test('writes, bumps, archives done rows from plan.md', () => {
  const root = tmp(); const dir = path.join(root, '.done'); fs.mkdirSync(dir);
  const f = path.join(dir, 'plan.md');
  const plan = `<!-- version: 1 -->\n# Plan\n\n## M1 — A\n| Card | Action | Mode | Owner | Blocked on | Status |\n|---|---|---|---|---|---|\n| M1.1 | keep | DO |  |  | open |\n| M1.2 | drop | DO |  |  | done 2026-09-14 |\n`;
  fs.writeFileSync(f, plan);
  const r = guardedWrite({ file: f, expectVersion: 1, content: plan, root, date: '2026-09-15' });
  assert.equal(r.ok, true); assert.equal(r.version, 2); assert.deepEqual(r.archived, ['M1.2']);
  const out = fs.readFileSync(f, 'utf8');
  assert.match(out, /^<!-- version: 2 -->/); assert.ok(out.includes('M1.1')); assert.ok(!out.includes('M1.2'));
  assert.match(fs.readFileSync(path.join(dir, 'log.md'), 'utf8'), /2026-09-15 archive card:M1\.2 done 2026-09-14 — drop/);
});

test('drops ticked watch items from state.md', () => {
  const root = tmp(); const dir = path.join(root, '.done'); fs.mkdirSync(dir);
  const f = path.join(dir, 'state.md');
  fs.writeFileSync(f, '<!-- version: 1 -->\n# State\n\n## Watch list\n- [x] old (added 2026-09-01; close when merged)\n- [ ] keep (added 2026-09-02; close when x)\n\n## Next\n');
  const r = guardedWrite({ file: f, expectVersion: 1, content: fs.readFileSync(f, 'utf8'), root, date: '2026-09-15' });
  assert.equal(r.ok, true);
  const out = fs.readFileSync(f, 'utf8');
  assert.ok(!out.includes('[x] old')); assert.ok(out.includes('[ ] keep'));
});
```

```js
// plugins/done/test/log-append.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLogLine } from '../lib/log-append.mjs';

test('formats one line', () => {
  assert.equal(formatLogLine({ date: '2026-09-15', run: 'what-now', version: 7, rule: '3', card: 'M4.1', text: 'ammo packet drafted' }),
    '- 2026-09-15 what-now v7 rule:3 card:M4.1 ammo packet drafted');
  assert.equal(formatLogLine({ date: '2026-09-15', run: 'what-now', version: 8, deviation: 'user asked for QA first', card: 'M4.2', text: 'ran 2.4', manual: true }),
    '- 2026-09-15 what-now v8 manual: deviation:"user asked for QA first" card:M4.2 ran 2.4');
  assert.throws(() => formatLogLine({ date: 'd', run: 'goals', version: 1, rule: '-', card: '-', text: 'a\nb' }), /newline/);
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/done/lib/log-append.mjs
import fs from 'node:fs'; import path from 'node:path';
import { parseArgs, fail, emit, isMain, todayIso, doneDir, exists } from './lib.mjs';

const LOG_HEADER = `<!-- FORMAT CONTRACT (done plugin)\nAppend-only. Written only by lib/log-append.mjs and lib/state-write.mjs. One line per run:\n- YYYY-MM-DD <run> v<N> [manual: ]<rule:k | deviation:"reason"> card:<id> <one line>\n-->\n# Log\n\n`;

export function formatLogLine({ date, run, version, rule, deviation, card, text, manual = false }) {
  if (/[\r\n]/.test(text)) throw new Error('log text must not contain a newline');
  const why = deviation ? `deviation:${JSON.stringify(deviation)}` : `rule:${rule ?? '-'}`;
  return `- ${date} ${run} v${version} ${manual ? 'manual: ' : ''}${why} card:${card || '-'} ${text}`;
}

export function appendLog(root, line) {
  const file = path.join(doneDir(root), 'log.md');
  if (!exists(file)) fs.writeFileSync(file, LOG_HEADER);
  fs.appendFileSync(file, line + '\n');
  return file;
}

const HELP = `log-append.mjs — append one run line to .done/log.md.
Usage: node log-append.mjs <root> --run <what-now|goals|init> --version N --card <id|-> (--rule k | --deviation "why") --text "one line" [--manual] [--as-of D] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help', 'manual'], options: ['run', 'version', 'card', 'rule', 'deviation', 'text', 'as-of'] });
  if (args.help || !args._[0] || !args.run || !args.text) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  let line;
  try { line = formatLogLine({ date: todayIso(args), run: args.run, version: args.version ?? '-', rule: args.rule, deviation: args.deviation, card: args.card, text: args.text, manual: !!args.manual }); }
  catch (e) { fail(e.message, 1); }
  const file = appendLog(args._[0], line);
  emit({ ok: true, file, line }, { json: true });
}
```

```js
#!/usr/bin/env node
// plugins/done/lib/state-write.mjs
import fs from 'node:fs'; import path from 'node:path';
import { parseArgs, fail, emit, readText, readVersion, isMain, todayIso } from './lib.mjs';
import { parsePlan } from './cards.mjs';
import { appendLog } from './log-append.mjs';

export function guardedWrite({ file, expectVersion, content, root, date }) {
  const current = readText(file);
  const have = current === null ? null : readVersion(current);
  if (have !== expectVersion) return { ok: false, error: `version mismatch: file is at ${have}, expected ${expectVersion}` };
  const next = (have ?? 0) + 1;
  let body = readVersion(content) === null ? content : content.replace(/^<!-- version: \d+ -->[ \t]*\n?/m, '');
  const archived = [];
  const base = path.basename(file);
  if (base === 'plan.md') {
    const plan = parsePlan(body);
    if (plan.problems.length) return { ok: false, error: `plan invalid:\n${plan.problems.join('\n')}` };
    const lines = body.split('\n');
    const drop = new Set();
    for (const m of plan.milestones) for (const c of m.cards) if (c.status.kind === 'done' || c.status.kind === 'ruled') {
      drop.add(c.line - 1); archived.push(c.id);
      appendLog(root, `- ${date} archive card:${c.id} ${c.status.kind} ${c.status.ref} — ${c.action}`);
    }
    body = lines.filter((_, i) => !drop.has(i)).join('\n');
  }
  if (base === 'state.md') body = body.split('\n').filter((l) => !/^- \[x\] /i.test(l)).join('\n');
  fs.writeFileSync(file, `<!-- version: ${next} -->\n${body}`);
  return { ok: true, file, version: next, archived };
}

const HELP = `state-write.mjs — write a .done file only if its version stamp is what you read.
Usage: node state-write.mjs <file> --expect-version N [--from <content-file>] [--root <dir>] [--as-of D] [--json]
Content comes from --from or stdin. Exit 2 on version mismatch or invalid plan; nothing is written.
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['expect-version', 'from', 'root', 'as-of'] });
  if (args.help || !args._[0] || args['expect-version'] === undefined) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  const file = path.resolve(args._[0]);
  const content = args.from ? readText(args.from) : fs.readFileSync(0, 'utf8');
  if (content === null) fail(`cannot read ${args.from}`, 1);
  const root = args.root ?? path.resolve(path.dirname(file), '..');
  const r = guardedWrite({ file, expectVersion: Number(args['expect-version']), content, root, date: todayIso(args) });
  if (!r.ok) fail(r.error, 2);
  emit(r, { json: true });
}
```

- [ ] **Step 4: Run all tests** — `node --test plugins/done/test/` → all pass.

- [ ] **Step 5: Commit** — `feat(done): guarded state writes and script-owned log`

---

### Task 8: `lib/init-scaffold.mjs`

**Files:**
- Create: `plugins/done/lib/init-scaffold.mjs`
- Test: `plugins/done/test/init-scaffold.test.mjs`

**Interfaces:**
- CLI: `node init-scaffold.mjs <root> [--json]`. Creates `<root>/.done/` and copies each template from `../assets/*-template.md` to `project.md`, `plan.md`, `state.md`, `decisions.md` when absent; never overwrites. `log.md` is created by `appendLog` with the header and one `init` line. Output `{created: [], already_present: [], done_dir}`.
- Templates are read from disk relative to `import.meta.url` (`../assets/`), not inlined (garden inlines; the spec wants one source of truth).
- Refuses to scaffold into the plugin's own directory (`fail`, exit 2), copying garden's self-guard.

- [ ] **Step 1: Failing test**

```js
// plugins/done/test/init-scaffold.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { scaffold } from '../lib/init-scaffold.mjs';

test('creates once, then reports present', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'done-'));
  const a = scaffold(root, '2026-09-15');
  assert.deepEqual(a.created.map((c) => path.basename(c)).sort(), ['.done', 'decisions.md', 'log.md', 'plan.md', 'project.md', 'state.md']);
  fs.writeFileSync(path.join(root, '.done', 'plan.md'), 'custom');
  const b = scaffold(root, '2026-09-15');
  assert.deepEqual(b.created, []);
  assert.equal(fs.readFileSync(path.join(root, '.done', 'plan.md'), 'utf8'), 'custom');
  assert.match(fs.readFileSync(path.join(root, '.done', 'project.md'), 'utf8'), /FORMAT CONTRACT/);
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/done/lib/init-scaffold.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseArgs, fail, emit, isMain, todayIso, doneDir, exists } from './lib.mjs';
import { appendLog, formatLogLine } from './log-append.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(here, '..', 'assets');
const FILES = ['project', 'plan', 'state', 'decisions'];

export function scaffold(root, date) {
  const dir = doneDir(root);
  const res = { done_dir: dir, created: [], already_present: [] };
  if (exists(dir)) res.already_present.push(dir); else { fs.mkdirSync(dir, { recursive: true }); res.created.push(dir); }
  for (const name of FILES) {
    const target = path.join(dir, `${name}.md`);
    if (exists(target)) { res.already_present.push(target); continue; }
    fs.writeFileSync(target, fs.readFileSync(path.join(ASSETS, `${name}-template.md`), 'utf8'));
    res.created.push(target);
  }
  const log = path.join(dir, 'log.md');
  if (exists(log)) res.already_present.push(log);
  else { appendLog(root, formatLogLine({ date, run: 'init', version: 1, rule: '-', card: '-', text: 'scaffolded .done/' })); res.created.push(log); }
  return res;
}

const HELP = `init-scaffold.mjs — create .done/ from the plugin templates. Never overwrites.
Usage: node init-scaffold.mjs <root> [--as-of D] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['as-of'] });
  if (args.help || !args._[0]) { process.stdout.write(HELP); process.exit(0); }
  const root = path.resolve(args._[0]);
  if (root === path.resolve(here, '..')) fail('refusing to scaffold into the plugin that ships this script', 2);
  if (!exists(root)) fail(`${root} does not exist`, 1);
  emit(scaffold(root, todayIso(args)), { json: true });
}
```

- [ ] **Step 4: Run → pass. Run `node --test plugins/done/test/` → all pass. Commit** — `feat(done): idempotent .done scaffold`. Open PR `feat(done): scripts and templates`; squash-merge before Task 9.

---

### Task 9: Strategy `agent-fleet` files

**Files:**
- Create: `plugins/done/strategies/agent-fleet/ladder.md`, `modes.md`, `failure-checks.md`

**Interfaces (produces):** prose consumed by `what-now` and `goals`. Threshold names must match `parseProject` keys: `max_in_flight`, `rebase_after`. Mode names must match `cards.mjs` `MODES`.

- [ ] **Step 1: ladder.md**

```markdown
# agent-fleet — routing ladder

First rule that fires wins. Inputs: `counts` JSON, `derive` JSON, watch list, user input.
Thresholds (defaults here; `thresholds.*` in project.md override): max_in_flight = 2, rebase_after = 5.

0. **Blocker present** — `counts.blockers` non-empty, a watch-list item says blocked, or the user reports an environmental failure (CI red on the base branch, auth failure, worker sandbox down, single-writer conflict). Route: clear the blocker. Name it in the log line as `card:-`.
1. **Delegate output awaiting the owner's gate** — `awaiting_gate > 0`. Route: the oldest card whose PR is furthest behind base (≥ rebase_after merges first; ask the user for behind-by if facts lack it), then oldest. Prepare per REVIEW in modes.md.
2. **Dispatch gap** — `dispatch_gap > 0` and `ready_dispatch > 0`. Route: up to `dispatch_gap` READY NOW DISPATCH cards in plan order. Prepare tickets per DISPATCH; the owner flips labels.
3. **Decision pending** — `ready_decide > 0`. Route: `decideOrder[0]`. Prepare per DECIDE.
4. **QA or DO ready** — `ready_qa + ready_do > 0`. Route: first READY NOW QA card, else first DO card, in plan order.
5. **Nothing routable** — say so, list what every open card is blocked on, and suggest `/done:goals`.

Deviation: allowed for a stated reason (user request, judgment that a lower rule is more valuable today). The log line carries `deviation:"reason"` instead of `rule:k`.

Capacity `none`: rules 1–2 never fire (no delegates). Capacity `people`: rule 2 reads "hand off" instead of "flip a label"; the owner tells the person.
```

- [ ] **Step 2: modes.md**

```markdown
# agent-fleet — modes

| Mode | Prepares (agent) | Gates (owner) | Done when | Artifact |
|---|---|---|---|---|
| DECIDE | Options packet: 2–3 options, numbers from files actually read, one-line tradeoff each, one-line recommendation, who consumes the ruling | Rules | Ruling recorded in decisions.md; card status `ruled <date>` | Packet in the reply; ruling line |
| DISPATCH | Ticket body: self-contained (no links into files a worker cannot read), no placeholders, acceptance criteria, traps stated, sized for one worker run | Files or approves the ticket, flips the ready label | PR merged; card `done <date>` | Ticket text + exact label command for the owner |
| REVIEW | Pre-read: what the PR claims, what the diff does, scenario evidence vs green tests, behind-by, merge risk, one recommendation | Rules merge / rework / close | Merged or closed | Pre-read notes |
| QA | Checklist with expected observations; findings become cards, never fixes | Runs it | Checklist run, findings filed | Checklist + findings cards |
| DO | Concrete first step and the finish condition | None by default | Card `done <date>` | The work itself |

Per-card override: `(gate: <name>)` in the Mode cell replaces the owner as gate for that card. `gates.<mode>` in project.md replaces the default for every card of that mode (`none` removes the gate).
```

- [ ] **Step 3: failure-checks.md**

```markdown
# agent-fleet — failure checks

Evidence: each check comes from a recorded failure in the starwards playbook (2026-08/09).

## Before dispatch (per ticket)
- [ ] Self-contained: a worker with only the code repo can act. No "see design doc" (#1994: 6+ no-op runs).
- [ ] No angle-bracket placeholders, no "TBD". Body is write-once: rewriting after dispatch may not re-trigger the worker.
- [ ] Sized for one worker run. Size, not quality, blocks workers (#2049).
- [ ] No duplicate claim: no open PR already references the issue.
- [ ] Label flip is listed for the owner, never performed by the agent.

## After sync (per run)
- [ ] Stale labels: in-progress label, no PR, quiet > 3 days → watch item, do not count as in flight.
- [ ] Branch behind base ≥ rebase_after → rule 1 priority.
- [ ] Green CI is not scenario evidence: REVIEW pre-read must say what was actually exercised.
- [ ] Junk drafts: bot-authored or draft PRs with no linked card → list under deltas as "unclaimed", never route to them.
- [ ] Label without worker: ready label > 3 days, no PR → blocker.
- [ ] Untracked dispatch: an open PR that no card references → add a card with status `pr #N`, tag the decision `[owner-call]`.
- [ ] Single writer: if state.md's version changed since read, stop and re-run; never merge by hand.
```

- [ ] **Step 4: Commit** — `feat(done): agent-fleet strategy files`

---

### Task 10: `skills/init/SKILL.md` (replaces the smoke stub)

**Files:**
- Modify: `plugins/done/skills/init/SKILL.md` (full rewrite)

- [ ] **Step 1: Write**

```markdown
---
name: init
description: Create .done/ for this project and fill project.md through a short interview. Idempotent; never overwrites. Optionally converts an existing plan file into the card grammar.
argument-hint: "[root]  (default: .)  [--from <legacy plan path>]"
disable-model-invocation: true
---

# init

Root is `$ARGUMENTS` first token or `.`. Run from the project root.

## 1. Scaffold

```
node ${CLAUDE_SKILL_DIR}/../../lib/init-scaffold.mjs <root> --json
```

Report `created` and `already_present`. If `node` is absent: copy each `${CLAUDE_SKILL_DIR}/../../assets/<name>-template.md` to `.done/<name>.md` by hand for `project`, `plan`, `state`, `decisions`, create `.done/log.md` with the contract header from `${CLAUDE_SKILL_DIR}/../../lib/log-append.mjs` (the `LOG_HEADER` constant) and one line `- <date> init v1 manual: rule:- card:- scaffolded .done/`. Never overwrite an existing file.

## 2. Interview — one question at a time, stop when project.md is complete

Skip any question whose answer is already in project.md. Ask in this order:

1. Project name, and the goal in one sentence. (→ `name`, `## Goal`)
2. Where is the work tracked? GitHub issues and PRs, or nowhere / elsewhere? (→ `sync: github` + `sync.repo`, or `sync: self-report`)
3. If GitHub: which label means "ready for a worker", which means "in progress"? (→ `sync.labels.*`)
4. Who does work besides you: agents, people, nobody? (→ `capacity`)
5. If agents or people: how many should be busy at once? (→ `thresholds.max_in_flight`)
6. Which files or surfaces must this plugin never edit? (→ `never`)

Write the answers into the fenced block of `.done/project.md`. Strategy is `agent-fleet` (the only one shipped). Do not ask about gates or rebase_after; defaults apply until the user edits project.md.

## 3. Legacy plan conversion (only with `--from <path>`)

Read the file. For every table row or list item that is a unit of work, draft one card in the grammar at the top of `${CLAUDE_SKILL_DIR}/../../assets/plan-template.md`. Rules:
- Struck (`~~`) or "DONE" rows → omit; list them in the reply as "already done, not carried over".
- "Blocked on" free text → `ext:<text>` and tell the user, so they can replace it with a card id.
- Unknown mode → nearest of DECIDE / DISPATCH / REVIEW / QA / DO; say which you guessed.

Write to `.done/plan.md`, then:

```
node ${CLAUDE_SKILL_DIR}/../../lib/cards.mjs validate .done/plan.md
```

Fix problems the validator lists and re-run until `ok`. Without `node`: check each row against the contract by hand and say `manual:` in the report.

## 4. Report

Files created / present, the project.md block as written, cards converted (count) and rows dropped. End with: `Run /done:what-now`. Nothing is committed.
```

- [ ] **Step 2: Manual check** — in a temp dir with a copy of `plugins/done/test/fixtures/plan-starwards.md` (create it now: convert `C:/Workspace/helios/starwards-design/product/gap-closing-plan.md` M2–M5 open rows into the grammar; done rows omitted; keep as fixture and also add a `cards.test.mjs` case asserting it validates with 0 problems and `derive().ready` includes `M4.1`... adjust ids to what the conversion yields). Run `/done:init . --from plan-starwards.md` in Claude Code; confirm `.done/` files and a validating plan.

- [ ] **Step 3: Commit** — `feat(done): init skill with interview and legacy conversion`

---

### Task 11: `skills/what-now/SKILL.md`

**Files:**
- Create: `plugins/done/skills/what-now/SKILL.md`

- [ ] **Step 1: Write**

```markdown
---
name: what-now
description: Route the next unit of work. Syncs facts, updates .done/ state, applies the strategy ladder, returns exactly one card with its first action prepared. Records scope moves you make mid-run as owner-call decisions.
argument-hint: "[free text: what changed, or a constraint for this run]"
disable-model-invocation: true
---

# what-now

Run from the project root. `.done/` missing → say `Run /done:init` and stop.
`LIB` below means `${CLAUDE_SKILL_DIR}/../../lib`; `STRATEGY` means `${CLAUDE_SKILL_DIR}/../../strategies/<strategy from project.md>`.
Any step marked *script* has a *manual* alternative for when `node` is absent; a manual run's log line uses `--manual` / the `manual:` prefix.

## 1. Read
`.done/project.md`, `.done/state.md` (note its `<!-- version: N -->`), `.done/plan.md` (note its version), the last 10 lines of `.done/log.md`, `STRATEGY/ladder.md`, `STRATEGY/modes.md`, `STRATEGY/failure-checks.md`. `$ARGUMENTS` is user input for this run.

## 2. Sync — facts only
- `sync: github` (*script*): `node LIB/sync-github.mjs --repo <sync.repo> --ready-label <..> --in-progress-label <..> --json > /tmp/done-facts.json`. Exit 2 → treat this run as self-report and say so.
- `sync: self-report` or script unavailable: ask one question: "What changed since <date of last log line>? Merged, opened, ruled, blocked — one line each." The answer is the facts.

## 3. Reconcile facts → plan.md status cells
Merged PR that a card references → `done <date>`. New open PR referencing a card's issue → `pr #N`. Ready label flipped → `dispatched #N`. Ruling from the user → `ruled <date>` + a decisions.md line. Run every "After sync" check in failure-checks.md; each hit becomes a delta line, a watch-list item, or a blocker.
Scope change requested in `$ARGUMENTS` or during the run → add/cut the card now, write `- <date> — <card|scope> — <ruling> — by <owner> [owner-call]` to decisions.md. Do not refuse. Do not run goals.

## 4. Derive (*script*)
```
node LIB/cards.mjs validate .done/plan.md            # fix problems before continuing
node LIB/cards.mjs derive   .done/plan.md --json
node LIB/counts.mjs .done/plan.md --project .done/project.md [--facts /tmp/done-facts.json] --json
```
Manual: READY NOW = open cards with every card-blocker done/ruled and no ext:/owner: blocker; IN FLIGHT = dispatched/pr; DECIDE order = ready DECIDE cards by number of cards transitively blocked on them, desc.

## 5. Route
Apply `ladder.md` top down with the counts. Deviating → state the reason; it goes in the log line.

## 6. Prepare the routed card per `modes.md`
Read the files the card needs before writing the packet, ticket, pre-read or checklist. Before a DISPATCH packet, run the "Before dispatch" checklist and show it ticked. Never flip a label, merge, or edit anything listed under `never:` in project.md; list those actions for the owner.

## 7. Write (*script*, guarded)
Compose the new state.md: `## Snapshot <date>` (counts table, blockers, deltas one per line), `## Watch list` (carry items forward; tick closed ones once), `## Next` (the card and its first action). Then:
```
node LIB/state-write.mjs .done/state.md --expect-version <N read in step 1> --from <tmp file> --json
node LIB/state-write.mjs .done/plan.md  --expect-version <plan version read> --from <tmp file> --json   # only if plan.md changed
node LIB/log-append.mjs . --run what-now --version <new state version> --card <id> --rule <k> --text "<one line>"
```
Exit 2 on a version mismatch → someone else wrote the file; re-read from step 1. Never overwrite by hand.
Manual: bump the stamp yourself only after confirming the file is byte-identical to what you read; append the log line by hand with `manual:`.

## 8. Output — nothing else
```
Deltas: <one line each, or "none">
Blockers: <or "none">
Next: <card id> — <action>
Why: <one sentence: rule k, or the deviation reason>
First action: <the prepared artifact: packet / ticket + label command / pre-read / checklist / step>
```
```

- [ ] **Step 2: Manual check** — in the temp project from Task 10, run `/done:what-now` in Claude Code with `sync: self-report`; confirm state.md version bumped, log.md gained one line, output matches §8. Run it a second time after editing state.md by hand without bumping the stamp in between — expected: the skill reports the mismatch and re-reads.

- [ ] **Step 3: Commit** — `feat(done): what-now skill`

---

### Task 12: `skills/goals/SKILL.md`

**Files:**
- Create: `plugins/done/skills/goals/SKILL.md`

- [ ] **Step 1: Write**

```markdown
---
name: goals
description: Replan. Restates the intended change, sweeps evidence, lists gaps, rewrites milestones and cards in .done/plan.md, reconciles owner-call decisions, records reversals. Confirms with you before writing.
argument-hint: "<the change: new goal, cut, re-prioritise, or 'reconcile'>"
disable-model-invocation: true
---

# goals

Run from the project root. `.done/` missing → `Run /done:init`, stop. `LIB` = `${CLAUDE_SKILL_DIR}/../../lib`.

## 0. Confirmation gate
Read `.done/project.md` (goal), `.done/plan.md`, `.done/decisions.md`, all of `.done/log.md`. Restate `$ARGUMENTS` as one sentence and name the principle or recorded decision it touches. If it contradicts a decisions.md line, ask once: new information, or a reversal? Wait for yes before step 1.

## 1. Sweep
For each area the change touches, read the evidence the user names (code, docs, notes, tracker). One sweep per area; write a two-line summary of each: what exists, what is missing.

## 2. Gaps
Table: `| Gap | Evidence (file/line or fact) | Severity (blocks goal / degrades / cosmetic) | Candidate card(s) |`. No gap without evidence.

## 3. Milestones
Strictly ordered. Each: id, title, one-line exit criterion. Rows inside a milestone are parallel unless blocked.

## 4. Cards
In the grammar at the top of `${CLAUDE_SKILL_DIR}/../../assets/plan-template.md`. Every DISPATCH names an issue (`filed #N`) or states it must be filed; every DECIDE says who consumes the ruling in its Action; cuts go to `## Cut list` with a reason, never deleted.
Reconcile every `[owner-call]` line in decisions.md since the last `goals` log line: each becomes a card, a cut-list line, or is superseded (say which).
Reversal → append `- <date> — <what> — reversed: <old> → <new> — by <owner>` to decisions.md.

## 5. Validate and write (*script*, guarded)
```
node LIB/cards.mjs validate <tmp plan>
node LIB/state-write.mjs .done/plan.md --expect-version <version read in step 0> --from <tmp plan> --json
node LIB/log-append.mjs . --run goals --version <new version> --card - --rule - --text "<one line: what changed>"
```
Update `## Goal` in project.md if the goal itself changed. Manual fallback as in what-now. Nothing is committed.

## 6. Output
Milestones with exit criteria, card count per milestone, cut-list additions, reversals recorded, then `Next: run /done:what-now`.
```

- [ ] **Step 2: Manual check** — in the temp project run `/done:goals "cut M5, add a release milestone"`; confirm confirmation gate fires, plan.md rewrites with bumped version, decisions.md gets a line, log.md one line.

- [ ] **Step 3: Commit; open PR** `feat(done): skills init, what-now, goals and agent-fleet strategy`. Squash-merge.

---

### Task 13: Cowork end-to-end (user-run)

- [ ] **Step 1:** User updates the marketplace in Cowork, runs `/done:init` then `/done:what-now` with `sync: self-report` in a scratch folder. Pastes output.
- [ ] **Step 2:** Any Cowork-only failure (missing env var, `node` absent, path resolution) → `fix(done): ...` PR. Re-test.
- [ ] **Step 3:** In Claude Code, run `/done:init . --from product/gap-closing-plan.md` inside `C:/Workspace/helios/starwards-design` on a branch, then `/done:what-now` with real GitHub sync. Compare the routed card to what the old skill would have chosen; note differences in the PR description of any follow-up fix. Do not commit inside starwards-design unless the user says so.

---

## Verification (end-to-end)

1. `node --test plugins/done/test/` → all green.
2. `node plugins/done/lib/cards.mjs validate plugins/done/assets/plan-template.md` → `ok`.
3. `node scripts/generate-release-config.js && git diff --stat` shows only the expected `done` entries, then revert those generated files (CI owns them).
4. Claude Code: `/done:init`, `/done:what-now` ×2 (second with a forced stale stamp), `/done:goals` in a temp project. Check each `.done/` file against its contract.
5. Cowork: Task 13.
6. Release Please opens `chore(release): done 0.1.0` after the last merge; if not, check for a stale `autorelease: pending` label (repo CLAUDE.md).

## What could still be wrong

- `isMain` on Windows: `process.argv[1]` vs `fileURLToPath` casing/drive-letter differences. Test on this machine in Task 4 step 5 (the CLI validate runs).
- Cowork may not set `CLAUDE_SKILL_DIR` (Task 1 decides).
- `gh pr list --search merged:>=DATE` syntax may need `--search "is:merged merged:>=DATE"`; verify in Task 5 step 5.
- The strict grammar drops information the playbook kept inline (rulings inside cells). Conversion pushes it into decisions.md by hand.
- Self-report and `capacity: none` paths have no real-project evidence.
