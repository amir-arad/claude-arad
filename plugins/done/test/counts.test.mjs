import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parsePlan, derive } from '../lib/cards.mjs';
import { counts } from '../lib/counts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const plan = parsePlan(fs.readFileSync(path.join(here, 'fixtures', 'plan-valid.md'), 'utf8'));

test('counts without facts', () => {
  const c = counts({ derived: derive(plan), plan, facts: null });
  assert.deepEqual(c, { awaiting_gate: 1, ready_review: 0, ready_decide: 1, ready_qa: 0, ready_do: 0, ready_agent: [], blockers: [] });
});

test('counts surfaces fact blockers', () => {
  const facts = { duplicateClaims: [{ issue: 2131, prs: [1, 2] }], errors: ['boom'] };
  const c = counts({ derived: derive(plan), plan, facts });
  assert.deepEqual(c.blockers, ['duplicate claim: issue #2131 has PRs #1, #2', 'sync error: boom']);
});

test('counts accepts git facts without blockers', () => {
  const facts = { source: 'git', commits: [{ sha: 'a', date: '2026-09-14', subject: 'x', refs: [] }], errors: [] };
  const c = counts({ derived: derive(plan), plan, facts });
  assert.deepEqual(c.blockers, []);
});

test('agent-owned ready cards leave the user counts', () => {
  const p = parsePlan(`<!-- version: 1 -->
# Plan

## M1 — x
Exit: y.

| Card | Action | Mode | Owner | Blocked on | Status |
|---|---|---|---|---|---|
| M1.1 | probe | DO | agent |  | open |
| M1.2 | fix | DO |  |  | open |
`);
  const c = counts({ derived: derive(p), plan: p, facts: null });
  assert.equal(c.ready_do, 1);
  assert.deepEqual(c.ready_agent, ['M1.1']);
});
