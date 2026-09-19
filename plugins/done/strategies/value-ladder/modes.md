# value-ladder — modes

| Mode | Prepares (model) | You | Done when | Artifact |
|---|---|---|---|---|
| DECIDE | Options packet: 2–3 options, numbers from files actually read, one-line tradeoff each, one-line recommendation, who consumes the ruling | Rule | Ruling recorded in decisions.md; card status `ruled <date>` | Packet in the reply; ruling line |
| REVIEW | Pre-read: what the PR or artifact claims, what it actually does, scenario evidence vs green tests, merge risk, one recommendation | Merge / rework / close | Merged or closed | Pre-read notes |
| QA | Checklist with expected observations; findings become cards, never fixes | Run it | Checklist run, findings carded | Checklist + findings cards |
| DO | Concrete first step and the finish condition | Do it | Card `done <date>` | The first step |

Per-card override: `(gate: <name>)` in the Mode cell names someone else whose approval the card needs.
