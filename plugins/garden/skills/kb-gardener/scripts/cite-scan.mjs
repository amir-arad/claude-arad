#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, positionalRoot, rel, walk, asOf, finding, envelope, gate, emit, exists, CODE_EXTENSIONS,
  DOC_EXTENSIONS,
} from './lib.mjs';

const SCAN_EXTENSIONS = CODE_EXTENSIONS;

const HELP = `cite-scan.mjs — facts about citations from source code to KB docs (code -> doc).

Usage:
  node cite-scan.mjs [root] [--json] [--as-of YYYY-MM-DD] [--min-severity <level>]

Arguments:
  root                    directory to scan (default: ".")

Options:
  --json                  emit the envelope as JSON instead of text
  --as-of YYYY-MM-DD      date the run is reckoned against (default: today)
  --min-severity <level>  gate for the exit code: critical|high|medium|low|info
                          (default: low)
  --help

What counts as a citation:
  A path-like token ending in ".md" that appears IN A COMMENT, in either form:
    markdown/doc-comment link   [text](../docs/auth.md)  or  <docs/auth.md>
    bare path                   docs/auth.md, ./auth.md, src/x/README.md
  Comments only — line comments (//, #, --, ;) and block/doc comments (/* */,
  """), detected heuristically rather than by per-language parsing. A path in
  executable code or a string literal is a filename the program operates on, not
  a pointer a reader is meant to follow: tool source is full of them (runtime
  artifacts it writes, filenames it looks for, examples in its own --help text)
  and every one of those read as a citation before this rule existed.
  Excluded: paths under a dot-directory (.cache/index.json is runtime state a program
  writes, not a doc), absolute URLs (any token preceded by ":" or "/"), and any token where
  ".md" is part of a longer word (.mdx, .mdown). A trailing "#anchor" is dropped.
  Markdown files are never scanned, so doc->doc links are out of scope.

Resolution:
  A cited path is resolved against the citing file's directory, then each ancestor
  directory up to the root, then the root itself — a script under pkg/scripts/
  citing "references/x.md" means pkg/references/x.md. Failing all of those, the
  path is matched as a suffix of a real doc in the tree. Only a path matching
  nothing anywhere is a dead citation.

Per-directory counts:
  Granularity is the immediate parent directory of each scanned source file,
  relative to root, posix separators ("." for root). Every directory that holds at
  least one scanned source file is listed, including those with zero citations.

Output (CONTRACT §2):
  Facts live under "citations", "dead_citations" and "directories". This script
  judges nothing about them — an uncited directory is a fact, not a finding.
  The one exception is a dead citation: source code naming a KB path that is not
  there is a detected defect with a file, line and column, so each one is ALSO
  emitted as a finding with rule "dead-citation", category "referential",
  severity "high".

Exit codes: 0 clean, 1 findings at or above --min-severity, 2 could not run.
`;

const args = parseArgs(process.argv.slice(2), {
  flags: ['json', 'help'],
  options: ['as-of', 'min-severity'],
});
if (args.help || process.argv.length === 2) {
  process.stdout.write(HELP);
  process.exit(0);
}

const { date } = asOf(args);
const minSeverity = args['min-severity'] ?? 'low';
const root = positionalRoot(args);

