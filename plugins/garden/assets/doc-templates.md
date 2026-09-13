# Onboarding Documentation Templates

Read this when generating the actual onboarding documents (Phase 3) — it holds the architecture
overview, key file map, local setup, and debugging guide templates plus the audience-specific
customization additions.

## How to use these templates

Every template below is **structure with placeholders**, not content to copy. A placeholder in
`<angle brackets>` is a slot you fill from something you observed; the line under each template
says where the value comes from. Two rules govern the fill:

1. **Every value is sourced.** It comes from the `scan` tool's output, the `setup-check` tool's
   output, a file you opened, a command you ran, or a log/CI/issue-tracker string you read.
   Nothing is plausible-sounding filler.
2. **A slot you cannot source stays visible.** Write `<unknown: no CI config found>` or drop the
   row. An invented value is worse than a gap, because the reader cannot tell it is invented and
   will act on it.

This matters most in the debugging guide, where this skill's own success criterion
(`../references/doc-quality.md`) is that every error string is real and collected, never
invented. A template that ships example errors invites exactly the failure it forbids — so
there are none here.

Where a fragment is shown purely to make the shape legible, it is fenced and labelled
**ILLUSTRATIVE ONLY — do not copy**. Those blocks describe a codebase that does not exist.

## Architecture Overview Template

```markdown
## Architecture

### System Diagram

<ASCII or Mermaid diagram, drawn by you from the real call and data flow>

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| <layer> | <technology + version> | <what it does here, and why it was chosen if the repo says> |
```

Sourcing:

- **Diagram** — nodes come from what you confirmed exists (entry points, services in the
  compose/k8s manifests, datastores named in config); **edges come only from imports and calls
  you read**. `scan` gives `entry_points`, `top_directories`, and `tree` as the starting
  inventory — it does not give you edges, and does not draw the diagram.
- **Layer rows** — one row per layer the code actually supports. Do not emit a layer because a
  directory is named after it.
- **Technology + version** — `tech_stack` and `frameworks` from `scan`, with versions read
  from the manifest and lockfile. If `tech_stack` is empty, say no manifest was detected rather
  than guessing.
- **Purpose / why chosen** — only from an ADR, README, or code comment you can point at.
  Omit the "why" column entirely if the repository never states one.

<details>
<summary>ILLUSTRATIVE ONLY — do not copy</summary>

The shape a filled diagram takes, for a codebase that does not exist:

```
<client>
    │
    v
[<http entry point>]
    ├──> [<datastore>]
    └──> [<external service>]
```

</details>

## Key File Map Template

```markdown
## Key Files

Priority files — read these first to understand the system:

| Priority | Path | What It Does | When to Read |
|----------|------|-------------|-------------|
| <n> | `<path>` | <what it does, from reading it> | <first day / first week / when touching X> |

Dangerous files — coordinate before modifying:

| Path | Risk | Coordination Required |
|------|------|----------------------|
| `<path>` | <blast radius you can justify> | <the actual process this team uses> |
```

Sourcing:

- **Paths** — candidates come from `key_files`, `entry_points`, and `git_hotspots` in the
  `scan` envelope. Every path must exist in the repository; check before you write the row.
- **Priority** — rank by edit frequency (`git_hotspots`) combined with coupling and blast radius
  you established by reading. Cap the table at 15-20 rows.
- **What it does** — from opening the file. One sentence, specific to this file.
- **When to Read** — your judgement, expressed as an occasion ("before changing the schema"),
  not a duration.
- **Risk / Coordination** — a file belongs in the dangerous table only if you can name what
  breaks. The coordination column describes the team's real process (CODEOWNERS, a review rule,
  a named reviewer) or the row is omitted; do not invent an approval chain.

## Local Setup Guide Template

````markdown
## Local Setup

### Prerequisites

| Tool | Required Version | Install Command |
|------|-----------------|----------------|
| <tool> | <version constraint, verbatim from the manifest> | <command from the repo's own docs, or a link> |

### Steps

**Step <n>: <what this step accomplishes>**
```bash
<commands, verbatim from the repo's scripts/Makefile/CI config>
```

### Verify Everything Works

- [ ] <a check with an observable pass condition>
````

Sourcing:

- **Prerequisites** — versions come from `engines`, `.nvmrc`, `.python-version`,
  `pyproject.toml`, `go.mod`, `rust-toolchain`, the Docker base image, or the CI matrix.
  Copy the constraint as written; do not round or modernize it.
- **Steps** — each command is one that exists in `package.json` scripts, a `Makefile` target,
  `pyproject.toml`, or the CI workflow. If the repo has no such command, the honest step is
  "no documented command exists" plus what you did instead, verified by running it.
- **Step timings** — omit them unless you actually timed the step on a real machine. Invented
  minute counts are the most-copied and least-true part of any setup guide.
