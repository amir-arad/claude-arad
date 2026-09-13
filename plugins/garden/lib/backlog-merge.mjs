#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, fail, exists, normalizePath, pathKey, readFindingsPayload,
  parseBacklog, parseReason, BACKLOG_ITEM, isStateDir,
} from './lib.mjs';
import { classify, RULE_TO_TYPE, DISCARDED_RULES, ADVISORY_RULES } from './rule-types.mjs';

const HELP = `backlog-merge.mjs — merge CONTRACT findings into a garden backlog.

Usage:
  node backlog-merge.mjs --backlog <file> --findings <file|-> [--stdout] [--dry-run] [--json]

Options:
  --backlog <file>    backlog markdown file (assets/backlog-template.md format)
  --findings <file>   findings JSON; "-" reads stdin. Either a CONTRACT §2 envelope
                      { "root": ..., "findings": [ ... ] } or a bare array of
                      CONTRACT §1 finding records.
  --stdout            write the merged backlog to stdout; do not touch the file
  --dry-run           report what would change; do not touch the file
  --json              emit the merge summary as JSON instead of text
  --migrate-types     one-shot: rewrite item types in an existing backlog that were
                      recorded under a rule name instead of a taxonomy type. Ignores
                      --findings; honours --dry-run and --stdout
  --rules             print the rule classification table and exit
  --help

Default behaviour rewrites the backlog file in place and prints a summary.

Finding -> backlog item:
  finding.rule    -> item [type], via lib/rule-types.mjs
  finding.path    -> item target, re-relativised from the envelope root to the
                     backlog root: the backlog file's directory, or its parent when
                     that directory is ".garden" or ".kb-gardener" (the standard location, where
                     targets name paths in the repository above it)
  finding.message -> item description

  Every rule is classified in lib/rule-types.mjs as one of:
    mapped        -> one of the six types in references/work-item-types.md
    discarded     -> deliberately not a work item (ownership, frontmatter
                     metadata, repository scaffolding, external URLs)
    advisory      -> a real signal no type's done criteria fit; counted for
                     survey to judge by hand, never written as an item
    unclassified  -> a bug in rule-types.mjs. The finding is DROPPED and
                     reported, never written with the rule name as its type:
                     an item whose type has no done criteria cannot be verified
                     by tend, and looks valid while being unverifiable.

  Run with --rules to print the whole classification table.

Reconciliation:
  Two findings on the same path that map to the same item type collapse into
  ONE item — a dead link and a dead anchor in the same doc are one piece of
  work, not two.

Identity:
  key = [type] + target normalised to posix separators, relative to the backlog
  root (above), compared case-insensitively and ignoring a trailing "/".
  Original spelling is preserved in the output line.
  A finding matching an existing "## open" item is dropped — the open item keeps
  its position and wording. A finding matching a "## won't do" item is dropped.
  A "won't do" target ending in "/" is a directory and suppresses same-type
  findings on every path beneath it. Surviving findings append to "## open".
  Non-item lines are preserved verbatim.

Migrating an existing backlog:
  Item identity is [type] + target, so when a rule starts mapping to a taxonomy type
  its old "won't do" entries stop suppressing and every finding they silenced comes
  back. Run --migrate-types once against a backlog written by an older version:

    node backlog-merge.mjs --backlog <file> --migrate-types --dry-run
    node backlog-merge.mjs --backlog <file> --migrate-types

  It rewrites "- [code-churn] x.md — …" into "- [stale-doc] x.md — …" in BOTH sections,
  drops the leading "../" from targets written when the base was the .garden
  directory rather than the repo root, collapses items that become duplicates, and
  leaves lines it cannot map untouched while reporting them. Non-item lines are
  preserved verbatim.

Exit codes: 0 on success, 1 when a finding carried a rule no table classifies (the
merge still happened; classify the rule in lib/rule-types.mjs), 2 on error.
This is a mutation tool, not a detector.
`;

