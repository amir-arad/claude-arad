---
name: ask-model
description: Call another model harness headlessly — Gemini (and other models) via the Antigravity `agy` CLI, or OpenAI Codex via `codex` — and get the bare answer on stdout. Use for any "ask Gemini/Codex" step, a second opinion, a cross-model check, or delegating a sub-task to a different model. Parallel-safe (one process per call).
---

# ask-model

One script, `${CLAUDE_PLUGIN_ROOT}/lib/ask.mjs`. No npm dependencies.

```bash
node ${CLAUDE_PLUGIN_ROOT}/lib/ask.mjs agy   "<prompt>"
node ${CLAUDE_PLUGIN_ROOT}/lib/ask.mjs codex "<prompt>"
node ${CLAUDE_PLUGIN_ROOT}/lib/ask.mjs agy --model "Gemini 3.1 Pro (High)" --prompt-file /abs/prompt.md
cat prompt.md | node ${CLAUDE_PLUGIN_ROOT}/lib/ask.mjs codex --cwd /abs/repo
```

| Option | Default | Meaning |
|---|---|---|
| `--model` | harness default | agy: label or id from `agy models`; codex: `-m` value |
| `--cwd` | fresh temp dir | Working root the model sees |
| `--timeout` | `300` | Seconds before kill |
| `--prompt-file` | — | Otherwise positional words, otherwise stdin |

Exit codes: `0` answer · `1` harness error or empty answer (details on stderr) · `2` timeout (partial answer still printed) · `3` CLI not found (`AGY_BIN` / `CODEX_BIN` override) · `64` usage.
Treat any non-zero exit as "no answer", never as an empty or passing one.

## Behaviour

- **Neutral cwd by default.** Both CLIs load instruction files (`AGENTS.md`, etc.) from their root, so a temp dir keeps your instructions out of the other model. Pass `--cwd` only when it needs repo context.
- **Long prompts are fine.** agy gets its prompt as stream-json on stdin, codex via `exec -`; neither goes through argv (Windows caps a command line at ~32K chars).
- **codex runs `--ephemeral -s read-only`**: no session files, no writes.
- **agy is not sandboxed by this script.** It has file-write and shell tools; ask for an answer, not an action, unless you want it to act in `--cwd`.

## Models

- agy: run `agy models` for current labels/ids. An invalid `--model` fails fast with the valid list.
- codex: whatever `~/.codex/config.toml` allows; omit for its configured default.
