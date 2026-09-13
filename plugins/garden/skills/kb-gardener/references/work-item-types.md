# Work Item Types

The taxonomy both halves of kb-gardener agree on. Part A classifies every finding into exactly
one of these six types; Part B looks the type up here to decide whether the fix it just
dispatched actually landed.

Item line format is fixed by `assets/backlog-template.md`:

```
- [<type>] <target> — <description>
```

Read the **done criteria** as the contract they are. Part B checks them *after* the fix
subagent returns and *before* deleting the item; a fix that fails them does not get retried —
the item moves to `## won't do` with a reason attributed to `(kb-gardener)`. That makes a vague
criterion worse than no criterion: it either passes everything (item deleted, problem still
there) or fails everything (item retired, problem never worked again). Every criterion below is
written so an agent that just made the edit can confirm it by reading named files. If you add a
type, hold it to that bar.

## What a `won't do` reason has to say

A retirement is permanent: it suppresses that type on that target in every future survey, and
until `suppression-review.mjs` existed nothing read one back. The reason line is therefore the
entire record of why the tool is blind there, written once, for a reader who will not have the
context you have now.

Three fields, one line, separated by `;`:

```
- [re-balancing] kb/deploy.md — attempted: cut at the H2 seams; observed: the config walkthrough spans sections 2 and 4, both halves broke; revisit if: config material moves into its own section (kb-gardener)
```

- **`attempted:`** what was tried.
- **`observed:`** what actually happened. **This is the field that carries the value.** A
  reason naming an attempt with no outcome is not a weak reason — it is measurably worse than
  no reason at all, because it hands the next reader a premise that was never checked and
  invites them to build on it. See `rationale-decay.md`.
- **`revisit if:`** the condition that would change the answer. A permanent entry with a stated
  trip-wire can be noticed when it expires; one without can only be re-litigated from scratch.

Keep it on one line. The item regex is line-anchored, so a wrapped description is truncated at
the newline and every field after the wrap is silently lost.

Entries written before this grammar keep suppressing exactly as they did. `backlog-merge.mjs`
warns about them on stderr and reports them under `reason_quality`; it never blocks, and never
rewrites a reason it cannot recover. An outcome that was never recorded cannot be reconstructed
by a tool — that is the whole problem, not something the tool can paper over.

**Target granularity** matters because of one rule in `backlog-merge.mjs`: a `won't do` entry
whose target ends in `/` suppresses same-type findings on every path beneath it. A type that
emits directory targets is therefore cheap to silence wholesale; a type that emits file targets
must be silenced file by file. Both are useful; picking the wrong one is how a single `won't do`
line accidentally mutes an entire subtree.

---

## `stale-doc`

**Detection signal.** Two sources, and they do not agree:

- `knowledge-ops` flags a doc whose `updated` frontmatter date is older than the freshness SLA
  for its tier. This is a *calendar* claim: nobody has looked at this doc lately.
- `doc-drift-detector` flags a doc whose described code has commits after the doc's last commit,
  or whose documented symbols, paths, or version strings no longer match the repository. This is
  an *evidence* claim: the doc is wrong about something checkable.

**Reconciliation — one item, prefer git evidence.** A doc flagged by both produces a single
`stale-doc` item whose description is the drift evidence, not the date. A doc flagged only by
the SLA check, with no drift evidence behind it, is the weaker finding: on a personal KB most
docs have no `updated` frontmatter at all and the SLA check degenerates into "this file is old",
which is not a defect. Emit it only when the KB actually carries freshness frontmatter, and say
in the description that the basis is date-only so Part B knows the fix is a review pass rather
than a correction. When the two sources point at the same file, the git evidence wins the
description outright — a date is never the reason to edit a doc.

**What a fix looks like.** Read the doc, read the code it describes, correct the statements that
the drift evidence named: renamed symbols, moved paths, changed commands, superseded version
strings. Do not rewrite the doc wholesale; a rewrite makes the done criteria uncheckable and
buries the real correction in diff noise. If the doc describes something that no longer exists
at all, that is not a `stale-doc` fix — retire the item and let the next Part A run classify it
as `duplication` or `broken-reference`, whichever it actually is.

