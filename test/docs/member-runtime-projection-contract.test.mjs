import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectionContract = readFileSync('docs/contracts/member-runtime-projection-contract.md', 'utf8');
const installerContract = readFileSync('docs/contracts/member-projection-installer-contract.md', 'utf8');

describe('member runtime projection contracts', () => {
  it('states projection and installer reports are not invocation evidence', () => {
    for (const text of [projectionContract, installerContract]) {
      assert.match(text, /definition-only/i);
      assert.match(text, /not.*packet delivery/i);
      assert.match(text, /not.*result return/i);
      assert.match(text, /memberName/i);
      assert.match(text, /runtimeAgentName/i);
    }
  });
});
