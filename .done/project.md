<!-- FORMAT CONTRACT (done plugin)
One `key: value` per line inside the single fenced block. Dotted keys nest.
sync: git | github | self-report.  capacity: agents | people | none.
sync.repo and sync.labels.* are used only when sync is github.
thresholds.* and gates.* override strategies/<strategy>/ladder.md and modes.md defaults.
never: comma-separated paths or surfaces the model must not edit.
Edited by /done:init-done and by hand. Never by what-now or goals.
-->
# Project

```
name: done-plugin
root: .
strategy: agent-fleet
sync: github
sync.repo: amir-arad/claude-arad
sync.labels.ready: agent-ready
sync.labels.in_progress: agent-in-progress
capacity: none
thresholds.max_in_flight: 2
thresholds.rebase_after: 5
gates.dispatch: human
gates.review: human
gates.decide: human
gates.qa: human
never: 
```

## Goal

Get to a good, viable flow with the done plugin that I can use smoothly.
