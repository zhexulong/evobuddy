import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONTRACT = readFileSync(resolve(ROOT, 'docs/contracts/evobuddy-terminal-substrate-contract.md'), 'utf8');

describe('EvoBuddy terminal substrate contract', () => {
  it('documents substrate invariants and capability boundaries', () => {
    for (const text of [
      'TerminalSubstrate',
      'probe',
      'create_session',
      'attach_interactive',
      'inspect',
      'list_sessions',
      'terminate',
      'capability negotiation',
      'unsupported operations degrade to disabled actions',
    ]) {
      assert.match(CONTRACT, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(CONTRACT, /tmux is the first production substrate/i);
    assert.match(CONTRACT, /activity\/child liveness never proves Returned or Completed/i);
    assert.match(CONTRACT, /No tmux window\/pane terms may appear in TaskRoom\/UI public types/i);
  });
});
