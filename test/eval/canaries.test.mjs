import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanarySet,
  buildReviewerPrompt,
  buildSummaryOnlyPrompt,
  auditPromptForLeaks,
  expectedCanariesForCase,
  forbiddenCanariesForCase,
} from '../../src/eval/canaries.mjs';

// ─── Constants ───────────────────────────────────────────────────────

const ALL_CASE_IDS = [
  'user-assistant-canary',
  'tool-result-canary',
  'rollback-canary',
  'compaction-canary',
  'current-boundary-spawn-canary',
  'negative-fresh-thread',
  'negative-summary-only',
  'negative-fork-turns-none',
];

// ─── createCanarySet ─────────────────────────────────────────────────

describe('createCanarySet', () => {
  it('yields all eight canary values for seed "seed-a"', () => {
    const cs = createCanarySet('seed-a');

    assert.strictEqual(cs.user, 'CTREE-USER-seed-a');
    assert.strictEqual(cs.decision, 'CTREE-DECISION-seed-a');
    assert.strictEqual(cs.tool, 'CTREE-TOOL-seed-a');
    assert.strictEqual(cs.preCompact, 'CTREE-PRECOMPACT-seed-a');
    assert.strictEqual(cs.compactSummary, 'CTREE-COMPACT-SUMMARY-seed-a');
    assert.strictEqual(cs.postCompact, 'CTREE-POSTCOMPACT-seed-a');
    assert.strictEqual(cs.survive, 'CTREE-SURVIVE-seed-a');
    assert.strictEqual(cs.rollback, 'CTREE-ROLLBACK-seed-a');
  });

  it('normalizes seed by replacing non-alphanumeric chars with dashes', () => {
    const cs = createCanarySet('hello world!@#');

    assert.strictEqual(cs.user, 'CTREE-USER-hello-world---');
  });

  it('handles integer seed via String() coercion', () => {
    const cs = createCanarySet(42);

    assert.strictEqual(cs.user, 'CTREE-USER-42');
  });

  it('preserves underscores and hyphens in seed', () => {
    const cs = createCanarySet('my_seed-v2');

    assert.strictEqual(cs.user, 'CTREE-USER-my_seed-v2');
  });

  it('produces different values for different seeds', () => {
    const a = createCanarySet('alpha');
    const b = createCanarySet('beta');

    assert.notStrictEqual(a.user, b.user);
    assert.notStrictEqual(a.decision, b.decision);
  });

  it('is deterministic — same seed yields same canaries', () => {
    const a = createCanarySet('stable');
    const b = createCanarySet('stable');

    assert.strictEqual(a.user, b.user);
    assert.strictEqual(a.rollback, b.rollback);
  });

  it('returns all canary values as an iterable array via Object.values', () => {
    const cs = createCanarySet('x');
    const vals = Object.values(cs);

    assert.strictEqual(vals.length, 8);
    assert.ok(vals.every((v) => typeof v === 'string'));
  });
});

// ─── expectedCanariesForCase ─────────────────────────────────────────

describe('expectedCanariesForCase', () => {
  it('returns user + decision for user-assistant-canary', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('user-assistant-canary', cs);

    assert.deepStrictEqual(expected.sort(), [cs.user, cs.decision].sort());
  });

  it('returns tool for tool-result-canary', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('tool-result-canary', cs);

    assert.deepStrictEqual(expected, [cs.tool]);
  });

  it('returns survive for rollback-canary', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('rollback-canary', cs);

    assert.deepStrictEqual(expected, [cs.survive]);
  });

  it('returns preCompact + compactSummary + postCompact for compaction-canary', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('compaction-canary', cs);

    assert.deepStrictEqual(expected.sort(), [cs.preCompact, cs.compactSummary, cs.postCompact].sort());
  });

  it('returns survive for current-boundary-spawn-canary', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('current-boundary-spawn-canary', cs);

    assert.deepStrictEqual(expected, [cs.survive]);
  });

  it('returns empty array for negative-fresh-thread', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('negative-fresh-thread', cs);

    assert.deepStrictEqual(expected, []);
  });

  it('returns empty array for negative-summary-only', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('negative-summary-only', cs);

    assert.deepStrictEqual(expected, []);
  });

  it('returns empty array for negative-fork-turns-none', () => {
    const cs = createCanarySet('s');
    const expected = expectedCanariesForCase('negative-fork-turns-none', cs);

    assert.deepStrictEqual(expected, []);
  });

  it('throws for unknown caseId', () => {
    const cs = createCanarySet('s');

    assert.throws(
      () => expectedCanariesForCase('nonexistent-case', cs),
      { message: /unsupported caseId/ },
    );
  });
});

// ─── forbiddenCanariesForCase ────────────────────────────────────────

