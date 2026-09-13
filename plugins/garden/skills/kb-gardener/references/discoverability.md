# Discoverability: the reference-tree model

The analysis behind the `indexing-discoverability` work item type. A doc that exists and cannot
be found is indistinguishable from a doc that does not exist, and costs more to maintain.

This model asks two questions of every doc in the KB:

1. **Reachability** — can a reader get here by following links from the root doc?
2. **Signposting** — at each hop, would a reader looking for this doc take that link?

Failing either produces one `indexing-discoverability` item. Never two, and never a second item
raised from `knowledge-ops`' `orphan-doc` rule on the same doc — see
`references/work-item-types.md`.

Both questions must be answered the same way by two different runs a month apart. An analysis
that drifts churns the backlog: items appear, get fixed, reappear worded differently, and the
backlog stops being trusted. Everything below is shaped by that constraint. Where a criterion
could not be made stable, it was dropped rather than shipped as a judgment call in disguise —
the "Deliberately not criteria" section at the end lists what got cut and why.

---

## Reachability

### The root doc

The root is a **parameter**. Its default is `CLAUDE.md` at the KB root; if absent, fall back to
`README.md`, then `index.md`. First one found wins, in that order. If none exists, the analysis
does not run — report that the KB has no root doc, and stop. Do not guess one from link counts;
a KB with no entry point has a different problem than an indexing problem, and inventing a root
would make every subsequent run depend on which file happened to be most-linked that day.

Record the resolved root in the backlog header. A run whose root differs from the previous run's
will produce wholly different findings, and that must be visible rather than mysterious.

### Walking

Breadth-first from the root over the KB's markdown files. A doc is **reachable** if any path of
edges leads to it from the root. Reachability is transitive — that is the entire point, and the
reason this subsumes inbound-link counting. A cluster of five docs that link to each other and
that nothing outside links to has high inbound counts and is entirely unreachable.

Scope the walk to a subtree when the KB is large. Per-doc reasoning is not a script scan and
does not scale the way the siblings' tools do.

### What counts as an edge

An edge exists from doc A to doc B when A contains a markdown link whose target resolves to B's
file on disk. Precisely:

**Counts as an edge:**

- Inline links: `[text](path/to/doc.md)`
- Reference-style links: `[text][ref]` with a matching `[ref]: path/to/doc.md` definition. The
  edge belongs to the paragraph containing the *usage*, not the definition block — that is where
  the reader's eye is, and it is the text that has to signpost.
- Links with a fragment: `[text](path/to/doc.md#section)` — the edge is to `doc.md`. Whether the
  anchor resolves is `broken-reference`'s problem, not this one.
- Relative paths resolved against the linking file's directory, and root-relative paths resolved
  against the backlog root. Normalize to posix separators and compare case-insensitively; the
  siblings disagree on path conventions and Windows disagrees with both.
- HTML anchors in markdown: `<a href="path/to/doc.md">` — real links a reader can click.

**Does not count as an edge:**

- **Bare fragments** — `[text](#section)`. Same-document navigation. It moves the reader within
  a doc they already found; it never introduces a new one.
- **External URLs** — anything with a scheme (`http:`, `https:`, `mailto:`, etc.). They leave
  the KB and cannot make a KB doc reachable.
