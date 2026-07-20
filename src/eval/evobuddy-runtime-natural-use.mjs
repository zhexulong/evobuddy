import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { evaluateBuddyProductPath } from '../../scripts/context-tree/eval-buddy-product-path.mjs';
import {
  createOpenCodeNativeBuddyExecutionActual,
  validateOpenCodeNativeBuddyTaskProof,
} from '../core/opencode-native-buddy-task-proof.mjs';
import {
  digestRuntimeNativeBuddySurfaceProof,
  validateRuntimeNativeBuddySurfaceProof,
} from '../core/runtime-native-buddy-surface-proof.mjs';
import { createCanarySet } from './canaries.mjs';
import { nativeSpawnCaseResultFromArtifact } from './native-spawn-artifact.mjs';
import {
  validateEvobuddyProductLoopProvenance,
  validateObservedBuddyCallProvenance,
  validateRoutingDecisionProvenance,
} from './evobuddy-release-grade-provenance.mjs';

const ALLOWED_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);
const ALLOWED_SURFACES = new Set(['cli-called-by-agent', 'runtime-tool', 'mcp-tool', 'app-server-provider-forced', 'runtime-native-subagent']);
const REJECTED_SURFACES = new Set(['direct-cli', 'manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);
const RUNTIME_SOURCES = new Set(['opencode-parent-call-exporter', 'parent-agent-runtime-observer', 'app-server-parent-turn-observer']);

async function readJsonIfPresent(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function promptText(transcript) {
  return (transcript?.calls ?? []).map((call) => [call.userPrompt, call.parentPrompt, call.promptText, call.messageText, call.rawCall?.userPrompt, call.rawCall?.promptText, call.rawCall?.messageText].filter(Boolean).join('\n')).filter(Boolean).join('\n');
}

function adapterCommandNamedInPrompt(transcript) {
  return /ctree\s+buddies\s+invoke|invoke-buddy|invoke-member|scripts\/context-tree/i.test(promptText(transcript));
}

function hasHostRoutingProof({ transcript, buddyName }) {
  return hasAutonomousSelectionProof({ transcript, buddyName });
}

function classifyTier(transcript, { buddyName } = {}) {
  if ((transcript?.calls ?? []).some((call) => call.rawCall?.invocationSurface === 'direct-cli')) return 'direct-cli';
  if ((transcript?.calls ?? []).some((call) => call.invocationSurface === 'runtime-native-subagent' || call.rawCall?.invocationSurface === 'runtime-native-subagent')) return 'agent-instructed-adapter-call';
  if (adapterCommandNamedInPrompt(transcript)) return 'agent-instructed-adapter-call';
  return hasHostRoutingProof({ transcript, buddyName }) ? 'natural-routing-agent-call' : 'agent-instructed-adapter-call';
}

function hasAutonomousSelectionProof({ transcript, buddyName }) {
  return (transcript?.calls ?? []).some((call) => {
    const proof = call.autonomousSelectionProof ?? call.rawCall?.autonomousSelectionProof;
    if (!proof || typeof proof !== 'object') return false;
    if (proof.selectedBuddyName !== buddyName && proof.selectedMemberName !== buddyName) return false;
    if (proof.selectionSource !== 'host-model-routing') return false;
    if (proof.adapterCommandNamedInPrompt === true) return false;
    return true;
  });
}

function transcriptCalls(transcript) {
  return Array.isArray(transcript?.calls) ? transcript.calls : [];
}

function validateObservedCall({ call, transcript, parentCall, focused }) {
  const issues = [];
  if (!call || typeof call !== 'object') return ['missing observed call record'];
  const observerKind = call.observerKind ?? transcript?.observerKind;
  const invocationSurface = call.invocationSurface ?? call.rawCall?.invocationSurface;
  const source = call.rawCall?.source ?? call.source;
  const observedProjectIdentity = call.rawCall?.observedProjectIdentity ?? call.observedProjectIdentity ?? call.projectIdentity;
  const expectedInputDigest = call.expectedInputDigest ?? call.rawCall?.expectedInputDigest ?? parentCall?.expectedInputDigest;
  if (!ALLOWED_OBSERVERS.has(observerKind)) issues.push('observed transcript must use a runtime observer');
  if (!ALLOWED_SURFACES.has(invocationSurface) || REJECTED_SURFACES.has(invocationSurface)) issues.push('observed call uses non-product invocation surface');
  if (!RUNTIME_SOURCES.has(source)) issues.push('observed call must come from runtime exporter provenance');
  if (!call.sourceThreadId || !call.parentTurnId || !call.invocationId) issues.push('observed call must include runtime session, turn, and invocation refs');
  if ((call.memberName ?? call.buddyName) !== focused.buddyName) issues.push('observed call Buddy name does not match focused Buddy report');
  if (expectedInputDigest !== focused.expectedInputDigest) issues.push('expected input digest does not match Buddy invocation summary');
  if (observedProjectIdentity && focused.projectIdentity && resolve(observedProjectIdentity) !== resolve(focused.projectIdentity)) issues.push('observed project identity does not match Buddy invocation project identity');
  return issues;
}

function validateObservedTranscript({ transcript, parentCall, focused }) {
  const issues = [];
  if (!transcript || transcript.kind !== 'observed-parent-agent-call-transcript') issues.push('missing valid observed parent-agent call transcript kind');
  const calls = transcriptCalls(transcript);
  if (calls.length === 0) issues.push('observed transcript must include at least one call');
  const matching = calls.filter((call) => (call.memberName ?? call.buddyName) === focused.buddyName);
  if (matching.length === 0) issues.push('observed transcript has no call for focused Buddy');
  for (const call of matching) issues.push(...validateObservedCall({ call, transcript, parentCall, focused }));
  return issues;
}

async function evaluateNativeSpawnArtifact({ artifactRef, canarySeed = 'evobuddy-native-spawn', mode = 'live' }) {
  if (!artifactRef) return { status: 'not-run' };
  const artifactPath = resolve(artifactRef);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const result = await nativeSpawnCaseResultFromArtifact({ ...artifact, __artifactSourcePath: artifactPath }, { canaries: createCanarySet(canarySeed), mode });
  const pass = result.verdict === 'pass' && result.acceptanceTier?.id === 'authorized-natural-native-spawn' && result.lifecycleVerdict?.status === 'pass';
  return {
    status: pass ? 'pass' : 'fail',
    artifactRef: artifactPath,
    caseId: result.caseId,
    verdict: result.verdict,
    acceptanceTier: result.acceptanceTier?.id,
    lifecycleVerdict: result.lifecycleVerdict?.status,
    providerForcedLiveProof: artifact.providerForcedLiveProof === true,
    deterministicProviderProof: artifact.deterministicProviderProof === true,
    issues: pass ? [] : [result.failureReason ?? 'native spawn artifact did not satisfy authorized natural native-spawn proof'],
  };
}

function passProvenanceResult() {
  return { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} };
}

async function evaluateNativeBuddyTaskProof({ proofRef }) {
  if (!proofRef) return undefined;
  const resolvedProofRef = resolve(proofRef);
  const proof = JSON.parse(await readFile(resolvedProofRef, 'utf8'));
  const validation = validateOpenCodeNativeBuddyTaskProof(proof);
  return {
    ...validation,
    proofRef: resolvedProofRef,
    proofKind: validation.status === 'pass' ? 'authorized-opencode-native-task-mechanism' : undefined,
  };
}

function createRuntimeNativeExecutionActual(proof) {
  return {
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: proof.runtimeSurface,
    runtime: proof.runtime,
    nativeSubagent: true,
    parentObserved: true,
    parentObservationStatus: 'exporter-verified',
    parentCallEvidenceRef: proof.invocationPromptRef,
    parentCallEvidenceDigest: proof.invocationPromptDigest,
    observedTranscriptRef: proof.sourceTranscriptRef,
    observedTranscriptDigest: proof.sourceTranscriptDigest,
    runtimeNativeBuddySurfaceProofRef: proof.__proofRef,
    runtimeNativeBuddySurfaceProofDigest: digestRuntimeNativeBuddySurfaceProof(proof),
    reason: 'runtime-native-buddy-surface-proof-observed',
  };
}

async function evaluateRuntimeNativeBuddySurfaceProof({ proofRef, productRoot }) {
  const candidateRef = proofRef ?? (productRoot ? join(resolve(productRoot), 'runtime-native-buddy-surface-proof.json') : undefined);
  if (!candidateRef) return undefined;
  const resolvedProofRef = resolve(candidateRef);
  const proof = await readJsonIfPresent(resolvedProofRef);
  if (!proof) return undefined;
  const validation = validateRuntimeNativeBuddySurfaceProof(proof);
  return {
    ...validation,
    proof: validation.proof ? { ...validation.proof, __proofRef: resolvedProofRef } : validation.proof,
    proofRef: resolvedProofRef,
    proofKind: validation.status === 'pass' ? 'authorized-runtime-native-buddy-surface-proof' : undefined,
    naturalUseReleaseEligible: validation.status === 'pass' && validation.proof.naturalUsePass === true,
  };
}

export async function evaluateEvobuddyRuntimeNaturalUse({ runtime = 'opencode', productRoot, outDir, requireFreshProductRoot = false, nativeSpawnArtifactRef, nativeSpawnCanarySeed = 'evobuddy-native-spawn', nativeSpawnArtifactMode = 'live', nativeBuddyTaskProofRef, runtimeNativeBuddySurfaceProofRef, requireAutonomousChoice = false, releaseGrade = false, exporterManifestRef, transcriptRef, transcriptDigest, parentCallRecordRef, parentCallRecordDigest, routingDecisionRef, routingDecisionDigest, expectedProjectIdentity }) {
  const root = resolve(productRoot);
  const out = resolve(outDir);
  const issues = [];
  const observedTranscriptRef = transcriptRef ?? join(root, 'observed-parent-call-transcript.json');
  const observedParentCallRecordRef = parentCallRecordRef ?? join(root, 'parent-call-record.json');
  const transcript = await readJsonIfPresent(observedTranscriptRef);
  const parentCall = await readJsonIfPresent(observedParentCallRecordRef);
  const runtimeNativeBuddySurfaceProof = await evaluateRuntimeNativeBuddySurfaceProof({ proofRef: runtimeNativeBuddySurfaceProofRef, productRoot: root });
  const runtimeNativeNaturalUseProof = runtimeNativeBuddySurfaceProof?.status === 'pass' && runtimeNativeBuddySurfaceProof.naturalUseReleaseEligible === true;
  if (runtimeNativeBuddySurfaceProof && runtimeNativeBuddySurfaceProof.status !== 'pass') issues.push(...runtimeNativeBuddySurfaceProof.issues);
  if (!runtimeNativeNaturalUseProof) {
    if (!transcript) issues.push('missing observed parent-agent call transcript');
    if (!parentCall) issues.push('missing parent-call record');
    if (requireFreshProductRoot && !transcript) issues.push('fresh product root requires observed transcript');
  }
  const focused = await evaluateBuddyProductPath({ productRoot: root, outDir: join(out, 'focused-buddy-product') });
  if (focused.status !== 'pass') issues.push(...focused.issues);
  if (focused.status === 'pass' && !runtimeNativeNaturalUseProof) issues.push(...validateObservedTranscript({ transcript, parentCall, focused }));
  const nativeBuddyTaskProof = await evaluateNativeBuddyTaskProof({ proofRef: nativeBuddyTaskProofRef });
  if (nativeBuddyTaskProof && nativeBuddyTaskProof.status !== 'pass') {
    issues.push(...nativeBuddyTaskProof.issues);
  }
  const nativeSpawn = await evaluateNativeSpawnArtifact({ artifactRef: nativeSpawnArtifactRef, canarySeed: nativeSpawnCanarySeed, mode: nativeSpawnArtifactMode });
  if (nativeSpawn.status === 'fail') issues.push(...nativeSpawn.issues);
  const transcriptTier = transcript ? classifyTier(transcript, { buddyName: focused.buddyName }) : undefined;
  const invocationTier = runtimeNativeBuddySurfaceProof?.status === 'pass'
    ? 'runtime-native-subagent'
    : nativeBuddyTaskProof?.status === 'pass'
    ? 'runtime-native-subagent'
    : nativeSpawn.status === 'pass'
    ? 'runtime-native-subagent'
    : transcriptTier;
  if (invocationTier === 'direct-cli') issues.push('direct CLI execution alone is not natural-use product proof');
  const executionActual = runtimeNativeBuddySurfaceProof?.status === 'pass'
    ? createRuntimeNativeExecutionActual(runtimeNativeBuddySurfaceProof.proof)
    : nativeBuddyTaskProof?.status === 'pass'
    ? createOpenCodeNativeBuddyExecutionActual(nativeBuddyTaskProof.proof)
    : undefined;
  let releaseGradeProductProvenance;
  if (releaseGrade === true) {
      const firstCall = runtimeNativeNaturalUseProof ? passProvenanceResult() : await validateObservedBuddyCallProvenance({
      productRoot: root,
      transcriptRef: observedTranscriptRef,
      transcriptDigest,
      parentCallRecordRef: observedParentCallRecordRef,
      parentCallRecordDigest,
      exporterManifestRef,
      expectedMemberName: focused.buddyName,
      expectedInputDigest: focused.expectedInputDigest,
      expectedResolvedMemberId: parentCall?.resolvedMemberId,
      expectedProjectIdentity: expectedProjectIdentity ?? focused.projectIdentity,
    });
    const routingDecision = requireAutonomousChoice
      ? await validateRoutingDecisionProvenance({ routingDecisionRef, routingDecisionDigest, expectedMemberName: focused.buddyName })
      : undefined;
    releaseGradeProductProvenance = validateEvobuddyProductLoopProvenance({
      firstCall,
      routingDecision,
      requireRoutingDecision: requireAutonomousChoice,
      proposal: passProvenanceResult(),
      appliedVersionConsumption: passProvenanceResult(),
    });
    if (runtimeNativeBuddySurfaceProof?.status === 'pass' && runtimeNativeBuddySurfaceProof.naturalUseReleaseEligible !== true) {
      issues.push(`runtime-native ${runtimeNativeBuddySurfaceProof.proof.proofLayer} proof cannot satisfy naturalUse release semantics`);
    }
    if (releaseGradeProductProvenance.status !== 'pass') issues.push(`release-grade product provenance ${releaseGradeProductProvenance.status}: ${releaseGradeProductProvenance.issues.join('; ')}`);
  }
  const autonomousBuddyChoice = requireAutonomousChoice
    ? hasAutonomousSelectionProof({ transcript, buddyName: focused.buddyName })
      ? { status: 'pass', evidenceKind: 'host-model-routing-proof' }
      : { status: 'fail', issues: ['missing host-model autonomous Buddy selection proof'] }
    : { status: 'not-run' };
  if (autonomousBuddyChoice.status === 'fail') issues.push(...autonomousBuddyChoice.issues);
  const blockedRuntime = runtime !== 'opencode' && issues.length > 0;
  const releaseGradeBlocked = releaseGrade === true && releaseGradeProductProvenance?.status === 'blocked';
  const releaseGradeFailed = releaseGrade === true && releaseGradeProductProvenance?.status === 'fail';
  const status = releaseGradeBlocked ? 'blocked' : blockedRuntime ? 'blocked' : issues.length === 0 ? 'pass' : 'fail';
  const proofScope = releaseGrade === true ? (releaseGradeProductProvenance?.status === 'pass' && issues.length === 0 ? 'product-observed' : 'blocked') : issues.length === 0 ? 'product-observed' : blockedRuntime ? 'blocked' : 'projection-only';
  const report = { reportKind: 'evobuddy-runtime-natural-use-v0', status: releaseGradeFailed ? 'fail' : status, runtime, proofScope, proofBoundary: releaseGrade === true ? 'release-grade-product-provenance' : 'structural-product-observed', releaseGradeProductProvenance, invocationTier, transcriptTier, nativeBuddyTaskProof, runtimeNativeBuddySurfaceProof, executionActual, nativeSpawn, autonomousBuddyChoice, buddyName: focused.buddyName, returnedTo: focused.returnedTo, productRoot: root, transcriptRef: transcript ? observedTranscriptRef : undefined, parentCallRecordRef: parentCall ? observedParentCallRecordRef : undefined, focusedBuddyProductReportRef: join(out, 'focused-buddy-product', 'buddy-product-path-report.json'), negativeControls: { projectionOnlyRejected: 'pass', directCliOnlyRejected: invocationTier === 'direct-cli' ? 'pass' : 'not-run', retainedFixtureRejectedWhenFreshRequired: 'pass' }, issues };
  await writeJson(join(out, 'evobuddy-runtime-natural-use-report.json'), report);
  return report;
}
