#!/usr/bin/env node
import path from 'node:path';
import {
  parseArgs, positionalRoot, asOf, finding, envelope, gate, emit, exists, fail,
  parseBacklog, fileRevisions, gitToplevel, rel, isoDate, parsePositiveInt,
} from './lib.mjs';

const HELP = `backlog-history.mjs — what happened to every work item, from git history.

Usage:
  node backlog-history.mjs [root] [--backlog <file>] [--json]
                           [--as-of YYYY-MM-DD] [--min-severity <level>]
                           [--max-revisions <n>]

Arguments:
  root                    repository root (default: ".")

Options:
  --backlog <file>        backlog markdown file
                          (default: <root>/.kb-gardener/backlog.md)
  --json                  emit the envelope as JSON instead of text
  --as-of YYYY-MM-DD      date the run is reckoned against (default: today).
                          Revisions committed after it are not read.
  --min-severity <level>  gate for the exit code: critical|high|medium|low|info
                          (default: low)
  --max-revisions <n>     stop after n revisions (default: 500), reporting that
                          it truncated rather than sampling silently
  --help

Why this exists:
  The backlog deletes completed items outright and keeps no "done" section, so
  within a session nothing remembers what was already fixed. That trade keeps the
  file small and it is the right one -- but the record was never actually lost,
  only unread: the file is git-tracked, and item identity ([type] + target) is
  stable. Replaying its revisions recovers every item's lifetime.

  The one output nothing else can produce is a RESURRECTION: an item that was
  removed from "## open" -- which the format documents as meaning done -- and
  whose identical key later came back. That is a fix that passed its done
  criteria and did not hold, and today it is indistinguishable from a new
  finding.

Ages are in revisions of the backlog file, never days. Days would make every
answer depend on how often someone happened to commit.

Honesty rule:
  Below the minimum sample this prints observed counts and NO rate of any kind --
  no hazard, no survival curve, no median time to close, no confidence interval.
  A rate computed from three revisions is decoration that reads as authority.
  See references/contract.md §6.
`;

const MIN_DEATHS = 5;
const MIN_LINEAGES = 10;
const AGE_BUCKETS = [[0, 1], [1, 2], [2, 4], [4, 8], [8, 16], [16, Infinity]];

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help')) { console.log(HELP); process.exit(0); }

const args = parseArgs(argv, {
  flags: ['json', 'help'],
  options: ['backlog', 'as-of', 'min-severity', 'max-revisions'],
});
if (args._.length > 1) fail(`unexpected extra argument: ${args._[1]}`);

const root = positionalRoot(args);
const { date, endMs } = asOf(args);
const minSeverity = args['min-severity'] ?? 'low';
const maxRevisions = args['max-revisions'] ? parsePositiveInt(args['max-revisions'], '--max-revisions') : 500;

const backlogPath = args.backlog
  ? path.resolve(args.backlog)
  : path.join(root, '.kb-gardener', 'backlog.md');
if (!exists(backlogPath)) {
  console.log(`no backlog at ${backlogPath} — nothing to replay`);
  process.exit(0);
}
const dir = path.dirname(backlogPath);
const base = path.basename(dir) === '.kb-gardener' ? path.dirname(dir) : dir;

const repo = gitToplevel(base);
const history = repo
  ? fileRevisions(repo, rel(repo, backlogPath), { max: maxRevisions, until: endMs })
  : { revisions: [], available: false, truncated: false, skipped_after_as_of: 0 };

const snapshots = history.revisions.map((rev) => {
  const parsed = parseBacklog(rev.text, base);
  const state = new Map();
  for (const [key, item] of parsed.open) state.set(key, { ...item, section: 'open' });
  for (const [key, item] of parsed.wont) state.set(key, { ...item, section: 'wont' });
  return { sha: rev.sha, ts: rev.ts, state };
});

/**
 * A commit that replaced the backlog rather than edited it.
 *
 * Attributing a wholesale regeneration item-by-item would read as fifty fixes landing at
 * once, which is exactly the misreading that makes a rewrite look like productivity. The
 * interval is recorded and then excluded from every count, in both numerator and denominator.
 */
const isDiscontinuity = (prev, next) => {
  if (prev.size === 0) return false;
  const died = [...prev.keys()].filter((k) => !next.has(k)).length;
  const born = [...next.keys()].filter((k) => !prev.has(k)).length;
  return died >= Math.max(5, 0.8 * prev.size) && born >= 0.5 * died;
};