- **Links inside fenced code blocks** (``` or ~~~) **and inside inline code spans** (backticks).
  This is not a technicality. A sibling detector had exactly this false-positive bug: a fenced
  example showing what a link looks like was counted as a real link, which made docs appear
  reachable through a code sample nobody can click. Strip fenced regions and inline code spans
  *before* extracting links, not after. Indented four-space code blocks count as fenced.
- **Links inside HTML comments** (`<!-- -->`). Commented-out navigation is not navigation.
- **Image embeds** — `![alt](path.png)`. Not a route.
- **Links to non-markdown files** — source files, images, PDFs. They are edges out of the doc
  graph; they do not make another *doc* reachable.
- **Auto-generated directory listings**, where the platform renders a file tree. If it is not
  written in the markdown, it is not an edge. Generated navigation is exactly the thing that
  makes a KB feel indexed while nothing in it is signposted.

### Reporting unreachable docs

For each unreachable doc, emit one item:

```
- [indexing-discoverability] docs/ops/deploy.md — unreachable from root doc CLAUDE.md
```

When a whole cluster is unreachable, still emit one item per doc — but say in the description
which cluster it belongs to, so Part B fixing one can see the others fall out of the same edit.
The next Part A run will then find them reachable and the items never get picked.

---

## Signposting

A reachable doc can still be undiscoverable: the reader gets to the hub, reads eight link texts,
and none of them looks like what they are after. This is the part of the model most at risk of
becoming vibes — "signposted under relevant keywords, even synonyms" is unbounded as prose, and
two runs will disagree about it. So it is defined as a mechanical check.

### The criterion

For each hop A → B on the reachability path, the hop is **signposted** when at least one of the
target's **subject terms** appears in the hop's **link context**.

**Subject terms of B** are, exactly:

1. Every content word in B's `# H1` heading, or B's frontmatter `title` if it has one. Content
   word means: not an article, preposition, conjunction, or auxiliary verb.
2. Every recorded synonym of those words, drawn from the KB's synonym list (below).

Nothing else. Not words from B's body, not its filename, not its directory — those are not what
B announces itself as, and admitting them makes almost every hop pass.

**Link context of the hop** is, exactly:

1. The link text itself, plus
2. The sentence containing the link — from the previous sentence terminator or list-item start
   to the next one — plus
3. If the link is a list item under a heading, that heading's text.

Not the whole paragraph, not the section. The bound has to be tight enough that two runs agree
on where it stops.

**Matching** is case-insensitive, on whole words, after stripping a trailing plural `s`. No
stemming beyond that, and no fuzzy matching — both are where reproducibility goes to die. If two
forms of a word should match and this rule does not make them match, that is what the synonym
list is for.

A path is signposted when **every hop on it** is signposted. A doc reachable by several paths
passes if **at least one** path is signposted end to end — a reader only needs one good route.
When reporting a failure, name the best path found and the specific hop that failed.

### Worked example

Root `CLAUDE.md` contains, under a heading `## Operations`:

```markdown
- [How we ship](docs/ops/deploy.md) — the release process
```

Target `docs/ops/deploy.md` has H1 `# Deploying services`. Subject terms: `deploying`,
`services`, plus recorded synonyms. Link context: the link text `How we ship`, the sentence
`How we ship — the release process`, and the heading `Operations`.

No subject term appears in the context. `ship` and `release` are plausibly synonyms of `deploy`,
but plausibly is not a criterion — the check fails unless `ship` or `release` is *recorded* in
the synonym list as a synonym of `deploying`. That is the whole design: the disagreement between
two runs is moved out of the analysis and into a file that is either edited or not.

Fixing it means either rewriting the link text to `[Deploying services](docs/ops/deploy.md)`, or
adding `deploy: ship, release` to the synonym list because the KB genuinely uses that vocabulary.
Both are legitimate; the second is right when the whole KB says "ship".

### Reporting unsignposted hops

```
- [indexing-discoverability] docs/ops/deploy.md — reachable, but hop CLAUDE.md → docs/ops/deploy.md is unsignposted: link text "How we ship" contains no subject term of "Deploying services"
```

Quote the link text and name the target's subject terms. Part B needs both to know whether the
fix is rewriting the link or recording a synonym.

---

## The synonym list

This file is what turns signposting from a judgment into a detector. It is the reason two runs
agree, and it is the KB's own recorded vocabulary rather than a general thesaurus.

### Location and format

`.kb-gardener/synonyms.md`, next to `backlog.md` in the target KB, git-tracked and
hand-editable. One line per synonym group:

```markdown
# kb-gardener synonym list

deploy: ship, release, rollout
auth: authentication, login, sign-in
kb: knowledge base, wiki, docs
incident: outage, sev, postmortem
```

Left of the colon is the canonical term; right is a comma-separated list of terms that match it.
**Groups are symmetric** — any member matches any other, and the canonical term is a label for
the group, not a privileged form. Multi-word entries match as a phrase.

The header line and any comment lines are preserved. Ordering is alphabetical by canonical term,
so diffs stay readable and two runs adding entries do not shuffle the file.

If the file does not exist, signposting runs with subject terms only. Do not create it
pre-populated with guesses — an invented list makes hops pass for reasons nobody chose.

### How it grows

Only through fixes, never speculatively. When a fix for an `indexing-discoverability` item
relies on a synonym to satisfy a hop, that synonym is added to the list as part of the fix — this
is done criterion 3 for the type. Two properties follow, and both are the point:

- **Every entry was earned by a real hop in this KB.** Nothing is in the list because a thesaurus
  suggested it.
- **The list is auditable.** A human reading the diff sees "kb-gardener now thinks `ship` means
  `deploy` here" and can reject it at the merge gate, which is where all human review in this
  design lives.

The list only grows. Removing an entry is a human edit; kb-gardener never prunes it, because a
removal silently un-signposts hops elsewhere in the KB and the resulting items would appear with
no visible cause.

**Expect early churn.** On a fresh KB the list is empty and the first runs flag hops that a human
would consider perfectly clear. That is the cost of a stable criterion, and it is front-loaded:
each fix either improves a link text permanently or records vocabulary permanently, and the
finding does not come back either way. If the list is still growing quickly after the KB has been
gardened a few times, the KB's vocabulary is genuinely inconsistent — which is a real finding
about the KB, not a defect in this model.

---

## Deliberately not criteria

Things that belong to discoverability intuitively but were dropped because no two runs would
score them the same way. Do not add them back without a mechanical definition.

- **Link depth / hop count.** "Too many hops from root" needs a threshold nobody can justify, and
  the right depth depends on the KB's size and shape. A reachable, signposted doc six hops deep is
  findable; the criterion would only manufacture items.
- **Whether a hub has the right number of links.** `knowledge-ops` has opinions here. They are
  reasonable prose advice and they are not checkable — "over 12 links and readers scan and miss
  things" is not something an agent can verify it fixed.
- **Whether a link text is *good*.** Only whether it contains a subject term. A link reading
  `Deploying services deploying services` passes. Accepted: the criterion is a floor, not a
  quality bar, and a floor that is actually enforced beats a bar that drifts.
- **Search-engine findability.** Depends on an indexer that is not part of this analysis.
- **Whether the doc is worth being discoverable.** Out of scope entirely. This model reports that
  a doc cannot be found; it never argues the doc should not exist. Deletion is a human decision at
  the merge gate.
