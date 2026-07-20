import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseParentCallRecord, validateParentCallRecord } from '../adapters/explicit-member-parent-call-record.mjs';
import { createParentCallRecordDigest } from '../adapters/explicit-member-parent-invocation-source.mjs';
import { digestBuddyExecutionResolution, validateBuddyExecutionResolution } from '../core/buddy-execution-policy.mjs';
import { validateOpenCodeNativeBuddyTaskProof } from '../core/opencode-native-buddy-task-proof.mjs';
import { validateRuntimeNativeBuddySurfaceProof } from '../core/runtime-native-buddy-surface-proof.mjs';

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const FILE_DIGEST_CACHE = new Map();

export function sha256Text(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

export async function sha256File(path) {
  const filePath = resolve(path);
  const fileStat = await stat(filePath);
  const cacheKey = `${filePath}:${fileStat.size}:${fileStat.mtimeMs}`;
  const cached = FILE_DIGEST_CACHE.get(cacheKey);
  if (cached) return cached;
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', resolvePromise);
  });
  const digest = `sha256:${hash.digest('hex')}`;
  FILE_DIGEST_CACHE.set(cacheKey, digest);
  return digest;
}

function emptyResult() {
  return { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} };
}

function addIssue(result, status, issue) {
  result.issues.push(issue);
  if (status === 'blocked') result.blockedReasons.push(issue);
  else result.failedReasons.push(issue);
}

function finalize(result) {
  result.status = result.failedReasons.length > 0 ? 'fail' : result.blockedReasons.length > 0 ? 'blocked' : 'pass';
  return result;
}

