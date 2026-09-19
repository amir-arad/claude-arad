#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
import { parseArgs, fail, emit, isMain, todayIso, doneDir, exists } from './lib.mjs';

const LOG_HEADER = `<!-- FORMAT CONTRACT (done plugin)\nAppend-only. Written only by lib/log-append.mjs and lib/state-write.mjs. One line per run:\n- YYYY-MM-DD <run> v<N> [manual: ]<rule:k | deviation:"reason"> card:<id> <one line>\nv<N> is the version the run wrote: state.md for what-now, plan.md for goals, 1 for init.\n-->\n# Log\n\n`;

export function formatLogLine({ date, run, version, rule, deviation, card, text, manual = false }) {
  if (/[\r\n]/.test(text)) throw new Error('log text must not contain a newline');
  const why = deviation ? `deviation:${JSON.stringify(deviation)}` : `rule:${rule ?? '-'}`;
  return `- ${date} ${run} v${version} ${manual ? 'manual: ' : ''}${why} card:${card || '-'} ${text}`;
}

export function appendLog(root, line) {
  const file = path.join(doneDir(root), 'log.md');
  if (!exists(file)) fs.writeFileSync(file, LOG_HEADER);
  fs.appendFileSync(file, line + '\n');
  return file;
}

const HELP = `log-append.mjs — append one run line to .done/log.md.
Usage: node log-append.mjs <root> --run <what-now|goals|init> --version N --card <id|-> (--rule k | --deviation "why") --text "one line" [--manual] [--as-of D] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help', 'manual'], options: ['run', 'version', 'card', 'rule', 'deviation', 'text', 'as-of'] });
  if (args.help || !args._[0] || !args.run || !args.text) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  let line;
  try { line = formatLogLine({ date: todayIso(args), run: args.run, version: args.version ?? '-', rule: args.rule, deviation: args.deviation, card: args.card, text: args.text, manual: !!args.manual }); }
  catch (e) { fail(e.message, 1); }
  const file = appendLog(args._[0], line);
  emit({ ok: true, file, line }, { json: true });
}
