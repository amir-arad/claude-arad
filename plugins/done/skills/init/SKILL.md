---
name: init
description: Smoke check for the done plugin (temporary). Probes plugin paths, the selected project folder, shell/node/Write-tool writes, git, and GitHub access. Replaced by the real init in a later release.
disable-model-invocation: true
---

# init (smoke v3)

Report each check as one line, `<id> <check>: <result>`. Paste command output verbatim (trim to 300 chars per line). Do not interpret, do not fix, do not skip a check because an earlier one failed. If a command is refused or blocked, report the exact refusal text. Run everything; ask nothing, except in check B1.

## A. Plugin paths

- A1 skill-dir text: copy verbatim the text between the brackets: [${CLAUDE_SKILL_DIR}]
- A2 plugin-root text: copy verbatim: [${CLAUDE_PLUGIN_ROOT}]
- A3 skill-dir ls: `ls "${CLAUDE_SKILL_DIR}/../../.claude-plugin/plugin.json"`. Also report the exact command string the shell tool actually received, if visible to you.
- A4 plugin-root ls: `ls "${CLAUDE_PLUGIN_ROOT}/lib/smoke.mjs"`
- A5 cat via placeholder: `head -3 "${CLAUDE_SKILL_DIR}/../../.claude-plugin/plugin.json"`
- A6 Read tool via placeholder: use your file-read tool (not the shell) on `${CLAUDE_SKILL_DIR}/../../.claude-plugin/plugin.json`; report the `"version"` value or the error.
- A7 node via placeholder, no arg: `node "${CLAUDE_SKILL_DIR}/../../lib/smoke.mjs"`; report every line.
- A8 invocation: did you receive this skill via the Skill tool, a slash command typed by the user, or other? Report what you know; `unknown` if unsure.

## B. Project folder

- B1 selected folder: `ls -la ~/mnt 2>&1; pwd; echo "HOME=$HOME"`. Report output. If no user-selected folder exists under `~/mnt` (anything other than `outputs`, `uploads`, `.remote-plugins`, `.projects`, `.claude`), request one with the cowork directory tool, then rerun. Report the tool name used or `not needed`.
- B2 folder path: absolute sandbox path of the selected folder, as P. If more than one candidate, list all and use the one the user selected. All later checks use P.
- B3 folder facts: `ls -la "P" | head -20; stat -c '%U:%G %a' "P"; df -h "P" | tail -1`
- B4 mount line: `mount | grep -F "$(basename "P")" || echo none`

## C. Writes into P (clean up after each)

- C1 shell write: `mkdir -p "P/.done-smoke-sh" && echo ok > "P/.done-smoke-sh/a.txt" && cat "P/.done-smoke-sh/a.txt"`
- C2 shell delete: `rm -r "P/.done-smoke-sh" && echo deleted; ls -a "P" | grep done-smoke || echo gone`
- C3 node write+delete: `node "${CLAUDE_SKILL_DIR}/../../lib/smoke.mjs" "P"`; report every line.
- C4 Write tool: with your file-write tool create `P/.done-smoke-write/b.md` containing `ok`. Then shell `cat "P/.done-smoke-write/b.md"`.
- C5 cleanup of C4: `rm -r "P/.done-smoke-write" && echo deleted`. If denied, report the text, then call the cowork delete-permission tool if one exists, retry, and report both results.
- C6 leftovers: `ls -a "P" | grep done-smoke || echo none`

## D. Git in P

- D1 repo: `git -C "P" rev-parse --show-toplevel 2>&1`
- D2 log: `git -C "P" log --oneline -3 2>&1`
- D3 status: `git -C "P" status --short 2>&1 | head -5; ls "P/.git/"*.lock 2>&1`
- D4 remote: `git -C "P" remote -v 2>&1 | head -2`
- D5 fetch: `timeout 20 git -C "P" fetch --dry-run 2>&1 | head -3; echo exit=$?`
- D6 locks after: `ls "P/.git/"*.lock 2>&1 || echo none`

## E. GitHub access

- E1 gh: `gh --version 2>&1 | head -1`
- E2 https: `curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://api.github.com/ 2>&1`
- E3 connector tools: list the names of every tool available to you whose name contains `github` (case-insensitive), including deferred ones. Names only, or `none`.
- E4 connector call: if E3 found a tool that reads the authenticated user or lists pull requests, call it once for the repo in D4 (or the authenticated user if no remote). Report `ok` plus one fact (e.g. open PR count), or the error. Do not write anything.

## F. Environment

- F1 tools: `node --version; npm --version; git --version; python3 --version 2>&1`
- F2 env: `env | grep -i -E 'claude|plugin|skill' | cut -c1-200`
- F3 identity: `id; umask; date -Is; echo TZ=$TZ`
- F4 cowork tools: list names of every tool whose name contains `cowork`, including deferred ones.

End with the single line `smoke v3 done`.
