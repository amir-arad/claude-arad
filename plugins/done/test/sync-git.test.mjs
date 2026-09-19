import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { buildGitFacts, SEP } from '../lib/sync-git.mjs';

test('buildGitFacts parses log records and issue refs', () => {
  const log = [
    ['abc1234', '2026-09-14', 'fix(done): smoke v3 (#9)'],
    ['def5678', '2026-09-13', 'feat: registry, closes #2131 and #2140'],
    ['0a0b0c0', '2026-09-12', 'chore: no refs'],
  ].map((r) => r.join(SEP)).join('\n') + '\n';
  const f = buildGitFacts({ root: '/r', since: '2026-09-01', logText: log });
  assert.equal(f.source, 'git');
  assert.equal(f.commits.length, 3);
  assert.deepEqual(f.commits[0], { sha: 'abc1234', date: '2026-09-14', subject: 'fix(done): smoke v3 (#9)', refs: [9] });
  assert.deepEqual(f.commits[1].refs, [2131, 2140]);
  assert.deepEqual(f.commits[2].refs, []);
  assert.deepEqual(f.errors, []);
});

test('CLI reads this repository', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = JSON.parse(execFileSync(process.execPath, [path.join(here, '..', 'lib', 'sync-git.mjs'), path.join(here, '..', '..', '..'), '--since', '2000-01-01'], { encoding: 'utf8' }));
  assert.equal(out.source, 'git');
  assert.ok(out.commits.length > 0);
});
