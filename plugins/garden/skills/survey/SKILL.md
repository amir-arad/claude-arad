---
name: survey
description: Survey the knowledge base for drift, staleness, broken references, unreachable or unsignposted docs and uncited code, and merge the findings into the typed backlog at .garden/backlog.md. Changes only the backlog.
disable-model-invocation: true
---

# Survey

Writes typed work items into `.garden/backlog.md` and stops. `/garden:tend` works them down;
`/garden:maintain` does both.

If the repository has only a legacy `.kb-gardener/`, stop and tell the user to run
`/garden:init` first. If it has no `.garden/backlog.md` at all, it has not been initialised —
same answer.

Read before starting:

- `${CLAUDE_PLUGIN_ROOT}/references/work-item-types.md` — the six types
- `${CLAUDE_PLUGIN_ROOT}/references/rule-catalogue.md` — what each rule measures
- `${CLAUDE_PLUGIN_ROOT}/references/discoverability.md` — the signposting model and synonym list
- `${CLAUDE_PLUGIN_ROOT}/references/contract.md` — the finding envelope every script emits

Also read when a finding needs interpreting:

- `${CLAUDE_PLUGIN_ROOT}/references/freshness-and-ownership.md` — staleness and ownership findings
- `${CLAUDE_PLUGIN_ROOT}/references/drift-prevention.md` — the same drift keeps coming back
- `${CLAUDE_PLUGIN_ROOT}/references/glossary.md` — a term in a finding or item is unclear
- `${CLAUDE_PLUGIN_ROOT}/assets/drift-report-template.md`, `${CLAUDE_PLUGIN_ROOT}/assets/kb-audit-report-template.md` — the user asks for a written report, not just the backlog

## Steps

1. **Pick one `--as-of` date** (today) and pass it to every script in the run. Different dates
   across one survey make the staleness findings incomparable — the one way to get a backlog
   that contradicts itself.
2. **Run the analyses in parallel** — a `Workflow` fanning out one agent per analysis, or parallel
   `Agent` calls when `Workflow` is unavailable — from the
   **repository root**:

   | Analysis | Command | Emits |
   |---|---|---|
   | Drift, staleness, ownership | `node ${CLAUDE_PLUGIN_ROOT}/lib/doc-audit.mjs <root> --as-of <date> --json` | `stale-doc`, `review-overdue`, `code-churn`, `renamed-reference`, `missing-reference`, `version-mismatch`, `missing-updated`, `future-updated`, `unowned`, `alias-owner`, `thin-doc`, `duplicate-title`, `missing-section`, `untracked-doc` |
   | Links and reachability | `node ${CLAUDE_PLUGIN_ROOT}/lib/doc-graph.mjs <root> --as-of <date> --json` | `dead-link`, `dead-anchor`, `duplicate-anchor`, `unreachable-doc` |
   | Code→doc citations | `node ${CLAUDE_PLUGIN_ROOT}/lib/cite-scan.mjs <root> --as-of <date> --json` | `uncited-directory`, `dead-citation` |
   | Signposting, re-balancing | agent reasoning, per `discoverability.md` | `unsignposted`, `oversized-doc`, `split-candidate` |

   A repository with no code tree has nothing for the citation analysis to read; skip it.
3. **Reconcile.** Several findings on **one doc** are one work item, not four. Hand-raised items
   (signposting, re-balancing, duplication) follow the item grammar in
   `${CLAUDE_PLUGIN_ROOT}/assets/backlog-template.md`.
4. **Merge** each envelope:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/lib/backlog-merge.mjs --backlog .garden/backlog.md --findings <envelope.json>
   ```

   It applies `won't do` suppression, already-open suppression and reconciliation, and
   re-relativises every finding path to the repository root.
5. **Report** items added per type, discarded and advisory counts, any unclassified rule (in
   caps), and degraded mode if it applied. Nothing is committed.

## Why it runs at the repository root

When the KB is a subdirectory of a code repository, KB docs legitimately reference files above
it — the code they explain. A run rooted at the KB cannot see them, so every such reference is
reported as missing. Root the run at the repository and read the findings whose paths fall
inside the KB. It is also the root the backlog's targets are relative to.

