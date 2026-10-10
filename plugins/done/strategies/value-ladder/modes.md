# value-ladder — modes

| Mode | Prepares (model) | Chore part (subagent) | You | Done when | Artifact |
|---|---|---|---|---|---|
| DECIDE | Options packet: 2–3 options, numbers from files actually read, one-line tradeoff each, one-line recommendation, who consumes the ruling | Packet inputs that need a run, probe, measurement or long read; the agent writes them to a file the packet cites | Rule | Ruling recorded in decisions.md; card status `ruled <date>` | Packet in the reply; ruling line |
| REVIEW | Pre-read: what the PR or artifact claims, what it actually does, scenario evidence vs green tests, merge risk, one recommendation | none | Merge / rework / close | Merged or closed | Pre-read notes |
| QA | Checklist with expected observations; findings become cards, never fixes | none | Run it | Checklist run, findings carded | Checklist + findings cards |
| DO | Concrete first step and the finish condition | Owner `agent`: the whole card, ending in a PR or the named artifact | Do it (Owner empty) | Card `done <date>` | The first step, or the agent's PR |

Per-card override: `(gate: <name>)` in the Mode cell names someone else whose approval the card needs.
Subagents never merge, never apply or remove labels, and never edit anything under `never:`.
