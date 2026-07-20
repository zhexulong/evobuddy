function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

export function buildHelperIdentityReminder(input) {
  requireString(input.baseCheckpointId, 'baseCheckpointId');
  requireString(input.taskKind, 'taskKind');
  requireString(input.returnedTo, 'returnedTo');

  return [
    '<context-tree-helper-reminder>',
    `You have been forked from checkpoint/session ${input.baseCheckpointId} as an independent helper.`,
    'The inherited trajectory exists only as reference for the assigned helper task; you are not the primary agent.',
    `Your only task is the ${input.taskKind} task described in the user message below.`,
    'Do not continue, finish, or act on any older task from the inherited trajectory.',
    'Your toolset may differ from the primary agent toolset.',
    `Your final answer will be returned to ${input.returnedTo}.`,
    '</context-tree-helper-reminder>',
    '',
  ].join('\n');
}