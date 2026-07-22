import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONTRACT = readFileSync(resolve(ROOT, 'docs/contracts/evobuddy-workbench-tui-contract.md'), 'utf8');

describe('EvoBuddy Workbench TUI contract', () => {
  it('locks the actor-aware WorkBuddy-style surface', () => {
    for (const text of ['Team Agents', 'Focused Buddies', 'Task Rooms', 'Updates', 'Runtime Setup', 'Interaction rules']) {
      assert.match(CONTRACT, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(CONTRACT, /TUI visibility is not proof/);
    assert.match(CONTRACT, /TeamAgent and SubagentBuddy are different actor kinds/);
    assert.match(CONTRACT, /Interaction state is ephemeral UI state/);
  });
});
