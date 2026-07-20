import { renderEvobuddyWorkbenchTerminal } from '../report/evobuddy-workbench-terminal.mjs';

const PANE_ORDER = ['teamAgents', 'focusedBuddies', 'taskRooms', 'todos', 'updates', 'runtimeSetup'];

function clampIndex(length, index) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function paneLength(model, pane) {
  if (pane === 'teamAgents') return model.teamAgents.length;
  if (pane === 'focusedBuddies') return model.focusedBuddies.length;
  if (pane === 'taskRooms') return model.taskRooms.length;
  if (pane === 'todos') return model.todos.length;
  if (pane === 'updates') return model.updates.length;
  if (pane === 'runtimeSetup') return model.runtimeSetup.runtimes.length;
  return 0;
}

function selectedIndexKey(pane) {
  if (pane === 'teamAgents') return 'teamAgentIndex';
  if (pane === 'focusedBuddies') return 'focusedBuddyIndex';
  if (pane === 'taskRooms') return 'taskRoomIndex';
  if (pane === 'todos') return 'todoIndex';
  if (pane === 'updates') return 'updateIndex';
  if (pane === 'runtimeSetup') return 'runtimeSetupIndex';
  return undefined;
}

function viewHistoryEntry(view) {
  return { view };
}

function deriveSelection(model, state) {
  return {
    actor: state.focusedPane === 'focusedBuddies'
      ? model.focusedBuddies[state.selected.focusedBuddyIndex] ?? model.focusedBuddies[0]
      : model.teamAgents[state.selected.teamAgentIndex] ?? model.teamAgents[0] ?? model.focusedBuddies[0],
    taskRoom: model.taskRooms[state.selected.taskRoomIndex] ?? model.taskRooms[0],
  };
}

function openCurrentSelection(state) {
  if (state.focusedPane === 'focusedBuddies') {
    return {
      ...state,
      view: 'subagent-buddy',
      backStack: [...state.backStack, { view: state.view, focusedPane: state.focusedPane }],
      history: [...state.history, viewHistoryEntry('subagent-buddy')],
    };
  }
  if (state.focusedPane === 'taskRooms') {
    return {
      ...state,
      view: 'taskroom',
      backStack: [...state.backStack, { view: state.view, focusedPane: state.focusedPane }],
      history: [...state.history, viewHistoryEntry('taskroom')],
    };
  }
  if (state.focusedPane === 'runtimeSetup') {
    return {
      ...state,
      view: 'runtime-setup',
      backStack: [...state.backStack, { view: state.view, focusedPane: state.focusedPane }],
      history: [...state.history, viewHistoryEntry('runtime-setup')],
    };
  }
  return {
    ...state,
    view: 'team-agent',
    backStack: [...state.backStack, { view: state.view, focusedPane: state.focusedPane }],
    history: [...state.history, viewHistoryEntry('team-agent')],
  };
}

function goBack(state) {
  if (state.backStack.length === 0) {
    if (state.view === 'overview') return state;
    return {
      ...state,
      view: 'overview',
      history: [...state.history, viewHistoryEntry('overview')],
    };
  }
  const previous = state.backStack[state.backStack.length - 1];
  return {
    ...state,
    view: previous.view,
    focusedPane: previous.focusedPane ?? state.focusedPane,
    backStack: state.backStack.slice(0, -1),
    history: [...state.history, viewHistoryEntry(previous.view)],
  };
}

function withTranscript(state, event) {
  return {
    ...state,
    transcript: [...state.transcript, event],
  };
}

export function createEvobuddyWorkbenchInteractionState(model, options = {}) {
  return {
    view: options.view ?? 'overview',
    focusedPane: options.focusedPane ?? 'teamAgents',
    selected: {
      teamAgentIndex: 0,
      focusedBuddyIndex: 0,
      taskRoomIndex: 0,
      todoIndex: 0,
      updateIndex: 0,
      runtimeSetupIndex: 0,
    },
    collapsed: {
      taskRooms: false,
      todos: false,
      updates: false,
    },
    paneLengths: Object.fromEntries(PANE_ORDER.map((pane) => [pane, paneLength(model, pane)])),
    backStack: [],
    transcript: [],
    history: [viewHistoryEntry('overview')],
    exitRequested: false,
    durableWrites: [],
  };
}

