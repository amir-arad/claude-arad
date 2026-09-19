---
date: 2026-09-19
related: [skill-placeholders-unset-in-cowork.md, runbooks.md]
synthesized_from:
  date: 2026-09-19
  topic: "Environment probe of the Cowork bash sandbox (12 checks, run verbatim)"
  tool: cowork
---

# Cowork sandbox environment facts

What the Cowork (Claude desktop) Linux sandbox looked like when probed on 2026-09-19. Command output only; the one inference is marked.

## Host and shell

- `pwd` → `/sessions/<session-name>` (= `$HOME`); `id` → unprivileged uid/gid 1091, no extra groups.
- `uname -a` → Linux, kernel 6.8.0-138-generic, Ubuntu 22.04, x86_64.
- `SHELL=/bin/sh`, `LANG=C.UTF-8`, `TZ=Europe/Berlin`, `SANDBOX_RUNTIME=1`.
- `TMPDIR`, `CLAUDE_TMPDIR`, `CLAUDE_CODE_TMPDIR` all `= $HOME/tmp`; `node -e os.tmpdir()` → same; `process.platform` → `linux`.
- All network egress via authenticated proxy on localhost: `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`/`GRPC_PROXY`/`FTP_PROXY` (socks5h), `GIT_SSH_COMMAND` with a socat `PROXY:` ProxyCommand on port 3128, `GIT_CONFIG_PARAMETERS='http.proxyAuthMethod=basic'`, `JAVA_TOOL_OPTIONS` proxy agent, `RSYNC_PROXY=localhost:1080`. `NO_PROXY` covers localhost and RFC1918 ranges.
- No `CLAUDE_SKILL_DIR`, `CLAUDE_PLUGIN_ROOT`, or any other `*SKILL*`/`*PLUGIN*` environment variable; the placeholders are text substitutions — see [skill placeholders in Cowork](skill-placeholders-unset-in-cowork.md).

## Tools

| Tool | Result |
|---|---|
| node | v22.23.2 at `/usr/bin/node` |
| npm | 10.9.8 |
| python3 | 3.10.12 |
| git | 2.34.1 at `/usr/bin/git` |
| gh | `command not found` |
| `PATH` | `/usr/local/lib/node_modules_global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` |

## Mounts and folders

`mount` shows `/` (ext4) and `/sessions` (ext4, `/dev/sdc`) plus tmpfs; no separate mount appears for anything under `~/mnt` (no virtiofs/fuse line). `/mnt` on the host side holds only `.virtiofs-root/` (owned by `nobody`, mode 700). Later runs (smoke v3) found that a selected folder has its own fuse mount; see [smoke v3 results](cowork-smoke-v3-results.md).

`~/mnt/` contents:

| Path | Owner / mode | Writable probe |
|---|---|---|
| `outputs/` | session user, `drwx------` | `touch` ok, `rm` → `Operation not permitted` |
| `uploads/` | session user, `dr-x------` | `touch` → `Read-only file system` |
| `.remote-plugins/plugin_<id>/` | `nobody` parent; plugin tree `dr-x------` / `-r-x------` | read-only |
| `.projects/<project-uuid>/` | `docs/`, `files/`, `metadata.json` (name, description, synced_at) | read-only |
| `.claude/` | `nobody:nogroup` | not probed |
| `<selected-folder-name>/` | appears only after `mcp__cowork__request_cowork_directory` | create, overwrite and rename ok for shell, node and Write; `rm` denied until `mcp__cowork__allow_cowork_file_delete`, per session. See [smoke v3 results](cowork-smoke-v3-results.md) |

Before a folder is selected, no repository is reachable from the sandbox; `outputs/` is Cowork's per-session output directory, not a project folder.

## Plugin location on disk

Installed plugins live at `~/mnt/.remote-plugins/plugin_<id>/`. Each holds `.claude-plugin/plugin.json`, `skills/<skill>/SKILL.md`, `CHANGELOG.md`, and `lib/` when the plugin ships one. Directories are named by id, so `find / -name plugin.json -path '*<plugin-name>*'` returns nothing; the id matches the one in the Windows base directory the skill header shows (`...\rpm\plugin_<id>\skills\<skill>`).

## Cowork tools seen

Tools with `cowork` in the name: `mcp__cowork__present_files`, `mcp__cowork__send_user_message`, `mcp__cowork__request_cowork_directory`, `mcp__cowork__save_skill` (loaded), and deferred `mcp__cowork__allow_cowork_file_delete`, `mcp__cowork__read_widget_context`, `mcp__cowork-onboarding__show_onboarding_role_picker`. Deferred tools' schemas were not loaded; their purpose is known from the name only.

## Limits of this evidence

Single session, single machine (Windows 11 host), one probe run. The `rm` restriction on `outputs/` was observed for one file created by `touch`; whether `allow_cowork_file_delete` lifts it was not tested (inference only).
