# Solo Product Manager — Domain Descriptor

> Domain-specific configuration for a knowledge base used by a solo product manager.

## Domain Definition

A solo PM working on multiple product ideas in parallel. No team, no formal PM training. The workflow is conversational — most thinking happens in Claude chats, then gets captured into knowledge-base documents. Products move at different speeds; some are active exploration, others are parked.

The knowledge base replaces scattered notes, forgotten chat insights, and re-explained context. Its core value: **every conversation builds on all previous conversations**, because knowledge compounds in the graph instead of dying in chat history.

One product, one knowledge base. Multiple products are multiple repositories. Start a new one when a product has at least one problem statement worth writing down.

## Categories

Three categories, organized by purpose:

| Category | Contains | Purpose |
|----------|----------|---------|
| `Discovery/` | personas, problems, research | Understanding the space — who has pain, what the pain is, what exists |
| `Design/` | features, decisions | What we're building and why — proposed solutions and the reasoning behind choices |
| `Content/` | briefs, feedback | Polished artifacts and reactions — what we communicate outward and what comes back |

## Types

Seven types. Keep this list small — a new type needs a recurring need, not a hunch.

| Type | Lives in | Purpose |
|------|----------|---------|
| `problem` | Discovery/ | A specific pain point for a specific person. The atomic unit of product thinking. |
| `persona` | Discovery/ | A user archetype. Who has this problem, what do they do today, what do they need. |
| `research` | Discovery/ | Evidence from outside your head — competitive analysis, user conversations, market data. |
| `feature` | Design/ | A proposed solution to one or more problems. Not an implementation spec — a description of what and why. |
| `decision` | Design/ | Why you chose X over Y. Records the alternatives considered and the reasoning. |
| `brief` | Content/ | A polished document meant for others — pitch, product brief, one-pager, update. |
| `feedback` | Content/ | Reactions from real people — user tests, friend feedback, dogfooding notes. Raw signal, not synthesis. |

## Templates

Each template defines the sections for its type. Sections are guides, not bureaucracy — skip what doesn't apply, but read the questions before you skip. `{{date}}` and `{{title}}` are placeholders.

### problem

```markdown
---
type: problem
date: {{date}}
related: []
---

# {{title}}

## Who has this problem?
Link to a persona or describe the person. Be specific — "users" is not a who.

## What are they doing today?
Current workaround, tool, or coping mechanism. If they're not doing anything, question whether this is a real problem.

## What's painful about it?
The specific friction, cost, or failure mode. Quantify if you can — time wasted, frequency, consequences.

## Why does this matter?
What happens if this problem stays unsolved? What becomes possible if it's solved? This is your argument for why this problem is worth working on.

## Evidence
What makes you believe this is real? Conversations, observations, your own experience. Link to research docs if they exist.
```

### persona

```markdown
---
type: persona
date: {{date}}
related: []
---

# {{title}}

## Summary
One sentence: who is this person and what defines them in the context of your product.

## Context
What's their situation? Experience level, constraints, environment. Only what's relevant to the problems they face.

## Goals
What are they trying to achieve? Not product features — their actual goals in their own words.

## Current tools and workarounds
What do they use today? What's good enough, what's broken, what's missing?

## Frustrations
What specifically hurts? Concrete examples, not abstract categories.

## Quotes
Real or realistic things this person would say. Keeps the persona grounded and human.
```

### research

```markdown
---
type: research
date: {{date}}
related: []
synthesized_from:  # if captured from a chat session
  date:
  topic:
  tool:
---

# {{title}}

## Source
Where this came from — competitor product, user conversation, article, your own testing. Be specific enough to find it again.

## Key findings
Bullet points. What did you learn? Lead with surprises — things that contradicted your assumptions are the most valuable.

## Implications for us
So what? How does this change your thinking about the product? Link to the problem or feature docs this affects.

## Open questions
What didn't you find out? What would you need to investigate further?
```

### feature

