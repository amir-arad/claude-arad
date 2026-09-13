#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CODE_EXTENSIONS, DAY, DOC_EXTENSIONS, SKIP_DIRS, TIER_SLA, abs, asOf, changeEventsSince,
  countWords, emit, envelope, extractLinks, fail, finding, gate, gitHistory, headingSlugs,
  gitToplevel, isoDate, latestTag, normalizeTier, parseArgs, parseDate, readFrontmatter, readText,
  rebaseHistory,
  git, renamesSince, slugify, stripCode, walk,
} from './lib.mjs';

const USAGE = `Usage: node doc-audit.mjs [root] [options]

Audit documentation on two axes at once: against the code and git history it describes
(staleness, churn, renamed and missing references, version mismatches, broken links,
missing README sections, under-documented trees) and against what its own frontmatter
declares (review SLA by tier, ownership, duplicate titles).

Options:
  --json                 Emit the JSON envelope
  --min-severity LEVEL   Gate: critical|high|medium|low|info (default: low)
  --as-of YYYY-MM-DD     Date the run is reckoned against (default: today)
  --doc-patterns LIST    Comma-separated doc extensions (default: md,markdown,mdown,mkd)
  --scope DIR            Limit code analysis to a subdirectory of the root
  --help                 Show this message

Rules: stale-doc, review-overdue, missing-updated, future-updated, unowned, alias-owner,
       code-churn, renamed-reference, missing-reference, ambiguous-reference,
       version-mismatch, future-date,
       missing-section, thin-doc, duplicate-title, untracked-doc, dead-link, dead-anchor

stale-doc fires once per doc: from frontmatter \`updated\` against the tier SLA when the doc
declares one, otherwise from git history. A declared date wins — it is a maintainer's
assertion, where git mtime is an accident of whoever last touched whitespace.

Exit codes: 0 = no findings at or above the gate, 1 = findings, 2 = tool error`;

const RENAME_WINDOW_DAYS = 90;
const STALE_DAYS = 180;
const VERY_STALE_DAYS = 365;
const README_SECTIONS = ['installation', 'usage', 'license'];

// --- frontmatter and ownership rules ----------------------------------------
// These reckon a doc against what it declares about itself (`updated`, `owner`, `tier`);
// the git-history rules above reckon it against the code it describes. A doc that declares
// an `updated` date is taken at its word — the declaration is a maintainer's assertion,
// where git mtime is an accident of whoever last touched whitespace.

const THIN_WORD_COUNT = 250;
const ALIAS_PATTERN = /(team|group|squad|helpdesk|support|ops|desk|alias|@)/i;

const SEVERITY_BY_TIER = {
  'stale-doc': { critical: 'critical', core: 'high', reference: 'medium', archive: 'low' },
  unowned: { critical: 'critical', core: 'high', reference: 'medium', archive: 'low' },
  'review-overdue': { critical: 'high', core: 'medium', reference: 'low', archive: 'info' },
  'missing-updated': { critical: 'high', core: 'medium', reference: 'low', archive: 'info' },
  'alias-owner': { critical: 'high', core: 'medium', reference: 'low', archive: 'info' },
  'future-updated': { critical: 'medium', core: 'medium', reference: 'medium', archive: 'info' },
  'duplicate-title': { critical: 'medium', core: 'low', reference: 'low', archive: 'info' },
};

/**
 * Rules driven by the doc's own frontmatter. Returns findings plus the tier and the
 * declared `updated` date, so the caller knows whether to fall back to git for staleness.
 */