const ITEM = BACKLOG_ITEM;

const args = parseArgs(process.argv.slice(2), {
  flags: ['stdout', 'dry-run', 'json', 'rules', 'migrate-types', 'help'],
  options: ['backlog', 'findings'],
});
if (args.help || process.argv.length === 2) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (args.rules) {
  const table = {
    mapped: Object.fromEntries(RULE_TO_TYPE),
    discarded: Object.fromEntries(DISCARDED_RULES),
    advisory: Object.fromEntries(ADVISORY_RULES),
  };
  if (args.json) process.stdout.write(`${JSON.stringify(table, null, 2)}\n`);
  else {
    for (const [kind, rules] of Object.entries(table)) {
      process.stdout.write(`${kind}:\n`);
      for (const [rule, v] of Object.entries(rules)) process.stdout.write(`  ${rule} -> ${v}\n`);
    }
  }
  process.exit(0);
}
if (args._.length) fail(`unexpected argument: ${args._[0]}`);
if (!args.backlog) fail('--backlog is required');
if (!args.findings && !args['migrate-types']) fail('--findings is required');

const backlogPath = path.resolve(args.backlog);
if (!exists(backlogPath) || !fs.statSync(backlogPath).isFile()) {
  fail(`backlog file not found: ${args.backlog}`);
}
/**
 * The base every item target is relative to.
 *
 * The backlog lives at <repo>/.garden/backlog.md, but its targets name things in the
 * repository — `kb/index.md`, `src/auth/` — so the base is the repo root, not the file's own
 * directory. Relativising to the directory produced `../kb/index.md` for every item, which
 * contradicts assets/backlog-template.md and silently broke hand-written `won't do` lines
 * that followed the documented convention.
 */
const dir = path.dirname(backlogPath);
const root = isStateDir(path.basename(dir)) ? path.dirname(dir) : dir;
const text = fs.readFileSync(backlogPath, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/);

const parsed = parseBacklog(text, root, { strict: true });
const { openStart, wontStart } = parsed;

const openKeys = new Set(parsed.open.keys());
const wontKeys = new Set(parsed.wont.keys());
const wontDirs = [];
for (const item of parsed.wont.values()) {
  if (item.normalized.endsWith('/')) {
    wontDirs.push({ type: item.type.toLowerCase(), prefix: item.normalized.toLowerCase() });
  }
}

/**
 * Report which "won't do" reasons record an outcome — and never act on the answer.
 *
 * A suppression is permanent and nothing else ever reads it back, so its reason is the whole
 * of what a later maintainer has to go on. A reason naming an attempt but no outcome is the
 * one shape measured as worse than no reason at all (references/rationale-decay.md), because it
 * hands the next reader a premise to build on that was never checked.
 *
 * This warns and does not gate. Every entry keeps suppressing exactly as before: an existing
 * backlog was written under the old grammar and breaking it to enforce a new one would be a
 * regression dressed as a fix. Exit 1 stays reserved for unclassified rules.
 */
const reasonQuality = { total: wontKeys.size, with_outcome: 0, without_outcome: [] };
for (const item of parsed.wont.values()) {
  const reason = parseReason(item.description);
  if (reason.observed) reasonQuality.with_outcome++;
  else reasonQuality.without_outcome.push({ type: item.type, target: item.normalized, line: item.line });
}

const TAXONOMY = new Set([
  'stale-doc', 'broken-reference', 'duplication',
  'indexing-discoverability', 'source-discoverability', 're-balancing',
]);

