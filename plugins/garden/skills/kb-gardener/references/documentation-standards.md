# Documentation Conventions the Checks Assume

Every check in this skill is an opinion about how docs should be written, made executable. This file states those opinions, so a reader can decide whether a finding is a real defect or a mismatch with a house style the tools do not know about.

It is deliberately short. General technical-writing guidance — README section ordering, Keep a Changelog, the Diataxis four-types model, ADR templates — is available from its own sources and was removed from this file because nothing in this skill checks it and repeating it here only created something else to drift.

## What each check assumes

### README sections — `missing-section`

`doc-audit.mjs` checks every file whose basename starts with `readme` for headings matching `installation`, `usage`, and `license`. The assumption is that a reader arriving at a package needs to know how to install it, how to run it, and what they are allowed to do with it, and that those three are worth naming as headings rather than burying in prose.

If your project genuinely has no install step, `missing-section` on `installation` is a false positive for you. It is `low` severity for that reason — treat it as a prompt, not a defect.

### One version string — `version-mismatch`

The tool reads the latest git tag and the package manifest (package.json, pyproject.toml, setup.py, Cargo.toml) and compares them against version strings it finds in the docs. The assumption is a single source of truth for the version: docs that quote a version at all should quote the one the build produces.

The prevention is not "remember to update both". It is to stop hardcoding the version in prose — reference it, generate it, or omit it.

### References name real files — `missing-reference`, `dead-link`, `renamed-reference`

Paths in backtick code spans and markdown link targets are resolved against the filesystem. The assumption is that when a doc names a file it means that exact file, at that exact path, relative to the run root.

This is the convention with the highest payoff and the one most often broken by paraphrase. A phrase like "the user handler" cannot be checked; a literal path such as src/handlers/users.js can, and will be caught the moment it moves.

### Docs live in the repo — `stale-doc`, `code-churn`, `untracked-doc`

All staleness reasoning is git history. A doc committed alongside the code it describes gets a meaningful last-modified instant; a doc pasted into a wiki does not, and a doc in the tree but never committed produces `untracked-doc` at `info` severity rather than any staleness signal at all.

The corollary: `stale-doc` measures when the file was last committed, not when anyone last verified it was true. A whitespace commit resets it. It is a proxy, and a weak one on its own — it is worth reading together with `code-churn`, which asks whether the described code moved on.

### Headings are unique and stable — `dead-anchor`, `duplicate-anchor`

Anchors are derived from heading text by slugification, so renaming a heading breaks every link into it, and two identical headings in one file make links to them ambiguous. The assumption is that headings are part of the public interface of a doc.

## Where a finding is not a defect

- A `missing-section` on a doc that is deliberately not a package README.
- A `thin-doc` on an index page whose job is to be short and link outward.
- A `version-mismatch` on a doc quoting a historical version on purpose — a migration guide, a changelog entry.

In each case the fix is to record the decision, not to pad the doc. There is no suppression mechanism in the tools; use `--scope` to narrow a run, or accept the finding and explain it in the report.
