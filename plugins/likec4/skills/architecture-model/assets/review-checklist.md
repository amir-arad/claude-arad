# C4 model review checklist

Use on a PR that adds or changes a model, or that changes the system the model describes.

## Scope and levels
- [ ] Exactly one software system is in scope; everything else is tagged external.
- [ ] Each view shows one abstraction level — no classes on the container view.
- [ ] A system context (or landscape) view exists; a container view exists if containers do.
- [ ] Component views exist only where internals are non-obvious.
- [ ] No view has more than ~20 boxes.

## Elements
- [ ] Every container is separately deployable or runnable (a library is not a container).
- [ ] Every element has a description that says what it does, not just what it is called.
- [ ] Every container names its `technology`.
- [ ] People are roles, not named individuals.
- [ ] No orphan elements: each has a relationship or appears in a view.
- [ ] More than one software system, or a stated reason the system has no external dependencies.

## Relationships
- [ ] Every relationship has a verb-phrase title, not "uses"/"calls"/"talks to".
- [ ] Every relationship names its `technology`.
- [ ] Direction reflects the dependency; two arrows only for independent flows.
- [ ] No relationship is duplicated at both container and system level.

## Evidence
- [ ] Every L1 element and relationship was grounded in code or infra, not just in a doc.
- [ ] Anything ungrounded is deleted, or its description says it is unverified.
- [ ] Every L2/L3 element was derived from code or deployment config — no doc-sourced boxes.
- [ ] The level above was used for naming and scope only, never as a source of fact.

## Truth
- [ ] Every element corresponds to something that exists in the code or infrastructure today.
- [ ] Every deployable/datastore/queue in the repo appears in the model.
- [ ] No future-tense descriptions.

## Hygiene
- [ ] One canonical model (LikeC4), no parallel Structurizr/Mermaid copy.
- [ ] Model lives beside the code it describes.
- [ ] `npx likec4 validate` reports no errors.
