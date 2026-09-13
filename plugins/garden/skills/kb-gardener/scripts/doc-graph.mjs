#!/usr/bin/env node
// The doc link graph: link integrity plus reachability from the root doc.
//
// Merges the two scripts that were once link-checker (doc-drift-detector) and
// orphan-detector (knowledge-ops). Both walked the same tree and both emitted `dead-link`;
// the filesystem-based check here is the stronger of the two, so it is the one that
// survived. The old `orphan-doc` rule is gone entirely: inbound-link counting calls a
// mutually linked island "linked" when nothing outside it points in, and reachability
// does not.
import fs from 'node:fs';
import path from 'node:path';
import {
  DOC_EXTENSIONS, abs, asOf, emit, envelope, fail, finding, gate, headingSlugs, extractLinks,
  parseArgs, parsePositiveInt, readText, rel, resolveTarget, slugify, stripCode, walk,
} from './lib.mjs';

const USAGE = `Usage: node doc-graph.mjs [root] [options]

Check markdown links, anchors, images and duplicate headings, then walk the doc graph
from the root doc and report what a reader cannot reach by following links.

Options:
  --json                 Emit the JSON envelope
  --min-severity LEVEL   Gate: critical|high|medium|low|info (default: low)
  --as-of YYYY-MM-DD     Date the run is reckoned against (default: today)
  --doc-patterns LIST    Comma-separated doc extensions (default: md,markdown,mdown,mkd)
  --scope DIR            Limit the scan to a subdirectory of the root
  --root-doc PATH        Entry point for reachability (default: CLAUDE.md, README.md, index.md)
  --hub-threshold N      Inbound links that make a doc a hub (default: 3)
  --check-external       Also validate external URLs (HTTP HEAD/GET, slower, non-deterministic)
  --help                 Show this message

Rules: dead-link, dead-anchor, duplicate-anchor, unreachable-doc, unreachable-url
Exit codes: 0 = no findings at or above the gate, 1 = findings, 2 = tool error`;

const ROOT_DOC_CANDIDATES = ['CLAUDE.md', 'README.md', 'index.md'];

function docExtensions(arg) {
  if (!arg) return DOC_EXTENSIONS;
  const set = new Set(
    arg.split(',').map((p) => `.${p.trim().replace(/^\*?\./, '').toLowerCase()}`).filter((e) => e !== '.'),
  );
  if (!set.size) fail('--doc-patterns is empty');
  return set;
}

const headingCache = new Map();
function slugsFor(fullPath) {
  if (!headingCache.has(fullPath)) {
    const content = readText(fullPath);
    headingCache.set(fullPath, content === null ? new Set() : headingSlugs(content));
  }
  return headingCache.get(fullPath);
}

function caseInsensitiveMatch(target) {
  const dir = path.dirname(target);
  const name = path.basename(target);
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.toLowerCase() === name.toLowerCase() && entry !== name) return path.join(dir, entry);
    }
  } catch {
    /* directory unreadable */
  }
  return null;
}

async function validateExternal(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'User-Agent': 'kb-gardener' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status < 400) return null;
      if (res.status !== 405 || method === 'GET') return `HTTP ${res.status}`;
    } catch (e) {
      return e.message;
    }
  }
  return 'unreachable';
}

/** Resolve one non-external link. Returns null when valid, else {rule, severity, message}. */
function checkLocal(link, root, docRel) {
  const sourceFull = abs(root, docRel);
  const hash = link.target.indexOf('#');
  const filePart = hash >= 0 ? link.target.slice(0, hash) : link.target;
  const anchor = hash >= 0 ? link.target.slice(hash + 1) : null;

  if (!filePart) {
    if (!anchor) return null;
    if (slugsFor(sourceFull).has(slugify(anchor))) return null;
    return { rule: 'dead-anchor', severity: 'medium', message: `anchor #${anchor} does not exist in this file` };
  }

  const fromDoc = path.resolve(path.dirname(sourceFull), filePart);
  const fromRoot = path.resolve(root, filePart);
  const resolved = fs.existsSync(fromDoc) ? fromDoc : fs.existsSync(fromRoot) ? fromRoot : null;

  if (!resolved) {
    const alt = caseInsensitiveMatch(fromDoc);
    return {
      rule: 'dead-link',
      severity: 'high',
      message: alt
        ? `links to ${filePart}, which does not exist (case mismatch with ${rel(root, alt)})`
        : `links to ${filePart}, which does not exist`,
      details: alt ? { case_mismatch: rel(root, alt) } : undefined,
    };
  }

  if (anchor && DOC_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    if (slugsFor(resolved).has(slugify(anchor))) return null;
    return { rule: 'dead-anchor', severity: 'medium', message: `${filePart} exists but has no anchor #${anchor}` };
  }
  return null;
}

