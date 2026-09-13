#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, positionalRoot, fail, rel, walk, asOf, envelope, emit, exists, isDirectory,
  DOC_EXTENSIONS,
} from './lib.mjs';

const HELP = `init-scaffold.mjs — create the deterministic scaffolding for a kb-gardener KB.

Usage:
  node init-scaffold.mjs [root] [--kb-path <dir>] [--json] [--as-of YYYY-MM-DD]

Arguments:
  root                    project root the KB lives under (default: ".")

Options:
  --kb-path <dir>         KB directory, relative to root (default: "kb")
  --json                  emit the envelope as JSON instead of text
  --as-of YYYY-MM-DD      date the run is reckoned against (default: today)
  --help

What it creates, only when absent — it NEVER overwrites or truncates an existing file:
  <kb-path>/                    the KB directory
  .kb-gardener/backlog.md       an empty backlog in the assets/backlog-template.md format
                                ("## open" and "## won't do" present, no items)
  .kb-gardener/synonyms.md      an empty synonym list with the header documented in
                                references/discoverability.md
  CLAUDE.md                     created with a knowledge-base section if missing. If it
                                exists, the marker is any mention of the kb path ("kb/",
                                i.e. an existing link into the KB): present -> untouched,
                                absent -> the section is APPENDED. Never rewritten.
                                This is the reference-tree root discoverability.md requires.

What it does NOT do — this is the split, and it is deliberate:
  It does not write <kb-path>/index.md, and it does not touch an existing one. The hub
  needs keyword-signposted entries per references/discoverability.md, which is judgment.
  It does not generate doc prose (that is init step 2, in SKILL.md) and it does not
  decide which source files deserve citations.

Standard topic set — reported as present/missing, never as findings:
  architecture, setup, deployment, runbooks, glossary
  A topic counts as present when an inventoried doc's path or "# H1" contains one of the
  topic's keywords (matched case-insensitively on whole words):
    architecture  architecture, design, overview
    setup         setup, install, installation, getting-started, onboarding
    deployment    deployment, deploy, release, ci, cd
    runbooks      runbook, runbooks, troubleshooting, operations, incident
    glossary      glossary, terminology, vocabulary, terms

Output (CONTRACT §2):
  Facts live under "created", "already_present", "docs" and "topics". "findings" is
  always empty: a missing doc is not a defect, it is work for the generation step.

Idempotency:
  Running twice produces identical filesystem state, and the second run reports
  everything under "already_present".

Exit codes: 0 ran, 2 could not run.
`;

const args = parseArgs(process.argv.slice(2), {
  flags: ['json', 'help', 'allow-self'],
  options: ['kb-path', 'as-of'],
});
if (args.help || process.argv.length === 2) {
  process.stdout.write(HELP);
  process.exit(0);
}

const { date } = asOf(args);
const root = positionalRoot(args);

// This script writes. Scaffolding into the skill library that ships it is never intended —
// it has happened twice, both times as a smoke test run against `.`. Refuse it by default.
const selfRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (path.resolve(root) === selfRoot && !args['allow-self']) {
  fail(
    'refusing to scaffold into the skill library that ships this script — ' +
    'point it at a target project, or pass --allow-self if you really mean it',
  );
}

const kbArg = (args['kb-path'] ?? 'kb').replace(/\\/g, '/').replace(/\/+$/, '');
if (!kbArg) fail('--kb-path must not be empty');
if (path.isAbsolute(kbArg)) fail(`--kb-path must be relative to root: ${kbArg}`);
const kbDir = path.resolve(root, kbArg);
if (!kbDir.startsWith(root + path.sep)) fail(`--kb-path must stay under root: ${kbArg}`);
const kbRel = rel(root, kbDir);

const TOPICS = [
  { topic: 'architecture', keywords: ['architecture', 'design', 'overview'] },
  { topic: 'setup', keywords: ['setup', 'install', 'installation', 'getting-started', 'onboarding'] },
  { topic: 'deployment', keywords: ['deployment', 'deploy', 'release', 'ci', 'cd'] },
  { topic: 'runbooks', keywords: ['runbook', 'runbooks', 'troubleshooting', 'operations', 'incident'] },
  { topic: 'glossary', keywords: ['glossary', 'terminology', 'vocabulary', 'terms'] },
];

const BACKLOG = `# kb-gardener backlog

<!--
FORMAT CONTRACT — both halves of kb-gardener and backlog-merge.mjs depend on this.

Item line:  - [<type>] <target> — <description>
  <type>        one of the types in references/work-item-types.md, in square brackets
  <target>      path relative to this file's directory (the backlog root),
                posix separators. A trailing "/" marks a directory target.
  " — "         em dash surrounded by single spaces; separates target from description
  <description> free prose, single line

won't-do lines carry a trailing attribution: "(human)" or "(kb-gardener)".

A won't-do <description> records why, in three fields, separated by ";":
    attempted: <what was tried>
    observed:  <what actually happened>
    revisit if: <the condition that would change the answer>
The suppression is permanent and nothing else reads it back, so this line is all a
later maintainer has. "observed" is the field that matters: a stated attempt with no
stated outcome hands the next reader a premise nobody checked. "revisit if" gives a
permanent entry its own trip-wire. Entries predating this grammar keep suppressing;
backlog-merge warns and never blocks.

Only two sections, both required, in this order: "## open", "## won't do".
There is no "## done" section — completed items are deleted outright.

Lines that are not item lines (blank lines, this comment, the header) are preserved
verbatim by backlog-merge.mjs.
-->

## open

## won't do
`;