if (args['migrate-types']) {
  // Retype in place. This runs over both sections deliberately: a "won't do" entry that
  // keeps an obsolete type silently stops suppressing, which is the failure mode that
  // makes a type change expensive rather than free.
  const retyped = [];
  const rebased = [];
  const untouched = [];
  const collapsed = [];
  const seen = new Set();
  const outLines = [];
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (!m) {
      outLines.push(line);
      continue;
    }
    const [, type, rawTarget, description] = m;
    // Targets written before the base was corrected carry one leading "../" from the
    // state directory. Left alone they never match a finding again.
    const target = root !== dir && rawTarget.startsWith('../') ? rawTarget.slice(3) : rawTarget;
    if (target !== rawTarget) rebased.push({ from: rawTarget, to: target });
    let newType = type;
    if (!TAXONOMY.has(type)) {
      const c = classify(type);
      if (c.kind === 'mapped') {
        newType = c.type;
        retyped.push({ from: type, to: newType, target });
      } else {
        untouched.push({ type, target, reason: c.reason ?? 'not a taxonomy type and not a known rule' });
      }
    }
    const key = pathKey(newType, target);
    if (seen.has(key)) {
      collapsed.push({ type: newType, target });
      continue;
    }
    seen.add(key);
    outLines.push(newType === type && target === rawTarget
      ? line
      : `- [${newType}] ${target} — ${description}`);
  }
  const migrated = outLines.join(eol);
  const willWrite = !args.stdout && !args['dry-run'];
  if (args.stdout) process.stdout.write(migrated);
  else if (willWrite) fs.writeFileSync(backlogPath, migrated);

  const report = {
    backlog: normalizePath(backlogPath, root),
    retyped,
    rebased,
    collapsed,
    untouched,
    written: willWrite ? backlogPath : null,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (!args.stdout) {
    const verb = willWrite ? '' : ' (dry run)';
    process.stdout.write(`${retyped.length} retyped, ${rebased.length} rebased, ${collapsed.length} collapsed, ${untouched.length} left alone${verb}\n`);
    for (const r of retyped) process.stdout.write(`  [${r.from}] -> [${r.to}] ${r.target}\n`);
    for (const r of rebased) process.stdout.write(`  ${r.from} -> ${r.to} (dropped the state-directory-relative prefix)\n`);
    for (const c of collapsed) process.stdout.write(`  collapsed duplicate [${c.type}] ${c.target}\n`);
    for (const u of untouched) process.stdout.write(`  left alone [${u.type}] ${u.target} — ${u.reason}\n`);
  }
  process.exit(0);
}

// readFindingsPayload re-relativises every finding path from the payload's root to the
// backlog file's directory. Without that, a finding from a run rooted elsewhere lands under
// the wrong name and never matches its own "won't do" line.
const { findings: sourceFindings } = readFindingsPayload(args.findings, root);

const dropped = { discarded: [], advisory: [], unclassified: [] };
const findings = [];
for (const [i, f] of sourceFindings.entries()) {
  if (typeof f.rule !== 'string' || !f.rule.trim()) fail(`findings[${i}] needs a string "rule"`);
  const rule = f.rule.trim();
  const target = f.path;
  const c = classify(rule);
  if (c.kind !== 'mapped') {
    dropped[c.kind].push({ rule, target, reason: c.reason ?? 'no entry in lib/rule-types.mjs' });
    continue;
  }
  findings.push({
    type: c.type,
    rule,
    target,
    description: String(f.message ?? '').trim(),
  });
}

const added = [];
const suppressed = [];
const byKey = new Map();
for (const f of findings) {
  const norm = f.target;
  const key = pathKey(f.type, norm);
  let reason = null;
  if (openKeys.has(key)) reason = 'already-open';
  else if (wontKeys.has(key)) reason = 'wont-do';
  else if (wontDirs.some((d) => d.type === f.type.toLowerCase() && norm.toLowerCase().startsWith(d.prefix))) {
    reason = 'wont-do-directory';
  } else if (byKey.has(key)) reason = 'reconciled';
  if (reason) {
    const s = { type: f.type, target: norm, rule: f.rule, reason };
    if (reason === 'reconciled') byKey.get(key).reconciled_with.push(f.rule);
    suppressed.push(s);
    continue;
  }
  const item = { type: f.type, target: norm, description: f.description, rule: f.rule, reconciled_with: [] };
  byKey.set(key, item);
  added.push(item);
}

