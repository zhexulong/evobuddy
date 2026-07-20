import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SESSION_CONTRACT = readFileSync(resolve(ROOT, 'docs/contracts/evobuddy-native-session-contract.md'), 'utf8');
const CAPABILITY_CONTRACT = readFileSync(resolve(ROOT, 'docs/contracts/evobuddy-runtime-capability-contract.md'), 'utf8');

describe('EvoBuddy native session contracts', () => {
  it('documents native session invariants and rejection rules', () => {
    for (const text of [
      'evobuddy.native-session.v1',
      'no secrets',
      'no arbitrary shell',
      'TaskRoom identity is never derived from terminal session ids',
      'terminal output or idleness is not completion proof',
      'exact-resume overclaim is prohibited',
      'launchCommandRef',
      'runtimeCapabilityRef',
    ]) {
      assert.match(SESSION_CONTRACT, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  });

  it('documents runtime capability continuation limits', () => {
    for (const text of [
      'evobuddy.runtime-capability.v1',
      'exact-resume',
      'heuristic-resume',
      'continue-with-context',
      'fresh-session',
      'unsupported',
      'validated provider conversation identity',
      'must fail closed',
    ]) {
      assert.match(CAPABILITY_CONTRACT, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  });
});
