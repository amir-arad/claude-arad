# Deriving a model from a repo

Model what is deployed, not what the README claims.

## Which sources each level may use

**L1 (Context)** may be drafted from soft sources, because intent, actors, and business
purpose are not written in the code:

| Soft source | What it is good for | What it lies about |
|---|---|---|
| KB entries, architecture docs | Intent, actor names, why the system exists | Current topology; often years stale |
| ADRs | Decisions and their rationale | Whether the decision was carried out |
| README / onboarding docs | Vocabulary the team uses | Anything operational |
| Published API docs, OpenAPI specs | Consumer-facing contracts and who consumes them | Endpoints removed but still documented |
| Logs, traces, metrics, dashboards | Which integrations are *actually live* and how heavily | Rarely-exercised paths that exist but are quiet |
| Tickets, incident reports | Real failure modes and real dependencies | Point-in-time snapshots |
| Owners, in conversation | Intent and unwritten constraints | Recall of details |

Then **ground every drafted element and relationship** against the code or infrastructure
table below. A soft source proposes; code confirms. Logs and traces are the strongest soft
source — they observe the running system — but they still show only what ran during the
window observed, so treat them as a prompt to go find the client in the code.

Anything you cannot ground is a finding: delete it, or keep it with an explicitly
unverified description and raise it with the owner. Never let a soft source alone add an
arrow.

**L2–L4** use the code and its deployment/infrastructure config only. Read the level above
for context — naming, scope, which relationships a reader cares about — never for facts.
If the code contradicts L1, the code wins and L1 gets corrected.

An existing LikeC4 model is itself a soft source for this purpose: query it through the
`likec4` MCP server to find what is claimed, then ground each claim in the artefacts below.

## Code and infrastructure sources (the only ones L2–L4 may use)

In order of trustworthiness:

| Signal | Where | Yields |
|---|---|---|
| Deploy units | `Dockerfile*`, `docker-compose*`, k8s manifests, Helm charts, `Procfile`, `serverless.yml`, Terraform | Containers |
| Datastores | connection strings, ORM config, migrations dir, compose services | DB / cache containers |
| Messaging | topic and queue names in config, client libs (kafka, amqp, sqs) | Queue containers + async relationships |
| Inbound entry points | route/controller/handler registration, API gateway config, ingress | Person-to-container and system-to-container relationships |
| Outbound calls | HTTP/gRPC client construction, SDK imports, base URLs in config | External systems |
| Third parties | dependency manifests, secret and env var names (`STRIPE_*`, `SENDGRID_*`) | External systems |
| Scheduled work | cron config, workflow schedulers, systemd timers | Job containers |
| Build outputs | monorepo workspace/package layout, CI job matrix | Candidate containers — verify each is deployed |

Infrastructure topology (clusters, zones, nodes) belongs in LikeC4's `deployment` block,
mapped to the containers above — not as extra containers in the model.

## Judgment calls

- **Library vs container**: if it ships inside another deployable, it is not a container.
  It may be a component of that container.
- **Monorepo package**: a container only if CI deploys it independently.
- **Sidecar / proxy**: model only if a reader's understanding depends on it.
- **Serverless**: group functions sharing a purpose and deployment into one container; one
  box per lambda is noise.

## When facts run out

Record the gap in the model rather than guessing: give the element a description saying what
is unverified, and take the question to the owning team. An invented arrow is worse than an
admitted unknown.

## Rationalizations to refuse

| Excuse | Reality |
|---|---|
| "The architecture doc says so, that is good enough for L2" | The doc is a hypothesis about the code. Open the code. |
| "The README is recent" | Recency of the file is not recency of the fact it states. |
| "L1 already shows this relationship, so L2 can assume it" | Abstract levels frame, never supply. Find the client. |
| "I know this stack, this is how it is always wired" | Training intuition is not evidence about this system. |
| "The metrics show traffic, so the integration exists" | It shows *something* ran. Ground it in the calling code before you label the protocol. |
| "Grounding every element is too slow" | An ungrounded model is worse than none — it is trusted and wrong. Mark unverified instead. |
