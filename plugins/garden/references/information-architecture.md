# Information Architecture Patterns

How to structure an internal knowledge base so people find things. The failure most
organisations experience is not missing content — it is content that exists and cannot be
found, which is indistinguishable from missing content but costs more to maintain.

---

## The three IA models

### 1. Team-mirrored (structure follows the org chart)

Spaces named after teams: Platform, Growth, Finance, People.

**Works when:** the KB is mostly internal-to-team operating docs and readers already know
which team owns what.

**Fails when:** the org reorganises, which it does. Every reorg orphans a space, and the
content inside becomes unfindable because the readers who need it never learn the new
owner's name. Team-mirrored KBs accumulate archaeological layers named after teams that
no longer exist.

**Verdict:** Use only for team-private operating docs. Never for anything a reader outside
the team needs.

### 2. Task-oriented (structure follows what a reader is trying to do)

Top-level sections named as verbs or situations: Onboarding, Shipping a change,
Handling an incident, Getting access, Leaving.

**Works when:** most reads are people trying to complete a task, which describes most
internal knowledge bases most of the time.

**Fails when:** a document serves multiple tasks and has to live in one place. This is
manageable — put it under the dominant task and link from the others.

**Verdict:** This is the default. If you are choosing an IA and have no strong
reason otherwise, choose this one. It survives reorgs, because tasks change far more slowly
than org charts.

### 3. Lifecycle-oriented (structure follows a process stage)

Sections named for stages: Plan, Build, Ship, Operate, Retire.

**Works when:** the org has one dominant workflow that most people participate in — common
in engineering-heavy or manufacturing organisations.

**Fails when:** functions outside the main workflow (finance, people, legal) have nowhere
natural to sit and end up in a "General" section, which becomes a dumping ground.

**Verdict:** Use for engineering-specific sub-spaces inside a task-oriented top level.

---

## Hub-and-spoke structure

The single structural pattern that most improves findability.

**A hub** is a curated index doc for a domain. It is not an auto-generated file tree; it is
a hand-written doc that says "here are the eight things you might be trying to do, and the
doc for each." It carries a named owner and the Critical-tier freshness SLA.

**Spokes** are the actual content docs. Every spoke is linked from exactly one hub, its
canonical parent, and may be cross-linked from others.

### Hub-and-spoke rules

1. **Every doc has exactly one canonical hub.** A doc linked from four hubs and owned by
   none is how duplication starts.
2. **A hub links to 5-12 spokes.** Under 5, the hub is not earning its existence — fold it
   upward. Over 12, readers scan and miss things — split it.
3. **Hubs are maximum two levels deep.** Top-level hub → domain hub → spokes. A third level
   of hub means the taxonomy is doing work the search box should do.
4. **Hub docs get named owners.** They are the highest-traffic, highest-leverage docs in
   the KB and the most commonly unowned.

### Detecting a broken hub structure

Run the orphan detector and read the two lines it prints above the findings: how many docs it
saw, and how many have inbound links. A large gap between them means the hub layer is missing
or stale — docs exist but nothing indexes them. Conversely a doc whose inbound-link count far
exceeds `--hub-threshold` and which was never designed as a hub is an accidental one that grew
by accretion, and probably needs splitting.

Inbound links are the approximation available here. The property you actually want is
reachability from the root doc, which is strictly stronger: a doc linked only from
unreachable docs is unreachable and still passes this check.

---

## Naming

Doc titles are the primary search surface. Most search failures are naming failures.

| Rule | Bad | Good |
|------|-----|------|
| Name for the reader's question, not the author's topic | "VPN Architecture" | "Reset your VPN certificate" |
| Front-load the distinguishing word | "Guide to deploying services" | "Deploying services: guide" |
| Never use internal project codenames alone | "Project Halyard" | "Billing migration (Project Halyard)" |
| Avoid "Overview", "Guide", "Documentation" as the whole title | "Overview" | "Payments system overview" |
| One canonical name per concept | "Sev-1" / "P1" / "Critical incident" | Pick one, alias the others |

### The codename tax

Internal codenames are the most expensive naming decision an organisation makes and the one
made most casually. A newcomer cannot search for a codename they have never heard. Every
codenamed doc needs the plain-English term in the title, not just in the body — search
weights titles far more heavily than body text.

---

## Designing for how people actually search

Three behaviours. If your platform reports query and navigation data, measure their mix
yourself; the ordering below is the one to assume in the absence of that data, and the
argument does not depend on any particular split.

1. **Known-item search** — the most common. The reader knows the doc exists and is
   retrieving it. Optimised by stable titles and stable URLs. This is why redirecting rather
   than deleting matters: a moved doc breaks every bookmark and every past chat link.

