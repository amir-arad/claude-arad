---
name: kb-gardener
description: >
  Tend a knowledge base over time — create one if none exists, survey it into a typed
  backlog of work items, then work that backlog down one item at a time, or do both in one
  pass. Generates missing docs from the codebase, audits drift, staleness, ownership, links
  and reachability, and turns all of it into work. Use when a KB needs continuous upkeep
  rather than a one-off audit, and when asked to survey a KB and fix what the survey finds.
  Also reviews its own durable state: what the backlog is suppressing and why, what happened
  to past work items, and how the agent instruction files are growing.
license: MIT + Commons Clause
metadata:
  version: 2.2.0
  author: amir
  category: business-operations
  domain: knowledge-management
  tags: [knowledge-base, documentation, discoverability, backlog, orchestration]
  updated: 2026-08-21
---

# KB Gardener

An audit tells you what is wrong. It does not tend anything. Run one twice and you get the
same list twice, including every item you already decided you did not care about — which is
why doc audits are read once and never again.

This skill has five execution modes, in this order over a KB's life. **Init** creates the
knowledge base and its scaffolding, once (though it is safe to re-run). **Survey** writes
typed work items into a backlog file. **Tend** takes items out of it, one at a time, and
fixes them. **Cycle** is survey immediately followed by tend, in one invocation, for the
common case where you always run both. **Review** reads the durable state back — what is
being suppressed and why, what happened to past items, and how the instruction files that
drive all of this are growing. It changes nothing.

Even inside a cycle the backlog file on disk is the only thing joining the two halves —
survey writes it and stops, tend reads it and works it down. Nothing is passed in memory,
so a cycle that dies halfway leaves exactly the state a survey would have left.

The backlog is the point. It is git-tracked, hand-editable, and carries a `won't do` section
that survives every future survey — so a rejected suggestion stays rejected instead of
resurfacing forever.

**Human review lives outside the session, at the merge gate.** Nothing here asks you
questions mid-run, and nothing commits. Tend leaves its edits uncommitted; you read the diff
before it becomes permanent. That is the safety net, and it is the only one.

## When to use this skill

- A project with **no knowledge base yet**, or a half-started one — run `init`
- A KB you **return to** — the same docs, repeatedly, over months
- You want **upkeep between audits**, not another report
- Docs exist but are **hard to find** — reachable only if you already knew the word to search
- Source code has **drifted away from the docs that explain it**, with no citations either way
- You want doc findings **turned into work** rather than read
- You always run a survey and then fix everything it found — run `cycle`
- You want to know **what the backlog is silently suppressing**, or whether a past fix held — run `review`

This skill is self-contained: everything it needs lives in this folder. Version 2.0
absorbed three sibling skills — `knowledge-ops`, `doc-drift-detector`, and
`codebase-onboarding` — which no longer exist. Their analyses are `scripts/`, their
knowledge is `references/`, their templates are `assets/`.

What that consolidation gave up, deliberately: there is no longer a standalone documented
CLI or CI-gate recipe. **Init, survey, tend, cycle and review are the only ways in.** Gating a
pull request on doc health means running a survey in CI, not invoking a checker directly.

## The five modes

### Part 0 — init (creates the KB)

Run once per project. **Idempotent adopt-and-extend**: every step below adopts what is
already there and only fills gaps. Nothing is ever overwritten, so re-running init on a
half-built KB is safe and is the intended way to extend one.

1. **Scaffold.** `node scripts/init-scaffold.mjs <project-root> [--kb-path kb]`. It creates
   the KB directory, an empty `.kb-gardener/backlog.md` and `.kb-gardener/synonyms.md`, and
   the `CLAUDE.md` knowledge-base section if no link into the KB is there yet — and reports
   the docs that already exist plus which of the five standard topics (architecture, setup,
   deployment, runbooks, glossary) nothing covers. Read that report; it is the work list for
   the next three steps. Existing docs are **kept as they are** — do not regenerate them.
