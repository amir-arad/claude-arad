#!/usr/bin/env node
import path from 'node:path';
import {
  CODE_EXTENSIONS, SKIP_DIRS, asOf, dirEntries, emit, envelope, exists, fail, gitFileEditCounts,
  parseArgs, parsePositiveInt, positionalRoot, readText, walk,
} from './lib.mjs';

const TOOL = 'scan';

const STACK_INDICATORS = {
  'package.json': 'Node.js',
  'deno.json': 'Deno',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'setup.py': 'Python',
  Pipfile: 'Python (Pipenv)',
  'go.mod': 'Go',
  'Cargo.toml': 'Rust',
  'pom.xml': 'Java (Maven)',
  'build.gradle': 'Java (Gradle)',
  Gemfile: 'Ruby',
  'composer.json': 'PHP',
  'mix.exs': 'Elixir',
  'Package.swift': 'Swift',
  'CMakeLists.txt': 'C/C++ (CMake)',
  Makefile: 'Make-based build',
};

const FRAMEWORK_INDICATORS = {
  'next.config': 'Next.js',
  'nuxt.config': 'Nuxt.js',
  'angular.json': 'Angular',
  'vue.config': 'Vue.js',
  'svelte.config': 'SvelteKit',
  'astro.config': 'Astro',
  'vite.config': 'Vite',
  'webpack.config': 'Webpack',
  'tailwind.config': 'Tailwind CSS',
  'tsconfig.json': 'TypeScript',
  'docker-compose': 'Docker Compose',
  Dockerfile: 'Docker',
  '.github/workflows': 'GitHub Actions CI/CD',
  '.gitlab-ci.yml': 'GitLab CI/CD',
  Jenkinsfile: 'Jenkins CI/CD',
  terraform: 'Terraform',
  'prisma/schema.prisma': 'Prisma ORM',
  'drizzle.config': 'Drizzle ORM',
  'alembic.ini': 'Alembic (SQLAlchemy migrations)',
};

const ENTRY_POINT_NAMES = new Set([
  'main.py', 'app.py', 'manage.py', 'wsgi.py', 'asgi.py',
  'main.go', 'main.rs', 'Main.java',
  'index.ts', 'index.js', 'index.mjs', 'server.ts', 'server.js',
  'app.ts', 'app.js', 'index.tsx', 'index.jsx',
]);

const KEY_FILE_NAMES = [
  'README.md', 'README', 'CONTRIBUTING.md', 'CHANGELOG.md', 'CLAUDE.md', 'AGENTS.md',
  'LICENSE', '.env.example', '.env.sample', 'Makefile',
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '.gitignore', '.editorconfig',
];

const HELP = `scan — report structural facts about a codebase

Usage: scan.mjs [root] [options]

  root                  directory to scan (default: .)

Options:
  --commits <n>         commits of git history for hotspots (default: 500)
  --as-of <YYYY-MM-DD>  date the run is reckoned against (default: today)
  --json                emit the JSON envelope
  --help                show this help

Fact-reporting tool: emits findings: [] and exits 0 unless it cannot run.
`;

function detectStack(root) {
  return Object.entries(STACK_INDICATORS)
    .filter(([file]) => exists(path.join(root, file)))
    .map(([file, stack]) => ({ file, stack }));
}

function detectFrameworks(root) {
  const rootNames = dirEntries(root).map((e) => e.name);
  const out = [];
  for (const [pattern, framework] of Object.entries(FRAMEWORK_INDICATORS)) {
    const hit = pattern.includes('/')
      ? exists(path.join(root, pattern))
      : rootNames.some((n) => n === pattern || n.startsWith(`${pattern}.`));
    if (hit) out.push({ pattern, framework });
  }
  return out;
}

