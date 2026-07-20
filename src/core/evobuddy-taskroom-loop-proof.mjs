import { validateNativeSessionDescriptor } from './evobuddy-native-session-descriptor.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value;
}

function normalizeParticipant(entry) {
  return {
    participantId: requireString(entry.participantId, 'participantId'),
    actorName: requireString(entry.actorName, 'actorName'),
    actorKind: requireString(entry.actorKind, 'actorKind'),
    role: requireString(entry.role, 'role'),
    runtimeSessionRef: entry.runtimeSessionRef ? requireString(entry.runtimeSessionRef, 'runtimeSessionRef') : null,
    nativeSessionDescriptorId: entry.nativeSessionDescriptorId ? requireString(entry.nativeSessionDescriptorId, 'nativeSessionDescriptorId') : null,
  };
}

function normalizeRound(entry, index) {
  return {
    roundId: requireString(entry.roundId, `rounds[${index}].roundId`),
    builderArtifactRef: requireString(entry.builderArtifactRef, `rounds[${index}].builderArtifactRef`),
    reviewerFindingRef: requireString(entry.reviewerFindingRef, `rounds[${index}].reviewerFindingRef`),
    reviewerRuntimeSessionRef: requireString(entry.reviewerRuntimeSessionRef, `rounds[${index}].reviewerRuntimeSessionRef`),
    priorReviewRefs: Array.isArray(entry.priorReviewRefs) ? entry.priorReviewRefs.map((ref) => requireString(ref, 'priorReviewRefs[]')) : [],
    priorReviewDigests: Array.isArray(entry.priorReviewDigests) ? entry.priorReviewDigests.map((ref) => requireString(ref, 'priorReviewDigests[]')) : [],
    reviewerFindingDigest: entry.reviewerFindingDigest ? requireString(entry.reviewerFindingDigest, `rounds[${index}].reviewerFindingDigest`) : null,
    reviewerTranscriptRef: entry.reviewerTranscriptRef ? requireString(entry.reviewerTranscriptRef, `rounds[${index}].reviewerTranscriptRef`) : null,
  };
}

function normalizeSurfaceCurrentAnchor(entry, index) {
  return {
    actorName: requireString(entry.actorName, `surfaceCurrentAnchors[${index}].actorName`),
    runtimeSessionRef: requireString(entry.runtimeSessionRef, `surfaceCurrentAnchors[${index}].runtimeSessionRef`),
    runtimeActorName: entry.runtimeActorName ? requireString(entry.runtimeActorName, `surfaceCurrentAnchors[${index}].runtimeActorName`) : null,
    projectionRef: requireString(entry.projectionRef, `surfaceCurrentAnchors[${index}].projectionRef`),
    projectionReportRef: entry.projectionReportRef ? requireString(entry.projectionReportRef, `surfaceCurrentAnchors[${index}].projectionReportRef`) : null,
    projectedDigest: requireString(entry.projectedDigest, `surfaceCurrentAnchors[${index}].projectedDigest`),
    definitionRef: requireString(entry.definitionRef, `surfaceCurrentAnchors[${index}].definitionRef`),
    definitionDigest: requireString(entry.definitionDigest, `surfaceCurrentAnchors[${index}].definitionDigest`),
  };
}

export function evaluateReviewerContinuity(proof) {
  if (!Array.isArray(proof.rounds) || proof.rounds.length < 2) return { status: 'fail', reason: 'requires-at-least-two-rounds' };
  const [first, second] = proof.rounds;
  const hasPriorRef = second.priorReviewRefs?.includes(first.reviewerFindingRef);
  const hasPriorDigest = first.reviewerFindingDigest && second.priorReviewDigests?.includes(first.reviewerFindingDigest);
  const hasTranscriptRefs = Boolean(first.reviewerTranscriptRef && second.reviewerTranscriptRef);
  if (first.reviewerRuntimeSessionRef && second.reviewerRuntimeSessionRef && first.reviewerRuntimeSessionRef === second.reviewerRuntimeSessionRef) {
    if (hasPriorRef && hasPriorDigest && hasTranscriptRefs) return { status: 'pass', kind: 'same-session-prior-review-ref-digest' };
  }
  if (hasPriorRef && hasPriorDigest && hasTranscriptRefs) return { status: 'pass', kind: 'prior-review-delivered-ref-digest' };
  return { status: 'fail', reason: 'round-2-missing-prior-review-ref' };
}

