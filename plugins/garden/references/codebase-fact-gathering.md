# Codebase Fact-Gathering & Pattern Identification

Read this when you are examining a codebase before writing any onboarding docs — it holds the Phase 1 fact-gathering commands and the Phase 2 architecture-pattern classification.

## Codebase Analysis Process

### Phase 1: Gather Facts

Start with the two scripts — they cover the mechanical inventory in one pass and work on any platform:

```
node ${CLAUDE_PLUGIN_ROOT}/lib/scan.mjs <project> --as-of <YYYY-MM-DD> --json
node ${CLAUDE_PLUGIN_ROOT}/lib/setup-check.mjs <project> --as-of <YYYY-MM-DD> --json
```

The root is a positional argument (default `.`) and `--as-of` fixes the date the run is reckoned
against, so two runs over the same tree produce identical output. `--help` on either script
prints its full flag list.

The `scan` tool gives you: tech stack and framework configs, entry points, key files, parsed
runtime/dev dependencies, per-directory file counts and extension mixes, LOC, git edit-frequency
hotspots, and the depth-2 tree — all under snake_case keys alongside the contract envelope.

The `setup-check` tool gives you a completeness count over its eleven-item checklist (how many
checks passed, warned, and failed) plus one finding per failing or warning check, each carrying a
contract `severity` and the check's `importance` (`required|recommended|optional`). It is a
tally, not a rating. It exits 1 when findings reach `--min-severity` (default `low`), 0 when
they do not, and 2 if it cannot run — so it can gate a pipeline.

Then fill the gaps the scanner cannot answer, using your file-search and read tools (not shell pipelines — they break across platforms):

1. **Scripts and commands** — read `package.json` scripts / `Makefile` targets / `pyproject.toml` entry points verbatim; these become the runbook commands.
2. **Largest source files** — the biggest files in `src/`, `app/`, `lib/` are complexity hotspots; cross-reference with `git_hotspots` from the scan to find the files that are both large and churning.
3. **API surface** — search for route definitions: `route.ts` under an `api/` path (Next.js), `router.get|post|put|delete` (Express), `@app.get|@router.get` (FastAPI), `urlpatterns` (Django).
4. **Database schema** — locate `schema.prisma`, `schema.ts`, `models.py`, `migrations/`, and read the actual tables.
5. **Recent significant changes** — `git log --oneline --since="90 days ago"` and pick out feat/refactor/breaking/migrate commits; these mark the code paths that are actually alive.
6. **Environment variables** — search for `process.env.`, `os.environ`, `os.getenv`, then reconcile against `.env.example`. Config loader files often build names dynamically, so read them too.
7. **Real errors** — grep CI logs, issue tracker, and error-handling code for the exact error strings that will go into the debugging guide. Never invent them.

### Phase 2: Identify Architecture Patterns

Based on gathered facts, classify the project:

| Signal | Architecture Pattern |
|--------|---------------------|
| `app/` directory with `page.tsx` | Next.js App Router (file-based routing) |
| `src/routes/` with Express imports | Express REST API |
| FastAPI decorators | Python REST/async API |
| `docker-compose.yml` with multiple services | Microservices |
| Single `main.go` with handlers | Go monolith |
| `packages/` or `apps/` at root | Monorepo |
| Prisma/Drizzle schema file | ORM-managed database |
| `k8s/` or `terraform/` directories | Infrastructure as Code |

### Phase 3: Generate Documentation

Use the templates in [../assets/doc-templates.md](../assets/doc-templates.md) to produce the architecture overview, key file map, local setup guide, and debugging guide.
