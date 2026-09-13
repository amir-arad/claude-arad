// Shared helpers for every kb-gardener script.
//
// This was the repo's shared standards lib, vendored byte-identical into four sibling
// skills. Those siblings were consolidated into kb-gardener, so this is now an ordinary
// module with a single home — edit it here.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { KNOWN_RULES } from './rule-types.mjs';

export const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', '__pycache__', '.venv', 'venv', '.tox',
  'dist', 'build', 'out', 'coverage', '.next', 'target',
]);

export const DOC_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd']);

/**
 * Source code, in the sense that matters here: it changes, and a doc describing it goes
 * stale. Scripting and query languages (.sh .bash .zsh .ps1 .sql) and component formats
 * (.vue .svelte) qualify. Data and markup (.json, .yaml, .html, .css) are deliberately
 * absent — including them made cite-scan report invented paths inside test fixtures as
 * dead citations.
 */
export const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.py', '.rb', '.go',
  '.rs', '.java', '.kt', '.kts', '.scala', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs',
  '.php', '.swift', '.lua', '.pl', '.r', '.sh', '.bash', '.zsh', '.ps1', '.sql',
  '.vue', '.svelte', '.tf', '.gradle', '.dockerfile',
]);

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
export const CATEGORIES = ['temporal', 'factual', 'referential', 'structural', 'semantic'];
export const SEVERITY_ORDER = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export const DAY = 86400000;

export function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(2);
}

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const res = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      res._.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith('--')) {
      res._.push(a);
      continue;
    }
    let key = a.slice(2);
    let val = null;
    const eq = key.indexOf('=');
    if (eq >= 0) {
      val = key.slice(eq + 1);
      key = key.slice(0, eq);
    }
    if (flags.includes(key)) {
      if (val !== null) fail(`--${key} does not take a value`);
      res[key] = true;
    } else if (options.includes(key)) {
      const v = val !== null ? val : argv[++i];
      if (v === undefined) fail(`--${key} requires a value`);
      res[key] = v;
    } else {
      fail(`unknown option --${key}`);
    }
  }
  return res;
}

export const rel = (root, full) => path.relative(root, full).split(path.sep).join('/') || '.';
export const abs = (root, r) => (r && r !== '.' ? path.join(root, ...r.split('/')) : root);

export function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function walk(root, { extensions, maxDepth = Infinity } = {}) {
  const out = [];
  const stack = [[root, 0]];
  while (stack.length) {
    const [dir, depth] = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && depth < maxDepth) stack.push([full, depth + 1]);
      } else if (e.isFile() && (!extensions || extensions.has(path.extname(e.name).toLowerCase()))) {
        out.push(rel(root, full));
      }
    }
  }
  return out.sort();
}

/** Directory entries with types; [] when the directory is missing or unreadable. */
export function dirEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export const isDirectory = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

export const exists = (p) => {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
};

/** CONTRACT §7: one root per run, a single optional positional, resolved and verified. */
export function positionalRoot(args) {
  if (args._.length > 1) fail(`unexpected argument: ${args._[1]}`);
  const raw = args._[0] ?? '.';
  const root = path.resolve(raw);
  if (!isDirectory(root)) fail(`not a directory: ${raw}`);
  return root;
}

export function parsePositiveInt(raw, flag) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) fail(`${flag} must be a positive integer, got: ${raw}`);
  return n;
}