function frontmatterFindings(docRel, content, asOfMs) {
  const fm = readFrontmatter(content);
  const tier = normalizeTier(fm.tier);
  const [slaDays, staleDays] = TIER_SLA[tier];
  const out = [];
  const mk = (rule, category, message, details) =>
    out.push(finding({
      path: docRel,
      severity: SEVERITY_BY_TIER[rule][tier],
      category,
      rule,
      message,
      details: { tier, fix_type: 'manual', ...details },
    }));

  const rawUpdated = String(fm.updated || fm.last_updated || '').trim();
  let declared = null;
  if (!rawUpdated) {
    mk('missing-updated', 'temporal', 'no last-updated date recorded in frontmatter', {});
  } else {
    declared = parseDate(rawUpdated, `${docRel}: updated`);
    const age = Math.round((asOfMs - declared) / DAY);
    if (age < 0) {
      mk('future-updated', 'temporal', `last-updated date is ${-age}d in the future`, { updated: rawUpdated, age_days: age });
    } else if (staleDays !== null && age > staleDays) {
      mk('stale-doc', 'temporal', `${age}d since last update, past the ${tier} stale threshold of ${staleDays}d`, { age_days: age, stale_days: staleDays, sla_days: slaDays, source: 'frontmatter' });
    } else if (slaDays !== null && age > slaDays) {
      mk('review-overdue', 'temporal', `${age}d since last update, past the ${tier} review SLA of ${slaDays}d`, { age_days: age, sla_days: slaDays, stale_days: staleDays });
    }
  }

  const owner = String(fm.owner || '').trim();
  if (!owner) mk('unowned', 'structural', 'no owner recorded', {});
  else if (ALIAS_PATTERN.test(owner)) mk('alias-owner', 'structural', `owner "${owner}" looks like a team alias, not a named person`, { owner });

  const h1 = /^#\s+(.+)$/m.exec(content);
  return {
    findings: out,
    tier,
    declaredUpdated: declared,
    title: fm.title || (h1 ? h1[1].trim() : ''),
  };
}

/** One finding per doc sharing a title with another. Cross-doc, so it runs after the walk. */
function duplicateTitleFindings(titles) {
  const byTitle = new Map();
  for (const { path: p, title, tier } of titles) {
    const t = String(title || '').trim().toLowerCase();
    if (!t) continue;
    byTitle.set(t, [...(byTitle.get(t) || []), { path: p, title, tier }]);
  }
  const out = [];
  for (const [title, group] of [...byTitle].sort(([a], [b]) => a.localeCompare(b))) {
    if (group.length < 2) continue;
    const paths = group.map((d) => d.path).sort();
    for (const d of group) {
      out.push(finding({
        path: d.path,
        severity: SEVERITY_BY_TIER['duplicate-title'][d.tier],
        category: 'semantic',
        rule: 'duplicate-title',
        message: `title "${String(d.title).trim()}" is shared with ${group.length - 1} other doc(s)`,
        details: { tier: d.tier, title, paths, fix_type: 'manual' },
      }));
    }
  }
  return out;
}

function docExtensions(arg) {
  if (!arg) return DOC_EXTENSIONS;
  const set = new Set(
    arg.split(',').map((p) => `.${p.trim().replace(/^\*?\./, '').toLowerCase()}`).filter((e) => e !== '.'),
  );
  if (!set.size) fail('--doc-patterns is empty');
  return set;
}

/** Run a regex over every line of `text`, yielding 1-based line/column per match. */
function scanLines(text, regex, cb) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(regex)) cb(m, i + 1, m.index + 1);
  }
}

/**
 * Strict resolution, for markdown link targets: relative to the doc, then to the root.
 * A link is a promise the reader can click, so it either resolves literally or it is dead.
 * @returns {string|null} absolute path
 */
function resolveFileRef(root, docDir, ref) {
  const fromDoc = path.resolve(root, docDir, ref);
  if (fs.existsSync(fromDoc)) return fromDoc;
  const fromRoot = path.resolve(root, ref);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return null;
}

const posixRef = (ref) => ref.replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * Every file in the tree indexed by basename, so a reference written in prose can be
 * matched as a path *suffix* of a real file.
 *
 * Tracked files AND a walk, unioned. `git ls-files` alone misses a directory that exists but
 * has not been committed yet, which is exactly when the doc describing it is newest; the walk
 * alone would index whatever the working tree happens to hold. The walk already skips
 * node_modules, dist and friends via SKIP_DIRS.
 */
function buildFileIndex(root, hasGit) {
  const listed = hasGit ? git(root, ['ls-files']).split('\n').filter(Boolean) : [];
  // Tracked paths are filtered by existence: a file deleted in the working tree is still
  // listed by ls-files, and matching a reference against it would resolve a shorthand to
  // something that is not there.
  const tracked = listed.filter((f) => fs.existsSync(path.resolve(root, f)));
  const files = [...new Set([...tracked, ...walk(root)])];
  const byBase = new Map();
  for (const f of files) {
    const norm = posixRef(f);
    const base = path.posix.basename(norm);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(norm);
  }
  return byBase;
}