2. **Generate the missing docs.** Gather facts first —
   `node scripts/scan.mjs <project-root> --json` for the tech stack, entry points, key
   files and git hotspots, and `node scripts/setup-check.mjs <project-root> --json` for
   what the setup guide has to cover. Both report facts only; every judgement (layers,
   architecture pattern, diagrams, key-file ranking, prose) is yours to make from those
   facts plus reading the actual code. Follow
   `references/codebase-fact-gathering.md` for the method and the architecture-pattern
   signal table, write from the templates in `assets/doc-templates.md`, and check the
   result against `references/doc-quality.md`. Default to a mid-level engineer new to the
   codebase as the audience and Markdown as the format. Scope this to exactly the topics
   the scaffold reported missing. Write each generated doc into the KB directory under a
   path naming its topic.
   Never write over a doc the scaffold listed as already present, even when you think the
   generated version is better — that judgment belongs to a `stale-doc` or `duplication`
   item in a later survey, where it gets a diff and a merge gate.
3. **Write `kb/index.md`.** The scaffold deliberately does not, because the hub's entries
   must satisfy the signposting criterion in `references/discoverability.md` and only a
   reader of the docs can write them. One entry per doc in the KB — the ones you generated
   *and* the ones that were already there. Each entry's link text must contain a content
   word from that doc's own `# H1`, and the heading it sits under must not contradict it.
   Do this and the first survey finds every doc reachable and signposted; skip it and the
   backlog opens with an `indexing-discoverability` item for every doc in the KB. If
   `index.md` already exists, extend it with entries for the docs it is missing rather than
   rewriting it.
4. **Add source citations.** This step **edits source files, not docs** — say so before
   doing it. For each KB doc that genuinely describes a source directory, add one citation
   comment naming the doc's path at the top of that directory's entry-point file, in the
   file's existing comment syntax. Constraints, all of them hard: only where the doc really
   covers that code, never overwriting or rewording an existing comment, one citation per
   directory rather than per file, comments only — no behaviour changes. This is the
   code→doc direction `cite-scan.mjs` reads, so a citation added here shows up as an edge on
   the next survey and keeps a `source-discoverability` item from being raised.

Then run a survey. On a freshly-initialised KB it should be close to quiet — which is the
point of doing steps 3 and 4 during init rather than leaving them for tend.

### Part A — survey (writes items)

Runs a `Workflow` that fans out in parallel, one agent per analysis:

| Analysis | Command | Emits |
|---|---|---|
| Drift, staleness, ownership | `node scripts/doc-audit.mjs <root> --as-of <date> --json` | `stale-doc`, `review-overdue`, `code-churn`, `renamed-reference`, `missing-reference`, `version-mismatch`, `missing-updated`, `future-updated`, `unowned`, `alias-owner`, `thin-doc`, `duplicate-title`, `missing-section`, `untracked-doc` |
| Links and reachability | `node scripts/doc-graph.mjs <root> --as-of <date> --json` | `dead-link`, `dead-anchor`, `duplicate-anchor`, `unreachable-doc` |
| Code→doc citations | `node scripts/cite-scan.mjs <root> --as-of <date> --json` | `uncited-directory`, `dead-citation` |
| Signposting, re-balancing | agent reasoning, per `references/discoverability.md` | `unsignposted`, `oversized-doc`, `split-candidate` |

**Run at the repository root, not the KB directory**, when the KB is a subdirectory of a code
repo. KB docs legitimately reference files above the KB — the code they explain, the skill they
document — and a run rooted at the KB cannot see them, so every such reference is reported as
missing. Root the run at the repo and read the findings whose paths fall inside the KB. This is
also the root the backlog's targets are relative to.

Pass the **same `--as-of`** to every script in one survey. Different dates across a single
run make the staleness findings incomparable, which is the one way to get a backlog that
contradicts itself.

**Degraded mode: no git.** On a tree that is not a git repository, `doc-audit.mjs` runs its
frontmatter, ownership, link and structural rules and skips the history-dependent ones
(`code-churn`, `renamed-reference`, `version-mismatch`, `untracked-doc`, and the git half of
`stale-doc`). It reports `summary.git_history: false` and carries a `notes` entry saying so.
Say it in the backlog header too — a degraded run produces fewer findings, and fewer findings
reads as a healthier KB unless something states otherwise.

Findings converge, get reconciled into typed items, and are merged into the backlog by
`backlog-merge.mjs`. Read `references/work-item-types.md` for the type definitions and
`references/rule-catalogue.md` for what each rule actually measures.

**Every rule is classified in `scripts/rule-types.mjs`, in exactly one of four ways.**
Run `node scripts/backlog-merge.mjs --rules` to print the table.

