import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  auditPromptForLeaks,
  expectedCanariesForCase,
  forbiddenCanariesForCase,
} from './canaries.mjs';
import { createCaptureManifest } from '../core/manifest.mjs';
import { applyEvidenceGate } from './verdicts.mjs';

const ARTIFACT_KIND = 'codex-native-spawn-capability-artifact';
const PROVIDER_CACHE_EVIDENCE_KINDS = new Set(['provider-cache', 'model-request']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

function codexApiForForkMode(forkMode) {
  if (forkMode === 'fork_context') return 'multiagent-v1-fork_context';
  if (forkMode === 'fork_turns_all') return 'multiagent-v2-fork_turns';
  throw new Error(`unknown native spawn forkMode: ${forkMode}`);
}

function observedCanariesFromText(text, canaries) {
  return Object.values(canaries).filter((canary) => String(text).includes(canary));
}

function appendKnownLoss(knownLosses, loss) {
  return knownLosses.includes(loss) ? knownLosses : [...knownLosses, loss];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function captureManifestEvidenceRefs(evidenceRefs) {
  return evidenceRefs.filter((ref) => ref.kind !== 'history-search');
}

function defaultArtifactEvidenceSource(artifact) {
  return isNonEmptyString(artifact?.acceptanceMode)
    ? artifact.acceptanceMode
    : 'native-spawn-artifact';
}

function requireCheckpointAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) {
    throw new Error('artifact.checkpointAnchor must be an object');
  }
  requireString(anchor.createdAt, 'artifact.checkpointAnchor.createdAt');
  if (anchor.createdAt === '1970-01-01T00:00:00.000Z') {
    throw new Error('artifact.checkpointAnchor must not use a placeholder createdAt');
  }

  const hasAnchorId =
    isNonEmptyString(anchor.turnId) ||
    isNonEmptyString(anchor.messageId) ||
    isNonEmptyString(anchor.checkpointId);

  if (!hasAnchorId) {
    throw new Error('artifact.checkpointAnchor requires turnId, messageId, or checkpointId');
  }
}

function resolveArtifactPath(ref, relativeTo) {
  requireString(ref, 'artifact ref');
  if (isAbsolute(ref)) return ref;
  if (typeof relativeTo === 'string' && relativeTo.trim().length > 0) {
    return resolve(dirname(relativeTo), ref);
  }
  return resolve(ref);
}

async function loadJsonArtifact(ref, label, options = {}) {
  requireString(ref, label);
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

function collectMaterialRefsByVisibility(run, visibilities) {
  const refs = new Set();
  const items = Array.isArray(run?.materials?.items) ? run.materials.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (!visibilities.has(item.visibility)) continue;
    if (isNonEmptyString(item.materialRef)) refs.add(item.materialRef);
    if (isNonEmptyString(item.sourceRef)) refs.add(item.sourceRef);
  }
  return refs;
}

function collectSelectionVisibleRefs(selectionReport) {
  return [
    ...(Array.isArray(selectionReport.baselineRefs) ? selectionReport.baselineRefs : []),
    ...(Array.isArray(selectionReport.invocationRequestedRefs) ? selectionReport.invocationRequestedRefs : []),
  ];
}

function pushLifecycleIssue(issues, condition, message) {
  if (condition) issues.push(message);
}

