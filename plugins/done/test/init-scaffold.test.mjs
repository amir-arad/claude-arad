import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { scaffold } from '../lib/init-scaffold.mjs';
import { spawnSync } from 'node:child_process';

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

test('CLI refuses the home directory', () => {
  const script = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'lib', 'init-scaffold.mjs');
  const r = spawnSync(process.execPath, [script, os.homedir()], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a project folder/);
});
