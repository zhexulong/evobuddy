import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import {
  auditPromptForLeaks,
  expectedCanariesForCase,
  forbiddenCanariesForCase,
} from './canaries.mjs';
import { createCaptureManifest } from '../core/manifest.mjs';
import { createParentCallRecordDigest } from '../adapters/explicit-member-parent-invocation-source.mjs';
import { validateMemberInvocationPacket } from '../core/member-invocation-packet.mjs';
import {
  assertParentAgentReturnSupported,
  validatePacketDeliveryEvidence,
  validateResultReturnEvidence,
} from '../core/member-result-return-evidence.mjs';

const ARTIFACT_KIND = 'explicit-member-activation-capability-artifact';
const CASE_ID = 'authorized-explicit-member-activation';
const TIER_ID = 'authorized-explicit-member-activation';
const INPUT_FILE = 'explicit-member-executor-input.json';
const OUTPUT_FILE = 'explicit-member-executor-output.json';
const OBSERVATION_FILE = 'explicit-member-executor-observation.json';
const PARENT_INVOCATION_KIND = 'explicit-member-parent-invocation';
const PARENT_SOURCE_KIND = 'explicit-member-parent-invocation-source';
const EXECUTOR_INPUT_KIND = 'explicit-member-executor-input';
const EXECUTOR_METHOD = 'context-tree-explicit-member-executor';
const PACKET_FILE = 'member-invocation-packet.json';
const ALLOWED_PARENT_INVOCATION_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
const REJECTED_PARENT_INVOCATION_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);
const ALLOWED_PARENT_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveArtifactPath(ref, relativeTo) {
  requireString(ref, 'artifact ref');
  if (isAbsolute(ref)) return ref;
  if (isNonEmptyString(relativeTo)) return resolve(dirname(relativeTo), ref);
  return resolve(ref);
}

async function loadJsonArtifact(ref, label, options = {}) {
  const resolvedRef = resolveArtifactPath(ref, options.relativeTo);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(resolvedRef, 'utf8'));
  } catch {
    throw new Error(`${label} must point to readable JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must point to a JSON object`);
  }
  return { parsed, resolvedRef };
}

function observedCanariesFromText(text, canaries) {
  return Object.values(canaries).filter((canary) => String(text).includes(canary));
}

function decideCanaryVerdict(expectedCanaries, forbiddenCanaries, observedCanaries) {
  const leaked = forbiddenCanaries.some((canary) => observedCanaries.includes(canary));
  if (leaked) return 'negative control leaked canary in executorOutput.answer';
  const missing = expectedCanaries.filter((canary) => !observedCanaries.includes(canary));
  if (missing.length > 0) return `legacy-answer-canary missing expected answer canary: ${missing.join(', ')}`;
  return null;
}

function collectVisibleRefs(run) {
  const refs = new Set();
  const items = Array.isArray(run?.materials?.items) ? run.materials.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (!new Set(['intended-model-input', 'runtime-input-observed', 'provider-model-input-observed']).has(item.visibility)) continue;
    if (isNonEmptyString(item.materialRef)) refs.add(item.materialRef);
    if (isNonEmptyString(item.sourceRef)) refs.add(item.sourceRef);
  }
  return refs;
}

function collectSelectionVisibleRefs(selection) {
  return [
    ...(Array.isArray(selection.baselineRefs) ? selection.baselineRefs : []),
    ...(Array.isArray(selection.invocationRequestedRefs) ? selection.invocationRequestedRefs : []),
  ];
}

function pushIssue(issues, condition, message) {
  if (condition) issues.push(message);
}

function pushRequiredStringIssue(issues, value, name) {
  pushIssue(issues, !isNonEmptyString(value), `${name} is required`);
}

function pushRequiredMatchIssue(issues, actual, expected, message) {
  if (!isNonEmptyString(actual) || !isNonEmptyString(expected)) {
    issues.push(message);
    return;
  }
  pushIssue(issues, actual !== expected, message);
}

function isCompletedStatus(value) {
  return ['completed', 'succeeded'].includes(String(value ?? '').toLowerCase());
}

function pushRequiredCompletedStatusIssue(issues, value, name) {
  pushIssue(issues, !isCompletedStatus(value), `${name} must be completed`);
}

function pushResolvedRefIssue(issues, ref, relativeTo, expectedPath, message) {
  if (!isNonEmptyString(ref) || !isNonEmptyString(expectedPath)) {
    issues.push(message);
    return;
  }
  pushIssue(issues, resolveArtifactPath(ref, relativeTo) !== expectedPath, message);
}

function parsedTime(value) {
  if (!isNonEmptyString(value)) return Number.NaN;
  return Date.parse(value);
}

function pushValidTimeIssue(issues, value, name) {
  pushIssue(issues, Number.isNaN(parsedTime(value)), `${name} must be a valid timestamp`);
}

function pushTimeOrderIssue(issues, earlier, later, message) {
  const earlierMs = parsedTime(earlier);
  const laterMs = parsedTime(later);
  if (Number.isNaN(earlierMs) || Number.isNaN(laterMs)) return;
  pushIssue(issues, earlierMs > laterMs, message);
}

function resolvedPathOrNull(ref, relativeTo) {
  if (!isNonEmptyString(ref)) return null;
  return resolveArtifactPath(ref, relativeTo);
}

function hasDigest(value) {
  return isNonEmptyString(value) && value !== '*';
}

