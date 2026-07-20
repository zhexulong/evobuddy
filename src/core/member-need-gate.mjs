import { createHash } from 'node:crypto';

const INTERNAL_INITIATOR_MARKER = '<!-- OMO_INTERNAL_INITIATOR -->';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function messageRef(message) {
  const existingRef = cleanString(message?.ref);
  if (existingRef) return existingRef;
  return `session:${message?.sessionId}:message:${message?.ordinal}`;
}

function hasWorkflowWrapperExclusion(message) {
  return Number.isFinite(message?.excludedWorkflowWrapperCount) && message.excludedWorkflowWrapperCount > 0;
}

function isGenuineUserGateMessage(message) {
  if (message?.role !== 'user') return false;
  const text = cleanString(message.text);
  if (!text) return false;
  if (text === INTERNAL_INITIATOR_MARKER) return false;
  const sourceKind = cleanString(message.evidenceSourceKind);
  if (sourceKind !== 'genuine-user-message') return false;
  return !hasWorkflowWrapperExclusion(message);
}

export function renderMemberNeedGateLines(messages) {
  return asArray(messages)
    .filter(isGenuineUserGateMessage)
    .map((message, index) => ({
      lineOrdinal: index + 1,
      sourceOrdinal: message.ordinal,
      ref: messageRef(message),
      text: cleanString(message.text),
      sessionId: message.sessionId,
      runtime: message.runtime,
      digest: cleanString(message.digest) ?? sha256Json(message.text),
    }));
}

export function parseMemberNeedGateVerdict(text) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^(?:n|no)$/i.test(trimmed)) return { hit: false, ordinals: [] };
    const match = /^(?:y|yes):\s*(\d+(?:\s*,\s*\d+)*)$/i.exec(trimmed);
    if (match) {
      return {
        hit: true,
        ordinals: match[1].split(',').map((part) => Number.parseInt(part.trim(), 10)),
      };
    }
  }
  return { hit: false, ordinals: [] };
}

function buildMessageFromGateLine(line) {
  return {
    sessionId: line.sessionId,
    ordinal: line.sourceOrdinal,
    text: line.text,
    ref: line.ref,
    digest: line.digest,
    runtime: line.runtime,
  };
}

function buildSemanticWindow({ scan, lines }) {
  const messages = lines.map(buildMessageFromGateLine);
  const sessionIds = [...new Set(messages.map((message) => message.sessionId))];
  return {
    artifactKind: 'member-role-need-window',
    projectIdentity: scan?.projectIdentity,
    nameKind: 'semantic-member-need',
    matchKind: 'semantic-member-need-gate',
    sessionRefs: sessionIds.map((sessionId) => `session:${sessionId}`),
    messages,
    signalKinds: ['semantic-member-need'],
    evidenceCoverage: {
      rootSessionCount: sessionIds.length,
      messageCount: messages.length,
      supportingRunCount: 0,
      uniqueEvidenceDigestCount: new Set(messages.map((message) => message.digest)).size,
    },
    supportingRuns: [],
    negativeSignals: ['semantic-member-need-requires-dreamer-naming'],
    promotionEligibility: { canCreateCandidate: false, reason: 'semantic member need gate does not assign deterministic memberName' },
    dreamerDiagnostics: {
      extractorKind: 'member-need-gate-v0-semantic-window',
      extractorRun: true,
      proposedCandidateCount: 0,
      reason: 'gate identified member need evidence; Task 2 extractor owns candidate proposal',
    },
  };
}

export function buildMemberNeedWindowsFromGate({ scan, gateLines, gateVerdict, radius } = {}) {
  const lines = asArray(gateLines);
  const verdictOrdinals = gateVerdict?.hit === true ? asArray(gateVerdict.ordinals) : [];
  const validOrdinalSet = new Set(lines.map((line) => line.lineOrdinal));
  const flaggedOrdinals = [...new Set(verdictOrdinals.filter((ordinal) => Number.isInteger(ordinal) && validOrdinalSet.has(ordinal)))].sort((left, right) => left - right);
  const diagnosticsBase = {
    gateRun: true,
    lineCount: lines.length,
    flaggedLineCount: flaggedOrdinals.length,
  };
  if (flaggedOrdinals.length === 0) {
    return { windows: [], diagnostics: { ...diagnosticsBase, windowCount: 0, reason: gateVerdict?.hit === true ? 'no valid flagged gate line ordinals' : 'gate verdict did not identify member need evidence' } };
  }

  const windowRadius = Number.isInteger(radius) && radius > 0 ? radius : 0;
  const includedOrdinals = new Set();
  for (const ordinal of flaggedOrdinals) {
    for (let current = ordinal - windowRadius; current <= ordinal + windowRadius; current += 1) {
      if (validOrdinalSet.has(current)) includedOrdinals.add(current);
    }
  }
  const windowLines = lines.filter((line) => includedOrdinals.has(line.lineOrdinal));
  const windows = windowLines.length > 0 ? [buildSemanticWindow({ scan, lines: windowLines })] : [];
  return {
    windows,
    diagnostics: {
      ...diagnosticsBase,
      windowCount: windows.length,
      reason: windows.length > 0 ? 'semantic member need gate window built from flagged rendered line ordinals' : 'no gate lines remained after radius expansion',
    },
  };
}