```markdown
---
type: feature
date: {{date}}
related: []
---

# {{title}}

## Problem
Which problem(s) does this solve? Link to problem docs. If you can't link to a problem, question whether this feature should exist.

## Description
What does this feature do, from the user's perspective? Not how it works — what it lets them do that they couldn't do before.

## Key interactions
How does someone use this? Walk through the main flow in 3-5 steps. This is not a spec — it's a story.

## What this is NOT
Scope boundaries. What might someone expect this to include that it deliberately doesn't? Being explicit about exclusions prevents scope creep.

## Success criteria
How would you know this feature is working? Observable outcomes, not metrics dashboards. "Users can do X in under Y minutes" is better than "increase engagement."

## Open questions
What haven't you decided yet? What would you need to learn before building this?
```

### decision

```markdown
---
type: decision
date: {{date}}
related: []
---

# {{title}}

## Context
What situation prompted this decision? Link to the relevant feature, problem, or research docs.

## Options considered
List the alternatives. For each:
- What it is (one sentence)
- What's good about it
- What's bad about it

At least two options. If there's only one option, you're not making a decision — you're rationalizing.

## Decision
What did you choose and why? Be honest about the reasoning — was it evidence, intuition, or constraint?

## Consequences
What follows from this decision? What becomes easier, what becomes harder, what's now off the table?

## Revisit when
Under what conditions should this decision be reconsidered? If the answer is "never," you're probably wrong.
```

### brief

```markdown
---
type: brief
date: {{date}}
related: []
audience:
---

# {{title}}

## One sentence
What is this product/feature and why does it matter? If you can't say it in one sentence, you don't understand it yet.

## Problem
What pain does this address? For whom? Keep it concrete — the reader should feel the problem.

## Solution
What are we proposing? Describe it from the user's perspective, not the builder's.

## Why now
What changed that makes this the right time? New insight, new capability, new urgency?

## What success looks like
How will we know this worked? Paint a picture of the after state.

## Open questions and risks
What could go wrong? What don't we know? Briefs that hide uncertainty lose trust.
```

### feedback

```markdown
---
type: feedback
date: {{date}}
related: []
source:
  who:
  context:
  date:
---

# {{title}}

## What was shown or tested
What did the person see, use, or react to? Link to the feature or brief if applicable.

## Raw reactions
What did they say or do? Capture actual words and behaviors, not your interpretation. Direct quotes are gold.

## Your interpretation
Now interpret. What do you think this means for the product? Where do you agree with their reaction, where do you disagree?

## Action items
What should change based on this feedback? Link to existing docs or note new docs needed.
```

## Status Values

None. A solo PM reviews everything they write; a `draft`/`final` field would be maintained for nobody. Parked products are parked by not being touched.

## Conventions

- File names: `kebab-case.md`
- One concept per file — if you're writing "and" in the title, consider splitting
- Link liberally — connections are the point
- Templates guide thinking, not bureaucracy — skip sections consciously, not lazily
- Commit messages capture *why* — git history is a reasoning surface
- Products can be parked — no shame in a knowledge base with 3 files that hasn't changed in months
- Feedback goes in even when it hurts — especially when it hurts

## Deliberately Excluded

Things this domain descriptor does NOT include, and why:

| Excluded | Why |
|----------|-----|
| Roadmap / timeline documents | Solo PM doesn't need to coordinate schedules. Add a `roadmap` type if that changes. |
| User story format | "As a... I want... So that..." is team communication theater for a solo PM. Problems and features cover the same ground without the ritual. |
| Sprint / iteration tracking | No team to sprint with. Work happens when it happens. |
| Metrics / analytics type | No product in production yet. Add when you have something to measure. |
| Meeting notes type | No meetings. Conversations happen in Claude chats and get captured. |
| Spec / PRD type | Premature. If a feature doc isn't detailed enough, that need will recur and justify a type. |
| Requirements type | Same as spec — add it when feature docs repeatedly prove too coarse. |
