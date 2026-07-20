import { buildMemberUtilityGatePrompt, buildMemberUtilityProposalPrompt } from './member-utility-prompts.mjs';
import { createUtilityGateRequestPacket, parseUtilityGateAnswer, parseUtilityProposalAnswer } from './member-utility-agent-io.mjs';
import { manifestToMemberProfileCandidate, validateMemberCandidateManifest } from './member-candidate-dreamer.mjs';

const MANIFEST_KIND = 'member-profile-candidate-manifest';
const UTILITY_CLASSES = new Set(['explicit-repeated-teammate', 'repeated-specialist-work', 'long-lived-context-owner']);

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean);
  const text = cleanString(value);
  return text ? [text] : [];
}

function normalizeMemberName(value) {
  return cleanString(value)?.replace(/^@/, '').replace(/_/g, '-').replace(/\s+/g, '-').toLowerCase();
}

function buildEvidenceIndex(episodesArtifact) {
  const index = new Map();
  for (const episode of asArray(episodesArtifact?.episodes)) {
    for (const ref of asArray(episode.messageRefs)) {
      if (!cleanString(ref.ref) || !cleanString(ref.digest)) continue;
      index.set(`${ref.ref}::${ref.digest}`, {
        ref: ref.ref,
        digest: ref.digest,
        episodeRef: episode.episodeRef,
        sessionId: episode.sessionId,
        text: asArray(episode.sourceTexts)[asArray(episode.messageRefs).indexOf(ref)] ?? episode.summaryText ?? '',
      });
    }
  }
  return index;
}

function supportingRunsForProposal(scan, proposal) {
  const memberName = normalizeMemberName(proposal.memberName);
  if (!memberName) return [];
  return asArray(scan?.supportingRuns).filter((run) => {
    const values = [run?.memberName, run?.importedMemberName, run?.candidateMemberName, run?.ref, run?.path]
      .map((value) => cleanString(value))
      .filter(Boolean);
    return values.some((value) => normalizeMemberName(value) === memberName || value.includes(memberName));
  });
}

function evidenceForProposal(proposal, evidenceIndex) {
  const evidence = [];
  for (const item of asArray(proposal.evidenceRefs)) {
    const ref = cleanString(item?.ref);
    const digest = cleanString(item?.digest);
    if (!ref || !digest) continue;
    const found = evidenceIndex.get(`${ref}::${digest}`);
    if (found) evidence.push(found);
  }
  return evidence;
}

function hasSpecificUtilityReasoning(proposal) {
  const reduction = cleanString(proposal.contextBurdenReduction);
  if (!reduction) return false;
  const words = reduction.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  const genericOnly = /^(reduce[sd]?|lower[sd]?|save[sd]?)\s+(context|burden|cost|time)\.?$/i.test(reduction) || words.length < 6;
  const reasoningText = [proposal.contextBurdenReduction, proposal.whyReusable, proposal.utilityEvidenceSummary, proposal.returnContract].map((v) => cleanString(v)).filter(Boolean).join(' ');
  return !genericOnly && reasoningText.split(/\s+/).filter(Boolean).length >= 12;
}

function isTopicOnlyEvidence(evidence) {
  if (evidence.length === 0) return true;
  return evidence.every((item) => {
    const text = cleanString(item.text) ?? '';
    const words = text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
    const unique = new Set(words);
    return unique.size <= 2;
  });
}

function explicitMemberEpisodeCount(proposal, evidence) {
  const memberName = normalizeMemberName(proposal.memberName);
  if (!memberName) return 0;
  const explicitEpisodes = new Set();
  const explicitPattern = new RegExp(`@?${memberName.replaceAll('-', '[-_\\s]?')}`, 'i');
  for (const item of evidence) {
    if (explicitPattern.test(item.text)) explicitEpisodes.add(item.episodeRef);
  }
  return explicitEpisodes.size;
}

