# agent-fleet — modes

| Mode | Prepares (agent) | Gates (owner) | Done when | Artifact |
|---|---|---|---|---|
| DECIDE | Options packet: 2–3 options, numbers from files actually read, one-line tradeoff each, one-line recommendation, who consumes the ruling | Rules | Ruling recorded in decisions.md; card status `ruled <date>` | Packet in the reply; ruling line |
| DISPATCH | Ticket body: self-contained (no links into files a worker cannot read), no placeholders, acceptance criteria, traps stated, sized for one worker run | Files or approves the ticket, flips the ready label | PR merged; card `done <date>` | Ticket text + exact label command for the owner |
| REVIEW | Pre-read: what the PR claims, what the diff does, scenario evidence vs green tests, behind-by, merge risk, one recommendation | Rules merge / rework / close | Merged or closed | Pre-read notes |
| QA | Checklist with expected observations; findings become cards, never fixes | Runs it | Checklist run, findings filed | Checklist + findings cards |
| DO | Concrete first step and the finish condition | None by default | Card `done <date>` | The work itself |

Per-card override: `(gate: <name>)` in the Mode cell replaces the owner as gate for that card. `gates.<mode>` in project.md replaces the default for every card of that mode (`none` removes the gate).
