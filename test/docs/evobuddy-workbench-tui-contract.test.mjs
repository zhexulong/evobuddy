import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONTRACT = readFileSync(resolve(ROOT, 'docs/contracts/evobuddy-workbench-tui-contract.md'), 'utf8');
const PROOF = readFileSync(resolve(ROOT, 'docs/contracts/evobuddy-taskroom-proof-contract.md'), 'utf8');
const TEAM_MVP = readFileSync(resolve(ROOT, 'docs/evobuddy-workbench-team-taskroom-mvp.md'), 'utf8');
const WORKBUDDY = readFileSync(resolve(ROOT, 'docs/workbuddy-style-tui-workbench-v0.md'), 'utf8');
const README = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
const RELEASE = readFileSync(resolve(ROOT, 'docs/release-mvp.md'), 'utf8');

function requireAll(text, phrases, label) {
  for (const phrase of phrases) {
    assert.match(
      text,
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      `${label} must state: ${phrase}`,
    );
  }
}

describe('EvoBuddy Workbench TUI contract', () => {
  it('locks the actor-aware WorkBuddy-style surface', () => {
    for (const text of ['Team Agents', 'Focused Buddies', 'Task Rooms', 'Updates', 'Runtime Setup', 'Interaction rules']) {
      assert.match(CONTRACT, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(CONTRACT, /TUI visibility is not proof/);
    assert.match(CONTRACT, /TeamAgent and SubagentBuddy are different actor kinds/);
    assert.match(CONTRACT, /Interaction state is ephemeral UI state/);
  });

  it('documents TaskRoom-first native TUI orchestration boundaries', () => {
    requireAll(CONTRACT, [
      'TaskRoom-first',
      'no persistent',
      'no hidden orchestrator',
      'native permissions remain native',
      'tmux',
      'Ctrl+B d',
      'exact resume',
      'continue with context',
      'read-only',
      'evidence',
    ], 'workbench TUI contract');
  });

  it('documents proof and recovery boundaries for native sessions', () => {
    requireAll(PROOF, [
      'TaskRoom is visible shared work state',
      'native terminal sessions support but do not replace fork/handoff',
      'terminal output or idleness is not completion proof',
      'exact resume',
      'continue with context',
      'evidence refresh',
      'reconcile',
    ], 'taskroom proof contract');
  });

  it('surfaces native TUI entry points from user-facing docs', () => {
    requireAll(README, [
      'TaskRoom-first',
      'tmux',
      'Ctrl+B d',
      'docs/evobuddy-native-tui-runbook.md',
      'docs/evobuddy-native-session-recovery-runbook.md',
      'evobuddy taskroom',
    ], 'README');

    requireAll(TEAM_MVP, [
      'TaskRoom-first',
      'no persistent',
      'no hidden orchestrator',
      'native permissions remain native',
      'tmux',
      'Ctrl+B d',
    ], 'team taskroom mvp');

    requireAll(WORKBUDDY, [
      'read-only compatibility',
      'TaskRoom-first',
      'native TUI',
    ], 'workbuddy-style workbench');

    requireAll(RELEASE, [
      'tmux prerequisite',
      'native TUI',
      'exact resume',
      'continue with context',
      'evidence limitations',
      'evobuddy:eval-native-tui-tmux:live',
      'evobuddy:eval-tmux-substrate:live',
    ], 'release-mvp');
  });
});
