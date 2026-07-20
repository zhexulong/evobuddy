import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/evobuddy-release-grade-product-provenance-contract.md', 'utf8');

describe('EvoBuddy release-grade product provenance contract', () => {
  it('separates transcript summaries from proof authority', () => {
    assert.match(text, /Transcript fields can summarize proof/i);
    assert.match(text, /cannot be the proof authority/i);
    assert.match(text, /runtime\/exporter\/digest-bound artifact chain/i);
  });

  it('uses existing parent-call and transcript schemas', () => {
    assert.match(text, /observed-parent-agent-call-transcript/);
    assert.match(text, /evobuddy-natural-buddy-invocation/);
    assert.match(text, /memberName/);
    assert.match(text, /resolvedMemberId/);
    assert.match(text, /Do not introduce a parallel route such as `evobuddy-buddy-call`/);
  });

  it('requires all focused validators and loop combiner', () => {
    for (const name of [
      'validateObservedBuddyCallProvenance',
      'validateRoutingDecisionProvenance',
      'validateEvolutionBuddyProposalProvenance',
      'validateAppliedVersionConsumptionProvenance',
      'validateEvobuddyProductLoopProvenance',
    ]) assert.match(text, new RegExp(name));
  });

  it('requires exporter DB digest parent-call digest transcript digest and applied-version digest closure', () => {
    assert.match(text, /exporter manifest/i);
    assert.match(text, /OpenCode SQLite.*dbDigest|dbDigest.*OpenCode SQLite/i);
    assert.match(text, /parent-call-record digest/i);
    assert.match(text, /transcript digest/i);
    assert.match(text, /transcript.*contains.*parent-call-record|parent-call-record.*contained.*transcript/i);
    assert.match(text, /invocation packet digest/i);
    assert.match(text, /appliedVersionDigest/i);
    assert.match(text, /materializedContextDigest/i);
  });

  it('allows blocked only for missing real runtime exporter artifacts', () => {
    assert.match(text, /blocked/i);
    assert.match(text, /missing real runtime\/exporter\/model artifact/i);
    assert.match(text, /fixture-shaped artifacts.*must fail|must fail.*fixture-shaped artifacts/i);
  });
});
