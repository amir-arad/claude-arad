// Shared helpers for done scripts. Copied from plugins/garden/lib/lib.mjs where noted; plugins install independently.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function fail(message, code = 2) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const res = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { res._.push(...argv.slice(i + 1)); break; }
    if (!a.startsWith('--')) { res._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (flags.includes(key)) { res[key] = true; continue; }
    if (!options.includes(key)) fail(`unknown option --${key}`, 1);
    const val = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (val === undefined) fail(`--${key} needs a value`, 1);
    res[key] = val;
  }
  return res;
}

export function emit(obj, { json } = {}) {
  if (json) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

export const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
export const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
export const doneDir = (root) => path.join(root, '.done');
export const isMain = (metaUrl) => !!process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(metaUrl));

// Temp file + rename: Cowork allows rename over an existing file but blocks unlink until a per-session grant.
export function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export const VERSION_RE = /^<!-- version: (\d+) -->[ \t]*$/m;
export function readVersion(text) {
  const m = VERSION_RE.exec(text);
  return m ? Number(m[1]) : null;
}
export function bumpVersion(text) {
  const v = readVersion(text);
  if (v === null) return `<!-- version: 1 -->\n${text}`;
  return text.replace(VERSION_RE, `<!-- version: ${v + 1} -->`);
}

export function todayIso(args) {
  if (args['as-of']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args['as-of'])) fail('--as-of must be YYYY-MM-DD', 1);
    return args['as-of'];
  }
  return new Date().toISOString().slice(0, 10);
}

const NUMERIC = /^-?\d+(\.\d+)?$/;
export function parseProject(text) {
  const block = /```\r?\n([\s\S]*?)```/.exec(text);
  const lines = (block ? block[1] : text).split(/\r?\n/);
  const out = { name: '', root: '.', strategy: 'agent-fleet', sync: { kind: 'git', labels: {} }, capacity: 'none', thresholds: {}, gates: {}, never: [], extra: {} };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    const num = NUMERIC.test(val) ? Number(val) : val;
    if (key === 'sync') out.sync.kind = val || 'git';
    else if (key === 'sync.repo') out.sync.repo = val;
    else if (key.startsWith('sync.labels.')) out.sync.labels[key.slice(12)] = val;
    else if (key.startsWith('thresholds.')) out.thresholds[key.slice(11)] = num;
    else if (key.startsWith('gates.')) out.gates[key.slice(6)] = val;
    else if (key === 'never') out.never = val.split(',').map((s) => s.trim()).filter(Boolean);
    else if (['name', 'root', 'strategy', 'capacity'].includes(key)) out[key] = val;
    else out.extra[key] = num;
  }
  return out;
}