**Done criteria.**
1. Every specific claim named in the item description has been located in the doc and either
   corrected or removed. The fix report lists them one by one with the new text.
2. Every file path, symbol name, and command the doc mentions in the edited sections resolves in
   the repository as written.
3. If the KB uses freshness frontmatter, the doc's `updated` field is today's date. If it does
   not, no frontmatter was invented.
4. The doc's headings and section order are unchanged, or the change is stated in the report.

**Target granularity.** File. Directory targets appear only in `won't do`, for subtrees that are
frozen by design — `docs/adr/` being the canonical example.

---

## `broken-reference`

**Detection signal.** `doc-drift-detector`'s link check: a markdown link whose local target file
does not exist, or whose `#anchor` does not match any heading slug in the target document.
`cite-scan.mjs` contributes the mirror case — a **dead citation**, where source code names a KB
path that is not there. Both land here.

A reference written in prose rather than linked is resolved leniently — as a path suffix of a
real tracked file — because shorthand after a full path is normal writing, not drift. Only a
reference matching nothing anywhere becomes an item here; one matching several files is the
advisory `ambiguous-reference` instead. `renamed-reference` is the same defect with git history
attached, and lands here too: the fix is to repoint the reference, which is what the criteria
below check, not to correct a claim, which is what `stale-doc` checks.

External URLs are out of scope for this type. Nothing in kb-gardener makes network requests, and
a link that 404s on someone else's server is not a defect in this KB that an agent can verify a
fix for.

**What a fix looks like.** For each broken link, find where the target went — `git log --follow`
and a filename search over the KB usually settle it in one step — and repoint the link. If the
target was deleted rather than moved, either point at the doc that replaced it or remove the
link and the sentence that depended on it. Removing the link alone leaves a sentence promising
information that is no longer offered; that is a worse doc than the broken link was. For dead
citations in source code, fix the comment in the source file, not the KB.

**Done criteria.**
1. Every reference named in the item description now resolves: the target file exists at the
   linked path, and if the link carries an `#anchor`, a heading in that file produces that slug.
2. No link in the edited file points at a path that does not exist — the whole file is clean,
   not just the reported links.
3. Where a link was removed rather than repointed, the surrounding prose reads correctly without
   it; the fix report quotes the before and after sentence.
4. No new links were added to files other than the target file.

**Target granularity.** File — the file *containing* the broken link, not the missing target.
Two docs linking to the same missing doc are two items, because they are two edits.

---

## `duplication`

**Detection signal.** `knowledge-ops`' `duplicate-title` rule: two or more docs announcing the
same concept under the same title. Part A also raises this type by hand — when two docs
surfaced by different siblings turn out to describe the same thing, or when one doc restates a
section of another with no link between them. Those hand-raised cases have no rule behind them;
say in the description what the overlap actually is.

**What a fix looks like.** Pick the survivor — the most-linked doc, per inbound link counts;
where they tie, the one whose path matches the KB's own structure. Merge the unique material
from the others into it. Then, for every path being retired:

**Leave a redirect. Never silently delete content.** This is a hard rule, not a preference. The
retired path keeps existing as a stub whose entire body is a one-line pointer to the survivor.
Deleting the file breaks every link, bookmark, and past chat reference pointing at it, and does
so invisibly — the failure surfaces weeks later as a 404 nobody can trace back to this edit. A
fix that deletes a duplicate outright fails the done criteria below and the item is retired,
even though the content did get merged.

**Done criteria.**
1. The survivor doc contains every substantive claim that was unique to the retired docs. The
   fix report lists each migrated claim and where it landed.
2. Every retired path still exists as a file, and its body links to the survivor.
3. Every inbound link to a retired path, across the whole KB, either still resolves through the
   stub or has been repointed at the survivor. No link is left dangling.
4. Reading the survivor top to bottom, no claim appears twice — the merge produced one document,
   not two concatenated ones.

