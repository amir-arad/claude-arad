# Rules, Drift Categories & Troubleshooting

Read this when interpreting findings, classifying drift, deciding what to auto-fix vs fix by hand, or diagnosing tool behaviour.

## No scores

Aggregate 0-100 staleness numbers, dimension weights, and the band words that sorted docs into buckets were removed in 5.0 (see `references/contract.md` §6 and `references/glossary.md` — they were never derived from anything measurable). Report what is countable instead: how many docs were scanned, how many carry findings, the severity histogram from `summary.by_severity`, the rule histogram from `summary.by_rule`, and the worst offenders by finding count.

Every check that fed a scoring dimension still runs; it now emits a finding record:

| former dimension | surviving rules |
|---|---|
| Last Updated | `stale-doc`, `untracked-doc` |
| Code-Doc Alignment | `code-churn`, `renamed-reference`, `missing-reference`, `ambiguous-reference`, `thin-doc` |
| Link Health | `dead-link`, `dead-anchor`, `duplicate-anchor`, `unreachable-url` |
| Completeness | `missing-section` |
| Accuracy | `version-mismatch`, `future-date` |

**Gating:**

```bash
# Fail CI on high or critical findings only
node ${CLAUDE_PLUGIN_ROOT}/lib/doc-audit.mjs /path/to/repo --min-severity high

# Reproducible run pinned to a date
node ${CLAUDE_PLUGIN_ROOT}/lib/doc-audit.mjs /path/to/repo --as-of 2026-08-17 --json
```

## Drift Categories

Every finding carries exactly one of these five `category` values (`references/contract.md` §1):

### Structural Drift
Missing or misorganized sections. A README lacks an Installation section. An API doc is missing an entire module. A CHANGELOG has no entries for the latest version.

**Detection:** Compare actual document headings against expected headings for that document type.

### Factual Drift
Incorrect information. A function signature in the docs has the wrong parameters. An installation command references a removed package. A configuration example uses deprecated options.

**Detection:** Cross-reference documented facts against the repository (file existence, git tags, package manifest versions).

### Referential Drift
Broken references. A link points to a file that was moved. An anchor references a heading that was renamed. An image path is wrong.

**Detection:** Link checker validates every reference against the filesystem and document structure.

### Temporal Drift
Outdated time-sensitive content. Version strings are old. "Last updated" dates are stale. "Coming soon" items that shipped months ago. Roadmap items past their target date.

**Detection:** Extract version strings and dates, compare against git tags, package manifests, and current date.

### Semantic Drift
Technically accurate but misleading. A description says "simple REST API" when the project now has GraphQL, gRPC, and WebSocket endpoints. The architecture overview omits a major new subsystem.

**Detection:** Compare document topic coverage against code directory structure and file counts. Flag when code complexity has grown significantly but documentation scope has not.

## Auto-Fix vs Manual-Fix Classification

Not all drift can be fixed programmatically. Every finding carries `details.fix_type` of `auto`, `semi`, or `manual` to route the work:

### Auto-Fixable (safe to automate)

- **Version string updates** -- replace old version with current from package manifest
- **Date updates** -- update "last modified" timestamps
- **Broken local links** -- suggest correct path when file was moved (git log tracks renames)
- **Missing table of contents entries** -- generate from actual headings
- **Removed file references** -- flag for deletion or suggest replacement

### Manual-Fix Required (needs human judgment)

- **Architectural description changes** -- requires understanding intent
- **API usage examples** -- new examples need domain context
- **Migration guides** -- require understanding of breaking changes
- **Getting started rewrites** -- narrative flow needs human touch
- **Security documentation updates** -- compliance implications require review

### Semi-Automated (template + human review)

- **New function documentation** -- draft a skeleton from the source, human fills description
- **Changelog entries** -- generate from git commits, human edits for clarity
- **README section additions** -- provide template, human adds content

## Where this fits

How the analyses fit together lives in `../skills/survey/SKILL.md`. Anti-patterns and prevention patterns live in `drift-prevention.md`.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `doc-audit.mjs` reports zero docs scanned | Repository has non-standard doc extensions or docs are in ignored directories (e.g., `node_modules`, `dist`) | Use `--doc-patterns "md,rst,txt"` to explicitly specify extensions. Zero docs is a clean run: a normal envelope with `findings: []` and exit 0 |
| Unexpectedly many `missing-reference`/`dead-link` findings | Docs reference files that were reorganized or moved to new directories | Run `doc-graph.mjs` first to identify broken references, fix them, then re-audit |
| Link checker flags valid anchors as broken | Heading text contains special characters, inline code, or emoji that alter the slug | Compare the expected slug (lowercase, special chars stripped, spaces to hyphens) against the actual heading text |
| Git history comparison shows no changes | Shallow clone lacks full commit history (common in CI) | Clone with `fetch-depth: 0` or pass `--scope` to narrow the analysis window |
| External URL checks hang or time out | Target servers are slow or block automated HEAD requests | Omit `--check-external` for local-only validation, or run external checks in a separate non-blocking job |
| Every finding has `details.fix_type: "manual"` | Most detected drift is semantic or architectural, not auto-fixable | This is expected for large refactors; work `auto` and `semi` findings first, then triage `manual` findings by severity |

## Success Criteria

Observable and checkable by re-running the tools — no targets nobody measured.

- **Link integrity**: `doc-graph.mjs <root>` exits 0. Every `dead-link`, `dead-anchor`, and `duplicate-anchor` finding is either fixed or has a named reason to remain.
- **Gate holds**: the CI gate command exits 0 on the default branch, so a merge that introduces drift at or above the gate is what turns it red.
- **Version accuracy**: no `version-mismatch` findings — every version string in the docs matches the latest git tag or the package manifest the tool read.
- **Findings are actionable**: each reported finding names a real path and, where it has one, a line — a reader can open the file and see the problem without re-deriving it.
- **Reproducibility**: two runs with the same `--as-of` over the same tree produce identical output, so a diff between runs is real change rather than noise.
