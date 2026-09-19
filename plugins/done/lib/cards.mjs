#!/usr/bin/env node
import { parseArgs, fail, emit, readText, readVersion, isMain } from './lib.mjs';

export const CARD_ID = /^[A-Za-z]+\d+\.\d+$/;
export const MILESTONE_HEAD = /^## ([A-Za-z]+\d+) — (.+)$/;
export const MODES = ['DECIDE', 'DISPATCH', 'REVIEW', 'QA', 'DO'];
const STATUS_RE = /^(open|filed #(\d+)|dispatched #(\d+)|pr #(\d+)|ruled (\d{4}-\d{2}-\d{2})|done (\d{4}-\d{2}-\d{2}))$/;
const HEADER = ['Card', 'Action', 'Mode', 'Owner', 'Blocked on', 'Status'];

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
}

export function parsePlan(text) {
  const out = { version: readVersion(text), milestones: [], cut: [], problems: [] };
  const lines = text.split(/\r?\n/);
  let ms = null;
  let inCut = false;
  let headerSeen = false;
  const ids = new Map();
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const n = i + 1;
    if (line.startsWith('## Cut list')) { inCut = true; ms = null; return; }
    const mh = MILESTONE_HEAD.exec(line);
    if (mh) { ms = { id: mh[1], title: mh[2], exit: '', cards: [] }; out.milestones.push(ms); inCut = false; headerSeen = false; return; }
    if (inCut) { if (line.startsWith('- ')) out.cut.push(line.slice(2)); return; }
    if (!ms) return;
    if (line.startsWith('Exit:')) { ms.exit = line.slice(5).trim(); return; }
    if (!line.startsWith('|')) return;
    const c = cells(line);
    if (c[0] === 'Card') {
      headerSeen = true;
      if (c.join('|') !== HEADER.join('|')) out.problems.push(`line ${n}: table header must be | ${HEADER.join(' | ')} |`);
      return;
    }
    if (/^-+$/.test(c[0])) return;
    if (!headerSeen) { out.problems.push(`line ${n}: card row before table header`); return; }
    if (c.length !== 6) { out.problems.push(`line ${n}: expected 6 cells, got ${c.length}`); return; }
    const [id, action, modeCell, owner, blocked, status] = c;
    const card = { id, milestone: ms.id, action, mode: null, gate: null, owner: owner || null, blockedOn: [], status: null, line: n };
    if (!CARD_ID.test(id)) out.problems.push(`line ${n}: bad card id "${id}"`);
    if (ids.has(id)) out.problems.push(`line ${n}: duplicate card id ${id}`); else ids.set(id, card);
    const mm = /^([A-Z]+)(?:\s*\(gate:\s*([^)]+)\))?$/.exec(modeCell);
    if (!mm || !MODES.includes(mm[1])) out.problems.push(`line ${n}: ${id} Mode "${modeCell}" not one of ${MODES.join('|')}`);
    else { card.mode = mm[1]; card.gate = mm[2] ? mm[2].trim() : null; }
    if (blocked) {
      for (const part of blocked.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (CARD_ID.test(part)) card.blockedOn.push({ kind: 'card', ref: part });
        else if (part.startsWith('ext:')) card.blockedOn.push({ kind: 'ext', ref: part.slice(4).trim() });
        else if (part.startsWith('owner:')) card.blockedOn.push({ kind: 'owner', ref: part.slice(6).trim() });
        else out.problems.push(`line ${n}: ${id} Blocked on "${part}" must be a card id, ext:<text> or owner:<name>`);
      }
    }
    const sm = STATUS_RE.exec(status);
    if (!sm) out.problems.push(`line ${n}: ${id} Status "${status}" not in open|filed #N|dispatched #N|pr #N|ruled DATE|done DATE`);
    else {
      const kind = sm[1].split(' ')[0];
      card.status = { kind, ref: sm[2] || sm[3] || sm[4] || sm[5] || sm[6] || undefined };
    }
    ms.cards.push(card);
  });
  const all = out.milestones.flatMap((m) => m.cards);
  for (const card of all) for (const b of card.blockedOn) {
    if (b.kind === 'card' && !ids.has(b.ref)) out.problems.push(`line ${card.line}: ${card.id} blocked on unknown card ${b.ref}`);
  }
  return out;
}

export function derive(plan) {
  const cards = plan.milestones.flatMap((m) => m.cards);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const settled = (id) => { const s = byId.get(id)?.status?.kind; return s === 'done' || s === 'ruled'; };
  const res = { ready: [], inFlight: [], awaitingGate: [], blocked: {}, decideOrder: [], done: [] };
  for (const c of cards) {
    const k = c.status?.kind;
    if (k === 'done' || k === 'ruled') { res.done.push(c.id); continue; }
    if (k === 'dispatched' || k === 'pr') res.inFlight.push(c.id);
    if (k === 'pr') res.awaitingGate.push(c.id);
    const open = c.blockedOn.filter((b) => b.kind !== 'card' || !settled(b.ref));
    if (open.length) res.blocked[c.id] = open.map((b) => (b.kind === 'card' ? b.ref : `${b.kind}:${b.ref}`));
    else if (k === 'open') res.ready.push(c.id);
  }
  const dependents = new Map(cards.map((c) => [c.id, 0]));
  const rev = new Map();
  for (const c of cards) for (const b of c.blockedOn) if (b.kind === 'card') (rev.get(b.ref) ?? rev.set(b.ref, []).get(b.ref)).push(c.id);
  const countTransitive = (id, seen = new Set()) => {
    for (const d of rev.get(id) ?? []) if (!seen.has(d)) { seen.add(d); countTransitive(d, seen); }
    return seen.size;
  };
  for (const id of dependents.keys()) dependents.set(id, countTransitive(id));
  const order = new Map(cards.map((c, i) => [c.id, i]));
  res.decideOrder = res.ready
    .filter((id) => byId.get(id).mode === 'DECIDE')
    .sort((a, b) => dependents.get(b) - dependents.get(a) || order.get(a) - order.get(b));
  return res;
}

const HELP = `cards.mjs — parse, validate or derive from a done plan.md

Usage:
  node cards.mjs parse    <plan.md> [--json]
  node cards.mjs validate <plan.md> [--json]     exit 2 and list problems if the grammar is violated
  node cards.mjs derive   <plan.md> [--json]     ready / in-flight / awaiting-gate / blocked / decide order
Exit codes: 0 ok, 1 usage, 2 validation failed.
`;

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { flags: ['json', 'help'] });
  if (args.help || args._.length === 0) { process.stdout.write(HELP); process.exit(0); }
  const [cmd, file] = args._;
  if (!['parse', 'validate', 'derive'].includes(cmd) || !file) fail('usage: cards.mjs <parse|validate|derive> <plan.md>', 1);
  const text = readText(file);
  if (text === null) fail(`cannot read ${file}`, 1);
  const plan = parsePlan(text);
  if (cmd === 'validate' || plan.problems.length) {
    if (plan.problems.length) {
      if (args.json) emit({ ok: false, problems: plan.problems }, args);
      else process.stderr.write(plan.problems.map((p) => `- ${p}`).join('\n') + '\n');
      process.exit(2);
    }
    if (cmd === 'validate') { if (args.json) emit({ ok: true, problems: [] }, args); else process.stdout.write('ok\n'); process.exit(0); }
  }
  const out = cmd === 'derive' ? derive(plan) : plan;
  if (args.json) emit(out, args); else process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
