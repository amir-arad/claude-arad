---
name: init
description: Create or extend the knowledge base in this repository. Migrates a legacy .kb-gardener/ to .garden/, scaffolds state, generates missing docs from the code, writes the index, adds source citations. Never overwrites.
argument-hint: "[kb-path]  (default: kb; . when the repository is the KB)"
disable-model-invocation: true
---

# Init

Creates the knowledge base and its scaffolding. **Idempotent adopt-and-extend**: every step
adopts what is already there and only fills gaps. Nothing is ever overwritten, so re-running
init on a half-built KB is safe and is the intended way to extend one.

Arguments: `$ARGUMENTS` — the KB path relative to the repository root. Empty means `kb`. Use
`.` when the repository itself is the knowledge base.

Run everything from the **repository root**.

## 1. Scaffold (and migrate)

```
node ${CLAUDE_PLUGIN_ROOT}/lib/init-scaffold.mjs <repo-root> --kb-path <kb-path> --json
```

- **Migration.** If the repository has a legacy `.kb-gardener/` and no `.garden/`, the script
  renames it first — `git mv` when git tracks it, a plain rename otherwise — and reports it
  under `migrated`. File contents are not edited, so the change is a pure rename in git and the
  backlog's history follows it. Say so in your report; the user commits it.
  If both `.garden/` and `.kb-gardener/` exist, the script exits 2 without scaffolding; relay
  its message — the user merges the legacy backlog by hand.
- It creates the KB directory, an empty `.garden/backlog.md` and `.garden/synonyms.md`, and
  the `CLAUDE.md` knowledge-base section if no link into the KB is there yet.
- It reports the docs that already exist and which of the five standard topics
  (architecture, setup, deployment, runbooks, glossary) nothing covers. That report is the work
  list for the next steps. Existing docs are **kept as they are** — do not regenerate them.

## 2. Generate the missing docs — only when the repository has a code tree

A repository that is only documentation skips this step; its standard topics describe code
that does not exist.

Gather facts first:

```
node ${CLAUDE_PLUGIN_ROOT}/lib/scan.mjs <repo-root> --json
node ${CLAUDE_PLUGIN_ROOT}/lib/setup-check.mjs <repo-root> --json
```

`scan` gives the tech stack, entry points, key files and git hotspots; `setup-check` gives what
the setup guide has to cover. Both report facts only; every judgement (layers, architecture
pattern, diagrams, key-file ranking, prose) is yours to make from those facts plus reading the
actual code.

- Method and the architecture-pattern signal table: `${CLAUDE_PLUGIN_ROOT}/references/codebase-fact-gathering.md`
- Templates: `${CLAUDE_PLUGIN_ROOT}/assets/doc-templates.md`
- Check the result against `${CLAUDE_PLUGIN_ROOT}/references/doc-quality.md`

Default to a mid-level engineer new to the codebase as the audience and Markdown as the format.
Scope this to exactly the topics the scaffold reported missing. Write each generated doc into
the KB directory under a path naming its topic.

Never write over a doc the scaffold listed as already present, even when you think the
generated version is better — that judgement belongs to a `stale-doc` or `duplication` item in
a later survey, where it gets a diff and a merge gate.

## 3. Write the index

`<kb-path>/index.md` (`index.md` at the root when the KB path is `.`). The scaffold
deliberately does not write it: the hub's entries must satisfy the signposting criterion in
`${CLAUDE_PLUGIN_ROOT}/references/discoverability.md`, and only a reader of the docs can write
them.

- One entry per doc in the KB — the ones you generated *and* the ones that were already there.
- Each entry's link text contains a content word from that doc's own `# H1`, and the heading it
  sits under does not contradict it.
- If the index already exists, extend it with entries for the docs it is missing rather than
  rewriting it.

Skip this and the first survey opens with an `indexing-discoverability` item for every doc.

## 4. Add source citations — only when the repository has a code tree

This step **edits source files, not docs** — say so before doing it. For each KB doc that
genuinely describes a source directory, add one citation comment naming the doc's path at the
top of that directory's entry-point file, in the file's existing comment syntax.

Hard constraints: only where the doc really covers that code; never overwrite or reword an
existing comment; one citation per directory, not per file; comments only — no behaviour
changes. `cite-scan.mjs` reads this code→doc direction, so a citation added here is an edge on
the next survey and keeps a `source-discoverability` item from being raised.

## Report

What was migrated, created and already present; docs generated; index entries added; source
files touched. Nothing is committed — the user reviews the diff. Then suggest `/garden:survey`;
on a freshly initialised KB it should be close to quiet.
