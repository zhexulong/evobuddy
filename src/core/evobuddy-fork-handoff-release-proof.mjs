import { validateForkHandoffClosure } from './evobuddy-taskroom-fork-handoff.mjs';
import { validateTaskRoomEvolutionHandoff } from './evobuddy-taskroom-evolution-handoff.mjs';
import { validateTaskRoomLoopProof } from './evobuddy-taskroom-loop-proof.mjs';

function gate(status, reason = null, extras = {}) {
  return { status, ...(reason ? { reason } : {}), ...extras };
}

function failReport({ proofScope, gates, issues, taskRoomLoop = null, forkHandoffClosure = null, evolutionHandoff = null }) {
  return {
    schema: 'evobuddy-fork-handoff-release-proof.v1',
    status: 'fail',
    proofScope,
    issues,
    taskRoomLoop,
    forkHandoffClosure,
    evolutionHandoffProof: evolutionHandoff,
    ...gates,
  };
}

function projectionGate(input, issues) {
  if (input?.status !== 'pass') {
    issues.push('projectionCurrent did not pass');
    return gate('fail', 'projection-current-missing-or-failed');
  }
  if (!Array.isArray(input.projectionRefs) || input.projectionRefs.length === 0) {
    issues.push('projectionCurrent requires projection refs');
    return gate('fail', 'missing-projection-refs');
  }
  if (!Array.isArray(input.projectionDigests) || input.projectionDigests.length === 0) {
    issues.push('projectionCurrent requires projection digests');
    return gate('fail', 'missing-projection-digests');
  }
  return gate('pass');
}

function forkGate({ proofScope, taskRoomLoop, closure, issues }) {
  if (proofScope !== 'product-observed') {
    issues.push('forkObserved requires product-observed proof scope');
    return gate('fail', 'product-observed-required');
  }
  if (taskRoomLoop.proofScope !== 'product-observed') {
    issues.push('nested taskRoomLoop proofScope must be product-observed for forkObserved');
    return gate('fail', 'nested-product-observed-required');
  }
  if (taskRoomLoop.exporterRefs.length === 0) {
    issues.push('forkObserved requires exporter evidence');
    return gate('fail', 'missing-exporter-evidence');
  }
  if (closure.forkObserved.status !== 'pass') {
    issues.push('ForkRecord closure did not pass');
    return gate('fail', 'fork-record-closure-failed');
  }
  const exporterRuntimeRefs = new Set(taskRoomLoop.exporterRefs.flatMap((entry) => entry.runtimeSessionRefs));
  const nativeEvidenceRefs = new Set(taskRoomLoop.nativeForkEvidenceRefs ?? []);
  const instancesById = new Map(closure.instances.map((instance) => [instance.instanceId, instance]));
  const nativeForks = closure.forks.filter((fork) => {
    const created = instancesById.get(fork.newInstanceId);
    const hasNativeEvidence = fork.runtimeEvidenceRefs.length > 0
      && fork.runtimeEvidenceRefs.every((ref) => nativeEvidenceRefs.has(ref) || ref.startsWith('exporter:spawn:') || ref.startsWith('opencode:native-spawn:'));
    const hasExporterSession = Boolean(created?.runtimeSessionRef && exporterRuntimeRefs.has(created.runtimeSessionRef));
    if (!hasExporterSession) issues.push(`fork ${fork.forkId} created instance runtime session missing from exporter refs`);
    if (!hasNativeEvidence) issues.push(`fork ${fork.forkId} lacks native runtime fork evidence`);
    return fork.forkKind === 'native-context-fork' && hasNativeEvidence && hasExporterSession;
  });
  if (nativeForks.length !== closure.forks.length) {
    issues.push('forkObserved requires native runtime fork evidence, not static projection or adapter-only output');
    return gate('fail', 'missing-native-runtime-fork-evidence');
  }
  return gate('pass', null, { forkCount: closure.forks.length, nativeForkCount: nativeForks.length });
}

function taskRoomHandoffsHaveEvidence(taskRoomLoop) {
  return taskRoomLoop.handoffs.length > 0 && taskRoomLoop.handoffs.every((handoff) => {
    const messageId = typeof handoff.messageId === 'string' && handoff.messageId.trim().length > 0;
    const artifactRefs = Array.isArray(handoff.artifactRefs) && handoff.artifactRefs.length > 0;
    return messageId && artifactRefs;
  });
}

function taskRoomHandoffsBindToRecords(taskRoomLoop, closure) {
  return taskRoomLoop.handoffs.every((handoff) => closure.handoffs.some((record) => {
    const evidenceMatch = record.evidenceRefs.includes(handoff.messageId);
    const artifactRefs = Array.isArray(handoff.artifactRefs) ? handoff.artifactRefs : [];
    const artifactMatch = artifactRefs.length > 0 && artifactRefs.every((ref) => record.artifactRefs.includes(ref));
    return evidenceMatch && artifactMatch;
  }));
}

