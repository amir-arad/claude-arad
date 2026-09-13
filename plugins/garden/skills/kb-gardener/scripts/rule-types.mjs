/**
 * The one place a detector's rule becomes (or fails to become) a backlog work-item type.
 *
 * Every rule any script in this folder emits MUST appear in exactly one of the three
 * tables below. A rule in none of them is a bug: `classify()` returns kind "unclassified",
 * `backlog-merge.mjs` drops the finding instead of writing an item, and `lib.mjs` warns on
 * stderr the first time such a rule is emitted.
 *
 * The reason for the hard drop: the six types in `references/work-item-types.md` are the only
 * ones with done criteria, and Part B verifies a fix by looking its type up there. An item
 * typed with a bare rule name looks valid, parses fine, and can never be verified — the fix
 * either passes vacuously or fails for the wrong reason. Fabricating a type is worse than
 * losing the finding, which the summary reports either way.
 */

/** Rule -> one of the six types in references/work-item-types.md. */
export const RULE_TO_TYPE = new Map(Object.entries({
  // A reference in a doc that does not resolve. The target is the doc holding the reference.
  'dead-link': 'broken-reference',
  'dead-anchor': 'broken-reference',
  'dead-citation': 'broken-reference',
  'missing-reference': 'broken-reference',
  // A reference that does not resolve, with git history naming where the file went. The fix
  // is to repoint it, which is what broken-reference's done criteria check -- not a content
  // correction, which is what stale-doc's check.
  'renamed-reference': 'broken-reference',

  // The doc is wrong about something checkable, or nobody has looked at it inside its SLA.
  // work-item-types.md prefers the evidence claims below over the calendar claims when both
  // fire on one doc; that reconciliation happens in Part A prose, not here.
  'stale-doc': 'stale-doc',
  'review-overdue': 'stale-doc',
  'code-churn': 'stale-doc',
  'version-mismatch': 'stale-doc',

  'duplicate-title': 'duplication',
  'unreachable-doc': 'indexing-discoverability',

  // Legacy aliases. No script here emits these; they are kept so a caller piping findings
  // from an older sibling tool is mapped rather than dropped.
  'broken-anchor': 'broken-reference',
  'missing-target': 'broken-reference',
  'drifted-doc': 'stale-doc',
  'doc-drift': 'stale-doc',
  'stale-version': 'stale-doc',
  'stale-symbol': 'stale-doc',
  unreachable: 'indexing-discoverability',
  orphan: 'indexing-discoverability',
  'orphan-doc': 'indexing-discoverability',
  unsignposted: 'indexing-discoverability',
  'uncited-directory': 'source-discoverability',
  'uncited-source': 'source-discoverability',
  'duplicate-content': 'duplication',
  'near-duplicate': 'duplication',
  'duplicate-doc': 'duplication',
  'oversized-doc': 're-balancing',
  'split-candidate': 're-balancing',
  'merge-candidate': 're-balancing',
  'mixed-topics': 're-balancing',
}));

/**
 * Rules that are deliberately not work items, with the reason printed in the summary.
 * These are reported, never silently dropped, and never counted toward the backlog.
 */
export const DISCARDED_RULES = new Map(Object.entries({
  unowned: 'ownership frontmatter — fires on every doc of a personal KB (work-item-types.md)',
  'alias-owner': 'ownership frontmatter — fires on every doc of a personal KB (work-item-types.md)',
  'ownership-gap': 'ownership frontmatter — the taxonomy name for the same concept',
  'missing-updated': 'freshness frontmatter the KB does not use — universal, so no information',
  'future-updated': 'frontmatter metadata defect, not a claim about the content',
  'future-date': 'frontmatter metadata defect, not a claim about the content',
  'untracked-doc': 'repository hygiene, not a KB work item',
  'unreachable-url': 'external URL — explicitly out of scope for broken-reference',
  // setup-check.mjs reports repository scaffolding. Real, and none of it is a KB defect.
  'missing-readme': 'repository scaffolding, not a KB work item',
  'thin-readme': 'repository scaffolding, not a KB work item',
  'missing-license': 'repository scaffolding, not a KB work item',
  'missing-tests': 'repository scaffolding, not a KB work item',
  'missing-ci-config': 'repository scaffolding, not a KB work item',
  'missing-linter-config': 'repository scaffolding, not a KB work item',
  'missing-lockfile': 'repository scaffolding, not a KB work item',
  'missing-task-runner': 'repository scaffolding, not a KB work item',
  'missing-contributing': 'repository scaffolding, not a KB work item',
  'missing-editorconfig': 'repository scaffolding, not a KB work item',
  'missing-compose-file': 'repository scaffolding, not a KB work item',
  'missing-env-template': 'repository scaffolding, not a KB work item',
  'env-not-ignored': 'repository scaffolding, not a KB work item',
  // review mode reports on the backlog itself. These are real defects and a human should act
  // on them, but an item about a work item is not a KB work item -- and writing one would put
  // a suppression on a suppression, which is the loop this whole taxonomy exists to avoid.
  'stranded-suppression': 'durable-state defect, reported by review; not a KB work item',
  'unreasoned-suppression': 'durable-state defect, reported by review; not a KB work item',
  'resurrected-item': 'durable-state defect, reported by review; not a KB work item',
}));

/**
 * Real signals that no type's done criteria fit. They are surfaced to Part A as advisory
 * counts rather than written as items, because deciding what they mean takes cross-doc
 * judgment — exactly the hand-raised path `duplication` and `re-balancing` already describe.
 */
export const ADVISORY_RULES = new Map(Object.entries({
  'thin-doc': 'a merge candidate only in context — re-balancing needs the sibling docs weighed',
  'duplicate-anchor': 'ambiguous anchor within one doc; no type verifies a heading rename',
  'ambiguous-reference': 'prose shorthand matching several real files; a clarity call, not a defect',
  'missing-section': 'a doc-shape convention, not a defect any of the six types can verify',
}));

/** Every rule this repo classifies. Used by lib.mjs to warn on a rule nothing accounts for. */
export const KNOWN_RULES = new Set([
  ...RULE_TO_TYPE.keys(), ...DISCARDED_RULES.keys(), ...ADVISORY_RULES.keys(),
]);

/**
 * @returns {{kind: 'mapped', type: string}
 *          | {kind: 'discarded'|'advisory', reason: string}
 *          | {kind: 'unclassified'}}
 */
export function classify(rule) {
  const type = RULE_TO_TYPE.get(rule);
  if (type) return { kind: 'mapped', type };
  const discarded = DISCARDED_RULES.get(rule);
  if (discarded) return { kind: 'discarded', reason: discarded };
  const advisory = ADVISORY_RULES.get(rule);
  if (advisory) return { kind: 'advisory', reason: advisory };
  return { kind: 'unclassified' };
}