function duplicateAnchorFindings(docRel, content) {
  const seen = new Set();
  const out = [];
  const lines = stripCode(content).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^#{1,6}\s+(.+)/.exec(lines[i]);
    if (!m) continue;
    const slug = slugify(m[1].trim());
    if (!slug) continue;
    if (seen.has(slug)) {
      out.push(finding({
        path: docRel, line: i + 1, column: 1, severity: 'low', category: 'structural',
        rule: 'duplicate-anchor', message: `heading slug #${slug} is defined more than once`,
      }));
    } else seen.add(slug);
  }
  return out;
}

// --- the doc graph ---------------------------------------------------------

/**
 * Edges from each doc to the KB docs it links to. Only links a reader can click and that
 * land on another markdown file count — see references/discoverability.md for the full
 * rule. Code spans, fenced blocks and HTML comments are already blanked by extractLinks.
 */
function buildEdges(root, docs, extensions) {
  const known = new Set(docs);
  const outbound = new Map();
  const inbound = new Map();
  for (const d of docs) {
    outbound.set(d, []);
    inbound.set(d, []);
  }
  for (const docRel of docs) {
    const content = readText(abs(root, docRel));
    if (content === null) continue;
    for (const link of extractLinks(content)) {
      // 'anchor' is same-document navigation, 'image' is not a route, 'external' leaves.
      if (link.kind !== 'local_file' && link.kind !== 'cross_doc_anchor') continue;
      const target = resolveTarget(docRel, link.target);
      if (!target || target === docRel) continue;
      if (!extensions.has(path.extname(target).toLowerCase())) continue;
      if (!known.has(target)) continue; // dead links are checkLocal's business, not the graph's
      if (!outbound.get(docRel).includes(target)) {
        outbound.get(docRel).push(target);
        inbound.get(target).push(docRel);
      }
    }
  }
  return { outbound, inbound };
}

/** Resolve the reachability entry point. Returns null when the KB has none. */
function resolveRootDoc(explicit, docs) {
  if (explicit) {
    const norm = explicit.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!docs.includes(norm)) fail(`--root-doc ${explicit} is not one of the scanned docs`);
    return norm;
  }
  return ROOT_DOC_CANDIDATES.find((c) => docs.includes(c)) ?? null;
}