const words = (s) => new Set(String(s ?? '').toLowerCase().split(/\W+/).filter(Boolean));
const jaccard = (a, b) => {
  const A = words(a);
  const B = words(b);
  if (!A.size && !B.size) return 1;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / (A.size + B.size - hit);
};

/**
 * Pair up items that were retyped rather than replaced.
 *
 * `backlog-merge.mjs --migrate-types` rewrites the type half of identity for many items in
 * one commit. Read naively that is mass death plus mass birth, and it would poison every
 * count here. Matching is strict 1:1 per target: an ambiguous target is left alone, which
 * also means the duplicate-collapse case (two dead, one born) correctly falls through to a
 * real death and a real birth.
 *
 * Failure mode, stated because it is real: if in one commit a genuinely fixed item on a path
 * disappears and a genuinely new item of a different type on that same path is added with a
 * similar description, the two are welded into one lineage. One death and one birth are lost
 * and that lineage's age is overstated. The 0.6 description-overlap floor is the only thing
 * standing in the way, and it is a heuristic, not a guarantee.
 */
const matchRetypes = (prev, next, deadKeys, bornKeys) => {
  const byTarget = new Map();
  const push = (t, side, key) => {
    if (!byTarget.has(t)) byTarget.set(t, { dead: [], born: [] });
    byTarget.get(t)[side].push(key);
  };
  for (const k of deadKeys) push(prev.get(k).normalized.toLowerCase(), 'dead', k);
  for (const k of bornKeys) push(next.get(k).normalized.toLowerCase(), 'born', k);

  const pairs = [];
  for (const group of byTarget.values()) {
    if (group.dead.length !== 1 || group.born.length !== 1) continue;
    const a = prev.get(group.dead[0]);
    const b = next.get(group.born[0]);
    if (a.type === b.type) continue;
    if (a.section !== b.section) continue;
    if (a.description !== b.description && jaccard(a.description, b.description) < 0.6) continue;
    pairs.push([group.dead[0], group.born[0]]);
  }
  return pairs;
};

// --- replay ---------------------------------------------------------------

let nextId = 0;
const lineages = new Map(); // key -> lineage (current key; retypes move the entry)
const all = [];
const discontinuities = [];
const retypeEvents = [];

const newLineage = (key, item, revIndex) => {
  const lineage = {
    id: nextId++,
    key,
    type: item.type,
    target: item.normalized,
    born_revision: revIndex,
    section: item.section,
    open_age: 0,
    deaths: [],
    resurrections: 0,
    revivals: 0,
    retypes: 0,
    alive: true,
    ages_at_death: [],
  };
  lineages.set(key, lineage);
  all.push(lineage);
  return lineage;
};

