import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const RUNBOOK = resolve(ROOT, 'docs/evobuddy-native-tui-runbook.md');
const RECOVERY = resolve(ROOT, 'docs/evobuddy-native-session-recovery-runbook.md');

function load(path) {
  assert.equal(existsSync(path), true, `missing required runbook: ${path}`);
  return readFileSync(path, 'utf8');
}

function requireAll(text, phrases, label) {
  for (const phrase of phrases) {
    assert.match(
      text,
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      `${label} must state: ${phrase}`,
    );
  }
}

describe('EvoBuddy native TUI runbooks', () => {
  it('documents installation, probe, lifecycle commands, and safety semantics', () => {
    const text = load(RUNBOOK);
    requireAll(text, [
      'TaskRoom-first',
      'no persistent',
      'no hidden orchestrator',
      'native permissions remain native',
      'tmux prerequisite',
      'Ctrl+B d',
      'exact resume',
      'continue with context',
      'heuristic resume',
      'fresh session',
      'read-only compatibility',
      'evidence limitations',
      'evobuddy setup',
      'evobuddy workbench',
      'evobuddy taskroom create',
      'evobuddy taskroom session reserve',
      'evobuddy taskroom session plan-open',
      'evobuddy taskroom session commit',
      'evobuddy taskroom session inspect',
      'evobuddy taskroom session reconcile',
      'evobuddy taskroom session stop',
      'evobuddy taskroom archive',
      'evobuddy taskroom refresh',
      '.evobuddy/native-sessions',
      '.evobuddy/native-session-launch-plans',
      '.evobuddy/taskrooms',
      'evb-',
      'runtime capability matrix',
      'Open native runtime',
      'Detach',
    ], 'native TUI runbook');
  });

  it('documents stale/orphan recovery and recovery commands', () => {
    const text = load(RECOVERY);
    requireAll(text, [
      'stale',
      'orphan',
      'conflict',
      'reconcile',
      'evobuddy taskroom session reconcile',
      'evobuddy taskroom session inspect',
      'evobuddy taskroom session stop',
      'exact resume',
      'continue with context',
      'descriptor',
      '.evobuddy/native-sessions',
      'tmux',
      'recovery',
      'TerminalModeGuard',
      'does not kill',
    ], 'native session recovery runbook');
  });
});