/**
 * Lenient resolution, for a path written in prose rather than linked.
 *
 * Prose shorthand is good writing, not drift: a doc that establishes
 * `packages/dispatcher/src/launcher/routine-launcher.ts` in a table and then says
 * `routine-launcher.ts` in the next paragraph is referring to a file that exists. Flagging
 * that as a missing reference buried the real defects under ~80% noise, and pressured the
 * operator into blanket `won't do` entries that suppress genuine findings forever.
 *
 * So after the two literal bases fail, the reference is matched as a path suffix of a real
 * file. Only a reference that matches nothing anywhere is missing.
 *
 * @returns {{kind:'exact'|'suffix', path:string}|{kind:'ambiguous', matches:string[]}
 *          |{kind:'glob'|'placeholder'|'missing'}}
 */
function classifyProseRef(root, docDir, ref, byBase) {
  // A glob is a pattern, not a reference. It can never resolve and is never a defect.
  if (/[*?]/.test(ref)) return { kind: 'glob' };
  // Nor is a template placeholder or a home-relative path: neither can name a file in this
  // repo, so neither is worth resolving. Docs explaining a convention have to write an
  // example path, and an example is not a promise that the file exists.
  if (/[${}<>]/.test(ref) || ref.startsWith('~')) return { kind: 'glob' };
  const norm = posixRef(ref);
  if (resolveFileRef(root, docDir, norm)) return { kind: 'exact', path: norm };
  const matches = (byBase.get(path.posix.basename(norm)) ?? [])
    .filter((f) => f === norm || f.endsWith(`/${norm}`));
  if (matches.length === 1) return { kind: 'suffix', path: matches[0] };
  if (matches.length > 1) return { kind: 'ambiguous', matches };
  // A conventional stand-in name is checked LAST, not first. Suppressing it up front exempted any
  // real file called example.md or sample.md from missing-, ambiguous- AND renamed-reference
  // checking for good — a doc pointing at a genuine docs/example.md stopped being checked the day
  // that file was renamed. Reaching here means the ref resolved to nothing.
  //
  // It gets its own kind rather than reusing 'glob' because the two are not the same fact: a glob
  // can never name a file, while a stand-in name can, and the caller still has a rename table to
  // consult. Returning 'glob' here would restore the renamed-reference hole this move set out to
  // close. Test `norm`, not `ref`, so a Windows-separator ref reaches the same verdict as every
  // other branch in this function.
  if (/(^|\/)(foo|bar|baz|qux|example|sample|placeholder)(\.|$)/i.test(norm)) return { kind: 'placeholder' };
  return { kind: 'missing' };
}

/** true if v1 < v2 */
function versionIsOlder(v1, v2) {
  const parse = (v) => v.split('.').map((p) => parseInt(p, 10) || 0);
  const a = parse(v1);
  const b = parse(v2);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

function manifestVersion(root) {
  for (const manifest of ['package.json', 'pyproject.toml', 'setup.py', 'Cargo.toml']) {
    const content = readText(path.join(root, manifest));
    if (content === null) continue;
    const m = manifest === 'package.json'
      ? /"version"\s*:\s*"([^"]+)"/.exec(content)
      : /version\s*=\s*["']([^"']+)["']/.exec(content);
    if (m) return [manifest, m[1]];
  }
  return [null, null];
}

/**
 * One analysis pass per doc. Every location-bearing fact carries line/column so the
 * findings can be pointed at.
 */
