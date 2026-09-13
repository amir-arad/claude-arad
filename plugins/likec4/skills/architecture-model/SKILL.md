---
name: architecture-model
description: >
  Use when a system needs C4 architecture diagrams that stay true over time — creating a
  LikeC4 model from scratch, adding a container or component, reviewing an existing model,
  or fixing diagrams that have drifted from the code. Triggers on "C4", "context diagram",
  "container diagram", "component diagram", "architecture diagram", "system landscape",
  "architecture model", or a request to document how a system is put together for a
  specific audience. Decides what goes in the model and what evidence admits it; exact
  LikeC4 syntax comes from the likec4-dsl skill.
license: MIT + Commons Clause
metadata:
  version: 2.0.0
  author: amir
  category: engineering
  domain: architecture
  tags: [c4, likec4, architecture, diagrams, documentation]
  updated: 2026-09-13
---

# Architecture Model

A C4 model is **one model, many views**. You describe the software once — people, systems,
containers, components, and the relationships between them — and generate Context (L1),
Container (L2) and Component (L3) views from it. Code-level (L4) diagrams are generated
from source or not drawn at all.

The failure mode this skill exists to prevent: hand-drawn boxes that were true once. If a
diagram is not derived from a single text model kept beside the code, it will drift.

## Tooling

- **Source format: LikeC4** (`.c4` / `.likec4` files). One project, one model, all views.
- **Syntax: the `likec4-dsl` skill.** This skill decides *what* to model; for *how* to write
  it — specification, element kinds, predicates, deployment, views — defer to `likec4-dsl`.
  If it is not installed, read `https://likec4.dev/llms.txt` rather than guessing syntax.
- **Querying an existing model: the `likec4` MCP server** (shipped with this plugin) —
  `list-projects`, `search-element`, `read-element`, `find-relationships`, `query-graph`,
  `element-diff`. Prefer it over grepping `.c4` files when reviewing or checking drift.
- **Validation:** `npx likec4 validate` — syntax and reference errors. It does not check the
  modeling rules below; `assets/review-checklist.md` does.

A model already exists in another format (Structurizr, Mermaid, draw.io)? Migrate it to
LikeC4 once and delete the original. Never keep two canonical models.

## Creating a model

1. **Name the audience and the scope.** One system in scope, everything else is external.
   If you cannot name who reads the diagram, stop and ask.
2. **Declare the vocabulary** in `specification`: element kinds for person, system,
   container, component (and datastore/queue if you style them differently), plus an
   `external` tag.
3. **Gather facts per the evidence rules below.** See `references/fact-gathering.md`.
4. **Write L1** — people and software systems only. No technology. Soft sources allowed,
   then grounded (see below).
5. **Write L2** — containers = separately deployable/runnable things (app, service, SPA,
   database, queue, cron). A library is *not* a container. Code only.
6. **Write L3 only where it earns it** — for containers whose internals are non-obvious.
   Most containers should have no component view. Code only.
7. **Every element gets a description; every container a `technology`; every relationship a
   verb-phrase title and a `technology`.** "Uses" is not a title. "Reads order events from"
   with `technology "Kafka"` is.
8. **Views:** at least one system context (or landscape) view; a container view whenever
   containers exist.
9. Run `npx likec4 validate`, then walk `assets/review-checklist.md`.

## Evidence rules — what each level may be built from

Different levels have different admissible evidence. Getting this backwards produces the two
classic failures: an L1 that only reflects the code's shape and none of the business intent,
and an L2/L3 that reflects a doc someone wrote two years ago.

| Level | Admissible sources | Grounding requirement |
|---|---|---|
| L1 (Context) | Soft sources: KB entries, ADRs, README, published API docs and specs, runbooks, logs, metrics, dashboards, traces, tickets, conversations with owners | For an **existing** system, every element and relationship must also be confirmed by evidence in the code or infrastructure. Soft sources propose; code confirms. |
| L2–L4 | The code and its deployment/infrastructure config **only** | No doc, no diagram, no memory, no assumption. Read the artefact. |

**L1 procedure for an existing system:**
1. Draft from soft sources — they carry intent, business purpose, and who the actors are,
   which the code does not state.
2. Ground each drafted element and relationship against code or infra: an actual client,
   route, credential, queue binding, or deploy target. Cite the file for each one while you
   work.
3. Anything ungrounded is a **finding, not a box.** Either delete it, or keep it with its
   description stating explicitly that it is unverified — and raise it with the owner.
   Never let a soft source alone put an arrow on the diagram.

**L2–L4 procedure:** derive purely from artefacts, then read the level above it (L1 for L2,
L2 for L3) **for context only** — to name things consistently, to know which system is in
scope, and to know which relationships matter to a reader. The abstract level never supplies
a fact to the concrete one; it only frames it. If L2 contradicts L1, L2 wins and L1 gets
corrected.

For a system that does not exist yet, all levels are hypothetical by definition — say so in
the model, and re-ground every level once it ships.

## Maintaining a model

The model is a code artifact. Treat drift as a bug.

- Change the model in the **same commit** as the change that made it wrong.
- Adding/removing a deployable or a datastore ⇒ L2 must change. No exceptions.
- Renaming a service ⇒ rename in the model, do not add an alias.
- Deleting code ⇒ delete the element. An element with no live counterpart is a lie, not
  history; the history is in git.
- Review triggers: new dependency in a manifest, new infra resource, new queue/topic,
  a service split or merge.

See `references/maintenance.md` for drift signals and periodic review.

## Common mistakes

| Mistake | Fix |
|---|---|
| Container view shows classes/modules | Containers are deployable units. Move detail to L3. |
| Every container gets a component view | Only where internals are non-obvious. |
| Relationships titled "uses"/"calls" | Verb + what flows, plus `technology`. |
| External systems modelled as internal | Anything you don't deploy is external — tag it `#external`, grey it out. |
| Model in a docs repo diverging from code | Move the `.c4` files next to the code they describe. |
| Two models (LikeC4 + another format) | One canonical source. Delete the other. |
| L4 class diagrams hand-drawn | Generate from source, or skip L4. |
| L2/L3 element sourced from a doc or README | Delete it and re-derive from the code. |
| L1 built only from the code | Missing business intent — draft from soft sources first, then ground. |
| Ungrounded L1 arrow left on the diagram | Delete, or mark unverified in its description. |
| L1 used to justify an L2 fact | The abstract level frames, never supplies. Read the artefact. |
| `likec4 validate` clean, so the model is right | Validate checks syntax. Truth needs the checklist. |

## References

- `references/notation.md` — levels, elements, relationships, layout rules
- `references/fact-gathering.md` — how to derive elements from a repo
- `references/maintenance.md` — where the model lives, drift signals, periodic review
- `assets/review-checklist.md` — per-PR checklist