## Degraded mode: no git

On a tree that is not a git repository, `doc-audit.mjs` runs its frontmatter, ownership, link
and structural rules and skips the history-dependent ones (`code-churn`, `renamed-reference`,
`version-mismatch`, `untracked-doc`, and the git half of `stale-doc`). It reports
`summary.git_history: false` with a `notes` entry. Say it in the backlog header too — fewer
findings reads as a healthier KB unless something states otherwise.

## Rule classes

Every rule is classified in `lib/rule-types.mjs`, in exactly one of four ways. Print the table
with `node ${CLAUDE_PLUGIN_ROOT}/lib/backlog-merge.mjs --rules`.

| Class | What happens | Examples |
|-------|--------------|----------|
| mapped | becomes an item of one of the six types | `code-churn` → `stale-doc`, `missing-reference` → `broken-reference` |
| discarded | never an item, reported as a count with the reason | ownership, frontmatter metadata, `setup-check` scaffolding, external URLs |
| advisory | a real signal no type's done criteria fit; reported as a count for you to judge | `thin-doc`, `missing-section`, `duplicate-anchor` |
| unclassified | a bug in `rule-types.mjs` — the finding is **dropped** and reported in caps | any rule with no entry |

**Do not write an unclassified rule as an item typed with the rule name.** An item whose type is
absent from `work-item-types.md` has no done criteria, so tend either passes it vacuously or
retires work that was never attempted, and the item looks valid the whole time. Losing the
finding is the cheaper failure, and it is announced. When a detector gains a rule, `lib.mjs`
warns on stderr the first time it fires — classify it before trusting the sweep.

An **advisory** count is an invitation, not an item. If two `thin-doc` docs really are one
topic, raise a `re-balancing` item by hand with a description saying which docs merge into
which.

**Migrating an existing backlog.** Item identity is `[type]` + target, so when a rule starts
mapping to a taxonomy type, `won't do` entries under the old name stop suppressing and every
finding they silenced returns. Against a backlog written before such a change, run once:

```
node ${CLAUDE_PLUGIN_ROOT}/lib/backlog-merge.mjs --backlog .garden/backlog.md --migrate-types --dry-run   # then without it
```

It retypes items in both sections, collapses duplicates the retyping creates, and leaves lines
it cannot map alone while reporting them.

## What the detectors already reconcile

- **`stale-doc` fires once.** A doc declaring an `updated` date is judged against its tier's
  SLA; one that does not is judged against git history. Never both.
- **`thin-doc` fires once**, whether the doc is thin for the tree it documents or thin outright.
- **`unreachable-doc` walks breadth-first from the root doc**, so a mutually linked island that
  nothing outside points into is unreachable. There is no inbound-count orphan rule.
- **Ownership and hygiene rules are discarded**: `unowned`, `alias-owner`, `missing-updated`,
  `future-updated`, `future-date`, `untracked-doc`, and everything `setup-check.mjs` emits. See
  the closing note in `work-item-types.md` for when ownership comes back.
- **References are matched as path suffixes.** `missing-reference` fires only when a reference
  matches nothing in the tracked tree. Globs, template placeholders, home-relative paths and
  conventional stand-in names are skipped. A shorthand matching two real files is
  `ambiguous-reference` (advisory). Markdown *link* targets stay strict: a link resolves
  literally or it is `dead-link`.
- **`renamed-reference` requires the reference to be the renamed path** — it fires only when the
  reference resolves nowhere *and* is (a suffix of) the actual `old_path`, so an unrelated file
  that shares a basename cannot trigger it.

**Everything else is judgement and stays judgement.** Reconciliation, staleness calls,
re-balancing decisions and the signposting analysis are not scripts and must not become scripts.

## Limits

- The signposting analysis is per-doc reasoning; its cost scales with KB size. Scope it by
  subtree before pointing it at anything large.
- `won't do` matches on `[type]` + path. A renamed doc strands its entry and the finding
  returns; `/garden:review` reports stranded entries.
- On a personal KB with no `owner` frontmatter anywhere, the ownership rules fire on every doc
  and are discarded wholesale. There is no traffic data and no aggregate score, by design.