function isMissingFileError(error) {
  return error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSha256Digest(value) {
  return typeof value === 'string' && SHA256_DIGEST_PATTERN.test(value);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256StableJson(value) {
  return sha256Text(JSON.stringify(stableClone(value)));
}

function resolveRef(anchor, ref) {
  if (!nonEmptyString(ref)) return undefined;
  return ref.startsWith('/') ? resolve(ref) : resolve(anchor, ref);
}

async function readTextRef(ref, result, label, status = 'blocked', anchor = process.cwd()) {
  if (!nonEmptyString(ref)) {
    addIssue(result, status, `${label} is required`);
    return undefined;
  }
  const path = resolveRef(anchor, ref);
  try {
    const raw = await readFile(path, 'utf8');
    result.evidenceRefs.push({ kind: label, ref: path, digest: sha256Text(raw) });
    return { path, raw };
  } catch (error) {
    if (isMissingFileError(error)) {
      addIssue(result, status, `${label} must resolve to readable bytes`);
      return undefined;
    }
    throw error;
  }
}

async function readJsonRef(ref, result, label, status = 'blocked', anchor = process.cwd()) {
  const loaded = await readTextRef(ref, result, label, status, anchor);
  if (!loaded) return undefined;
  try {
    return { ...loaded, json: JSON.parse(loaded.raw), digest: sha256Text(loaded.raw) };
  } catch {
    addIssue(result, 'fail', `${label} must be valid JSON`);
    return undefined;
  }
}

function digestIssue(result, actual, expected, label) {
  if (!nonEmptyString(expected)) addIssue(result, 'blocked', `${label} is required`);
  else if (actual !== expected) addIssue(result, 'fail', `${label} mismatch`);
}

function projectRawCallToCanonicalFields(rawCall, canonicalRawCall) {
  return Object.keys(canonicalRawCall).reduce((projected, key) => {
    projected[key] = rawCall?.[key];
    return projected;
  }, {});
}

function canonicalParentCallForComparison(call, parentCallRecord) {
  const parsedCall = parseParentCallRecord(call);
  const canonicalRecord = parseParentCallRecord(parentCallRecord);
  return {
    ...parsedCall,
    rawCall: projectRawCallToCanonicalFields(parsedCall.rawCall, canonicalRecord.rawCall),
  };
}

function parentCallMatchesTarget(call, parentCallRecord, expectedMemberName, expectedInputDigest, expectedResolvedMemberId) {
  let canonicalCall;
  let canonicalRecord;
  try {
    canonicalCall = canonicalParentCallForComparison(call, parentCallRecord);
    canonicalRecord = parseParentCallRecord(parentCallRecord);
  } catch {
    return false;
  }
  if (!sameJson(canonicalCall, canonicalRecord)) return false;
  if (expectedMemberName && canonicalCall.memberName !== expectedMemberName) return false;
  if (expectedInputDigest && canonicalCall.expectedInputDigest !== expectedInputDigest) return false;
  if (expectedResolvedMemberId && canonicalCall.resolvedMemberId !== expectedResolvedMemberId) return false;
  return canonicalCall.sourceThreadId === canonicalRecord.sourceThreadId
    && canonicalCall.parentTurnId === canonicalRecord.parentTurnId
    && canonicalCall.invocationId === canonicalRecord.invocationId
    && canonicalCall.resolvedMemberId === canonicalRecord.resolvedMemberId
    && createParentCallRecordDigest(canonicalCall) === createParentCallRecordDigest(canonicalRecord);
}

export async function validateObservedBuddyCallProvenance(input = {}) {
  const result = emptyResult();
  const anchor = input.productRoot ? resolve(input.productRoot) : process.cwd();
  const transcriptLoaded = await readJsonRef(input.transcriptRef, result, 'transcriptRef', 'blocked', anchor);
  const parentLoaded = await readJsonRef(input.parentCallRecordRef, result, 'parent-call-record ref', 'blocked', anchor);
  const exporterLoaded = await readJsonRef(input.exporterManifestRef, result, 'exporter manifest ref', 'blocked', anchor);

  if (transcriptLoaded) {
    result.digests.transcriptDigest = transcriptLoaded.digest;
    digestIssue(result, transcriptLoaded.digest, input.transcriptDigest, 'transcriptDigest');
    if (transcriptLoaded.json?.kind !== 'observed-parent-agent-call-transcript' || !Array.isArray(transcriptLoaded.json.calls)) addIssue(result, 'fail', 'transcript must be observed-parent-agent-call-transcript with calls[]');
  }

  if (parentLoaded) {
    try {
      validateParentCallRecord(parentLoaded.json, { expectedMemberName: input.expectedMemberName });
    } catch (error) {
      addIssue(result, 'fail', `parent-call-record schema invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (parentLoaded.json?.route !== 'evobuddy-natural-buddy-invocation') addIssue(result, 'fail', 'parent-call-record route must be evobuddy-natural-buddy-invocation');
    if (input.expectedInputDigest && parentLoaded.json?.expectedInputDigest !== input.expectedInputDigest) addIssue(result, 'fail', 'parent-call-record expectedInputDigest mismatch');
    if (input.expectedResolvedMemberId && parentLoaded.json?.resolvedMemberId !== input.expectedResolvedMemberId) addIssue(result, 'fail', 'parent-call-record resolvedMemberId mismatch');
    const parentDigest = createParentCallRecordDigest(parentLoaded.json);
    result.digests.parentCallRecordDigest = parentDigest;
    if (!nonEmptyString(input.parentCallRecordDigest)) addIssue(result, 'blocked', 'parent-call-record digest is required');
    else if (input.parentCallRecordDigest !== parentDigest) addIssue(result, 'fail', 'parent-call-record digest mismatch');
  }

  if (transcriptLoaded && parentLoaded && Array.isArray(transcriptLoaded.json?.calls)) {
    const containsTarget = transcriptLoaded.json.calls.some((call) => parentCallMatchesTarget(call, parentLoaded.json, input.expectedMemberName, input.expectedInputDigest, input.expectedResolvedMemberId));
    if (!containsTarget) addIssue(result, 'fail', 'transcript does not contain the exact parent-call-record');
  }

  if (exporterLoaded) {
    const manifest = exporterLoaded.json;
    if (manifest?.artifactKind !== 'opencode-sqlite-session-corpus-export-manifest') addIssue(result, 'fail', 'exporter manifest artifactKind must be opencode-sqlite-session-corpus-export-manifest');
    if (manifest?.source?.kind !== 'opencode-sqlite') addIssue(result, 'fail', 'exporter manifest source.kind must be opencode-sqlite');
    if (!isSha256Digest(manifest?.source?.dbDigest)) addIssue(result, 'fail', 'exporter manifest source.dbDigest must be a full sha256 digest');
    const dbPath = manifest?.source?.dbPath;
    if (nonEmptyString(dbPath)) {
      if (input.trustExporterManifestDigest === true) {
        result.digests.dbDigest = manifest.source.dbDigest;
      } else {
        try {
          const dbDigest = await sha256File(resolveRef(dirname(exporterLoaded.path), dbPath));
          result.digests.dbDigest = dbDigest;
          if (dbDigest !== manifest.source.dbDigest) addIssue(result, 'fail', 'exporter manifest dbDigest mismatch');
        } catch (error) {
          if (isMissingFileError(error)) addIssue(result, 'blocked', 'exporter manifest dbPath is not readable in this environment');
          else throw error;
        }
      }
    } else {
      addIssue(result, 'fail', 'exporter manifest source.dbPath is required');
    }
    const sessionExportRef = parentLoaded?.json?.rawCall?.sessionExportRef;
    if (parentLoaded && dbPath && sessionExportRef !== dbPath) addIssue(result, 'fail', 'parent call rawCall.sessionExportRef must match exporter manifest dbPath');
    const observedProjectIdentity = parentLoaded?.json?.rawCall?.observedProjectIdentity ?? manifest?.projectIdentity;
    if (input.expectedProjectIdentity && observedProjectIdentity !== input.expectedProjectIdentity) addIssue(result, 'fail', 'observed project identity must match expectedProjectIdentity');
  }

  return finalize(result);
}

export async function validateRoutingDecisionProvenance(input = {}) {
  const result = emptyResult();
  const decisionLoaded = await readJsonRef(input.routingDecisionRef, result, 'routing-decision artifact', 'blocked');
  if (!decisionLoaded) return finalize(result);
  result.digests.routingDecisionDigest = decisionLoaded.digest;
  digestIssue(result, decisionLoaded.digest, input.routingDecisionDigest, 'routingDecisionDigest');
  const decision = decisionLoaded.json;
  if (decision?.artifactKind !== 'evobuddy-routing-decision') addIssue(result, 'fail', 'routing-decision artifactKind must be evobuddy-routing-decision');
  if (decision?.selectionSource !== 'host-model-routing') addIssue(result, 'fail', 'routing-decision selectionSource must be host-model-routing');
  if (decision?.adapterCommandNamedInPrompt !== false) addIssue(result, 'fail', 'routing-decision adapterCommandNamedInPrompt must be false');
  if (input.expectedMemberName && decision?.selectedBuddyName !== input.expectedMemberName && decision?.selectedMemberName !== input.expectedMemberName) addIssue(result, 'fail', 'routing-decision selected Buddy/member mismatch');
  for (const field of ['hostModelTurnRef', 'observedTurnDigest', 'modelOutputRef', 'modelOutputDigest']) {
    if (!nonEmptyString(decision?.[field])) addIssue(result, 'fail', `routing-decision ${field} is required`);
  }
  const anchor = dirname(decisionLoaded.path);
  const turnLoaded = nonEmptyString(decision?.hostModelTurnRef) ? await readJsonRef(decision.hostModelTurnRef, result, 'observed routing turn', 'blocked', anchor) : undefined;
  if (turnLoaded) {
    result.digests.observedTurnDigest = turnLoaded.digest;
    digestIssue(result, turnLoaded.digest, decision.observedTurnDigest, 'observedTurnDigest');
  }
  const modelLoaded = nonEmptyString(decision?.modelOutputRef) ? await readTextRef(decision.modelOutputRef, result, 'routing model output', 'blocked', anchor) : undefined;
  if (modelLoaded) {
    const digest = sha256Text(modelLoaded.raw);
    result.digests.modelOutputDigest = digest;
    digestIssue(result, digest, decision.modelOutputDigest, 'modelOutputDigest');
  }
  return finalize(result);
}

export async function validateEvolutionBuddyProposalProvenance(input = {}) {
  const result = emptyResult();
  let proposal = input.proposal;
  let proposalAnchor = process.cwd();
  if (input.proposalRef) {
    const loaded = await readJsonRef(input.proposalRef, result, 'proposal artifact', 'blocked');
    if (loaded) {
      proposal = loaded.json;
      proposalAnchor = dirname(loaded.path);
      result.digests.proposalDigest = loaded.digest;
      digestIssue(result, loaded.digest, input.proposalDigest, 'proposalDigest');
    }
  } else {
    addIssue(result, 'blocked', 'proposal artifact and proposal digest closure are required');
  }
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return finalize(result);
  if (proposal.proposalSource !== 'evolution-buddy') addIssue(result, 'fail', 'proposalSource must be evolution-buddy');
  for (const field of ['evolutionBuddyRunRef', 'evolutionBuddyRunDigest', 'modelOutputRef', 'modelOutputDigest', 'observedTurnRef', 'observedTurnDigest', 'patchReasoning', 'proposedPatchSummary']) {
    if (!nonEmptyString(proposal[field])) addIssue(result, input.proposalRef ? 'fail' : 'blocked', `proposal ${field} is required`);
  }
  const modelLoaded = nonEmptyString(proposal.modelOutputRef) ? await readTextRef(proposal.modelOutputRef, result, 'proposal model output', 'blocked', proposalAnchor) : undefined;
  if (modelLoaded) digestIssue(result, sha256Text(modelLoaded.raw), proposal.modelOutputDigest, 'proposal model output digest');
  const turnLoaded = nonEmptyString(proposal.observedTurnRef) ? await readTextRef(proposal.observedTurnRef, result, 'proposal observed turn', 'blocked', proposalAnchor) : undefined;
  if (turnLoaded) digestIssue(result, sha256Text(turnLoaded.raw), proposal.observedTurnDigest, 'proposal observed turn digest');
  const runLoaded = nonEmptyString(proposal.evolutionBuddyRunRef) ? await readTextRef(proposal.evolutionBuddyRunRef, result, 'evolution BuddyRun', 'blocked', proposalAnchor) : undefined;
  if (runLoaded) digestIssue(result, sha256Text(runLoaded.raw), proposal.evolutionBuddyRunDigest, 'evolutionBuddyRunDigest');
  return finalize(result);
}

export async function validateAppliedVersionConsumptionProvenance(input = {}) {
  const result = emptyResult();
  const productRoot = input.productRoot ? resolve(input.productRoot) : undefined;
  let observedSecondCall;

  if (input.observedBuddyCallProvenance) {
    const observedInput = productRoot && !input.observedBuddyCallProvenance.productRoot
      ? { ...input.observedBuddyCallProvenance, productRoot: input.productRoot }
      : input.observedBuddyCallProvenance;
    observedSecondCall = await validateObservedBuddyCallProvenance(observedInput);
    mergeResult(result, observedSecondCall, 'secondCall');
  } else {
    addIssue(result, 'fail', 'second observed Buddy call provenance validation is required');
  }

  const summaryRef = input.secondInvokeBuddySummaryRef ?? (productRoot ? join(productRoot, 'invoke-buddy-summary.json') : undefined);
  const summaryLoaded = await readJsonRef(summaryRef, result, 'invoke-buddy-summary', 'fail', productRoot ?? undefined);
  const summary = summaryLoaded?.json;
  if (summary) {
    for (const field of ['materializedBuddyVersion', 'appliedVersionDigest', 'materializedContextRef', 'materializedContextDigest']) {
      if (!nonEmptyString(summary[field])) addIssue(result, 'fail', `invoke-buddy-summary ${field} is required`);
    }
    if (input.appliedVersionDigest && summary.appliedVersionDigest !== input.appliedVersionDigest) addIssue(result, 'fail', 'invoke-buddy-summary appliedVersionDigest must match expected appliedVersionDigest');
    if (!summary.executionResolution) {
      addIssue(result, 'fail', 'invoke-buddy-summary executionResolution is required');
    } else {
      const executionDigest = digestBuddyExecutionResolution(summary.executionResolution);
      result.digests.executionResolutionDigest = executionDigest;
      if (summary.executionResolutionDigest && summary.executionResolutionDigest !== executionDigest) {
        addIssue(result, 'fail', 'invoke-buddy-summary executionResolutionDigest mismatch');
      }
      const executionValidation = validateBuddyExecutionResolution(summary.executionResolution, { requireParentObserved: true });
      mergeResult(result, executionValidation, 'executionResolution');
      const actual = summary.executionResolution.actual;
      if (nonEmptyString(actual?.parentCallEvidenceDigest) && actual.parentCallEvidenceDigest !== observedSecondCall?.digests?.parentCallRecordDigest) {
        addIssue(result, 'fail', 'executionResolution parentCallEvidenceDigest must match observed second parent-call-record digest');
      }
      if (nonEmptyString(actual?.observedTranscriptDigest) && actual.observedTranscriptDigest !== observedSecondCall?.digests?.transcriptDigest) {
        addIssue(result, 'fail', 'executionResolution observedTranscriptDigest must match observed second transcript digest');
      }
      if (summary.executionResolution.actual?.actualSurface === 'runtime-native-subagent' && summary.executionResolution.actual?.nativeSubagent !== true) {
        addIssue(result, 'fail', 'native Buddy execution claim lacks nativeSubagent proof');
      }
    }
  }

  const secondCall = input.secondCall;
  if (!secondCall || typeof secondCall !== 'object' || Array.isArray(secondCall)) {
    addIssue(result, 'fail', 'second observed call is required');
    return finalize(result);
  }
  if (!nonEmptyString(input.appliedVersionDigest)) addIssue(result, 'fail', 'appliedVersionDigest is required');
  const packetRef = input.invocationPacketRef ?? secondCall.invocationPacketRef ?? (productRoot ? join(productRoot, 'member-invocation-packet.json') : undefined);
  if (!nonEmptyString(packetRef)) addIssue(result, 'fail', 'member-invocation-packet.json is required');
  const materializedContextDigest = summary?.materializedContextDigest ?? secondCall.materializedContextDigest ?? input.materializedContextDigest;
  const materializedContextRef = summary?.materializedContextRef ?? secondCall.materializedContextRef ?? input.materializedContextRef ?? (productRoot ? join(productRoot, 'materialized-buddy-context.json') : undefined);
  if (!nonEmptyString(materializedContextDigest)) addIssue(result, 'fail', 'materializedContextDigest is required');
  if (!nonEmptyString(materializedContextRef)) addIssue(result, 'fail', 'materializedContextRef is required');
  if (secondCall.modelVisibleContextDigest !== materializedContextDigest && secondCall.modelVisibleContextRef !== materializedContextRef) addIssue(result, 'fail', 'second call must cite modelVisibleContextDigest or modelVisibleContextRef matching materialized context');
  const observedOutputRef = secondCall.observedOutputRef ?? summary?.outputRef ?? summary?.observedOutputRef;
  if (!nonEmptyString(observedOutputRef)) addIssue(result, 'fail', 'observed second Buddy output must be loaded from artifact ref; inline observedOutputText is not sufficient');
  else await readTextRef(observedOutputRef, result, 'observed second Buddy output', 'fail', summaryLoaded ? dirname(summaryLoaded.path) : (productRoot ?? process.cwd()));

  let secondParentCallRecord = input.secondParentCallRecord;
  const secondParentCallRecordRef = input.secondParentCallRecordRef ?? input.observedBuddyCallProvenance?.parentCallRecordRef;
  if (!secondParentCallRecord && secondParentCallRecordRef) {
    const parentLoaded = await readJsonRef(secondParentCallRecordRef, result, 'second parent-call-record', 'fail', productRoot ?? undefined);
    secondParentCallRecord = parentLoaded?.json;
  }
  if (packetRef) {
    const packet = await readTextRef(packetRef, result, 'member-invocation-packet.json', 'fail', productRoot ?? undefined);
    if (packet) {
      let packetDigest = sha256Text(packet.raw);
      try {
        const parsedPacket = JSON.parse(packet.raw);
        if (nonEmptyString(parsedPacket.invocationPacketDigest)) packetDigest = parsedPacket.invocationPacketDigest;
      } catch {
        // Non-JSON packet refs retain raw byte digest semantics.
      }
      result.digests.invocationPacketDigest = packetDigest;
      const expectedPacketDigest = input.invocationPacketDigest ?? input.secondInvocationPacketDigest;
      if (expectedPacketDigest && packetDigest !== expectedPacketDigest) addIssue(result, 'fail', 'member invocation packet digest mismatch');
      if (secondParentCallRecord?.expectedInputDigest && packetDigest !== secondParentCallRecord.expectedInputDigest) addIssue(result, 'fail', 'member invocation packet digest must match second parent-call expectedInputDigest');
    }
  }
  if (materializedContextRef) {
    const context = await readTextRef(materializedContextRef, result, 'materialized buddy context', 'fail', productRoot ?? undefined);
    if (context) {
      let contextDigest = sha256Text(context.raw);
      try {
        const parsedContext = JSON.parse(context.raw);
        const { materializedContextDigest: _embeddedDigest, ...contextBase } = parsedContext;
        contextDigest = nonEmptyString(parsedContext.materializedContextDigest) ? sha256StableJson(contextBase) : contextDigest;
      } catch {
        // Non-JSON context refs retain raw byte digest semantics.
      }
      digestIssue(result, contextDigest, materializedContextDigest, 'materializedContextDigest');
    }
  }
  return finalize(result);
}

export async function validateObservedBuddyCallExecutionResolution(input = {}) {
  const result = emptyResult();
  const label = input.label ?? 'observedCall';
  const observed = await validateObservedBuddyCallProvenance(input.observedBuddyCallProvenance);
  mergeResult(result, observed, label);
  const summaryLoaded = await readJsonRef(
    input.invokeBuddySummaryRef,
    result,
    `${label} invoke-buddy-summary`,
    'fail',
    input.productRoot ?? undefined,
  );
  const summary = summaryLoaded?.json;
  if (!summary?.executionResolution) {
    addIssue(result, 'fail', `${label} invoke-buddy-summary executionResolution is required`);
    return finalize(result);
  }
  const executionDigest = digestBuddyExecutionResolution(summary.executionResolution);
  if (summary.executionResolutionDigest !== executionDigest) {
    addIssue(result, 'fail', `${label} executionResolutionDigest mismatch`);
  }
  const executionValidation = validateBuddyExecutionResolution(summary.executionResolution, { requireParentObserved: true });
  mergeResult(result, executionValidation, `${label} executionResolution`);
  const actual = summary.executionResolution.actual;
  if (nonEmptyString(actual.parentCallEvidenceDigest) && actual.parentCallEvidenceDigest !== observed.digests.parentCallRecordDigest) {
    addIssue(result, 'fail', `${label} parentCallEvidenceDigest mismatch`);
  }
  if (nonEmptyString(actual.observedTranscriptDigest) && actual.observedTranscriptDigest !== observed.digests.transcriptDigest) {
    addIssue(result, 'fail', `${label} observedTranscriptDigest mismatch`);
  }
  if (actual.actualSurface === 'runtime-native-subagent') {
    if (actual.nativeSubagent !== true) {
      addIssue(result, 'fail', `${label} native Buddy execution claim lacks nativeSubagent proof`);
    }
    if (nonEmptyString(actual.runtimeNativeBuddySurfaceProofRef)) {
      const runtimeProofLoaded = await readJsonRef(
        actual.runtimeNativeBuddySurfaceProofRef,
        result,
        `${label} runtime-native Buddy surface proof`,
        'fail',
        input.productRoot ?? undefined,
      );
      digestIssue(result, runtimeProofLoaded?.digest, actual.runtimeNativeBuddySurfaceProofDigest, `${label} runtimeNativeBuddySurfaceProofDigest`);
      if (runtimeProofLoaded) {
        const runtimeValidation = validateRuntimeNativeBuddySurfaceProof(runtimeProofLoaded.json);
        mergeResult(result, runtimeValidation, `${label} runtimeNativeBuddySurfaceProof`);
        const proof = runtimeValidation.proof;
        if (runtimeValidation.status === 'pass') {
          if (proof.actualSurface !== 'runtime-native-subagent') addIssue(result, 'fail', `${label} runtime-native proof actualSurface mismatch`);
          if (proof.memberName !== summary.memberName && proof.memberName !== summary.buddyName) addIssue(result, 'fail', `${label} runtime-native proof memberName mismatch`);
          if (input.requireNaturalUseProof === true && proof.naturalUsePass !== true) addIssue(result, 'fail', `${label} runtime-native proof must be naturalUse for release semantics; got ${proof.proofLayer}`);
        }
      }
    } else {
      const proofLoaded = await readJsonRef(
        actual.nativeBuddyTaskProofRef,
        result,
        `${label} native Buddy task proof`,
        'fail',
        input.productRoot ?? undefined,
      );
      digestIssue(result, proofLoaded?.digest, actual.nativeBuddyTaskProofDigest, `${label} nativeBuddyTaskProofDigest`);
      if (proofLoaded) {
      const proofValidation = validateOpenCodeNativeBuddyTaskProof(proofLoaded.json);
      mergeResult(result, proofValidation, `${label} nativeBuddyTaskProof`);
      if (proofLoaded.json.parentCallEvidenceDigest && proofLoaded.json.parentCallEvidenceDigest !== observed.digests.parentCallRecordDigest) {
        addIssue(result, 'fail', `${label} native Buddy task proof parentCallEvidenceDigest mismatch`);
      }
      if (proofLoaded.json.observedTranscriptDigest && proofLoaded.json.observedTranscriptDigest !== observed.digests.transcriptDigest) {
        addIssue(result, 'fail', `${label} native Buddy task proof observedTranscriptDigest mismatch`);
      }
    }
    }
  }
  return finalize(result);
}

function mergeResult(target, source, prefix) {
  for (const issue of source.issues ?? []) target.issues.push(prefix ? `${prefix}: ${issue}` : issue);
  target.blockedReasons.push(...(source.blockedReasons ?? []));
  target.failedReasons.push(...(source.failedReasons ?? []));
  target.evidenceRefs.push(...(source.evidenceRefs ?? []));
  Object.assign(target.digests, source.digests ?? {});
}

export function validateEvobuddyProductLoopProvenance(input = {}) {
  const result = emptyResult();
  if (input.firstObservedBuddyCallProvenance && !input.firstCallExecutionResolution) {
    addIssue(result, 'blocked', 'first-call executionResolution validation result is required when first observed Buddy provenance is provided');
  }
  for (const [name, value] of Object.entries({ firstCall: input.firstCall, proposal: input.proposal, appliedVersionConsumption: input.appliedVersionConsumption })) {
    if (!value) {
      addIssue(result, 'blocked', `${name} provenance result is required`);
      continue;
    }
    mergeResult(result, value, name);
  }
  if (input.firstCallExecutionResolution) mergeResult(result, input.firstCallExecutionResolution, 'firstCallExecutionResolution');
  if (input.routingDecision) mergeResult(result, input.routingDecision, 'routingDecision');
  else if (input.requireRoutingDecision === true) addIssue(result, 'blocked', 'routingDecision provenance result is required');
  return finalize(result);
}
