#!/usr/bin/env node
import { parseArgs, fail, emit, readText, isMain } from './lib.mjs';
import { parsePlan, derive } from './cards.mjs';

export function counts({ derived, plan, facts }) {
  const cards = new Map(plan.milestones.flatMap((m) => m.cards).map((c) => [c.id, c]));
  const readyBy = (mode) => derived.ready.filter((id) => cards.get(id).mode === mode).length;
  const blockers = [];
  if (facts) {
    for (const d of facts.duplicateClaims ?? []) blockers.push(`duplicate claim: issue #${d.issue} has PRs ${d.prs.map((n) => '#' + n).join(', ')}`);
    for (const e of facts.errors ?? []) blockers.push(`sync error: ${e}`);
  }
  return {
    awaiting_gate: derived.awaitingGate.length,
    ready_review: readyBy('REVIEW'), ready_decide: readyBy('DECIDE'), ready_qa: readyBy('QA'), ready_do: readyBy('DO'),
    blockers,
  };
}

const HELP = `counts.mjs — constraint counts for the routing ladder.
Usage: node counts.mjs <plan.md> [--facts <facts.json>] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['facts'] });
  if (args.help || !args._[0]) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  const planText = readText(args._[0]); if (planText === null) fail(`cannot read ${args._[0]}`, 1);
  const plan = parsePlan(planText); if (plan.problems.length) fail(`plan invalid:\n${plan.problems.join('\n')}`, 2);
  const facts = args.facts ? JSON.parse(readText(args.facts) ?? 'null') : null;
  emit(counts({ derived: derive(plan), plan, facts }), { json: true });
}