**Target granularity.** File — the *duplicate* to be retired, so that the survivor is named in
the description. This keeps one item per merge rather than one per cluster.

---

## `indexing-discoverability`

**Detection signal.** kb-gardener's own analysis, defined in `references/discoverability.md`: a
doc is not reachable by walking markdown links from the root doc, or it is reachable but a hop
on the path to it is not signposted under a term a reader would search for.

**This type subsumes inbound-link counting.** The old orphan-detector emitted
the `orphan-doc` rule by counting inbound links per doc. Reachability is strictly stronger: a
doc with three inbound links from docs that are themselves unreachable passes that check and
fails this one. So when Part A reconciles findings, **an unreachable doc produces exactly one
`indexing-discoverability` item.** There is no `orphan` type in this taxonomy — `orphan-doc` is
a rule string on the sibling's finding and nothing more, and Part A collapses those findings
into this type rather than emitting them in parallel. One unreachable doc, one fix, one item.

**What a fix looks like.** Add the doc to the index or hub doc that a reader would plausibly
reach first, with link text that carries the doc's own subject term. If no such hub exists and
the doc belongs to a cluster of similarly stranded docs, create one and link the new hub from
the root doc — but that is a larger edit and the report must say so. For a signposting failure
where the doc is already reachable, the fix is to rewrite the existing link text or the sentence
around it, not to add a second link.

**Done criteria.**
1. A link path exists from the root doc to the target doc; the fix report writes it out hop by
   hop as concrete file paths.
2. Every hop on that path satisfies the signposting criterion in `references/discoverability.md`,
   checked hop by hop, with the matched term named for each.
3. Any synonym relied on to satisfy a hop is present in the KB's recorded synonym list —
   added by this fix if it was not there already.
4. The link was added to an existing hub or index that other docs are also reached through,
   not to a doc created solely to hold this one link.

**Target granularity.** File — the undiscoverable doc. The fix edits a different file (the hub),
which is expected: the target names the problem, not the file that changes.

---

## `source-discoverability`

**Detection signal.** `cite-scan.mjs`: a source directory with zero citations to any KB doc,
reported as a per-directory count including zero. The script reports counts and edges only. It
does **not** decide which code deserves documentation — that judgment happens in Part A prose,
weighing whether a doc explaining this directory already exists elsewhere in the KB. A directory
of generated code, vendored code, or tests with zero citations is a fact, not a finding.

An item is raised only when a KB doc exists that explains this code and the code does not point
at it. "Uncited directory with no doc anywhere" is a documentation gap, which is
`codebase-onboarding`'s job and not a kb-gardener work item.

**What a fix looks like.** Add a citation comment at the top of the directory's entry-point
source file — the module's index, its main class, or its most-imported file — naming the KB doc
path. One citation per directory is the goal, not one per file; a citation in every file is
noise that goes stale in a batch. Use whatever citation syntax `cite-scan.mjs` recognizes, so
the next run sees the edge.

**Done criteria.**
1. The named source directory contains at least one citation, in the syntax `cite-scan.mjs`
   recognizes, naming a KB doc path.
2. That KB path exists — re-running `cite-scan.mjs` reports the edge and reports no new dead
   citation.
3. The cited doc actually describes this directory: the fix report quotes the sentence in the
   doc that covers the code, and names the source file the citation lives in.
4. No behavior changed — the edit added comments only.

**Target granularity.** Directory (trailing `/`). This is the one type where directory targets
are normal in `## open`, and it is deliberate: citations are a per-directory property. It also
means a `won't do` on `src/generated/` correctly silences the whole tree in one line.

---

## `re-balancing`

**Detection signal.** kb-gardener's own analysis over the doc inventory. Two shapes:

- **Split**: one doc covering several distinct topics that readers would arrive at separately —
  visible as a long file whose top-level headings have little to do with each other, and whose
  inbound links point at different anchors for different reasons.
- **Merge**: several docs each too thin to stand alone, all covering facets of one topic, all
  reached from the same hub, none of which answers a reader's question without the others.

