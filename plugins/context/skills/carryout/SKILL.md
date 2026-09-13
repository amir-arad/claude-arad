---
name: carryout
description: Generate a self-contained "carryout" prompt that lets a fresh Claude, with no access to this conversation, resume the work in a new chat. Use whenever the user types "/carryout" or "carryout", or asks to hand off, continue elsewhere, or write a continuation/handoff prompt. "/carryout" alone is enough.
---

# Carryout

Write one prompt a successor Claude can paste into a new chat to resume this work with no memory of it. Print it inline in a single fenced code block, addressed to "you", imperative.

**Signal vs noise.** The user's words are signal: preserve goal, constraints, corrections, and decisions faithfully — near-verbatim where wording matters. Your prior output is mostly noise: drop reasoning, narration, dead ends, hedging. Carry the result, not the journey.

**Include only what changes the successor's next move**, each once:
- Objective — what done looks like.
- Constraints — every hard rule the user set, their wording.
- State — what exists now, concretely.
- Artifacts — exact paths, IDs, URLs, configs, must-have snippets; reproduce verbatim, never summarize an identifier.
- Decisions — what's settled; reason only if it stops a relitigation.
- Next action — the specific immediate step.
- Open threads — unresolved questions, gotchas, what could be wrong.

**Cut** before printing: history, redundancy, resolved threads, anything the successor can read from a named file/artifact or rederive, and anything a capable model already knows (general concepts, standard terms, how common tools work). Per line: does the successor act differently because it's here? If no, delete. Protect the user's constraints and exact artifacts; trim your own contributions hardest.

Final length is justified only by signal.
