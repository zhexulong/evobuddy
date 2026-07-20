import { createEvobuddyWorkbenchInteractionState, reduceEvobuddyWorkbenchInteraction, renderInteractiveEvobuddyWorkbench } from './evobuddy-workbench-interaction.mjs';
import { enterWorkbenchScreen, exitWorkbenchScreen, renderWorkbenchScreen } from './evobuddy-workbench-terminal-screen.mjs';

function visiblePaneEntries(model, state) {
  const entries = [{ kind: 'title' }, { kind: 'blank' }];
  const pushPane = (title, pane, items) => {
    entries.push({ kind: 'heading', title, pane });
    for (let index = 0; index < items.length; index += 1) {
      entries.push({ kind: 'item', pane, row: index });
    }
    entries.push({ kind: 'blank' });
  };

  pushPane('Team Agents', 'teamAgents', model.teamAgents);
  pushPane('Focused Buddies', 'focusedBuddies', model.focusedBuddies);
  if (!state.collapsed.taskRooms) pushPane('Task Rooms', 'taskRooms', model.taskRooms);
  if (!state.collapsed.todos) pushPane('Todos', 'todos', model.todos);
  if (!state.collapsed.updates) pushPane('Updates', 'updates', model.updates);
  pushPane('Runtime Setup', 'runtimeSetup', model.runtimeSetup.runtimes);
  return entries;
}

export function mapMouseRowToWorkbenchTarget(model, state, terminalRow) {
  if (state.view !== 'overview') return undefined;
  const entries = visiblePaneEntries(model, state);
  const entry = entries[Math.max(0, terminalRow - 1)];
  if (!entry || entry.kind !== 'item') return undefined;
  return { pane: entry.pane, row: entry.row };
}

export function mapInputChunk(chunk, { model, state, lastMouseClick } = {}) {
  const value = String(chunk);
  const sgrMouse = /^\u001b\[<(?<code>\d+);(?<column>\d+);(?<row>\d+)(?<suffix>[Mm])$/.exec(value);
  if (sgrMouse && model && state) {
    const code = Number(sgrMouse.groups.code);
    const row = Number(sgrMouse.groups.row);
    const isRelease = sgrMouse.groups.suffix === 'm';
    const target = mapMouseRowToWorkbenchTarget(model, state, row);
    if (!target) return undefined;
    if (code === 64) return { type: 'mouse', action: 'scroll-up', pane: target.pane, row: target.row };
    if (code === 65) return { type: 'mouse', action: 'scroll-down', pane: target.pane, row: target.row };
    if (isRelease) return undefined;
    if (code === 0) {
      const now = Date.now();
      const isDoubleClick = lastMouseClick
        && lastMouseClick.pane === target.pane
        && lastMouseClick.row === target.row
        && now - lastMouseClick.at <= 500;
      return {
        type: 'mouse',
        action: isDoubleClick ? 'double-click' : 'click',
        pane: target.pane,
        row: target.row,
        __mouseMeta: { pane: target.pane, row: target.row, at: now },
      };
    }
  }
  if (value === '\u0009') return { type: 'key', key: 'tab' };
  if (value === '\u001b[Z') return { type: 'key', key: 'shift-tab' };
  if (value === '\u001b[A') return { type: 'key', key: 'up' };
  if (value === '\u001b[B') return { type: 'key', key: 'down' };
  if (value === '\u001b[C') return { type: 'key', key: 'right' };
  if (value === '\u001b[D') return { type: 'key', key: 'left' };
  if (value === '\r') return { type: 'key', key: 'enter' };
  if (value === '\u001b') return { type: 'key', key: 'escape' };
  if (value === '\u0002') return { type: 'key', key: 'ctrl-b' };
  if (value === '\u0014') return { type: 'key', key: 'ctrl-t' };
  if (value === 'j') return { type: 'key', key: 'j' };
  if (value === 'k') return { type: 'key', key: 'k' };
  if (value === 'u') return { type: 'key', key: 'u' };
  if (value === 'r') return { type: 'key', key: 'r' };
  if (value === '?') return { type: 'key', key: '?' };
  if (value === 'q') return { type: 'key', key: 'q' };
  return undefined;
}

export async function runEvobuddyWorkbenchInteractiveTerminal({ model, input = process.stdin, output = process.stdout }) {
  let state = createEvobuddyWorkbenchInteractionState(model);
  let lastMouseClick;
  if (!input.isTTY) {
    output.write(renderInteractiveEvobuddyWorkbench(model, state));
    return { exitReason: 'non-interactive', transcript: state.transcript, finalView: state.view, collapsed: state.collapsed };
  }

  const restoreRawMode = typeof input.setRawMode === 'function';
  let resolvePromise;
  const onData = (chunk) => {
    const event = mapInputChunk(chunk, { model, state, lastMouseClick });
    if (!event) return;
    if (event.type === 'mouse' && event.__mouseMeta) lastMouseClick = event.__mouseMeta;
    state = reduceEvobuddyWorkbenchInteraction(state, event);
    renderWorkbenchScreen(output, renderInteractiveEvobuddyWorkbench(model, state));
    if (state.exitRequested) {
      resolvePromise({ exitReason: 'quit', transcript: state.transcript, finalView: state.view, collapsed: state.collapsed });
    }
  };

  enterWorkbenchScreen(output);
  renderWorkbenchScreen(output, renderInteractiveEvobuddyWorkbench(model, state));
  if (restoreRawMode) input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');

  try {
    return await new Promise((resolve) => {
      resolvePromise = resolve;
      input.on('data', onData);
    });
  } finally {
    input.off('data', onData);
    if (restoreRawMode) input.setRawMode(false);
    exitWorkbenchScreen(output);
  }
}