function pushProvenanceIssues(issues, provenanceRefs, name, { requireDigest = false } = {}) {
  if (!Array.isArray(provenanceRefs) || provenanceRefs.length === 0) {
    issues.push(`${name} requires non-empty provenanceRefs`);
    return;
  }
  for (const [index, provenanceRef] of provenanceRefs.entries()) {
    if (!provenanceRef || typeof provenanceRef !== 'object' || Array.isArray(provenanceRef)) {
      issues.push(`${name}.provenanceRefs[${index}] must be an object`);
      continue;
    }
    pushRequiredStringIssue(issues, provenanceRef.kind, `${name}.provenanceRefs[${index}].kind`);
    pushRequiredStringIssue(issues, provenanceRef.ref, `${name}.provenanceRefs[${index}].ref`);
    if (requireDigest) pushRequiredStringIssue(issues, provenanceRef.digest, `${name}.provenanceRefs[${index}].digest`);
  }
}

async function loadLifecycle(artifact) {
  const sourcePath = isNonEmptyString(artifact.__artifactSourcePath) ? artifact.__artifactSourcePath : undefined;
  const runRef = artifact?.artifactRefs?.memberTaskRunPath;
  const requestRef = artifact?.artifactRefs?.memberTaskRequestPath;
  if (!isNonEmptyString(runRef) || !isNonEmptyString(requestRef)) {
    return {
      lifecycleVerdict: {
        status: 'fail',
        checked: true,
        issues: ['authorized-explicit-member-activation requires memberTaskRequestPath and memberTaskRunPath lifecycle refs'],
      },
    };
  }

  const { parsed: run, resolvedRef: runPath } = await loadJsonArtifact(runRef, 'artifact.artifactRefs.memberTaskRunPath', { relativeTo: sourcePath });
  const { parsed: request, resolvedRef: requestPath } = await loadJsonArtifact(requestRef, 'artifact.artifactRefs.memberTaskRequestPath', { relativeTo: sourcePath });
  const issues = [];

  pushIssue(
    issues,
    resolveArtifactPath(run.memberTaskRequestRef, runPath) !== requestPath,
    'memberTaskRun.memberTaskRequestRef must match artifact.artifactRefs.memberTaskRequestPath',
  );

  const renderPath = resolveArtifactPath(run.memberContextRenderRef, runPath);
  const selectionPath = resolveArtifactPath(run.materialSelectionReportRef, runPath);
  const { parsed: render, resolvedRef: resolvedRenderPath } = await loadJsonArtifact(run.memberContextRenderRef, 'memberTaskRun.memberContextRenderRef', { relativeTo: runPath });
  const { parsed: selection, resolvedRef: resolvedSelectionPath } = await loadJsonArtifact(run.materialSelectionReportRef, 'memberTaskRun.materialSelectionReportRef', { relativeTo: runPath });

  pushIssue(issues, resolveArtifactPath(request.memberContextRenderRef, requestPath) !== resolvedRenderPath, 'memberTaskRequest.memberContextRenderRef must match memberTaskRun.memberContextRenderRef');
  pushIssue(issues, resolveArtifactPath(request.materialSelectionReportRef, requestPath) !== resolvedSelectionPath, 'memberTaskRequest.materialSelectionReportRef must match memberTaskRun.materialSelectionReportRef');
  pushIssue(issues, resolveArtifactPath(render.selectionReportRef, resolvedRenderPath) !== resolvedSelectionPath, 'memberContextRender.selectionReportRef must match memberTaskRun.materialSelectionReportRef');
  pushIssue(issues, run.baselineDigest !== request.baselineDigest, 'memberTaskRun.baselineDigest must match memberTaskRequest.baselineDigest');
  pushIssue(issues, run.deltaDigest !== request.deltaDigest, 'memberTaskRun.deltaDigest must match memberTaskRequest.deltaDigest');
  pushIssue(issues, run.baselineDigest !== render.baselineDigest, 'memberTaskRun.baselineDigest must match memberContextRender.baselineDigest');
  pushIssue(issues, run.deltaDigest !== render.deltaDigest, 'memberTaskRun.deltaDigest must match memberContextRender.deltaDigest');
  pushIssue(issues, run.baselineReuseStatus !== request.baselineReuseStatus, 'memberTaskRun.baselineReuseStatus must match memberTaskRequest.baselineReuseStatus');
  pushIssue(issues, run.baselineReuseStatus !== render.baselineReuseStatus, 'memberTaskRun.baselineReuseStatus must match memberContextRender.baselineReuseStatus');

  const visibleRefs = collectVisibleRefs(run);
  const selectedRefs = new Set(collectSelectionVisibleRefs(selection));
  for (const ref of selectedRefs) {
    if (!visibleRefs.has(ref)) {
      issues.push('selectionReport baselineRefs/invocationRequestedRefs must align with MemberTaskRun model-visible refs');
      break;
    }
  }
  for (const ref of visibleRefs) {
    if (!selectedRefs.has(ref)) {
      issues.push('MemberTaskRun model-visible refs must align with selectionReport baselineRefs/invocationRequestedRefs');
      break;
    }
  }

  return {
    lifecycleVerdict: { status: issues.length > 0 ? 'fail' : 'pass', checked: true, issues },
    run,
    request,
    runPath,
    requestPath,
    renderPath,
    selectionPath,
  };
}

