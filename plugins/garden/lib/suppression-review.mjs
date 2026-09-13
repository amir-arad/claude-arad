#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, positionalRoot, asOf, finding, envelope, gate, emit, exists, fail,
  parseBacklog, parseReason, fileRevisions, gitToplevel, rel, isoDate,
  resolveBacklogPath, isStateDir, LEGACY_STATE_DIR,
} from './lib.mjs';

const HELP = `suppression-review.mjs — read a backlog's "won't do" section back.

Usage:
  node suppression-review.mjs [root] [--backlog <file>] [--json]
                              [--as-of YYYY-MM-DD] [--min-severity <level>]

Arguments:
  root                    repository root (default: ".")

Options:
  --backlog <file>        backlog markdown file
                          (default: <root>/.garden/backlog.md, or the legacy
                          .kb-gardener/backlog.md when only that exists)
  --json                  emit the envelope as JSON instead of text
  --as-of YYYY-MM-DD      date the run is reckoned against (default: today)
  --min-severity <level>  gate for the exit code: critical|high|medium|low|info
                          (default: low)
  --help

Why this exists:
  "won't do" is permanent by design and, until this script, nothing ever read it
  back. Every entry suppresses its type on its target in every future survey, for
  as long as the backlog lives, and the only record of why is one line of prose
  that no code inspected. An entry whose reason has expired keeps suppressing and
  says nothing about it. See references/rationale-decay.md.

What it reports:
  stranded-suppression    a file target that no longer exists. The entry cannot
                          match anything, so the finding it was written to
                          silence returns under the target's new name -- and the
                          stale line stays behind muting a path nobody has.
  unreasoned-suppression  a reason recording no observed outcome. This is the
                          shape measured as worse than no reason at all: it hands
                          the next reader a premise that was never checked.

  Everything else is a fact, not a finding: the subtree each directory target
  mutes, each entry's "revisit if" condition, and how long each has been there.

What it will not do:
  It never edits the backlog and never resolves a "revisit if" condition. That
  condition is English written for a human, and deciding it has been met is a
  deletion decision. Recording a rationale is free and safe; acting on one is
  neither, and the deletion path keeps a person in it.
`;

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help')) { console.log(HELP); process.exit(0); }

const args = parseArgs(argv, {
  flags: ['json', 'help'],
  options: ['backlog', 'as-of', 'min-severity'],
});
if (args._.length > 1) fail(`unexpected extra argument: ${args._[1]}`);

const root = positionalRoot(args);
const { date, endMs } = asOf(args);
const minSeverity = args['min-severity'] ?? 'low';

const backlogPath = args.backlog
  ? path.resolve(args.backlog)
  : resolveBacklogPath(root);
if (path.basename(path.dirname(backlogPath)) === LEGACY_STATE_DIR) {
  process.stderr.write(`note: reading legacy ${LEGACY_STATE_DIR}/ — run /garden:init to migrate it to .garden/\n`);
}
if (!exists(backlogPath)) {
  console.log(`no backlog at ${backlogPath} — nothing to review`);
  process.exit(0);
}

// Targets are relative to the repo root, not to the backlog file's own directory. Same rule
// backlog-merge.mjs follows, and for the same reason: source-discoverability items name
// paths above .garden/.
const dir = path.dirname(backlogPath);
const base = isStateDir(path.basename(dir)) ? path.dirname(dir) : dir;

const text = fs.readFileSync(backlogPath, 'utf8');
const parsed = parseBacklog(text, base, { strict: true });

/**
 * When each entry was first recorded, from the backlog file's own history.
 *
 * Age is in commits touching the backlog, not days: days would make the answer depend on how
 * often someone happened to commit rather than on how much has happened to this backlog.
 */
const repo = gitToplevel(base);
const history = repo ? fileRevisions(repo, rel(repo, backlogPath), { until: endMs }) : null;
const firstSeen = new Map();
if (history?.available) {
  history.revisions.forEach((rev, i) => {
    const snap = parseBacklog(rev.text, base);
    for (const key of snap.wont.keys()) {
      if (!firstSeen.has(key)) firstSeen.set(key, { index: i, sha: rev.sha, ts: rev.ts });
    }
  });
}
const revisionCount = history?.available ? history.revisions.length : 0;

const findings = [];
const suppressions = [];