describe('forbiddenCanariesForCase', () => {
  it('returns all non-expected canaries for user-assistant-canary', () => {
    const cs = createCanarySet('s');
    const forbidden = forbiddenCanariesForCase('user-assistant-canary', cs);

    // Should NOT include user or decision
    assert.ok(!forbidden.includes(cs.user));
    assert.ok(!forbidden.includes(cs.decision));
    // Should include all others
    assert.ok(forbidden.includes(cs.tool));
    assert.ok(forbidden.includes(cs.rollback));
    assert.ok(forbidden.includes(cs.preCompact));
    assert.ok(forbidden.includes(cs.compactSummary));
    assert.ok(forbidden.includes(cs.postCompact));
    assert.ok(forbidden.includes(cs.survive));
    assert.strictEqual(forbidden.length, 6);
  });

  it('returns all canaries for negative cases (no expected)', () => {
    const cs = createCanarySet('s');
    const forbidden = forbiddenCanariesForCase('negative-fresh-thread', cs);

    assert.strictEqual(forbidden.length, 8);
    assert.ok(forbidden.includes(cs.user));
    assert.ok(forbidden.includes(cs.rollback));
  });

  it('expected + forbidden = all canaries (no overlap)', () => {
    const cs = createCanarySet('s');

    for (const caseId of ALL_CASE_IDS) {
      const exp = expectedCanariesForCase(caseId, cs);
      const forb = forbiddenCanariesForCase(caseId, cs);
      const all = [...exp, ...forb].sort();

      assert.deepStrictEqual(all, Object.values(cs).sort(),
        `case ${caseId}: expected + forbidden should equal all canaries`);
    }
  });

  it('throws for unknown caseId', () => {
    const cs = createCanarySet('s');

    assert.throws(
      () => forbiddenCanariesForCase('bogus', cs),
      { message: /unsupported caseId/ },
    );
  });
});

// ─── buildReviewerPrompt ─────────────────────────────────────────────

describe('buildReviewerPrompt', () => {
  it('asks the reviewer to return concrete CTREE identifiers instead of yes/no-only semantics', () => {
    const prompt = buildReviewerPrompt('user-assistant-canary');
    assert.ok(prompt.includes('CTREE-'), 'prompt should describe the identifier family to quote');
    assert.ok(/known/i.test(prompt), 'prompt should allow a known/unknown-style structured answer');
    assert.ok(/values/i.test(prompt), 'prompt should ask for concrete discovered values');
  });

  it('contains "unknown" for every valid case', () => {
    for (const caseId of ALL_CASE_IDS) {
      const prompt = buildReviewerPrompt(caseId);
      assert.ok(prompt.includes('unknown'),
        `case ${caseId}: prompt must contain "unknown"`);
    }
  });

  it('contains "do not guess" for every valid case', () => {
    for (const caseId of ALL_CASE_IDS) {
      const prompt = buildReviewerPrompt(caseId);
      assert.ok(prompt.includes('do not guess'),
        `case ${caseId}: prompt must contain "do not guess"`);
    }
  });

  it('does NOT contain expected canary values for any case', () => {
    const cs = createCanarySet('audit-test');

    for (const caseId of ALL_CASE_IDS) {
      const prompt = buildReviewerPrompt(caseId);
      const expected = expectedCanariesForCase(caseId, cs);

      for (const canary of expected) {
        assert.ok(!prompt.includes(canary),
          `case ${caseId}: prompt must NOT contain expected canary "${canary}"`);
      }
    }
  });

  it('does NOT contain concrete CTREE canary values', () => {
    // Safety check: prompts may mention the CTREE-* identifier family, but must not leak actual values.
    for (const caseId of ALL_CASE_IDS) {
      const prompt = buildReviewerPrompt(caseId);
      assert.ok(!prompt.includes('CTREE-USER-'));
      assert.ok(!prompt.includes('CTREE-DECISION-'));
      assert.ok(!prompt.includes('CTREE-TOOL-'));
      assert.ok(!prompt.includes('CTREE-PRECOMPACT-'));
      assert.ok(!prompt.includes('CTREE-COMPACT-SUMMARY-'));
      assert.ok(!prompt.includes('CTREE-POSTCOMPACT-'));
      assert.ok(!prompt.includes('CTREE-SURVIVE-'));
      assert.ok(!prompt.includes('CTREE-ROLLBACK-'));
    }
  });

  it('returns a non-empty string for each valid case', () => {
    for (const caseId of ALL_CASE_IDS) {
      const prompt = buildReviewerPrompt(caseId);
      assert.strictEqual(typeof prompt, 'string');
      assert.ok(prompt.length > 0, `case ${caseId}: prompt must not be empty`);
    }
  });

  it('each caseId produces a different prompt', () => {
    const prompts = new Set(ALL_CASE_IDS.map(id => buildReviewerPrompt(id)));
    assert.strictEqual(prompts.size, ALL_CASE_IDS.length,
      'each caseId must produce a unique prompt');
  });

  it('throws for unknown caseId', () => {
    assert.throws(
      () => buildReviewerPrompt('invalid-case-id'),
      { message: /unsupported caseId/ },
    );
  });
});

