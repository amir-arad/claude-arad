# Shared glossary

The vocabulary every skill in this library uses. `CONTRACT.md` settles the machine-readable
shapes; this settles the words in prose. Where a term below collides with a field name in
`CONTRACT.md`, the contract wins and this file explains how to talk about it.

The rule behind every entry: **one concept, one word, everywhere.** A reader moving between
`init`, `survey`, `tend`, `maintain`, `review`, `capture`, `restructure` and `dream` should never
have to work out whether two commands mean the same thing by different names.

## The table

| Preferred term | Retired synonyms | Meaning |
|---|---|---|
| **finding** | issue, drift instance, problem, check result, gap, debt | What a detector emits: one `CONTRACT.md` §1 record, per-tool, unreconciled. Has `severity`, `category`, `rule`. Does not have an owner, an estimate, or a definition of done. |
| **work item** | ticket, task, backlog entry, debt item, action | What survives reconciliation across tools into a backlog. Has a type from `references/work-item-types.md` and done criteria. Several findings can collapse into one work item; some findings become none. |
| **doc** | page, document, artifact, article, wiki page | A markdown file with a `CONTRACT.md` §7 doc extension. Use `doc` in prose and in rule names (`stale-doc`, `thin-doc`, `orphan-doc`). |
| **severity** | criticality, priority, impact | How bad a finding is: `critical` `high` `medium` `low` `info`. A property of a finding only. |
| **tier** | criticality, importance, doc priority | The consequence if a doc is wrong: `critical` `core` `reference` `archive`. A property of a doc, recorded in inventory data, never on a finding. |
| **importance** | severity, priority, weight | How much a checklist item matters: `required` `recommended` `optional`. `setup-check.mjs` only. |
| **unreachable** | orphan, orphaned page, disconnected doc | A doc not reachable by walking links from the root doc. The concept prose should use. `orphan-doc` was the old inbound-link-counting rule; it no longer exists. `unreachable-doc` replaced it. |
| **reachability** / **discoverability** | connectivity, link health, findability score | Whether and how well a reader can arrive at a doc by navigating. |
| **owner** | maintainer, responsible party, assignee | A **named human** accountable for a doc. Never a team, alias, or distribution list — a value shaped like one is a finding, not an owner. |
| **module assignment** | owner, code owner, ownership | Which team or area a *code* path belongs to. Never called ownership; that word is reserved above. |
| **rule** | check name, detector, rule id | The stable kebab-case machine key on a finding (`dead-link`, `stale-doc`). Cite rules by this exact string. |
| **run root** | project root, base dir, workspace | The single positional directory a run is reckoned against (`CONTRACT.md` §7). Every emitted path is relative to it. |
| **as-of date** | run date, today, timestamp | The date all age arithmetic is reckoned against (`CONTRACT.md` §5). |
| **fact** | metric, stat, observation-finding | A tool output that reports something true but not necessarily wrong (`cite-scan`'s citation edges, `scan`'s inventory). Facts do not carry severities. |

## Contested words

### "critical"

It meant four things. Three axes remain, all in the table above, all with distinct field
names (`CONTRACT.md` §4). The prose rule:

> **A sentence containing "critical" must make clear which axis it means** — either by naming
> the axis ("critical-severity finding", "Critical-tier doc") or by context so tight that no
> other reading is available.

Bare "the criticals" is not acceptable in either direction. "Critical pages" is ambiguous;
"Critical-tier docs" is not. Note also that the fourth old use — "critical" as an adjective
for urgency of remediation — has no field and no home: say what should be done first and why,
rather than labelling it.

### finding vs. work item

The distinction is **reconciliation**, not importance. A finding is what one tool saw. A work
item is what a human or an orchestrator decided to do about what several tools saw, together.

Consequences worth stating explicitly:

- Do not call a backlog line a finding, or a detector output a work item.
- Detectors do not emit work items and have no opinion about fixes; their `message` states the
  problem, not the remedy (`CONTRACT.md` §1).
- Two tools reporting the same doc produce two findings and, usually, one work item. That
  collapse is the reconciliation step, and it is where evidence-based findings outrank
  calendar-based ones.
- Some findings deliberately become no work item at all. `ownership-gap` is the standing
  example: on a KB whose docs carry no ownership frontmatter, it fires on every doc, and a
  finding matching everything distinguishes nothing. It is **not** a work item type there.
  It becomes one only if the KB starts using ownership frontmatter inconsistently, at which
  point the signal is the inconsistency rather than the absence.

### scores and bands

There are none. `CONTRACT.md` §6 removed every aggregate score from the code, and prose must
not describe one.

Retired **as band names**: `healthy`, `degrading`, `distrusted`, `failed`, `excellent`,
`good`, `stale`, `abandoned`. Also retired: "health score", "out of 100", "/100", "score up
N points", and any 0-100 range presented as a reading of KB quality.

Report instead what the tools actually emit and a reader can act on:

- how many docs were scanned,
- how many have findings,
- the five-key severity histogram (all five keys, zeros included),
- per-rule counts,
- the worst offenders by finding count.

`stale` survives as a plain English adjective ("a stale runbook") and as the `stale-doc` rule
name. It must never appear as a band, a grade, or a bucket a doc is sorted into.

`setup-check`'s completeness count is not an exception — it is a count over a fixed checklist,
and it must always be described that way rather than as a score.

### orphan

`orphan-doc` is a rule string in one script and stays there for machine compatibility. Prose
describes the concept as reachability: a doc is **unreachable** when no path of links leads to
it from the root doc. Inbound-link counting is a weaker approximation of the same property — a
doc with three inbound links from docs that are themselves unreachable passes an orphan check
and is still unreachable. When both are in play, say which one is being measured.

### owner

`knowledge-ops` means a named accountable human, and its findings (`unowned`, `alias-owner`)
are built on that meaning. `doc-drift-detector` used the same word loosely for "which team or
module this code belongs to". That second sense is now **module assignment** and never
"owner", "ownership", or "owned by".

### deletion

Deletion advocacy in prose is addressed to **a human with confirmed deletion authority**.
Automated and agent-driven runs never delete: knowledge-ops' non-interactive defaults archive
or redirect only, and garden forbids agent deletion outright. Any passage recommending
deletion must name which of the two situations it is talking about.