| Class | What happens | Examples |
|-------|--------------|----------|
| mapped | becomes an item of one of the six types | `code-churn` → `stale-doc`, `missing-reference` → `broken-reference` |
| discarded | never an item, reported as a count with the reason | ownership, frontmatter metadata, `setup-check` scaffolding, external URLs |
| advisory | a real signal no type's done criteria fit; reported as a count for you to judge | `thin-doc`, `missing-section`, `duplicate-anchor` |
| unclassified | a bug in `rule-types.mjs` — the finding is **dropped** and reported in caps | any rule with no entry |

An unclassified rule used to be written as an item typed with the rule name itself. Do not
restore that: an item whose type is absent from `work-item-types.md` has no done criteria, so
Part B either passes it vacuously or retires work that was never attempted, and the item looks
valid the whole time. Losing the finding is the cheaper failure, and it is announced. When a
detector gains a rule, `lib.mjs` warns on stderr the first time it fires — classify it before
trusting the sweep.

**Migrating an existing backlog.** Item identity is `[type]` + target, so when a rule starts
mapping to a taxonomy type, `won't do` entries recorded under the old name stop suppressing and
every finding they silenced returns. Against any backlog written before this change, run once:

```
node scripts/backlog-merge.mjs --backlog <file> --migrate-types --dry-run   # then without it
```

It retypes items in **both** sections, collapses any duplicates the retyping creates, and leaves
lines it cannot map alone while reporting them.

An **advisory** count is an invitation, not an item. If two `thin-doc` docs really are one
topic, raise a `re-balancing` item by hand with the description saying which docs merge into
which — that is the hand-raised path `work-item-types.md` already describes for `duplication`
and `re-balancing`.

**Reconciliation is mostly done for you now.** Version 2.0 collapsed the duplicate rules at
the source rather than reconciling them afterwards, because two tools emitting the same rule
over the same tree was the old design's main cost:

- **`stale-doc` fires once.** A doc that declares an `updated` date in its frontmatter is
  judged against its tier's SLA; one that does not is judged against git history. Never both
  — the declaration is a maintainer's assertion, where git mtime is an accident of whoever
  last touched whitespace.
- **`thin-doc` fires once**, whether the doc is thin for the tree it documents or thin
  outright.
- **`orphan-doc` no longer exists.** Inbound-link counting called a mutually linked island
  "linked" when nothing outside it pointed in. `unreachable-doc` walks breadth-first from
  the root doc, so it is transitive and strictly stronger.
- **`ownership-gap` is not a type.** `unowned` and `alias-owner` are discarded by
  `backlog-merge.mjs` — they fire on every doc of a KB that records no owners anywhere,
  which is pure noise. See the closing note in `references/work-item-types.md` for the
  condition under which they come back. The same reasoning discards `missing-updated`,
  `future-updated`, `future-date` and `untracked-doc` (frontmatter and repository hygiene,
  not claims about content) and everything `setup-check.mjs` emits (repository scaffolding
  — real findings, but not KB work).

**References are matched as path suffixes.** A doc that establishes a full path and then writes
`routine-launcher.ts` in the next paragraph is referring to a real file, so `missing-reference`
fires only when a reference matches nothing in the tracked tree — not merely when it fails to
resolve against the doc or the root. Globs (`packages/*/test/**/*.test.ts`) are patterns and are
skipped, as are template placeholders (`${kb}/index.md`), home-relative paths (`~/.claude/...`)
and conventional stand-in names (`foo.mjs`, `example.md`) — a doc explaining a convention has to
write an example path. A shorthand matching two real files is `ambiguous-reference` (advisory, low), which is a
writing-clarity call rather than drift. Markdown *link* targets stay strict: a link either
resolves literally or it is `dead-link`.

**`renamed-reference` requires the reference to be the renamed path.** Matching git's rename
history by basename alone reported a correct `ports/task-store.ts` as renamed because an
unrelated `store/task-store.ts` became `adapters/real/sqlite-task-store.ts` — a structural
misfire in any hexagonal layout, carrying `severity: high` and `fix_type: auto` onto a document
that was right. The rule now fires only when the reference does not resolve anywhere *and* it is
(a suffix of) the actual `old_path`.

What still needs your judgement: several findings on **one doc** are one work item, not
four.

### Part B — tend (consumes items)

One item per iteration:

1. **Read the whole backlog and decide what to work on.** Reason about it — what unblocks
   other items, what is cheap, what has the most readers behind it, what you have already done
   this session. State the reasoning before acting. There is deliberately no priority field to
   sort by; do not invent one.
