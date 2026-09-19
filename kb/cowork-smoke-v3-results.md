---
date: 2026-09-19
related: [done-plugin-status.md, cross-harness-plugins.md, cowork-sandbox-environment.md, skill-placeholders-unset-in-cowork.md]
synthesized_from:
  date: 2026-09-19
  topic: "done 0.2.2 smoke v3 run in Cowork, folder claude-arad selected"
  tool: cowork
---

# Cowork smoke v3 results (done 0.2.2)

One run, one Windows host, session `beautiful-loving-galileo`, selected folder `claude-arad` (a git repo with a GitHub SSH remote). The model in the run reported the results. The skill is `plugins/done/skills/init/SKILL.md` at 0.2.2.

## Plugin paths

| Check | Result |
|---|---|
| A1/A2 placeholder text | Windows host path, same as smoke v2 |
| A3–A5 `ls`/`head` through the placeholder | ok; output shows `~/mnt/.remote-plugins/plugin_<id>/...` |
| A6 Read tool through the placeholder | ok (`0.2.2`) |
| A7 `node "<placeholder>/../../lib/smoke.mjs"` | ok; `import.meta.url` resolves to the sandbox path; `process.platform` is `linux` |
| A8 route | `/done:init` typed; a hook reported `Skill "done:init" was invoked` |

- The run's model said the shell tool translated the Windows path before bash, and that it could not see the rewritten string. That is the model's report, not something anyone observed directly.
- Result: `${CLAUDE_SKILL_DIR}/../../<dir>/...` works for the shell, `node` and the Read tool. No path-rebuild fallback is needed.

## Selected folder

- `~/mnt/` held `.claude`, `.projects`, `.remote-plugins`, `claude-arad`, `outputs`, `uploads`. The selected folder was the only entry outside the known set.
- cwd and `$HOME` were `/sessions/<name>`, not the folder.
- Mount: `/proc/self/fd/3 on C:\Workspace\claude-arad type fuse (rw,...,allow_other)`. The mount point is the literal Windows path string.
- The model used `P=C:\Workspace\claude-arad`, the Windows path, for every check, and shell, `node` and git all accepted it. The mechanism is unknown. `~/mnt/claude-arad` was not tested as P.
- Owner is the session user, mode 700.

## Writes and deletes in the folder

| Operation | Shell | node | Write tool |
|---|---|---|---|
| create + read | ok | ok | ok |
| delete (`rm`, `unlink`) | `Operation not permitted` | `EPERM` | not tried before grant |
| delete after `mcp__cowork__allow_cowork_file_delete` | ok | ok | ok |

- Grant message: `File deletion is now enabled for the "claude-arad" folder.`
- Not tested: overwriting an existing file, `rename` (atomic write), `mkdir` of an existing dir, and whether the grant lasts beyond the session.

## Git

- `rev-parse`, `log`, `status` and `remote` in the folder: ok. No `.git/*.lock` before or after.
- `git fetch`: `Host key verification failed.` The SSH remote is unreachable. HTTPS was not tried with git.

## GitHub

- `gh`: not found.
- `curl https://api.github.com/`: `Received HTTP code 403 from proxy after CONNECT`. The sandbox proxy blocks GitHub.
- GitHub MCP connector: present as `mcp__<uuid>__*` (45 tools: `get_me`, `list_pull_requests`, `list_issues`, `search_*`, write tools). **No tool name contains `github`.**
- `list_pull_requests` for `amir-arad/claude-arad`, state open: ok, 0 open PRs.

## Environment

The same as [Cowork sandbox environment](cowork-sandbox-environment.md): node v22.23.2, npm 10.9.8, git 2.34.1, Python 3.10.12, uid 1094, umask 0022, TZ Europe/Berlin. The Cowork tool list is the same as the earlier probe.

## Consequences for `done` (inference from the above)

- Project root: the single non-system entry under `~/mnt/`. Ask if there are several. Never use cwd.
- Scripts take the project dir as an explicit argument.
- State files must avoid delete and rename, or `init` must call `allow_cowork_file_delete` first. Overwriting is untested.
- Remote sync: detect the connector by tool function (`list_pull_requests`, `get_me`), not by `github` in the name. Local git works for reads. Fetch does not.
