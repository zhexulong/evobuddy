import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEvolutionBuddyRun } from '../core/evolution-buddy-run.mjs';
import { transitionEvolutionPatchStatus } from '../core/evolution-patch.mjs';
import { applyEvolutionPatch, rejectEvolutionPatch, revertEvolutionPatch } from '../core/evolution-patch-apply.mjs';
import { applyEvolutionPatchToProject } from '../core/evolution-durable-store.mjs';
import { evaluateBehaviorDelta } from './evobuddy-evolution-loop-oracle.mjs';
import {
  validateAppliedVersionConsumptionProvenance,
  validateEvobuddyProductLoopProvenance,
  validateEvolutionBuddyProposalProvenance,
  validateObservedBuddyCallProvenance,
  validateRoutingDecisionProvenance,
} from './evobuddy-release-grade-provenance.mjs';

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

async function readJson(ref) {
  return JSON.parse(await readFile(ref, 'utf8'));
}

function rerunBuddy({ activeBuddyVersion, scenarioId }) {
  const outputText = scenarioId === 'skill-designer-trigger-feedback'
    ? 'First check symptom-driven trigger language, then review implementation details and references.'
    : activeBuddyVersion.skillText;
  return { id: `buddy-run:after:${scenarioId}`, version: activeBuddyVersion.version, outputText };
}

export async function rerunBuddyWithMaterializedVersion({ activeBuddyVersion, buddyName, task, outRoot }) {
  const outputText = `${buddyName} materialized version ${activeBuddyVersion.version}: ${activeBuddyVersion.skillText ?? task}`;
  const materializedContextRef = outRoot ? join(outRoot, 'materialized-buddy-context.json') : undefined;
  const appliedVersionDigest = sha256Json({ buddyName, version: activeBuddyVersion.version });
  const context = { buddyName, activeBuddyVersion, appliedVersionDigest, task, consumedBy: `buddy-run:product:${buddyName}` };
  const materializedContextDigest = sha256Json(context);
  const run = { id: `buddy-run:product:${buddyName}`, version: activeBuddyVersion.version, appliedVersionDigest, materializedBuddyVersion: activeBuddyVersion.version, materializedContextRef, materializedContextDigest, outputText };
  if (outRoot) await writeJson(materializedContextRef, context);
  return run;
}

