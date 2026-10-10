<!-- FORMAT CONTRACT (done plugin)
One `key: value` per line inside the single fenced block. Dotted keys nest.
sync: git | github | self-report. sync.repo is used only when sync is github.
never: comma-separated paths or surfaces the model must not edit.
agents.max: subagents what-now keeps in flight (default 2). agents.worktree: how a code-changing subagent gets its checkout (default: an isolated git worktree). agents.dispatch: `subagent` (default) or an instruction for an outside dispatcher, e.g. `file a gh issue with the card's spec and label it agent-go`.
Unknown keys are kept and ignored.
Edited by /done:init-done and by hand. Never by what-now or goals.
-->
# Project

```
name: 
root: .
strategy: value-ladder
sync: git
sync.repo: 
never: 
agents.max: 2
agents.worktree: 
agents.dispatch: subagent
```

## Goal

One sentence. Edited only by /done:goals-done or the user.
