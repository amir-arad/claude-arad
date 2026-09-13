#!/usr/bin/env node
import path from 'node:path';
import {
  parseArgs, positionalRoot, asOf, envelope, emit, walk, rel, fail,
  fileRevisions, gitToplevel, isoDate, stripCode, stripFrontmatter, parsePositiveInt, DOC_EXTENSIONS,
} from './lib.mjs';

const HELP = `instruction-growth.mjs — how the agent instruction files grew, revision by revision.

Usage:
  node instruction-growth.mjs [root] [--json] [--as-of YYYY-MM-DD]
                              [--max-revisions <n>]

Arguments:
  root                    repository root (default: ".")

Options:
  --json                  emit the envelope as JSON instead of text
  --as-of YYYY-MM-DD      date the run is reckoned against (default: today).
                          Revisions committed after it are not read.
  --max-revisions <n>     per file, stop after n revisions (default: 500)
  --help

What it covers:
  CLAUDE.md, AGENTS.md and every SKILL.md in the tree -- the files an agent reads
  on every run and a maintainer edits occasionally. The rest of this skill audits
  the knowledge base and has never looked at these, which is backwards: they are
  the file class that actually accumulates, because deleting an instruction whose
  reason is gone risks a regression nobody can bound. See references/rationale-decay.md.

What it reports, and how much to trust each number:
  lines, bullets, table_rows        EXACT. Counted after frontmatter is removed
                                    and fenced blocks blanked.
  normative_sentences_approx        APPROXIMATE, and named so. A regex over
                                    RFC-2119 terms, emphatic markers and a closed
                                    list of imperative verbs.

  The approximation has real, unmeasured bias. It counts "Use of X is deprecated"
  and misses "Every script accepts --as-of"; it cannot see a rule written as a
  table row, which this repo does often, so table_rows is reported beside it as
  the known blind spot rather than folded in.

  What saves it is that the bias is roughly constant across revisions of one file
  under one estimator. The CHANGE between revisions carries signal; the level does
  not. Do not quote the level.

  monotonic is computed on lines, never on the approximation.

This is a fact tool. It emits no findings and always exits 0. A file that grew is
not a defect -- whether the growth was earned is a judgement, and there is no
threshold flag here because a threshold is a score with one bucket.
`;

const TARGETS = new Set(['claude.md', 'agents.md', 'skill.md']);

const RFC2119 = /\b(MUST NOT|MUST|SHALL NOT|SHALL|SHOULD NOT|SHOULD|REQUIRED|PROHIBITED)\b/;
const EMPHATIC = /\b(never|always|do not|don't|avoid|ensure|prefer)\b/i;
const IMPERATIVE = /^(Use|Run|Add|Remove|Prefer|Avoid|Check|Ensure|Write|Read|Keep|Do|Don't|Never|Always|Call|Return|Emit|Set|Make|Skip|Stop|Start|Include|Exclude|Report|Validate|Follow|Treat|Put)\b/;
const isNormative = (s) => RFC2119.test(s) || EMPHATIC.test(s) || IMPERATIVE.test(s.trim());

/**
 * Count the instruction-shaped things in one revision of a markdown file.
 *
 * Frontmatter is dropped because `description:` is routing metadata — rewording it would
 * otherwise read as instruction growth. Fenced blocks are blanked because a pasted 60-line
 * example is not 60 instructions. Table rows are counted but kept out of the sentence count:
 * this repo genuinely encodes rules in tables, so folding them in would inflate the estimate
 * and leaving them silent would hide a known miss.
 */
function countInstructions(text) {
  const body = stripCode(stripFrontmatter(text));
  let lines = 0;
  let bullets = 0;
  let tableRows = 0;
  let normative = 0;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    lines++;
    if (/^\s*#{1,6}\s/.test(line)) continue;
    if (/^\s*\|/.test(line)) { tableRows++; continue; }
    if (/^\s*\[[^\]]+\]:\s/.test(line)) continue;
    if (/^\s*([-*+]|\d+[.)])\s+\S/.test(line)) bullets++;
    const prose = line.replace(/^\s*([-*+]|\d+[.)])\s+/, '');
    for (const sentence of prose.split(/(?<=[.!?])\s+/)) if (isNormative(sentence)) normative++;
  }
  return { lines, bullets, table_rows: tableRows, normative_sentences_approx: normative };
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help')) { console.log(HELP); process.exit(0); }

