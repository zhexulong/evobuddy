function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeEvidenceRefs(value, window) {
  const allowed = new Map(asArray(window?.messages).map((message) => [message.ref, message.digest]));
  if (!Array.isArray(value) || value.length === 0) throw new Error('proposal evidenceRefs are required');
  return value.map((item, index) => {
    requireObject(item, `proposal.evidenceRefs[${index}]`);
    const ref = cleanString(item.ref);
    const digest = cleanString(item.digest);
    if (!ref || !digest) throw new Error(`proposal.evidenceRefs[${index}] requires ref and digest`);
    if (!allowed.has(ref)) throw new Error('proposal evidenceRefs must be a subset of window message refs');
    const expectedDigest = allowed.get(ref);
    if (expectedDigest && digest !== expectedDigest) throw new Error('proposal evidenceRefs must match window message digests');
    return { kind: cleanString(item.kind) ?? 'session-message', ref, digest };
  });
}

function stringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`required non-empty array: ${name}`);
  return value.map((item, index) => {
    const text = cleanString(item);
    if (!text) throw new Error(`required non-empty string: ${name}[${index}]`);
    return text;
  });
}

export function normalizeExtractorProposal(proposal, window) {
  requireObject(proposal, 'proposal');
  requireObject(window, 'window');
  const memberName = cleanString(proposal.memberName);
  const role = cleanString(proposal.role);
  const routingDescription = cleanString(proposal.routingDescription);
  if (!memberName) throw new Error('proposal memberName is required');
  if (!role) throw new Error('proposal role is required');
  if (!routingDescription) throw new Error('proposal routingDescription is required');
  return {
    memberName,
    role,
    routingDescription,
    responsibilities: stringArray(proposal.responsibilities, 'proposal.responsibilities'),
    evidenceRefs: normalizeEvidenceRefs(proposal.evidenceRefs, window),
    whyReusable: cleanString(proposal.whyReusable),
    negativeSignals: asArray(proposal.negativeSignals).map((item) => cleanString(item)).filter(Boolean),
  };
}

export function buildManifestFromExtractorProposal({ proposal, window, projectIdentity } = {}) {
  const normalized = normalizeExtractorProposal(proposal, window);
  const evidenceRefs = normalized.evidenceRefs;
  const sessionIds = [...new Set(asArray(window.messages)
    .filter((message) => evidenceRefs.some((ref) => ref.ref === message.ref))
    .map((message) => message.sessionId)
    .filter(Boolean))];
  return {
    manifestKind: 'member-profile-candidate-manifest',
    projectIdentity: cleanString(projectIdentity) ?? cleanString(window.projectIdentity) ?? 'unknown-project',
    memberName: normalized.memberName,
    role: normalized.role,
    routingDescription: normalized.routingDescription,
    responsibilities: normalized.responsibilities,
    evidenceRefs,
    evidenceCoverage: {
      rootSessionCount: sessionIds.length,
      messageCount: evidenceRefs.length,
      supportingRunCount: 0,
      uniqueEvidenceDigestCount: new Set(evidenceRefs.map((ref) => ref.digest)).size,
    },
    sessionRefs: sessionIds.map((sessionId) => `session:${sessionId}`),
    signalKinds: asArray(window.signalKinds).length > 0 ? asArray(window.signalKinds) : ['semantic-member-need'],
    confidence: 0.74,
    whyReusable: normalized.whyReusable,
    negativeSignals: normalized.negativeSignals,
    supportingRuns: [],
    sourceEvidenceSummary: {
      status: 'semantic-extractor-proposal',
      groundingTerms: [],
      groundingTermCount: 0,
      directUserDelegationCount: 0,
      nonGenericEvidenceRefCount: evidenceRefs.length,
      uniqueEvidenceDigestCount: new Set(evidenceRefs.map((ref) => ref.digest)).size,
      ...(proposal.sourceEvidenceSummary && typeof proposal.sourceEvidenceSummary === 'object' ? proposal.sourceEvidenceSummary : {}),
    },
    sourceTexts: asArray(window.messages).map((message) => message.text).filter(Boolean),
    nameKind: 'semantic-extractor-proposal',
    fallbackExtractor: 'none',
    extractorKind: 'member-candidate-extractor-v0',
    roleRoutingSource: 'member-candidate-extractor-proposal',
    dreamerExtractorRun: true,
  };
}

export function runDefaultMemberCandidateExtractor({ windows } = {}) {
  return {
    extractorRun: true,
    adapterKind: 'fail-closed-default',
    semanticClaim: false,
    defaultExtractor: true,
    adapterDiagnostics: {
      adapterKind: 'fail-closed-default',
      inputArtifactRef: undefined,
      rawOutputArtifactRef: undefined,
      parsedOutputArtifactRef: undefined,
      parseErrors: [],
      semanticClaim: false,
    },
    windowsExamined: asArray(windows).length,
    proposals: [],
  };
}
