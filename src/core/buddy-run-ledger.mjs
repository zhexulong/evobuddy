import { readFile } from 'node:fs/promises';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

export function memberTaskRunToBuddyRunView(memberTaskRun, options = {}) {
  requireObject(memberTaskRun, 'memberTaskRun');
  const memberName = requireString(memberTaskRun.memberName, 'memberTaskRun.memberName');
  const returnedToParent = memberTaskRun.result?.returnedTo === 'parent-agent' || memberTaskRun.resultReturnEvidence?.returnedTo === 'parent-agent';
  return {
    buddyRunId: requireString(memberTaskRun.runId ?? memberTaskRun.id, 'memberTaskRun.runId'),
    buddyName: memberName,
    memberName,
    requestingParentRef: memberTaskRun.requesterRef ?? memberTaskRun.requestingParentRef ?? 'unknown',
    runtimeSurface: memberTaskRun.runtimeSurface ?? memberTaskRun.packetDeliveryEvidence?.runtimeSurface ?? 'unknown',
    taskQuestion: memberTaskRun.task?.question ?? memberTaskRun.taskQuestion ?? '',
    targetRefs: arrayOrEmpty(memberTaskRun.task?.targetRefs ?? memberTaskRun.targetRefs),
    contextRenderRef: memberTaskRun.memberContextRenderRef ?? memberTaskRun.contextRenderRef,
    resultRef: memberTaskRun.resultReturnEvidenceRef ?? memberTaskRun.resultRef,
    returnedToParent,
    feedbackWindowRefs: arrayOrEmpty(memberTaskRun.feedbackWindowRefs),
    evolutionSignals: arrayOrEmpty(memberTaskRun.evolutionSignals),
    traceRefs: arrayOrEmpty(memberTaskRun.traceRefs),
    ...(options.buddySummary?.executionResolution ? {
      executionResolutionRef: options.buddySummary.artifacts?.buddySummary ?? options.buddySummaryRef,
      executionResolutionDigest: options.buddySummary.executionResolutionDigest,
      executionActual: options.buddySummary.executionResolution.actual,
    } : {}),
    compatibility: { sourceKind: 'member-task-run', sourceRef: options.sourceRef },
  };
}

export async function readBuddyRun(runRef, options = {}) {
  const sourceRef = requireString(runRef, 'runRef');
  let buddySummary;
  if (options.buddySummaryRef) buddySummary = JSON.parse(await readFile(options.buddySummaryRef, 'utf8'));
  return memberTaskRunToBuddyRunView(JSON.parse(await readFile(sourceRef, 'utf8')), { sourceRef, buddySummary, buddySummaryRef: options.buddySummaryRef });
}