function analyzeDoc(root, docRel, ctx) {
  const content = readText(abs(root, docRel)) ?? '';
  const dirRaw = path.posix.dirname(docRel);
  const docDir = dirRaw === '.' ? '' : dirRaw;
  const stripped = stripCode(content);

  // Links: the lib's single extractor, shared with doc-graph.
  const links = extractLinks(content);

  // File references: link targets plus backtick-quoted paths.
  const fileRefs = [];
  for (const l of links) {
    if (l.kind === 'external' || l.kind === 'anchor') continue;
    const filePart = l.target.split('#')[0];
    if (filePart) fileRefs.push({ ref: filePart, line: l.line, column: l.column, from: 'link' });
  }
  scanLines(content, /`([^\s`]+\.\w{1,5})`/g, (m, line, column) => {
    const ext = path.extname(m[1]).toLowerCase();
    if (CODE_EXTENSIONS.has(ext) || DOC_EXTENSIONS.has(ext)) {
      fileRefs.push({ ref: m[1], line, column, from: 'code-span' });
    }
  });

  const versions = [];
  scanLines(stripped, /(?:v|version[:\s]*)(\d+\.\d+(?:\.\d+)?)/gi, (m, line, column) => {
    versions.push({ value: m[1], line, column });
  });

  const dates = [];
  scanLines(stripped, /(\d{4}-\d{2}-\d{2})/g, (m, line, column) => {
    dates.push({ value: m[1], line, column });
  });

  return {
    content, docDir, links, fileRefs, versions, dates,
    modified: ctx.lastCommit.get(docRel),
  };
}

function mapDocsToCode(root, docFiles, codeFiles) {
  const codeDirs = new Set(codeFiles.map((c) => path.posix.dirname(c)).map((d) => (d === '.' ? '' : d)));
  const byBasename = new Map();
  for (const c of codeFiles) {
    const base = path.posix.basename(c);
    const dir = path.posix.dirname(c);
    if (!byBasename.has(base)) byBasename.set(base, new Set());
    byBasename.get(base).add(dir === '.' ? '' : dir);
  }

  const mapping = new Map();
  const add = (doc, dir) => {
    if (!mapping.has(doc)) mapping.set(doc, []);
    if (!mapping.get(doc).includes(dir)) mapping.get(doc).push(dir);
  };

  for (const doc of docFiles) {
    const rawDir = path.posix.dirname(doc);
    const docDir = rawDir === '.' ? '' : rawDir;
    if (codeDirs.has(docDir)) add(doc, docDir);
    const parentRaw = path.posix.dirname(docDir);
    const parent = parentRaw === '.' ? '' : parentRaw;
    if (docDir && codeDirs.has(parent)) add(doc, parent);

    const content = readText(abs(root, doc));
    if (content) {
      for (const m of content.matchAll(/[\w.@/\\-]+\.\w{1,5}/g)) {
        const dirs = byBasename.get(path.posix.basename(m[0].replace(/\\/g, '/')));
        if (dirs) for (const d of dirs) if (d) add(doc, d);
      }
    }
    if (['readme.md', 'index.md'].includes(path.posix.basename(doc).toLowerCase())) add(doc, docDir);
    if (!mapping.has(doc)) add(doc, docDir);
  }
  return mapping;
}

function countCode(root, dir) {
  const base = abs(root, dir);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return { subdirs: 0, files: 0 };
  let subdirs = 0;
  let files = 0;
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        subdirs += 1;
        stack.push(path.join(dir, e.name));
      } else if (CODE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
        files += 1;
      }
    }
  }
  return { subdirs, files };
}

const headingCache = new Map();
function slugsFor(fullPath) {
  if (!headingCache.has(fullPath)) {
    const content = readText(fullPath);
    headingCache.set(fullPath, content === null ? new Set() : headingSlugs(content));
  }
  return headingCache.get(fullPath);
}

/** Broken-link findings, using the same extractor and resolution rules as doc-graph. */
function linkFindings(root, docRel, analysis) {
  const out = [];
  const sourceFull = abs(root, docRel);
  for (const l of analysis.links) {
    if (l.kind === 'external') continue;
    const hash = l.target.indexOf('#');
    const filePart = hash >= 0 ? l.target.slice(0, hash) : l.target;
    const anchor = hash >= 0 ? l.target.slice(hash + 1) : null;
    const at = { path: docRel, line: l.line, column: l.column, category: 'referential' };

    if (!filePart) {
      if (!anchor) continue;
      if (slugsFor(sourceFull).has(slugify(anchor))) continue;
      out.push(finding({
        ...at, severity: 'medium', rule: 'dead-anchor',
        message: `anchor #${anchor} does not exist in this file`,
        details: { target: l.target, fix_type: 'manual' },
      }));
      continue;
    }
    const resolved = resolveFileRef(root, analysis.docDir, filePart);
    if (!resolved) {
      out.push(finding({
        ...at, severity: 'high', rule: 'dead-link',
        message: `links to ${filePart}, which does not exist`,
        details: { target: l.target, kind: l.kind, fix_type: 'auto' },
      }));
      continue;
    }
    if (anchor && DOC_EXTENSIONS.has(path.extname(resolved).toLowerCase())
      && !slugsFor(resolved).has(slugify(anchor))) {
      out.push(finding({
        ...at, severity: 'medium', rule: 'dead-anchor',
        message: `${filePart} exists but has no anchor #${anchor}`,
        details: { target: l.target, fix_type: 'manual' },
      }));
    }
  }
  return out;
}

