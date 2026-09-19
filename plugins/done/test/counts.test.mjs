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

test('counts accepts git facts without blockers', () => {
  const facts = { source: 'git', commits: [{ sha: 'a', date: '2026-09-14', subject: 'x', refs: [] }], errors: [] };
  const c = counts({ derived: derive(plan), plan, facts, project: { thresholds: {} } });
  assert.deepEqual(c.blockers, []);
});
