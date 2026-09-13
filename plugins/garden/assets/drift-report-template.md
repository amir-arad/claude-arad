# Documentation Drift Report

**Run root:** {{root}}
**As of:** {{as_of}}
**Tools:** `doc-audit.mjs`, `doc-graph.mjs` (garden {{skill_version}})

Every number below comes from the `summary` block of a tool envelope (`references/contract.md` §2). There is no aggregate score — if a reader asks "what is our doc health out of 100", the answer is the histogram plus the worst offenders.

---

## What was run

```bash
node ${CLAUDE_PLUGIN_ROOT}/lib/doc-audit.mjs {{root}} --as-of {{as_of}} --json
node ${CLAUDE_PLUGIN_ROOT}/lib/doc-graph.mjs {{root}} --as-of {{as_of}} --json
```

Gate: `--min-severity {{gate}}`. Exit codes: {{doc_audit_exit}} (doc-audit), {{doc_graph_exit}} (doc-graph).

## Summary

| | doc-audit | doc-graph |
|---|---|---|
| Docs scanned | {{da_files_scanned}} | {{lc_files_scanned}} |
| Docs with findings | {{da_files_with_findings}} | {{lc_files_with_findings}} |
| Links checked | — | {{lc_links_checked}} |
| Total findings | {{da_total}} | {{lc_total}} |

### Severity histogram

All five keys, zeros included.

| Severity | doc-audit | doc-graph |
|---|---|---|
| critical | {{da_critical}} | {{lc_critical}} |
| high | {{da_high}} | {{lc_high}} |
| medium | {{da_medium}} | {{lc_medium}} |
| low | {{da_low}} | {{lc_low}} |
| info | {{da_info}} | {{lc_info}} |

### Findings by rule

From `summary.by_rule`. Only rules that fired appear.

| Rule | Count | Category |
|---|---|---|
| {{rule}} | {{count}} | {{category}} |

## Worst offenders

Docs with the most findings, highest severity first.

| Doc | Findings | Worst severity | Rules |
|---|---|---|---|
| {{path}} | {{n}} | {{severity}} | {{rules}} |

## Findings

One row per finding record. `path:line:column` is copy-pasteable into an editor.

### High and above

| Location | Rule | Category | Message | Fix type |
|---|---|---|---|---|
| {{path}}:{{line}}:{{column}} | {{rule}} | {{category}} | {{message}} | {{fix_type}} |

### Medium

| Location | Rule | Category | Message | Fix type |
|---|---|---|---|---|
| {{path}}:{{line}}:{{column}} | {{rule}} | {{category}} | {{message}} | {{fix_type}} |

### Low and info

| Location | Rule | Category | Message | Fix type |
|---|---|---|---|---|
| {{path}}:{{line}}:{{column}} | {{rule}} | {{category}} | {{message}} | {{fix_type}} |

## Routing by fix type

`details.fix_type` says how much judgement a finding needs, not how bad it is.

- **auto** ({{n_auto}}) — mechanical: version strings, moved link targets. {{auto_notes}}
- **semi** ({{n_semi}}) — generate a skeleton, human fills it in. {{semi_notes}}
- **manual** ({{n_manual}}) — needs domain judgement. {{manual_notes}}

## What to do first, and why

Findings are what the tools saw. Deciding what to work is a separate step — state the reasoning rather than labelling the urgency.

1. {{action}} — {{because}}

## Findings not worth acting on

Record these so the next run does not re-litigate them.

| Location | Rule | Why it stands | 
|---|---|---|
| {{path}} | {{rule}} | {{justification}} |

---

*Generated with `/garden:survey`*
