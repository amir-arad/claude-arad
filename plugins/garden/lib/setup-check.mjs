#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  SKIP_DIRS, asOf, emit, envelope, exists, fail, finding, gate, parseArgs, positionalRoot, readText,
} from './lib.mjs';

const TOOL = 'setup-check';

const HELP = `setup-check — checklist of repository setup completeness

Usage: setup-check.mjs [root] [options]

  root                     directory to check (default: .)

Options:
  --min-severity <level>   gate: critical|high|medium|low|info (default: low)
  --as-of <YYYY-MM-DD>     date the run is reckoned against (default: today)
  --json                   emit the JSON envelope
  --help                   show this help

Reports completeness counts over a checklist. Not a health score.
Each check carries an importance (required|recommended|optional); each failing or
warning check emits a finding with a severity from the contract ladder.
`;

const list = (dir) => {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
};

const TEST_DIRS = new Set(['tests', 'test', '__tests__', 'spec', 'e2e']);

function findTests(dir, depth = 0) {
  if (depth > 4) return null;
  for (const name of list(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (TEST_DIRS.has(name)) return name;
      const nested = findTests(full, depth + 1);
      if (nested) return `${name}/${nested}`;
    } else if (/\.(test|spec)\.[a-z]+$/.test(name) || /^test_.*\.py$/.test(name)) {
      return name;
    }
  }
  return null;
}