function auditDoc(root, docRel, codeDirs, ctx, analysis) {
  const out = [];
  const { content, modified } = analysis;

  // What the doc declares about itself. `declaredUpdated` decides who owns `stale-doc`
  // below: a declared date beats git history, which is why only one of the two fires.
  const fm = frontmatterFindings(docRel, content, ctx.asOfMs);
  out.push(...fm.findings);

  if (!ctx.hasGit) {
    // No history to reckon against. Saying every doc is "untracked" in a tree that has no
    // git at all is noise, not a finding — the frontmatter rules above still applied.
  } else if (modified === undefined) {
    out.push(finding({
      path: docRel, severity: 'info', category: 'temporal', rule: 'untracked-doc',
      message: 'documentation file has no git history (untracked or new)',
      details: { fix_type: 'manual' },
    }));
  } else {
    let changeCount = 0;
    const changedDirs = [];
    for (const dir of codeDirs) {
      const n = changeEventsSince(ctx.commits, modified, dir, CODE_EXTENSIONS);
      changeCount += n;
      if (n) changedDirs.push(dir);
    }
    if (changeCount > 0) {
      out.push(finding({
        path: docRel,
        severity: changeCount > 20 ? 'high' : changeCount > 5 ? 'medium' : 'low',
        category: 'factual',
        rule: 'code-churn',
        message: `${changeCount} code file changes in associated directories since this doc was last updated`,
        details: { changed_dirs: changedDirs.sort(), change_count: changeCount, fix_type: changeCount > 20 ? 'manual' : 'semi' },
      }));
    }

    // Git-history staleness is the fallback. When the doc declares an `updated` date,
    // frontmatterFindings has already ruled on staleness and this would double-report it.
    const daysSince = Math.floor((ctx.asOfMs - modified) / DAY);
    if (fm.declaredUpdated === null && daysSince > STALE_DAYS) {
      out.push(finding({
        path: docRel,
        severity: daysSince > VERY_STALE_DAYS ? 'high' : 'medium',
        category: 'temporal',
        rule: 'stale-doc',
        message: `documentation not updated in ${daysSince} days`,
        details: { days_since_update: daysSince, last_updated: isoDate(modified), fix_type: 'manual' },
      }));
    }
  }

  // References written in prose (link targets are covered by linkFindings).
  //
  // One pass decides all three referential rules, because they are the same question asked
  // once: does this reference resolve, and if not, does history say where it went? Matching
  // renames by basename alone — the old shape — reported `ports/task-store.ts` as renamed
  // because an unrelated `store/task-store.ts` became `adapters/real/sqlite-task-store.ts`.
  // In a hexagonal layout that misfires structurally, and `fix_type: auto` on a correct doc
  // is worse than no finding at all. A rename is claimed only when the reference does not
  // resolve AND it is the path that was actually renamed.
  const seenRefs = new Set();
  for (const r of analysis.fileRefs) {
    if (r.from !== 'code-span' || seenRefs.has(r.ref)) continue;
    seenRefs.add(r.ref);
    const at = { path: docRel, line: r.line, column: r.column, category: 'referential' };
    const res = classifyProseRef(root, analysis.docDir, r.ref, ctx.fileIndex);
    if (res.kind === 'exact' || res.kind === 'suffix' || res.kind === 'glob') continue;
    if (res.kind === 'ambiguous') {
      out.push(finding({
        ...at, severity: 'low', rule: 'ambiguous-reference',
        message: `references ${r.ref}, which matches ${res.matches.length} files: ${res.matches.slice(0, 3).join(', ')}`,
        details: { reference: r.ref, matches: res.matches, fix_type: 'manual' },
      }));
      continue;
    }
    const norm = posixRef(r.ref);
    const rename = ctx.renames.find(([oldName]) => oldName === norm || oldName.endsWith(`/${norm}`));
    if (rename) {
      out.push(finding({
        ...at, severity: 'high', rule: 'renamed-reference',
        message: `references ${r.ref}, which was renamed to ${rename[1]}`,
        details: { reference: r.ref, old_path: rename[0], new_path: rename[1], fix_type: 'auto' },
      }));
      continue;
    }
    // A stand-in name that resolves to nothing and was not renamed is an illustration, not a
    // broken link. It is skipped here rather than in classifyProseRef so that the rename check
    // above still sees it: a doc pointing at a real docs/example.md must still be told when that
    // file moves.
    if (res.kind === 'placeholder') continue;
    out.push(finding({
      ...at, severity: 'medium', rule: 'missing-reference',
      message: `references non-existent file: ${r.ref}`,
      details: { reference: r.ref, fix_type: 'manual' },
    }));
  }

  // Version mismatches against the latest git tag and the package manifest.
  const [manifestName, manifestVer] = ctx.manifest;
  const seenVersions = new Set();
  for (const v of analysis.versions) {
    if (seenVersions.has(v.value)) continue;
    seenVersions.add(v.value);
    for (const [source, current] of [['git tag', ctx.currentVersion], [manifestName, manifestVer]]) {
      if (!current || v.value === current || !versionIsOlder(v.value, current)) continue;
      out.push(finding({
        path: docRel, line: v.line, column: v.column, severity: 'medium', category: 'temporal',
        rule: 'version-mismatch',
        message: `references version ${v.value}, but ${source} is ${current}`,
        details: { doc_version: v.value, current_version: current, source, fix_type: 'auto' },
      }));
    }
  }

  // Future dates, reckoned against --as-of.
  for (const d of analysis.dates) {
    if (Date.parse(`${d.value}T00:00:00Z`) > ctx.asOfMs) {
      out.push(finding({
        path: docRel, line: d.line, column: d.column, severity: 'low', category: 'factual',
        rule: 'future-date', message: `contains a date in the future: ${d.value}`,
        details: { date: d.value, as_of: ctx.asOfDate, fix_type: 'manual' },
      }));
    }
  }

  // README completeness.
  if (path.posix.basename(docRel).toLowerCase().startsWith('readme')) {
    const headings = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const m = /^#{1,3}\s+(.+)/.exec(line);
      if (m) headings.push(m[1].trim().toLowerCase());
    }
    for (const section of README_SECTIONS) {
      if (headings.some((h) => h.includes(section))) continue;
      out.push(finding({
        path: docRel, line: 1, column: 1, severity: 'low', category: 'structural',
        rule: 'missing-section',
        message: `README has no ${section} section`,
        details: { section, fix_type: 'manual' },
      }));
    }
  }

  // Thin doc. Two signals, one rule: too little prose for the tree it documents (the
  // drift signal), or too little prose outright (the KB-hygiene signal). Emitting both as
  // separate `thin-doc` findings is what the consolidation removed — a doc is thin once.
  const docLines = content.split(/\r?\n/).length;
  const words = countWords(content);
  let subdirs = 0;
  let codeFileCount = 0;
  for (const dir of codeDirs) {
    const c = countCode(root, dir);
    subdirs += c.subdirs;
    codeFileCount += c.files;
  }
  const thinForTree = subdirs > 10 && docLines < 50;
  const thinOutright = words < THIN_WORD_COUNT && fm.tier !== 'archive';
  if (thinForTree || thinOutright) {
    out.push(finding({
      path: docRel, line: 1, column: 1,
      severity: thinForTree ? 'medium' : fm.tier === 'critical' ? 'medium' : 'low',
      category: 'semantic', rule: 'thin-doc',
      message: thinForTree
        ? `${docLines} lines of documentation for a tree of ${subdirs} subdirectories and ${codeFileCount} code files`
        : `${words} words, below the ${THIN_WORD_COUNT}-word threshold`,
      details: {
        doc_lines: docLines, word_count: words, tier: fm.tier,
        code_subdirs: subdirs, code_files: codeFileCount, fix_type: 'manual',
      },
    }));
  }

  return { findings: out, title: fm.title, tier: fm.tier };
}

