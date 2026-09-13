# The machine contract

Every script in `lib/` conforms to this document. It exists so the analyses compose:
one tool's output is another tool's input, and a finding means the same thing everywhere.
`backlog-merge.mjs` depends on that being true.

This was a cross-skill standard, back when four skills implemented it and `lib.mjs` was
vendored byte-identical into each of them. They are now one plugin, so this is internal
design notes and `lib/lib.mjs` is an ordinary module. The contract is still worth
holding to: it is what lets a new analysis be written without renegotiating what a finding
is.

## 1. The finding record

The single unit of "something is wrong". Every detector emits these; nothing emits anything else.

```json
{
  "path": "docs/ops/deploy.md",
  "line": 42,
  "column": 8,
  "severity": "high",
  "category": "referential",
  "rule": "dead-link",
  "message": "links to docs/setup.md, which does not exist",
  "details": {}
}
```

- `path` — **required**. Relative to the run root, posix separators, no `./` prefix. `"."` for
  the root itself. Never absolute. A directory target ends in `/`.
- `line`, `column` — optional, 1-based. Include them whenever the finding has a location in a
  file; a finding that cannot be pointed at is much less useful.
- `severity` — **required**. One of `critical` `high` `medium` `low` `info`. Nothing else.
- `category` — **required**. One of `temporal` `factual` `referential` `structural` `semantic`.
- `rule` — **required**. Stable kebab-case identifier for what was detected (`dead-link`,
  `stale-doc`, `unreachable`, `dead-citation`, `duplicate-anchor`). This is the machine key;
  `message` is for humans and may be reworded freely without breaking anything.
- `message` — **required**. One line, no trailing period, states the problem not the fix.
- `details` — optional object for rule-specific data. Never load-bearing for consumers.

**Never** put structured data in `message`. An earlier auditor emitted
`issues: ["stale: 400d old, core threshold is 270d"]` and then prefix-match its own English to
recover the structure. That is proof the shape is wrong.

## 2. The envelope

```json
{
  "tool": "doc-graph",
  "root": "C:/workspace/amir-skills",
  "as_of": "2026-08-17",
  "summary": {
    "files_scanned": 17,
    "files_with_findings": 9,
    "total": 14,
    "by_severity": { "critical": 0, "high": 4, "medium": 7, "low": 2, "info": 1 },
    "by_rule": { "dead-link": 12, "duplicate-anchor": 2 }
  },
  "findings": [ ... ]
}
```

- `tool` — the script's own name, no extension.
- `root` — the one absolute path in the entire document, posix separators. Every `path` in
  `findings` is relative to it.
- `as_of` — the date the run is reckoned against (see §5).
- `summary.by_severity` — all five keys always present, zeros included. Consumers must not
  have to distinguish "absent" from "zero".
- `findings` — always an array, even when empty. Never a count. Never absent.

Key casing is `snake_case` throughout. JSON is written with `JSON.stringify(x, null, 2)` to
stdout, followed by a newline.

**Tools that report facts rather than problems** (`cite-scan`, `scan`) keep the same envelope
and the same `root`/`as_of`/`summary` discipline, but carry their fact arrays under their own
key instead of `findings`. They must not invent severities to force their facts into the
findings shape.

A fact tool **may** additionally emit findings for the subset of its facts that are
unambiguously defects — `cite-scan` emits its dead citations as `dead-citation` findings while
keeping every citation edge under `citations`. The test is whether the fact is wrong on its
face: a citation pointing at a file that does not exist is a defect in any context, whereas a
directory with zero citations is only a problem once a human decides it should have some. When
in doubt it is a fact, not a finding.

## 3. Exit codes

| code | meaning |
|---|---|
| `0` | ran clean — no findings at or above the gate |
| `1` | findings exist at or above the gate |
| `2` | the tool could not run |

Every detector accepts `--min-severity <level>` (default `low`) as the gate. Fact-reporting
tools always exit 0 unless they fail.

No arguments prints help and exits 0. `--help` prints help and exits 0. Unknown flags,
missing flag values, and stray positionals are all errors — exit 2. Silently ignoring an
unknown flag is a correctness bug, not a style choice.

Errors are one line on stderr: `Error: <message>`, no trailing period.

Never emit a JSON error object with exit 0.

## 4. Severity, and the word "critical"

`critical` was being used for four unrelated things. It now means exactly one: a finding
severity. The other three axes get their own words and must never reuse the severity ladder.

| axis | field | values |
|---|---|---|
| how bad is this finding | `severity` | `critical` `high` `medium` `low` `info` |
| consequence if this doc is wrong | `tier` | `critical` `core` `reference` `archive` |
| how much does this check matter | `importance` | `required` `recommended` `optional` |

`tier` is a property of a doc, not a finding, and appears only in inventory data. `importance`
belongs to checklist items (`setup-check.mjs`) and must not sit in a
`severity` field.

## 5. Determinism

