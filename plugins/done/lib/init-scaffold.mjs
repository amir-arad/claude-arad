#!/usr/bin/env node
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseArgs, fail, emit, isMain, todayIso, doneDir, exists } from './lib.mjs';
import { appendLog, formatLogLine } from './log-append.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(here, '..', 'assets');
const FILES = ['project', 'plan', 'state', 'decisions'];

export function scaffold(root, date) {
  const dir = doneDir(root);
  const res = { done_dir: dir, created: [], already_present: [] };
  if (exists(dir)) res.already_present.push(dir); else { fs.mkdirSync(dir, { recursive: true }); res.created.push(dir); }
  for (const name of FILES) {
    const target = path.join(dir, `${name}.md`);
    if (exists(target)) { res.already_present.push(target); continue; }
    fs.writeFileSync(target, fs.readFileSync(path.join(ASSETS, `${name}-template.md`), 'utf8'));
    res.created.push(target);
  }
  const log = path.join(dir, 'log.md');
  if (exists(log)) res.already_present.push(log);
  else { appendLog(root, formatLogLine({ date, run: 'init', version: 1, rule: '-', card: '-', text: 'scaffolded .done/' })); res.created.push(log); }
  return res;
}

const HELP = `init-scaffold.mjs — create .done/ from the plugin templates. Never overwrites.
Usage: node init-scaffold.mjs <root> [--as-of D] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['as-of'] });
  if (args.help || !args._[0]) { process.stdout.write(HELP); process.exit(0); }
  const root = path.resolve(args._[0]);
  if (root === path.resolve(here, '..')) fail('refusing to scaffold into the plugin that ships this script', 2);
  // Cowork: the session home and ~/mnt/outputs do not hold the user's project (spec §8).
  const home = os.homedir();
  if (root === path.resolve(home) || root === path.resolve(home, 'mnt', 'outputs')) fail(`refusing to scaffold into ${root}: not a project folder`, 2);
  if (!exists(root)) fail(`${root} does not exist`, 1);
  emit(scaffold(root, todayIso(args)), { json: true });
}
