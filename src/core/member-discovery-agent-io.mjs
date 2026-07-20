import { createGateAdapterRecord, createExtractorAdapterRecord } from './member-need-agent-adapters.mjs';
import { parseMemberNeedGateVerdict } from './member-need-gate.mjs';
import { normalizeExtractorProposal } from './member-candidate-extractor.mjs';
import { classifyRuntimeCoverage, cleanRuntime } from './member-discovery-runtime-coverage.mjs';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function createGateRequestPacket({ projectIdentity, prompt, gateLines, sourceRef, runtimeCoverage } = {}) {
  const lines = asArray(gateLines).map((line) => ({
    lineOrdinal: line.lineOrdinal,
    sourceOrdinal: line.sourceOrdinal,
    sessionId: line.sessionId,
    ref: line.ref,
    digest: line.digest,
    text: line.text,
    runtime: line.runtime,
  }));

  const lineRuntimes = [...new Set(lines.map((line) => cleanRuntime(line.runtime)).filter(Boolean))];
  const packetRuntimeCoverage = runtimeCoverage && typeof runtimeCoverage === 'object' && !Array.isArray(runtimeCoverage)
    ? runtimeCoverage
    : classifyRuntimeCoverage({ representedRuntimes: lineRuntimes });

  return {
    packetKind: 'member-discovery-gate-request',
    adapterKind: 'agent-assisted-parent-turn',
    projectIdentity: cleanString(projectIdentity) ?? 'unknown-project',
    sourceRef: cleanString(sourceRef),
    prompt: cleanString(prompt) ?? '',
    instructions: 'Return exactly `n` or `y: <ordinals>`. Use displayed lineOrdinal values only. Do not infer from fixed topic names.',
    runtimeCoverage: packetRuntimeCoverage,
    lines,
  };
}

export function parseAgentGateAnswer(text) {
  const rawOutput = String(text ?? '').trim();
  const parsedOutput = parseMemberNeedGateVerdict(rawOutput);
  const parseErrors = rawOutput.length === 0 || (!/^\s*(?:n|no|y\s*:|yes\s*:)/i.test(rawOutput) && parsedOutput.hit === false)
    ? ['gate answer must be `n` or `y: <ordinals>`']
    : [];
  return { rawOutput, parsedOutput, parseErrors, hit: parsedOutput.hit, ordinals: parsedOutput.ordinals };
}

export function createExtractorRequestPacket({ projectIdentity, prompt, window, sourceRef } = {}) {
  return {
    packetKind: 'member-discovery-extractor-request',
    adapterKind: 'agent-assisted-parent-turn',
    projectIdentity: cleanString(projectIdentity) ?? cleanString(window?.projectIdentity) ?? 'unknown-project',
    sourceRef: cleanString(sourceRef),
    prompt: cleanString(prompt) ?? '',
    instructions: 'Return JSON only: {"proposals":[{"memberName":"kebab-case","role":"...","routingDescription":"...","responsibilities":["..."],"evidenceRefs":[{"ref":"session:...","digest":"sha256:..."}],"whyReusable":"...","negativeSignals":[]}]} . Return {"proposals":[]} when evidence is insufficient.',
    window,
  };
}

export function parseAgentExtractorAnswer(text, window) {
  const rawOutput = String(text ?? '').trim();
  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawOutput);
  } catch (error) {
    return { rawOutput, parsedOutput: { proposals: [] }, proposals: [], parseErrors: [`extractor answer must be JSON: ${error.message}`] };
  }

  const proposals = [];
  const parseErrors = [];
  for (const proposal of asArray(parsedOutput.proposals)) {
    try {
      proposals.push(normalizeExtractorProposal(proposal, window));
    } catch (error) {
      parseErrors.push(error.message);
    }
  }
  if (!Array.isArray(parsedOutput.proposals)) parseErrors.push('extractor answer requires proposals array');

  const retainedProposals = parseErrors.length > 0 ? [] : proposals;
  return { rawOutput, parsedOutput: { proposals: retainedProposals }, proposals: retainedProposals, parseErrors };
}

function refsComplete(artifactRefs) {
  return Boolean(cleanString(artifactRefs?.inputArtifactRef) && cleanString(artifactRefs?.rawOutputArtifactRef) && cleanString(artifactRefs?.parsedOutputArtifactRef));
}

export const PRODUCT_ANSWER_CAPTURE_KIND = 'runtime-model-output';

export function answerSourceIsProductEligible(answerSource) {
  return answerSource?.sourceKind === 'observed-parent-agent-turn'
    && answerSource.answerCaptureKind === PRODUCT_ANSWER_CAPTURE_KIND
    && Boolean(cleanString(answerSource.transcriptRef) && cleanString(answerSource.observedTurnDigest));
}

export function createAnswerSourceRecord({ phase, sourceKind, answerCaptureKind, transcriptRef, answerFileRef, requestRef, observedTurnDigest } = {}) {
  const normalizedSourceKind = cleanString(sourceKind) ?? 'manual-retained';
  const record = {
    artifactKind: 'member-discovery-answer-source',
    phase: cleanString(phase) ?? 'unknown',
    sourceKind: normalizedSourceKind,
    answerCaptureKind: cleanString(answerCaptureKind) ?? (normalizedSourceKind === 'manual-retained' ? 'manual-retained-output' : undefined),
    transcriptRef: cleanString(transcriptRef),
    answerFileRef: cleanString(answerFileRef),
    requestRef: cleanString(requestRef),
    observedTurnDigest: cleanString(observedTurnDigest),
  };
  return { ...record, productEligible: answerSourceIsProductEligible(record) };
}

export function createAgentAssistedAdapterRecord({ phase, prompt, rawOutput, parsedOutput, artifactRefs, parseErrors = [] } = {}) {
  const create = phase === 'extractor' ? createExtractorAdapterRecord : createGateAdapterRecord;
  const retainedParseErrors = asArray(parseErrors);
  const refs = artifactRefs && typeof artifactRefs === 'object' && !Array.isArray(artifactRefs)
    ? { ...artifactRefs, parseErrors: retainedParseErrors }
    : { parseErrors: retainedParseErrors };
  const claim = refsComplete(refs) && retainedParseErrors.length === 0;
  return {
    ...create({ adapterKind: 'agent-assisted-parent-turn', prompt, rawOutput, parsedOutput, artifactRefs: refs }),
    memberDiscoveryClaim: claim,
    semanticClaim: claim,
  };
}

export function memberDiscoveryProofScope({ gateRecord, extractorRecord, answerSource } = {}) {
  const gateKind = cleanString(gateRecord?.adapterKind);
  const extractorKind = cleanString(extractorRecord?.adapterKind);
  if (gateKind === 'fail-closed-default' || extractorKind === 'fail-closed-default') return 'diagnostic';
  if (gateKind?.startsWith('fixture-') || extractorKind?.startsWith('fixture-')) return 'retained-fixture';

  const recordsClaim = gateRecord?.memberDiscoveryClaim === true && extractorRecord?.memberDiscoveryClaim === true;
  if (gateKind === 'agent-assisted-parent-turn' && extractorKind === 'agent-assisted-parent-turn' && recordsClaim) {
    return answerSourceIsProductEligible(answerSource) ? 'agent-assisted-product' : 'manual-retained';
  }
  return 'unknown';
}
