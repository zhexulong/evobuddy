import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('member-invocation-packet contract', () => {
  it('documents packet refs, digest authority, and result-return boundaries', () => {
    const text = readFileSync('docs/contracts/member-invocation-packet-contract.md', 'utf8');
    for (const token of [
      'member-invocation-packet.json',
      'memberTaskRequestRef',
      'memberContextRenderRef',
      'materialSelectionReportRef',
      'preparedChildInput',
      'preparedChildInputDigest',
      'm0Refs',
      'm1Refs',
      'targetRefs',
      'expectedResultReturn',
      'writeback',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /packet.*reference.*request.*render.*selection|references.*member-task-request.*member-context-render.*material-selection-report/is);
    assert.match(text, /must not.*duplicate.*authority|not.*duplicate.*request.*render.*selection/is);
    assert.match(text, /projection.*not.*delivery|not.*delivery.*projection/is);
    assert.match(text, /no.*result-return evidence|result-return evidence.*not.*yet/is);
    assert.match(text, /does not weaken.*material visibility|material visibility.*must not.*weaken/is);
    assert.match(text, /returned-to.*gate|return.*parent-agent/is);
  });

  it('documents V2 baseline/invocation request schema and legacy aliases', () => {
    const text = readFileSync('docs/contracts/member-invocation-packet-contract.md', 'utf8');
    for (const token of [
      'schemaVersion',
      'member-invocation-packet-v2',
      'expectedBaselineDigest',
      'baselineInstallReportRef',
      'invocationPrompt',
      'invocationPromptDigest',
      'parentSuppliedTaskContext',
      'compatibility',
      'deprecated aliases for one migration version',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /m0Refs.*m1Refs.*compatibility aliases|compatibility aliases.*m0Refs.*m1Refs/is);
    assert.match(text, /digest.*exclude.*compatibility aliases|compatibility aliases.*not.*digest authority/is);
    assert.match(text, /invocation prompt.*must not require.*member-m\[1\]|must not require.*member-m\[1\]/is);
    assert.match(text, /answer canary.*not.*product proof|product proof.*not.*answer canary/is);
    assert.match(text, /projection-only baseline reports.*do not prove invocation\/result return|projection.*not.*invocation.*result/is);
  });
});
