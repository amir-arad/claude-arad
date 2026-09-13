# Freshness SLAs and Document Ownership

Content decays. The question is not whether to let it decay but which decay you can tolerate,
and the answer differs by two orders of magnitude between an on-call runbook and a 2021 retro.
Uniform review policies fail because they generate more review work than any organisation will
actually do, so nothing gets reviewed and the policy becomes decorative.

---

## Tiering

### Tier definitions

| Tier | Test | Review SLA | Stale at |
|------|------|-----------|----------|
| **Critical** | Someone acts on it under time pressure, and being wrong causes harm | 90 days | 120 days |
| **Core** | People rely on it to do their job correctly, but not urgently | 180 days | 270 days |
| **Reference** | Consulted occasionally; wrong content causes annoyance, not damage | 365 days | 540 days |
| **Archive** | Historical record only; nobody acts on it | Never | Never |

These are `tier` values in the sense of `CONTRACT.md` §4 — the consequence if the doc is
wrong. They are a property of a doc, never of a finding, and they do not share meaning with a
finding's `severity` despite both using the word "critical".

### The tiering test

Ask one question: **"If this doc were wrong for six months, what would happen?"**

- Someone would take a harmful action → Critical
- Someone would do their job badly and not know → Core
- Someone would be mildly inconvenienced → Reference
- Nothing → Archive

Note what this test does not use: traffic. A high-traffic FAQ is Reference. A rarely-read
incident runbook is Critical. Tiering by popularity is the most common tiering mistake, and
it systematically under-protects exactly the docs whose failure is expensive.

### Canonical Critical-tier content

On-call and escalation runbooks; incident severity definitions; security incident procedure;
access provisioning and revocation; payroll and benefits processes; regulated procedures under
audit scope; anything with a legal retention obligation; disaster recovery. Size the Critical
tier against the review capacity that actually exists: every doc in it needs a real review
every 90 days by a named person. If the count exceeds what those people will do four times a
year, the tier has been diluted and the SLA will quietly stop being met on all of it.

---

## Ownership

### The one non-negotiable rule

**An owner is a named person.** Not a team, not an alias, not a distribution list, not a
rotating role without a current occupant.

Review notifications sent to a group go unread — every member assumes another member will
handle it, and the mail is filtered within a month. That is why the auditor emits an
`alias-owner` finding on alias-shaped owner values rather than treating them as owned.

Note that "owner" here means this named human and nothing else. Which team or module a *code*
path belongs to is **module assignment**, a separate idea that must not borrow this word.

Record the team as a secondary field for routing when the person leaves. But the notification
goes to a human.

### What an owner is accountable for

1. **Accuracy** at the review interval for their tier
2. **Deciding the doc's fate** at review time: keep, update, merge, or archive. "Keep as-is"
   is a valid, common outcome and should take under ten minutes
3. **Answering questions** the doc generates, or routing them
4. **Handing over explicitly** when they change role — an unhanded-over doc is unowned

What an owner is **not** accountable for: writing all the content, being the subject expert,
or fielding every question personally.

### Ownership assignment sprint

For an unowned KB, this is the highest-value week of work available and it precedes all
content work.

1. Run the auditor and export `unowned` docs with traffic.
2. Sort by traffic descending. Take the top 50.
3. Propose an owner for each from the doc's git or edit history. The last substantive editor
   is a guess, not an answer — which is exactly why the next step is a proposal the person can
   reject rather than an assignment they have to accept.
4. Send each proposed owner their list with an opt-out: "you are now the owner of these three
   docs; reply if that is wrong." Opt-out beats opt-in because the default outcome of silence
   is coverage rather than a gap, and silence is the most common response to either.
5. Anything nobody accepts after two rounds is a retirement candidate. That non-acceptance is
   real information about whether the doc matters.

### Coverage targets

| Tier | Named-owner coverage target |
|------|----------------------------|
| Critical | 100%. A Critical doc without an owner is an open risk item |
| Core | 90% |
| Reference | 60% — the tail here is genuinely low-value |
| Archive | 0% required |

---

## Review workflow

A review that requires an hour will not happen. Design it to take ten minutes.

### The ten-minute review

The owner receives a notification with the doc, its tier, and its age, and answers three
questions:

1. **Is anything on this doc now wrong?** If no → re-date, done.
2. **Is anything missing that readers keep asking about?** If yes → add it or note it.
3. **Does this doc still deserve to exist?** If no → merge or archive.

Most reviews end at question 1 — the common case is a doc that is still correct and only
needs saying so. Designing for that case is what makes the SLA achievable; designing every
review as a rewrite is what makes review policies collapse.

### Batching

Batch Reference-tier reviews annually by domain rather than trickling them individually — one
scheduled afternoon per domain per year, with the owner group in a room. Batching works
because the review becomes scheduled work with a start and an end, rather than a notification
competing with whatever the owner was already doing.

Never batch Critical-tier reviews. Those are individual, notified, and tracked.

### Escalation

| Overdue by | Action |
|-----------|--------|
| 0-30 days | Reminder to owner |
| 30-60 days | Reminder to owner's manager |
| 60-90 days (Critical only) | Raise as a risk item; the doc carries a visible "unverified" banner |
| 90+ days | Reassign ownership, or archive the doc |

The visible unverified banner is the mechanism that matters. It converts a hidden risk into a
reader-visible one, which both protects the reader and creates the social pressure that
notification alone does not.