2. **Exploratory search** — the reader knows their problem but not the doc. Optimised by hub
   docs and by titles phrased as questions or tasks.

3. **Browse** — the reader is navigating the tree. Optimised by the IA itself.

The practical point is the ordering, not the proportions: browse is the rarest of the three
and the one organisations spend the most effort on, because the tree is the visible artifact
and titles are not. Effort belongs where the reads are — titles first, hubs second, tree last.

### Practical consequences

- **Exclude archives from the search index.** This is usually the single largest search-quality
  improvement available, and it costs a configuration change.
- **Never let two live docs carry the same title.** The engine cannot rank between them
  meaningfully, and the reader cannot tell which is current.
- **Put the answer in the first 200 words.** Search result snippets come from the top of the
  doc; a doc that opens with background context shows a useless snippet.
- **Date-stamp visibly at the top.** Readers use the date to decide whether to trust the doc
  before they read it. A doc with a visible recent date gets trusted; the same content
  undated gets verified in chat instead.

---

## Doc-level structure

The template that works across doc types:

1. **Title** — the reader's question
2. **Status line** — owner, last reviewed, tier. Visible, at the top, not in a footer
3. **Answer / summary** — 2-4 sentences. What this doc tells you, resolved immediately
4. **Prerequisites**, if any
5. **Body** — steps, or the explanation
6. **When this does not apply** — the section most often omitted and most often needed
7. **Related docs** — 3-5 links, curated, not auto-generated

The "when this does not apply" section is what converts a doc from a recipe into usable
knowledge. Its absence is why readers ask in chat even when the doc exists: they cannot tell
whether their situation is the one the doc covers.

---

## Migration between platforms

When moving wikis, the temptation is a lift-and-shift because it is fast and lossless. Do not.

A migration is the only moment when deleting large volumes of content is politically free —
"it did not come across" carries none of the accountability that "I deleted it" does. Use it.

**Migration filter:** carry over any doc with (a) inbound links from a hub, or (b) non-trivial
traffic in the last 180 days, or (c) a compliance retention requirement. Everything else stays
behind, with the old wiki kept read-only for two quarters.

The read-only window is what makes this safe and is not optional: anything left behind that
someone actually wanted is one request away, and requests during that window are the evidence
that the filter was too aggressive. Absence of requests is the evidence that it was not.

---

## Permissions and visibility

Access control is an IA decision that gets made as a security decision, usually by defaulting
to restrictive, and it silently destroys findability.

### The default

**Open by default within the company; restrict by exception.** A doc nobody outside the owning
team can see is a doc that will be rewritten by another team who could not find it — this is a
primary mechanism by which duplication is created.

### Genuine exceptions

Compensation and individual performance data; pre-announcement M&A and restructuring material;
security incident detail during an active incident; customer data under contractual restriction;
material non-public information at listed companies; some regulated records.

That list is short. Most organisations restrict far more than it justifies, because
restricting is a decision nobody is ever blamed for.

### The findability failure restriction causes

A restricted doc is invisible in search results for people without access — which is correct
security behaviour and terrible IA behaviour, because the reader cannot tell the difference
between "does not exist" and "exists but is not for me." They conclude the former and write
their own version.

**Fix:** where the platform supports it, show restricted docs in search as a title plus a
request-access route. Where it does not, keep a visible stub doc in the open space naming
the restricted material and who to ask. The existence of a document is very rarely the secret.

### Permission decay

Access granted for a project outlives the project. Review group membership on restricted spaces
annually — it belongs in the same cycle as the access review in your security tier. Spaces whose
membership only ever grows are functionally open with extra friction, which is the worst of both
arrangements.

---

## Renaming and restructuring safely

Retitling and moving docs improves findability and breaks every bookmark and chat link
pointing at them. Both are true, and the second is what stops teams doing the first.

### Renaming rules

1. **Always redirect.** A 404 on a bookmarked doc costs more trust than the bad title did.
   If the platform cannot redirect, leave a stub with a link and a date.
2. **Never rename and move in the same change.** If something breaks you will not know which
   action caused it, and the recovery is much harder.
3. **Rename in batches by domain**, announced to that domain, rather than continuously. A
   quiet rolling rename programme feels to users like the wiki is unstable.
4. **Retire stubs after two quarters**, not sooner. Traffic to a redirect stub tells you
   whether anyone still holds the old link; retiring while that traffic is non-trivial breaks
   real users.

### Handling codename migrations

Moving from a codename to a plain-English title is the highest-value rename available and the
one that generates the most objection, because the codename is what the building team calls it.

Resolve with a compound title: **"Billing migration (Project Halyard)"**. Both populations
search successfully, the plain term carries the search weight, and nobody has to give up their
vocabulary. This is worth doing even when the team insists the codename is universally known —
it is universally known to the people already in the room.