function handoffGate({ taskRoomLoop, closure, issues }) {
  if (closure.handoffObserved.status !== 'pass') {
    issues.push('HandoffRecord closure did not pass');
    return gate('fail', 'handoff-record-closure-failed');
  }
  if (!taskRoomHandoffsHaveEvidence(taskRoomLoop)) {
    issues.push('handoffObserved requires TaskRoom handoff message and artifact refs');
    return gate('fail', 'missing-taskroom-handoff-message-artifact-refs');
  }
  if (!taskRoomHandoffsBindToRecords(taskRoomLoop, closure)) {
    issues.push('TaskRoom handoff must bind to HandoffRecord evidence and artifact refs');
    return gate('fail', 'taskroom-handoff-not-bound-to-record');
  }
  return gate('pass', null, { handoffCount: closure.handoffs.length });
}

function continuityGate(taskRoomLoop, issues) {
  if (taskRoomLoop.reviewerContinuity.status !== 'pass') {
    issues.push(taskRoomLoop.reviewerContinuity.reason ?? 'continuityObserved did not pass');
    return gate('fail', taskRoomLoop.reviewerContinuity.reason ?? 'reviewer-continuity-failed');
  }
  return gate('pass', null, { kind: taskRoomLoop.reviewerContinuity.kind });
}

function resultReturnGate(taskRoomLoop, issues) {
  if (taskRoomLoop.resultReturn.status !== 'pass' || !taskRoomLoop.resultReturn.observedParentThreadRef) {
    issues.push('resultReturn requires parent/user observed return ref');
    return gate('fail', 'missing-observed-parent-return');
  }
  return gate('pass', null, {
    returnedTo: taskRoomLoop.resultReturn.returnedTo ?? null,
    observedParentThreadRef: taskRoomLoop.resultReturn.observedParentThreadRef,
  });
}

function evolutionGate(input, issues) {
  try {
    const evolutionHandoff = validateTaskRoomEvolutionHandoff(input);
    if (evolutionHandoff.status !== 'pass') {
      issues.push('evolutionHandoff stable mutation policy did not pass');
      return { gate: gate('fail', 'stable-mutation-policy-failed'), evolutionHandoff };
    }
    return { gate: gate('pass', null, { agentName: evolutionHandoff.agentName }), evolutionHandoff };
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    return { gate: gate('fail', 'evolution-handoff-validation-failed'), evolutionHandoff: null };
  }
}

export function evaluateForkHandoffReleaseProof(input = {}) {
  const proofScope = input.proofScope === 'product-observed' ? 'product-observed' : 'retained';
  const issues = [];
  const gates = { projectionCurrent: projectionGate(input.projectionCurrent, issues) };

  let taskRoomLoop = null;
  try {
    taskRoomLoop = validateTaskRoomLoopProof(input.taskRoomLoop);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    gates.forkObserved = gate('fail', 'taskroom-loop-validation-failed');
    gates.handoffObserved = gate('fail', 'taskroom-loop-validation-failed');
    gates.continuityObserved = gate('fail', 'taskroom-loop-validation-failed');
    gates.resultReturn = gate('fail', 'taskroom-loop-validation-failed');
    const { gate: evolutionHandoff, evolutionHandoff: evolutionProof } = evolutionGate(input.evolutionHandoff, issues);
    gates.evolutionHandoff = evolutionHandoff;
    return failReport({ proofScope, gates, issues, taskRoomLoop, evolutionHandoff: evolutionProof });
  }

  let forkHandoffClosure = null;
  try {
    forkHandoffClosure = validateForkHandoffClosure(input.forkHandoff ?? {});
    issues.push(...forkHandoffClosure.issues);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    forkHandoffClosure = { status: 'fail', forkObserved: { status: 'fail' }, handoffObserved: { status: 'fail' }, instances: [], forks: [], handoffs: [], wakes: [] };
  }

  gates.forkObserved = forkGate({ proofScope, taskRoomLoop, closure: forkHandoffClosure, issues });
  gates.handoffObserved = handoffGate({ taskRoomLoop, closure: forkHandoffClosure, issues });
  gates.continuityObserved = continuityGate(taskRoomLoop, issues);
  gates.resultReturn = resultReturnGate(taskRoomLoop, issues);
  const { gate: evolutionHandoff, evolutionHandoff: evolutionProof } = evolutionGate(input.evolutionHandoff, issues);
  gates.evolutionHandoff = evolutionHandoff;

  const status = Object.values(gates).every((entry) => entry.status === 'pass') && issues.length === 0 ? 'pass' : 'fail';
  return {
    schema: 'evobuddy-fork-handoff-release-proof.v1',
    status,
    proofScope,
    issues,
    taskRoomLoop,
    forkHandoffClosure,
    evolutionHandoffProof: evolutionProof,
    ...gates,
  };
}