for (const [key, item] of parsed.wont) {
  const reason = parseReason(item.description);
  const isDir = item.normalized.endsWith('/');
  const abs = path.resolve(base, item.normalized);
  const present = exists(abs);

  // Only file targets can be stranded. A directory target that no longer exists is the
  // normal end state of a subtree that was deleted on purpose, and re-raising it as a defect
  // would punish exactly the cleanup the KB wanted.
  if (!isDir && !present) {
    findings.push(finding({
      path: item.normalized,
      line: item.line,
      severity: 'medium',
      category: 'referential',
      rule: 'stranded-suppression',
      message: `won't-do target no longer exists, so this entry can never match again`,
      details: { type: item.type, backlog: rel(base, backlogPath) },
    }));
  }

  if (!reason.observed) {
    findings.push(finding({
      path: item.normalized,
      line: item.line,
      severity: 'low',
      category: 'semantic',
      rule: 'unreasoned-suppression',
      message: 'won\'t-do reason records no observed outcome',
      details: { type: item.type, reason: reason.raw, backlog: rel(base, backlogPath) },
    }));
  }

  // What a directory target currently mutes. Reported as a count of what is under it, which
  // is the number nobody sees when they write one line to silence a subtree.
  let mutes = null;
  if (isDir && present) {
    let n = 0;
    const stack = [abs];
    while (stack.length) {
      for (const entry of fs.readdirSync(stack.pop(), { withFileTypes: true })) {
        const full = path.join(entry.parentPath ?? abs, entry.name);
        if (entry.isDirectory()) { if (!entry.name.startsWith('.')) stack.push(full); }
        else n++;
      }
    }
    mutes = n;
  }

  const seen = firstSeen.get(key);
  suppressions.push({
    type: item.type,
    target: item.normalized,
    directory_target: isDir,
    target_exists: present,
    mutes_files: mutes,
    attempted: reason.attempted,
    observed: reason.observed,
    revisit_if: reason.revisitIf,
    attribution: reason.attribution,
    first_seen_revision: seen ? seen.index + 1 : null,
    first_seen_date: seen ? isoDate(seen.ts) : null,
    age_revisions: seen ? revisionCount - seen.index - 1 : null,
    line: item.line,
  });
}

findings.sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));

const env = {
  ...envelope({
    tool: 'suppression-review',
    root: base,
    asOf: date,
    findings,
    summary: {
      suppressions_total: suppressions.length,
      with_observed_outcome: suppressions.filter((s) => s.observed).length,
      with_revisit_condition: suppressions.filter((s) => s.revisit_if).length,
      directory_targets: suppressions.filter((s) => s.directory_target).length,
      backlog_revisions: revisionCount,
      git_history: Boolean(history?.available),
    },
  }),
  backlog: rel(base, backlogPath),
  suppressions,
};
if (!history?.available) {
  env.notes = ['backlog file has no readable git history — every age is null'];
}

if (!emit(env, { json: args.json })) process.exit(gate(findings, minSeverity));

process.stdout.write(`${suppressions.length} suppression(s) in ${env.backlog}\n`);
if (!suppressions.length) {
  process.stdout.write('nothing is being suppressed\n');
  process.exit(gate(findings, minSeverity));
}
process.stdout.write(
  `${env.summary.with_observed_outcome} record an observed outcome, `
  + `${env.summary.with_revisit_condition} carry a "revisit if" condition\n\n`,
);
for (const s of suppressions) {
  const age = s.age_revisions === null ? '' : `  (${s.age_revisions} revision(s) old)`;
  process.stdout.write(`[${s.type}] ${s.target}${age}\n`);
  if (!s.target_exists) process.stdout.write('  STRANDED — target does not exist\n');
  if (s.mutes_files !== null) process.stdout.write(`  mutes ${s.mutes_files} file(s) beneath it\n`);
  if (s.observed) process.stdout.write(`  observed: ${s.observed}\n`);
  else process.stdout.write('  NO OBSERVED OUTCOME — nothing records what actually happened\n');
  if (s.revisit_if) process.stdout.write(`  revisit if: ${s.revisit_if}  <- your call, never mine\n`);
}
if (!history?.available) process.stdout.write('\nno git history for the backlog: ages unavailable\n');
process.stdout.write('\nNothing was changed. Every entry above still suppresses.\n');
process.exit(gate(findings, minSeverity));
