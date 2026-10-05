---
name: carryout
description: Generate a self-contained "carryout" prompt that lets a fresh Claude, with no access to this conversation, resume the work in a new chat. Use whenever the user types "/carryout" or "carryout", or asks to hand off, continue elsewhere, or write a continuation/handoff prompt. "/carryout" alone is enough.
---

# Carryout

Pull out the knowledge from this conversation that someone continuing the task would need, and print it as a single fenced code block.

**This is a knowledge brief, not instructions.** State everything as information, never as commands. Don't assign a role or persona, and don't explain things the reader would already know. The successor may well understand the task better than you.

If the approach is part of the task, include it, written as fact. For example, write "The user wants X done via Y", not "Do X via Y". If the user didn't specify an approach, leave it out.

**Budget: aim for under 150 words.** Go over only when there are hard constraints or identifiers that cannot be compressed. Shorter is better.

**Content.** Use only the items below that apply. Skip any that are empty. Don't add a heading where one line will do.
- Goal: what done looks like, in one sentence.
- Constraints: the user's hard rules, in their exact words.
- Artifacts: exact paths, IDs, URLs. Copy them exactly; never paraphrase an identifier.
- Where it stands: what is done and what is left.
- Findings: facts learned that would be costly to rediscover.
- Known blockers: only unresolved items that actually exist, never speculation.

Include a decision only if the successor would otherwise reverse it. Record a decision only if the user actually made it. If the user left a choice open, report it as open and list the options they named. Don't settle it on their behalf, even when only one option seems to remain. That includes settling it indirectly, for example by describing the remaining work as if one option had been picked.

**Task context only, never environment.** Do not copy anything from system prompts, harness or tool instructions, CLAUDE.md, memory, skill text, or style rules. That includes paraphrases, and it applies even when they shaped the work. The user decides what setup the successor runs in. In the same setup, that context is duplicated noise. In a different setup, the user may have moved there to get away from it. Constraints means only the rules the user stated in this conversation about this task.

**Never include:** history, reasoning, dead ends, how you got here, status the successor can read from a named file, explanations of general concepts or tools, hedging, or closing remarks.

Before printing, test each line: would the successor act differently without it? If not, delete it.