export function reduceEvobuddyWorkbenchInteraction(state, event) {
  const next = withTranscript(state, event);
  if (event.type === 'mouse') {
    const pane = event.pane;
    const row = Math.max(0, event.row ?? 0);
    const selected = { ...next.selected };
    const key = selectedIndexKey(pane);
    if (key) selected[key] = clampIndex(next.paneLengths[pane] ?? 0, row);
    const clicked = { ...next, focusedPane: pane, selected };
    if (event.action === 'double-click') return openCurrentSelection(clicked);
    return clicked;
  }

  const key = event.key;
  if (key === 'tab') {
    const index = PANE_ORDER.indexOf(next.focusedPane);
    return { ...next, focusedPane: PANE_ORDER[(index + 1) % PANE_ORDER.length] };
  }
  if (key === 'shift-tab') {
    const index = PANE_ORDER.indexOf(next.focusedPane);
    return { ...next, focusedPane: PANE_ORDER[(index - 1 + PANE_ORDER.length) % PANE_ORDER.length] };
  }
  if (key === 'up' || key === 'k') {
    const selected = { ...next.selected };
    const target = selectedIndexKey(next.focusedPane);
    if (target) selected[target] = clampIndex(next.paneLengths[next.focusedPane] ?? 0, selected[target] - 1);
    return { ...next, selected };
  }
  if (key === 'down' || key === 'j') {
    const selected = { ...next.selected };
    const target = selectedIndexKey(next.focusedPane);
    if (target) selected[target] = clampIndex(next.paneLengths[next.focusedPane] ?? 0, selected[target] + 1);
    return { ...next, selected };
  }
  if (key === 'right' || key === 'enter') return openCurrentSelection(next);
  if (key === 'left' || key === 'escape') return goBack(next);
  if (key === 'ctrl-b') return { ...next, collapsed: { ...next.collapsed, taskRooms: !next.collapsed.taskRooms } };
  if (key === 'ctrl-t') return { ...next, collapsed: { ...next.collapsed, todos: !next.collapsed.todos } };
  if (key === 'u') return { ...next, collapsed: { ...next.collapsed, updates: !next.collapsed.updates } };
  if (key === 'r') {
    const runtimeState = { ...next, focusedPane: 'runtimeSetup' };
    return openCurrentSelection(runtimeState);
  }
  if (key === '?') return { ...next, helpOpen: true };
  if (key === 'q') return { ...next, exitRequested: true };
  return next;
}

function stripOverviewSections(text, hiddenTitles) {
  if (hiddenTitles.length === 0) return text;
  const lines = text.split('\n');
  const kept = [];
  let skipping = false;
  for (const line of lines) {
    if (hiddenTitles.includes(line.trim())) {
      skipping = true;
      continue;
    }
    if (skipping && line.trim() === '') {
      skipping = false;
      continue;
    }
    if (!skipping) kept.push(line);
  }
  return kept.join('\n');
}

export function renderInteractiveEvobuddyWorkbench(model, state) {
  const selectedActor = state.view === 'subagent-buddy'
    ? model.focusedBuddies[state.selected.focusedBuddyIndex]?.name
    : state.focusedPane === 'focusedBuddies'
      ? model.focusedBuddies[state.selected.focusedBuddyIndex]?.name
      : model.teamAgents[state.selected.teamAgentIndex]?.name;
  const selectedTaskRoomId = model.taskRooms[state.selected.taskRoomIndex]?.roomId;
  const visibleModel = {
    ...model,
    taskRooms: state.collapsed.taskRooms ? [] : model.taskRooms,
    todos: state.collapsed.todos ? [] : model.todos,
    updates: state.collapsed.updates ? [] : model.updates,
    selected: deriveSelection(model, state),
  };
  let body = renderEvobuddyWorkbenchTerminal(visibleModel, {
    view: state.view,
    actor: selectedActor,
    taskroom: selectedTaskRoomId,
    ansi: false,
  }).trimEnd();
  if (state.view === 'overview') {
    const hidden = [];
    if (state.collapsed.taskRooms) hidden.push('Task Rooms');
    if (state.collapsed.todos) hidden.push('Todos');
    if (state.collapsed.updates) hidden.push('Updates');
    body = stripOverviewSections(body, hidden);
  }
  const focusLabel = state.focusedPane;
  const selection = state.view === 'taskroom'
    ? model.taskRooms[state.selected.taskRoomIndex]?.displayTitle ?? 'none'
    : visibleModel.selected.actor?.name ?? 'none';
  return [
    'Read-only management surface | Runtime agent remains primary work surface',
    `Focus: ${focusLabel} | View: ${state.view} | Selected: ${selection}`,
    state.helpOpen ? 'Help: Tab focus | ↑/↓ move | → open | ← back | Ctrl+B task rooms | Ctrl+T todos | u updates | r runtime setup | q quit' : '',
    body,
    '',
    'Tab focus | ↑/↓ move | → open | ← back | Ctrl+B task rooms | Ctrl+T todos | u updates | r runtime setup | ? help | q quit',
  ].filter(Boolean).join('\n') + '\n';
}