function parseDependencies(root) {
  const deps = { runtime: [], dev: [] };
  const read = (name) => readText(path.join(root, name));

  const pkg = read('package.json');
  if (pkg) {
    try {
      const data = JSON.parse(pkg);
      deps.runtime.push(...Object.keys(data.dependencies ?? {}).sort());
      deps.dev.push(...Object.keys(data.devDependencies ?? {}).sort());
    } catch {}
  }

  const req = read('requirements.txt');
  if (req) {
    for (const line of req.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('-')) continue;
      const name = t.split(/[>=<!\[\];~ ]/)[0].trim();
      if (name) deps.runtime.push(name);
    }
  }

  const gomod = read('go.mod');
  if (gomod) {
    let inRequire = false;
    for (const line of gomod.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('require (')) { inRequire = true; continue; }
      if (inRequire && t === ')') { inRequire = false; continue; }
      if (inRequire && t) deps.runtime.push(t.split(/\s+/)[0]);
      else if (t.startsWith('require ')) deps.runtime.push(t.split(/\s+/)[1]);
    }
  }

  const cargo = read('Cargo.toml');
  if (cargo) {
    let section = null;
    for (const line of cargo.split(/\r?\n/)) {
      const header = line.trim().match(/^\[([\w.-]+)\]$/);
      if (header) { section = header[1]; continue; }
      const m = line.match(/^\s*(\w[\w-]*)\s*=/);
      if (!m) continue;
      if (section === 'dependencies') deps.runtime.push(m[1]);
      else if (section === 'dev-dependencies') deps.dev.push(m[1]);
    }
  }

  return deps;
}

function topDirectories(root, files) {
  const dirs = dirEntries(root)
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
  const byDir = new Map(dirs.map((d) => [d, { file_count: 0, exts: new Map() }]));
  for (const f of files) {
    const top = f.split('/')[0];
    const bucket = byDir.get(top);
    if (!bucket || !f.includes('/')) continue;
    bucket.file_count += 1;
    const ext = path.extname(f).toLowerCase();
    if (ext) bucket.exts.set(ext, (bucket.exts.get(ext) ?? 0) + 1);
  }
  const out = [];
  for (const [name, b] of byDir) {
    const subdirs = new Set();
    for (const f of files) {
      const parts = f.split('/');
      if (parts[0] === name && parts.length > 2) subdirs.add(parts[1]);
    }
    out.push({
      name,
      file_count: b.file_count,
      top_extensions: Object.fromEntries(
        [...b.exts.entries()].sort((a, b2) => b2[1] - a[1] || a[0].localeCompare(b2[0])).slice(0, 5),
      ),
      subdirs: [...subdirs].sort().slice(0, 10),
    });
  }
  return out.sort((a, b) => b.file_count - a.file_count || a.name.localeCompare(b.name));
}

function fileFacts(root, files) {
  const fileTypes = new Map();
  const entryPoints = [];
  let sourceFiles = 0;
  let totalLines = 0;

  for (const r of files) {
    const base = path.posix.basename(r);
    const ext = path.extname(r).toLowerCase();
    if (ext) fileTypes.set(ext, (fileTypes.get(ext) ?? 0) + 1);
    if (ENTRY_POINT_NAMES.has(base) && r.split('/').length <= 4) entryPoints.push(r);
    if (CODE_EXTENSIONS.has(ext)) {
      sourceFiles += 1;
      const text = readText(path.join(root, ...r.split('/')));
      if (text) totalLines += text.split('\n').length;
    }
  }

  return {
    file_types: Object.fromEntries(
      [...fileTypes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20),
    ),
    entry_points: entryPoints
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
      .slice(0, 15),
    source_stats: { source_files: sourceFiles, total_lines: totalLines },
  };
}

/**
 * Tree view hides dot-directories (except .github) on top of the shared
 * SKIP_DIRS — a local presentation choice, not the shared skip set.
 */
function buildTree(root, maxDepth = 2) {
  const tree = [];
  const hidden = (name) => name.startsWith('.') && name !== '.github';
  const recurse = (dir, depth, prefix) => {
    if (depth > maxDepth) return;
    const list = dirEntries(dir).filter((e) =>
      (e.isDirectory() && !hidden(e.name) && !SKIP_DIRS.has(e.name))
      || (e.isFile() && (!e.name.startsWith('.') || KEY_FILE_NAMES.includes(e.name) || e.name.startsWith('.env'))));    list.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const e of list) {
      tree.push({ type: e.isDirectory() ? 'dir' : 'file', path: prefix + e.name, depth });
      if (e.isDirectory()) recurse(path.join(dir, e.name), depth + 1, `${prefix + e.name}/`);
    }
  };
  recurse(root, 1, '');
  return tree;
}

