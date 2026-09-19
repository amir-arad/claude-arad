# garden backlog

<!--
FORMAT CONTRACT — survey, tend and backlog-merge.mjs depend on this.

Item line:  - [<type>] <target> — <description>
  <type>        one of the types in references/work-item-types.md, in square brackets
  <target>      path relative to this file's directory (the backlog root),
                posix separators. A trailing "/" marks a directory target.
  " — "         em dash surrounded by single spaces; separates target from description
  <description> free prose, SINGLE LINE. The item regex is line-anchored, so a wrapped
                description is silently truncated at the newline and any field after the
                wrap is lost. Long reasons stay long; they do not wrap.

won't-do lines carry a trailing attribution: "(human)", "(garden)", or
"(garden, maintain YYYY-MM-DD)" when retired by an unattended maintain run. Entries
attributed "(kb-gardener)" or "(kb-gardener, cycle YYYY-MM-DD)" predate the plugin rename
and are read the same way.

A won't-do <description> records why, in three fields, separated by ";":
    attempted: <what was tried>
    observed:  <what actually happened>
    revisit if: <the condition that would change the answer>
The suppression is permanent and nothing else reads it back, so this line is all a
later maintainer has. "observed" is the field that matters: a stated attempt with no
stated outcome hands the next reader a premise nobody checked, and measures worse than
recording no reason at all. "revisit if" gives a permanent entry its own trip-wire, so
a decision that expires can be noticed without re-litigating it.

Old entries that predate this grammar keep suppressing exactly as before. backlog-merge
warns about them and never blocks; suppression-review.mjs lists them.

Only two sections, both required, in this order: "## open", "## won't do".
There is no "## done" section — completed items are deleted outright.

Lines that are not item lines (blank lines, this comment, the header) are preserved
verbatim by backlog-merge.mjs.
-->

## open

## won't do
- [broken-reference] plugins/base-plugin/skills/skill-creator/eval-viewer/generate_review.py — attempted: read line 102; observed: transcript.md is a runtime file the eval run may produce in run_dir, looked up with .exists(); not a doc citation; revisit if: the code starts citing a repo doc named transcript.md (garden, maintain 2026-09-19)
- [broken-reference] plugins/base-plugin/skills/skill-creator/scripts/aggregate_benchmark.py — attempted: read line 381; observed: benchmark.md is the script's own output file written at runtime; not a doc citation; revisit if: the comment starts pointing at a repo doc (garden, maintain 2026-09-19)
- [broken-reference] plugins/garden/lib/doc-audit.mjs — attempted: read lines 218-226 and 505-509; observed: example.md, sample.md, docs/example.md are illustrations inside comments explaining stand-in-name handling; not citations; revisit if: those comments are rewritten to cite a real doc (garden, maintain 2026-09-19)
- [broken-reference] plugins/garden/lib/init-scaffold.mjs — attempted: read line 258; observed: docs/index.md is an illustrative path in a comment about root-KB link detection; not a citation; revisit if: the comment starts citing a repo doc (garden, maintain 2026-09-19)
- [broken-reference] plugins/garden/lib/lib.mjs — attempted: read line 17; observed: backlog.md and synonyms.md name files inside a target repo's .garden/ state dir; not docs of this repo; revisit if: the comment starts citing a repo doc (garden, maintain 2026-09-19)
- [broken-reference] plugins/other-models/lib/ask.mjs — attempted: read line 31; observed: AGENTS.md names a generic instruction-file convention the CLIs load; not a citation of a file in this repo; revisit if: the comment starts citing a specific repo file (garden, maintain 2026-09-19)