export function readFrontmatter(text) {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  const fields = {};
  for (const line of text.slice(3, end).split(/\r?\n/)) {
    if (!line.includes(':') || /^[\s\t-]/.test(line)) continue;
    const idx = line.indexOf(':');
    fields[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return fields;
}

export function parseDate(str, field = '--as-of') {
  const raw = String(str ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail(`${field} must be YYYY-MM-DD, got: ${raw || '(empty)'}`);
  const ms = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(ms)) fail(`${field} is not a real date: ${raw}`);
  return ms;
}

export const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

export function asOf(args) {
  const raw = args?.['as-of'] ?? isoDate(Date.now());
  const ms = parseDate(raw, '--as-of');
  // `ms` is midnight opening the as-of day, which is what the age rules want: a doc dated
  // today is zero days old. `endMs` closes that day, which is what anything filtering
  // *events* wants — a commit made at 09:00 on the as-of date happened on or before it, and
  // comparing it against midnight silently excludes everything committed that day.
  return { date: isoDate(ms), ms, endMs: ms + DAY - 1 };
}

// Blanks fenced blocks, inline code spans, and HTML comments while preserving line and
// column positions. Commented-out navigation is not navigation, and a fenced example
// showing what a link looks like is not a link — see references/discoverability.md.
export function stripCode(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp']);

export function classifyLink(target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return 'external';
  if (target.startsWith('#')) return 'anchor';
  const filePart = target.split('#')[0];
  if (filePart && IMAGE_EXTENSIONS.has(path.extname(filePart).toLowerCase())) return 'image';
  if (target.includes('#')) return 'cross_doc_anchor';
  return 'local_file';
}

/** The single canonical markdown link extractor. Returns 1-based line/column. */
export function extractLinks(text) {
  const links = [];
  const lines = stripCode(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    const push = (index, label, target, kind) =>
      links.push({ line: n, column: index + 1, text: label, target: target.trim(), kind });

    for (const m of line.matchAll(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      const t = m[2].trim();
      push(m.index, m[1], t, classifyLink(t) === 'external' ? 'external' : 'image');
    }
    for (const m of line.matchAll(/\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      if (m.index > 0 && line[m.index - 1] === '!') continue;
      push(m.index, m[1], m[2], classifyLink(m[2].trim()));
    }
    const refDef = /^\s*\[([^\]]+)\]:\s+(\S+)/.exec(line);
    if (refDef) push(line.indexOf('['), refDef[1], refDef[2], classifyLink(refDef[2].trim()));

    for (const m of line.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)) {
      push(m.index, '', m[1], classifyLink(m[1].trim()));
    }
    for (const m of line.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi)) {
      const t = m[1].trim();
      push(m.index, '', t, classifyLink(t) === 'external' ? 'external' : 'image');
    }
  }
  return links;
}

export function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * ATX heading slugs. Blanks fenced blocks first, the way extractLinks does — without it a
 * `# comment` inside a bash fence registers as a real heading and produces false
 * duplicate-anchor findings and false anchor resolutions. Callers pass raw text.
 */
export function headingSlugs(text) {
  const slugs = new Set();
  for (const line of stripCode(text).split(/\r?\n/)) {
    const m = /^#{1,6}\s+(.+)/.exec(line);
    if (m) slugs.add(slugify(m[1].trim()));
  }
  return slugs;
}

/**
 * Run git and say whether it worked.
 *
 * `git()` below returns `''` for "the command failed", "the file is absent at this revision"
 * and "the file is genuinely empty" alike. That is fine for the callers that only ask
 * yes/no questions, and wrong for anything replaying file contents through history, where
 * a failed read and an empty file must not look the same. Output is untrimmed here: leading
 * and trailing blank lines are content when the thing being read is a file.
 */
export function gitOut(repo, args) {
  try {
    const out = execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { ok: true, out, status: 0 };
  } catch (e) {
    return { ok: false, out: '', status: typeof e?.status === 'number' ? e.status : -1 };
  }
}

export function git(repo, args) {
  const r = gitOut(repo, args);
  return r.ok ? r.out.trim() : '';
}

export const isGitRepo = (repo) => fs.existsSync(path.join(repo, '.git'));

/**
 * The git toplevel enclosing `dir`, or null when there is none.
 *
 * `isGitRepo` only answers "is this directory itself a repo root", which silently returns
 * false for the most natural invocation there is — pointing a tool at the KB subdirectory of
 * a repository. Every history-dependent rule then disappears and the run looks clean.
 */
export function gitToplevel(dir) {
  const out = git(dir, ['rev-parse', '--show-toplevel']);
  return out ? path.resolve(out) : null;
}

/**
 * Rebase a `gitHistory` result from the repo toplevel onto a subdirectory of it. Paths
 * outside the subdirectory are dropped: they cannot be named by a finding whose paths are
 * all root-relative. `prefix` is posix, relative to the toplevel, and "" means no change.
 */
export function rebaseHistory(history, prefix) {
  if (!prefix) return history;
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const inside = (f) => f.startsWith(p);
  const strip = (f) => f.slice(p.length);
  return {
    commits: history.commits.map((c) => ({
      ts: c.ts,
      files: c.files.filter(inside).map(strip),
      renames: c.renames.filter(([a, b]) => inside(a) && inside(b)).map(([a, b]) => [strip(a), strip(b)]),
    })),
    lastCommit: new Map(
      [...history.lastCommit].filter(([f]) => inside(f)).map(([f, t]) => [strip(f), t]),
    ),
  };
}

export function latestTag(repo) {
  const out = git(repo, ['describe', '--tags', '--abbrev=0']);
  return out ? out.replace(/^v/, '') : null;
}

/** Git quotes non-ASCII / special paths in --name-status output. Unquote conservatively. */
function unquoteGitPath(p) {
  if (!p.startsWith('"') || !p.endsWith('"')) return p;
  return p.slice(1, -1).replace(/\\(.)/g, '$1');
}

/**
 * Full commit history with per-commit touched paths and renames. Paths are relative to the
 * git toplevel. Timestamps come from `%aI` (offset-aware, CONTRACT §5) and are instants.
 *
 * @returns {{commits: Array<{ts:number, files:string[], renames:Array<[string,string]>}>,
 *            lastCommit: Map<string, number>}}
 */
export function gitHistory(repo) {
  const raw = git(repo, ['log', '--all', '-M', '--name-status', '--format=@%aI']);
  const commits = [];
  const lastCommit = new Map();
  let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('@')) {
      const ts = Date.parse(line.slice(1).trim());
      cur = { ts: Number.isNaN(ts) ? 0 : ts, files: [], renames: [] };
      commits.push(cur);
      continue;
    }
    if (!cur || !line.trim()) continue;
    const parts = line.split('\t');
    if (/^R/.test(parts[0]) && parts.length >= 3) {
      const from = unquoteGitPath(parts[1]);
      const to = unquoteGitPath(parts[2]);
      cur.renames.push([from, to]);
      cur.files.push(to, from);
      if (!lastCommit.has(to)) lastCommit.set(to, cur.ts);
    } else if (parts.length >= 2) {
      const f = unquoteGitPath(parts[1]);
      cur.files.push(f);
      if (!lastCommit.has(f)) lastCommit.set(f, cur.ts);
    }
  }
  return { commits, lastCommit };
}

