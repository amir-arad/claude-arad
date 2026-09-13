# C4 notation

## The four levels

| Level | Diagram | Shows | Audience |
|---|---|---|---|
| L1 | System Context | The system, its users, and the systems it talks to | Everyone, incl. non-technical |
| L2 | Container | Deployable/runnable units inside the system + their tech | Developers, ops |
| L3 | Component | Groupings of code inside one container | Developers of that container |
| L4 | Code | Classes/tables | Generated only, usually skipped |

Plus two supplementary views: **System Landscape** (several systems in an enterprise) and
**Deployment** (mapping containers onto infrastructure nodes — LikeC4's `deployment` block).

LikeC4 has no built-in C4 kinds: declare them in `specification` and use them consistently.
The level of a view is decided by which kinds it includes, so a kind per level keeps views
honest.

## Element types

- **Person** — a human role, not a named individual. "Support agent", not "Dana".
- **Software System** — the highest level of abstraction. Exactly one is *in scope*; the
  rest are external.
- **Container** — a separately deployable or runnable thing: a server-side app, a SPA,
  a mobile app, a database, a queue/topic, a file store, a scheduled job, a serverless
  function group. **Not** a Docker container specifically, and **not** a shared library.
- **Component** — a grouping of code behind an interface inside one container. Not a class.

## Relationships

Directed, and carrying:
1. a **verb-phrase title** from source to destination — "Sends order events to", "Reads user
   profiles from";
2. **what flows**, when it isn't obvious;
3. the **technology/protocol** in `technology` — HTTPS/JSON, gRPC, JDBC, Kafka, SMTP.

Rules:
- Never title a relationship just "Uses", "Calls", or "Talks to".
- Model relationships at the most concrete level you have evidence for; LikeC4 derives the
  higher-level edges for context views. Do not add a duplicate system-level relationship.
- Bidirectional traffic that is request/response is **one** arrow in the direction of the
  dependency. Two arrows only for genuinely independent flows.

## Layout and styling

- Every view has a title, and a legend/key when styling carries meaning.
- Colour by element kind, not by team. Grey out external systems and people.
- Any of these means the view is too big: more than ~20 boxes, crossing lines you cannot
  untangle, needing to zoom to read labels. Split by scope, do not shrink the font.
- Consistency across views beats prettiness in any one of them.

## Abstraction discipline

Each view shows **one level**. Mixing levels is the most common defect: a container view
that shows three deployables and also the classes inside one of them tells the reader those
classes are equally significant. Push detail down a level or drop it.
