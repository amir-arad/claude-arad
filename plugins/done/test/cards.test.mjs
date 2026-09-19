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
  assert.deepEqual(d.done, ['M1.2', 'M2.1']);  // ruled counts as settled, like done
  assert.ok(d.ready.includes('M2.4'));
  assert.ok(!d.ready.includes('M2.3'));       // blocked on in-flight M2.2
  assert.ok(!d.ready.includes('M2.5'));       // blocked on open M2.4
  assert.ok(!d.ready.includes('M2.6'));       // ext blocker never auto-clears
  assert.ok(!d.ready.includes('M2.7'));       // owner blocker never auto-clears
  assert.deepEqual(d.blocked['M2.3'], ['M2.2']);
  assert.deepEqual(d.decideOrder, ['M2.4']);  // M2.5 not ready; M2.1 ruled
});

test('parsePlan accepts CRLF line endings', () => {
  const p = parsePlan(read('plan-valid.md').replace(/\r?\n/g, '\r\n'));
  assert.deepEqual(p.problems, []);
  assert.equal(p.milestones[1].cards.length, 7);
});
