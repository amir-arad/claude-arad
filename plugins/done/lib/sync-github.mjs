#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, fail, emit, isMain, readText } from './lib.mjs';

const REF_RE = /(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s+#(\d+)/gi;
const DAY = 86400000;
const MAX_AGE = 15 * 60000;  // raw files must come from this run, not an earlier one

// Accepts `gh --json` shape and GitHub REST shape (what an MCP connector returns).
const login = (x) => x.author?.login ?? x.user?.login ?? '';
const updated = (x) => x.updatedAt ?? x.updated_at;
const labelNames = (i) => (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name));

export function buildFacts({ repo, since, now = new Date(), mergedRaw, openRaw, issuesRaw, labels }) {
  const refs = (body) => [...(body || '').matchAll(REF_RE)].map((m) => Number(m[1]));
  const openPrs = openRaw.map((p) => ({
    number: p.number, title: p.title, author: login(p), updatedAt: updated(p),
    isBot: /\[bot\]$|^copilot|^dependabot/i.test(login(p)), headRef: p.headRefName ?? p.head?.ref, behindBy: p.behindBy ?? null,
    refs: refs(p.body), isDraft: !!(p.isDraft ?? p.draft),
  }));
  const prsByIssue = new Map();
  for (const p of openPrs) for (const n of p.refs) (prsByIssue.get(n) ?? prsByIssue.set(n, []).get(n)).push(p.number);
  const readyNoPr = [], inProgress = [], staleLabels = [];
  for (const i of issuesRaw) {
    if (i.pull_request) continue;  // REST lists PRs among issues
    const names = labelNames(i);
    const prs = prsByIssue.get(i.number) ?? [];
    if (labels.ready && names.includes(labels.ready) && prs.length === 0) readyNoPr.push({ number: i.number, title: i.title, updatedAt: updated(i) });
    if (labels.in_progress && names.includes(labels.in_progress)) {
      inProgress.push({ number: i.number, title: i.title, updatedAt: updated(i), prs });
      if (prs.length === 0 && now - new Date(updated(i)) > 3 * DAY) staleLabels.push({ number: i.number, label: labels.in_progress, updatedAt: updated(i) });
    }
  }
  const duplicateClaims = [...prsByIssue].filter(([, prs]) => prs.length > 1).map(([issue, prs]) => ({ issue, prs: prs.sort((a, b) => a - b) }));
  return {
    source: 'github', repo, since,
    merged: mergedRaw
      .filter((p) => (p.mergedAt ?? p.merged_at) && (p.mergedAt ?? p.merged_at).slice(0, 10) >= since)
      .map((p) => ({ number: p.number, title: p.title, mergedAt: p.mergedAt ?? p.merged_at, author: login(p) })),
    openPrs: openPrs.map(({ refs, ...p }) => p),
    readyNoPr, inProgress, duplicateClaims, staleLabels, errors: [],
  };
}

function gh(args) {
  try { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (e) { fail(`gh unavailable: ${e.stderr?.toString().trim() || e.message}`, 2); }
}

function fromDir(dir, name) {
  const file = path.join(dir, name);
  const text = readText(file);
  if (text === null) fail(`missing ${file}`, 1);
  if (Date.now() - fs.statSync(file).mtimeMs > MAX_AGE) fail(`stale ${file}: save it again from the connector in this run`, 3);
  try { return JSON.parse(text); } catch (e) { fail(`${name} is not JSON: ${e.message}`, 1); }
}

const HELP = `sync-github.mjs — GitHub facts for /done:what-now-done.
Usage:
  node sync-github.mjs --repo owner/repo [--ready-label L] [--in-progress-label L] [--since YYYY-MM-DD]
  node sync-github.mjs --from-dir <dir> [--repo owner/repo] [labels, --since as above]
--from-dir reads merged.json, open.json, issues.json (gh or GitHub REST shape, e.g. saved from an MCP connector).
Output is always JSON. behindBy is null: neither source gives it cheaply.
Exit: 0 facts, 1 usage, 2 gh unavailable (use --from-dir or git facts only), 3 a --from-dir file is older than 15 minutes.
`;

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['repo', 'ready-label', 'in-progress-label', 'since', 'from-dir'] });
  if (args.help || (!args.repo && !args['from-dir'])) { process.stdout.write(HELP); process.exit(args.help ? 0 : 1); }
  const since = args.since ?? new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10);
  const labels = { ready: args['ready-label'] ?? 'agent-ready', in_progress: args['in-progress-label'] ?? 'agent-in-progress' };
  const raw = args['from-dir']
    ? { mergedRaw: fromDir(args['from-dir'], 'merged.json'), openRaw: fromDir(args['from-dir'], 'open.json'), issuesRaw: fromDir(args['from-dir'], 'issues.json') }
    : {
      mergedRaw: gh(['pr', 'list', '--repo', args.repo, '--state', 'merged', '--limit', '30', '--search', `merged:>=${since}`, '--json', 'number,title,mergedAt,author']),
      openRaw: gh(['pr', 'list', '--repo', args.repo, '--state', 'open', '--limit', '50', '--json', 'number,title,author,updatedAt,headRefName,body,isDraft']),
      issuesRaw: gh(['issue', 'list', '--repo', args.repo, '--state', 'open', '--limit', '100', '--json', 'number,title,labels,updatedAt']),
    };
  emit(buildFacts({ repo: args.repo ?? null, since, labels, ...raw }), { json: true });
}
