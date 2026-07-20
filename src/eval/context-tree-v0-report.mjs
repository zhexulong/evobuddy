import { bucketForMaterialSelection } from '../core/material-selection.mjs';

const BUCKET_NAMES = [
  'nativeFork',
  'nativeSessionFork',
  'platformSelectedContext',
  'searchableHistory',
  'historySupplemented',
  'stagedDocs',
  'summaryOnly',
];

function emptyBucket() {
  return { pass: 0, fail: 0, inconclusive: 0, invalidPass: 0 };
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createContextTreeV0Report({ caseResults }) {
  const materialSelectionModes = Object.fromEntries(
    BUCKET_NAMES.map((name) => [name, emptyBucket()]),
  );

  for (const cr of caseResults ?? []) {
    const spawn = cr.contextTree?.spawnRunManifest;
    if (!spawn?.materialSelectionMode) continue;

    const bucketName = bucketForMaterialSelection(spawn.materialSelectionMode);
    const bucket = materialSelectionModes[bucketName];
    const verdict = spawn.verdict ?? cr.verdict ?? 'inconclusive';

    if (spawn.materialSelectionMode === 'summary-only' && verdict === 'pass') {
      bucket.invalidPass += 1;
      continue;
    }

    if (
      spawn.materialSelectionMode === 'searchable-history' &&
      verdict === 'pass' &&
      (!hasNonEmptyString(spawn.searchableHistoryRef) ||
        !(spawn.evidenceRefs ?? []).some((ref) => ref.kind === 'history-search'))
    ) {
      bucket.invalidPass += 1;
      continue;
    }

    if (verdict === 'pass') bucket.pass += 1;
    else if (verdict === 'fail') bucket.fail += 1;
    else bucket.inconclusive += 1;
  }

  return {
    reportKind: 'context-tree-v0',
    summary: { materialSelectionModes },
  };
}
