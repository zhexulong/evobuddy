function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function createAdapterRecord({ recordKind, adapterKind, prompt, rawOutput, parsedOutput, artifactRefs } = {}) {
  const refs = artifactRefs && typeof artifactRefs === 'object' && !Array.isArray(artifactRefs) ? artifactRefs : {};
  return {
    recordKind,
    adapterKind: cleanString(adapterKind) ?? 'fail-closed-default',
    inputArtifactRef: cleanString(refs.inputArtifactRef),
    rawOutputArtifactRef: cleanString(refs.rawOutputArtifactRef),
    parsedOutputArtifactRef: cleanString(refs.parsedOutputArtifactRef),
    prompt,
    rawOutput,
    parsedOutput,
    parseErrors: Array.isArray(refs.parseErrors) ? refs.parseErrors : [],
  };
}

export function createGateAdapterRecord(input = {}) {
  return createAdapterRecord({ ...input, recordKind: 'member-need-gate-adapter-record' });
}

export function createExtractorAdapterRecord(input = {}) {
  return createAdapterRecord({ ...input, recordKind: 'member-candidate-extractor-adapter-record' });
}

export function adapterCanSupportSemanticClaim(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.adapterKind === 'fail-closed-default') return false;
  return Boolean(cleanString(record.inputArtifactRef) && cleanString(record.rawOutputArtifactRef) && cleanString(record.parsedOutputArtifactRef));
}