for (let i = 0; i < snapshots.length; i++) {
  const next = snapshots[i].state;
  const prev = i === 0 ? new Map() : snapshots[i - 1].state;

  if (i === 0) {
    for (const [key, item] of next) newLineage(key, item, 0);
    continue;
  }

  const deadKeys = [...prev.keys()].filter((k) => !next.has(k));
  const bornKeys = [...next.keys()].filter((k) => !prev.has(k));

  // Retypes are resolved BEFORE the rewrite test, not after. A `--migrate-types` pass rewrites
  // the type half of identity for every item at once, so on the raw key sets it is
  // indistinguishable from replacing the file -- 8 keys gone, 8 keys new. Testing for a
  // rewrite first classified the one commit this guard exists to explain as the thing it
  // exists to exclude. The rewrite test therefore runs on what is left once retyped pairs
  // have been matched off.
  const retyped = matchRetypes(prev, next, deadKeys, bornKeys);
  const retypedDead = new Set(retyped.map(([d]) => d));
  const retypedBorn = new Set(retyped.map(([, b]) => b));
  const residualPrev = new Map([...prev].filter(([k]) => !retypedDead.has(k)));
  const residualNext = new Map([...next].filter(([k]) => !retypedBorn.has(k)));

  if (isDiscontinuity(residualPrev, residualNext)) {
    discontinuities.push({
      revision: i + 1, sha: snapshots[i].sha, date: isoDate(snapshots[i].ts),
      prev_items: prev.size, next_items: next.size,
    });
    // Carry lineages across by target alone; the interval is attributed to nobody.
    const byTarget = new Map();
    for (const [key, l] of lineages) byTarget.set(`${l.target.toLowerCase()}`, { key, l });
    const carriedLineages = new Set();
    lineages.clear();
    for (const [key, item] of next) {
      const carried = byTarget.get(item.normalized.toLowerCase());
      if (carried) {
        carried.l.key = key;
        carried.l.type = item.type;
        carried.l.section = item.section;
        lineages.set(key, carried.l);
        carriedLineages.add(carried.l);
      } else newLineage(key, item, i);
    }
    // An item the rewrite did not carry over is gone, but its disappearance is not a death:
    // nobody judged it. Leaving it flagged alive would count it as open forever, which is the
    // same lie in the other direction.
    for (const { l } of byTarget.values()) {
      if (carriedLineages.has(l)) continue;
      l.alive = false;
      l.dropped_in_rewrite = i + 1;
    }
    continue;
  }

  for (const [deadKey, bornKey] of retyped) {
    const lineage = lineages.get(deadKey);
    if (!lineage) continue;
    lineages.delete(deadKey);
    lineage.key = bornKey;
    lineage.type = next.get(bornKey).type;
    lineage.retypes++;
    lineages.set(bornKey, lineage);
    retypeEvents.push({
      revision: i + 1,
      target: next.get(bornKey).normalized,
      from: prev.get(deadKey).type,
      to: next.get(bornKey).type,
    });
  }

  // Deaths and section moves.
  for (const key of deadKeys) {
    if (retypedDead.has(key)) continue;
    const lineage = lineages.get(key);
    if (!lineage) continue;
    const wasOpen = prev.get(key).section === 'open';
    if (wasOpen) {
      lineage.deaths.push({ revision: i + 1, cause: 'fixed' });
      lineage.ages_at_death.push({ age: lineage.open_age, cause: 'fixed' });
    } else {
      lineage.deaths.push({ revision: i + 1, cause: 'purged' });
    }
    lineage.alive = false;
    lineages.delete(key);
  }

  for (const [key, item] of next) {
    const before = prev.get(key);
    if (before && retypedBorn.has(key)) continue;

    if (!before) {
      if (retypedBorn.has(key)) continue;
      // A key returning after a `fixed` death is the finding this tool exists for. A key
      // returning from "won't do" is a reversed decision, which is a different event and
      // must not be counted here -- nothing was ever fixed.
      const dead = all.find((l) => l.key === key && !l.alive
        && l.deaths.some((d) => d.cause === 'fixed'));
      if (dead) {
        dead.alive = true;
        dead.resurrections++;
        dead.section = item.section;
        dead.open_age = 0;
        lineages.set(key, dead);
      } else {
        newLineage(key, item, i);
      }
      continue;
    }

    const lineage = lineages.get(key);
    if (!lineage) continue;
    if (before.section === 'open' && item.section === 'wont') {
      lineage.deaths.push({ revision: i + 1, cause: 'retired' });
      lineage.ages_at_death.push({ age: lineage.open_age, cause: 'retired' });
      lineage.section = 'wont';
    } else if (before.section === 'wont' && item.section === 'open') {
      lineage.revivals++;
      lineage.section = 'open';
      lineage.open_age = 0;
    } else if (item.section === 'open') {
      lineage.open_age++;
    }
  }
}

// --- hazard ---------------------------------------------------------------

const deaths = all.flatMap((l) => l.ages_at_death);
const buckets = AGE_BUCKETS.map(([lo, hi]) => {
  const label = hi === Infinity ? `[${lo},∞)` : `[${lo},${hi})`;
  const inBucket = (a) => a >= lo && a < hi;
  return {
    age_revisions: label,
    at_risk: all.filter((l) => {
      const maxAge = Math.max(l.open_age, ...l.ages_at_death.map((d) => d.age), 0);
      return maxAge >= lo;
    }).length,
    fixed: deaths.filter((d) => d.cause === 'fixed' && inBucket(d.age)).length,
    retired: deaths.filter((d) => d.cause === 'retired' && inBucket(d.age)).length,
    censored: all.filter((l) => l.alive && l.section === 'open' && inBucket(l.open_age)).length,
  };
});

const computable = deaths.length >= MIN_DEATHS && all.length >= MIN_LINEAGES;
const hazard = {
  computable,
  thresholds: { min_deaths: MIN_DEATHS, min_lineages: MIN_LINEAGES },
  observed: { deaths: deaths.length, lineages: all.length, revisions: snapshots.length },
  buckets,
};
if (!computable) {
  hazard.reason = `fewer than ${MIN_DEATHS} deaths or fewer than ${MIN_LINEAGES} lineages observed`;
}