Every tool accepts `--as-of YYYY-MM-DD`, defaulting to today, and reckons all date arithmetic
against it. No script calls `Date.now()` at a decision point. Two runs with the same `--as-of`
over the same tree produce identical output.

Dates parse as UTC midnight (`Date.parse(\`${d}T00:00:00Z\`)`) and validate against
`/^\d{4}-\d{2}-\d{2}$/`. Git timestamps use `%aI` (offset-aware) and are compared as instants,
not as formatted strings.

## 6. No aggregate scores

Scores are removed. The old kb-health-auditor's subtractive formula
(`-45×stale% -15×overdue% …`) and `doc-audit --mode score`'s dimension weights
(20/30/15/20/15) were never derived from anything measurable, and two skills' 0-100 bands
disagreed at every boundary while sharing vocabulary with the severity ladder.

Report what is countable: how many docs, how many have findings, the severity histogram, and
the worst offenders. A reader can act on those. `setup-check`'s number is not a health score
either — it is a completeness count over a checklist, and it says so.

Band words (`healthy`, `degrading`, `distrusted`, `failed`, `excellent`, `stale`, `abandoned`)
are retired along with the scores. Do not reintroduce a weighted aggregate.

## 7. Paths and traversal

One root per run, supplied as a positional argument (default `.`). Every emitted path is
relative to it. No tool discovers a root by walking up for `.git` — implicit root discovery
means the same file gets two different names depending on how you invoked the tool.

Skip directories: `.git .hg .svn node_modules __pycache__ .venv venv .tox dist build out
coverage .next target`. Skipping is by directory name at any depth.

Doc extensions: `.md .markdown .mdown .mkd`. Anything else is not a doc.

Markdown link extraction is `lib.mjs`'s single implementation — it handles inline links,
reference definitions, `<a href>`, `<img src>`, and it blanks fenced blocks, inline code
spans and HTML comments before matching. Four divergent regexes previously disagreed about the same file, two of
them inside the same skill.

## 8. The shared lib

`lib/lib.mjs` is the one home for shared code. It used to be vendored byte-identical
into four sibling skills, with a `vendor.mjs --check` to catch drift; consolidating those
skills removed both the copies and the need for the check.

### 8.1 Exported surface

Everything below is in `lib.mjs`. If a helper here does what you need, import it — do not
re-implement it locally.

**Constants** — `SKIP_DIRS`, `DOC_EXTENSIONS`, `CODE_EXTENSIONS`, `SEVERITIES`, `CATEGORIES`,
`SEVERITY_ORDER`, `DAY`.

**CLI** — `fail(msg)` (stderr + exit 2), `parseArgs(argv, {flags, options})`,
`positionalRoot(args)` (§7: one optional positional, resolved and verified),
`parsePositiveInt(raw, flag)`.

**Filesystem** — `rel(root, full)`, `abs(root, relPath)`, `readText(p)` (null on failure),
`exists(p)`, `isDirectory(p)`, `dirEntries(dir)`, `walk(root, {extensions, maxDepth})`.

**Dates** (§5) — `parseDate(str, field)`, `isoDate(ms)`, `asOf(args) -> {date, ms}`.

**Markdown** — `readFrontmatter(text)`, `stripCode(text)` (blanks fences and inline code,
preserving offsets), `classifyLink(target)`, `extractLinks(text)` (the single canonical
extractor), `slugify(heading)`, `headingSlugs(text)` (blanks code itself — do not pre-strip).

**Git** — `git(repo, args)` (`''` on failure), `isGitRepo(repo)`, `latestTag(repo)`,
`gitHistory(repo) -> {commits, lastCommit}`, `changeEventsSince(commits, sinceMs, dir, exts)`,
`renamesSince(commits, sinceMs)`, `gitFileEditCounts(root, commits)` (rebases git's
toplevel-relative paths onto the run root and drops anything outside it).

**Interop** — `readFindingsPayload(fileOrDash, targetDir) -> {payload, root, findings}`: reads a
file or stdin, accepts an §2 envelope or a bare §1 array, and re-relativises every finding
`path` from the payload's `root` to `targetDir`. Any tool consuming another tool's output uses
this. Supporting: `normalizePath(target, base)`, `pathKey(kind, normalizedPath)`.

**Output** — `finding({...})` (validates and orders the keys), `envelope({tool, root, asOf,
findings, summary})`, `gate(findings, minSeverity)`, `emit(env, {json})`.

**Doc inventory and tiering** — `TIER_SLA`, `TIERS`, `normalizeTier(raw)`, `countWords(text)`,
`resolveTarget(fromRel, target)`, `loadFromRoot(root)`, `loadFromJson(file)`. These were a
separate module while they had one consumer. Note the split of authority: `tier` as a
vocabulary is contract (§4), but the day counts in `TIER_SLA` are policy — change them for a
KB whose docs age differently, and say so in the backlog header.
