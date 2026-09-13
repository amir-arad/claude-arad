---
name: dream
description: Interview the user about their knowledge domain and write a domain descriptor to .garden/DOMAIN.md — types, categories, templates, conventions, exclusions. Optional; capture uses it when present.
disable-model-invocation: true
---

# Dream

A conversational interview about the user's knowledge domain, producing a domain descriptor: a
markdown file defining the types, categories, templates and conventions of this knowledge base.
It is optional. Nothing requires it; `/garden:capture` uses it when it exists.

## Before starting

Read [example-domain-descriptor.md](${CLAUDE_SKILL_DIR}/example-domain-descriptor.md) — a
concrete descriptor for a solo product manager. It sets the sections, level of detail and tone.

If `.garden/DOMAIN.md` already exists, read it: this run extends or revises it rather than
starting over. If `.garden/` does not exist, tell the user to run `/garden:init` first and stop.

Read the KB index and a sample of existing docs. The descriptor has to fit what is already
there, not a fresh start.

## Interview

Work inductively. Ask about concrete work, then derive structure from the answers. Do not ask
the user to think in terms of "types" or "categories" — that is your job.

Opening questions:

- What do you do? What is the context you work in?
- Describe a recent productive stretch of work — what did you produce, reference, or think about?
- What do you keep coming back to, updating, or building on?
- Which relationships between things matter most?
- What is explicitly NOT part of this domain?

Follow the user's lead. Keep going until you can name:

- the kinds of documents in this domain → **types**
- how they group by purpose → **categories**
- what each type needs to capture → **templates**
- what is deliberately excluded, and why

Do not rush. Short answers get asked for specifics; long answers get the structure pulled out.

## Produce

Write `.garden/DOMAIN.md` with these sections, in this order:

1. **Title and intro** — `# <Domain Name> — Domain Descriptor`, one-line summary
2. **Domain Definition** — who this is for, what the workflow looks like, why the KB exists
3. **Categories** — table of purpose-driven folders: what each contains and why
4. **Types** — table of document types, the folder each lives in, and its purpose
5. **Templates** — one per type: YAML frontmatter (`type`, `date`, `related`, plus
   type-specific fields) and sections written as guiding questions
6. **Status Values** — lifecycle for documents, if the domain has one
7. **Conventions** — naming, linking, domain-specific norms
8. **Deliberately Excluded** — what is not tracked, and why

The user reviews it and asks for corrections; iterate until they are satisfied. Nothing is
committed.

## Principles

- **Few types.** If unsure whether something is a type, it is not one yet.
- **Template sections are questions, not form fields.** "What makes you believe this is real?",
  not "Evidence: [fill in]".
- **Deliberately Excluded is not optional.** Every domain consciously leaves things out.
- **Fit the existing KB.** Categories should map onto folders that exist, or the descriptor
  says which folders it introduces.
- Match the example's tone and density — direct, opinionated, specific to the domain. No
  meta-commentary about the descriptor being a draft.
