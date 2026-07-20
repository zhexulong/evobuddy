import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const CONTRACT_PATH = resolve(import.meta.dirname, '../../docs/contracts/evobuddy-taskroom-proof-contract.md');

test('taskroom proof contract documents required proof boundaries', () => {
  const text = readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(text, /TaskRoom is visible shared work state\./i);
  assert.match(text, /Wake is content-free\./i);
  assert.match(text, /Messages\/artifacts carry content\./i);
  assert.match(text, /Reviewer continuity requires round-to-round evidence\./i);
  assert.match(text, /Product-observed proof requires runtime\/exporter\/session refs\./i);
  assert.match(text, /Retained\/hermetic proof cannot satisfy product-observed release gate\./i);
  assert.match(text, /Evolution handoff happens after completion or stable checkpoint\./i);
});
