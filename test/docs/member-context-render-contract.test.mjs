import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('member-context-render contract', () => {
  it('documents baseline/delta/cache reuse without cache overclaim', () => {
    const text = readFileSync('docs/contracts/member-context-render-contract.md', 'utf8');
    for (const token of [
      'member-context-render.json',
      'baselineMaterials',
      'deltaMaterials',
      'baselineDigest',
      'deltaDigest',
      'baselineReuseStatus',
      'provider-cache-hit',
      'deterministic-reuse',
      'previousRenderRef',
      'previousBaselineDigest',
      'baselineReuseEvidenceRefs',
      'm0Refs',
      'materialClassifications',
      'foldReason',
      'knownLosses',
      'selectMemberMemoryForContext',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /provider-cache-hit.*requires.*evidence/is);
    assert.match(text, /deterministic-reuse.*requires.*previous/is);
    assert.match(text, /digest.*must.*include.*contentDigest|contentDigest.*baselineDigest/is);
    assert.match(text, /member-task-run.*baselineDigest.*deltaDigest.*must match|baselineDigest.*deltaDigest.*match.*member-task-run/is);
    assert.match(text, /selectionReportRef.*must match.*member-task-run.*materialSelectionReportRef|member-task-run.*materialSelectionReportRef/is);
    assert.match(text, /materialClassifications.*m0Refs.*active.*profile|m0Refs.*classified.*candidate/is);
    assert.match(text, /foldReason.*promotion|promoted.*foldReason/is);
    assert.match(text, /materialization helper.*authority|selectMemberMemoryForContext\(\).*authority/is);
    assert.match(text, /candidate memory.*searchable.*excluded.*promoted|candidate.*until promoted/is);
  });

  it('documents V2 baseline/invocation names and compatibility-only legacy delta', () => {
    const text = readFileSync('docs/contracts/member-context-render-contract.md', 'utf8');
    for (const token of [
      'member-context-render-v2',
      'expectedBaselineDigest',
      'baselineRefs',
      'invocationRequestedRefs',
      'parentSuppliedTaskContext',
      'invocationContextDigest',
      'compatibility',
      'legacyActivationDeltaRefs',
      'deprecated aliases for one migration version',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /legacy m1Refs.*not automatically.*invocationRequestedRefs|invocationRequestedRefs.*not.*legacy m1Refs/is);
    assert.match(text, /deltaDigest.*compatibility-only|compatibility-only.*deltaDigest/is);
    assert.match(text, /not.*proof.*model-visible|not.*visibility proof/is);
    assert.match(text, /baseline visibility.*baseline install|baseline install.*baseline visibility/is);
  });
});
