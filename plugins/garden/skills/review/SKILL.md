---
name: review
description: Read the garden's durable state back without changing anything — what won't do is suppressing and whether the reasons still hold, what happened to past backlog items, how the agent instruction files are growing.
disable-model-invocation: true
---

# Review

The other commands act on the KB. This one acts on nothing: it reads the state garden has
accumulated and hands it to the user. It is for deciding whether the tool is still telling the
truth, not for getting work done.

Run all three from the repository root with the same `--as-of` (today):

| Analysis | Command | Answers |
|---|---|---|
| Suppressions | `node ${CLAUDE_PLUGIN_ROOT}/lib/suppression-review.mjs <root> --as-of <date>` | what is being silenced, why, and whether the reason still holds |
| Item lifetimes | `node ${CLAUDE_PLUGIN_ROOT}/lib/backlog-history.mjs <root> --as-of <date>` | what happened to past items — including fixes that did not hold |
| Instruction files | `node ${CLAUDE_PLUGIN_ROOT}/lib/instruction-growth.mjs <root> --as-of <date>` | how `CLAUDE.md`, `AGENTS.md` and the `SKILL.md`s are growing |

The backlog readers default to `.garden/backlog.md` and fall back to a legacy
`.kb-gardener/backlog.md`, noting it on stderr — pass that note on and suggest `/garden:init`.

**Why this exists.** `won't do` is permanent. An entry whose reason has expired keeps
suppressing and says nothing, so the tool goes quietly blind exactly where someone once had a
good reason to silence it. Completed items are deleted outright, so a fix that passed its done
criteria and later stopped holding looks like a new finding. Both records exist in git; this
reads them. Background: `${CLAUDE_PLUGIN_ROOT}/references/rationale-decay.md`.

**It reports and never acts.** It will not resolve a `revisit if:` condition, even when the
condition looks plainly met. That condition is English written for a person, and deciding it
has been met is a deletion decision. Recording a rationale is free and safe; acting on one is
not.

**Pass the honesty rules through.** `backlog-history.mjs` computes no rate below its minimum
sample and says so. `instruction-growth.mjs` labels its instruction count approximate: only the
change between revisions of one file is quotable, not the level. Do not restate either as a
number the tool refused to give.

History tools need git and a backlog with revisions; on a fresh backlog they report that there
is nothing to replay.