2. **Dispatch one subagent** to fix that item, and only that item.
3. **Check the type's done criteria** from `references/work-item-types.md`. They are checkable
   properties of the resulting files, not impressions.
   - pass → delete the item from `## open`
   - fail → move it to `## won't do` with a reason, attributed `(kb-gardener)` — or
     `(kb-gardener, cycle <as-of>)` when this is running inside a cycle
4. Repeat until the backlog is empty or you are told to stop.

**Delete only after verification, never on dispatch.** A fix that silently failed and a fix
that worked must not look the same.

**The failure exit is not optional.** Without it, an item that cannot be fixed sits in `open`
forever and gets re-picked every session, because completed work leaves no trace to learn from.
Retiring it to `won't do` is what makes the loop terminate.

**Destructive fixes never lose content.** A `duplication` merge leaves a redirect at the old
path; a `re-balancing` split leaves the old path pointing at the new pieces. Both are encoded
as done criteria, so a fix that deletes instead fails verification.

### Part C — cycle (survey, then tend to empty)

Run Part A exactly as written, then Part B exactly as written, in one invocation. There is no
third algorithm here and no shortcut between the halves: the merge writes the backlog to disk,
and tend re-reads it from disk. A cycle is worth doing because running the two by hand is
friction you pay every session, not because they combine into something new.

**It does not stop to ask.** Nothing in this skill asks questions mid-run, and cycle keeps that
property: it surveys, merges, tends every open item, and reports at the end. Your review is the
diff, as it is for tend on its own — nothing here commits.

That leaves one thing to be careful about, and it is the reason this section exists.

**Unattended `won't do` entries are the cost.** A failed fix is retired to `won't do`, and
`won't do` is permanent by design — it suppresses that type on that path in every future
survey. In tend-on-its-own you see each retirement as it happens. In a cycle they accumulate
while you are not watching, and a `won't do` written for a bad reason blinds the tool silently.
So, in cycle mode only:

- Attribute retirements as `(kb-gardener, cycle <YYYY-MM-DD>)`, using the run's `--as-of` date,
  rather than a bare `(kb-gardener)`. One `grep` recovers everything a given cycle retired.
- **List every retirement in the closing report**, with the reason, under a heading that says
  they are permanent and worth reading now. Do not summarise them as a count.
- Never retire an item for an environmental failure — a subagent that timed out, a missing
  tool, a dirty tree. Leave it open and say so in the report. `won't do` means "this was
  attempted and should not be attempted again", not "this run had a bad night".

**Stop conditions.** The backlog is empty, or every remaining item has been attempted once this
cycle. One attempt per item per cycle: a cycle must not re-pick an item it already retired,
which is the loop that a merged mode makes possible and the two-mode split prevented for free.

**A cycle does not re-survey after tending.** Fixes change what a survey would find, so a
second survey in the same run would produce a fresh backlog reflecting work you have not
reviewed yet. Run the next cycle when you are ready for it.

### Part D — review (reads durable state back)

The other four modes act on the KB. This one acts on nothing: it reads the state this skill
has accumulated and hands it to you. Run it when you are deciding whether the tool is still
telling you the truth, not when you want work done.

| Analysis | Command | Answers |
|---|---|---|
| Suppressions | `node scripts/suppression-review.mjs <root> --as-of <date>` | what is being silenced, why, and whether the reason still holds |
| Item lifetimes | `node scripts/backlog-history.mjs <root> --as-of <date>` | what happened to past items — including fixes that did not hold |
| Instruction files | `node scripts/instruction-growth.mjs <root> --as-of <date>` | how `CLAUDE.md` and the `SKILL.md`s are growing |

**Why this mode exists at all.** `won't do` is permanent and, until it, nothing ever read one
back. An entry whose reason has expired keeps suppressing and says nothing about it, so the
tool goes quietly blind in exactly the places someone once had a good reason to silence. The
same gap applies to completed items: they are deleted outright, so a fix that passed its done
criteria and later stopped holding was indistinguishable from a new finding. Both records
existed the whole time in git; nothing read them.

**It reports and never acts.** Specifically, it will not resolve a `revisit if:` condition,
even when the condition looks plainly met. That condition is English written for a person, and
deciding it has been met is a deletion decision. Recording a rationale is free and safe; acting
on one is neither, and an operator who automates "delete anything whose reason I can recover"
will delete things whose reason was real.