function runChecks(root) {
  const first = (...names) => names.find((n) => exists(path.join(root, n))) ?? null;
  const results = [];
  /**
   * `importance` — how much this check matters (CONTRACT §4), never a severity.
   * `severity` / `category` — used for the finding a failing or warning check emits.
   */
  const add = (c) => results.push(c);

  const readme = first('README.md', 'README.rst', 'README.txt', 'README');
  const readmeLines = readme
    ? (readText(path.join(root, readme)) ?? '').split(/\r?\n/).filter((l) => l.trim()).length
    : 0;
  add({
    id: 'readme',
    name: 'README documentation',
    importance: 'required',
    status: readmeLines >= 3 ? 'pass' : readme ? 'warn' : 'fail',
    found: readme,
    rule: readme ? 'thin-readme' : 'missing-readme',
    severity: readme ? 'medium' : 'high',
    category: 'structural',
    path: readme ?? '.',
    message: readme ? 'README exists but has fewer than 3 non-empty lines' : 'no README file at the repository root',
    recommendation: readme ? 'Expand the README with overview, setup steps, and usage'
      : 'Add a README.md with overview, setup steps, and usage',
  });

  const envTemplate = first('.env.example', '.env.sample', '.env.template', '.env.defaults');
  add({
    id: 'env_template',
    name: 'Environment variable template',
    importance: 'required',
    status: envTemplate ? 'pass' : 'fail',
    found: envTemplate,
    rule: 'missing-env-template',
    severity: 'high',
    category: 'structural',
    path: '.',
    message: 'no environment variable template file',
    recommendation: 'Add .env.example listing every required environment variable',
  });

  const gitignore = readText(path.join(root, '.gitignore')) ?? '';
  const envIgnored = gitignore.split(/\r?\n/)
    .some((l) => ['.env', '.env*', '.env.*', '.env.local'].includes(l.trim()));
  const envCommitted = exists(path.join(root, '.env'));
  add({
    id: 'env_gitignore',
    name: '.env excluded from version control',
    importance: 'required',
    status: envIgnored && !envCommitted ? 'pass' : envCommitted && !envIgnored ? 'fail' : 'warn',
    found: envIgnored ? '.gitignore has .env pattern' : null,
    rule: 'env-not-ignored',
    severity: envCommitted && !envIgnored ? 'critical' : 'medium',
    category: 'structural',
    path: '.gitignore',
    message: envCommitted && !envIgnored
      ? '.env exists and is not matched by any .gitignore pattern'
      : '.gitignore has no .env pattern',
    recommendation: envCommitted && !envIgnored
      ? 'Add .env to .gitignore and untrack it'
      : 'Add .env to .gitignore to prevent secret commits',
  });

  const makefile = first('Makefile', 'justfile', 'Taskfile.yml');
  let scripts = [];
  const pkg = readText(path.join(root, 'package.json'));
  if (pkg) {
    try {
      scripts = Object.keys(JSON.parse(pkg).scripts ?? {});
    } catch {}
  }
  add({
    id: 'task_runner',
    name: 'Build/task runner configured',
    importance: 'recommended',
    status: makefile || scripts.length ? 'pass' : 'warn',
    found: makefile ?? (scripts.length ? `package.json scripts: ${scripts.slice(0, 5).join(', ')}` : null),
    rule: 'missing-task-runner',
    severity: 'low',
    category: 'structural',
    path: '.',
    message: 'no Makefile, justfile, Taskfile, or package.json scripts',
    recommendation: 'Add a Makefile or package.json scripts for build/test/lint/dev',
  });

  const lock = first('package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
    'Pipfile.lock', 'poetry.lock', 'uv.lock', 'go.sum', 'Cargo.lock', 'Gemfile.lock', 'composer.lock');
  add({
    id: 'lockfile',
    name: 'Dependency lock file',
    importance: 'recommended',
    status: lock ? 'pass' : 'warn',
    found: lock,
    rule: 'missing-lockfile',
    severity: 'medium',
    category: 'structural',
    path: '.',
    message: 'no dependency lock file committed',
    recommendation: 'Commit a lock file for reproducible installs',
  });

  const workflows = list(path.join(root, '.github', 'workflows')).filter((f) => /\.ya?ml$/.test(f));
  const ci = workflows.length
    ? `.github/workflows/ (${workflows.length} workflow(s))`
    : first('.gitlab-ci.yml', 'Jenkinsfile', '.circleci/config.yml', 'bitbucket-pipelines.yml', '.travis.yml');
  add({
    id: 'ci_config',
    name: 'CI/CD configuration',
    importance: 'recommended',
    status: ci ? 'pass' : 'warn',
    found: ci,
    rule: 'missing-ci-config',
    severity: 'medium',
    category: 'structural',
    path: '.',
    message: 'no CI configuration detected',
    recommendation: 'Add CI configuration to automate tests on every push',
  });

  const lint = first('.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
    'eslint.config.js', 'eslint.config.mjs', '.prettierrc', '.prettierrc.json', 'prettier.config.js',
    'biome.json', 'biome.jsonc', '.flake8', '.pylintrc', 'ruff.toml', 'pyproject.toml', 'setup.cfg',
    '.rubocop.yml', '.golangci.yml');
  add({
    id: 'linter',
    name: 'Linting/formatting configuration',
    importance: 'recommended',
    status: lint ? 'pass' : 'warn',
    found: lint,
    rule: 'missing-linter-config',
    severity: 'low',
    category: 'structural',
    path: '.',
    message: 'no linter or formatter configuration detected',
    recommendation: 'Add a linter/formatter config for consistent style',
  });

  const testHit = findTests(root);
  add({
    id: 'tests',
    name: 'Test suite present',
    importance: 'recommended',
    status: testHit ? 'pass' : 'warn',
    found: testHit,
    rule: 'missing-tests',
    severity: 'medium',
    category: 'structural',
    path: '.',
    message: 'no test directory or test files found',
    recommendation: 'Add tests so setup correctness is verifiable',
  });

  const contrib = first('CONTRIBUTING.md', 'CONTRIBUTING', 'docs/CONTRIBUTING.md');
  add({
    id: 'contributing',
    name: 'Contributing guidelines',
    importance: 'optional',
    status: contrib ? 'pass' : 'warn',
    found: contrib,
    rule: 'missing-contributing',
    severity: 'info',
    category: 'structural',
    path: '.',
    message: 'no CONTRIBUTING guide',
    recommendation: 'Add CONTRIBUTING.md with PR process and coding standards',
  });

  const lic = first('LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING');
  add({
    id: 'license',
    name: 'License file',
    importance: 'optional',
    status: lic ? 'pass' : 'warn',
    found: lic,
    rule: 'missing-license',
    severity: 'low',
    category: 'structural',
    path: '.',
    message: 'no license file',
    recommendation: 'Add a LICENSE file to clarify usage terms',
  });

  if (first('Dockerfile')) {
    const compose = first('docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml');
    add({
      id: 'docker_compose',
      name: 'Docker Compose for local infra',
      importance: 'recommended',
      status: compose ? 'pass' : 'warn',
      found: compose,
      rule: 'missing-compose-file',
      severity: 'low',
      category: 'structural',
      path: 'Dockerfile',
      message: 'Dockerfile present but no compose file for local infrastructure',
      recommendation: 'Add a compose file for local infrastructure',
    });
  }

  const editor = first('.editorconfig');
  add({
    id: 'editorconfig',
    name: 'EditorConfig',
    importance: 'optional',
    status: editor ? 'pass' : 'warn',
    found: editor,
    rule: 'missing-editorconfig',
    severity: 'info',
    category: 'structural',
    path: '.',
    message: 'no .editorconfig',
    recommendation: 'Add .editorconfig for consistent indentation across editors',
  });

  return results;
}

