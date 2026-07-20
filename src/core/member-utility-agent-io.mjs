import { createAnswerSourceRecord, answerSourceIsProductEligible } from './member-discovery-agent-io.mjs';

// ── Helpers ────────────────────────────────────────────────────────────

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const VALID_MEMBER_CLASSES = new Set([
  'explicit-repeated-teammate',
  'repeated-specialist-work',
  'long-lived-context-owner',
]);

const PROPOSAL_REQUIRED_FIELDS = [
  'memberName', 'memberClass', 'role', 'routingDescription',
  'responsibilities', 'nonResponsibilities', 'whenToUse', 'contextPack',
  'memoryPolicy', 'returnContract', 'contextBurdenReduction',
  'whyReusable', 'evidenceRefs', 'negativeSignals',
];

function buildEpisodeEvidenceIndex(episodes) {
  const index = new Map();
  for (const episode of asArray(episodes)) {
    for (const msg of asArray(episode.messageRefs)) {
      if (cleanString(msg.ref) && cleanString(msg.digest)) {
        const key = `${msg.ref}::${msg.digest}`;
        index.set(key, true);
        // Also index by ref alone for ref-only checks
        if (!index.has(msg.ref)) index.set(msg.ref, true);
      }
    }
  }
  return index;
}

function proposalEvidenceSubsetOfEpisodes(proposal, evidenceIndex) {
  const refs = asArray(proposal.evidenceRefs);
  if (refs.length === 0) {
    return { valid: false, error: 'proposal must have at least one evidence ref with digest' };
  }
  for (const ev of refs) {
    if (!cleanString(ev.ref)) {
      return { valid: false, error: 'each evidence ref must have a non-empty ref field' };
    }
    if (!cleanString(ev.digest)) {
      return { valid: false, error: `evidence ref ${ev.ref} is missing digest` };
    }
    const key = `${ev.ref}::${ev.digest}`;
    if (!evidenceIndex.has(key)) {
      return { valid: false, error: `evidence ref ${ev.ref} with digest ${ev.digest} is not found in episode messages or digest mismatch` };
    }
  }
  return { valid: true };
}

// ── Gate Request Packet ───────────────────────────────────────────────

export function createUtilityGateRequestPacket({
  projectIdentity,
  prompt,
  episodes,
  events,
  viewRefs,
  sourceRef,
  runtimeCoverage,
  eventStreamDigest,
  coverageLimitations,
} = {}) {
  const eventList = asArray(events);
  return {
    artifactKind: 'member-utility-gate-request',
    packetKind: 'member-utility-gate-request',
    adapterKind: 'agent-assisted-parent-turn',
    projectIdentity: cleanString(projectIdentity) ?? 'unknown-project',
    sourceRef: cleanString(sourceRef),
    prompt: cleanString(prompt) ?? '',
    instructions: 'Return JSON only — no markdown, no code blocks, no explanatory text.',
    eventStreamDigest: cleanString(eventStreamDigest),
    coverageLimitations: asArray(coverageLimitations),
    eventRefs: eventList.map((event) => cleanString(event?.eventId)).filter(Boolean),
    viewRefs: asArray(viewRefs).map((ref) => cleanString(ref)).filter(Boolean),
    events: eventList,
    runtimeCoverage: runtimeCoverage && typeof runtimeCoverage === 'object' && !Array.isArray(runtimeCoverage)
      ? runtimeCoverage
      : undefined,
    episodes: asArray(episodes),
  };
}

// ── Gate Answer Parser ────────────────────────────────────────────────

