---
name: capture
description: Turn raw material — notes, research reports, transcripts, findings — into knowledge-base notes with provenance, placed and linked so they can be found.
argument-hint: "<paths or pasted text> [what to capture]"
disable-model-invocation: true
---

# Capture

Input: `$ARGUMENTS` — file paths, pasted text, or a description of what in this conversation to
capture. If empty, ask what to capture.

Capture records what the material says. It does not propose, judge or extend: no "you might
also consider", no conclusions the source does not state. Agreement bias while recording is the
specific harm to avoid.

## Before writing

1. Find the KB: the path linked from the repository's `CLAUDE.md` knowledge-base section (e.g.
   `kb/`), or the repository root when the repository is the KB. If neither exists, tell the
   user to run `/garden:init` and stop.
2. Read `.garden/DOMAIN.md` if it exists — its types, categories and templates govern the notes.
3. Read the KB index and the docs nearest the material's subject, so new notes link to what is
   already there instead of repeating it.

## Writing notes

- **One concept per note.** One input may produce several notes; several inputs may update one
  existing note instead of creating a new one. Prefer extending an existing note over a near-
  duplicate — a duplicate is a future `duplication` item.
- **File name:** `kebab-case.md`, naming the concept.
- **Placement:** the category folder `DOMAIN.md` assigns to the note's type; without a
  descriptor, the existing KB folder where similar notes live.
- **Frontmatter:**

  ```yaml
  ---
  date: YYYY-MM-DD            # today
  related: []                 # paths of notes this one links to
  synthesized_from:
    date: YYYY-MM-DD          # when the source was produced
    topic: "<what the source is about>"
    tool: <claude-code | file | web | ...>
  ---
  ```

  Add `type:` and the template's sections only when `DOMAIN.md` defines types. Do not invent a
  type system when there is none.
- **Body:** a `# H1` naming the subject, then the content. Link related notes with ordinary
  markdown links. Quote sources where wording matters.

## Making it findable

Every new note gets an entry in the KB index (or the hub its siblings are reached through).
The link text must contain a content word from the note's own `# H1` — the signposting
criterion in `${CLAUDE_PLUGIN_ROOT}/references/discoverability.md`. A note nobody can reach is
not captured.

## Report

Notes created and updated (paths), index entries added, and anything in the material left
uncaptured and why. Nothing is committed — the user reviews the diff.