const toFinding = (c) => finding({
  path: c.path,
  severity: c.severity,
  category: c.category,
  rule: c.rule,
  message: c.message,
  details: { check: c.id, importance: c.importance, status: c.status, recommendation: c.recommendation },
});

const IMPORTANCE_ORDER = { required: 0, recommended: 1, optional: 2 };

function formatHuman(env, checks) {
  const c = env.summary.completeness;
  const L = ['='.repeat(60), `  SETUP CHECK: ${path.basename(env.root)}`, '='.repeat(60), '',
    `Root:  ${env.root}`, `As of: ${env.as_of}`, ''];
  const icons = { pass: '[PASS]', warn: '[WARN]', fail: '[FAIL]' };
  const sorted = [...checks].sort((a, b) =>
    IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]
    || Number(a.status !== 'fail') - Number(b.status !== 'fail')
    || a.id.localeCompare(b.id));
  for (const r of sorted) {
    L.push(`  ${icons[r.status]}  ${r.name} (${r.importance})`);
    if (r.found) L.push(`         Found: ${r.found}`);
    if (r.status !== 'pass') L.push(`         -> ${r.recommendation}`);
    L.push('');
  }
  L.push('--- Setup completeness ---',
    `  Passed ${c.passed} of ${c.checks} checks  |  Warnings: ${c.warned}  |  Failed: ${c.failed}`,
    '',
    '--- Findings by severity ---',
    `  ${Object.entries(env.summary.by_severity).map(([s, n]) => `${s}: ${n}`).join('  |  ')}`,
    '', '='.repeat(60));
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    process.stdout.write(HELP);
    return 0;
  }
  const args = parseArgs(argv, { flags: ['json', 'help'], options: ['min-severity', 'as-of'] });
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const root = positionalRoot(args);
  const { date } = asOf(args);
  const minSeverity = args['min-severity'] ?? 'low';
  gate([], minSeverity); // validate the gate level before producing any output

  const checks = runChecks(root);
  const findings = checks.filter((c) => c.status !== 'pass').map(toFinding);
  const count = (s) => checks.filter((c) => c.status === s).length;

  const env = envelope({
    tool: TOOL,
    root,
    asOf: date,
    findings,
    summary: {
      completeness: {
        checks: checks.length,
        passed: count('pass'),
        warned: count('warn'),
        failed: count('fail'),
      },
    },
  });
  env.checks = checks.map((c) => ({
    id: c.id, name: c.name, importance: c.importance, status: c.status, found: c.found ?? null,
  }));

  const human = emit(env, { json: args.json });
  if (human) process.stdout.write(`${formatHuman(human, checks)}\n`);
  return gate(findings, minSeverity);
}

try {
  process.exit(main());
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
