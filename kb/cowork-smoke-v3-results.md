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
- The follow-up run below covers overwrite, rename and whether the grant lasts.

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

## Follow-up: a fresh session (`modest-trusting-lamport`), 2026-09-19

Script written by Cowork Fable 5.1. `P=~/mnt/claude-arad`. The pre-grant steps ran before any permission call.

| Step | Result |
|---|---|
| `printf %s "C:\Workspace\claude-arad" \| od -c` | bytes `C : \ W o r k s p a c e ...`. Bash received the Windows string unchanged |
| `printf %s "$P" \| od -c` | `/sessions/<name>/mnt/claude-arad` |
| `rm` before the grant | `rm: cannot remove 'C:\Workspace\claude-arad\.t1': Operation not permitted` |
| overwrite (`>`) before the grant | ok |
| `mv` over an existing file, before the grant | ok |
| `mv` to a new name, before the grant | ok |
| node `fs.renameSync` over an existing file, before the grant | ok |
| `allow_cowork_file_delete`, then `rm` | ok |
| `ls -d "C:\Workspace\claude-arad"`, `ls -d "C:/Workspace/claude-arad"` | `No such file or directory` (both) |

Findings:
- **The delete grant is per session.** A new session is denied `rm` again.
- **Only unlink is blocked.** Create, overwrite, truncate and rename (including rename over an existing file) work without the grant, so atomic write via temp file plus rename works.
- **The folder's Windows path does not resolve in bash.** Commands must use `~/mnt/<name>`.
- **The output rewrites folder paths:** the `rm` error printed the Windows path although the command used the sandbox path. Plugin-path input is rewritten (A3–A7), so the placeholder paths work. Folder-path input is not (step 1, step 8).

Consequences for `done`:
- Scripts and commands use `~/mnt/<name>`, never the Windows path.
- State writes use overwrite or rename and never delete. Then no grant is needed. If a delete is ever required, call `allow_cowork_file_delete` once per session.

Open question: is the output rewrite consistent?
- The v3 report as pasted to the user shows C3's EPERM with the Windows path.
- Afterwards, the v3 session's model said its own tool output showed the sandbox path there.
- The two statements conflict. The rewrite may happen between the tool output and what the user sees, not in the tool output itself. Unresolved; it matters only if a script or model parses paths out of tool output.
- If `done` ever has to delete, calling `allow_cowork_file_delete` once per session is expected behaviour, not an error.

## Line endings: Cowork git reports CRLF files as modified

- Smoke v3 D3 showed ` M` on `marketplace.json`, `.garden/*`, `release.yml` and `.gitignore`.
- The same working tree was clean in Claude Code on the Windows host.
- Host check: `git ls-files --eol` gives `i/lf w/crlf` for those files, with `core.autocrlf=true` on the host and no `.gitattributes`.
- Inference: Cowork's Linux git does not use the host's autocrlf and treats the CRLF working-tree files as changed. A commit made from Cowork could turn every such file into a CRLF diff.
- Consequence for `done`: `git status` in Cowork overstates changes. Sync should rely on `git log`, not the dirty list. Adding `.gitattributes` (`* text=auto`) to a project might remove the effect (untested).

Raw outputs: [Cowork raw run outputs](cowork-raw-runs-2026-09-19.md).
