import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { guardedWrite } from '../lib/state-write.mjs';
import { parsePlan } from '../lib/cards.mjs';

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

test('archiving a card removes it from other cards\' Blocked on, so the plan still validates', () => {
  const root = tmp(); const dir = path.join(root, '.done'); fs.mkdirSync(dir);
  const f = path.join(dir, 'plan.md');
  const plan = `<!-- version: 1 -->\n# Plan\n\n## M1 — A\n| Card | Action | Mode | Owner | Blocked on | Status |\n|---|---|---|---|---|---|\n| M1.1 | pick | DECIDE |  |  | ruled 2026-09-14 |\n| M1.2 | build | DO |  | M1.1, M1.3 | open |\n| M1.3 | other | DO |  |  | open |\n| M1.4 | last | DO |  | M1.1 | open |\n`;
  fs.writeFileSync(f, plan);
  const r = guardedWrite({ file: f, expectVersion: 1, content: plan, root, date: '2026-09-15' });
  assert.equal(r.ok, true); assert.deepEqual(r.archived, ['M1.1']);
  const after = parsePlan(fs.readFileSync(f, 'utf8'));
  assert.deepEqual(after.problems, []);
  const byId = Object.fromEntries(after.milestones[0].cards.map((c) => [c.id, c.blockedOn.map((b) => b.ref)]));
  assert.deepEqual(byId, { 'M1.2': ['M1.3'], 'M1.3': [], 'M1.4': [] });
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

test('keeps a watch item ticked this run, leaves no temp file', () => {
  const root = tmp(); const dir = path.join(root, '.done'); fs.mkdirSync(dir);
  const f = path.join(dir, 'state.md');
  fs.writeFileSync(f, '<!-- version: 1 -->\n# State\n\n## Watch list\n- [ ] new (added 2026-09-02; close when x)\n');
  const r = guardedWrite({ file: f, expectVersion: 1, content: '# State\n\n## Watch list\n- [x] new (added 2026-09-02; close when x)\n', root, date: '2026-09-15' });
  assert.equal(r.ok, true);
  assert.ok(fs.readFileSync(f, 'utf8').includes('[x] new'));
  assert.deepEqual(fs.readdirSync(dir), ['state.md']);
});
