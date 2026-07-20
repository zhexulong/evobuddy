function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function stableSort(values, compare) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => {
      const result = compare(left.value, right.value);
      return result !== 0 ? result : left.index - right.index;
    })
    .map((entry) => entry.value);
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeWidth(width) {
  return Number.isInteger(width) && width > 0 ? width : 96;
}

function formatList(items, emptyLabel = 'none') {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${emptyLabel}`];
}

function formatKeyValueLines(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `${label}: ${value}`);
}

function createStyler(ansi) {
  if (ansi !== true) {
    return {
      heading: (value) => value,
      status: (value) => value,
    };
  }

  return {
    heading: (value) => `\u001b[1m${value}\u001b[0m`,
    status: (value) => `\u001b[36m${value}\u001b[0m`,
  };
}

function sortExperts(experts = []) {
  return stableSort(experts, (left, right) => compareText(left.expertKey, right.expertKey));
}

function formatBuddy(member, width, styler) {
  return truncateCell(
    `${member.displayName ?? member.memberName ?? member.expertKey} (${member.expertKey ?? member.memberName}) | ${styler.status(member.availability ?? 'Available')} | load ${member.currentLoad?.active ?? 0}/${member.currentLoad?.total ?? 0}`,
    width,
  );
}

function rosterSection(model, visibility, fallbackExperts = []) {
  const key = `${visibility}Buddies`;
  if (Array.isArray(model[key]) && model[key].length > 0) return model[key];
  return fallbackExperts.filter((expert) => expert.rosterVisibility === visibility);
}

function sortTasks(tasks = []) {
  return stableSort(tasks, (left, right) => {
    const expertCompare = compareText(left.expertKey, right.expertKey);
    if (expertCompare !== 0) return expertCompare;
    return compareText(left.taskId, right.taskId);
  });
}

function getSelectedExpert(model, options, experts) {
  const desiredKey = options.expertKey ?? model?.selected?.expertKey;
  return experts.find((expert) => expert.expertKey === desiredKey) ?? experts[0];
}

function formatChange(item) {
  return [item.patchId ?? item.ref, item.title ?? item.text].filter(Boolean).join(' | ');
}

function getSelectedTask(model, options, tasks) {
  const desiredTaskId = options.taskId ?? model?.selected?.taskId;
  return tasks.find((task) => task.taskId === desiredTaskId) ?? tasks[0];
}

function formatContextSource(source) {
  const detail = source.targetRef
    ?? source.profileRef
    ?? source.historyRef
    ?? source.runtimeRef
    ?? source.sessionRef
    ?? source.forkMode
    ?? source.anchor?.turnId;
  return detail ? `${source.kind} — ${detail}` : source.kind;
}

function formatArtifactRef([key, value]) {
  return `${key}: ${value}`;
}

function sortArtifactRefs(artifactRefs = {}) {
  return stableSort(Object.entries(artifactRefs), ([leftKey], [rightKey]) => compareText(leftKey, rightKey));
}

function formatTraceSummary(trace) {
  const parts = [];
  if (cleanString(trace.parentCall)) parts.push(`parentCall: ${trace.parentCall}`);
  if (cleanString(trace.digestState)) parts.push(`digestState: ${trace.digestState}`);
  if (cleanString(trace.resultReturned)) parts.push(`resultReturned: ${trace.resultReturned}`);
  return parts.join(' | ');
}

export function truncateCell(value, width) {
  const normalizedWidth = Number.isInteger(width) ? width : 0;
  const text = String(value ?? '');
  if (normalizedWidth <= 0) return '';
  if (text.length <= normalizedWidth) return text;
  if (normalizedWidth <= 3) return '.'.repeat(normalizedWidth);
  return `${text.slice(0, normalizedWidth - 3)}...`;
}

function renderOverview(model, options, styler) {
  const width = normalizeWidth(options.width);
  const experts = sortExperts(model.experts ?? []);
  const tasks = sortTasks(model.tasks ?? []);
  const selectedExpert = getSelectedExpert(model, options, experts);
  const lines = [styler.heading('Member Workbench'), ''];

  lines.push(styler.heading('Buddies'));
  lines.push(...formatList(experts.map((expert) => formatBuddy(expert, width, styler))));
  lines.push('');

  for (const [title, visibility] of [['Active Buddies', 'active'], ['Available Buddies', 'available'], ['Internal Buddies', 'internal'], ['Archived Buddies', 'archived']]) {
    lines.push(styler.heading(title));
    lines.push(...formatList(sortExperts(rosterSection(model, visibility, experts)).map((expert) => formatBuddy(expert, width, styler))));
    lines.push('');
  }

  lines.push(styler.heading('Tasks'));
  lines.push(...formatList(tasks.map((task) => truncateCell(
    `${task.taskId} | ${task.expertDisplayName} | ${styler.status(task.status)} | ${task.title}`,
    width,
  ))));
  lines.push('');

  lines.push(styler.heading('Recent Updates'));
  lines.push(...formatList((model.recentUpdates ?? []).map((item) => truncateCell(item.text, width))));
  lines.push('');

  lines.push(styler.heading('Pending Improvements'));
  lines.push(...formatList((model.pendingImprovements ?? []).map((item) => truncateCell(formatChange(item), width))));
  lines.push('');

  lines.push(styler.heading('Applied Changes'));
  lines.push(...formatList((model.appliedChanges ?? []).map((item) => truncateCell(formatChange(item), width))));
  lines.push('');

  lines.push(styler.heading('Selected Buddy'));
  if (!selectedExpert) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }

  lines.push(...formatKeyValueLines([
    ['Name', `${selectedExpert.displayName} (${selectedExpert.expertKey})`],
    ['Role', selectedExpert.role ?? selectedExpert.shortTitle],
    ['Availability', selectedExpert.availability],
    ['Current load', `${selectedExpert.currentLoad?.active ?? 0}/${selectedExpert.currentLoad?.total ?? 0}`],
    ['Last task', selectedExpert.lastTask ? `${selectedExpert.lastTask.taskId} — ${selectedExpert.lastTask.status}` : 'none'],
  ]));

  const suggestedExperts = model.setupImport?.suggestedExperts ?? [];
  if (suggestedExperts.length > 0) {
    lines.push('');
    lines.push(styler.heading('Suggested Experts'));
    for (const candidate of suggestedExperts) {
      lines.push(`- ${candidate.displayName ?? candidate.memberName} (${candidate.memberName}) | Status: ${candidate.status ?? 'Candidate'} | Confidence: ${candidate.confidence ?? 'unknown'}`);
      lines.push(`  Actions: ${(candidate.actions ?? ['Confirm', 'Rename', 'Add to existing Expert', 'Discard']).join(' | ')}`);
      lines.push(`  Evidence: ${(candidate.evidenceRefs ?? []).length} refs`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderExpert(model, options, styler) {
  const expert = getSelectedExpert(model, options, sortExperts(model.experts ?? []));
  const tasks = sortTasks((model.tasks ?? []).filter((task) => task.expertKey === expert?.expertKey));
  const lines = [styler.heading('Member Workbench'), ''];

  if (!expert) return `${lines.concat(['Expert not found.']).join('\n')}\n`;

  lines.push(styler.heading('Selected Expert'));
  lines.push(...formatKeyValueLines([
    ['Name', `${expert.displayName} (${expert.expertKey})`],
    ['Role', expert.role ?? expert.shortTitle ?? 'Unknown'],
    ['Description', expert.description],
    ['Availability', expert.availability],
  ]));
  lines.push('');

  lines.push(styler.heading('Current load'));
  lines.push(...formatKeyValueLines(Object.entries(expert.currentLoad ?? {})));
  lines.push('');

  lines.push(styler.heading('Recent tasks'));
  lines.push(...formatList(tasks.map((task) => `${task.taskId} | ${task.status} | ${task.title}`)));
  lines.push('');

  lines.push(styler.heading('Recent memory'));
  lines.push(...formatList((expert.recentMemory ?? []).map(String)));
  lines.push('');

  lines.push(styler.heading('Actions'));
  lines.push(...formatList((expert.actions ?? []).map(String)));

  return `${lines.join('\n')}\n`;
}

function renderTask(model, options, styler) {
  const task = getSelectedTask(model, options, sortTasks(model.tasks ?? []));
  const width = normalizeWidth(options.width);
  const lines = [styler.heading('Member Workbench'), ''];

  if (!task) return `${lines.concat(['Task not found.']).join('\n')}\n`;

  lines.push(styler.heading('Task detail'));
  lines.push(...formatKeyValueLines([
    ['Task', `${task.taskId} — ${task.title}`],
    ['Expert', `${task.expertDisplayName} (${task.expertKey})`],
    ['Status', task.status],
    ['Run kind', task.runKind],
    ['Returned to', task.returnedTo ?? 'none'],
  ]));
  lines.push('');

  lines.push(styler.heading('Result'));
  lines.push(task.resultSummary ?? 'none');
  lines.push('');

  lines.push(styler.heading('Used context'));
  lines.push(...formatList((task.usedContext ?? []).map((source) => truncateCell(formatContextSource(source), width))));
  lines.push('');

  lines.push(styler.heading('Trace [collapsed]'));
  lines.push(truncateCell(formatTraceSummary(task.trace ?? {}), width));

  return `${lines.join('\n')}\n`;
}

function renderTrace(model, options, styler) {
  const task = getSelectedTask(model, options, sortTasks(model.tasks ?? []));
  const lines = [styler.heading('Member Workbench'), ''];

  if (!task) return `${lines.concat(['Task not found.']).join('\n')}\n`;

  const trace = task.trace ?? {};
  lines.push(styler.heading('Trace detail'));
  lines.push(...formatKeyValueLines([
    ['Task', task.taskId],
    ['Parent call', trace.parentCall ?? 'unknown'],
    ['Packet delivery', trace.packetDelivery ?? 'unknown'],
    ['Result return', trace.resultReturn ?? 'unknown'],
    ['Memory', trace.memory ?? 'searchable only'],
    ['Suggestions', trace.suggestions ?? 'deferred / hidden from default Experts'],
    ['Executor', trace.executor ?? 'unknown'],
    ['Result returned', trace.resultReturned],
    ['Material path', trace.materialPath],
    ['Digest state', trace.digestState ?? 'unknown'],
    ['Native spawn', trace.nativeSpawn ?? 'unknown'],
    ['Natural spawn', trace.naturalSpawn ?? 'unknown'],
    ['testEligibilityOnly', trace.testEligibilityOnly === true ? 'true' : undefined],
  ]));
  lines.push('');

  lines.push(styler.heading('Limitations'));
  lines.push(...formatList((trace.limitations ?? []).map(String)));
  lines.push('');

  lines.push(styler.heading('Artifact refs'));
  lines.push(...formatList(sortArtifactRefs(trace.artifactRefs ?? {}).map(formatArtifactRef)));

  return `${lines.join('\n')}\n`;
}

export function renderMemberWorkbenchTerminal(model, options = {}) {
  if (!model || typeof model !== 'object') throw new Error('required object: model');

  const styler = createStyler(options.ansi);
  const view = options.view ?? 'overview';

  if (view === 'overview') return renderOverview(model, options, styler);
  if (view === 'expert') return renderExpert(model, options, styler);
  if (view === 'task') return renderTask(model, options, styler);
  if (view === 'trace') return renderTrace(model, options, styler);

  throw new Error(`unsupported view: ${view}`);
}
