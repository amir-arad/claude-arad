import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import os from 'node:os'; import { spawnSync } from 'node:child_process';
import { buildFacts } from '../lib/sync-github.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const j = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const labels = { ready: 'agent-ready', in_progress: 'agent-in-progress' };
const now = new Date('2026-09-15T00:00:00Z');

test('buildFacts classifies PRs and issues (gh shape)', () => {
  const f = buildFacts({ repo: 'o/r', since: '2026-09-01', now, labels,
    mergedRaw: j('gh-prs-merged.json'), openRaw: j('gh-prs-open.json'), issuesRaw: j('gh-issues.json') });
  assert.equal(f.source, 'github');
  assert.ok(f.openPrs.some((p) => p.isBot));
  assert.deepEqual(f.duplicateClaims, [{ issue: 2131, prs: [2225, 2226] }]);
  assert.equal(f.readyNoPr.length, 1);
  assert.equal(f.staleLabels.length, 1);
  assert.deepEqual(f.errors, []);
});

test('buildFacts normalises connector (REST) shape', () => {
  const f = buildFacts({ repo: 'o/r', since: '2026-09-01', now, labels,
    mergedRaw: j('rest/merged.json'), openRaw: j('rest/open.json'), issuesRaw: j('rest/issues.json') });
  assert.deepEqual(f.merged, [{ number: 2210, title: 'Fix ammo HUD', mergedAt: '2026-09-10T12:00:00Z', author: 'dev1' }]);
  assert.equal(f.openPrs[1].headRef, 'reg-b');
  assert.equal(f.openPrs[1].isDraft, true);
  assert.equal(f.openPrs[0].author, 'agent1');
  assert.deepEqual(f.duplicateClaims, [{ issue: 2131, prs: [2225, 2226] }]);
  assert.deepEqual(f.readyNoPr.map((i) => i.number), [2140]);  // string labels accepted; PR-issues skipped
});

test('buildFacts drops merged PRs older than since (connector returns unfiltered closed PRs)', () => {
  const f = buildFacts({ repo: 'o/r', since: '2026-09-10', now, labels, openRaw: [], issuesRaw: [],
    mergedRaw: [{ number: 1, title: 'old', merged_at: '2026-09-09T23:00:00Z' }, { number: 2, title: 'new', merged_at: '2026-09-10T01:00:00Z' }] });
  assert.deepEqual(f.merged.map((p) => p.number), [2]);
});

test('CLI --from-dir rejects raw files not saved by this run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'done-gh-'));
  for (const n of ['merged.json', 'open.json', 'issues.json']) fs.writeFileSync(path.join(dir, n), '[]');
  const old = new Date(Date.now() - 60 * 60000);
  fs.utimesSync(path.join(dir, 'merged.json'), old, old);
  const r = spawnSync(process.execPath, [path.join(here, '..', 'lib', 'sync-github.mjs'), '--from-dir', dir, '--repo', 'o/r'], { encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /merged\.json/);
  fs.utimesSync(path.join(dir, 'merged.json'), new Date(), new Date());
  assert.equal(spawnSync(process.execPath, [path.join(here, '..', 'lib', 'sync-github.mjs'), '--from-dir', dir, '--repo', 'o/r'], { encoding: 'utf8' }).status, 0);
});

test('CLI --from-dir unwraps a connector result wrapped in an object', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'done-gh-'));
  const pr = { number: 5, title: 't', state: 'open', user: { login: 'a' }, labels: [], head: { ref: 'b' }, updated_at: '2026-09-19T00:00:00Z' };
  fs.writeFileSync(path.join(dir, 'merged.json'), '[]');
  fs.writeFileSync(path.join(dir, 'open.json'), JSON.stringify({ total_count: 1, items: [pr] }));
  fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify({ total_count: 0 }));
  const run = () => spawnSync(process.execPath, [path.join(here, '..', 'lib', 'sync-github.mjs'), '--from-dir', dir, '--repo', 'o/r'], { encoding: 'utf8' });
  let r = run();
  assert.equal(r.status, 1); assert.match(r.stderr, /issues\.json.*array/);
  fs.writeFileSync(path.join(dir, 'issues.json'), '{"issues": []}');
  r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).openPrs.map((p) => p.number), [5]);
});
