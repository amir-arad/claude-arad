---
name: maintain
description: Survey the knowledge base into the backlog, then tend every open item, in one unattended run. Lists every permanent retirement in the closing report.
disable-model-invocation: true
---

# Maintain

Survey, then tend, in one invocation. There is no third algorithm and no shortcut between the
halves:

1. Follow `${CLAUDE_PLUGIN_ROOT}/skills/survey/SKILL.md` exactly. The merge writes the backlog
   to disk.
2. Follow `${CLAUDE_PLUGIN_ROOT}/skills/tend/SKILL.md` exactly, re-reading the backlog from
   disk. Nothing is passed in memory, so a run that dies halfway leaves exactly the state a
   survey would have left.

Maintain is worth having because running the two by hand is friction paid every session, not
because they combine into something new.

**It does not stop to ask.** It surveys, merges, tends every open item, and reports at the end.
The user's review is the diff — nothing here commits.

## The cost: unattended `won't do` entries

A failed fix is retired to `won't do`, and `won't do` is permanent — it suppresses that type on
that path in every future survey. Run separately, each retirement is seen as it happens; here
they accumulate unwatched, and one written for a bad reason blinds the tool silently. So:

- Attribute retirements `(garden, maintain <YYYY-MM-DD>)`, using the run's `--as-of` date. One
  `grep` recovers everything a given run retired.
- **List every retirement in the closing report**, with its reason, under a heading saying they
  are permanent and worth reading now. Do not summarise them as a count.
- Never retire an item for an environmental failure. Leave it open and say so.

## Stop conditions

The backlog is empty, or every remaining item has been attempted once in this run. One attempt
per item per run: never re-pick an item this run already retired.

**Do not re-survey after tending.** Fixes change what a survey would find, so a second survey in
the same run would produce a backlog reflecting work the user has not reviewed yet. Run
maintain again when ready.