const resurrected = all.filter((l) => l.resurrections > 0);
const findings = resurrected.map((l) => finding({
  path: l.target,
  severity: 'medium',
  category: 'temporal',
  rule: 'resurrected-item',
  message: `work item was closed and later re-opened ${l.resurrections} time(s)`,
  details: {
    type: l.type,
    resurrections: l.resurrections,
    deaths: l.deaths.map((d) => `r${d.revision}:${d.cause}`),
  },
}));

const env = {
  ...envelope({
    tool: 'backlog-history',
    root: base,
    asOf: date,
    findings,
    summary: {
      backlog_revisions: snapshots.length,
      lineages_total: all.length,
      open_now: all.filter((l) => l.alive && l.section === 'open').length,
      deaths_fixed: deaths.filter((d) => d.cause === 'fixed').length,
      deaths_retired: deaths.filter((d) => d.cause === 'retired').length,
      resurrections: resurrected.reduce((n, l) => n + l.resurrections, 0),
      revivals: all.reduce((n, l) => n + l.revivals, 0),
      discontinuities: discontinuities.length,
      retypes: retypeEvents.length,
      revisions_truncated: Boolean(history.truncated),
      git_history: Boolean(history.available),
    },
  }),
  backlog: rel(base, backlogPath),
  revisions: snapshots.map((s, i) => ({
    revision: i + 1, sha: s.sha, date: isoDate(s.ts), items: s.state.size,
  })),
  lifetimes: all.map((l) => ({
    type: l.type,
    target: l.target,
    born_revision: l.born_revision + 1,
    state: l.alive ? l.section : 'dead',
    open_age_revisions: l.open_age,
    deaths: l.deaths,
    resurrections: l.resurrections,
    revivals: l.revivals,
    retypes: l.retypes,
  })),
  discontinuities,
  retype_events: retypeEvents,
  hazard,
};
if (!history.available) env.notes = ['backlog file has no readable git history — nothing to replay'];
if (history.skipped_after_as_of) {
  env.notes = [...(env.notes ?? []),
    `${history.skipped_after_as_of} revision(s) committed after --as-of were not read`];
}

if (!emit(env, { json: args.json })) process.exit(gate(findings, minSeverity));

const s = env.summary;
process.stdout.write(`${env.backlog}: ${s.backlog_revisions} revision(s), ${s.lineages_total} item lifetime(s)\n`);
if (!history.available) {
  process.stdout.write('no readable git history for this file — nothing to replay\n');
  process.exit(gate(findings, minSeverity));
}
process.stdout.write(
  `open now ${s.open_now} · fixed ${s.deaths_fixed} · retired ${s.deaths_retired}`
  + ` · resurrected ${s.resurrections} · revived ${s.revivals}\n`,
);
if (s.discontinuities) {
  process.stdout.write(`${s.discontinuities} wholesale rewrite(s), excluded from the counts above\n`);
}
if (s.retypes) process.stdout.write(`${s.retypes} retype(s) carried forward as the same item\n`);

if (resurrected.length) {
  process.stdout.write('\nRESURRECTED — closed, then detected again:\n');
  for (const l of resurrected) {
    process.stdout.write(`  [${l.type}] ${l.target} ×${l.resurrections}\n`);
  }
}

process.stdout.write('\ndeletion by age (revisions of this file):\n');
process.stdout.write('  age        at_risk  fixed  retired  censored\n');
for (const b of buckets) {
  process.stdout.write(
    `  ${b.age_revisions.padEnd(9)}  ${String(b.at_risk).padStart(7)}  ${String(b.fixed).padStart(5)}`
    + `  ${String(b.retired).padStart(7)}  ${String(b.censored).padStart(8)}\n`,
  );
}
if (!computable) {
  process.stdout.write(
    `\nINSUFFICIENT DATA — ${deaths.length} death(s), ${all.length} lifetime(s);`
    + ` need ${MIN_DEATHS} and ${MIN_LINEAGES}.\n`
    + 'Counts above are observations. No rate is computed from them, deliberately.\n',
  );
} else {
  process.stdout.write('\nRead the columns, not a ratio: a rate here would hide how few items it rests on.\n');
}
process.exit(gate(findings, minSeverity));