function validateUtilityProposal(proposal, { evidenceIndex, scan }) {
  const warnings = [];
  const memberClass = cleanString(proposal.memberClass);
  if (!UTILITY_CLASSES.has(memberClass)) return { accepted: false, reason: `invalid utility memberClass: ${memberClass ?? 'missing'}` };

  const evidence = evidenceForProposal(proposal, evidenceIndex);
  if (evidence.length === 0 || evidence.length !== asArray(proposal.evidenceRefs).length) {
    return { accepted: false, reason: 'proposal requires source-backed evidence refs with matching digests' };
  }

  const supportingRuns = supportingRunsForProposal(scan, proposal);
  const episodeRefs = new Set(evidence.map((item) => item.episodeRef));
  const uniqueDigests = new Set(evidence.map((item) => item.digest));
  if (memberClass === 'explicit-repeated-teammate' && episodeRefs.size < 2 && supportingRuns.length === 0) {
    return { accepted: false, reason: 'single explicit teammate mention rejected; insufficient repeated evidence' };
  }
  if (uniqueDigests.size < 2 && supportingRuns.length === 0) {
    return { accepted: false, reason: 'insufficient repeated evidence: require two unique evidence digests or run/import corroboration' };
  }
  if (!hasSpecificUtilityReasoning(proposal)) warnings.push({ reason: 'utility reasoning is broad; confirm during setup/import' });
  if (memberClass === 'long-lived-context-owner') warnings.push({ reason: 'long-lived context-owner scope should be confirmed during setup/import for workstream boundaries' });
  if (stringList(proposal.nonResponsibilities).length === 0) return { accepted: false, reason: 'nonResponsibilities must be non-empty' };
  if (stringList(proposal.whenToUse).length === 0) return { accepted: false, reason: 'whenToUse must be non-empty' };
  if (isTopicOnlyEvidence(evidence)) return { accepted: false, reason: 'topic-only utility evidence is insufficient' };

  return { accepted: true, evidence, supportingRuns, warnings };
}

function manifestFromUtilityProposal({ proposal, validation, projectIdentity }) {
  const evidenceRefs = asArray(proposal.evidenceRefs).map((item) => ({ kind: 'session-message', ref: item.ref, digest: item.digest }));
  const sessionIds = [...new Set(validation.evidence.map((item) => item.sessionId).filter(Boolean))];
  const uniqueEvidenceDigestCount = new Set(evidenceRefs.map((ref) => ref.digest)).size;
  return {
    manifestKind: MANIFEST_KIND,
    projectIdentity: cleanString(projectIdentity) ?? 'unknown-project',
    memberName: proposal.memberName,
    role: proposal.role,
    routingDescription: proposal.routingDescription,
    responsibilities: asArray(proposal.responsibilities),
    evidenceRefs,
    evidenceCoverage: {
      rootSessionCount: sessionIds.length,
      messageCount: evidenceRefs.length,
      supportingRunCount: validation.supportingRuns.length,
      uniqueEvidenceDigestCount,
    },
    sessionRefs: sessionIds.map((sessionId) => `session:${sessionId}`),
    signalKinds: ['utility-discovery'],
    confidence: 0.74,
    negativeSignals: asArray(proposal.negativeSignals),
    supportingRuns: validation.supportingRuns,
    sourceEvidenceSummary: {
      status: 'utility-proposal-source-backed',
      groundingTerms: [],
      groundingTermCount: 0,
      directUserDelegationCount: explicitMemberEpisodeCount(proposal, validation.evidence),
      nonGenericEvidenceRefCount: evidenceRefs.length,
      supportingRunCount: validation.supportingRuns.length,
      uniqueEvidenceDigestCount,
    },
    sourceTexts: validation.evidence.map((item) => item.text).filter(Boolean),
    nameKind: 'utility-proposal',
    fallbackExtractor: 'none',
    roleRoutingSource: 'member-utility-discovery-proposal',
    dreamerExtractorRun: true,
    memberClass: proposal.memberClass,
    nonResponsibilities: stringList(proposal.nonResponsibilities),
    whenToUse: stringList(proposal.whenToUse),
    contextPack: proposal.contextPack,
    memoryPolicy: proposal.memoryPolicy,
    returnContract: proposal.returnContract,
    contextBurdenReduction: proposal.contextBurdenReduction,
    utilityEvidenceSummary: proposal.utilityEvidenceSummary ?? proposal.whyReusable,
  };
}