export function validateTaskRoomLoopProof(input) {
  const nativeSessions = requireArray(input.nativeSessions ?? [], 'nativeSessions').map(validateNativeSessionDescriptor);
  const proof = {
    schema: requireString(input.schema, 'schema'),
    proofScope: requireString(input.proofScope, 'proofScope'),
    roomId: requireString(input.roomId, 'roomId'),
    participants: requireArray(input.participants, 'participants').map(normalizeParticipant),
    rounds: requireArray(input.rounds, 'rounds').map(normalizeRound),
    handoffs: requireArray(input.handoffs, 'handoffs').map((handoff) => ({ ...handoff })),
    resultReturn: input.resultReturn ?? { status: 'missing' },
    exporterRefs: requireArray(input.exporterRefs ?? [], 'exporterRefs').map((entry) => ({
      ref: requireString(entry.ref, 'exporterRef.ref'),
      digest: requireString(entry.digest, 'exporterRef.digest'),
      sourceKind: requireString(entry.sourceKind, 'exporterRef.sourceKind'),
      dbDigest: requireString(entry.dbDigest, 'exporterRef.dbDigest'),
      transcriptDigest: requireString(entry.transcriptDigest, 'exporterRef.transcriptDigest'),
      runtimeSessionRefs: requireArray(entry.runtimeSessionRefs ?? [], 'exporterRef.runtimeSessionRefs').map((ref) => requireString(ref, 'exporterRef.runtimeSessionRefs[]')),
    })),
    surfaceCurrentAnchors: requireArray(input.surfaceCurrentAnchors ?? [], 'surfaceCurrentAnchors').map(normalizeSurfaceCurrentAnchor),
    nativeSessions,
    nativeForkEvidenceRefs: [],
  };

  const participantNativeDescriptorIds = new Set(
    proof.participants
      .map((participant) => participant.nativeSessionDescriptorId)
      .filter((descriptorId) => descriptorId !== null),
  );
  if (nativeSessions.length > 0 && participantNativeDescriptorIds.size === 0) {
    throw new Error('native sessions require linked participant nativeSessionDescriptorId refs');
  }
  for (const descriptor of nativeSessions) {
    if (descriptor.roomId !== proof.roomId) throw new Error(`native session descriptor ${descriptor.descriptorId} room mismatch for loop proof`);
    if (!participantNativeDescriptorIds.has(descriptor.descriptorId)) {
      throw new Error(`native session descriptor ${descriptor.descriptorId} is not linked to a loop proof participant`);
    }
  }
  for (const descriptorId of participantNativeDescriptorIds) {
    if (!nativeSessions.some((descriptor) => descriptor.descriptorId === descriptorId)) {
      throw new Error(`loop proof participant references missing native session descriptor: ${descriptorId}`);
    }
  }
  proof.nativeForkEvidenceRefs = [...new Set(nativeSessions.flatMap((descriptor) => descriptor.evidenceRefs))];

  if (proof.proofScope === 'product-observed' && proof.exporterRefs.length === 0) throw new Error('product-observed proof requires exporterRefs');
  if (proof.proofScope === 'product-observed') {
    for (const entry of proof.exporterRefs) {
      if (!entry.sourceKind.includes('exporter')) throw new Error('product-observed proof requires exporter sourceKind');
    }
    if (proof.resultReturn?.status === 'pass' && !proof.resultReturn.observedParentThreadRef) throw new Error('resultReturn pass requires observedParentThreadRef');
  }

  const roles = new Set(proof.participants.map((participant) => participant.role));
  if (!roles.has('builder')) throw new Error('loop proof requires builder participant');
  if (!roles.has('reviewer')) throw new Error('loop proof requires reviewer participant');

  if (proof.proofScope === 'product-observed') {
    const builder = proof.participants.find((participant) => participant.role === 'builder');
    const reviewer = proof.participants.find((participant) => participant.role === 'reviewer');
    if (!builder?.runtimeSessionRef || !reviewer?.runtimeSessionRef) throw new Error('product-observed proof requires participant runtimeSessionRef');
    if (builder.runtimeSessionRef === reviewer.runtimeSessionRef) throw new Error('product-observed proof requires distinct observed TeamAgent participant sessions; parent roleplay is not proof');
    const exporterRuntimeRefs = new Set(proof.exporterRefs.flatMap((entry) => entry.runtimeSessionRefs));
    if (!exporterRuntimeRefs.has(builder.runtimeSessionRef)) throw new Error('exporter manifest missing builder runtimeSessionRef');
    if (!exporterRuntimeRefs.has(reviewer.runtimeSessionRef)) throw new Error('exporter manifest missing reviewer runtimeSessionRef');
    const participantsByName = new Map(proof.participants.map((participant) => [participant.actorName, participant]));
    for (const anchor of proof.surfaceCurrentAnchors) {
      const participant = participantsByName.get(anchor.actorName);
      if (!participant || participant.runtimeSessionRef !== anchor.runtimeSessionRef) throw new Error('surfaceCurrentAnchor missing matching participant runtimeSessionRef');
    }
  }

  proof.reviewerContinuity = evaluateReviewerContinuity(proof);
  return proof;
}

export function buildTaskRoomLoopReport(input) {
  const proof = validateTaskRoomLoopProof(input);
  return {
    status: proof.reviewerContinuity.status === 'pass' && proof.resultReturn.status === 'pass' ? 'pass' : 'fail',
    proof,
    reviewerContinuity: proof.reviewerContinuity,
    resultReturn: proof.resultReturn,
  };
}