const args = parseArgs(argv, { flags: ['json', 'help'], options: ['as-of', 'max-revisions'] });
if (args._.length > 1) fail(`unexpected extra argument: ${args._[1]}`);

const root = positionalRoot(args);
const { date, endMs } = asOf(args);
const maxRevisions = args['max-revisions'] ? parsePositiveInt(args['max-revisions'], '--max-revisions') : 500;

const repo = gitToplevel(root);
const paths = walk(root, { extensions: DOC_EXTENSIONS })
  .filter((p) => TARGETS.has(path.basename(p).toLowerCase()))
  .map((p) => rel(root, p))
  .sort();

const files = [];
for (const p of paths) {
  const abs = path.join(root, p);
  const history = repo
    ? fileRevisions(repo, rel(repo, abs), { max: maxRevisions, until: endMs })
    : { revisions: [], available: false, truncated: false, skipped_after_as_of: 0 };

  const revisions = history.revisions.map((rev) => ({
    sha: rev.sha,
    date: isoDate(rev.ts),
    ...countInstructions(rev.text),
  }));

  const first = revisions[0];
  const last = revisions[revisions.length - 1];
  const shrink = [];
  for (let i = 1; i < revisions.length; i++) {
    if (revisions[i].lines < revisions[i - 1].lines) shrink.push(revisions[i].sha);
  }
  files.push({
    path: p,
    git_history: history.available && revisions.length > 0,
    revision_count: revisions.length,
    first_lines: first?.lines ?? null,
    last_lines: last?.lines ?? null,
    net_growth_lines: first && last ? last.lines - first.lines : null,
    growth_per_revision_lines: first && last && revisions.length > 1
      ? Number(((last.lines - first.lines) / (revisions.length - 1)).toFixed(2))
      : null,
    net_growth_instructions_approx: first && last
      ? last.normative_sentences_approx - first.normative_sentences_approx
      : null,
    monotonic: revisions.length > 1 ? shrink.length === 0 : null,
    shrink_revisions: shrink,
    truncated: Boolean(history.truncated),
    revisions,
  });
}

const withHistory = files.filter((f) => f.git_history);
const env = {
  ...envelope({
    tool: 'instruction-growth',
    root,
    asOf: date,
    findings: [],
    summary: {
      files_analyzed: files.length,
      files_with_history: withHistory.length,
      revisions_total: files.reduce((n, f) => n + f.revision_count, 0),
      monotonic_files: withHistory.filter((f) => f.monotonic === true).length,
      git_history: Boolean(repo),
    },
  }),
  instruction_count_is_approximate: true,
  files,
};
if (!repo) env.notes = ['not a git repository — no history to read'];

if (!emit(env, { json: args.json })) process.exit(0);

process.stdout.write(`${files.length} instruction file(s) under ${env.root}\n\n`);
for (const f of files) {
  if (!f.git_history) { process.stdout.write(`${f.path}\n  no git history\n\n`); continue; }
  const rate = f.growth_per_revision_lines === null ? 'n/a' : `${f.growth_per_revision_lines}/revision`;
  process.stdout.write(`${f.path}\n`);
  process.stdout.write(
    `  ${f.revision_count} revision(s)   lines ${f.first_lines} -> ${f.last_lines}`
    + ` (${f.net_growth_lines >= 0 ? '+' : ''}${f.net_growth_lines}, ${rate})\n`,
  );
  const last = f.revisions[f.revisions.length - 1];
  process.stdout.write(
    `  bullets ${last.bullets}   table rows ${last.table_rows}`
    + `   instructions~ ${last.normative_sentences_approx}\n`,
  );
  if (f.monotonic === true) {
    process.stdout.write('  never shrank across its history\n');
  } else if (f.monotonic === false) {
    process.stdout.write(`  shrank at ${f.shrink_revisions.length} revision(s)\n`);
  }
  if (f.truncated) process.stdout.write(`  (stopped at ${maxRevisions} revisions)\n`);
  process.stdout.write('\n');
}
process.stdout.write(
  'lines, bullets and table rows are exact. instructions~ is an approximation whose bias is\n'
  + 'unmeasured: read its change between revisions, not its level. Rules written as table rows\n'
  + 'are not in it — that is what the table row count is doing next to it.\n',
);
process.exit(0);