async function callGate({ utilityGate, packet, prompt }) {
  if (typeof utilityGate !== 'function') return { hasDelegationOpportunity: false, episodeRefs: [], reason: 'no utility gate provided', parseErrors: [] };
  const answer = await utilityGate({ packet, prompt });
  if (typeof answer === 'string') return parseUtilityGateAnswer(answer);
  return { hasDelegationOpportunity: answer?.hasDelegationOpportunity === true, episodeRefs: asArray(answer?.episodeRefs), reason: cleanString(answer?.reason), parseErrors: asArray(answer?.parseErrors) };
}

async function callExtractor({ utilityExtractor, episodes, prompt, gateResult }) {
  if (typeof utilityExtractor !== 'function') return { proposals: [], parseErrors: ['no utility extractor provided'] };
  const answer = await utilityExtractor({ episodes, prompt, gateResult });
  if (typeof answer === 'string') return parseUtilityProposalAnswer(answer, episodes);
  return { proposals: asArray(answer?.proposals), parseErrors: asArray(answer?.parseErrors) };
}

function callGateSync({ utilityGate, packet, prompt }) {
  if (typeof utilityGate !== 'function') return { hasDelegationOpportunity: false, episodeRefs: [], reason: 'no utility gate provided', parseErrors: [] };
  const answer = utilityGate({ packet, prompt, episodes: packet?.episodes ?? [] });
  if (answer && typeof answer.then === 'function') throw new Error('memberUtilityGate must be synchronous when used by deriveMemberSessionColdStart');
  if (typeof answer === 'string') return parseUtilityGateAnswer(answer);
  return { hasDelegationOpportunity: answer?.hasDelegationOpportunity === true, episodeRefs: asArray(answer?.episodeRefs), reason: cleanString(answer?.reason), parseErrors: asArray(answer?.parseErrors) };
}

function callExtractorSync({ utilityExtractor, episodes, prompt, gateResult }) {
  if (typeof utilityExtractor !== 'function') return { proposals: [], parseErrors: ['no utility extractor provided'] };
  const answer = utilityExtractor({ episodes, prompt, gateResult });
  if (answer && typeof answer.then === 'function') throw new Error('memberUtilityExtractor must be synchronous when used by deriveMemberSessionColdStart');
  if (typeof answer === 'string') return parseUtilityProposalAnswer(answer, episodes);
  return { proposals: asArray(answer?.proposals), parseErrors: asArray(answer?.parseErrors) };
}

function discoveryStatus({ gateResult, candidates, rejectedProposals, extractorResult }) {
  if (gateResult.hasDelegationOpportunity !== true) return 'utilityGateFalse';
  if (candidates.length > 0) return 'candidate-discovered';
  if (rejectedProposals.length > 0 || asArray(extractorResult?.parseErrors).length > 0 || asArray(extractorResult?.proposals).length > 0) return 'validatorRejected';
  return 'validatorRejected';
}

