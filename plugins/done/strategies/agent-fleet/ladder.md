# agent-fleet — routing ladder

First rule that fires wins. Inputs: `counts` JSON, `derive` JSON, watch list, user input.
Thresholds (defaults here; `thresholds.*` in project.md override): max_in_flight = 2, rebase_after = 5.

0. **Blocker present** — `counts.blockers` non-empty, a watch-list item says blocked, or the user reports an environmental failure (CI red on the base branch, auth failure, worker sandbox down, single-writer conflict). Route: clear the blocker. Log it as `card:-`.
1. **Delegate output awaiting the owner's gate** — `awaiting_gate > 0`. Route: the card whose PR is furthest behind base (≥ rebase_after merges first; ask the user for behind-by if facts lack it), then the oldest. Prepare per REVIEW in modes.md.
2. **Dispatch gap** — `dispatch_gap > 0` and `ready_dispatch > 0`. Route: up to `dispatch_gap` READY NOW DISPATCH cards in plan order. Prepare tickets per DISPATCH; the owner flips labels.
3. **Decision pending** — `ready_decide > 0`. Route: `decideOrder[0]`. Prepare per DECIDE.
4. **QA or DO ready** — `ready_qa + ready_do > 0`. Route: first READY NOW QA card, else first DO card, in plan order.
5. **Nothing routable** — say so, list what every open card is blocked on, and suggest `/done:goals-done`.

Deviation: allowed for a stated reason (user request, or judgment that a lower rule is worth more today). The log line carries `deviation:"reason"` instead of `rule:k`.

Capacity `none`: rules 1–2 never fire (no delegates). Capacity `people`: rule 2 reads "hand off" instead of "flip a label"; the owner tells the person.
