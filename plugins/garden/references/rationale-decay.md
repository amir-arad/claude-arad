# Rationale Decay

Why this skill records *why* alongside every durable decision, and what a recorded reason has
to contain to be worth the line it occupies.

This is the reasoning behind three things that would otherwise look like over-engineering: the
three-field `won't do` grammar, the `review` mode existing at all, and both review tools
refusing to compute numbers they cannot support.

## The asymmetry

Recording why a decision was made costs one line, at the moment it is made, when the reason is
free. Reconstructing it later does not, and the reason is **redundancy**: two entries each
covering one case look individually removable, but removing both breaks something. Checking one
at a time cannot see that, so an honest audit has to probe subsets — exponential in the number
of entries.

A maintainer facing an entry whose reason is gone therefore has two options: keep it, or risk a
regression they cannot bound. Keeping is always the rational local move. The file only grows.

**Nothing has to become stale for this to happen.** Even with a fixed set of requirements and a
constant rate of additions, equilibrium size diverges as the probability of recovering a
rationale goes to zero. The decay of the *reason* is sufficient on its own.

## What that predicts, and what it costs

- The only affordable deletion left is the wholesale rewrite — removing one entry needs a
  reason, removing all of them needs none. Which resets size and not the cause.
- A durable suppression list goes quietly blind: entries accumulate, none can be safely
  removed, and nothing reports the loss of coverage.

## The bar a reason has to clear

This is the part that matters operationally, and it is not intuitive:

- **Outcome-grounded rationale works.** What was tried, what happened, how often.
- **Rationale-shaped text does not.** Something with the right structure and no real content
  performs the same as writing nothing.
- **A narrative of attempts with no outcomes is worse than nothing.** It hands the next reader
  a premise that was never checked and invites them to build on it.

Hence `attempted:` / `observed:` / `revisit if:`, and hence `observed:` being the field the
tooling actually looks for. A reason with an attempt and no outcome is not a partial success —
it is the failure case, and `backlog-merge.mjs` names it as one.

`revisit if:` is the addition that makes permanence survivable: a suppression carrying its own
trip-wire can be noticed when its reason expires, without anyone re-litigating the decision
from scratch.

## Writing is safe; acting is not

The single most important constraint on all of this. Recording a rationale removes nothing and
can be automated freely. **Acting on one cannot.** An operator who automates "delete anything
whose rationale I can recover" will delete things whose rationale was real — the recovery test
is not sound, and its failures are invisible.

This is why `review` reports and never edits, why nothing resolves a `revisit if:` condition
automatically, and why the deletion path in this skill has a human in it at the merge gate.

## Provenance

The mechanism, the growth measurements and the comment ablations come from Chakrabarti, *Why
Does CLAUDE.md Keep Growing? Catastrophic Remembering in Agentic Coding*, arXiv:2608.11095
(2026). Its corpus is 1,867 public repositories and 247,694 instruction lifetimes in
`CLAUDE.md`-class files; its controlled results invert IFEval and WildIFEval so the optimal
prompt is known and excess is measurable.

**None of it was measured on this skill.** The application to a backlog's `won't do` section is
structural analogy: a suppression reason and a prompt comment occupy the same position —
durable free text that licenses a future decision, which nothing verifies — but nobody has run
the ablation on one. Treat the three-field grammar as a well-motivated convention, not a
validated one.