function buildResult({ scan, episodesArtifact, gateResult, extractorResult }) {
  const evidenceIndex = buildEvidenceIndex(episodesArtifact);
  const manifests = [];
  const candidates = [];
  const rejectedProposals = [];
  const warnings = [];

  for (const rawProposal of asArray(extractorResult.proposals)) {
    const validation = validateUtilityProposal(rawProposal, { evidenceIndex, scan });
    if (!validation.accepted) {
      rejectedProposals.push({ memberName: cleanString(rawProposal?.memberName), reason: validation.reason, proposal: rawProposal });
      continue;
    }
    for (const warning of asArray(validation.warnings)) warnings.push({ memberName: cleanString(rawProposal?.memberName), reason: warning.reason, evidenceRefs: asArray(rawProposal?.evidenceRefs) });
    try {
      const manifest = validateMemberCandidateManifest(manifestFromUtilityProposal({ proposal: rawProposal, validation, projectIdentity: scan?.projectIdentity ?? episodesArtifact?.projectIdentity }));
      manifests.push(manifest);
      candidates.push(manifestToMemberProfileCandidate(manifest));
    } catch (error) {
      rejectedProposals.push({ memberName: cleanString(rawProposal?.memberName), reason: error.message, proposal: rawProposal });
    }
  }

  const status = discoveryStatus({ gateResult, candidates, rejectedProposals, extractorResult });
  const parseErrors = asArray(extractorResult.parseErrors);
  return {
    utilityDiscovery: {
      artifactKind: 'member-utility-discovery',
      status,
      gate: gateResult,
      extractorDiagnostics: { parseErrors, proposedCandidateCount: asArray(extractorResult.proposals).length, acceptedCandidateCount: candidates.length, rejectedCandidateCount: rejectedProposals.length },
      warningCount: warnings.length + parseErrors.length,
      warnings: [...warnings, ...parseErrors.map((reason) => ({ reason }))],
      rejectedProposals,
    },
    candidateManifests: { artifactKind: 'member-profile-candidate-manifest-set', manifests },
    profileCandidates: { artifactKind: 'member-profile-candidate-set', candidates },
    rejectedProposals,
  };
}

export function runMemberUtilityDiscoverySync({ scan, episodesArtifact, utilityGate, utilityExtractor } = {}) {
  const episodes = asArray(episodesArtifact?.episodes);
  const gatePrompt = buildMemberUtilityGatePrompt({ episodes, runtimeCoverage: episodesArtifact?.runtimeCoverage });
  const gatePacket = createUtilityGateRequestPacket({
    projectIdentity: episodesArtifact?.projectIdentity ?? scan?.projectIdentity,
    prompt: gatePrompt,
    episodes,
    sourceRef: 'member-utility-episodes',
    runtimeCoverage: episodesArtifact?.runtimeCoverage,
  });
  const gateResult = callGateSync({ utilityGate, packet: gatePacket, prompt: gatePrompt });
  const proposalPrompt = buildMemberUtilityProposalPrompt({ episodes });
  const extractorResult = gateResult.hasDelegationOpportunity
    ? callExtractorSync({ utilityExtractor, episodes, prompt: proposalPrompt, gateResult })
    : { proposals: [], parseErrors: [] };
  return buildResult({ scan, episodesArtifact, gateResult, extractorResult });
}

export async function runMemberUtilityDiscovery({ scan, episodesArtifact, utilityGate, utilityExtractor } = {}) {
  const episodes = asArray(episodesArtifact?.episodes);
  const gatePrompt = buildMemberUtilityGatePrompt({ episodes, runtimeCoverage: episodesArtifact?.runtimeCoverage });
  const gatePacket = createUtilityGateRequestPacket({
    projectIdentity: episodesArtifact?.projectIdentity ?? scan?.projectIdentity,
    prompt: gatePrompt,
    episodes,
    sourceRef: 'member-utility-episodes',
    runtimeCoverage: episodesArtifact?.runtimeCoverage,
  });
  const gateResult = await callGate({ utilityGate, packet: gatePacket, prompt: gatePrompt });

  const proposalPrompt = buildMemberUtilityProposalPrompt({ episodes });
  const extractorResult = gateResult.hasDelegationOpportunity
    ? await callExtractor({ utilityExtractor, episodes, prompt: proposalPrompt, gateResult })
    : { proposals: [], parseErrors: [] };

  return buildResult({ scan, episodesArtifact, gateResult, extractorResult });
}
