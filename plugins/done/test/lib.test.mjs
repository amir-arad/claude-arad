import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { parseArgs, readVersion, bumpVersion, parseProject, writeAtomic } from '../lib/lib.mjs';

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
  assert.equal(p.strategy, 'agent-fleet');
  assert.equal(p.sync.kind, 'github');
  assert.equal(p.sync.repo, 'o/r');
  assert.deepEqual(p.never, ['roadmap.md', 'docs/adr/']);
  // keys from before 0.5 (dispatch, capacity) are kept as extra, not rejected
  assert.equal(p.extra['sync.labels.ready'], 'agent-ready');
  assert.equal(p.extra['thresholds.max_in_flight'], 3);
  assert.equal(p.extra.capacity, 'agents');
  assert.equal(parseProject('```\nname: x\n```').strategy, 'value-ladder');
});

test('parseProject defaults sync to git', () => {
  assert.equal(parseProject('```\nname: x\n```\n').sync.kind, 'git');
});

test('writeAtomic replaces content and leaves no temp file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'done-'));
  const f = path.join(dir, 'a.md');
  writeAtomic(f, 'one');
  writeAtomic(f, 'two');
  assert.equal(fs.readFileSync(f, 'utf8'), 'two');
  assert.deepEqual(fs.readdirSync(dir), ['a.md']);
});