function render(env) {
  const lines = [
    'Documentation Drift Report',
    '='.repeat(60),
    `Root:     ${env.root}`,
    `As of:    ${env.as_of}`,
    `Docs:     ${env.summary.files_scanned} scanned, ${env.summary.files_with_findings} with findings`,
    `Findings: ${env.summary.total}`,
    '',
  ];
  // A degraded run has to say so here too. Silently reporting fewer findings reads as a
  // cleaner KB, which is the opposite of what happened.
  for (const note of env.notes ?? []) lines.push(`NOTE: ${note}`, '');
  if (!env.findings.length) {
    lines.push('No documentation drift detected.');
    return lines.join('\n');
  }
  for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
    const group = env.findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    lines.push(`${severity.toUpperCase()} (${group.length}):`, '-'.repeat(40));
    for (const f of group) {
      const at = f.line ? `${f.path}:${f.line}:${f.column}` : f.path;
      lines.push(`  ${at}`);
      lines.push(`    ${f.rule} [${f.category}] ${f.message}`);
    }
    lines.push('');
  }
  lines.push('BY RULE:', '-'.repeat(40));
  for (const [rule, n] of Object.entries(env.summary.by_rule).sort()) lines.push(`  ${rule.padEnd(22)} ${n}`);
  return lines.join('\n');
}

