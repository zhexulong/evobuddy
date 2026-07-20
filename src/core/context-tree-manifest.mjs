const VERDICTS = new Set(['pass', 'fail', 'inconclusive']);
const MATERIAL_SELECTION_MODES = new Set([
  'native-fork',
  'native-session-fork',
  'platform-selected-context',
  'searchable-history',
  'history-supplemented',
  'staged-docs',
  'summary-only',
]);
const FIDELITIES = new Set([
  'native-context-fork',
  'native-session-fork',
  'model-context-replay',
  'compiled-context-packet',
  'session-record-mounted',
  'partial-session-record',
  'summary-only',
]);
const RETURN_DESTINATIONS = new Set(['parent-agent', 'eval-runner', 'file', 'manual']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

function optionalArray(value, name) {
  if (value === undefined) return undefined;
  requireArray(value, name);
  return value;
}

function validateEvidenceRefs(value) {
  requireArray(value, 'evidenceRefs');
  for (const ref of value) {
    requireObject(ref, 'evidenceRef');
    requireString(ref.kind, 'evidenceRef.kind');
    requireString(ref.ref, 'evidenceRef.ref');
  }
}

function hasStableAnchorId(anchor) {
  return [anchor.messageId, anchor.turnId, anchor.checkpointId]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
}

export function createCheckpointManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.nodeId, 'nodeId');
  requireString(input.sessionRef, 'sessionRef');
  requireObject(input.anchor, 'anchor');
  requireString(input.anchor.createdAt, 'anchor.createdAt');
  if (
    input.anchor.createdAt === '1970-01-01T00:00:00.000Z' ||
    (
      input.anchor.turnIndex === 0 &&
      input.anchor.messageId === undefined &&
      input.anchor.checkpointId === undefined &&
      input.anchor.turnId === undefined
    )
  ) {
    throw new Error('checkpoint requires a real observed anchor, not a placeholder');
  }
  if (!hasStableAnchorId(input.anchor)) {
    throw new Error('checkpoint anchor requires messageId, turnId, or checkpointId');
  }
  requireString(input.label, 'label');
  requireString(input.purpose, 'purpose');
  requireObject(input.capture, 'capture');
  requireString(input.capture.platform, 'capture.platform');
  requireArray(input.capture.knownLosses ?? [], 'capture.knownLosses');

  return {
    id: input.id,
    nodeId: input.nodeId,
    sessionRef: input.sessionRef,
    anchor: { ...input.anchor },
    label: input.label,
    purpose: input.purpose,
    capture: {
      ...input.capture,
      knownLosses: input.capture.knownLosses ?? [],
    },
  };
}

export function createSpawnRunManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.baseCheckpointId, 'baseCheckpointId');
  requireString(input.requesterNodeId, 'requesterNodeId');
  requireObject(input.task, 'task');
  requireString(input.task.kind, 'task.kind');
  requireString(input.task.prompt, 'task.prompt');
  requireArray(input.task.targetRefs ?? [], 'task.targetRefs');
  requireString(input.materialSelectionMode, 'materialSelectionMode');
  requireString(input.fidelity, 'fidelity');
  requireArray(input.knownLosses, 'knownLosses');
  validateEvidenceRefs(input.evidenceRefs);

  if (!MATERIAL_SELECTION_MODES.has(input.materialSelectionMode)) {
    throw new Error(`unknown materialSelectionMode: ${input.materialSelectionMode}`);
  }
  if (!FIDELITIES.has(input.fidelity)) {
    throw new Error(`unknown fidelity: ${input.fidelity}`);
  }
  if (
    input.materialSelectionMode === 'searchable-history' &&
    (input.verdict ?? 'inconclusive') === 'pass' &&
    (typeof input.searchableHistoryRef !== 'string' || input.searchableHistoryRef.trim().length === 0)
  ) {
    throw new Error('searchable-history pass requires searchableHistoryRef');
  }
  if (
    input.materialSelectionMode === 'searchable-history' &&
    (input.verdict ?? 'inconclusive') === 'pass' &&
    !input.evidenceRefs.some((ref) => ref.kind === 'history-search')
  ) {
    throw new Error('searchable-history pass requires history-search evidence');
  }

  const verdict = input.verdict ?? 'inconclusive';
  if (!VERDICTS.has(verdict)) throw new Error(`unknown verdict: ${verdict}`);
  if (input.materialSelectionMode === 'summary-only' && verdict === 'pass') {
    throw new Error('summary-only cannot be pass');
  }

  const manifest = {
    id: input.id,
    baseCheckpointId: input.baseCheckpointId,
    requesterNodeId: input.requesterNodeId,
    task: {
      kind: input.task.kind,
      prompt: input.task.prompt,
      targetRefs: input.task.targetRefs ?? [],
    },
    materialSelectionMode: input.materialSelectionMode,
    fidelity: input.fidelity,
    verdict,
    evidenceRefs: input.evidenceRefs,
    knownLosses: input.knownLosses,
  };

  if (input.targetNodeId !== undefined) manifest.targetNodeId = input.targetNodeId;
  if (input.childNodeId !== undefined) manifest.childNodeId = input.childNodeId;
  if (input.searchableHistoryRef !== undefined) manifest.searchableHistoryRef = input.searchableHistoryRef;
  if (optionalArray(input.targetRefs, 'targetRefs') !== undefined) manifest.targetRefs = input.targetRefs;
  return manifest;
}

export function createSpawnResultManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.spawnRunId, 'spawnRunId');
  requireString(input.resultRef, 'resultRef');
  requireString(input.returnedTo, 'returnedTo');
  validateEvidenceRefs(input.evidenceRefs ?? []);
  if (!RETURN_DESTINATIONS.has(input.returnedTo)) {
    throw new Error(`unknown returnedTo: ${input.returnedTo}`);
  }

  const manifest = {
    id: input.id,
    spawnRunId: input.spawnRunId,
    resultRef: input.resultRef,
    returnedTo: input.returnedTo,
    evidenceRefs: input.evidenceRefs ?? [],
  };
  if (input.summary !== undefined) manifest.summary = input.summary;
  if (input.fullOutputRef !== undefined) manifest.fullOutputRef = input.fullOutputRef;
  if (input.usage !== undefined) manifest.usage = input.usage;
  return manifest;
}