let insertAt = wontStart;
while (insertAt > openStart + 1 && lines[insertAt - 1].trim() === '') insertAt--;
const newLines = added.map((a) => `- [${a.type}] ${a.target} — ${a.description}`);
const out = [...lines.slice(0, insertAt), ...newLines, ...lines.slice(insertAt)];
const merged = out.join(eol);

const write = !args.stdout && !args['dry-run'];
if (args.stdout) process.stdout.write(merged);
else if (write) fs.writeFileSync(backlogPath, merged);

// One line per rule, not per finding. A sweep over a large KB emits hundreds of findings
// that are correctly not work items; listing each one buries the handful that are.
const tally = (rows) => {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.rule)) by.set(r.rule, { rule: r.rule, count: 0, reason: r.reason, targets: [] });
    const e = by.get(r.rule);
    e.count += 1;
    if (e.targets.length < 3) e.targets.push(r.target);
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
};

const summary = {
  backlog: normalizePath(backlogPath, root),
  findings: sourceFindings.length,
  added,
  suppressed,
  discarded: tally(dropped.discarded),
  advisory: tally(dropped.advisory),
  unclassified: tally(dropped.unclassified),
  reason_quality: reasonQuality,
  written: write ? backlogPath : null,
};
if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
else if (!args.stdout) {
  const verb = write ? '' : ' (dry run)';
  const notItems = dropped.discarded.length + dropped.advisory.length + dropped.unclassified.length;
  process.stdout.write(
    `${sourceFindings.length} findings: ${added.length} added, ${suppressed.length} suppressed, `
    + `${notItems} not work items${verb}\n`,
  );
  for (const a of added) process.stdout.write(`  added [${a.type}] ${a.target}\n`);
  const group = (label, rows) => {
    for (const r of rows) {
      const eg = r.targets.slice(0, 2).join(', ');
      const more = r.count > r.targets.length ? ', …' : '';
      process.stdout.write(`  ${label} ${r.rule} ×${r.count} — ${r.reason} (${eg}${more})\n`);
    }
  };
  group('advisory', summary.advisory);
  group('discarded', summary.discarded);
  group('UNCLASSIFIED', summary.unclassified);
  if (summary.unclassified.length) {
    process.stdout.write('  ^ dropped, not written: add each rule to lib/rule-types.mjs\n');
  }

  // Suppressed findings are the expected steady state of a repeat sweep — the backlog
  // already holds the item. Per-item detail stays in --json.
  const bad = suppressed.filter((x) => x.reason !== 'already-open');
  for (const x of bad) process.stdout.write(`  suppressed [${x.type}] ${x.target} (${x.reason})\n`);
  const open = suppressed.length - bad.length;
  if (open) process.stdout.write(`  suppressed ${open} finding(s) already open in the backlog\n`);
}

// stderr, not stdout: this is a fact about the backlog rather than a result of the merge,
// and --stdout writes the merged file there.
if (reasonQuality.without_outcome.length) {
  const n = reasonQuality.without_outcome.length;
  process.stderr.write(
    `WARN ${n} of ${reasonQuality.total} "won't do" reason(s) record no observed outcome. `
    + 'They still suppress; nothing here changes that.\n',
  );
  for (const x of reasonQuality.without_outcome) {
    process.stderr.write(`  [${x.type}] ${x.target} (line ${x.line})\n`);
  }
  process.stderr.write('  Grammar: "attempted: … ; observed: … ; revisit if: …" — '
    + 'see references/work-item-types.md. Review them with suppression-review.mjs.\n');
}

// A rule nothing classifies means findings were dropped. Reporting it in the summary was
// not enough on its own: nothing downstream read the summary, so a fallthrough stayed
// invisible until a human tried to tend an item that could not be verified. Exit non-zero
// so a pipeline notices. The merge itself already happened; this is not an error exit.
if (dropped.unclassified.length) process.exit(1);