function isKebabCaseMemberName(value) {
  return isNonEmptyString(value) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

function validateAuthorizedNaturalMemberActivation(artifact, memberTaskRun, memberTaskRequest, render, selectionReport) {
  const issues = [];
  if (artifact?.acceptanceTier?.id !== 'authorized-natural-native-spawn') {
    issues.push('authorized-natural-member-activation requires acceptanceTier.id=authorized-natural-native-spawn');
  }
  if (artifact?.acceptanceMode !== 'authorized-natural-native-spawn') {
    issues.push('authorized-natural-member-activation requires acceptanceMode=authorized-natural-native-spawn');
  }
  if (artifact?.providerForcedLiveProof === true || artifact?.deterministicProviderProof === true) {
    issues.push('authorized-natural-member-activation must not use provider-forced or deterministic provider proof');
  }
  if (!isKebabCaseMemberName(memberTaskRun?.memberName)) {
    issues.push('authorized-natural-member-activation requires non-empty kebab-case memberTaskRun.memberName');
  }
  if (!isNonEmptyString(memberTaskRun?.resolvedMemberId)) {
    issues.push('authorized-natural-member-activation requires memberTaskRun.resolvedMemberId');
  }
  if (memberTaskRequest !== undefined && memberTaskRun?.memberName !== memberTaskRequest.memberName) {
    issues.push('memberTaskRun.memberName must match memberTaskRequest.memberName');
  }
  if (memberTaskRequest !== undefined && memberTaskRun?.resolvedMemberId !== memberTaskRequest.resolvedMemberId) {
    issues.push('memberTaskRun.resolvedMemberId must match memberTaskRequest.resolvedMemberId');
  }
  if (render !== undefined && memberTaskRun?.memberName !== render.memberName) {
    issues.push('memberTaskRun.memberName must match memberContextRender.memberName');
  }
  if (selectionReport !== undefined && memberTaskRun?.memberName !== selectionReport.memberName) {
    issues.push('memberTaskRun.memberName must match materialSelectionReport.memberName');
  }
  if (memberTaskRun?.result?.returnedTo !== 'parent-agent') {
    issues.push('authorized-natural-member-activation requires result.returnedTo=parent-agent');
  }
  if (memberTaskRun?.materialSelectionMode === 'summary-only') {
    issues.push('authorized-natural-member-activation must not use summary-only material selection');
  }
  return issues;
}

async function validateLifecycleOracleFromArtifact(artifact) {
  const memberTaskRunPath = artifact?.artifactRefs?.memberTaskRunPath;
  const artifactSourcePath = isNonEmptyString(artifact?.__artifactSourcePath)
    ? artifact.__artifactSourcePath
    : undefined;
  if (!isNonEmptyString(memberTaskRunPath)) {
    if (artifact?.caseId === 'authorized-natural-member-activation') {
      return {
        status: 'fail',
        checked: true,
        issues: [
          'authorized-natural-member-activation requires artifact.artifactRefs.memberTaskRunPath to prove the member lifecycle path',
        ],
      };
    }
    return {
      status: 'not-run',
      checked: false,
      issues: [],
    };
  }

  const issues = [];
  const memberTaskRequestPath = isNonEmptyString(artifact?.artifactRefs?.memberTaskRequestPath)
    ? artifact.artifactRefs.memberTaskRequestPath
    : undefined;

  const { parsed: run, resolvedRef: resolvedRunPath } = await loadJsonArtifact(
    memberTaskRunPath,
    'artifact.artifactRefs.memberTaskRunPath',
    { relativeTo: artifactSourcePath },
  );
  const request = memberTaskRequestPath
    ? await loadJsonArtifact(memberTaskRequestPath, 'artifact.artifactRefs.memberTaskRequestPath', { relativeTo: artifactSourcePath })
    : undefined;
  const resolvedRequestPath = request?.resolvedRef;
  const requestRecord = request?.parsed;

  pushLifecycleIssue(
    issues,
    requestRecord !== undefined && resolveArtifactPath(run.memberTaskRequestRef, resolvedRunPath) !== resolvedRequestPath,
    'memberTaskRun.memberTaskRequestRef must match artifact.artifactRefs.memberTaskRequestPath',
  );

  const renderPath = resolveArtifactPath(run.memberContextRenderRef, resolvedRunPath);
  const selectionPath = resolveArtifactPath(run.materialSelectionReportRef, resolvedRunPath);

  pushLifecycleIssue(
    issues,
    !isNonEmptyString(renderPath) || !String(renderPath).endsWith('member-context-render.json'),
    'memberTaskRun.memberContextRenderRef must point to a real member-context-render.json artifact',
  );
  pushLifecycleIssue(
    issues,
    !isNonEmptyString(selectionPath) || !String(selectionPath).endsWith('material-selection-report.json'),
    'memberTaskRun.materialSelectionReportRef must point to a real material-selection-report.json artifact',
  );

  if (issues.length > 0) {
    return {
      status: 'fail',
      checked: true,
      issues,
    };
  }

  const { parsed: render, resolvedRef: resolvedRenderPath } = await loadJsonArtifact(
    run.memberContextRenderRef,
    'memberTaskRun.memberContextRenderRef',
    { relativeTo: resolvedRunPath },
  );
  const { parsed: selectionReport, resolvedRef: resolvedSelectionPath } = await loadJsonArtifact(
    run.materialSelectionReportRef,
    'memberTaskRun.materialSelectionReportRef',
    { relativeTo: resolvedRunPath },
  );

  pushLifecycleIssue(
    issues,
    requestRecord !== undefined
      && resolveArtifactPath(requestRecord.memberContextRenderRef, resolvedRequestPath) !== resolvedRenderPath,
    'memberTaskRequest.memberContextRenderRef must match memberTaskRun.memberContextRenderRef',
  );
  pushLifecycleIssue(
    issues,
    requestRecord !== undefined
      && resolveArtifactPath(requestRecord.materialSelectionReportRef, resolvedRequestPath) !== resolvedSelectionPath,
    'memberTaskRequest.materialSelectionReportRef must match memberTaskRun.materialSelectionReportRef',
  );
  pushLifecycleIssue(
    issues,
    requestRecord !== undefined && requestRecord.baselineDigest !== undefined && run.baselineDigest !== requestRecord.baselineDigest,
    'memberTaskRun.baselineDigest must match memberTaskRequest.baselineDigest',
  );
  pushLifecycleIssue(
    issues,
    requestRecord !== undefined && requestRecord.deltaDigest !== undefined && run.deltaDigest !== requestRecord.deltaDigest,
    'memberTaskRun.deltaDigest must match memberTaskRequest.deltaDigest',
  );
  pushLifecycleIssue(
    issues,
    requestRecord !== undefined
      && requestRecord.baselineReuseStatus !== undefined
      && run.baselineReuseStatus !== requestRecord.baselineReuseStatus,
    'memberTaskRun.baselineReuseStatus must match memberTaskRequest.baselineReuseStatus',
  );

  pushLifecycleIssue(
    issues,
    resolveArtifactPath(render.selectionReportRef, resolvedRenderPath) !== resolvedSelectionPath,
    'memberContextRender.selectionReportRef must match memberTaskRun.materialSelectionReportRef',
  );
  pushLifecycleIssue(
    issues,
    run.baselineDigest !== render.baselineDigest,
    'memberTaskRun.baselineDigest must match memberContextRender.baselineDigest',
  );
  pushLifecycleIssue(
    issues,
    run.deltaDigest !== render.deltaDigest,
    'memberTaskRun.deltaDigest must match memberContextRender.deltaDigest',
  );
  pushLifecycleIssue(
    issues,
    run.baselineReuseStatus !== render.baselineReuseStatus,
    'memberTaskRun.baselineReuseStatus must match memberContextRender.baselineReuseStatus',
  );
  pushLifecycleIssue(
    issues,
    run.baselineVersion !== undefined && run.baselineVersion !== render.baselineVersion,
    'memberTaskRun.baselineVersion must match memberContextRender.baselineVersion',
  );

  if (run.baselineReuseStatus === 'provider-cache-hit') {
    const evidenceRefs = Array.isArray(run.baselineReuseEvidenceRefs) ? run.baselineReuseEvidenceRefs : [];
    pushLifecycleIssue(
      issues,
      !evidenceRefs.some((ref) => PROVIDER_CACHE_EVIDENCE_KINDS.has(ref?.kind)),
      'baselineReuseStatus=provider-cache-hit requires provider-cache or model-request evidence',
    );
  }

  const intendedVisibleRefs = collectMaterialRefsByVisibility(run, new Set([
    'intended-model-input',
    'runtime-input-observed',
    'provider-model-input-observed',
  ]));
  const finalSelectionRefs = new Set(collectSelectionVisibleRefs(selectionReport));

  for (const ref of finalSelectionRefs) {
    if (!intendedVisibleRefs.has(ref)) {
      issues.push('selectionReport baselineRefs/invocationRequestedRefs must align with MemberTaskRun.materials.items model-visible refs');
      break;
    }
  }
  for (const ref of intendedVisibleRefs) {
    if (!finalSelectionRefs.has(ref)) {
      issues.push('MemberTaskRun.materials.items model-visible refs must align with selectionReport baselineRefs/invocationRequestedRefs');
      break;
    }
  }

  const nonVisibleRefs = new Set([
    ...(Array.isArray(selectionReport.searchableRefs) ? selectionReport.searchableRefs : []),
    ...(Array.isArray(selectionReport.sourceOnlyRefs) ? selectionReport.sourceOnlyRefs : []),
  ]);
  for (const ref of nonVisibleRefs) {
    if (intendedVisibleRefs.has(ref)) {
      issues.push('searchable/sourceOnly refs must not be counted as model-visible in MemberTaskRun.materials.items');
      break;
    }
  }

  if (artifact?.caseId === 'authorized-natural-member-activation') {
    issues.push(...validateAuthorizedNaturalMemberActivation(artifact, run, requestRecord, render, selectionReport));
  }

  return {
    status: issues.length > 0 ? 'fail' : 'pass',
    checked: true,
    issues,
  };
}

function decideArtifactVerdict({ expectedCanaries, forbiddenCanaries, observedCanaries }) {
  const leaked = forbiddenCanaries.some((canary) => observedCanaries.includes(canary));
  if (leaked) {
    return {
      verdict: 'fail',
      failureReason: 'negative control leaked canary',
      leakedCanary: true,
    };
  }

  const missing = expectedCanaries.filter((canary) => !observedCanaries.includes(canary));
  if (missing.length > 0) {
    return {
      verdict: 'fail',
      failureReason: `missing expected canary: ${missing.join(', ')}`,
      leakedCanary: false,
    };
  }

  return { verdict: 'pass', failureReason: null, leakedCanary: false };
}

export async function nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode }) {
  if (!artifact || typeof artifact !== 'object') throw new Error('required object: artifact');
  if (artifact.artifactKind !== ARTIFACT_KIND) {
    throw new Error(`unknown native spawn artifactKind: ${artifact.artifactKind}`);
  }

  requireString(artifact.caseId, 'artifact.caseId');
  if (artifact.caseId === 'authorized-explicit-member-activation') {
    throw new Error('authorized-explicit-member-activation is an explicit route artifact and cannot be ingested as native spawn proof');
  }
  requireString(artifact.sourceThreadId, 'artifact.sourceThreadId');
  requireString(artifact.spawnedAgentId, 'artifact.spawnedAgentId');
  requireString(artifact.forkMode, 'artifact.forkMode');
  requireString(artifact.reviewerPrompt, 'artifact.reviewerPrompt');
  requireString(artifact.observedAnswer, 'artifact.observedAnswer');
  requireArray(artifact.evidenceRefs, 'artifact.evidenceRefs');

  requireCheckpointAnchor(artifact.checkpointAnchor);

  if (artifact.materialSelectionMode === 'searchable-history') {
    if (!isNonEmptyString(artifact.searchableHistoryRef)) {
      throw new Error('searchable-history artifact requires searchableHistoryRef');
    }
    if (!artifact.evidenceRefs.some((ref) => ref?.kind === 'history-search')) {
      throw new Error('searchable-history artifact requires history-search evidence');
    }
  }

  const audit = auditPromptForLeaks(artifact.reviewerPrompt, canaries);
  if (audit.leaked) {
    throw new Error(`prompt leak detected: ${audit.leaks.join(', ')}`);
  }

  const expectedCanaries = expectedCanariesForCase(artifact.caseId, canaries);
  const forbiddenCanaries = forbiddenCanariesForCase(artifact.caseId, canaries);
  const observedCanaries = observedCanariesFromText(artifact.observedAnswer, canaries);
  const decision = decideArtifactVerdict({ expectedCanaries, forbiddenCanaries, observedCanaries });
  const evidenceRefs = [
    {
      kind: 'prompt-audit',
      ref: 'prompt-audit:native-spawn-artifact',
      contains: [],
      missing: Object.values(canaries),
      leaked: false,
    },
    ...artifact.evidenceRefs,
  ];

  let knownLosses = [
    'no model KV/cache',
    'no provider prompt cache',
  ];
  for (const loss of artifact.knownLosses ?? []) {
    knownLosses = appendKnownLoss(knownLosses, loss);
  }

  const manifest = createCaptureManifest({
    verdict: decision.verdict,
    recoveryMethod: 'codex-spawn-agent-full-history',
    sourceThreadId: artifact.sourceThreadId,
    spawnedThreadId: artifact.spawnedAgentId,
    boundary: artifact.boundary ?? 'current-stable-turn',
    codexApi: codexApiForForkMode(artifact.forkMode),
    transformLayers: artifact.transformLayers ?? [],
    knownLosses,
    evidenceRefs: captureManifestEvidenceRefs(evidenceRefs),
  });

  const base = {
    caseId: artifact.caseId,
    sourceThreadId: artifact.sourceThreadId,
    forkedThreadId: artifact.spawnedAgentId,
    method: 'codex-spawn-agent-full-history',
    expectedCanaries,
    forbiddenCanaries,
    observedAnswer: artifact.observedAnswer,
    evidenceRefs,
    knownLosses,
    checkpointAnchor: artifact.checkpointAnchor,
    acceptanceTier: artifact.acceptanceTier,
    reviewerRuntimeDiagnosis: artifact.reviewerRuntimeDiagnosis ?? null,
    materialSelectionMode: artifact.materialSelectionMode ?? 'native-fork',
    fidelity: artifact.fidelity ?? 'native-context-fork',
    searchableHistoryRef: artifact.searchableHistoryRef,
    verdict: decision.verdict,
    failureReason: decision.failureReason,
    manifest,
    leakedCanary: decision.leakedCanary,
  };

  const lifecycleVerdict = await validateLifecycleOracleFromArtifact(artifact);
  base.lifecycleVerdict = lifecycleVerdict;
  if (lifecycleVerdict.status === 'fail') {
    base.verdict = 'fail';
    base.failureReason = lifecycleVerdict.issues.join('; ');
    base.manifest = {
      ...base.manifest,
      verdict: 'fail',
    };
  }

  const gated = applyEvidenceGate(base, { mode });
  const finalKnownLosses = gated.manifest.knownLosses;
  const finalEvidenceRefs = mode === 'mock'
    ? evidenceRefs.map((ref) => ({
      ...ref,
      source: ref.source ?? defaultArtifactEvidenceSource(artifact),
    }))
    : evidenceRefs;
  return {
    ...base,
    evidenceRefs: finalEvidenceRefs,
    knownLosses: finalKnownLosses,
    verdict: gated.verdict,
    failureReason: gated.failureReason ?? null,
    manifest: {
      ...gated.manifest,
      verdict: gated.verdict,
      knownLosses: finalKnownLosses,
    },
  };
}