const inDir = (file, dir) => (dir === '' ? true : file === dir || file.startsWith(`${dir}/`));

/** Number of (commit, file) change events under `dir` strictly after `sinceMs`. */
export function changeEventsSince(commits, sinceMs, dir, extensions = CODE_EXTENSIONS) {
  let n = 0;
  for (const c of commits) {
    if (c.ts <= sinceMs) continue;
    for (const f of c.files) {
      if (inDir(f, dir) && extensions.has(path.extname(f).toLowerCase())) n += 1;
    }
  }
  return n;
}

/** Unique [oldPath, newPath] renames recorded after `sinceMs`, sorted. */
export function renamesSince(commits, sinceMs) {
  const seen = new Set();
  const out = [];
  for (const c of commits) {
    if (c.ts <= sinceMs) continue;
    for (const [from, to] of c.renames) {
      const key = `${from} ${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([from, to]);
    }
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
}

/**
 * Edit counts per file over the last `commits` commits, keyed relative to `root`.
 * git reports paths relative to the repo TOPLEVEL, which is not the run root when the
 * root is a subdirectory — so paths are rebased onto `root` and anything outside it is
 * dropped. Returns null when `root` is not in a git repository.
 */
export function gitFileEditCounts(root, commits) {
  const top = git(root, ['rev-parse', '--show-toplevel']);
  if (!top) return null;
  const out = git(root, ['log', `-n${commits}`, '--name-only', '--format=']);
  if (!out) return [];
  const topAbs = path.resolve(top);
  const counts = new Map();
  for (const line of out.split(/\r?\n/)) {
    const f = line.trim();
    if (!f) continue;
    if (f.split('/').some((seg) => SKIP_DIRS.has(seg))) continue;
    const r = rel(root, path.join(topAbs, ...f.split('/')));
    if (r === '.' || r.startsWith('../')) continue;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([file, edits]) => ({ file, edits }));
}

/**
 * Every revision of one file, oldest first, with its content.
 *
 * The only way to ask what a file *said* in the past. `gitHistory` answers which files a
 * commit touched and when; it never opens one. Four things here are load-bearing:
 *
 * - **HEAD only, never `--all`.** `gitHistory` uses `--all` because it wants every commit
 *   that ever touched a path. A caller comparing consecutive revisions wants a *sequence*,
 *   and `--all` interleaves branches into an order that is not a history — consecutive
 *   snapshots then straddle unrelated branches and manufacture changes nobody made.
 * - **`--follow -M`** so a renamed file keeps one history, read at the path it had in each
 *   commit rather than the path it has now.
 * - **Deduped by blob oid.** A merge or a no-op touch produces a revision whose content is
 *   identical to its predecessor. Comparing those yields an empty change that still counts
 *   as a step.
 * - **`cat-file -s` before `show`.** Distinguishes a file absent at this revision (no size)
 *   from one that is genuinely empty (size 0) — see `gitOut`.
 *
 * `until` is an `--as-of` cutoff in ms. Without it `--as-of` is decorative in any tool built
 * on this, and CONTRACT §5 ("same --as-of over the same tree, same output") holds only by
 * accident on a repo nobody has committed to lately.
 */
export function fileRevisions(repo, relPath, { max = 500, follow = true, until = Infinity } = {}) {
  const log = gitOut(repo, [
    'log', ...(follow ? ['--follow'] : []), '-M', '--format=@%H%x09%aI', '--name-status', '--', relPath,
  ]);
  if (!log.ok) return { revisions: [], truncated: false, available: false, skipped_after_as_of: 0 };

  // '@<sha>\t<iso>' then a name-status line: 'A\tpath', 'M\tpath' or 'R<score>\told\tnew'.
  const heads = [];
  let pending = null;
  for (const line of log.out.split(/\r?\n/)) {
    if (line.startsWith('@')) {
      const [sha, iso] = line.slice(1).split('\t');
      pending = { sha, ts: Date.parse(iso) };
    } else if (pending && line.trim()) {
      const fields = line.split('\t');
      heads.push({ ...pending, path: fields[fields.length - 1] });
      pending = null;
    }
  }
  heads.reverse(); // oldest first

  const revisions = [];
  let prevOid = null;
  let truncated = false;
  let skipped = 0;
  for (const { sha, ts, path: p } of heads) {
    if (ts > until) { skipped++; continue; }
    const oid = git(repo, ['rev-parse', `${sha}:${p}`]);
    if (!oid) continue;
    if (oid === prevOid) { continue; }
    if (git(repo, ['cat-file', '-s', `${sha}:${p}`]) === '') continue;
    const body = gitOut(repo, ['show', `${sha}:${p}`]);
    if (!body.ok) continue;
    revisions.push({ sha, ts, path: p, text: body.out });
    prevOid = oid;
    if (revisions.length >= max) { truncated = true; break; }
  }
  return { revisions, truncated, available: true, skipped_after_as_of: skipped };
}

/**
 * Normalise a path for identity comparison: resolved against `base`, made relative to it,
 * posix separators, `.` for the base itself, trailing `/` (directory marker) preserved.
 */
export function normalizePath(target, base) {
  const trailing = /[\\/]$/.test(target);
  let r = path.relative(base, path.resolve(base, target)).split(path.sep).join('/');
  if (r === '') r = '.';
  return trailing ? `${r}/` : r;
}

/** Identity key for a (kind, normalised path) pair: case-insensitive, trailing `/` ignored. */
export const pathKey = (kind, normalized) =>
  `${String(kind).toLowerCase()} ${String(normalized).toLowerCase().replace(/\/$/, '')}`;

/** The backlog item line, fixed by assets/backlog-template.md. */
export const BACKLOG_ITEM = /^- \[([^\]]+)\] (.+?) — (.*)$/;

/**
 * Parse a backlog into its two sections. The one implementation, deliberately.
 *
 * `backlog-merge.mjs` reads the file on disk to decide what to suppress; `backlog-history.mjs`
 * reads past revisions of the same file to reconstruct what happened to each item. If those
 * two ever disagree about whether a line is an item, or which section it sits in, the history
 * is not a weaker account of the backlog — it is a fictional one, and nothing would say so.
 *
 * `strict` is for the mutation path, which must refuse to write to a file it did not
 * understand. History replay leaves it off: a malformed revision from two years ago is a fact
 * about the past, not an error to abort on.
 */
export function parseBacklog(text, root, { strict = false } = {}) {
  const lines = text.split(/\r?\n/);
  let openStart = -1;
  let wontStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].trim().toLowerCase();
    if (h === '## open') openStart = i;
    else if (h === "## won't do") wontStart = i;
  }
  const problems = [];
  if (openStart === -1) problems.push('backlog has no "## open" section');
  if (wontStart === -1) problems.push('backlog has no "## won\'t do" section');
  if (openStart !== -1 && wontStart !== -1 && wontStart < openStart) {
    problems.push('"## open" must come before "## won\'t do"');
  }
  if (strict && problems.length) fail(problems[0]);

  const open = new Map();
  const wont = new Map();
  const malformed = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const m = BACKLOG_ITEM.exec(raw);
    if (!m) {
      // A line that opens like an item but does not parse is worth naming: the separator is a
      // literal em dash and a hyphen there fails silently, leaving the item with no effect.
      if (/^- \[/.test(raw)) malformed.push({ line: i + 1, text: raw });
      continue;
    }
    const type = m[1].trim();
    const target = m[2].trim();
    const normalized = normalizePath(target, root);
    const rec = { type, target, normalized, description: m[3], line: i + 1 };
    const key = pathKey(type, normalized);
    if (openStart !== -1 && i > openStart && (wontStart === -1 || i < wontStart)) open.set(key, rec);
    else if (wontStart !== -1 && i > wontStart) wont.set(key, rec);
  }
  return { open, wont, malformed, problems, lines, openStart, wontStart };
}

/**
 * Split a won't-do reason into its recorded fields.
 *
 * The reason is the only durable record of why a suppression exists, and until this it was
 * free prose nothing inspected. See references/work-item-types.md for the grammar and
 * references/rationale-decay.md for why the `observed:` field specifically is the one that matters:
 * a stated attempt with no stated outcome is measurably worse than no reason at all.
 *
 * Every field is nullable. Absence is reported, never repaired or invented.
 */
export function parseReason(description) {
  const raw = String(description ?? '').trim();
  const attr = /\((human|kb-gardener[^)]*)\)\s*$/i.exec(raw);
  const body = attr ? raw.slice(0, attr.index).trim() : raw;
  const field = (label) => {
    const re = new RegExp(`(?:^|;)\\s*${label}\\s*:\\s*([\\s\\S]*?)(?=;\\s*(?:attempted|observed|revisit if)\\s*:|$)`, 'i');
    const m = re.exec(body);
    const v = m ? m[1].trim().replace(/[;,]$/, '').trim() : '';
    return v || null;
  };
  return {
    attempted: field('attempted'),
    observed: field('observed'),
    revisitIf: field('revisit if'),
    attribution: attr ? attr[1].trim() : null,
    raw,
  };
}

/** Text with a leading `---` frontmatter block removed. `readFrontmatter` returns the fields. */
export function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  const nl = text.indexOf('\n', end + 1);
  return nl === -1 ? '' : text.slice(nl + 1);
}

/**
 * The interop primitive: read one tool's output as another tool's input.
 *
 * Does the three things every consumer needs. 1. Reads `file`, or stdin when it is `"-"`.
 * 2. Accepts either a CONTRACT §2 envelope or a bare array of §1 findings. 3. Re-relativises
 * every `path` from the payload's `root` to `targetDir` — without this, findings from a run
 * rooted elsewhere land under the wrong name and silently fail to match anything.
 *
 * @returns {{payload: object|Array, root: string, findings: object[]}} `findings` are copies
 *   with re-relativised `path`; `payload` is the untouched parse; `root` is the source root.
 */
export function readFindingsPayload(file, targetDir) {
  let raw;
  const label = file === '-' ? 'stdin' : file;
  try {
    raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  } catch (err) {
    fail(err.code === 'ENOENT' ? `findings file not found: ${file}` : err.message);
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return fail(`${label} is not valid JSON (${err.message})`);
  }
  const list = Array.isArray(payload) ? payload : payload && payload.findings;
  if (!Array.isArray(list)) {
    fail('findings JSON must be a CONTRACT envelope with a "findings" array, or a bare array');
  }
  const base = path.resolve(targetDir ?? '.');
  const sourceRoot = !Array.isArray(payload) && typeof payload.root === 'string' && payload.root
    ? path.resolve(payload.root)
    : base;
  const findings = list.map((f, i) => {
    if (!f || typeof f.path !== 'string' || !f.path.trim()) fail(`findings[${i}] needs a string "path"`);
    const t = f.path.trim();
    const trailing = /[\\/]$/.test(t);
    const resolved = path.resolve(sourceRoot, t);
    return { ...f, path: normalizePath(trailing ? `${resolved}/` : resolved, base) };
  });
  return { payload, root: sourceRoot, findings };
}

/**
 * Every rule must be classified in rule-types.mjs, or backlog-merge.mjs drops its findings
 * instead of writing an item with an unverifiable type. Warn where the rule is emitted --
 * that is where the fix belongs -- but never fail the run over it: a detector that cannot
 * report because the taxonomy is behind is worse than one that reports loudly.
 */
const warnedRules = new Set();
function warnUnclassifiedRule(rule) {
  if (KNOWN_RULES.has(rule) || warnedRules.has(rule)) return;
  warnedRules.add(rule);
  process.stderr.write(
    `warning: rule "${rule}" is not classified in scripts/rule-types.mjs; `
    + 'backlog-merge.mjs will drop its findings\n',
  );
}

export function finding({ path: p, line, column, severity, category, rule, message, details }) {
  if (typeof p !== 'string' || !p) throw new Error('finding.path is required');
  if (!SEVERITIES.includes(severity)) throw new Error(`invalid severity: ${severity}`);
  if (!CATEGORIES.includes(category)) throw new Error(`invalid category: ${category}`);
  if (!rule || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(rule)) throw new Error(`invalid rule: ${rule}`);
  if (typeof message !== 'string' || !message) throw new Error('finding.message is required');
  warnUnclassifiedRule(rule);
  const out = { path: p };
  if (line !== undefined && line !== null) out.line = line;
  if (column !== undefined && column !== null) out.column = column;
  Object.assign(out, { severity, category, rule, message });
  if (details) out.details = details;
  return out;
}

export function envelope({ tool, root, asOf: date, findings = [], summary = {} }) {
  const by_severity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  const by_rule = {};
  for (const f of findings) {
    by_severity[f.severity] += 1;
    by_rule[f.rule] = (by_rule[f.rule] || 0) + 1;
  }
  return {
    tool,
    root: String(root).split(path.sep).join('/'),
    as_of: date,
    summary: {
      ...summary,
      files_with_findings: summary.files_with_findings ?? new Set(findings.map((f) => f.path)).size,
      total: findings.length,
      by_severity,
      by_rule,
    },
    findings,
  };
}

export function gate(findings, minSeverity = 'low') {
  if (!(minSeverity in SEVERITY_ORDER)) fail(`--min-severity must be one of ${SEVERITIES.join(', ')}`);
  const threshold = SEVERITY_ORDER[minSeverity];
  return findings.some((f) => SEVERITY_ORDER[f.severity] >= threshold) ? 1 : 0;
}

export function emit(env, { json } = {}) {
  if (json) {
    process.stdout.write(`${JSON.stringify(env, null, 2)}\n`);
    return null;
  }
  return env;
}

// --- doc inventory and SLA tiering ------------------------------------------
// Was knowledge-ops/scripts/inventory.mjs, whose own header nominated it for the shared
// lib. Consolidation made that move obvious.

/** tier -> [review SLA days, stale-at days]; null means "never expires". */
export const TIER_SLA = {
  critical: [90, 120],
  core: [180, 270],
  reference: [365, 540],
  archive: [null, null],
};

export const TIERS = Object.keys(TIER_SLA);

export function normalizeTier(raw) {
  const t = String(raw ?? '').trim().toLowerCase();
  return TIER_SLA[t] ? t : 'reference';
}

export const countWords = (text) =>
  (text.replace(/^---[\s\S]*?\n---/, '').match(/\S+/g) || []).length;

/** Resolve a link target relative to the doc that contains it, posix, root-relative. */
export function resolveTarget(fromRel, target) {
  const file = target.split('#')[0];
  if (!file) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), file));
  if (joined.startsWith('..')) return null;
  return joined;
}

/** Build an inventory by walking a directory of markdown files. */
export function loadFromRoot(root) {
  let stat;
  try {
    stat = fs.statSync(root);
  } catch {
    fail(`no such path: ${root}`);
  }
  if (!stat.isDirectory()) fail(`not a directory: ${root}`);
  const docs = [];
  for (const relPath of walk(root, { extensions: DOC_EXTENSIONS })) {
    const text = readText(path.join(root, ...relPath.split('/')));
    if (text === null) continue;
    const fm = readFrontmatter(text);
    const heading = /^#\s+(.+)$/m.exec(text);
    const linksTo = [];
    for (const l of extractLinks(text)) {
      if (l.kind !== 'local_file' && l.kind !== 'cross_doc_anchor') continue;
      const t = resolveTarget(relPath, l.target);
      if (t && DOC_EXTENSIONS.has(path.extname(t).toLowerCase()) && !linksTo.includes(t)) linksTo.push(t);
    }
    docs.push({
      path: relPath,
      title: fm.title || (heading ? heading[1].trim() : ''),
      owner: fm.owner || '',
      updated: fm.updated || fm.last_updated || '',
      tier: fm.tier || '',
      word_count: countWords(text),
      views_90d: null,
      links_to: linksTo,
    });
  }
  return docs;
}

/** Read an inventory JSON file: {"docs": [...]} or a bare array. */
export function loadFromJson(file) {
  const text = readText(file);
  if (text === null) fail(`cannot read --input file: ${file}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    fail(`--input is not valid JSON: ${e.message}`);
  }
  const docs = Array.isArray(data) ? data : data.docs;
  if (!Array.isArray(docs)) fail('--input must be an array of docs or an object with a "docs" array');
  for (const d of docs) {
    if (!d || typeof d.path !== 'string' || !d.path) fail('every doc in --input needs a non-empty "path"');
  }
  return docs;
}
