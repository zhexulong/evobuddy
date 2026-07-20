import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('material-selection-report contract', () => {
  it('documents candidate accounting and non-consumption-proof boundary', () => {
    const text = readFileSync('docs/contracts/material-selection-report-contract.md', 'utf8');
    for (const token of [
      'material-selection-report.json',
      'candidates',
      'lifecycleStatus',
      'selected',
      'placement',
      'rank',
      'rankGroup',
      'rejectedReason',
      'finalM0Refs',
      'finalM1Refs',
      'searchableRefs',
      'sourceOnlyRefs',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /not.*consumption proof|not.*visibility proof/is);
    assert.match(text, /finalM0Refs.*finalM1Refs.*align.*MemberTaskRun\.materials\.items|MemberTaskRun\.materials\.items.*align.*finalM0Refs.*finalM1Refs/is);
    assert.match(text, /searchableRefs.*sourceOnlyRefs.*must not.*model-visible|must not.*promote.*searchable.*source-only/is);
  });

  it('documents V2 baseline/invocation placements and legacy alias policy', () => {
    const text = readFileSync('docs/contracts/material-selection-report-contract.md', 'utf8');
    for (const token of [
      'material-selection-report-v2',
      'baselineRefs',
      'invocationRequestedRefs',
      'placement: "baseline"',
      'placement: "invocation-requested"',
      'compatibility',
      'legacyActivationDeltaRefs',
      'deprecated aliases for one migration version',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /finalM0Refs.*finalM1Refs.*compatibility aliases|compatibility aliases.*finalM0Refs.*finalM1Refs/is);
    assert.match(text, /legacy m1.*not automatically.*invocationRequestedRefs|invocationRequestedRefs.*not.*legacy m1/is);
    assert.match(text, /parent\/wrapper-supplied provenance|parent-supplied provenance|wrapper-supplied provenance/is);
  });
});
