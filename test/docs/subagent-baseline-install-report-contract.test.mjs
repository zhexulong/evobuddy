import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTRACT = resolve(import.meta.dirname, '../../docs/contracts/subagent-baseline-install-report-contract.md');

describe('subagent baseline install report contract', () => {
  it('documents baseline materialization and projection-only boundaries', () => {
    const text = readFileSync(CONTRACT, 'utf8');

    assert.match(text, /materialized role memory content/i);
    assert.match(text, /projection-only/i);
    assert.match(text, /does not prove invocation/i);
    assert.match(text, /does not prove result return/i);
    assert.match(text, /dynamic invocation prompt is parent-owned/i);
    assert.match(text, /no `member-m\[1\]` product requirement/i);
  });
});