---

## Metrics worth tracking

Track four numbers quarterly. More than four and nobody looks. None of them roll up into a
score — there is no score in this library (`CONTRACT.md` §6), and these four are deliberately
reported side by side because they move independently and are fixed by different work.

| Metric | Definition | Target |
|--------|------------|--------|
| **Freshness rate** | Non-archive docs within their tier SLA | 80%+ |
| **Ownership coverage** | Non-archive docs with a named human owner | 90%+ |
| **Critical-tier compliance** | Critical-tier docs reviewed within 90 days | 100% |
| **Doc count trend** | Total live docs quarter over quarter | Flat or falling |

Alongside them, keep the raw run output: docs scanned, docs with findings, the five-key
severity histogram, and per-rule counts. Those are what the scripts emit and what a reader
can act on directly.

### Why doc count should not grow

A knowledge base that grows monotonically is one where nothing is ever merged or retired, and
its search quality degrades as a result, regardless of how good the new content is: every
added doc is another competitor for the same query. A KB in good shape adds and removes at
similar rates. A quarter where doc count fell and freshness rose is the best possible quarter,
and it should be reported as a win rather than apologised for.

### The metric to distrust

**Total doc count and total word count as achievement metrics.** They are the easiest numbers
to produce, and past a low threshold they measure the thing that causes the failure. If a
documentation programme reports growth as its headline result, it is optimising the thing it
was chartered to fix.

---

## What invalidates a doc, by content type

Not all content decays at the same speed, and tiering by consequence (above) should be
adjusted by how fast the underlying reality moves. The useful question is not "how long does
this last" — nobody knows, and it varies per organisation — but **what event makes it wrong**.
Where that event is observable, tie the review to the event and let the calendar be the
backstop.

| Content type | What invalidates it | Review trigger, and what to do about it |
|-------------|---------------------|------------------------------------------|
| Tool-specific how-tos with screenshots | Vendor UI changes, on the vendor's schedule | Calendar only; you cannot see the change coming. Screenshots are the most expensive content to maintain — prefer described steps so the doc survives a re-skin |
| API and integration docs | Each release of the thing described | Tie to the release. Generate from source where possible; hand-written API docs lose to the release cadence |
| Org and process docs | Reorgs and role changes | Tie to the reorg. Avoid naming individuals; name roles and link to one source-of-truth directory |
| Runbooks | Infrastructure and deploy changes | Tie to the change that invalidates them, not only to the calendar |
| Architecture overviews | Structural change, which is rare | Calendar, long interval. Cheap to maintain, high value, under-invested in most KBs |
| Policy and compliance | Regulation change | Regulatory trigger, not calendar |
| Onboarding | Anything above, compounded | Review after every cohort — it aggregates every other doc's decay |

**Screenshots deserve a specific policy.** They decay fastest, are the most work to update, and
their absence rarely harms comprehension for described steps. Restrict them to genuinely
ambiguous UI, and never screenshot a full doc when a cropped detail will do.

**Onboarding is the canary.** It touches the most other documents, and a new joiner following
it hits every broken link and stale step in one pass. The cheapest KB health signal available
is asking each new cohort to log every point where the onboarding path failed them — this
consistently surfaces problems the tooling does not, and it costs nothing.

---

## The 90-day rescue plan

For a KB in the worst shape: unowned, largely past its SLAs, people asking in chat instead of
searching. The instinct is to start writing. Do not; you will be adding to the denominator of
a search-quality problem.

This plan assumes a human running it who holds deletion authority. An automated run archives
and redirects and never reaches step 9 — see the skill's `## Non-interactive contract`.

### Days 1-15: measure and stop the bleeding

1. Run the auditor and the orphan detector. Record the baseline with an explicit `--as-of`:
   docs scanned, docs with findings, the severity histogram, per-rule counts.
2. Fix every dead link. Cheap, fast, and the most visible signal that someone is home.
3. Apply the Archive test to every doc and move everything that passes out of the search
   index. In a neglected KB this is the single largest search improvement available, and it
   deletes nothing.

### Days 16-45: ownership

4. Take the top 50 docs by traffic. Propose owners from edit history.
5. Assign on an **opt-out** basis: "you own these three docs unless you reply." The default
   outcome of silence is then coverage rather than a gap.
6. Anything unclaimed after two rounds goes on the retirement list. Non-acceptance is real data.
7. Publish the ownership list openly. Visible ownership is what makes the next step socially
   possible.

### Days 46-70: consolidate

8. Merge duplicate-title clusters into the most-linked path. Redirect, never delete silently.
9. Delete zero-link, zero-traffic unreachable docs outright — this step and only this step
   needs the deletion authority named above.
10. Build or repair the hub layer: 5-12 spokes per hub, each hub owned by a named person.

### Days 71-90: verify and hand over

11. Run the first review cycle on Critical-tier docs only. Ten minutes each.
12. Re-run the auditor with the same convention. Report the delta on each count separately,
    not an absolute and not a rolled-up number.
13. Hand over the recurring cadence: monthly Critical-tier reviews, quarterly audit, annual
    batched Reference-tier reviews.

**What success looks like:** doc count lower than it started, Critical-tier compliance at
100%, the `unowned` count near zero on non-archive docs, and — the only result that actually
matters — people starting to search before they ask. Note that no step in the first 70 days
involves writing new content. That is deliberate, and it is the part teams most want to skip.