Length alone is not the signal. A long reference doc that covers one topic thoroughly is fine.
The signal is topic count against arrival paths.

**What a fix looks like.** For a split: cut the doc at the topic seams, give each piece a title
naming its own subject, and **leave the old path pointing at the new pieces.** The original path
survives as an index stub listing the new docs with a line each. This is the same hard rule as
`duplication` — the old path must not stop resolving. If no clean seam exists, do not force one;
report that and let the item be retired to `won't do`, which is exactly what that exit is for.

For a merge: pick the survivor as in `duplication`, fold the others in as sections, and leave
each retired path as a stub redirecting to the survivor — with an anchor to the specific section,
since the reader arriving from the old link wants that part.

**Done criteria.**
1. Every claim in the original doc(s) is present in exactly one of the resulting docs. The fix
   report maps old sections to new files.
2. Every pre-existing path still exists as a file: split originals as index stubs listing the
   new pieces, merged originals as redirect stubs pointing at the survivor.
3. Every inbound link across the KB to any affected path still resolves, including anchors —
   where a heading moved to a new file, the link points at the new file's anchor.
4. Each resulting doc's title names its subject, and each is reachable from the root doc per
   `references/discoverability.md`. New pieces that are unreachable trade one problem for another.
5. For a split: no resulting doc still mixes the topics the item named.

**Target granularity.** File — the doc to split, or the doc chosen as merge survivor. Note the
accepted limitation from the spec: type+path is coarser than "problem", so a `won't do` on one
`re-balancing` finding for a file suppresses a later, different one on that same file.

---

## Not a type: rules with no home

Changing a rule's classification changes item identity, which is `[type]` + target. Existing
`won't do` entries under the old type stop suppressing, and everything they silenced comes back
at once. `backlog-merge.mjs --migrate-types` rewrites an existing backlog's type names in both
sections; run it once when this table changes, or the next survey looks like a regression.

`scripts/rule-types.mjs` is the machine copy of this document: every rule a detector emits is
classified there as mapped to one of the six types above, deliberately discarded, or advisory.
A rule in none of the three is a bug in that file, and `backlog-merge.mjs` drops its findings
rather than inventing a type for them.

**Why dropping beats inventing.** The done criteria above are the contract Part B verifies a
fix against. An item typed `[code-churn]` or `[thin-doc]` parses fine, reads as a normal item,
and has no criteria to look up — so the fix either passes vacuously or the item is retired to
`won't do` for failing a check that was never written. That is the vague-criterion failure this
document opens by warning about, arriving through the back door. A dropped finding is loud and
recoverable; an unverifiable item is neither.

**Advisory rules** are the third case: real signals whose fix no type can verify. `thin-doc`
(a merge candidate only relative to its siblings), `missing-section` (a doc-shape convention),
`duplicate-anchor` (an ambiguous heading slug) and `ambiguous-reference` (shorthand matching
several real files) are reported to Part A as counts. Part A may
raise a typed item by hand from them, exactly as `duplication` and `re-balancing` already
expect — with a description naming what the overlap or the seam actually is. What Part A must
not do is copy the rule name into the type column.

---

## Not a type: `ownership-gap`

`knowledge-ops` reports docs with no `owner` frontmatter and no named maintainer. **kb-gardener
does not emit this as a work item, and Part A discards those findings.**

It fires on every doc of a personal KB, because a personal KB has exactly one owner and does
not write it down. A finding that matches every document carries no information; it just makes
the backlog long enough that nothing else in it gets read. This is the same disease that got
three scripts deleted from the siblings.

**Reinstate it when, and only when, the KB demonstrably uses ownership frontmatter** — that is,
some docs carry an `owner` field and others do not, making the gap a real distinction rather than
a universal one. At that point the detection signal is the *inconsistency*, not the absence, and
the done criterion is straightforward: the named doc carries an `owner` field whose value also
appears on at least one other doc in the KB. Until then, leave it out. Do not re-add it because
the sibling reports it.