function facts(root, commits) {
  const files = walk(root);
  const deps = parseDependencies(root);
  const hotspots = gitFileEditCounts(root, commits);
  const { file_types, entry_points, source_stats } = fileFacts(root, files);
  return {
    project_name: path.basename(root),
    tech_stack: detectStack(root),
    frameworks: detectFrameworks(root),
    entry_points,
    key_files: KEY_FILE_NAMES.filter((n) => exists(path.join(root, n))),
    root_files: dirEntries(root)
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort(),
    top_directories: topDirectories(root, files),
    dependencies: {
      runtime_count: deps.runtime.length,
      dev_count: deps.dev.length,
      runtime: deps.runtime.slice(0, 40),
      dev: deps.dev.slice(0, 30),
    },
    file_types,
    source_stats,
    is_git_repo: hotspots !== null,
    git_hotspots: (hotspots ?? []).slice(0, 20),
    tree: buildTree(root),
    files_scanned: files.length,
  };
}

function formatHuman(env) {
  const L = [];
  const section = (title) => L.push('', `--- ${title} ---`);
  L.push('='.repeat(60), `  CODEBASE SCAN: ${env.project_name}`, '='.repeat(60), '',
    `Root:  ${env.root}`, `As of: ${env.as_of}`);

  section('Tech Stack');
  if (env.tech_stack.length) env.tech_stack.forEach((s) => L.push(`  [${s.file}] -> ${s.stack}`));
  else L.push('  No manifest detected');

  section('Frameworks & Tooling');
  if (env.frameworks.length) env.frameworks.forEach((f) => L.push(`  ${f.framework} (via ${f.pattern})`));
  else L.push('  None detected');

  section('Entry Points');
  if (env.entry_points.length) env.entry_points.forEach((e) => L.push(`  -> ${e}`));
  else L.push('  None matching standard names');

  section('Key Files');
  env.key_files.forEach((f) => L.push(`  * ${f}`));

  section('Top-Level Directories');
  for (const d of env.top_directories) {
    L.push(`  ${d.name}/  (${d.file_count} files)`);
    const exts = Object.entries(d.top_extensions).map(([e, c]) => `${e}(${c})`).join(', ');
    if (exts) L.push(`      types: ${exts}`);
    if (d.subdirs.length) L.push(`      subdirs: ${d.subdirs.join(', ')}`);
  }

  section('Dependencies');
  L.push(`  Runtime: ${env.dependencies.runtime_count}  |  Dev: ${env.dependencies.dev_count}`);
  if (env.dependencies.runtime.length) L.push(`  runtime: ${env.dependencies.runtime.slice(0, 20).join(', ')}`);
  if (env.dependencies.dev.length) L.push(`  dev: ${env.dependencies.dev.slice(0, 15).join(', ')}`);

  section('File Types');
  for (const [ext, n] of Object.entries(env.file_types)) L.push(`  ${ext.padEnd(10)} ${String(n).padStart(5)}`);

  section('Source Stats');
  L.push(`  Source files: ${env.source_stats.source_files}`, `  Total lines:  ${env.source_stats.total_lines}`);

  section('Git Hotspots (most-edited files)');
  if (!env.is_git_repo) L.push('  Not a git repository (or git unavailable)');
  else if (!env.git_hotspots.length) L.push('  No commit history in range');
  else env.git_hotspots.forEach((h) => L.push(`  ${String(h.edits).padStart(4)}  ${h.file}`));

  section('Tree (depth 2)');
  for (const item of env.tree) {
    L.push(`  ${'  '.repeat(item.depth)}${path.posix.basename(item.path)}${item.type === 'dir' ? '/' : ''}`);
  }

  L.push('', '='.repeat(60));
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    process.stdout.write(HELP);
    return 0;
  }
  const args = parseArgs(argv, { flags: ['json', 'help'], options: ['commits', 'as-of'] });
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const root = positionalRoot(args);
  const commits = args.commits === undefined ? 500 : parsePositiveInt(args.commits, '--commits');
  const { date } = asOf(args);

  const f = facts(root, commits);
  const env = {
    ...envelope({
      tool: TOOL,
      root,
      asOf: date,
      findings: [],
      summary: { files_scanned: f.files_scanned, files_with_findings: 0 },
    }),
  };
  delete f.files_scanned;
  Object.assign(env, f);

  const human = emit(env, { json: args.json });
  if (human) process.stdout.write(`${formatHuman(human)}\n`);
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