function validateExplicitRoute({
  artifact,
  run,
  request,
  runPath,
  requestPath,
  inputPath,
  outputPath,
  observationPath,
  parentInvocationPath,
  memberInvocationPacketPath,
  executorInput,
  executorOutput,
  executorObservation,
  parentInvocation,
  parentSource,
  parentCallRecord,
  memberInvocationPacket,
  expectedCanaries,
  forbiddenCanaries,
  canaries,
}) {
  const issues = [];
  pushIssue(issues, artifact.caseId !== CASE_ID, `explicit route requires caseId=${CASE_ID}`);
  pushIssue(issues, artifact.acceptanceMode !== TIER_ID, `explicit route requires acceptanceMode=${TIER_ID}`);
  pushIssue(issues, artifact?.acceptanceTier?.id !== TIER_ID, `explicit route requires acceptanceTier.id=${TIER_ID}`);
  pushIssue(issues, artifact.providerForcedLiveProof === true || artifact.deterministicProviderProof === true, 'explicit route must not use provider-forced, retained-only, or deterministic provider shortcuts');

  const requestedMember = artifact.requestedMember ?? request?.memberName;
  pushIssue(issues, !isNonEmptyString(requestedMember), 'explicit route requires requestedMember or request.memberName');
  if (isNonEmptyString(artifact.requestedMember) && isNonEmptyString(request?.memberName)) {
    pushIssue(issues, artifact.requestedMember !== request.memberName, 'artifact.requestedMember must match memberTaskRequest.memberName');
  }
  if (isNonEmptyString(artifact.requestedMember) && isNonEmptyString(run?.memberName)) {
    pushIssue(issues, artifact.requestedMember !== run.memberName, 'artifact.requestedMember must match memberTaskRun.memberName');
  }
  if (isNonEmptyString(request?.memberName) && isNonEmptyString(run?.memberName)) {
    pushIssue(issues, request.memberName !== run.memberName, 'memberTaskRequest.memberName must match memberTaskRun.memberName');
  }
  const resolvedMemberId = artifact.resolvedMemberId ?? request?.resolvedMemberId;
  if (isNonEmptyString(artifact.resolvedMemberId) && isNonEmptyString(request?.resolvedMemberId)) {
    pushIssue(issues, artifact.resolvedMemberId !== request.resolvedMemberId, 'artifact.resolvedMemberId must match memberTaskRequest.resolvedMemberId');
  }
  if (isNonEmptyString(artifact.resolvedMemberId) && isNonEmptyString(run?.resolvedMemberId)) {
    pushIssue(issues, artifact.resolvedMemberId !== run.resolvedMemberId, 'artifact.resolvedMemberId must match memberTaskRun.resolvedMemberId');
  }
  if (isNonEmptyString(request?.resolvedMemberId) && isNonEmptyString(run?.resolvedMemberId)) {
    pushIssue(issues, request.resolvedMemberId !== run.resolvedMemberId, 'memberTaskRequest.resolvedMemberId must match memberTaskRun.resolvedMemberId');
  }
  if (isNonEmptyString(resolvedMemberId)) {
    pushIssue(issues, !isNonEmptyString(run?.resolvedMemberId), 'memberTaskRun.resolvedMemberId must match resolved member proof');
  }
  const productGradeExplicit = artifact.executorProof?.authority === 'agent-runtime';
  const materialProofMode = artifact.materialProofMode ?? 'product-evidence';
  pushIssue(issues, !['product-evidence', 'legacy-answer-canary'].includes(materialProofMode), 'materialProofMode must be product-evidence or legacy-answer-canary');
  pushIssue(issues, run?.result?.returnedTo !== 'parent-agent', 'memberTaskRun.result.returnedTo must be parent-agent');
  if (productGradeExplicit) {
    try {
      assertParentAgentReturnSupported({
        returnedTo: run?.result?.returnedTo,
        evidenceRefs: run?.result?.evidenceRefs ?? run?.evidenceRefs,
        resultReturnEvidence: run?.resultReturnEvidence,
      });
    } catch (error) {
      issues.push(error.message);
    }
  }
  pushIssue(issues, basename(inputPath) !== INPUT_FILE, `artifact.artifactRefs.executorInputPath must resolve to ${INPUT_FILE}`);
  pushIssue(issues, basename(outputPath) !== OUTPUT_FILE, `memberTaskRun.result.resultRef must resolve to ${OUTPUT_FILE}`);
  if (productGradeExplicit) {
    pushIssue(issues, basename(memberInvocationPacketPath) !== PACKET_FILE, `authorized-explicit-member-activation product proof requires ${PACKET_FILE}`);
    try {
      validateMemberInvocationPacket(memberInvocationPacket);
    } catch (error) {
      issues.push(`member-invocation-packet evidence invalid: ${error.message}`);
    }
    pushResolvedRefIssue(issues, request?.memberInvocationPacketRef, requestPath, memberInvocationPacketPath, `memberTaskRequest.memberInvocationPacketRef must resolve to ${PACKET_FILE}`);
    pushResolvedRefIssue(issues, executorInput?.memberInvocationPacketRef, inputPath, memberInvocationPacketPath, `executor input memberInvocationPacketRef must resolve to ${PACKET_FILE}`);
    pushResolvedRefIssue(issues, run?.packetDeliveryEvidence?.memberInvocationPacketRef, runPath, memberInvocationPacketPath, `packet delivery evidence memberInvocationPacketRef must resolve to ${PACKET_FILE}`);
    try {
      const packetDeliveryEvidence = validatePacketDeliveryEvidence(run?.packetDeliveryEvidence);
      pushIssue(issues, packetDeliveryEvidence.deliveredInputDigest !== executorInput?.inputDigest, 'packet delivery evidence deliveredInputDigest must match explicit-member-executor-input.json inputDigest');
      pushResolvedRefIssue(issues, packetDeliveryEvidence.evidenceRef, runPath, observationPath, 'packet delivery evidence evidenceRef must resolve to explicit-member-executor-observation.json');
    } catch (error) {
      issues.push(`packet delivery evidence invalid: ${error.message}`);
    }
    try {
      const resultReturnEvidence = validateResultReturnEvidence(run?.resultReturnEvidence);
      pushIssue(issues, resultReturnEvidence.returnedTo !== 'parent-agent', 'result-return evidence returnedTo must be parent-agent');
      pushIssue(issues, resultReturnEvidence.resultDigest !== executorOutput?.answerDigest, 'result-return evidence resultDigest must match executorOutput.answerDigest');
    } catch (error) {
      issues.push(`result-return evidence invalid: ${error.message}`);
    }
  }
  pushIssue(issues, run?.result?.summary !== executorOutput?.answer, 'memberTaskRun.result.summary must match executorOutput.answer');
  pushIssue(issues, run?.result?.resultDigest !== executorOutput?.answerDigest, 'memberTaskRun.result.resultDigest must match executorOutput.answerDigest');
  pushIssue(issues, run?.materialSelectionMode === 'summary-only', 'explicit route must not use summary-only lifecycle shortcut');

  pushIssue(issues, executorInput?.kind !== EXECUTOR_INPUT_KIND, `executor input kind must be ${EXECUTOR_INPUT_KIND}`);
  pushIssue(issues, executorInput?.route !== CASE_ID, `executor input route must be ${CASE_ID}`);
  pushIssue(issues, executorInput?.method !== EXECUTOR_METHOD, `executor input method must be ${EXECUTOR_METHOD}`);
  pushIssue(issues, executorInput?.memberName !== run?.memberName, 'executor input memberName must match memberTaskRun.memberName');
  pushIssue(issues, executorInput?.resolvedMemberId !== run?.resolvedMemberId, 'executor input resolvedMemberId must match memberTaskRun.resolvedMemberId');

  const observedAnswerCanaries = observedCanariesFromText(executorOutput?.answer, canaries);
  if (materialProofMode === 'legacy-answer-canary') {
    const requiredRoleHistory = Array.isArray(run?.materialProof?.required?.roleHistory) ? run.materialProof.required.roleHistory : [];
    const requiredTargetMaterial = Array.isArray(run?.materialProof?.required?.targetMaterial) ? run.materialProof.required.targetMaterial : [];
    for (const canary of requiredRoleHistory) {
      pushIssue(issues, !String(executorOutput?.answer ?? '').includes(canary), `missing role-history material proof canary in executorOutput.answer: ${canary}`);
    }
    for (const canary of requiredTargetMaterial) {
      pushIssue(issues, !String(executorOutput?.answer ?? '').includes(canary), `missing target-material proof canary in executorOutput.answer: ${canary}`);
    }
  }

  pushIssue(issues, executorInput?.inputDigest !== executorOutput?.inputDigest, 'executor input digest must match executorOutput.inputDigest');
  pushIssue(issues, executorInput?.inputDigest !== executorObservation?.inputDigest, 'executor observation input digest must match executor input digest');
  pushIssue(issues, executorOutput?.answerDigest !== executorObservation?.outputDigest, 'executor observation output digest must match executorOutput.answerDigest');

  const selectedRefs = new Set([
    ...(Array.isArray(run?.materials?.items) ? run.materials.items.map((item) => item?.materialRef).filter(isNonEmptyString) : []),
    ...(Array.isArray(run?.materials?.items) ? run.materials.items.map((item) => item?.sourceRef).filter(isNonEmptyString) : []),
  ]);
  const usedRefs = Array.isArray(executorObservation?.usedMaterialRefs) ? executorObservation.usedMaterialRefs : [];
  for (const usedRef of usedRefs) {
    if (isNonEmptyString(usedRef) && !selectedRefs.has(usedRef)) {
      issues.push('executorObservation.usedMaterialRefs must be represented in material selection evidence');
      break;
    }
  }

  const executorProof = artifact.executorProof;
  if (!executorProof || typeof executorProof !== 'object' || Array.isArray(executorProof)) {
    issues.push('explicit route requires executorProof');
  } else {
    pushIssue(issues, executorProof.fixture !== true && executorProof.fixture !== false, 'executorProof.fixture must classify fixture vs agent-runtime');
    pushIssue(issues, !['agent-runtime', 'fixture'].includes(executorProof.authority), 'executorProof.authority must classify fixture vs agent-runtime');
    pushIssue(issues, isNonEmptyString(executorProof.inputDigest) && executorProof.inputDigest !== executorInput?.inputDigest, 'executorProof.inputDigest must match explicit-member-executor-input.json inputDigest');
    pushIssue(issues, isNonEmptyString(executorProof.outputDigest) && executorProof.outputDigest !== executorOutput?.answerDigest, 'executorProof.outputDigest must match explicit-member-executor-output.json answerDigest');
    pushIssue(issues, isNonEmptyString(executorProof.observedInputDigest) && executorProof.observedInputDigest !== executorObservation?.inputDigest, 'executorProof.observedInputDigest must match executor observation input digest');
    pushIssue(issues, isNonEmptyString(executorProof.observedOutputDigest) && executorProof.observedOutputDigest !== executorObservation?.outputDigest, 'executorProof.observedOutputDigest must match executor observation output digest');
    pushIssue(issues, isNonEmptyString(executorProof.outputRef) && resolveArtifactPath(executorProof.outputRef, artifact.__artifactSourcePath) !== outputPath, 'executorProof.outputRef must resolve to explicit-member-executor-output.json');
    pushIssue(issues, isNonEmptyString(executorProof.observationRef) && resolveArtifactPath(executorProof.observationRef, artifact.__artifactSourcePath) !== observationPath, 'executorProof.observationRef must resolve to explicit-member-executor-observation.json');
    if (executorProof.authority === 'fixture') {
      pushIssue(issues, executorProof.fixture !== true, 'fixture executorProof.authority requires executorProof.fixture true');
      pushIssue(issues, executorObservation?.fixture !== true, 'fixture executorProof.authority requires fixture executor observation');
    }
    if (executorProof.authority === 'agent-runtime') {
      pushIssue(issues, executorProof.authoritySource !== 'adapter-observed', 'agent-runtime executorProof.authoritySource must be adapter-observed');
      pushIssue(issues, executorProof.fixture !== false, 'agent-runtime executorProof.fixture must be false');
      pushRequiredMatchIssue(issues, executorProof.inputDigest, executorInput?.inputDigest, 'executorProof.inputDigest must match explicit-member-executor-input.json inputDigest');
      pushRequiredMatchIssue(issues, executorProof.outputDigest, executorOutput?.answerDigest, 'executorProof.outputDigest must match explicit-member-executor-output.json answerDigest');
      pushRequiredMatchIssue(issues, executorProof.observedInputDigest, executorObservation?.inputDigest, 'executorProof.observedInputDigest must match executor observation input digest');
      pushRequiredMatchIssue(issues, executorProof.observedOutputDigest, executorObservation?.outputDigest, 'executorProof.observedOutputDigest must match executor observation output digest');
      pushRequiredStringIssue(issues, executorOutput?.kind, 'agent-runtime executorOutput.kind');
      pushIssue(issues, executorOutput?.kind === 'fixture', 'agent-runtime executorOutput.kind must not be fixture');
      pushIssue(issues, executorOutput?.fixture === true, 'agent-runtime executorOutput.fixture must not be true');
      pushIssue(issues, executorObservation?.authoritySource !== executorProof.authoritySource, 'executor observation authoritySource must match executorProof.authoritySource');
      pushIssue(issues, executorObservation?.fixture !== executorProof.fixture, 'executor observation fixture flag must match executorProof.fixture');
      if (executorProof.kind !== 'fixture' && executorProof.executorKind !== 'fixture') {
        pushIssue(issues, executorObservation?.executorKind !== executorProof.kind && executorObservation?.executorKind !== executorProof.executorKind, 'executor observation executorKind must match executorProof kind');
      }
      pushIssue(issues, !isNonEmptyString(executorProof.observationRef), `agent-runtime executorProof.observationRef must resolve to ${OBSERVATION_FILE}`);
      pushIssue(issues, !isNonEmptyString(executorProof.parentInvocationRef), 'agent-runtime executorProof.parentInvocationRef must prove parent invocation evidence');
      pushIssue(issues, !isNonEmptyString(executorObservation?.parentInvocationRef), 'agent-runtime executor observation parentInvocationRef must prove the same parent invocation evidence');
      pushRequiredStringIssue(issues, executorObservation?.invocationId, 'executor observation invocationId');
      pushRequiredStringIssue(issues, executorObservation?.status, 'executor observation status');
      pushRequiredCompletedStatusIssue(issues, executorObservation?.status, 'executor observation status');
      pushRequiredStringIssue(issues, executorObservation?.startedAt, 'executor observation startedAt');
      pushRequiredStringIssue(issues, executorObservation?.completedAt, 'executor observation completedAt');
      pushValidTimeIssue(issues, executorObservation?.startedAt, 'executor observation startedAt');
      pushValidTimeIssue(issues, executorObservation?.completedAt, 'executor observation completedAt');
      pushRequiredStringIssue(issues, executorObservation?.executionRef, 'executor observation executionRef');
      pushRequiredStringIssue(issues, executorObservation?.inputRef, 'executor observation inputRef');
      pushRequiredStringIssue(issues, executorObservation?.outputRef, 'executor observation outputRef');
      pushResolvedRefIssue(issues, executorObservation?.inputRef, observationPath, inputPath, 'executor observation inputRef must resolve to explicit-member-executor-input.json');
      pushResolvedRefIssue(issues, executorObservation?.outputRef, observationPath, outputPath, 'executor observation outputRef must resolve to explicit-member-executor-output.json');
      if (isNonEmptyString(executorProof.observationRef)) {
        pushIssue(issues, basename(observationPath) !== OBSERVATION_FILE, `agent-runtime executorProof.observationRef must resolve to ${OBSERVATION_FILE}`);
      }
      if (isNonEmptyString(executorProof.parentInvocationRef)) {
        pushIssue(issues, !isNonEmptyString(parentInvocationPath), 'agent-runtime executorProof.parentInvocationRef must resolve to readable parent invocation evidence');
        if (isNonEmptyString(parentInvocationPath)) {
          pushIssue(issues, resolveArtifactPath(executorProof.parentInvocationRef, artifact.__artifactSourcePath) !== parentInvocationPath, 'executorProof.parentInvocationRef must resolve to loaded parent invocation evidence');
          if (isNonEmptyString(executorObservation?.parentInvocationRef)) {
            pushIssue(issues, resolveArtifactPath(executorObservation.parentInvocationRef, observationPath) !== parentInvocationPath, 'executor observation parentInvocationRef must match executorProof.parentInvocationRef');
          }
        }
      }
      pushIssue(issues, parentInvocation?.kind !== PARENT_INVOCATION_KIND, `parent invocation evidence kind must be ${PARENT_INVOCATION_KIND}`);
      pushIssue(issues, parentInvocation?.route !== CASE_ID, `parent invocation evidence route must be ${CASE_ID}`);
      pushIssue(issues, parentInvocation?.sourceThreadId !== artifact.sourceThreadId, 'parent invocation evidence sourceThreadId must match artifact.sourceThreadId');
      pushRequiredStringIssue(issues, parentInvocation?.parentTurnId, 'parent invocation parentTurnId');
      pushRequiredStringIssue(issues, parentInvocation?.invocationId, 'parent invocation invocationId');
      pushRequiredStringIssue(issues, parentInvocation?.invocationSurface, 'parent invocation invocationSurface');
      pushIssue(issues, REJECTED_PARENT_INVOCATION_SURFACES.has(parentInvocation?.invocationSurface) || !ALLOWED_PARENT_INVOCATION_SURFACES.has(parentInvocation?.invocationSurface), 'parent invocation invocationSurface must prove an observed parent-agent call path');
      pushRequiredStringIssue(issues, parentInvocation?.observedCallPathRef, 'parent invocation observedCallPathRef parent source artifact');
      pushRequiredStringIssue(issues, parentInvocation?.observerKind, 'parent invocation observerKind');
      pushIssue(issues, !ALLOWED_PARENT_OBSERVERS.has(parentInvocation?.observerKind), 'parent invocation observerKind must be a parent-agent observer');
      pushIssue(issues, parentInvocation?.sourceKind !== 'observed-parent-agent-call', 'parent invocation sourceKind must be observed-parent-agent-call');
      pushProvenanceIssues(issues, parentInvocation?.provenanceRefs, 'parent invocation', { requireDigest: true });
      pushIssue(issues, !hasDigest(parentInvocation?.inputDigest), 'parent invocation requires exact non-wildcard inputDigest');
      pushIssue(issues, !hasDigest(parentInvocation?.expectedInputDigest), 'parent invocation requires exact non-wildcard expectedInputDigest');
      pushIssue(issues, hasDigest(parentInvocation?.inputDigest) && hasDigest(parentInvocation?.expectedInputDigest) && parentInvocation.inputDigest !== parentInvocation.expectedInputDigest, 'parent invocation expectedInputDigest must match inputDigest');
      pushIssue(issues, parentInvocation?.authorized !== true, 'parent invocation authorized must be true');
      pushRequiredStringIssue(issues, parentInvocation?.invokedAt, 'parent invocation invokedAt');
      pushRequiredStringIssue(issues, parentInvocation?.completedAt, 'parent invocation completedAt');
      pushValidTimeIssue(issues, parentInvocation?.invokedAt, 'parent invocation invokedAt');
      pushValidTimeIssue(issues, parentInvocation?.completedAt, 'parent invocation completedAt');
      pushRequiredStringIssue(issues, parentInvocation?.status, 'parent invocation status');
      pushRequiredCompletedStatusIssue(issues, parentInvocation?.status, 'parent invocation status');
      pushIssue(issues, parentInvocation?.returnedTo !== 'parent-agent', 'parent invocation returnedTo must be parent-agent');
      pushRequiredMatchIssue(issues, executorObservation?.invocationId, parentInvocation?.invocationId, 'executor observation invocationId must match parent invocation invocationId');
      pushIssue(issues, parentInvocation?.memberName !== run?.memberName, 'parent invocation evidence memberName must match memberTaskRun.memberName');
      pushIssue(issues, parentInvocation?.resolvedMemberId !== run?.resolvedMemberId, 'parent invocation evidence resolvedMemberId must match memberTaskRun.resolvedMemberId');
      if (isNonEmptyString(parentInvocation?.executorInputRef)) {
        pushIssue(issues, resolveArtifactPath(parentInvocation.executorInputRef, parentInvocationPath) !== inputPath, 'parent invocation executorInputRef must resolve to explicit-member-executor-input.json');
      } else {
        issues.push('parent invocation evidence requires executorInputRef');
      }
      if (isNonEmptyString(parentInvocation?.executorObservationRef)) {
        pushIssue(issues, resolveArtifactPath(parentInvocation.executorObservationRef, parentInvocationPath) !== observationPath, 'parent invocation executorObservationRef must resolve to explicit-member-executor-observation.json');
      } else {
        issues.push('parent invocation evidence requires executorObservationRef');
      }
      pushIssue(issues, parentInvocation?.inputDigest !== executorInput?.inputDigest, 'parent invocation inputDigest must match executor input digest');
      pushIssue(
        issues,
        resolvedPathOrNull(executorProof.parentInvocationRef, artifact.__artifactSourcePath) !== resolvedPathOrNull(executorObservation?.parentInvocationRef, observationPath),
        'executorProof parentInvocationRef must match executor observation parentInvocationRef',
      );
      pushIssue(issues, parentSource?.kind !== PARENT_SOURCE_KIND, `parent source artifact kind must be ${PARENT_SOURCE_KIND}`);
      pushIssue(issues, parentSource?.route !== CASE_ID, `parent source artifact route must be ${CASE_ID}`);
      pushIssue(issues, parentSource?.sourceThreadId !== parentInvocation?.sourceThreadId, 'parent source sourceThreadId must match parent invocation sourceThreadId');
      pushIssue(issues, parentSource?.parentTurnId !== parentInvocation?.parentTurnId, 'parent source parentTurnId must match parent invocation parentTurnId');
      pushIssue(issues, parentSource?.invocationId !== parentInvocation?.invocationId, 'parent source invocationId must match parent invocation invocationId');
      pushIssue(issues, parentSource?.invocationSurface !== parentInvocation?.invocationSurface, 'parent source invocationSurface must match parent invocation invocationSurface');
      pushIssue(issues, !ALLOWED_PARENT_OBSERVERS.has(parentSource?.observerKind), 'parent source observerKind must be a parent-agent observer');
      pushIssue(issues, REJECTED_PARENT_INVOCATION_SURFACES.has(parentSource?.observerSurface) || !ALLOWED_PARENT_INVOCATION_SURFACES.has(parentSource?.observerSurface), 'parent source observerSurface must prove an observed parent-agent surface');
      const testEligibilityOnly = artifact.testEligibilityOnly === true;
      if (!testEligibilityOnly) {
        pushIssue(issues, parentSource?.sourceKind !== 'observed-parent-agent-call', 'parent source sourceKind must be observed-parent-agent-call, not fixture');
        pushIssue(issues, parentInvocation?.sourceKind !== parentSource?.sourceKind, 'parent invocation sourceKind must match parent source sourceKind');
        pushIssue(issues, !hasDigest(parentSource?.expectedInputDigest), 'parent source requires exact non-wildcard expectedInputDigest');
        pushIssue(issues, hasDigest(parentSource?.expectedInputDigest) && parentSource.expectedInputDigest !== executorInput?.inputDigest, 'parent source expectedInputDigest must match executor input digest');
        pushRequiredStringIssue(issues, parentSource?.parentCallRecordRef, 'parent source parentCallRecordRef');
        if (parentCallRecord && typeof parentCallRecord === 'object' && !Array.isArray(parentCallRecord)) {
          const parentCallDigest = createParentCallRecordDigest(parentCallRecord);
          for (const [index, provenanceRef] of (Array.isArray(parentInvocation?.provenanceRefs) ? parentInvocation.provenanceRefs : []).entries()) {
            pushIssue(issues, provenanceRef?.digest !== parentCallDigest, `parent invocation provenanceRefs[${index}].digest must match parent call record digest`);
          }
          for (const [index, provenanceRef] of (Array.isArray(parentSource?.provenanceRefs) ? parentSource.provenanceRefs : []).entries()) {
            pushIssue(issues, provenanceRef?.digest !== parentCallDigest, `parent source provenanceRefs[${index}].digest must match parent call record digest`);
          }
        } else {
          issues.push('parent source parent call record must be readable for product-grade proof');
        }
      }
      pushIssue(issues, parentSource?.memberName !== run?.memberName, 'parent source memberName must match memberTaskRun.memberName');
      pushIssue(issues, parentSource?.resolvedMemberId !== run?.resolvedMemberId, 'parent source resolvedMemberId must match memberTaskRun.resolvedMemberId');
      pushProvenanceIssues(issues, parentSource?.provenanceRefs, 'parent source', { requireDigest: !testEligibilityOnly });
      pushResolvedRefIssue(issues, parentInvocation?.observedCallPathRef, parentInvocationPath, parentSource?.__resolvedPath, 'parent invocation observedCallPathRef must resolve to parent source artifact');
      pushTimeOrderIssue(issues, parentInvocation?.invokedAt, executorObservation?.startedAt, 'timing order requires parent invocation invokedAt <= executor observation startedAt');
      pushTimeOrderIssue(issues, executorObservation?.startedAt, executorObservation?.completedAt, 'timing order requires executor observation startedAt <= completedAt');
      pushTimeOrderIssue(issues, executorObservation?.completedAt, parentInvocation?.completedAt, 'timing order requires executor observation completedAt <= parent invocation completedAt');
    }
  }

  if (materialProofMode === 'legacy-answer-canary') {
    const canaryFailure = decideCanaryVerdict(expectedCanaries, forbiddenCanaries, observedAnswerCanaries);
    if (canaryFailure) issues.push(canaryFailure);
  }
  return issues;
}