/** Breadth-first from the root. Reachability is transitive — that is the whole point. */
function reachableFrom(rootDoc, outbound) {
  const seen = new Set([rootDoc]);
  const queue = [rootDoc];
  while (queue.length) {
    for (const next of outbound.get(queue.shift()) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function render(env) {
  const s = env.summary;
  const lines = [
    'Doc Graph Report',
    '='.repeat(60),
    `Root:     ${env.root}`,
    `As of:    ${env.as_of}`,
    `Files:    ${s.files_scanned} scanned, ${s.files_with_findings} with findings`,
    `Links:    ${s.links_checked} checked, ${s.total_edges} doc-to-doc edges`,
    s.root_doc
      ? `Reach:    ${s.reachable_docs}/${s.files_scanned} reachable from ${s.root_doc}`
      : 'Reach:    not computed — no root doc found',
    `Findings: ${s.total}`,
    '',
  ];
  if (!env.findings.length) {
    lines.push('No issues found.');
    return lines.join('\n');
  }
  const byFile = new Map();
  for (const f of env.findings) {
    if (!byFile.has(f.path)) byFile.set(f.path, []);
    byFile.get(f.path).push(f);
  }
  for (const [file, group] of [...byFile].sort()) {
    lines.push(`  ${file}`);
    for (const f of group) {
      lines.push(`    ${f.line}:${f.column}  ${f.severity.padEnd(8)} ${f.rule.padEnd(16)} ${f.message}`);
    }
    lines.push('');
  }
  lines.push('BY RULE:', '-'.repeat(40));
  for (const [rule, n] of Object.entries(env.summary.by_rule).sort()) lines.push(`  ${rule.padEnd(20)} ${n}`);
  return lines.join('\n');
}

// --- entry point -----------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

const args = parseArgs(argv, {
  flags: ['json', 'check-external'],
  options: ['min-severity', 'as-of', 'doc-patterns', 'scope', 'root-doc', 'hub-threshold'],
});
if (args._.length > 1) fail(`unexpected extra argument: ${args._[1]}`);

const when = asOf(args);
const root = path.resolve(args._[0] ?? '.');
if (!fs.existsSync(root)) fail(`${root} does not exist`);
if (!fs.statSync(root).isDirectory()) fail(`${root} is not a directory`);

const scope = String(args.scope ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
if (scope) {
  const scopeFull = abs(root, scope);
  if (!fs.existsSync(scopeFull) || !fs.statSync(scopeFull).isDirectory()) fail(`--scope ${scope} is not a directory under the root`);
}

const extensions = docExtensions(args['doc-patterns']);
const docs = walk(scope ? abs(root, scope) : root, { extensions })
  .map((f) => (scope ? `${scope}/${f}` : f))
  .sort();

const findings = [];
let linksChecked = 0;
for (const docRel of docs) {
  const content = readText(abs(root, docRel));
  if (content === null) continue;
  findings.push(...duplicateAnchorFindings(docRel, content));
  for (const link of extractLinks(content)) {
    linksChecked += 1;
    if (link.kind === 'external') {
      if (!args['check-external']) continue;
      const err = await validateExternal(link.target);
      if (err) {
        findings.push(finding({
          path: docRel, line: link.line, column: link.column, severity: 'medium',
          category: 'referential', rule: 'unreachable-url',
          message: `external link ${link.target} failed: ${err}`,
          details: { target: link.target },
        }));
      }
      continue;
    }
    const problem = checkLocal(link, root, docRel);
    if (!problem) continue;
    findings.push(finding({
      path: docRel, line: link.line, column: link.column, severity: problem.severity,
      category: 'referential', rule: problem.rule, message: problem.message,
      details: { target: link.target, kind: link.kind, ...(problem.details ?? {}) },
    }));
  }
}

// --- reachability ----------------------------------------------------------

const hubThreshold = args['hub-threshold'] === undefined
  ? 3
  : parsePositiveInt(args['hub-threshold'], '--hub-threshold');
const { outbound, inbound } = buildEdges(root, docs, extensions);
const rootDoc = resolveRootDoc(args['root-doc'], docs);

let reachable = null;
if (rootDoc) {
  reachable = reachableFrom(rootDoc, outbound);
  for (const docRel of docs) {
    if (reachable.has(docRel)) continue;
    findings.push(finding({
      path: docRel, line: 1, column: 1, severity: 'medium', category: 'structural',
      rule: 'unreachable-doc',
      message: `no path of links reaches this doc from ${rootDoc}`,
      details: {
        root_doc: rootDoc,
        inbound_links: inbound.get(docRel).length,
        fix_type: 'manual',
      },
    }));
  }
}

const hubs = docs
  .filter((d) => inbound.get(d).length >= hubThreshold)
  .map((d) => ({ path: d, inbound_links: inbound.get(d).length }))
  .sort((a, b) => b.inbound_links - a.inbound_links || a.path.localeCompare(b.path));
const leaves = docs.filter((d) => outbound.get(d).length === 0).sort();

findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line || a.column - b.column || (a.rule < b.rule ? -1 : 1)));

const env = envelope({
  tool: 'doc-graph',
  root,
  asOf: when.date,
  findings,
  summary: {
    files_scanned: docs.length,
    links_checked: linksChecked,
    total_edges: [...outbound.values()].reduce((n, v) => n + v.length, 0),
    root_doc: rootDoc,
    reachable_docs: reachable ? reachable.size : null,
    unreachable_docs: reachable ? docs.length - reachable.size : null,
    hub_count: hubs.length,
    leaf_count: leaves.length,
  },
});
env.hubs = hubs;
env.leaf_pages = leaves;
if (!rootDoc) {
  // Not a finding: a KB with no entry point has a different problem than an indexing one,
  // and inventing a root would make every run depend on the day's link counts.
  env.notes = [`no root doc found (looked for ${ROOT_DOC_CANDIDATES.join(', ')}); reachability did not run`];
}

const out = emit(env, { json: Boolean(args.json) });
if (out) console.log(render(out));
process.exit(gate(findings, args['min-severity'] ?? 'low'));
