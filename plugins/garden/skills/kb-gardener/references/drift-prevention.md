# Drift Prevention Guide

Read this when the question is how to stop drift recurring, rather than how to detect it. Detection lives in `../SKILL.md`; interpreting what came back lives in `rule-catalogue.md`.

## Documentation-code coupling

The detector works by comparing a doc's git history against the history of the code it appears to describe. How tightly a doc is coupled to its code therefore decides both how fast it drifts and how well this skill can see the drift at all.

### Proximity coupling

Keep a doc physically near the code it describes — a README in each package directory, an architecture doc beside the system it covers. This is also what `doc-audit.mjs` uses to map a doc to its code directories, so proximity makes `code-churn` and `stale-doc` findings land on the right file instead of on a distant top-level doc.

### Reference coupling

Have docs name exact artifacts — real function names, real paths relative to the run root, links to real files. This is what makes `missing-reference`, `renamed-reference`, and `dead-link` possible: a doc that paraphrases ("the user handler") cannot be checked, while a doc that writes the literal path src/handlers/users.js can. Paraphrase is invisible drift.

### Generation coupling

Content generated from source — API reference from docstrings, CLI help from the parser definition, config docs from the schema — cannot drift for the generated portion. Move what can be generated out of hand-written docs, and let this skill guard what is left.

### Process coupling

A PR template line for documentation, and doc review required on any PR touching a public interface. This is the only coupling that catches semantic drift, which no tool detects.

## The recurring drift patterns

Each pattern is paired with the rule that catches it, where one does.

| Pattern | What drifted | Prevention | Caught by |
|---|---|---|---|
| The renamed function | Code renamed, docs keep the old name | Search docs for the old name as part of the rename | `renamed-reference`, `missing-reference` |
| The moved file | File moved, docs link to the old path | Run the link checker after any file move | `dead-link`, `renamed-reference` |
| The outdated version | Manifest bumped, README not | One source of truth for the version string | `version-mismatch` |
| The accumulated options | Flags added over time, never documented | Generate CLI/config docs from source; add "doc update" to the definition of done | nothing — process only |
| The orphaned section | Feature removed, its docs remain | Remove the docs in the PR that removes the code | nothing — process only |
| The divergent example | Example worked against v1, not v2 | Extract examples into testable files and run them in CI | nothing — process only |
| The stale screenshot | UI changed, screenshots did not | Tag screenshots with the version they depict | nothing — process only |

The right-hand column is the point: three of these are detectable and four are not, so a CI gate is a floor, not a substitute for the process coupling above.

## Anti-patterns

- **Ignoring drift until release** — run the audit in CI on every PR, not as a release-day scramble.
- **Treating all drift alike** — a wrong function signature misleads a reader into writing broken code; a stale date does not. Prioritize by `category` and `severity`, not by finding count.
- **Fixing everything by hand** — work `details.fix_type: "auto"` findings (version strings, moved links) mechanically and spend human attention on `semantic` and `structural` drift.
- **Shallow clone in CI** — `fetch-depth: 1` leaves no history to compare against, so `stale-doc` and `code-churn` silently find nothing. Use `fetch-depth: 0`.
- **Link-checking only the public docs** — cross-document anchors inside internal docs break silently on refactors; run `doc-graph.mjs` over the whole tree on every markdown change.
- **Gating on `--min-severity low` from day one** — on an unaudited repo that fails immediately and gets switched off. Gate at `high`, drive it to zero, then tighten.

## Review checklist

### On a code PR

- [ ] Do any docs reference the functions, classes, or files this PR changed?
- [ ] Were documented functions removed or renamed?
- [ ] Do the code examples in the docs still work?
- [ ] Are version strings still accurate?

### On a documentation PR

- [ ] Links resolve — local files, anchors, cross-document anchors
- [ ] No placeholder or TODO text remains
- [ ] Dates and version numbers are current relative to the release, not to when the draft was started

### On a release PR

- [ ] Changelog covers every user-facing change
- [ ] README version strings match the release tag
- [ ] A migration guide exists for each breaking change
- [ ] Generated API docs were regenerated from the current source

## CI gates

There is no longer a standalone CI recipe. The per-tool GitHub Actions and pre-commit
snippets lived in the doc-drift-detector skill, and consolidating it into kb-gardener
removed the standalone entry point they documented — see `../SKILL.md` § "What 2.0
absorbed".

To gate a pull request on doc health now, run a survey and gate on its exit code. Every
analysis script honours `--min-severity` and the contract exit codes (`0` clean, `1`
findings at or above the gate, `2` could not run), so a gate is still one command per
analysis — it is just no longer a documented recipe with a name.
