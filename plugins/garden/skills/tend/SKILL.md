---
name: tend
description: Work the knowledge-base backlog down one item at a time — fix each item with a subagent, verify it against its type's done criteria, delete it on pass, retire it to won't do on fail.
disable-model-invocation: true
---

# Tend

Consumes items from `.garden/backlog.md`. If the repository has only a legacy
`.kb-gardener/`, stop and tell the user to run `/garden:init` first.

Read before starting:

- `${CLAUDE_PLUGIN_ROOT}/references/work-item-types.md` — every type's done criteria. Nothing
  can be verified without it.
- `${CLAUDE_PLUGIN_ROOT}/assets/backlog-template.md` — the backlog format contract.

Also read when a fix needs it: `${CLAUDE_PLUGIN_ROOT}/references/documentation-standards.md` and
`${CLAUDE_PLUGIN_ROOT}/references/information-architecture.md` (writing or placing docs),
`${CLAUDE_PLUGIN_ROOT}/references/freshness-and-ownership.md` and
`${CLAUDE_PLUGIN_ROOT}/assets/doc-ownership-charter.md` (ownership items),
`${CLAUDE_PLUGIN_ROOT}/references/glossary.md` (terms).

**Dirty tree.** Tend edits in place and commits nothing. On a dirty working tree its edits mix
with yours — warn the user before starting.

## Loop

One item per iteration:

1. **Read the whole backlog and decide what to work on.** Reason about it — what unblocks other
   items, what is cheap, what has the most readers behind it, what you have already done this
   session. State the reasoning before acting. There is deliberately no priority field to sort
   by; do not invent one.
2. **Dispatch one subagent** to fix that item, and only that item.
3. **Check the type's done criteria.** They are checkable properties of the resulting files,
   not impressions.
   - pass → delete the item from `## open`
   - fail → move it to `## won't do` with a reason in the three-field grammar
     (`attempted: …; observed: …; revisit if: …`), attributed `(garden)` — or
     `(garden, maintain <as-of>)` when running inside `/garden:maintain`
4. Repeat until the backlog is empty or you are told to stop.

**Delete only after verification, never on dispatch.** A fix that silently failed and a fix
that worked must not look the same.

**The failure exit is not optional.** Without it, an item that cannot be fixed sits in `open`
forever and gets re-picked every session. Retiring it to `won't do` is what makes the loop
terminate. `observed:` is the field that matters: a stated attempt with no stated outcome is
worse than no reason at all.

**Never retire an item for an environmental failure** — a subagent that timed out, a missing
tool, a dirty tree. Leave it open and say so. `won't do` means "attempted and should not be
attempted again", not "this run had a bad night".

**Destructive fixes never lose content.** A `duplication` merge leaves a redirect at the old
path; a `re-balancing` split leaves the old path pointing at the new pieces. Both are done
criteria, so a fix that deletes instead fails verification.

## The backlog

`.garden/backlog.md` sits at the repository root, above both the KB and the code, because
`source-discoverability` items target source paths. All item targets are relative to that root.

Two sections, `## open` and `## won't do`. No `## done`: completed items are deleted outright.
Across sessions tend therefore cannot see what it previously picked — a deliberate trade for a
file that stays small. The KB itself is the real memory: a genuinely fixed item stops being
detected. `/garden:review` replays the file's git history when that memory is needed.

Legacy `won't do` entries attributed `(kb-gardener)` or `(kb-gardener, cycle <date>)` are left
as they are.

## Report

Items fixed, items retired (each with its reason), items left open and why. Nothing is
committed — the user reviews the diff.