**Read the honesty rules as part of the output.** `backlog-history.mjs` computes no rate at all
below its minimum sample and says so — a hazard estimated from three revisions is decoration
that reads as authority. `instruction-growth.mjs` labels its instruction count approximate and
means it: the level is not quotable, only the change between revisions of one file is. Neither
tool is being coy; both are refusing to manufacture the number you would rather have.

## The backlog

`.kb-gardener/backlog.md`, at the repo root when the KB is a subdirectory of a code repo —
`source-discoverability` items target source paths, so the backlog has to sit above both.
All item targets are relative to that root.

Format contract is `assets/backlog-template.md`. Two sections, `## open` and `## won't do`.
No `## done`: completed items are deleted outright and leave no trace.

That has a consequence worth stating plainly — across sessions, Part B cannot see what it
previously picked. It reasons well within one run and starts fresh the next. This is a
deliberate trade for a file that stays small and readable, and the KB itself is the real
memory: a genuinely fixed item stops being detected.

## Files

| File | Purpose | Command |
|------|---------|---------|
| `scripts/init-scaffold.mjs` | Init only. Create the KB dir, empty backlog and synonym list, and the CLAUDE.md link section — each only if absent. Inventory existing docs and report which standard topics are uncovered | `node scripts/init-scaffold.mjs [root] [--kb-path <dir>] [--json] [--as-of <date>]` |
| `scripts/backlog-merge.mjs` | Merge contract findings into the backlog, applying `won't do`, already-open suppression, and cross-tool reconciliation. `--rules` prints the rule classification table | `node scripts/backlog-merge.mjs --backlog <file> --findings <file\|-> [--stdout] [--dry-run] [--json] [--rules]` |
| `scripts/rule-types.mjs` | The rule → work-item-type classification, plus the deliberately discarded and advisory rules. Module only, no CLI — read it through `backlog-merge.mjs --rules` | — |
| `scripts/doc-audit.mjs` | Survey. Docs against the code and git history they describe, and against what their frontmatter declares: staleness, churn, renamed, missing and ambiguous references, ownership, duplicate titles | `node scripts/doc-audit.mjs [root] [--json] [--as-of <date>] [--min-severity <level>] [--scope <dir>]` |
| `scripts/doc-graph.mjs` | Survey. Link and anchor integrity, then breadth-first reachability from the root doc; hubs and leaves as facts | `node scripts/doc-graph.mjs [root] [--json] [--as-of <date>] [--root-doc <path>] [--hub-threshold <n>] [--check-external]` |
| `scripts/cite-scan.mjs` | Survey. Facts about code→doc citations: edges, dead citations, per-directory counts. Also emits each dead citation as a `dead-citation` finding | `node scripts/cite-scan.mjs [root] [--json] [--as-of <date>] [--min-severity <level>]` |
| `scripts/suppression-review.mjs` | Review. Read the backlog's `won't do` section back: stranded targets, reasons that record no observed outcome, what each directory target mutes, and each entry's `revisit if` condition. Never edits, never resolves a condition | `node scripts/suppression-review.mjs [root] [--backlog <file>] [--json] [--as-of <date>] [--min-severity <level>]` |
| `scripts/backlog-history.mjs` | Review. Replay the backlog's git history into per-item lifetimes: births, fixes, retirements, revivals, and **resurrections** — items closed and later re-detected. Computes no rate below its minimum sample | `node scripts/backlog-history.mjs [root] [--backlog <file>] [--json] [--as-of <date>] [--min-severity <level>] [--max-revisions <n>]` |
| `scripts/instruction-growth.mjs` | Review. How `CLAUDE.md`, `AGENTS.md` and every `SKILL.md` grew, revision by revision. Lines and bullets exact; the instruction count is a labelled approximation. Fact tool: no findings, always exits 0 | `node scripts/instruction-growth.mjs [root] [--json] [--as-of <date>] [--max-revisions <n>]` |
| `scripts/scan.mjs` | Init. Deterministic codebase inventory: tech stack, frameworks, entry points, key files, dependencies, LOC, git edit-frequency hotspots. Facts only, no findings | `node scripts/scan.mjs [root] [--json] [--commits <n>]` |
| `scripts/setup-check.mjs` | Init. Eleven-item repository setup checklist reported as a completeness count plus one finding per failing check | `node scripts/setup-check.mjs [root] [--json] [--min-severity <level>]` |
| `scripts/lib.mjs` | Shared helpers: the finding/envelope contract, arg parsing, the markdown link extractor, git history, doc inventory and SLA tiering | — |
| `references/work-item-types.md` | The taxonomy. Per type: detection signal, what a fix looks like, **done criteria**, and target granularity. Part B depends on it; read it before tending anything | — |
| `references/discoverability.md` | The reachability and signposting model, the edge rules, and the per-KB synonym list at `.kb-gardener/synonyms.md` that keeps the analysis stable between runs | — |
| `references/contract.md` | The machine contract every script implements: one finding record, one envelope, exit codes 0/1/2, `--as-of` determinism, no aggregate scores | — |
| `references/rationale-decay.md` | Why every durable decision here records *why*, and what a recorded reason must contain: the write-cheap/reconstruct-expensive asymmetry, why outcome-grounded rationale works where rationale-shaped text does not, and why writing one is safe while acting on one is not | — |
| `references/glossary.md` | The shared vocabulary — finding vs work item, the three axes `critical` could mean, retired band words. Check prose against it | — |
| `references/rule-catalogue.md` | What each rule measures, the five drift categories, and `auto`/`semi`/`manual` fix routing. Read when interpreting findings | — |
| `references/freshness-and-ownership.md` | Freshness SLA by tier, ownership models, and the anti-patterns (team aliases as owners, archiving because deleting feels risky) | — |
| `references/information-architecture.md` | IA patterns, duplication resolution, and why findability is usually a content problem rather than a search problem | — |
| `references/drift-prevention.md` | Coupling strategies and recurring drift patterns. Read when preventing drift rather than detecting it | — |
| `references/documentation-standards.md` | The doc conventions the checks assume — README sections, single-source versions, references naming real files | — |
| `references/codebase-fact-gathering.md` | Init. The fact-gathering method and the architecture-pattern signal table | — |
| `references/doc-quality.md` | Init. Verification checklist, common pitfalls, and success criteria for generated docs | — |
| `assets/backlog-template.md` | The backlog format contract: the item line grammar, the two required sections, and the `won't do` attribution suffix. `init-scaffold.mjs` writes an empty backlog in this shape and `backlog-merge.mjs` parses it | — |
| `assets/doc-templates.md` | Init. Templates for the architecture overview, key file map, setup guide and debugging guide, each naming where its values come from | — |
| `assets/doc-ownership-charter.md`, `assets/kb-audit-report-template.md`, `assets/drift-report-template.md` | Write-up templates | — |
| `assets/sample_kb.json`, `assets/sample_drift_data.json` | Contract-shaped fixtures, for exercising a consumer without running a tool | — |