const CITATION = /(?:\[[^\]\n]*\]\(\s*([^)\s]+?\.md(?:#[^)\s]*)?)\s*\)|(?<![\w.#:/-])((?:\.{1,2}\/|\/)?(?:[\w.@+-]+\/)*[\w.@+-]+\.md)(?![\w-]))/g;

const parentDir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.');

/**
 * The comment regions of one line, as [start, end) column ranges.
 *
 * Heuristic, not a parser: a comment opener that is itself inside a string literal will
 * fool it. That trade is deliberate and it runs in the safe direction — the failure is a
 * citation reported in a file that had none, not a real one missed, and the alternative
 * (scanning whole lines) reported 86 citations on this repository of which zero were real.
 */
function commentRanges(line, inBlock) {
  const ranges = [];
  let block = inBlock;
  let i = 0;
  let start = block ? 0 : -1;
  let quote = null;
  while (i < line.length) {
    const two = line.slice(i, i + 2);
    if (block) {
      if (two === '*/') {
        ranges.push([start, i]);
        block = false;
        start = -1;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    const ch = line[i];
    if (quote) {
      if (ch === '\\') i += 2;
      else {
        if (ch === quote) quote = null;
        i += 1;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (two === '/*') {
      block = true;
      start = i;
      i += 2;
      continue;
    }
    if (two === '//' || two === '--' || ch === '#' || ch === ';') {
      ranges.push([i, line.length]);
      return { ranges, block };
    }
    i += 1;
  }
  if (block) ranges.push([start === -1 ? 0 : start, line.length]);
  return { ranges, block };
}

/** Every doc in the tree indexed by basename, for suffix matching. */
function docIndex(rootDir) {
  const byBase = new Map();
  for (const d of walk(rootDir, { extensions: DOC_EXTENSIONS })) {
    const base = d.slice(d.lastIndexOf('/') + 1);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(d);
  }
  return byBase;
}

/**
 * Resolve a cited path: the citing file's directory, then every ancestor up to the root,
 * then the root, then a suffix match against the doc index.
 * @returns {string|null} path relative to root
 */
function resolveCitation(rootDir, citingRel, target, byBase) {
  const clean = target.replace(/^\//, '');
  const bases = [];
  let dir = parentDir(citingRel);
  while (dir !== '.') {
    bases.push(dir);
    dir = parentDir(dir);
  }
  bases.push('.');
  for (const b of bases) {
    const candidate = b === '.' ? clean : `${b}/${clean}`;
    const full = path.resolve(rootDir, ...candidate.split('/'));
    if (exists(full)) return rel(rootDir, full);
  }
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  const matches = (byBase.get(base) ?? []).filter((d) => d === clean || d.endsWith(`/${clean}`));
  return matches.length === 1 ? matches[0] : null;
}

const files = walk(root, { extensions: SCAN_EXTENSIONS });
const docs = docIndex(root);
const citations = [];
const counts = new Map();
for (const f of files) counts.set(parentDir(f), 0);

for (const relFile of files) {
  const full = path.join(root, ...relFile.split('/'));
  let text;
  try {
    text = fs.readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  if (!text.includes('.md') || text.includes('\0')) continue;
  const dir = parentDir(relFile);
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const { ranges, block } = commentRanges(lines[i], inBlock);
    inBlock = block;
    if (!ranges.length) continue;
    CITATION.lastIndex = 0;
    let m;
    while ((m = CITATION.exec(lines[i]))) {
      const at = m.index;
      if (!ranges.some(([a, b]) => at >= a && at < b)) continue;
      const raw = (m[1] ?? m[2]).trim();
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) continue;
      // A path under a dot-directory is tool state a program writes at runtime, not a doc
      // a reader can follow. Documentation does not live in .cache/ or .venv/.
      if (/(^|\/)\.[^/]+\//.test(raw)) continue;
      const target = resolveCitation(root, relFile, raw.split('#')[0], docs);
      citations.push({
        source: relFile,
        line: i + 1,
        column: at + 1,
        raw,
        target,
        dead: target === null,
      });
      counts.set(dir, counts.get(dir) + 1);
    }
  }
}

const directories = [...counts.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([directory, citations_found]) => ({ directory, citations_found }));
const dead = citations.filter((c) => c.dead);

// Severity "high": the citation names a concrete path that does not exist, the location is
// exact, and the fix is unambiguous — no judgement is being smuggled in by calling it a
// problem. It is not "critical": a stale pointer in a comment misleads a reader, it does
// not break a build.
const findings = dead.map((c) =>
  finding({
    path: c.source,
    line: c.line,
    column: c.column,
    severity: 'high',
    category: 'referential',
    rule: 'dead-citation',
    message: `cites ${c.raw}, which does not exist`,
    details: { cited: c.raw },
  }));

const env = {
  ...envelope({
    tool: 'cite-scan',
    root,
    asOf: date,
    findings,
    summary: {
      files_scanned: files.length,
      citations: citations.length,
      dead_citations: dead.length,
      directories: directories.length,
    },
  }),
  citations,
  dead_citations: dead,
  directories,
};

if (!emit(env, { json: args.json })) process.exit(gate(findings, minSeverity));

process.stdout.write(`scanned ${files.length} source files under ${env.root}\n`);
process.stdout.write(`citations: ${citations.length} (${dead.length} dead)\n\n`);
for (const c of citations) {
  process.stdout.write(`${c.source}:${c.line}:${c.column} -> ${c.raw}${c.dead ? '  [dead]' : ''}\n`);
}
process.stdout.write('\ncitations per directory:\n');
for (const d of directories) process.stdout.write(`  ${d.citations_found}\t${d.directory}\n`);
process.exit(gate(findings, minSeverity));