// ─── buildSummaryOnlyPrompt ──────────────────────────────────────────

describe('buildSummaryOnlyPrompt', () => {
  const cleanSummary = 'The agent performed a search and returned results.';

  it('returns a string prompt for a clean summary', () => {
    const result = buildSummaryOnlyPrompt('compaction-canary', cleanSummary);
    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('throws "prompt leak detected" when summary contains a canary value', () => {
    assert.throws(
      () => buildSummaryOnlyPrompt('compaction-canary', 'Found CTREE-USER-x in the output'),
      { message: /prompt leak detected/ },
    );
  });

  it('throws "prompt leak detected" when summary contains CTREE-DECISION', () => {
    assert.throws(
      () => buildSummaryOnlyPrompt('tool-result-canary', 'Context: CTREE-DECISION-abc was injected'),
      { message: /prompt leak detected/ },
    );
  });

  it('throws "prompt leak detected" when summary contains CTREE-TOOL', () => {
    assert.throws(
      () => buildSummaryOnlyPrompt('rollback-canary', 'The tool result CTREE-TOOL-x is missing'),
      { message: /prompt leak detected/ },
    );
  });

  it('throws for unknown caseId', () => {
    assert.throws(
      () => buildSummaryOnlyPrompt('made-up-case', cleanSummary),
      { message: /unsupported caseId/ },
    );
  });

  it('accepts summary without any CTREE- prefix', () => {
    const result = buildSummaryOnlyPrompt('negative-summary-only', 'Just a normal summary.');
    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('summary-only prompt is not treated as a success path', () => {
    const result = buildSummaryOnlyPrompt('negative-summary-only', 'Clean summary.');
    // The prompt should acknowledge that summary-only is a negative control
    assert.ok(result.includes('summary') || result.includes('negative'),
      'summary-only prompt should reference its negative-control nature');
  });
});

// ─── auditPromptForLeaks ─────────────────────────────────────────────

describe('auditPromptForLeaks', () => {
  const cs = createCanarySet('leak-test');

  it('detects a single leaked canary', () => {
    const { leaked, leaks } = auditPromptForLeaks(`Found ${cs.user} in context`, cs);

    assert.strictEqual(leaked, true);
    assert.deepStrictEqual(leaks, [cs.user]);
  });

  it('detects multiple leaked canaries', () => {
    const { leaked, leaks } = auditPromptForLeaks(
      `Values: ${cs.user} and ${cs.tool}`,
      cs,
    );

    assert.strictEqual(leaked, true);
    assert.strictEqual(leaks.length, 2);
    assert.ok(leaks.includes(cs.user));
    assert.ok(leaks.includes(cs.tool));
  });

  it('returns leaked: false for clean prompt', () => {
    const { leaked, leaks } = auditPromptForLeaks(
      'This is a clean prompt with no canary values.',
      cs,
    );

    assert.strictEqual(leaked, false);
    assert.deepStrictEqual(leaks, []);
  });

  it('detects canaries even when embedded in longer text', () => {
    const prompt = `The system should check for ${cs.rollback} in the output before finalizing.`;
    const { leaked, leaks } = auditPromptForLeaks(prompt, cs);

    assert.strictEqual(leaked, true);
    assert.deepStrictEqual(leaks, [cs.rollback]);
  });

  it('is case sensitive — only exact matches count', () => {
    const { leaked, leaks } = auditPromptForLeaks(
      'found ctree-user-x-lowercase in text',
      cs,
    );

    assert.strictEqual(leaked, false);
    assert.deepStrictEqual(leaks, []);
  });

  it('returns empty leaks for empty prompt', () => {
    const { leaked, leaks } = auditPromptForLeaks('', cs);

    assert.strictEqual(leaked, false);
    assert.deepStrictEqual(leaks, []);
  });

  it('does not produce duplicates for repeated canary', () => {
    const { leaked, leaks } = auditPromptForLeaks(
      `${cs.tool} ${cs.tool} ${cs.tool}`,
      cs,
    );

    assert.strictEqual(leaked, true);
    assert.strictEqual(leaks.length, 1);
    assert.deepStrictEqual(leaks, [cs.tool]);
  });

  it('reviewer prompts are leak-free for all cases', () => {
    const auditCs = createCanarySet('final-check');

    for (const caseId of ALL_CASE_IDS) {
      const prompt = buildReviewerPrompt(caseId);
      const { leaked } = auditPromptForLeaks(prompt, auditCs);

      assert.strictEqual(leaked, false,
        `case ${caseId}: reviewer prompt must be leak-free`);
    }
  });
});