Every script is Node 20+, builtins only, no dependencies, no install step. Each takes the
run root as a positional argument (default `.`), emits the standard envelope under `--json`,
reckons every date against `--as-of`, and gates its exit code with `--min-severity`: `0`
clean, `1` findings at or above the gate, `2` could not run. Unknown flags exit 2. Run any of
them with `--help` for the full contract.

**They compose.** Every analysis script emits a `references/contract.md` §2 envelope, and
`backlog-merge.mjs --findings -` consumes exactly that envelope. It translates each finding's
`rule` into a work item type via a single map documented in its `--help`; every finding `path`
is re-relativised from the envelope's `root` to the backlog file's directory before matching.
Unknown rules become items named after the rule and are listed as `unmapped`; `unowned` and
`alias-owner` findings are discarded by name, per the closing note in
`references/work-item-types.md`. Nothing is dropped silently.

**Reconciliation happens in the script, not only in prose.** Two findings on the same path
that map to the same type collapse into one item. Version 2.0 removed most of the work by
making the duplicate rules impossible to emit in the first place — see the survey section.

**`cite-scan.mjs` reports facts and judges nothing — with one exception.** It will not tell you
which code deserves documentation; it emits citation edges and per-directory counts including
zero, under `citations`, `dead_citations` and `directories`. Deciding whether a zero is a
problem is triage, and triage is prose. It scans exactly the shared `CODE_EXTENSIONS` set from
`scripts/lib.mjs` — no local supplement, and no data or markup files. Markdown itself is never
scanned, so doc→doc links stay out of scope by construction. The exception is a **dead
citation** — source code naming a KB path that is not there is a checkable defect with a file,
line and column, so those are also emitted as `findings` with rule `dead-citation`, category
`referential`, severity `high`, and `cite-scan` exits 1 when they meet the `--min-severity`
gate. That is what makes it pipeable into `backlog-merge.mjs`.