// --- entry point -----------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

const args = parseArgs(argv, {
  flags: ['json'],
  options: ['min-severity', 'as-of', 'doc-patterns', 'scope'],
});
if (args._.length > 1) fail(`unexpected extra argument: ${args._[1]}`);

const when = asOf(args);
const root = path.resolve(args._[0] ?? '.');
if (!fs.existsSync(root)) fail(`${root} does not exist`);
if (!fs.statSync(root).isDirectory()) fail(`${root} is not a directory`);

// A non-git tree is a degraded run, not an error. The git-history rules go quiet; the
// frontmatter, ownership, link and structural rules need no history and still run. This
// used to abort — which made a freshly scaffolded KB unauditable until someone ran
// `git init`, and silently took the ownership rules down with it.
// The enclosing repository, which is not necessarily the run root: auditing a KB that lives
// in a subdirectory is the normal case, and it used to drop every history-dependent rule.
const repoRoot = gitToplevel(root);
const hasGit = repoRoot !== null;
const gitPrefix = hasGit
  ? path.relative(repoRoot, path.resolve(root)).split(path.sep).join('/')
  : '';

const scope = String(args.scope ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
if (scope) {
  const scopeFull = abs(root, scope);
  if (!fs.existsSync(scopeFull) || !fs.statSync(scopeFull).isDirectory()) fail(`--scope ${scope} is not a directory under the root`);
}

const extensions = docExtensions(args['doc-patterns']);
const docFiles = walk(root, { extensions });
const codeFiles = walk(scope ? abs(root, scope) : root, { extensions: CODE_EXTENSIONS })
  .map((f) => (scope ? `${scope}/${f}` : f));

// lastCommit is a Map<docPath, timestamp>; an empty one makes every lookup undefined,
// which is exactly "no history for this file" and needs no special-casing downstream.
const { commits, lastCommit } = hasGit
  ? rebaseHistory(gitHistory(repoRoot), gitPrefix)
  : { commits: [], lastCommit: new Map() };
const ctx = {
  hasGit,
  commits,
  lastCommit,
  renames: hasGit ? renamesSince(commits, when.ms - RENAME_WINDOW_DAYS * DAY) : [],
  fileIndex: buildFileIndex(root, hasGit),
  currentVersion: hasGit ? latestTag(repoRoot) : null,
  manifest: manifestVersion(root),
  asOfMs: when.ms,
  asOfDate: when.date,
};

const findings = [];
const titles = [];
const docCodeMap = mapDocsToCode(root, docFiles, codeFiles);
for (const doc of docFiles) {
  const analysis = analyzeDoc(root, doc, ctx);
  findings.push(...linkFindings(root, doc, analysis));
  const audited = auditDoc(root, doc, docCodeMap.get(doc) ?? [''], ctx, analysis);
  findings.push(...audited.findings);
  titles.push({ path: doc, title: audited.title, tier: audited.tier });
}
findings.push(...duplicateTitleFindings(titles));

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
findings.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]
  || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  || (a.line ?? 0) - (b.line ?? 0)
  || (a.column ?? 0) - (b.column ?? 0)
  || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));

const env = envelope({
  tool: 'doc-audit',
  root,
  asOf: when.date,
  findings,
  summary: { files_scanned: docFiles.length, git_history: hasGit },
});
if (!hasGit) {
  env.notes = [
    'not a git repository — stale-doc (git), code-churn, renamed-reference, version-mismatch '
    + 'and untracked-doc did not run. Frontmatter, ownership, link and structural rules did.',
  ];
}

const out = emit(env, { json: Boolean(args.json) });
if (out) console.log(render(out));
process.exit(gate(findings, args['min-severity'] ?? 'low'));
