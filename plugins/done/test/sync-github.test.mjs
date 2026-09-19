import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
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
