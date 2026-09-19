# value-ladder — routing ladder

First rule that fires wins. Inputs: `counts` JSON, `derive` JSON, watch list, user input.
Scope: one person doing the work. How a card gets done (by hand, by this session, or handed to someone or something else) is outside the ladder; only its facts (issue filed, PR open, merged) come back through sync.

0. **Blocker present** — `counts.blockers` non-empty, a watch-list item says blocked, or the user reports an environmental failure (CI red on the base branch, auth failure, a tool down). Route: clear the blocker. Log it as `card:-`.
1. **Finished work waiting on you** — `awaiting_gate > 0` (a card at `pr #N`) or `ready_review > 0`. Route: the oldest such card. Prepare per REVIEW in modes.md. Unmerged work is the cheapest value to ship.
2. **Decision pending** — `ready_decide > 0`. Route: `decideOrder[0]` (unblocks the most cards). Prepare per DECIDE.
3. **QA or DO ready** — `ready_qa + ready_do > 0`. Route: the READY NOW QA or DO card with the highest `unblocks` count, then plan order. Prepare per its mode.
4. **Nothing routable** — say so, list what every open card is blocked on, and suggest `/done:goals-done`.

Deviation: allowed for a stated reason (user request, or judgment that a lower rule is worth more today). The log line carries `deviation:"reason"` instead of `rule:k`.
