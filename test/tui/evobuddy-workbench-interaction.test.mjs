import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import {
  createEvobuddyWorkbenchInteractionState,
  reduceEvobuddyWorkbenchInteraction,
  renderInteractiveEvobuddyWorkbench,
} from '../../src/tui/evobuddy-workbench-interaction.mjs';
import { mapInputChunk, mapMouseRowToWorkbenchTarget } from '../../src/tui/evobuddy-workbench-interactive-terminal.mjs';

async function model() {
  const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: 'fixtures/evobuddy-workbench/team-taskroom-retained' });
  return buildEvobuddyWorkbenchModel({ artifacts });
}

function apply(_modelValue, state, events) {
  return events.reduce((current, event) => reduceEvobuddyWorkbenchInteraction(current, event), state);
}

describe('EvoBuddy Workbench interaction controller', () => {
  it('supports tab, open, back, pane toggle, and quit without mutating the model', async () => {
    const m = await model();
    const state = createEvobuddyWorkbenchInteractionState(m);
    const next = apply(m, state, [
      { type: 'key', key: 'tab' },
      { type: 'key', key: 'tab' },
      { type: 'key', key: 'right' },
      { type: 'key', key: 'left' },
      { type: 'key', key: 'ctrl-b' },
      { type: 'key', key: 'ctrl-b' },
      { type: 'key', key: 'ctrl-t' },
      { type: 'key', key: 'ctrl-t' },
      { type: 'key', key: 'u' },
      { type: 'key', key: 'u' },
      { type: 'key', key: 'q' },
    ]);

    assert.equal(next.exitRequested, true);
    assert.equal(next.collapsed.taskRooms, false);
    assert.equal(next.collapsed.todos, false);
    assert.equal(next.collapsed.updates, false);
    assert.equal(m.updates.length > 0, true);
    assert.deepEqual(next.history.map((entry) => entry.view), ['overview', 'taskroom', 'overview']);
  });

  it('normalizes mouse clicks as selection/open events without durable writes', async () => {
    const m = await model();
    const state = createEvobuddyWorkbenchInteractionState(m);
    const selected = reduceEvobuddyWorkbenchInteraction(state, { type: 'mouse', action: 'click', pane: 'taskRooms', row: 0 });
    const opened = reduceEvobuddyWorkbenchInteraction(selected, { type: 'mouse', action: 'double-click', pane: 'taskRooms', row: 0 });
    assert.equal(opened.view, 'taskroom');
    assert.equal(opened.selected.taskRoomIndex, 0);
    assert.equal(opened.durableWrites?.length ?? 0, 0);
  });

  it('hides collapsed panes from the interactive overview without dropping model data', async () => {
    const m = await model();
    const state = apply(m, createEvobuddyWorkbenchInteractionState(m), [
      { type: 'key', key: 'ctrl-b' },
      { type: 'key', key: 'ctrl-t' },
      { type: 'key', key: 'u' },
    ]);
    const text = renderInteractiveEvobuddyWorkbench(m, state);
    assert.equal(m.taskRooms.length > 0, true);
    assert.equal(m.todos.length > 0, true);
    assert.equal(m.updates.length > 0, true);
    assert.doesNotMatch(text, /^Task Rooms$/m);
    assert.doesNotMatch(text, /^Todos$/m);
    assert.doesNotMatch(text, /^Updates$/m);
  });

  it('returns to overview from a direct detail state even without a back stack', async () => {
    const m = await model();
    const directDetail = { ...createEvobuddyWorkbenchInteractionState(m), view: 'taskroom' };
    const back = reduceEvobuddyWorkbenchInteraction(directDetail, { type: 'key', key: 'left' });
    assert.equal(back.view, 'overview');
  });

  it('maps visible overview mouse rows to panes and promotes repeated clicks to double-click', async () => {
    const m = await model();
    const state = createEvobuddyWorkbenchInteractionState(m);
    const taskRoomTarget = mapMouseRowToWorkbenchTarget(m, state, 14);
    assert.deepEqual(taskRoomTarget, { pane: 'taskRooms', row: 0 });

    const first = mapInputChunk('\u001b[<0;1;14M', { model: m, state });
    assert.equal(first.type, 'mouse');
    assert.equal(first.action, 'click');
    assert.equal(first.pane, 'taskRooms');
    assert.equal(first.row, 0);

    const second = mapInputChunk('\u001b[<0;1;14M', { model: m, state, lastMouseClick: first.__mouseMeta });
    assert.equal(second.action, 'double-click');
  });

  it('renders interaction help without proof paths or raw ids', async () => {
    const m = await model();
    const text = renderInteractiveEvobuddyWorkbench(m, createEvobuddyWorkbenchInteractionState(m));
    assert.match(text, /Tab/);
    assert.match(text, /→ open/);
    assert.match(text, /← back/);
    assert.doesNotMatch(text, /sha256:/);
    assert.doesNotMatch(text, /ses_/);
    assert.doesNotMatch(text, /\/tmp\//);
  });
});