const SYNONYMS = `# kb-gardener synonym list

<!--
One line per synonym group:  canonical: term, term, term
Groups are symmetric — any member matches any other. Multi-word entries match as a
phrase. Ordering is alphabetical by canonical term.

This list only grows, and only through fixes: a synonym is recorded when an
indexing-discoverability fix relied on it. Do not pre-populate it with guesses.
See references/discoverability.md.
-->
`;

const claudeSection = (kb) => `
## Knowledge base

Project documentation lives in \`${kb}/\`. Start at the index:

- [${kb} index](${kb}/index.md) — the knowledge base hub: architecture, setup, deployment,
  runbooks and glossary entries, each linked under its own subject terms.
`;

const created = [];
const alreadyPresent = [];

function ensureDir(dir) {
  const r = rel(root, dir);
  if (exists(dir)) {
    if (!isDirectory(dir)) fail(`exists but is not a directory: ${r}`);
    alreadyPresent.push({ path: `${r}/`, kind: 'directory' });
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  created.push({ path: `${r}/`, kind: 'directory' });
}

function ensureFile(file, content) {
  const r = rel(root, file);
  if (exists(file)) {
    alreadyPresent.push({ path: r, kind: 'file' });
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  created.push({ path: r, kind: 'file' });
}

ensureDir(kbDir);
ensureFile(path.join(root, '.kb-gardener', 'backlog.md'), BACKLOG);
ensureFile(path.join(root, '.kb-gardener', 'synonyms.md'), SYNONYMS);

// kb/index.md: created if absent is NOT this script's job — writing signposted entries is
// judgment. Report its state so the generation step knows whether to author it.
const indexFile = path.join(kbDir, 'index.md');
const indexRel = `${kbRel}/index.md`;
const indexExists = exists(indexFile);
if (indexExists) alreadyPresent.push({ path: indexRel, kind: 'file' });

// CLAUDE.md — the reference-tree root. Marker is a link to the kb path.
const claudeFile = path.join(root, 'CLAUDE.md');
const marker = `${kbRel}/index.md`;
let claudeState;
if (!exists(claudeFile)) {
  fs.writeFileSync(claudeFile, `# CLAUDE.md\n${claudeSection(kbRel)}`, 'utf8');
  created.push({ path: 'CLAUDE.md', kind: 'file' });
  claudeState = 'created';
} else {
  const text = fs.readFileSync(claudeFile, 'utf8');
  if (text.includes(marker) || text.includes(`${kbRel}/`)) {
    alreadyPresent.push({ path: 'CLAUDE.md', kind: 'kb-section' });
    claudeState = 'section-already-present';
  } else {
    fs.appendFileSync(claudeFile, `${text.endsWith('\n') ? '' : '\n'}${claudeSection(kbRel)}`, 'utf8');
    created.push({ path: 'CLAUDE.md', kind: 'kb-section' });
    claudeState = 'section-appended';
  }
}

const docs = walk(kbDir, { extensions: DOC_EXTENSIONS }).map((p) => {
  const full = path.join(kbDir, ...p.split('/'));
  let h1 = null;
  try {
    const m = /^#\s+(.+)$/m.exec(fs.readFileSync(full, 'utf8'));
    if (m) h1 = m[1].trim();
  } catch {
    /* unreadable file still counts as an existing doc */
  }
  return { path: `${kbRel}/${p}`, h1 };
});

const words = (s) => (s ?? '').toLowerCase().split(/[^a-z0-9-]+/i).filter(Boolean);
const topics = TOPICS.map(({ topic, keywords }) => {
  const covered_by = docs
    .filter((d) => {
      const bag = new Set([...words(d.path), ...words(d.h1)]);
      return keywords.some((k) => bag.has(k));
    })
    .map((d) => d.path);
  return { topic, present: covered_by.length > 0, covered_by };
});
const missing = topics.filter((t) => !t.present).map((t) => t.topic);

const env = {
  ...envelope({
    tool: 'init-scaffold',
    root,
    asOf: date,
    findings: [],
    summary: {
      files_scanned: docs.length,
      created: created.length,
      already_present: alreadyPresent.length,
      docs_found: docs.length,
      topics_missing: missing.length,
    },
  }),
  kb_path: kbRel,
  index_doc: { path: indexRel, exists: indexExists },
  claude_md: { path: 'CLAUDE.md', state: claudeState },
  created,
  already_present: alreadyPresent,
  docs,
  topics,
  missing_topics: missing,
};

if (!emit(env, { json: args.json })) process.exit(0);

process.stdout.write(`kb: ${kbRel} under ${env.root}\n\n`);
process.stdout.write(`created (${created.length}):\n`);
for (const c of created) process.stdout.write(`  + ${c.path} (${c.kind})\n`);
process.stdout.write(`\nalready present (${alreadyPresent.length}):\n`);
for (const a of alreadyPresent) process.stdout.write(`  = ${a.path} (${a.kind})\n`);
process.stdout.write(`\nCLAUDE.md: ${claudeState}\n`);
process.stdout.write(`${indexRel}: ${indexExists ? 'present — left as is' : 'absent — write it during init'}\n`);
process.stdout.write(`\nexisting docs (${docs.length}):\n`);
for (const d of docs) process.stdout.write(`  ${d.path}${d.h1 ? `  # ${d.h1}` : ''}\n`);
process.stdout.write('\nstandard topics:\n');
for (const t of topics) {
  process.stdout.write(`  ${t.present ? 'present' : 'MISSING'}\t${t.topic}${t.covered_by.length ? `  (${t.covered_by.join(', ')})` : ''}\n`);
}
process.exit(0);
