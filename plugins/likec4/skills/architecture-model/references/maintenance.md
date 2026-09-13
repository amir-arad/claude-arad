# Maintaining a C4 model

## Where it lives

The LikeC4 project (its `.c4` files and config) next to the code it describes — same repo,
ideally the system's root directory. A model in a separate docs repo drifts because nobody
changing the code sees it.

## Drift signals

- A deployable, datastore, queue, or third-party integration exists in the code with no
  element in the model — or an element exists with no counterpart in the code.
- A relationship's `technology` no longer matches the client library in use.
- Descriptions in the future tense ("will handle...") — the model was written from a plan,
  not from the system.
- The last model change is much older than the last change to the code it covers.
- Element names no team currently uses out loud.
- An L2/L3 element whose only justification is a doc — check its history: if it entered the
  model without a code change alongside, it was never grounded.
- An L1 relationship with no corresponding client, route, or binding anywhere in the code.
- An element with no relationships that appears in no view.

The `likec4` MCP server makes the model side of these checks cheap: list elements and
relationships with `search-element` / `find-relationships`, compare revisions with
`element-diff`, then check each against the code.

## Per-change checklist

Run when a change touches deployment config, dependencies, infrastructure, or service
boundaries:

- [ ] Added or removed a deployable/datastore/queue? -> L2 updated.
- [ ] Added or removed an outbound integration? -> external system + relationship updated.
- [ ] Protocol or technology changed? -> relationship `technology` updated.
- [ ] Service renamed? -> renamed in the model, no alias left behind.
- [ ] Code deleted? -> corresponding elements deleted.
- [ ] Any component view now describing internals that no longer exist? -> update or delete it.
- [ ] `npx likec4 validate` clean.

## Periodic review

Quarterly, or on any reorg or service split:

1. Walk the container list against the actual deploy target — anything unaccounted for in
   either direction is a finding.
2. Ask each container's owner whether its description is still how they would describe it.
3. Delete component views nobody has read or updated in the interval. L3 rots fastest and is
   the cheapest to regenerate on demand.
