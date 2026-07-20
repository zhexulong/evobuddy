import { createCheckpointManifest } from './context-tree-manifest.mjs';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';

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
  if (!Array.isArray(value)) {
    throw new Error(`required array: ${name}`);
  }
}

function hasAnchorId(anchor) {
  return [anchor.turnId, anchor.messageId, anchor.checkpointId]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
}

function normalizeCapture(capture, targetRefs) {
  const normalized = {
    ...capture,
    knownLosses: [...new Set(capture.knownLosses ?? [])],
  };
  if (Array.isArray(targetRefs) && targetRefs.length > 0 && normalized.targetRefs === undefined) {
    normalized.targetRefs = targetRefs;
  }
  return normalized;
}

function hasRecoverableMaterialRef(capture) {
  return [
    capture.sessionRecordRef,
    capture.checkpointRecordRef,
    capture.compactStateRef,
    capture.searchableHistoryRef,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
}

function requireAnchor(anchor) {
  requireObject(anchor, 'anchor');
  requireString(anchor.createdAt, 'anchor.createdAt');
  if (anchor.createdAt === '1970-01-01T00:00:00.000Z' || !hasAnchorId(anchor)) {
    throw new Error('anchor must be a real observed boundary');
  }
}

function requireCapture(capture) {
  requireObject(capture, 'capture');
  requireString(capture.platform, 'capture.platform');
  requireArray(capture.knownLosses ?? [], 'capture.knownLosses');
  if (!hasRecoverableMaterialRef(capture)) {
    throw new Error('capture must include at least one recoverable material ref');
  }
}

export async function recordCheckpointToContextTree(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  requireString(input.platform, 'platform');
  requireString(input.sessionRef, 'sessionRef');
  requireString(input.nodeId, 'nodeId');
  requireString(input.label, 'label');
  requireString(input.purpose, 'purpose');
  requireAnchor(input.anchor);
  requireCapture(input.capture);
  if (input.capture.platform.trim() !== input.platform.trim()) {
    throw new Error('capture.platform must match platform');
  }
  if (input.targetRefs !== undefined) requireArray(input.targetRefs, 'targetRefs');

  const checkpointManifest = createCheckpointManifest({
    id: input.checkpointId ?? input.anchor.checkpointId ?? `${input.nodeId}-checkpoint`,
    nodeId: input.nodeId,
    sessionRef: input.sessionRef,
    anchor: input.anchor,
    label: input.label,
    purpose: input.purpose,
    capture: normalizeCapture(input.capture, input.targetRefs),
  });

  const artifactRefs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    checkpointManifest,
  });

  return {
    checkpointManifest,
    artifactRefs,
  };
}
