#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { parseArgs, fail, emit, isMain } from './lib.mjs';

export const SEP = '\x1f';
const REF_RE = /#(\d+)/g;

// git log only: in Cowork, git status reports host CRLF files as modified.
export function buildGitFacts({ root, since, logText }) {
  const commits = logText.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, date, subject] = line.split(SEP);
    return { sha, date, subject, refs: [...subject.matchAll(REF_RE)].map((m) => Number(m[1])) };
  });
  return { source: 'git', root, since, commits, errors: [] };
}

const HELP = `sync-git.mjs — local git facts for /done:what-now-done.
Usage: node sync-git.mjs <root> [--since YYYY-MM-DD] [--limit N]
Output is always JSON: commits since the date (sha, date, subject, #N refs). Reads git log only.
Exit: 0 facts, 1 usage, 2 not a git repository or git missing.
`;

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['since', 'limit'] });
  if (args.help || !args._[0]) { process.stdout.write(HELP); process.exit(args.help ? 0 : 1); }
  const root = args._[0];
  const since = args.since ?? new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  let logText;
  try {
    logText = execFileSync('git', ['-C', root, 'log', `--since=${since} 00:00`, `-n`, String(args.limit ?? 200), `--format=%h${SEP}%as${SEP}%s`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { fail(`git log failed: ${e.stderr?.toString().trim() || e.message}`, 2); }
  emit(buildGitFacts({ root, since, logText }), { json: true });
}