export async function explicitMemberActivationCaseResultFromArtifact(artifact, { canaries }) {
  if (!artifact || typeof artifact !== 'object') throw new Error('required object: artifact');
  if (artifact.artifactKind !== ARTIFACT_KIND) throw new Error(`unknown explicit member activation artifactKind: ${artifact.artifactKind}`);
  requireString(artifact.caseId, 'artifact.caseId');
  requireString(artifact.sourceThreadId, 'artifact.sourceThreadId');
  requireString(artifact.reviewerPrompt, 'artifact.reviewerPrompt');

  const audit = auditPromptForLeaks(artifact.reviewerPrompt, canaries);
  if (audit.leaked) throw new Error(`prompt leak detected: ${audit.leaks.join(', ')}`);

  const lifecycle = await loadLifecycle(artifact);
  const run = lifecycle.run;
  const request = lifecycle.request;
  const expectedCanaries = expectedCanariesForCase(artifact.caseId, canaries);
  const forbiddenCanaries = forbiddenCanariesForCase(artifact.caseId, canaries);
  const sourcePath = isNonEmptyString(artifact.__artifactSourcePath) ? artifact.__artifactSourcePath : undefined;

  let executorInput = {};
  let executorOutput = {};
  let executorObservation = {};
  let parentInvocation = {};
  let parentSource = {};
  let parentCallRecord = {};
  let memberInvocationPacket = {};
  let inputPath = '';
  let outputPath = '';
  let observationPath = '';
  let parentInvocationPath = '';
  let memberInvocationPacketPath = '';
  const loadIssues = [];
  const inputRef = artifact?.artifactRefs?.executorInputPath;
  if (isNonEmptyString(inputRef)) {
    try {
      const loaded = await loadJsonArtifact(inputRef, 'artifact.artifactRefs.executorInputPath', { relativeTo: sourcePath });
      executorInput = loaded.parsed;
      inputPath = loaded.resolvedRef;
    } catch (error) {
      loadIssues.push(error.message);
    }
  } else if (artifact.executorProof?.authority === 'agent-runtime') {
    loadIssues.push('agent-runtime explicit route requires artifact.artifactRefs.executorInputPath');
  }
  const packetRef = artifact?.artifactRefs?.memberInvocationPacketPath ?? request?.memberInvocationPacketRef;
  if (isNonEmptyString(packetRef)) {
    try {
      const loaded = await loadJsonArtifact(packetRef, 'artifact.artifactRefs.memberInvocationPacketPath', { relativeTo: sourcePath });
      memberInvocationPacket = loaded.parsed;
      memberInvocationPacketPath = loaded.resolvedRef;
    } catch (error) {
      loadIssues.push(error.message);
    }
  } else if (artifact.executorProof?.authority === 'agent-runtime') {
    loadIssues.push(`authorized-explicit-member-activation requires ${PACKET_FILE} evidence`);
  }
  if (run?.result?.resultRef) {
    try {
      const loaded = await loadJsonArtifact(run.result.resultRef, 'memberTaskRun.result.resultRef', { relativeTo: lifecycle.runPath ?? sourcePath });
      executorOutput = loaded.parsed;
      outputPath = loaded.resolvedRef;
    } catch (error) {
      loadIssues.push(error.message);
    }
  } else {
    loadIssues.push('memberTaskRun.result.resultRef is required');
  }
  if (isNonEmptyString(artifact?.executorProof?.observationRef)) {
    try {
      const loaded = await loadJsonArtifact(artifact.executorProof.observationRef, 'executorProof.observationRef', { relativeTo: sourcePath });
      executorObservation = loaded.parsed;
      observationPath = loaded.resolvedRef;
    } catch (error) {
      loadIssues.push(error.message);
    }
  }
  if (isNonEmptyString(artifact?.executorProof?.parentInvocationRef)) {
    try {
      const loaded = await loadJsonArtifact(artifact.executorProof.parentInvocationRef, 'executorProof.parentInvocationRef', { relativeTo: sourcePath });
      parentInvocation = loaded.parsed;
      parentInvocationPath = loaded.resolvedRef;
    } catch (error) {
      if (artifact.executorProof?.authority === 'agent-runtime') loadIssues.push(error.message);
    }
  }
  if (artifact.executorProof?.authority === 'agent-runtime' && isNonEmptyString(parentInvocation?.observedCallPathRef)) {
    try {
      const loaded = await loadJsonArtifact(parentInvocation.observedCallPathRef, 'parentInvocation.observedCallPathRef', { relativeTo: parentInvocationPath || sourcePath });
      parentSource = { ...loaded.parsed, __resolvedPath: loaded.resolvedRef };
      if (isNonEmptyString(parentSource.parentCallRecordRef)) {
        const parentCallRecordLoaded = await loadJsonArtifact(parentSource.parentCallRecordRef, 'parentSource.parentCallRecordRef', { relativeTo: loaded.resolvedRef });
        parentCallRecord = parentCallRecordLoaded.parsed;
      }
    } catch (error) {
      loadIssues.push(error.message);
    }
  } else if (artifact.executorProof?.authority === 'agent-runtime') {
    loadIssues.push('agent-runtime explicit route requires parentInvocation.observedCallPathRef parent source artifact');
  }

  const routeIssues = run && request
    ? validateExplicitRoute({
      artifact,
      run,
      request,
      runPath: lifecycle.runPath,
      requestPath: lifecycle.requestPath,
      inputPath,
      outputPath,
      observationPath,
      parentInvocationPath,
      memberInvocationPacketPath,
      executorInput,
      executorOutput,
      executorObservation,
      parentInvocation,
      parentSource,
      parentCallRecord,
      memberInvocationPacket,
      expectedCanaries,
      forbiddenCanaries,
      canaries,
    })
    : [];
  const issues = [...(lifecycle.lifecycleVerdict.issues ?? []), ...loadIssues, ...routeIssues];
  const mechanismPass = issues.length === 0;
  const activationPass = mechanismPass
    && artifact.executorProof?.authority === 'agent-runtime'
    && artifact.executorProof?.authoritySource === 'adapter-observed'
    && artifact.executorProof?.fixture === false
    && artifact.executorProof?.kind !== 'fixture'
    && artifact.testEligibilityOnly !== true
    && isNonEmptyString(executorOutput?.kind)
    && executorOutput.kind !== 'fixture'
    && executorOutput.fixture !== true;
  const verdict = mechanismPass ? 'pass' : 'fail';

  const evidenceRefs = [
    { kind: 'prompt-audit', ref: 'prompt-audit:explicit-member-activation', contains: [], missing: Object.values(canaries), leaked: false },
  ];
  if (isNonEmptyString(outputPath)) evidenceRefs.push({ kind: 'explicit-member-executor-output', ref: outputPath });
  if (isNonEmptyString(observationPath)) evidenceRefs.push({ kind: 'explicit-member-executor-observation', ref: observationPath });

  const manifest = createCaptureManifest({
    verdict,
    recoveryMethod: verdict === 'pass' ? 'context-tree-explicit-member-executor' : 'summary-only',
    sourceThreadId: artifact.sourceThreadId,
    boundary: 'unknown',
    codexApi: 'mock',
    transformLayers: [],
    knownLosses: ['explicit member activation is not native spawn evidence'],
    evidenceRefs,
    compatFallback: true,
  });

  return {
    caseId: artifact.caseId,
    sourceThreadId: artifact.sourceThreadId,
    memberName: run?.memberName,
    requestedMember: artifact.requestedMember ?? request?.memberName,
    resolvedMemberId: run?.resolvedMemberId,
    expectedCanaries,
    forbiddenCanaries,
    observedAnswer: executorOutput?.answer,
    acceptanceTier: artifact.acceptanceTier,
    executorProof: artifact.executorProof ?? null,
    lifecycleVerdict: {
      ...lifecycle.lifecycleVerdict,
      status: issues.length > 0 ? 'fail' : lifecycle.lifecycleVerdict.status,
      issues,
    },
    explicitMemberMechanismPass: mechanismPass,
    explicitMemberActivationPass: activationPass,
    productAcceptance: activationPass ? 'pass' : 'not-run',
    verdict,
    failureReason: mechanismPass ? null : issues.join('; '),
    manifest: { ...manifest, verdict },
    evidenceRefs,
  };
}
