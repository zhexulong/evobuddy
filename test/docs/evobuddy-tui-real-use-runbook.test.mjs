import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
const runbook = resolve(root, 'docs/evobuddy-tui-real-use-runbook.md');

describe('EvoBuddy TUI real-use runbook', () => {
  it('documents launch, daily loop, detach, and dual gates', () => {
    assert.equal(existsSync(runbook), true);
    const text = readFileSync(runbook, 'utf8');
    for (const needle of [
      'cargo run -p evobuddy-tui',
      'Ctrl+B d',
      'n',
      'Enter',
      'evobuddy:eval-tui-substrate-smoke:live',
      'evobuddy:eval-tui-real-use:live',
      'real runtime product proof',
      'fake-native',
      'worktree',
    ]) {
      assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), needle);
    }
  });
});
