#!/usr/bin/env node
import { parseArgs, fail, emit, readText, isMain, parseProject } from './lib.mjs';
import { parsePlan, derive } from './cards.mjs';

export function counts({ derived, plan, facts, project }) {
  const cards = new Map(plan.milestones.flatMap((m) => m.cards).map((c) => [c.id, c]));
  const readyBy = (mode) => derived.ready.filter((id) => cards.get(id).mode === mode).length;
  const max = Number(project?.thresholds?.max_in_flight ?? 2);
  const blockers = [];
  if (facts) {
    for (const d of facts.duplicateClaims ?? []) blockers.push(`duplicate claim: issue #${d.issue} has PRs ${d.prs.map((n) => '#' + n).join(', ')}`);
    for (const s of facts.staleLabels ?? []) blockers.push(`stale label: #${s.number} carries ${s.label}, no PR, last update ${s.updatedAt}`);
    for (const e of facts.errors ?? []) blockers.push(`sync error: ${e}`);
    const threeDays = 3 * 86400000;
    for (const r of facts.readyNoPr ?? []) if (Date.now() - new Date(r.updatedAt) > threeDays) blockers.push(`label without worker: #${r.number} ready since ${r.updatedAt}`);
  }
  return {
    awaiting_gate: derived.awaitingGate.length,
    in_flight: derived.inFlight.length,
    ready_dispatch: readyBy('DISPATCH'), ready_decide: readyBy('DECIDE'), ready_qa: readyBy('QA'), ready_do: readyBy('DO'),
    max_in_flight: max, dispatch_gap: Math.max(0, max - derived.inFlight.length), blockers,
  };
}

const HELP = `counts.mjs — constraint counts for the routing ladder.
Usage: node counts.mjs <plan.md> --project <project.md> [--facts <facts.json>] [--json]
`;
if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'], options: ['project', 'facts'] });
  if (args.help || !args._[0] || !args.project) { process.stdout.write(HELP); process.exit(args._[0] ? 0 : 1); }
  const planText = readText(args._[0]); if (planText === null) fail(`cannot read ${args._[0]}`, 1);
  const plan = parsePlan(planText); if (plan.problems.length) fail(`plan invalid:\n${plan.problems.join('\n')}`, 2);
  const project = parseProject(readText(args.project) ?? '');
  const facts = args.facts ? JSON.parse(readText(args.facts) ?? 'null') : null;
  emit(counts({ derived: derive(plan), plan, facts, project }), { json: true });
}
