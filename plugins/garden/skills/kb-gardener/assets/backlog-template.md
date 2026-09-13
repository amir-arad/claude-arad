# kb-gardener backlog

<!--
FORMAT CONTRACT — both halves of kb-gardener and backlog-merge.mjs depend on this.

Item line:  - [<type>] <target> — <description>
  <type>        one of the types in references/work-item-types.md, in square brackets
  <target>      path relative to this file's directory (the backlog root),
                posix separators. A trailing "/" marks a directory target.
  " — "         em dash surrounded by single spaces; separates target from description
  <description> free prose, SINGLE LINE. The item regex is line-anchored, so a wrapped
                description is silently truncated at the newline and any field after the
                wrap is lost. Long reasons stay long; they do not wrap.

won't-do lines carry a trailing attribution: "(human)", "(kb-gardener)", or
"(kb-gardener, cycle YYYY-MM-DD)" when retired by an unattended cycle run.

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

- [indexing-discoverability] docs/ops/deploy.md — unreachable from root doc
- [source-discoverability] src/auth/ — no citations to any KB doc
- [re-balancing] docs/ops/deploy.md — 900 lines spanning 4 distinct topics
- [broken-reference] docs/index.md — links to docs/setup.md, which does not exist

## won't do

- [stale-doc] docs/adr/ — attempted: none; observed: ADRs are immutable once accepted, so correcting one would falsify the record; revisit if: an ADR is ever superseded in place (human)
- [re-balancing] docs/ops/api.md — attempted: cut at the H2 seams; observed: the auth walkthrough spans sections 2 and 4, both halves broke; revisit if: auth moves into its own section (kb-gardener)