export function parseUtilityGateAnswer(text) {
  const rawOutput = String(text ?? '').trim();
  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawOutput);
  } catch (error) {
    return {
      rawOutput,
      hasDelegationOpportunity: false,
      episodeRefs: [],
      reason: undefined,
      parseErrors: [`gate answer must be valid JSON: ${error.message}`],
    };
  }

  const parseErrors = [];

  if (typeof parsedOutput.hasDelegationOpportunity !== 'boolean') {
    parseErrors.push('gate answer must include boolean hasDelegationOpportunity');
  }
  if (!Array.isArray(parsedOutput.episodeRefs) && !Array.isArray(parsedOutput.eventRefs)) {
    parseErrors.push('gate answer must include episodeRefs or eventRefs array');
  }
  if (!cleanString(parsedOutput.reason)) {
    parseErrors.push('gate answer must include non-empty reason string');
  }

  return {
    rawOutput,
    hasDelegationOpportunity: parsedOutput.hasDelegationOpportunity === true,
    episodeRefs: Array.isArray(parsedOutput.episodeRefs) ? parsedOutput.episodeRefs : [],
    eventRefs: asArray(parsedOutput.eventRefs).map((ref) => cleanString(ref)).filter(Boolean),
    viewRefs: asArray(parsedOutput.viewRefs).map((ref) => cleanString(ref)).filter(Boolean),
    reason: cleanString(parsedOutput.reason),
    parseErrors,
  };
}

// ── Proposal Answer Parser ────────────────────────────────────────────

export function parseUtilityProposalAnswer(text, episodes) {
  const rawOutput = String(text ?? '').trim();
  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawOutput);
  } catch (error) {
    return {
      rawOutput,
      proposals: [],
      parseErrors: [`proposal answer must be valid JSON: ${error.message}`],
    };
  }

  if (!parsedOutput || typeof parsedOutput !== 'object' || !Array.isArray(parsedOutput.proposals)) {
    return {
      rawOutput,
      proposals: [],
      parseErrors: ['proposal answer must include proposals array'],
    };
  }

  const evidenceIndex = buildEpisodeEvidenceIndex(episodes);
  const proposals = [];
  const parseErrors = [];

  for (let i = 0; i < parsedOutput.proposals.length; i++) {
    const proposal = parsedOutput.proposals[i];

    if (!proposal || typeof proposal !== 'object') {
      parseErrors.push(`proposal[${i}] must be a non-null object`);
      continue;
    }
    const errors = [];

    // Check required fields
    for (const field of PROPOSAL_REQUIRED_FIELDS) {
      if (!(field in proposal)) {
        errors.push(`proposal[${i}] is missing required field: ${field}`);
      }
    }

    // Check memberClass
    const memberClass = cleanString(proposal.memberClass);
    if (memberClass && !VALID_MEMBER_CLASSES.has(memberClass)) {
      errors.push(`proposal[${i}] has invalid memberClass "${proposal.memberClass}"; must be one of: ${[...VALID_MEMBER_CLASSES].join(', ')}`);
    }

    // Check evidence refs against episodes
    const evidenceResult = proposalEvidenceSubsetOfEpisodes(proposal, evidenceIndex);
    if (!evidenceResult.valid) {
      errors.push(`proposal[${i}] ${evidenceResult.error}`);
    }

    if (errors.length === 0) {
      proposals.push(proposal);
    } else {
      parseErrors.push(...errors);
    }
  }

  return {
    rawOutput,
    proposals,
    parseErrors,
  };
}

// ── Answer Source Records ──────────────────────────────────────────────

export function createUtilityAnswerSourceRecord({
  phase,
  sourceKind,
  answerCaptureKind,
  transcriptRef,
  answerFileRef,
  requestRef,
  observedTurnDigest,
} = {}) {
  const record = createAnswerSourceRecord({
    phase,
    sourceKind,
    answerCaptureKind,
    transcriptRef,
    answerFileRef,
    requestRef,
    observedTurnDigest,
  });
  // Override productEligible to include requestRef check
  return { ...record, productEligible: utilityAnswerSourceIsProductEligible(record) };
}

export function utilityAnswerSourceIsProductEligible(answerSource) {
  return answerSourceIsProductEligible(answerSource) && Boolean(cleanString(answerSource?.requestRef));
}
