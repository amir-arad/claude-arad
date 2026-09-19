import { test } from 'node:test';
import fs from 'node:fs'; import os from 'node:os';
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

test('CLI --since includes commits made earlier the same day', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'done-git-'));
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
  g('init', '-q');
  const today = new Date().toISOString().slice(0, 10);
  execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'seed (#1)'],
    { env: { ...process.env, GIT_AUTHOR_DATE: `${today}T00:00:05Z`, GIT_COMMITTER_DATE: `${today}T00:00:05Z` } });
  const out = JSON.parse(execFileSync(process.execPath, [path.join(here, '..', 'lib', 'sync-git.mjs'), dir, '--since', today], { encoding: 'utf8' }));
  assert.equal(out.commits.length, 1);
});