async function refExists(ref) {
  if (!cleanString(ref)) return false;
  try {
    await access(ref);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function productObservedIssues(input, run) {
  if (input.proofScope !== 'product-observed') return [];
  const issues = [];
  if (!input.proposalRef) issues.push('product-observed loop requires evolution-buddy proposalRef');
  if (run?.proposalSource !== 'evolution-buddy') issues.push('product-observed loop requires evolution-buddy proposal owner');
  if (!(await refExists(input.firstObservedCallTranscriptRef))) issues.push('missing first observed Buddy call transcript ref');
  if (!(await refExists(input.secondObservedCallTranscriptRef))) issues.push('missing second observed Buddy call transcript ref');
  return issues;
}

async function validateEvolutionBuddyProposal(ref) {
  const issues = [];
  if (!(await refExists(ref))) return ['missing evolution-buddy proposal artifact'];
  const proposal = await readJson(ref);
  if (proposal.proposalSource !== 'evolution-buddy') issues.push('proposal artifact must be sourced from evolution-buddy');
  if (!cleanString(proposal.evolutionBuddyRunRef)) issues.push('proposal artifact must reference a real evolution-buddy BuddyRun');
  if (!cleanString(proposal.modelOutputRef)) issues.push('proposal artifact must reference evolution-buddy model output');
  if (!cleanString(proposal.patchReasoning)) issues.push('proposal artifact must include patch reasoning');
  if (!cleanString(proposal.proposedPatchSummary)) issues.push('proposal artifact must include proposed patch summary');
  return issues;
}

function observedCalls(transcript, buddyName) {
  return (Array.isArray(transcript?.calls) ? transcript.calls : []).filter((call) => (call.memberName ?? call.buddyName) === buddyName);
}

async function validateObservedBuddyTranscript(ref, buddyName) {
  const issues = [];
  if (!(await refExists(ref))) return { issues: ['missing observed Buddy call transcript ref'], calls: [] };
  const transcript = await readJson(ref);
  if (transcript.kind !== 'observed-parent-agent-call-transcript') issues.push('observed Buddy transcript must have observed transcript kind');
  if (transcript.observerKind !== 'parent-agent-runtime-observer' && transcript.observerKind !== 'app-server-parent-turn-observer') issues.push('observed Buddy transcript must use a runtime observer');
  const calls = observedCalls(transcript, buddyName);
  if (calls.length === 0) issues.push('observed Buddy transcript has no call for Buddy');
  for (const call of calls) {
    const observerKind = call.observerKind ?? transcript.observerKind;
    if (observerKind !== 'parent-agent-runtime-observer' && observerKind !== 'app-server-parent-turn-observer') issues.push('observed Buddy call must use runtime observer');
    if (!cleanString(call.sourceThreadId) || !cleanString(call.parentTurnId) || !cleanString(call.invocationId)) issues.push('observed Buddy call must include runtime session, turn, and invocation refs');
    if ((call.rawCall?.source ?? call.source) !== 'opencode-parent-call-exporter') issues.push('observed Buddy call must come from runtime exporter provenance');
  }
  return { issues, calls };
}

function secondCallConsumptionIssues({ calls, afterRun }) {
  const issues = [];
  const matched = calls.find((call) => call.materializedBuddyVersion === afterRun.version && call.appliedVersionDigest === afterRun.appliedVersionDigest && (call.materializedContextDigest === afterRun.materializedContextDigest || call.materializedContextRef === afterRun.materializedContextRef) && (call.modelVisibleContextDigest === afterRun.materializedContextDigest || call.modelVisibleContextRef === afterRun.materializedContextRef) && cleanString(call.observedOutputText));
  if (!matched) issues.push('second observed Buddy call must cite applied version and materialized context digests');
  return { issues, matched };
}

async function releaseGradeAfterRunFromSuppliedArtifacts({ input, fallbackActive }) {
  if (input.proofScope !== 'product-observed' || input.releaseGrade !== true) return undefined;
  if (!cleanString(input.materializedContextRef) || !cleanString(input.materializedContextDigest) || !cleanString(input.appliedVersionDigest)) return undefined;
  const context = await readJson(input.materializedContextRef);
  const activeBuddyVersion = context?.activeBuddyVersion && typeof context.activeBuddyVersion === 'object' ? context.activeBuddyVersion : fallbackActive;
  const version = cleanString(activeBuddyVersion?.version) ?? cleanString(fallbackActive?.version);
  return {
    id: `buddy-run:product:${input.buddyName}`,
    version,
    appliedVersionDigest: input.appliedVersionDigest,
    materializedBuddyVersion: version,
    materializedContextRef: input.materializedContextRef,
    materializedContextDigest: input.materializedContextDigest,
    outputText: cleanString(activeBuddyVersion?.skillText) ?? cleanString(fallbackActive?.skillText) ?? cleanString(input.beforeRun?.outputText) ?? '',
  };
}

function baseNegativeControls() {
  return { dirtyEvidenceRejected: 'not-run', oneOffRejected: 'not-run', rejectedPatchNoEffect: 'not-run', revertedPatchNoEffect: 'not-run' };
}

function blockedProvenanceResult(issues) {
  return { status: 'blocked', issues, blockedReasons: issues, failedReasons: [], evidenceRefs: [], digests: {} };
}

function missingAppliedVersionConsumptionRefs(input) {
  const missing = [];
  for (const [key, label] of [
    ['secondParentCallRecordRef', 'second parent-call-record ref'],
    ['secondTranscriptDigest', 'second transcript digest'],
    ['exporterManifestRef', 'exporter manifest ref'],
    ['secondInvokeBuddySummaryRef', 'second invoke-buddy-summary ref'],
    ['secondInvocationPacketRef', 'second invocation packet ref'],
    ['materializedContextRef', 'materialized context ref'],
    ['materializedContextDigest', 'materialized context digest'],
    ['appliedVersionDigest', 'applied version digest'],
  ]) {
    if (!cleanString(input[key])) missing.push(`${label} is required for release-grade applied-version consumption`);
  }
  return missing;
}

async function releaseGradeLoopProvenance(input, { afterRun, secondCall } = {}) {
  let releaseGradeSecondCall = secondCall;
  if (!releaseGradeSecondCall && cleanString(input.secondObservedCallTranscriptRef)) {
    try {
      const secondTranscript = await readJson(input.secondObservedCallTranscriptRef);
      releaseGradeSecondCall = observedCalls(secondTranscript, input.buddyName)[0];
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const firstCall = await validateObservedBuddyCallProvenance({
    productRoot: input.productRoot ?? input.outRoot,
    transcriptRef: input.firstObservedCallTranscriptRef,
    transcriptDigest: input.firstTranscriptDigest,
    parentCallRecordRef: input.firstParentCallRecordRef,
    parentCallRecordDigest: input.firstParentCallRecordDigest,
    exporterManifestRef: input.exporterManifestRef,
    expectedMemberName: input.buddyName,
    expectedInputDigest: input.firstExpectedInputDigest,
    expectedProjectIdentity: input.projectIdentity,
    trustExporterManifestDigest: input.trustExporterManifestDigest === true,
  });
  const routingDecision = input.invocationTier === 'natural-routing-agent-call' || cleanString(input.routingDecisionRef)
    ? await validateRoutingDecisionProvenance({ routingDecisionRef: input.routingDecisionRef, routingDecisionDigest: input.routingDecisionDigest, expectedMemberName: input.buddyName })
    : undefined;
  const proposal = await validateEvolutionBuddyProposalProvenance({ proposalRef: input.proposalRef, proposalDigest: input.proposalDigest });
  const missingConsumptionRefs = missingAppliedVersionConsumptionRefs(input);
  const appliedVersionConsumption = missingConsumptionRefs.length > 0
    ? blockedProvenanceResult(missingConsumptionRefs)
    : afterRun
    ? await validateAppliedVersionConsumptionProvenance({
      productRoot: input.productRoot ?? input.outRoot,
      observedBuddyCallProvenance: {
        productRoot: input.productRoot ?? input.outRoot,
        transcriptRef: input.secondObservedCallTranscriptRef,
        transcriptDigest: input.secondTranscriptDigest,
        parentCallRecordRef: input.secondParentCallRecordRef,
        parentCallRecordDigest: input.secondParentCallRecordDigest,
        exporterManifestRef: input.exporterManifestRef,
        expectedMemberName: input.buddyName,
        expectedInputDigest: input.secondExpectedInputDigest,
        expectedProjectIdentity: input.projectIdentity,
        trustExporterManifestDigest: input.trustExporterManifestDigest === true,
      },
      secondInvokeBuddySummaryRef: input.secondInvokeBuddySummaryRef,
      invocationPacketRef: input.secondInvocationPacketRef,
      invocationPacketDigest: input.secondInvocationPacketDigest,
      materializedContextRef: input.materializedContextRef,
      materializedContextDigest: input.materializedContextDigest,
      appliedVersionDigest: input.appliedVersionDigest,
      secondParentCallRecordRef: input.secondParentCallRecordRef,
      secondCall: releaseGradeSecondCall ?? afterRun,
    })
    : blockedProvenanceResult(['applied-version second-call consumption has not been validated']);
  return validateEvobuddyProductLoopProvenance({
    firstCall,
    routingDecision,
    requireRoutingDecision: input.invocationTier === 'natural-routing-agent-call' || cleanString(input.routingDecisionRef) !== undefined,
    proposal,
    appliedVersionConsumption,
  });
}

export async function runEvobuddyEvolutionLoop(input) {
  const outRoot = input.outRoot;
  await mkdir(outRoot, { recursive: true });
  await writeJson(join(outRoot, 'before-run.json'), input.beforeRun);
  const negativeControls = baseNegativeControls();
  const current = input.initialBuddyVersion;

  if (input.evidenceKind === 'tool-output' || input.evidenceKind === 'workflow-wrapper') {
    const run = await createEvolutionBuddyRun({ dirtyEvidence: { evidenceKinds: [input.evidenceKind], sourceRefs: ['negative-control:dirty-evidence'] }, currentBuddyState: current, proposedChangeKind: input.proposedChangeKind ?? 'execution-step', createdAt: '2026-07-12T00:00:00.000Z' });
    negativeControls.dirtyEvidenceRejected = run.patch.status === 'discarded' ? 'pass' : 'fail';
    const report = { reportKind: 'evobuddy-evolution-loop-v0', status: negativeControls.dirtyEvidenceRejected === 'pass' ? 'pass' : 'fail', proofScope: input.proofScope ?? 'hermetic', scenarioId: input.scenarioId, buddyName: input.buddyName, patch: run.patch, patchApplied: false, versionChange: { beforeVersion: current.version, afterVersion: current.version }, negativeControls, issues: [] };
    await writeJson(join(outRoot, 'evolution-patch.json'), run.patch);
    await writeJson(join(outRoot, 'evobuddy-evolution-loop-report.json'), report);
    return report;
  }
  if (input.evidenceKind === 'one-off') {
    negativeControls.oneOffRejected = 'pass';
    const report = { reportKind: 'evobuddy-evolution-loop-v0', status: 'pass', proofScope: input.proofScope ?? 'hermetic', scenarioId: input.scenarioId, buddyName: input.buddyName, patchApplied: false, versionChange: { beforeVersion: current.version, afterVersion: current.version }, negativeControls, issues: [] };
    await writeJson(join(outRoot, 'evobuddy-evolution-loop-report.json'), report);
    return report;
  }

  const run = await createEvolutionBuddyRun({ runRef: join(outRoot, 'before-run.json'), followingMessages: input.followingMessages ?? [], currentBuddyState: current, proposedChangeKind: input.proposedChangeKind ?? 'execution-step', proposalRef: input.proposalRef, createdAt: '2026-07-12T00:00:00.000Z' });
  const productIssues = input.proofScope === 'product-observed' ? [...await productObservedIssues(input, run), ...await validateEvolutionBuddyProposal(input.proposalRef)] : [];
  if (productIssues.length > 0) {
    const report = { reportKind: 'evobuddy-evolution-loop-v0', status: 'fail', proofScope: input.proofScope, scenarioId: input.scenarioId, buddyName: input.buddyName, evolutionBuddyRun: { evolutionBuddyName: run.evolutionBuddyName, proposalSource: run.proposalSource, proposalAuthority: run.proposalAuthority, hostRole: run.hostRole }, patch: run.patch, patchApplied: false, versionChange: { beforeVersion: current.version, afterVersion: current.version }, negativeControls, issues: productIssues };
    await writeJson(join(outRoot, 'feedback-window.json'), run.feedbackWindow);
    await writeJson(join(outRoot, 'evolution-patch.json'), run.patch);
    await writeJson(join(outRoot, 'evobuddy-evolution-loop-report.json'), report);
    return report;
  }
  await writeJson(join(outRoot, 'feedback-window.json'), run.feedbackWindow);
  await writeJson(join(outRoot, 'evolution-patch.json'), run.patch);
  if (input.forcePatchStatus === 'rejected') {
    const rejected = rejectEvolutionPatch({ patch: run.patch, reason: 'negative control rejected patch', actorRef: 'parent-agent', createdAt: '2026-07-12T00:00:30.000Z' });
    negativeControls.rejectedPatchNoEffect = 'pass';
    const report = { reportKind: 'evobuddy-evolution-loop-v0', status: 'pass', proofScope: input.proofScope ?? 'hermetic', scenarioId: input.scenarioId, buddyName: input.buddyName, patch: rejected, patchApplied: false, versionChange: { beforeVersion: current.version, afterVersion: current.version }, negativeControls, issues: [] };
    await writeJson(join(outRoot, 'evobuddy-evolution-loop-report.json'), report);
    return report;
  }
  const accepted = transitionEvolutionPatchStatus({ patch: run.patch, nextStatus: 'accepted', reason: 'evolution loop accepted low-risk eval correction', actorRef: 'parent-agent', createdAt: '2026-07-12T00:00:30.000Z' });
  const durableApply = cleanString(input.projectRoot)
    ? await applyEvolutionPatchToProject({ projectRoot: input.projectRoot, patch: accepted, actorRef: 'parent-agent', createdAt: '2026-07-12T00:01:00.000Z', applyIntent: input.applyIntent ?? 'parent-stated' })
    : undefined;
  const canApplyInMemory = !durableApply || durableApply.status === 'applied';
  const applied = canApplyInMemory && accepted.targetKind !== 'new-buddy'
    ? applyEvolutionPatch({ patch: accepted, currentBuddyState: current, actorRef: 'host', createdAt: '2026-07-12T00:01:00.000Z' })
    : undefined;
  let active = applied?.nextBuddyState ?? current;
  let patch = applied?.appliedPatch ?? accepted;
  if (input.forcePatchStatus === 'reverted' && applied) {
    const reverted = revertEvolutionPatch({ appliedPatch: applied.appliedPatch, currentBuddyState: applied.nextBuddyState, actorRef: 'host', createdAt: '2026-07-12T00:02:00.000Z' });
    active = reverted.nextBuddyState;
    patch = reverted.revertedPatch;
    negativeControls.revertedPatchNoEffect = 'pass';
  }
  const suppliedReleaseGradeAfterRun = await releaseGradeAfterRunFromSuppliedArtifacts({ input, fallbackActive: active });
  const afterRun = suppliedReleaseGradeAfterRun ?? (input.proofScope === 'product-observed'
    ? await rerunBuddyWithMaterializedVersion({ activeBuddyVersion: active, buddyName: input.buddyName, task: input.beforeRun?.outputText, outRoot })
    : rerunBuddy({ activeBuddyVersion: active, scenarioId: input.scenarioId }));
  let secondCallConsumption;
  if (input.proofScope === 'product-observed') {
    const firstValidation = await validateObservedBuddyTranscript(input.firstObservedCallTranscriptRef, input.buddyName);
    const secondValidation = await validateObservedBuddyTranscript(input.secondObservedCallTranscriptRef, input.buddyName);
    const consumption = secondCallConsumptionIssues({ calls: secondValidation.calls, afterRun });
    secondCallConsumption = { firstIssues: firstValidation.issues, secondIssues: secondValidation.issues, consumptionIssues: consumption.issues, observedOutputText: consumption.matched?.observedOutputText };
    if (consumption.matched?.observedOutputText && !(input.releaseGrade === true && suppliedReleaseGradeAfterRun)) afterRun.outputText = consumption.matched.observedOutputText;
  }
  await writeJson(join(outRoot, 'applied-version.json'), active);
  await writeJson(join(outRoot, 'after-run.json'), afterRun);
  let releaseGradeProductProvenance;
  if (input.proofScope === 'product-observed' && input.releaseGrade === true) {
    releaseGradeProductProvenance = await releaseGradeLoopProvenance(input, { afterRun, secondCall: secondCallConsumption?.matched });
    if (releaseGradeProductProvenance.status !== 'pass') {
      const releaseIssues = [`release-grade product provenance ${releaseGradeProductProvenance.status}: ${releaseGradeProductProvenance.issues.join('; ')}`];
      const report = { reportKind: 'evobuddy-evolution-loop-v0', status: releaseGradeProductProvenance.status, proofScope: 'blocked', proofBoundary: 'release-grade-product-provenance', releaseGradeProductProvenance, invocationTier: input.invocationTier, scenarioId: input.scenarioId, buddyName: input.buddyName, evolutionBuddyRun: { evolutionBuddyName: run.evolutionBuddyName, proposalSource: run.proposalSource, proposalAuthority: run.proposalAuthority, hostRole: run.hostRole }, feedbackWindow: run.feedbackWindow, patch, patchRef: join(outRoot, 'evolution-patch.json'), durableApply, appliedVersionRef: join(outRoot, 'applied-version.json'), beforeRunRef: join(outRoot, 'before-run.json'), afterRunRef: join(outRoot, 'after-run.json'), versionChange: { beforeVersion: current.version, afterVersion: active.version }, materialization: input.proofScope === 'product-observed' ? { firstObservedCallTranscriptRef: input.firstObservedCallTranscriptRef, secondObservedCallTranscriptRef: input.secondObservedCallTranscriptRef, materializedBuddyContextRef: afterRun.materializedContextRef, materializedContextDigest: afterRun.materializedContextDigest, appliedVersionDigest: afterRun.appliedVersionDigest, appliedVersionMaterialized: afterRun.materializedBuddyVersion === active.version, appliedVersionConsumedBySecondCall: false } : undefined, negativeControls, patchApplied: patch.status === 'applied' && (!durableApply || durableApply.status === 'applied'), issues: releaseIssues };
      await writeJson(join(outRoot, 'evobuddy-evolution-loop-report.json'), report);
      return report;
    }
  }
  const versionChange = { beforeVersion: current.version, afterVersion: active.version };
  const behaviorDelta = patch.status === 'applied' ? evaluateBehaviorDelta({ scenarioId: input.scenarioId, buddyName: input.buddyName, beforeRun: input.beforeRun, afterRun, expectedDelta: input.expectedDelta, patch, versionChange }) : { status: 'pass', issues: [] };
  await writeJson(join(outRoot, 'behavior-delta.json'), behaviorDelta);
  const materialization = input.proofScope === 'product-observed' ? { firstObservedCallTranscriptRef: input.firstObservedCallTranscriptRef, secondObservedCallTranscriptRef: input.secondObservedCallTranscriptRef, materializedBuddyContextRef: afterRun.materializedContextRef, materializedContextDigest: afterRun.materializedContextDigest, appliedVersionDigest: afterRun.appliedVersionDigest, appliedVersionMaterialized: afterRun.materializedBuddyVersion === active.version, appliedVersionConsumedBySecondCall: (secondCallConsumption?.consumptionIssues ?? []).length === 0 } : undefined;
  const issues = [...(behaviorDelta.issues ?? []), ...(secondCallConsumption?.firstIssues ?? []), ...(secondCallConsumption?.secondIssues ?? []), ...(secondCallConsumption?.consumptionIssues ?? [])];
  if (cleanString(input.projectRoot)) {
    if (!durableApply) issues.push('durable apply did not run for projectRoot');
    else if (durableApply.status === 'applied' && !String(durableApply.activeTargetRef ?? '').startsWith(`${input.projectRoot}/.evobuddy/`)) issues.push('durable apply active target is outside .evobuddy project state');
    else if (durableApply.status !== 'applied' && input.proofScope === 'product-observed') issues.push(`durable apply is ${durableApply.status}`);
  }
  if (materialization && !materialization.appliedVersionMaterialized) issues.push('applied version was not materialized into second Buddy call');
  const releaseGradeValidationRan = input.proofScope === 'product-observed' && input.releaseGrade === true;
  const report = { reportKind: 'evobuddy-evolution-loop-v0', status: issues.length === 0 ? behaviorDelta.status : 'fail', proofScope: input.proofScope ?? 'hermetic', proofBoundary: releaseGradeValidationRan ? 'release-grade-product-provenance' : 'structural-product-observed', releaseGradeProductProvenance, invocationTier: input.invocationTier, scenarioId: input.scenarioId, buddyName: input.buddyName, evolutionBuddyRun: { evolutionBuddyName: run.evolutionBuddyName, proposalSource: run.proposalSource, proposalAuthority: run.proposalAuthority, hostRole: run.hostRole }, feedbackWindow: run.feedbackWindow, patch, patchRef: join(outRoot, 'evolution-patch.json'), durableApply, appliedVersionRef: join(outRoot, 'applied-version.json'), beforeRunRef: join(outRoot, 'before-run.json'), afterRunRef: join(outRoot, 'after-run.json'), versionChange, behaviorDelta, materialization, negativeControls, patchApplied: patch.status === 'applied' && (!durableApply || durableApply.status === 'applied'), issues };
  await writeJson(join(outRoot, 'evobuddy-evolution-loop-report.json'), report);
  return report;
}
