---
name: restructure
description: Split, merge, move or rename knowledge-base docs as instructed, repointing every link and leaving a redirect at every old path so nothing is lost or broken.
argument-hint: "<target path> <intent, e.g. split by topic | merge into x.md | fragment and interlink>"
disable-model-invocation: true
---

# Restructure

Input: `$ARGUMENTS` — the doc or directory to restructure and what to do with it, in free text.
If the intent is ambiguous (which seams, which survivor), state the interpretation you are
taking before editing.

The rules are the ones `tend` verifies for `duplication` and `re-balancing` items — read those
sections of `${CLAUDE_PLUGIN_ROOT}/references/work-item-types.md` first. A restructure is the
same edit, asked for directly instead of found by a survey.

Also read when choosing where pieces go: `${CLAUDE_PLUGIN_ROOT}/references/information-architecture.md`
(structure), `${CLAUDE_PLUGIN_ROOT}/references/documentation-standards.md` (titles and doc shape).

## 1. Baseline

From the repository root:

```
node ${CLAUDE_PLUGIN_ROOT}/lib/doc-graph.mjs <root> --json > <scratch>/before.json
```

Keep the `dead-link`, `dead-anchor` and `unreachable-doc` findings; the result is judged against
them.

## 2. Edit

- **Split:** cut at real topic seams; each piece gets a title naming its own subject. If no
  clean seam exists, do not force one — stop and say so.
- **Merge:** pick the survivor (most inbound links; on a tie, the one whose path fits the KB's
  structure); fold the others in as sections; no claim appears twice.
- **Move / rename:** use `git mv` when the file is tracked, so history follows. Then write the
  redirect stub at the old path — `git mv` leaves nothing there.
- **Fragment and interlink:** split as above, then link the pieces to each other where one
  genuinely refers to another.

In every case:

- **No content is lost.** Every claim in the original docs is in exactly one resulting doc.
- **Every old path still resolves.** A split original becomes an index stub listing the new
  pieces; a merged or moved original becomes a one-line redirect to its new location, with an
  anchor to the specific section when there is one.
- **Every inbound link is repointed**, anchors included, across the whole KB.
- **Every new doc is reachable** from the KB index with link text carrying its subject term
  (`${CLAUDE_PLUGIN_ROOT}/references/discoverability.md`).
- Never delete a file outright.

## 3. Verify

```
node ${CLAUDE_PLUGIN_ROOT}/lib/doc-graph.mjs <root> --json > <scratch>/after.json
```

Compare with the baseline: **no new** `dead-link`, `dead-anchor` or `unreachable-doc` finding.
Any new one is a defect in this edit — fix it before reporting.

## Report

A map of old sections → new files, redirect stubs left, links repointed, and the before/after
finding counts. Nothing is committed — the user reviews the diff.
