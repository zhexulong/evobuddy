const BUCKETS = Object.freeze({
  'native-fork': 'nativeFork',
  'native-session-fork': 'nativeSessionFork',
  'platform-selected-context': 'platformSelectedContext',
  'searchable-history': 'searchableHistory',
  'history-supplemented': 'historySupplemented',
  'staged-docs': 'stagedDocs',
  'summary-only': 'summaryOnly',
});

const FIDELITIES = new Set([
  'native-context-fork',
  'native-session-fork',
  'model-context-replay',
  'compiled-context-packet',
  'session-record-mounted',
  'partial-session-record',
  'summary-only',
]);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

export function bucketForMaterialSelection(mode) {
  requireString(mode, 'materialSelectionMode');
  const bucket = BUCKETS[mode];
  if (!bucket) throw new Error(`unknown materialSelectionMode: ${mode}`);
  return bucket;
}

export function normalizeMaterialSelection(input) {
  requireString(input.materialSelectionMode, 'materialSelectionMode');
  requireString(input.fidelity, 'fidelity');
  requireString(input.reason, 'reason');
  requireArray(input.evidenceRefs, 'evidenceRefs');
  requireArray(input.knownLosses, 'knownLosses');

  if (!FIDELITIES.has(input.fidelity)) {
    throw new Error(`unknown fidelity: ${input.fidelity}`);
  }
  if (
    input.materialSelectionMode === 'searchable-history' &&
    input.verdict === 'pass' &&
    !input.evidenceRefs.some((ref) => ref.kind === 'history-search')
  ) {
    throw new Error('searchable-history pass requires history-search evidence');
  }

  const bucket = bucketForMaterialSelection(input.materialSelectionMode);
  return {
    materialSelectionMode: input.materialSelectionMode,
    bucket,
    fidelity: input.fidelity,
    reason: input.reason,
    evidenceRefs: input.evidenceRefs,
    knownLosses: input.knownLosses,
    verdict: input.verdict ?? 'inconclusive',
    successCapable: input.materialSelectionMode !== 'summary-only',
  };
}