**`init-scaffold.mjs` is a mutation tool that judges nothing.** It reports what it created,
what was already there, the docs it inventoried and which standard topics are uncovered —
under `created`, `already_present`, `docs` and `topics`. Its `findings` array is always
empty, deliberately: a missing architecture doc is not a defect, it is the next step's work.
It writes no doc prose, picks no citation sites, and invents no severities. It also never
writes `kb/index.md`, because a hub with unsignposted entries is worse than no hub — see
step 3 above.

**Everything else here is judgment and stays judgment.** Reconciliation, staleness calls,
re-balancing decisions, and the indexing analysis are not scripts and must not become scripts.
Three scripts were deleted from the sibling skills for wrapping judgment in a string template
and emitting invented numbers. Do not write the fourth.

## Scope & limitations

- **The indexing analysis is per-doc reasoning**, so survey cost scales with KB size in a way
  the script-based scans do not. Scope it by subtree before pointing it at anything large.
- **`won't do` matches on `[type] + path`.** A renamed doc strands its entry and the finding
  returns. Type+path is also coarser than "problem": rejecting one `re-balancing` finding on a
  file suppresses a later, different one on that same file.
- **The ownership and freshness rules are thinner on a personal KB** than
  `references/freshness-and-ownership.md` implies — that model assumes org-scale frontmatter,
  traffic data, and ownership SLAs. On a KB with no `owner` frontmatter anywhere, `unowned`
  fires on every doc and is discarded wholesale.
- **No traffic data.** Nothing here knows what anyone reads. Every triage row keyed on views
  in `references/freshness-and-ownership.md` is inapplicable until you supply an inventory
  that carries `views_90d`.
- **No aggregate score, by design.** Report the severity histogram and the worst offenders
  instead — `references/contract.md` §6. If a single number is ever wanted, derive it from
  finding counts and say what it weighs.
- **Init's citation step writes to source files.** It is the only part of this skill that
  edits code rather than docs. The edits are comments only, but they land in your working
  tree uncommitted alongside everything else — read that diff.
- **Init is safe to re-run and never overwrites.** The flip side: it cannot repair a doc that
  exists and is wrong. That is a survey finding and a tend fix, not an init concern.
- **Review reports; it never acts.** Nothing in it edits the backlog, resolves a `revisit if`
  condition, or deletes a suppression. It also measures instruction-file growth without ever
  fixing it — trimming an instruction file is a judgement about what is still load-bearing,
  and that is precisely the judgement nobody can make once the rationale is gone.
- **Review's history tools need git and a file with revisions.** On a fresh backlog they report
  honestly that there is nothing to replay rather than inferring anything from one snapshot.
- **No git awareness by design.** Tend edits in place and leaves changes uncommitted. If you
  run it on a dirty working tree, its edits mix with yours.

## What 2.0 absorbed

This skill used to orchestrate three siblings through the `Skill` tool. They were merged in
and deleted. If you are looking for something that used to live in one of them:

| Was | Now |
|-----|-----|
| `knowledge-ops` — freshness, ownership, duplication, findability | `doc-audit.mjs` for the rules; `references/freshness-and-ownership.md` and `references/information-architecture.md` for the decision frameworks |
| `doc-drift-detector` — drift against code, link integrity, CI gate | `doc-audit.mjs` and `doc-graph.mjs`; `references/rule-catalogue.md` and `references/drift-prevention.md`. **The standalone CI-gate recipes are gone** — gate on a survey run instead |
| `codebase-onboarding` — generate docs from a codebase | Init step 2: `scan.mjs`, `setup-check.mjs`, `references/codebase-fact-gathering.md`, `assets/doc-templates.md`. **Generating docs for a codebase is now reachable only through init** |
| `_standards/` — the shared contract, glossary and vendored lib | `references/contract.md`, `references/glossary.md`, `scripts/lib.mjs`. Vendoring is gone; one skill cannot diverge from itself |

The merge collapsed four duplicated rules — see the survey section for which, and why the
deduplication happens at emission rather than in reconciliation.