- **Infrastructure steps** — include only if `docker-compose.yml`, a devcontainer, or an
  equivalent is present. `setup-check` reports whether a compose file and an
  `.env.example` exist.
- **Environment variables** — from `.env.example` reconciled against the `process.env` /
  `os.environ` reads in the code (fact-gathering step 6). Never publish a real secret value.
- **Verification checks** — each must have an observable pass condition you have seen pass.
  A test command counts; "the app should work" does not.

## Debugging Guide Template

````markdown
## Debugging Guide

### Common Errors and Fixes

**`<the exact error string, copied from a log, CI run, or issue>`**
```
Cause: <why it happens in this codebase>
Fix: <the command or change that resolves it>
Verify: <how the reader confirms it worked>
Source: <where this error was observed — CI job, issue number, log>
```

### Where to Find Logs

| Environment | Location | Command |
|-------------|----------|---------|
| <environment that exists for this project> | <where its logs live> | <command or link> |

### Useful Diagnostic Commands

```bash
# <what this answers>
<command, run at least once by you>
```
````

Sourcing:

- **Error strings** — collected, never authored. Sources: CI logs, the issue tracker, error
  handling and `throw`/`raise` sites in the code, and the project's support channel. Keep the
  `Source:` line while drafting so a reviewer can check each one; it may be dropped at publish
  time if the team prefers, but not before it has been verified.
- **A guide with no verified errors ships with no error section**, and says so. An empty
  section is a truthful signal that error collection has not been done yet.
- **Environments** — only those the repository gives evidence for (deploy workflows, env
  configs). Do not assume staging and production exist.
- **Diagnostic commands** — run each one before documenting it.

## KB Practice Note

The four templates above describe a *system* — what it is, how to run it, where things live.
This one records what was *learned*, which is a different shape and the one a knowledge base
accumulates over time. Use it for a note that makes claims rather than giving directions.

The two named sections are the point. Without an evidence base a reader cannot tell a measured
claim from a plausible one; without a limits section the note's silence reads as coverage, and
a later maintainer has no way to know what was never checked. Both are cheap to write while the
work is fresh and impossible to reconstruct afterwards — the same asymmetry as a `won't do`
reason, for the same reason.

```markdown
---
title: <Sentence-case title naming the subject>
owner: <name>
updated: <YYYY-MM-DD>
tier: <critical | core | reference | archive>
---

# <Title Case Title>

<Two or three sentences: what happened, and what this note is for. Name the thing that
changed the reader's model, not the topic area.>

## Evidence base

<Where the claims come from: which repository, which dates, which runs, what scale. If a
number appears anywhere below, its provenance is here. If the evidence is external —
a paper, someone else's measurement — say so plainly and say it was not reproduced locally.>

| <Case or defect> | <Measured before> | <After> |
|---|---|---|
| ... | ... | ... |

## 1. <A claim, stated as a claim>

<The evidence, then what it means. One numbered section per claim so a reader can cite one.>

## 2. <The next claim>

...

## What this does not establish

- <What the evidence does not cover: sample size, single repository, one tool family.>
- <Which claims are analogy or inference rather than measurement.>
- <What was never compared against an alternative.>
```

**Sourcing:**
- **Evidence base** — real runs, dates and counts. "The counts are provenance for the claims
  below, not an invitation to re-measure them" is a legitimate note when the code that produced
  them is gone.
- **Numbered claims** — one idea each. A section that needs "and" in its title is two sections.
- **What this does not establish** — write it last and write it honestly. If a claim rests on
  one repository, say one repository. If it is structural analogy rather than measurement, say
  that; an analogy presented as a finding is the failure this whole section exists to prevent.

## Audience-Specific Customization

### Junior Developer Additions
- Explain acronyms on first use (ORM, RLS, JWT, etc.)
- Add a "read this first" ordered reading list of 5 files, drawn from the key file map
- Include screenshots for UI-related flows
- Link to external learning resources for key technologies
- Add a glossary section for domain-specific terms

### Senior Engineer Additions
- Link to Architecture Decision Records (ADRs) that exist in the repository
- Include performance benchmark baselines, if the project measures any
- Document known technical debt and planned improvements, citing issues
- Provide a security model overview with threat boundaries
- Share scaling limits and planned capacity changes

### Contractor Additions
- Define scope boundaries — which directories are in scope for their work
- Specify communication channels and response expectations
- Document the access request process for required systems
- Include time logging requirements and reporting cadence
- List prohibited actions (direct push to the default branch, schema changes, etc.)

Each addition is subject to the same sourcing rule: include the item only when the underlying
artifact exists. A link to an ADR directory that is not there is a dead link, and
`doc-drift-detector`'s link checker will report it.
