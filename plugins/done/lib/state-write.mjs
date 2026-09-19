#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
import { parseArgs, fail, emit, readText, readVersion, isMain, todayIso, writeAtomic } from './lib.mjs';
import { parsePlan } from './cards.mjs';
import { appendLog } from './log-append.mjs';
export function guardedWrite({ file, expectVersion, content, root, date }) {
  const current = readText(file);
  const have = current === null ? null : readVersion(current);
  if (have !== expectVersion) return { ok: false, error: `version mismatch: file is at ${have}, expected ${expectVersion}` };
  const next = (have ?? 0) + 1;
  let body = readVersion(content) === null ? content : content.replace(/^<!-- version: \d+ -->[ \t]*\r?\n?/m, '');
  const archived = [];
  const logLines = [];
  const base = path.basename(file);
  if (base === 'plan.md') {
    const plan = parsePlan(body);
    if (plan.problems.length) return { ok: false, error: `plan invalid:\n${plan.problems.join('\n')}` };
    const drop = new Set();
    for (const m of plan.milestones) for (const c of m.cards) if (c.status.kind === 'done' || c.status.kind === 'ruled') {
      drop.add(c.line - 1); archived.push(c.id);
      logLines.push(`- ${date} archive card:${c.id} ${c.status.kind} ${c.status.ref} — ${c.action}`);
    }
    body = body.split(/\r?\n/).filter((_, i) => !drop.has(i)).join('\n');
  }
  if (base === 'state.md') {
    // A watch item ticked this run stays visible once; it is dropped when it was already ticked in the file on disk.
    const tickedBefore = new Set((current ?? '').split(/\r?\n/).filter((l) => /^- \[x\] /i.test(l)).map((l) => l.trim()));
    body = body.split(/\r?\n/).filter((l) => !tickedBefore.has(l.trim())).join('\n');
  }
  writeAtomic(file, `<!-- version: ${next} -->\n${body}`);
  for (const line of logLines) appendLog(root, line);
  return { ok: true, file, version: next, archived };
}
const HELP = `state-write.mjs — write a .done file only if its version stamp is what you read.
Usage: node state-write.mjs <file> --expect-version N [--from <content-file>] [--root <dir>] [--as-of D] [--json]
Content comes from --from or stdin. Exit 2 on version mismatch or invalid plan; nothing is written.
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['expect-version', 'from', 'root', 'as-of'] });
  if (args.help || !args._[0] || args['expect-version'] === undefined) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  const file = path.resolve(args._[0]);
  const content = args.from ? readText(args.from) : fs.readFileSync(0, 'utf8');
  if (content === null) fail(`cannot read ${args.from}`, 1);
  const root = args.root ?? path.resolve(path.dirname(file), '..');
  const r = guardedWrite({ file, expectVersion: Number(args['expect-version']), content, root, date: todayIso(args) });
  if (!r.ok) fail(r.error, 2);
  emit(r, { json: true });
}
