import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-system-e2e-eval.mjs');
const PRODUCT_CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-discovery-product.mjs');
const msgDigest1 = sha256Text('ask skill-designer to review routing');
const msgDigest2 = sha256Text('skill-designer should check responsibilities again');

function runEval(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
}

function runProduct(args) {
  return spawnSync(process.execPath, [PRODUCT_CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function assertProductObservedProofRef(outputDir, productRoot, chain) {
  const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
  const proofRefPath = join(outputDir, 'artifacts/product/product-observed-proof-ref.json');
  const proofRef = readJson(proofRefPath);
  assert.equal(report.productObserved.proofRef, 'artifacts/product/product-observed-proof-ref.json');
  assert.equal(report.artifacts.productObservedProofRef, 'artifacts/product/product-observed-proof-ref.json');
  assert.equal(proofRef.productRoot, productRoot);
  assert.equal(proofRef.evidenceKind, 'observed-parent-agent-call');
  assert.deepEqual(proofRef.artifactRefs, {
    memberTaskRun: 'member-task-run.json',
    parentInvocation: 'explicit-member-parent-invocation.json',
    parentSource: 'explicit-member-parent-invocation-source.json',
    parentCallRecord: 'parent-call-record.json',
    observedTranscript: 'observed-parent-call-transcript.json',
  });
  assert.equal(proofRef.memberTaskRunDigest, sha256Text(readFileSync(join(productRoot, 'member-task-run.json'), 'utf8')));
  assert.equal(proofRef.parentInvocationDigest, sha256Text(readFileSync(join(productRoot, 'explicit-member-parent-invocation.json'), 'utf8')));
  assert.equal(proofRef.parentSourceDigest, sha256Text(readFileSync(join(productRoot, 'explicit-member-parent-invocation-source.json'), 'utf8')));
  assert.equal(proofRef.parentCallRecordFileDigest, sha256Text(readFileSync(join(productRoot, 'parent-call-record.json'), 'utf8')));
  assert.equal(proofRef.observedTranscriptDigest, sha256Text(readFileSync(join(productRoot, 'observed-parent-call-transcript.json'), 'utf8')));
  assert.equal(proofRef.parentCallRecordDigest, sha256Json(chain.parentCallRecord));
}

function writeObservedProductChain(productRoot, overrides = {}) {
  const parentCallRecord = {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'ses_productRoot1234567890',
    parentTurnId: 'msg_productRoot1234567890',
    invocationId: 'call_productRoot1234567890',
    invocationSurface: 'cli-called-by-agent',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: 'sha256:inputdigest123',
    observedAt: '2026-07-09T14:54:19.915Z',
    rawCall: {
      callId: 'call_productRoot1234567890',
      source: 'opencode-parent-call-exporter',
      ref: 'opencode-session:ses_productRoot1234567890:msg_productRoot1234567890:call_productRoot1234567890',
      sessionExportRef: './opencode-session-export.json',
      sessionMessageId: 'msg_productRoot1234567890',
      sessionPartId: 'prt_productRoot1234567890',
    },
    ...(overrides.parentCallRecord ?? {}),
  };
  const parentCallDigest = overrides.parentCallDigest ?? sha256Json(parentCallRecord);
  const parentSource = {
    kind: 'explicit-member-parent-invocation-source',
    observerKind: parentCallRecord.observerKind,
    observerSurface: parentCallRecord.observerSurface,
    sourceThreadId: parentCallRecord.sourceThreadId,
    parentTurnId: parentCallRecord.parentTurnId,
    invocationId: parentCallRecord.invocationId,
    invocationSurface: parentCallRecord.invocationSurface,
    route: parentCallRecord.route,
    memberName: parentCallRecord.memberName,
    resolvedMemberId: parentCallRecord.resolvedMemberId,
    expectedInputDigest: parentCallRecord.expectedInputDigest,
    sourceKind: 'observed-parent-agent-call',
    parentCallRecordRef: './parent-call-record.json',
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: './parent-call-record.json', digest: parentCallDigest }],
    observedAt: parentCallRecord.observedAt,
    ...(overrides.parentSource ?? {}),
  };
  const parentInvocation = {
    kind: 'explicit-member-parent-invocation',
    route: parentCallRecord.route,
    sourceThreadId: parentCallRecord.sourceThreadId,
    parentTurnId: parentCallRecord.parentTurnId,
    invocationId: parentCallRecord.invocationId,
    invocationSurface: parentCallRecord.invocationSurface,
    authorized: true,
    memberName: parentCallRecord.memberName,
    resolvedMemberId: parentCallRecord.resolvedMemberId,
    observedCallPathRef: './explicit-member-parent-invocation-source.json',
    observerKind: parentCallRecord.observerKind,
    sourceKind: 'observed-parent-agent-call',
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: './parent-call-record.json', digest: parentCallDigest }],
    inputDigest: parentCallRecord.expectedInputDigest,
    expectedInputDigest: parentCallRecord.expectedInputDigest,
    invokedAt: parentCallRecord.observedAt,
    completedAt: '2026-07-09T14:55:25.569Z',
    status: 'completed',
    returnedTo: 'parent-agent',
    ...(overrides.parentInvocation ?? {}),
  };
  const transcriptCall = overrides.transcriptCall ?? parentCallRecord;
  writeJson(join(productRoot, 'parent-call-record.json'), parentCallRecord);
  writeJson(join(productRoot, 'explicit-member-parent-invocation-source.json'), parentSource);
  writeJson(join(productRoot, 'explicit-member-parent-invocation.json'), parentInvocation);
  writeJson(join(productRoot, 'observed-parent-call-transcript.json'), {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: parentCallRecord.observerKind,
    observerSurface: parentCallRecord.observerSurface,
    calls: [transcriptCall],
  });
  return { parentCallRecord, parentSource, parentInvocation };
}

function writeLiveColdStartBundle(reportDir, overrides = {}) {
  mkdirSync(reportDir, { recursive: true });
  const corpusPath = join(reportDir, 'session-corpus-export.json');
  const manifestPath = join(reportDir, 'session-corpus-export-manifest.json');
  const corpus = {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'opencode-sqlite-session-corpus-export',
    projectIdentity: '/repo/live-cold-start',
    exporterManifestRef: manifestPath,
    sessions: [
      { sessionId: 'root-a', projectIdentity: '/repo/live-cold-start', messages: [{ role: 'user', text: 'ask skill-designer to review routing' }] },
      { sessionId: 'root-b', projectIdentity: '/repo/live-cold-start', messages: [{ role: 'user', text: 'skill-designer should check responsibilities again' }] },
    ],
    ...(overrides.corpus ?? {}),
  };
  const manifest = {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: corpus.projectIdentity,
    source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db', dbDigest: 'sha256:dbdigest123' },
    sessions: {
      total: 2,
      includedRootCount: 2,
      excludedSubagentCount: 0,
      entries: [{ sessionId: 'ses_root', raw: { sessionDigest: 'sha256:sessiondigest123', messageDigests: [], partDigests: [] } }],
    },
    ...(overrides.manifest ?? {}),
  };
  writeJson(corpusPath, corpus);
  writeJson(manifestPath, manifest);
  writeJson(join(reportDir, 'live-input-source.json'), {
    source: 'session-corpus-export',
    path: corpusPath,
    digest: overrides.corpusDigest ?? sha256Text(readFileSync(corpusPath, 'utf8')),
    exporterManifestRef: manifestPath,
    projectIdentity: corpus.projectIdentity,
    ...(overrides.liveInput ?? {}),
  });
  mkdirSync(join(reportDir, 'attempt-1'), { recursive: true });
  writeJson(join(reportDir, 'attempt-1/member-need-gate-input.json'), { prompt: 'fixture semantic gate input' });
  writeJson(join(reportDir, 'attempt-1/member-need-gate-raw-output.json'), { hit: true, ordinals: [1, 2] });
  writeJson(join(reportDir, 'attempt-1/member-need-gate-parsed-output.json'), { hit: true, ordinals: [1, 2] });
  writeJson(join(reportDir, 'attempt-1/member-candidate-extractor-input.json'), { prompt: 'fixture semantic extractor input' });
  writeJson(join(reportDir, 'attempt-1/member-candidate-extractor-raw-output.json'), { proposals: [{ memberName: 'skill-designer' }] });
  writeJson(join(reportDir, 'attempt-1/member-candidate-extractor-parsed-output.json'), { proposals: [{ memberName: 'skill-designer' }] });
  const gateDiagnostics = overrides.gateDiagnostics ?? {
    status: 'pass',
    adapterKind: 'fixture-semantic-gate',
    gateRun: true,
    flaggedLineCount: 2,
    inputArtifactRef: 'attempt-1/member-need-gate-input.json',
    rawOutputArtifactRef: 'attempt-1/member-need-gate-raw-output.json',
    parsedOutputArtifactRef: 'attempt-1/member-need-gate-parsed-output.json',
    parseErrors: [],
  };
  const extractorDiagnostics = overrides.extractorDiagnostics ?? {
    status: 'pass',
    adapterKind: 'fixture-semantic-extractor',
    extractorRun: true,
    inputArtifactRef: 'attempt-1/member-candidate-extractor-input.json',
    rawOutputArtifactRef: 'attempt-1/member-candidate-extractor-raw-output.json',
    parsedOutputArtifactRef: 'attempt-1/member-candidate-extractor-parsed-output.json',
    parseErrors: [],
  };
  writeJson(join(reportDir, 'member-session-cold-start-live-eval-report.json'), {
    reportKind: 'context-tree-member-session-cold-start-live-eval',
    mode: 'live',
    source: 'session-corpus-export',
    liveSessionDerivedCandidate: {
      status: overrides.candidateStatus ?? 'pass',
      memberName: 'skill-designer',
      defaultExpert: false,
      role: 'Skill Designer Reviewer',
      routingDescription: 'Use for recurring parent-session review or inspection needs around skill designer routing.',
      responsibilities: ['Review recurring source-backed requests before candidate promotion.'],
      sessionRefs: ['session:root-a', 'session:root-b'],
      evidenceCoverage: { rootSessionCount: 2, messageCount: 2, supportingRunCount: 0, uniqueEvidenceDigestCount: 2 },
      evidenceRefs: [
        { kind: 'session-message', ref: 'session:root-a:message:1', digest: msgDigest1 },
        { kind: 'session-message', ref: 'session:root-b:message:1', digest: msgDigest2 },
      ],
      sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
    },
    sessionCorpusScan: {
      scanDiagnostics: { genuineUserMessageCount: 2, excludedSyntheticCount: 0, excludedHandoffCount: 0, excludedToolOutputCount: 0 },
      excludedSessions: [{ sessionId: 'child', reason: 'subagent-or-hidden' }],
      scannedMessages: [
        { role: 'user', sessionId: 'root-a', ordinal: 1, text: 'ask skill-designer to review routing', ref: 'session:root-a:message:1', digest: msgDigest1, evidenceSourceKind: 'genuine-user-message' },
        { role: 'user', sessionId: 'root-b', ordinal: 1, text: 'skill-designer should check responsibilities again', ref: 'session:root-b:message:1', digest: msgDigest2, evidenceSourceKind: 'genuine-user-message' },
      ],
    },
    candidateManifestValidation: { accepted: [{ memberName: 'skill-designer', status: 'accepted', sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 } }], rejected: [] },
    evidenceQuality: {
      modeSource: { status: 'pass' },
      candidateCount: { status: 'pass', count: 1 },
      defaultExpert: { status: 'pass', defaultExpert: false },
      roleRoutingResponsibilities: { status: 'pass' },
      rootSessionOrCorroboration: { status: 'pass' },
      countedEvidenceExcludesNonGenuine: { status: 'pass' },
      excludedEvidenceDiagnostics: { status: 'pass' },
      manifestValidation: { status: 'pass' },
      noRegexOnlyPass: { status: 'pass' },
      sourceBackedRoleSummary: { status: 'pass' },
      candidateEvidenceRefsAreGenuine: { status: 'pass' },
      gateDiagnostics,
      extractorDiagnostics,
      pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, gateDiagnostics, extractorDiagnostics, dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 1 } },
    },
    discoveryProofKind: 'semanticCandidateDiscovery',
    ...(overrides.report ?? {}),
  });
  return join(reportDir, 'member-session-cold-start-live-eval-report.json');
}

function writeUtilityProofSidecars(reportDir, { memberName = 'workstream-owner' } = {}) {
  const eventA = { eventId: 'event:opencode:root-a:1', eventKind: 'user-message', runtime: 'opencode', sessionId: 'root-a', ordinal: 1, sourceDigest: msgDigest1, candidateEvidenceEligible: true };
  const eventB = { eventId: 'event:opencode:root-b:1', eventKind: 'user-message', runtime: 'opencode', sessionId: 'root-b', ordinal: 1, sourceDigest: msgDigest2, candidateEvidenceEligible: true };
  const evidenceRefs = [
    { ref: eventA.eventId, eventId: eventA.eventId, digest: eventA.sourceDigest },
    { ref: eventB.eventId, eventId: eventB.eventId, digest: eventB.sourceDigest },
  ];
  writeJson(join(reportDir, 'member-discovery-event-stream.json'), { artifactKind: 'member-discovery-event-stream', projectIdentity: '/repo/live-cold-start', events: [eventA, eventB], eventCoverage: { status: 'pass', totalEventCount: 2 }, sourceDigest: sha256Text('utility event stream') });
  writeJson(join(reportDir, 'member-discovery-selected-events.json'), { artifactKind: 'member-discovery-selected-events', selectedEvents: [eventA, eventB], modelEventRefs: evidenceRefs });
  writeJson(join(reportDir, 'member-discovery-views.json'), { artifactKind: 'member-discovery-views', projectIdentity: '/repo/live-cold-start', sessionEpisodeViews: [], memberTimelineViews: [], workstreamTimelineViews: [], compatibilityEpisodes: [] });
  writeJson(join(reportDir, 'member-candidate-ledger.json'), { artifactKind: 'member-candidate-ledger', projectIdentity: '/repo/live-cold-start', entries: [{ candidateId: `candidate:${memberName}`, memberName, seenCount: 2, evidenceRefs, proofScopeHistory: ['agent-assisted-product'] }], runHistory: [{ status: 'completed', proposalCount: 1, rejectedProposalCount: 0, warningCount: 1 }] });
}

function writeZeroCandidateLiveColdStartBundle(reportDir) {
  return writeLiveColdStartBundle(reportDir, {
    report: {
      liveSessionDerivedCandidate: {
        status: 'pass',
        candidateCount: 0,
        discoveryCompleted: true,
        discoveryProofKind: 'diagnosticZeroCandidate',
        reason: 'no promotable named member candidates found after completed discovery pipeline',
        dreamerDiagnostics: { extractorRun: true, proposedCandidateCount: 0 },
        hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 },
      },
      roleNeedWindows: { artifactKind: 'member-role-need-windows', windows: [{ nameKind: 'unnamed-role-need', promotionEligibility: { canCreateCandidate: false } }] },
      candidateManifestValidation: { accepted: [], rejected: [] },
      evidenceQuality: {
        modeSource: { status: 'pass' },
        candidateCount: { status: 'pass', count: 0, discoveryCompleted: true },
        defaultExpert: { status: 'pass', notApplicable: true },
        roleRoutingResponsibilities: { status: 'pass', notApplicable: true },
        rootSessionOrCorroboration: { status: 'pass', notApplicable: true },
        countedEvidenceExcludesNonGenuine: { status: 'pass' },
        excludedEvidenceDiagnostics: { status: 'pass' },
        manifestValidation: { status: 'pass', acceptedCount: 0, rejectedCount: 0 },
        noRegexOnlyPass: { status: 'pass', notApplicable: true },
        sourceBackedRoleSummary: { status: 'pass', reason: 'no promotable named member candidates found after completed discovery pipeline' },
        candidateEvidenceRefsAreGenuine: { status: 'pass', checkedRefCount: 0, failures: [] },
        gateDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', gateRun: true, flaggedLineCount: 0, parseErrors: [] },
        extractorDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', extractorRun: true, parseErrors: [] },
        pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, dreamerDiagnostics: { extractorRun: true, proposedCandidateCount: 0 }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 } },
      },
      discoveryProofKind: 'diagnosticZeroCandidate',
    },
    gateDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', gateRun: true, flaggedLineCount: 0, parseErrors: [] },
    extractorDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', extractorRun: true, parseErrors: [] },
  });
}

function writeAgentAssistedZeroCandidateLiveColdStartBundle(reportDir, overrides = {}) {
  mkdirSync(reportDir, { recursive: true });
  const requestPath = join(reportDir, 'member-discovery-gate-request.json');
  writeJson(requestPath, { packetKind: 'member-discovery-gate-request', adapterKind: 'agent-assisted-parent-turn', lines: [] });
  writeFileSync(join(reportDir, 'gate-answer.txt'), `${overrides.rawAnswer ?? 'n'}\n`, 'utf8');
  writeFileSync(join(reportDir, 'member-need-gate-raw-output.txt'), `${overrides.rawAnswer ?? 'n'}\n`, 'utf8');
  const observedTurn = {
    kind: 'observed-parent-agent-turn',
    phase: 'gate',
    answerCaptureKind: 'runtime-model-output',
    requestPath: 'member-discovery-gate-request.json',
    requestRef: 'member-discovery-gate-request.json',
    requestDigest: sha256Text(readFileSync(requestPath, 'utf8')),
    answerRef: 'member-need-gate-raw-output.txt',
    answerDigest: sha256Text(readFileSync(join(reportDir, 'member-need-gate-raw-output.txt'), 'utf8')),
    answer: 'n',
    source: {
      captureKind: 'opencode-parent-turn-runtime-observer',
      sourceThreadId: 'ses_agent_assisted_zero',
      parentTurnId: 'msg_agent_assisted_zero',
      sessionPartId: 'prt_agent_assisted_zero',
      sessionExportRef: './session-corpus-export.json',
      observedProjectIdentity: '/repo/live-cold-start',
    },
    ...(overrides.observedTurn ?? {}),
  };
  writeJson(join(reportDir, 'member-need-gate-input.json'), { prompt: 'agent-assisted semantic gate input' });
  writeJson(join(reportDir, 'member-need-gate-parsed-output.json'), { hit: false, ordinals: [] });
  writeJson(join(reportDir, 'observed-parent-gate-turn.json'), observedTurn);
  const observedTurnRaw = readFileSync(join(reportDir, 'observed-parent-gate-turn.json'), 'utf8');
  const gateDiagnostics = {
    status: 'pass',
    adapterKind: 'agent-assisted-parent-turn',
    gateRun: true,
    hit: false,
    lineCount: 2,
    flaggedLineCount: 0,
    inputArtifactRef: 'member-need-gate-input.json',
    rawOutputArtifactRef: 'member-need-gate-raw-output.txt',
    parsedOutputArtifactRef: 'member-need-gate-parsed-output.json',
    parseErrors: [],
  };
  const extractorDiagnostics = {
    status: 'pass',
    adapterKind: 'agent-assisted-parent-turn',
    extractorRun: false,
    inputArtifactRef: 'member-need-gate-input.json',
    rawOutputArtifactRef: 'member-need-gate-raw-output.txt',
    parsedOutputArtifactRef: 'member-need-gate-parsed-output.json',
    parseErrors: [],
  };
  return writeLiveColdStartBundle(reportDir, {
    report: {
      memberDiscoveryProofScope: 'agent-assisted-product',
      memberDiscoveryProofKind: 'agentAssistedZeroCandidate',
      memberDiscoveryAnswerSource: {
        artifactKind: 'member-discovery-answer-source',
        phase: 'gate',
        sourceKind: 'observed-parent-agent-turn',
        answerCaptureKind: overrides.answerCaptureKind ?? 'runtime-model-output',
        transcriptRef: overrides.transcriptRef === undefined ? 'observed-parent-gate-turn.json' : overrides.transcriptRef,
        answerFileRef: overrides.answerFileRef === undefined ? 'member-need-gate-raw-output.txt' : overrides.answerFileRef,
        requestRef: overrides.requestRef === undefined ? 'member-discovery-gate-request.json' : overrides.requestRef,
        observedTurnDigest: overrides.observedTurnDigest ?? sha256Text(observedTurnRaw),
        productEligible: overrides.productEligible ?? true,
      },
      liveSessionDerivedCandidate: {
        status: 'pass',
        candidateCount: 0,
        discoveryCompleted: true,
        discoveryProofKind: 'semanticZeroCandidate',
        reason: 'no recurring member role-need windows found in genuine user evidence',
        dreamerDiagnostics: { extractorRun: false, proposedCandidateCount: 0 },
        hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 },
      },
      roleNeedWindows: { artifactKind: 'member-role-need-windows', windows: [] },
      candidateManifestValidation: { accepted: [], rejected: [] },
      evidenceQuality: {
        modeSource: { status: 'pass' },
        candidateCount: { status: 'pass', count: 0, discoveryCompleted: true },
        defaultExpert: { status: 'pass', notApplicable: true },
        roleRoutingResponsibilities: { status: 'pass', notApplicable: true },
        rootSessionOrCorroboration: { status: 'pass', notApplicable: true },
        countedEvidenceExcludesNonGenuine: { status: 'pass' },
        excludedEvidenceDiagnostics: { status: 'pass' },
        manifestValidation: { status: 'pass', acceptedCount: 0, rejectedCount: 0 },
        noRegexOnlyPass: { status: 'pass', notApplicable: true },
        sourceBackedRoleSummary: { status: 'pass', reason: 'no recurring member role-need windows found in genuine user evidence' },
        candidateEvidenceRefsAreGenuine: { status: 'pass', checkedRefCount: 0, failures: [] },
        gateDiagnostics,
        extractorDiagnostics,
        pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, gateDiagnostics, extractorDiagnostics, dreamerDiagnostics: { extractorRun: false, proposedCandidateCount: 0 }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 }, zeroCandidateKind: 'semanticZeroCandidate', zeroCandidateReason: 'no recurring member role-need windows found in genuine user evidence' },
      },
      discoveryProofKind: 'semanticZeroCandidate',
      ...(overrides.report ?? {}),
    },
  });
}

function assertAgentAssistedProductBlocked(liveReportPath, reasonPattern) {
  const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-block-'));
  try {
    const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
    assert.equal(report.coldStartLiveObserved.status, 'blocked');
    assert.match(report.coldStartLiveObserved.reason, reasonPattern);
    assert.equal(report.memberDiscovery.status, 'not-proven');
    assert.equal(report.semanticDiscovery.status, 'not-proven');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

function writeMergedLiveColdStartBundle(reportDir) {
  return writeLiveColdStartBundle(reportDir, {
    corpus: { source: 'session-corpus-merge' },
    manifest: {
      artifactKind: 'session-corpus-merge-manifest',
      sources: [
        {
          source: 'opencode-sqlite-session-corpus-export',
          runtime: 'opencode',
          corpusDigest: 'sha256:opencodecorpusdigest123',
          manifestDigest: 'sha256:opencodemanifestdigest123',
        },
        {
          source: 'codex-jsonl-session-corpus-export',
          runtime: 'codex',
          corpusDigest: 'sha256:codexcorpusdigest123',
          manifestDigest: 'sha256:codexmanifestdigest123',
        },
      ],
      source: undefined,
    },
  });
}

function writeMergedLiveColdStartBundleWithCoverage(reportDir) {
  return writeLiveColdStartBundle(reportDir, {
    corpus: { source: 'session-corpus-merge' },
    manifest: {
      artifactKind: 'session-corpus-merge-manifest',
      sources: [
        { source: 'opencode-sqlite-session-corpus-export', runtime: 'opencode', corpusDigest: 'sha256:opencodecorpusdigest123', manifestDigest: 'sha256:opencodemanifestdigest123' },
        { source: 'codex-jsonl-session-corpus-export', runtime: 'codex', corpusDigest: 'sha256:codexcorpusdigest123', manifestDigest: 'sha256:codexmanifestdigest123' },
      ],
      source: undefined,
    },
    report: {
      runtimeCoverage: {
        scan: { sourceKind: 'multi-runtime', representedRuntimes: ['opencode', 'codex'] },
        corpus: { representedRuntimes: ['opencode', 'codex'], missingAttemptedRuntimes: [] },
        gate: { totalGateLines: 2, totalGateWindows: 2 },
        representedRuntimes: ['opencode', 'codex'],
      },
      gateCoverage: {
        totalGateLines: 2,
        totalGateWindows: 2,
        sessionsSentToGate: { opencode: 1, codex: 1 },
        gateAnswerCoverageExplanation: 'Gate saw represented runtime evidence from OpenCode and Codex.',
      },
    },
  });
}

function liveRuntimeCoverage({ sourceKind = 'single-runtime', representedRuntimes = ['opencode'], missingAttemptedRuntimes = [], coverageLimitation } = {}) {
  return {
    scan: { sourceKind, representedRuntimes },
    corpus: { representedRuntimes, missingAttemptedRuntimes },
    gate: { totalGateLines: 2, totalGateWindows: 2 },
    representedRuntimes,
    ...(coverageLimitation ? { coverageLimitation } : {}),
  };
}

function writeProductDiscoveryCorpus(root) {
  const projectIdentity = '/repo/live-cold-start';
  const manifestPath = join(root, 'session-corpus-export-manifest.json');
  const corpusPath = join(root, 'session-corpus-export.json');
  writeJson(corpusPath, {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'opencode-sqlite-session-corpus-export',
    projectIdentity,
    exporterManifestRef: manifestPath,
    sessions: [
      { sessionId: 'root-a', projectIdentity, messages: [{ role: 'user', text: 'ask skill-designer to review routing' }] },
      { sessionId: 'root-b', projectIdentity, messages: [{ role: 'user', text: 'skill-designer should check responsibilities again' }] },
    ],
  });
  writeJson(manifestPath, {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity,
    source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db', dbDigest: sha256Text('real opencode db bytes') },
    sessions: { total: 2, includedRootCount: 2, excludedSubagentCount: 0, entries: [{ sessionId: 'ses_root', raw: { sessionDigest: sha256Text('ses_root'), messageDigests: [], partDigests: [] } }] },
  });
  return { corpusPath, projectIdentity };
}

function writeProductObservedTurn({ root, fileName, phase, requestRef, answerRef, sourceSuffix, projectIdentity, sessionExportRef = '/tmp/opencode.db' }) {
  const requestText = readFileSync(join(root, requestRef), 'utf8');
  const answerText = readFileSync(join(root, answerRef), 'utf8');
  writeJson(join(root, fileName), {
    kind: 'observed-parent-agent-turn',
    phase,
    answerCaptureKind: 'runtime-model-output',
    requestRef,
    requestDigest: sha256Text(requestText),
    answerRef,
    answerDigest: sha256Text(answerText),
    answer: answerText.trim(),
    source: {
      captureKind: 'opencode-parent-turn-runtime-observer',
      sourceThreadId: `ses_product_${sourceSuffix}`,
      parentTurnId: `msg_product_${sourceSuffix}`,
      sessionPartId: `prt_product_${sourceSuffix}`,
      sessionExportRef,
      observedProjectIdentity: projectIdentity,
    },
    observedAt: '2026-07-11T00:00:00.000Z',
  });
}

function writeProductDiscoveryRoot(root, overrides = {}) {
  mkdirSync(root, { recursive: true });
  const { corpusPath, projectIdentity } = writeProductDiscoveryCorpus(root);
  const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', projectIdentity, '--out', root]);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  writeFileSync(join(root, 'member-need-gate-raw-output.txt'), 'y: 1, 2', 'utf8');
  writeProductObservedTurn({ root, fileName: 'observed-parent-gate-turn.json', phase: 'gate', requestRef: 'member-discovery-gate-request.json', answerRef: 'member-need-gate-raw-output.txt', sourceSuffix: 'gate', projectIdentity, sessionExportRef: overrides.observedSessionExportRef });
  const gated = runProduct(['answer-gate', '--state', root, '--observed-turn', 'observed-parent-gate-turn.json']);
  assert.equal(gated.status, 0, gated.stderr || gated.stdout);
  const scan = readJson(join(root, 'session-corpus-scan.json'));
  const messageByRef = new Map(scan.scannedMessages.map((message) => [message.ref, message]));
  writeFileSync(join(root, 'member-candidate-extractor-raw-output.txt'), JSON.stringify({ proposals: [{
    memberName: 'skill-designer',
    role: 'Skill Designer Reviewer',
    routingDescription: 'Use for recurring parent-session review or inspection needs around skill designer routing.',
    responsibilities: ['Review recurring source-backed requests before candidate promotion.'],
    evidenceRefs: [
      { kind: 'session-message', ref: 'session:root-a:message:1', digest: messageByRef.get('session:root-a:message:1').digest },
      { kind: 'session-message', ref: 'session:root-b:message:1', digest: messageByRef.get('session:root-b:message:1').digest },
    ],
    whyReusable: 'The same skill-designer review need repeats across sessions.',
    negativeSignals: [],
    sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
  }] }), 'utf8');
  writeProductObservedTurn({ root, fileName: 'observed-parent-extractor-turn.json', phase: 'extractor', requestRef: 'member-discovery-extractor-request.json', answerRef: 'member-candidate-extractor-raw-output.txt', sourceSuffix: 'extractor', projectIdentity, sessionExportRef: overrides.observedSessionExportRef });
  const extracted = runProduct(['answer-extractor', '--state', root, '--observed-turn', 'observed-parent-extractor-turn.json']);
  assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
  return join(root, 'member-session-cold-start-live-eval-report.json');
}

describe('run-member-system-e2e-eval CLI', () => {
  it('requires --out before writing reports', () => {
    const result = runEval([]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing value for --out/i);
  });

  it('keeps productObserved not-run by default and rejects fixture-only product evidence', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), {
        resultReturnEvidence: { returnedTo: 'parent-agent', evidenceKind: 'tool-return' },
        result: { returnedTo: 'parent-agent' },
      });

      const result = runEval(['--out', outputDir, '--product-root', productRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.mode, 'product-observed');
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /observed parent-visible result-return evidence/i);
      assert.equal(report.projection.status, 'not-applicable');
      assert.equal(report.explicitInvocation.status, 'not-applicable');
      assert.equal(existsSync(join(outputDir, 'artifacts/invocation/member-task-run.json')), false);
      assert.deepEqual(report.issues, []);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('accepts only observed parent-visible result-return evidence for productObserved pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-pass-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), {
        resultReturnEvidence: {
          returnedTo: 'parent-agent',
          evidenceKind: 'adapter-parent-call-record',
          evidenceRef: 'explicit-member-parent-invocation.json',
        },
        result: { returnedTo: 'parent-agent' },
      });
      const chain = writeObservedProductChain(productRoot);

      const result = runEval(['--out', outputDir, '--product-root', productRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.productObserved.status, 'pass');
      assert.equal(report.productObserved.evidenceKind, 'observed-parent-agent-call');
      assertProductObservedProofRef(outputDir, productRoot, chain);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('accepts retained product roots whose adapter parent-call evidence is nested in the result evidence refs', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-retained-pass-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), {
        result: {
          returnedTo: 'parent-agent',
          evidenceRefs: [
            { kind: 'adapter-parent-call-record', ref: './explicit-member-parent-invocation.json' },
          ],
        },
      });
      writeObservedProductChain(productRoot);

      const result = runEval(['--out', outputDir, '--product-root', productRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'pass');
      assert.equal(report.productObserved.evidenceKind, 'observed-parent-agent-call');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('accepts reviewed product roots whose parent-call evidence is the observed parent invocation artifact', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-parent-artifact-pass-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), {
        result: { returnedTo: 'parent-agent' },
      });
      writeObservedProductChain(productRoot);

      const result = runEval(['--out', outputDir, '--product-root', productRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'pass');
      assert.equal(report.productObserved.evidenceKind, 'observed-parent-agent-call');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('blocks productObserved when parent-call provenance digest does not match the call record', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-digest-block-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), { result: { returnedTo: 'parent-agent' } });
      writeObservedProductChain(productRoot, { parentCallDigest: 'sha256:wrongdigest' });

      const result = runEval(['--out', outputDir, '--product-root', productRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /parent call record digest/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('blocks productObserved when the observed transcript does not contain the parent call record', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-transcript-block-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), { result: { returnedTo: 'parent-agent' } });
      writeObservedProductChain(productRoot, { transcriptCall: { kind: 'parent-agent-tool-call-record', invocationId: 'call_different' } });

      const result = runEval(['--out', outputDir, '--product-root', productRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /transcript/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('rejects retained fixture product roots when fresh product proof is required', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-fresh-fixture-block-'));
    const fixtureProductRoot = join(REPO_ROOT, 'evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-corroborated-product');
    try {
      const result = runEval(['--out', outputDir, '--product-root', fixtureProductRoot, '--require-fresh-product-root']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /fresh product root.*evals\/fixtures/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects retained fixture labels when fresh product proof is required', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-fresh-label-block-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), { result: { returnedTo: 'parent-agent' }, fixture: true });
      writeObservedProductChain(productRoot, { parentInvocation: { acceptanceMode: 'retained-fixture' } });

      const result = runEval(['--out', outputDir, '--product-root', productRoot, '--require-fresh-product-root']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /retained fixture label|fixture label/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('rejects unresolved product proof refs when fresh product proof is required', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-fresh-ref-block-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), { result: { returnedTo: 'parent-agent' } });
      writeObservedProductChain(productRoot, { parentSource: { parentCallRecordRef: '/tmp/outside-parent-call-record.json' } });

      const result = runEval(['--out', outputDir, '--product-root', productRoot, '--require-fresh-product-root']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /inside supplied product root|product proof refs/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('allows digest-closed observed product roots when fresh product proof is required', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-fresh-pass-'));
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-agent-wiki-lab-product-root-'));
    try {
      writeJson(join(productRoot, 'member-task-run.json'), { result: { returnedTo: 'parent-agent' } });
      const chain = writeObservedProductChain(productRoot);

      const result = runEval(['--out', outputDir, '--product-root', productRoot, '--require-fresh-product-root']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'pass');
      assert.equal(report.productObserved.freshProductRoot, true);
      assertProductObservedProofRef(outputDir, productRoot, chain);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('classifies live cold-start report references without letting hermetic candidates satisfy live pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-cold-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir);

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      const ref = readJson(join(outputDir, 'artifacts/cold-start/live-eval-report-ref.json'));
      assert.equal(report.mode, 'live-cold-start-observed');
      assert.equal(report.coldStartCandidate.status, 'not-applicable');
      assert.equal(existsSync(join(outputDir, 'artifacts/cold-start/member-profile-candidates.json')), false);
      assert.equal(report.coldStartLiveObserved.status, 'pass');
      assert.equal(report.coldStartLiveObserved.evidenceQualityContract, 'pass');
      assert.equal(report.semanticDiscovery.status, 'pass');
      assert.equal(report.semanticDiscovery.discoveryProofKind, 'semanticCandidateDiscovery');
      assert.equal(ref.reportPath, liveReportPath);
      assert.equal(ref.liveSessionDerivedCandidate.status, 'pass');
      assert.match(ref.digest, /^sha256:/);
      assert.match(ref.exporterManifestDigest, /^sha256:/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('aggregates utility discovery independently from semantic zero-candidate status', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-report-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        report: {
          discoveryProofKind: 'semanticZeroCandidate',
          eventCoverage: { status: 'pass', totalEventCount: 2 },
          candidateLedger: { status: 'pass', entries: [{ candidateId: 'candidate:workstream-owner', memberName: 'workstream-owner', seenCount: 2, evidenceRefs: [{ ref: 'event:opencode:root-a:1', eventId: 'event:opencode:root-a:1', digest: msgDigest1 }, { ref: 'event:opencode:root-b:1', eventId: 'event:opencode:root-b:1', digest: msgDigest2 }], proofScopeHistory: ['agent-assisted-product'] }], runHistory: [{ status: 'completed', proposalCount: 1, rejectedProposalCount: 0, warningCount: 1 }] },
          liveSessionDerivedCandidate: { status: 'pass', candidateCount: 0, discoveryCompleted: true, discoveryProofKind: 'semanticZeroCandidate', reason: 'line-gate found no named semantic candidate', dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 } },
          candidateManifestValidation: { accepted: [], rejected: [] },
          memberUtilityDiscovery: { status: 'candidate-discovered', proofStatus: 'pass', discoveryOutcome: 'candidate-discovered', coverageClaim: 'bounded-to-event-stream', proofKind: 'utilityCandidateDiscovery', proofScope: 'agent-assisted-product', candidateCount: 1, rejectedCount: 0, warningCount: 1, warnings: [{ memberName: 'workstream-owner', reason: 'confirm workstream boundary' }], rejectedProposals: [], diagnostics: { status: 'candidate-discovered' } },
          evidenceQuality: {
            modeSource: { status: 'pass' },
            candidateCount: { status: 'pass', count: 0, discoveryCompleted: true },
            defaultExpert: { status: 'pass', notApplicable: true },
            roleRoutingResponsibilities: { status: 'pass', notApplicable: true },
            rootSessionOrCorroboration: { status: 'pass', notApplicable: true },
            countedEvidenceExcludesNonGenuine: { status: 'pass' },
            excludedEvidenceDiagnostics: { status: 'pass' },
            manifestValidation: { status: 'pass', acceptedCount: 0, rejectedCount: 0 },
            noRegexOnlyPass: { status: 'pass', notApplicable: true },
            sourceBackedRoleSummary: { status: 'pass', reason: 'line-gate found no named semantic candidate' },
            candidateEvidenceRefsAreGenuine: { status: 'pass', checkedRefCount: 0, failures: [] },
            gateDiagnostics: { status: 'pass', adapterKind: 'fixture-semantic-gate', gateRun: true, hit: false, lineCount: 2, flaggedLineCount: 0, inputArtifactRef: 'attempt-1/member-need-gate-input.json', rawOutputArtifactRef: 'attempt-1/member-need-gate-raw-output.json', parsedOutputArtifactRef: 'attempt-1/member-need-gate-parsed-output.json', parseErrors: [] },
            extractorDiagnostics: { status: 'pass', adapterKind: 'fixture-semantic-extractor', extractorRun: true, inputArtifactRef: 'attempt-1/member-candidate-extractor-input.json', rawOutputArtifactRef: 'attempt-1/member-candidate-extractor-raw-output.json', parsedOutputArtifactRef: 'attempt-1/member-candidate-extractor-parsed-output.json', parseErrors: [] },
            pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 }, zeroCandidateKind: 'semanticZeroCandidate', zeroCandidateReason: 'line-gate found no named semantic candidate' },
          },
        },
      });
      writeJson(join(reportDir, 'member-utility-gate-request.json'), { packetKind: 'member-utility-gate-request' });
      writeFileSync(join(reportDir, 'member-utility-gate-raw-output.txt'), JSON.stringify({ hasDelegationOpportunity: true, episodeRefs: ['episode:root-a', 'episode:root-b'], reason: 'utility candidate' }), 'utf8');
      writeJson(join(reportDir, 'observed-parent-utility-gate-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-gate', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-gate-request.json', requestDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-gate-request.json'), 'utf8')), answerRef: 'member-utility-gate-raw-output.txt', answerDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-gate-raw-output.txt'), 'utf8')), answer: readFileSync(join(reportDir, 'member-utility-gate-raw-output.txt'), 'utf8').trim(), source: { captureKind: 'opencode-parent-turn-runtime-observer', sourceThreadId: 'ses_utility_gate', parentTurnId: 'msg_utility_gate', sessionPartId: 'prt_utility_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/live-cold-start' } });
      writeJson(join(reportDir, 'member-discovery-answer-source-utility-gate.json'), { artifactKind: 'member-discovery-answer-source', phase: 'utility-gate', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'observed-parent-utility-gate-turn.json', answerFileRef: 'member-utility-gate-raw-output.txt', requestRef: 'member-utility-gate-request.json', observedTurnDigest: sha256Text(readFileSync(join(reportDir, 'observed-parent-utility-gate-turn.json'), 'utf8')), productEligible: true });
      writeJson(join(reportDir, 'member-utility-proposal-request.json'), { packetKind: 'member-utility-proposal-request' });
      writeFileSync(join(reportDir, 'member-utility-proposal-raw-output.txt'), JSON.stringify({ proposals: [{ memberName: 'eval-proof-reviewer' }] }), 'utf8');
      writeJson(join(reportDir, 'observed-parent-utility-proposal-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-proposal', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-proposal-request.json', requestDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-proposal-request.json'), 'utf8')), answerRef: 'member-utility-proposal-raw-output.txt', answerDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-proposal-raw-output.txt'), 'utf8')), answer: readFileSync(join(reportDir, 'member-utility-proposal-raw-output.txt'), 'utf8').trim(), source: { captureKind: 'opencode-parent-turn-runtime-observer', sourceThreadId: 'ses_utility_proposal', parentTurnId: 'msg_utility_proposal', sessionPartId: 'prt_utility_proposal', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/live-cold-start' } });
      writeJson(join(reportDir, 'member-discovery-answer-source-utility-proposal.json'), { artifactKind: 'member-discovery-answer-source', phase: 'utility-proposal', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'observed-parent-utility-proposal-turn.json', answerFileRef: 'member-utility-proposal-raw-output.txt', requestRef: 'member-utility-proposal-request.json', observedTurnDigest: sha256Text(readFileSync(join(reportDir, 'observed-parent-utility-proposal-turn.json'), 'utf8')), productEligible: true });
      writeUtilityProofSidecars(reportDir);
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const aggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(aggregate.semanticDiscovery.status, 'pass');
      assert.equal(aggregate.semanticDiscovery.discoveryProofKind, 'semanticZeroCandidate');
      assert.equal(aggregate.memberUtilityDiscovery.status, 'pass');
      assert.equal(aggregate.memberUtilityDiscovery.proofStatus, 'pass');
      assert.equal(aggregate.memberUtilityDiscovery.discoveryOutcome, 'candidate-discovered');
      assert.equal(aggregate.memberUtilityDiscovery.coverageClaim, 'bounded-to-event-stream');
      assert.equal(aggregate.memberUtilityDiscovery.warningCount, 1);
      assert.equal(aggregate.memberUtilityDiscovery.warnings[0].memberName, 'workstream-owner');
      assert.deepEqual(aggregate.memberUtilityDiscovery.rejectedProposals, []);
      assert.equal(aggregate.candidateLedger.status, 'pass');
      assert.equal(aggregate.candidateLedger.entries[0].seenCount, 2);
      assert.equal(aggregate.eventCoverage.status, 'pass');
      assert.equal(aggregate.eventCoverage.totalEventCount, 2);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('does not aggregate forged utility product proof from report fields without utility answer-source artifacts', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-forged-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-forged-report-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        report: { memberUtilityDiscovery: { status: 'candidate-discovered', proofKind: 'utilityCandidateDiscovery', proofScope: 'agent-assisted-product', candidateCount: 1, rejectedCount: 0 } },
      });
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const aggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(aggregate.memberUtilityDiscovery.status, 'not-proven');
      assert.match(aggregate.memberUtilityDiscovery.reason, /utility.*answer-source|product proof/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('passes aggregate when product utility discovery is terminal while semantic and member discovery stay not-proven', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-terminal-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-terminal-report-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        gateDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', gateRun: true, hit: false, lineCount: 2, flaggedLineCount: 0, parseErrors: [] },
        extractorDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', extractorRun: true, parseErrors: [] },
        report: {
          discoveryProofKind: 'diagnosticZeroCandidate',
          memberDiscoveryProofKind: 'agentAssistedZeroCandidate',
          memberDiscoveryProofScope: 'diagnostic',
          liveSessionDerivedCandidate: { status: 'pass', candidateCount: 0, discoveryCompleted: true, discoveryProofKind: 'diagnosticZeroCandidate', reason: 'fail-closed diagnostic member discovery did not run semantic proof', dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 } },
          candidateManifestValidation: { accepted: [], rejected: [] },
          evidenceQuality: {
            modeSource: { status: 'pass' },
            candidateCount: { status: 'pass', count: 0, discoveryCompleted: true },
            defaultExpert: { status: 'pass', notApplicable: true },
            roleRoutingResponsibilities: { status: 'pass', notApplicable: true },
            rootSessionOrCorroboration: { status: 'pass', notApplicable: true },
            countedEvidenceExcludesNonGenuine: { status: 'pass' },
            excludedEvidenceDiagnostics: { status: 'pass' },
            manifestValidation: { status: 'pass', acceptedCount: 0, rejectedCount: 0 },
            noRegexOnlyPass: { status: 'pass', notApplicable: true },
            sourceBackedRoleSummary: { status: 'pass', reason: 'fail-closed diagnostic member discovery did not run semantic proof' },
            candidateEvidenceRefsAreGenuine: { status: 'pass', checkedRefCount: 0, failures: [] },
            gateDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', gateRun: true, hit: false, lineCount: 2, flaggedLineCount: 0, parseErrors: [] },
            extractorDiagnostics: { status: 'pass', adapterKind: 'fail-closed-default', extractorRun: true, parseErrors: [] },
            pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 0, rejectedCount: 0 }, zeroCandidateKind: 'diagnosticZeroCandidate', zeroCandidateReason: 'fail-closed diagnostic member discovery did not run semantic proof' },
          },
          memberUtilityDiscovery: { status: 'candidate-discovered', proofKind: 'utilityCandidateDiscovery', proofScope: 'agent-assisted-product', candidateCount: 1, rejectedCount: 0, warningCount: 1, warnings: [{ memberName: 'workstream-owner', reason: 'confirm workstream boundary' }], rejectedProposals: [], diagnostics: { status: 'candidate-discovered' } },
          candidateLedger: { status: 'pass', entries: [{ candidateId: 'candidate:workstream-owner', memberName: 'workstream-owner', seenCount: 2, evidenceRefs: [{ ref: 'event:opencode:root-a:1', eventId: 'event:opencode:root-a:1', digest: msgDigest1 }, { ref: 'event:opencode:root-b:1', eventId: 'event:opencode:root-b:1', digest: msgDigest2 }], proofScopeHistory: ['agent-assisted-product'] }], runHistory: [{ status: 'completed', proposalCount: 1, rejectedProposalCount: 0, warningCount: 1 }] },
        },
      });
      writeJson(join(reportDir, 'member-utility-gate-request.json'), { packetKind: 'member-utility-gate-request' });
      writeFileSync(join(reportDir, 'member-utility-gate-raw-output.txt'), JSON.stringify({ hasDelegationOpportunity: true, episodeRefs: ['episode:root-a', 'episode:root-b'], reason: 'utility candidate' }), 'utf8');
      writeJson(join(reportDir, 'observed-parent-utility-gate-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-gate', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-gate-request.json', requestDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-gate-request.json'), 'utf8')), answerRef: 'member-utility-gate-raw-output.txt', answerDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-gate-raw-output.txt'), 'utf8')), answer: readFileSync(join(reportDir, 'member-utility-gate-raw-output.txt'), 'utf8').trim(), source: { captureKind: 'opencode-parent-turn-runtime-observer', sourceThreadId: 'ses_utility_gate', parentTurnId: 'msg_utility_gate', sessionPartId: 'prt_utility_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/live-cold-start' } });
      writeJson(join(reportDir, 'member-discovery-answer-source-utility-gate.json'), { artifactKind: 'member-discovery-answer-source', phase: 'utility-gate', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'observed-parent-utility-gate-turn.json', answerFileRef: 'member-utility-gate-raw-output.txt', requestRef: 'member-utility-gate-request.json', observedTurnDigest: sha256Text(readFileSync(join(reportDir, 'observed-parent-utility-gate-turn.json'), 'utf8')), productEligible: true });
      writeJson(join(reportDir, 'member-utility-proposal-request.json'), { packetKind: 'member-utility-proposal-request' });
      writeFileSync(join(reportDir, 'member-utility-proposal-raw-output.txt'), JSON.stringify({ proposals: [{ memberName: 'eval-proof-reviewer' }] }), 'utf8');
      writeJson(join(reportDir, 'observed-parent-utility-proposal-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-proposal', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-proposal-request.json', requestDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-proposal-request.json'), 'utf8')), answerRef: 'member-utility-proposal-raw-output.txt', answerDigest: sha256Text(readFileSync(join(reportDir, 'member-utility-proposal-raw-output.txt'), 'utf8')), answer: readFileSync(join(reportDir, 'member-utility-proposal-raw-output.txt'), 'utf8').trim(), source: { captureKind: 'opencode-parent-turn-runtime-observer', sourceThreadId: 'ses_utility_proposal', parentTurnId: 'msg_utility_proposal', sessionPartId: 'prt_utility_proposal', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/live-cold-start' } });
      writeJson(join(reportDir, 'member-discovery-answer-source-utility-proposal.json'), { artifactKind: 'member-discovery-answer-source', phase: 'utility-proposal', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'observed-parent-utility-proposal-turn.json', answerFileRef: 'member-utility-proposal-raw-output.txt', requestRef: 'member-utility-proposal-request.json', observedTurnDigest: sha256Text(readFileSync(join(reportDir, 'observed-parent-utility-proposal-turn.json'), 'utf8')), productEligible: true });
      writeUtilityProofSidecars(reportDir);

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const aggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(aggregate.coldStartLiveObserved.status, 'pass');
      assert.equal(aggregate.coldStartLiveObserved.memberDiscoveryProofScope, 'diagnostic');
      assert.equal(aggregate.verdict, 'pass');
      assert.equal(aggregate.memberUtilityDiscovery.status, 'pass');
      assert.equal(aggregate.memberUtilityDiscovery.proofScope, 'agent-assisted-product');
      assert.equal(aggregate.memberUtilityDiscovery.warningCount, 1);
      assert.equal(aggregate.memberUtilityDiscovery.warnings[0].memberName, 'workstream-owner');
      assert.deepEqual(aggregate.memberUtilityDiscovery.rejectedProposals, []);
      assert.equal(aggregate.memberDiscovery.status, 'not-proven');
      assert.equal(aggregate.semanticDiscovery.status, 'not-proven');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('does not let non-product utility zero-candidate proof close aggregate utility discovery', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-zero-retained-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-utility-zero-retained-report-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        report: {
          memberUtilityDiscovery: {
            status: 'utilityGateFalse',
            proofKind: 'utilityZeroCandidate',
            proofScope: 'retained-fixture',
            candidateCount: 0,
            rejectedCount: 0,
            reason: 'fixture utility gate found no delegation opportunity',
          },
        },
      });
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const aggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(aggregate.memberUtilityDiscovery.status, 'not-proven');
      assert.equal(aggregate.memberUtilityDiscovery.proofScope, 'retained-fixture');
      assert.match(aggregate.memberUtilityDiscovery.reason, /cannot close product utility proof|agent-assisted-product/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('accepts live cold-start candidate reports whose accepted candidate status is candidate', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-candidate-status-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-candidate-status-report-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, { candidateStatus: 'candidate' });
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'pass');
      assert.equal(report.coldStartLiveObserved.candidateCount, 1);
      assert.equal(report.semanticDiscovery.status, 'pass');
      assert.equal(report.memberDiscovery.status, 'not-proven');
      assert.equal(report.coldStartCandidate.status, 'not-applicable');
      assert.equal(existsSync(join(outputDir, 'artifacts/cold-start/member-profile-candidates.json')), false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('accepts merged multi-runtime session corpus manifests for live cold-start aggregation', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-merged-live-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-merged-live-report-'));
    try {
      const liveReport = writeMergedLiveColdStartBundle(reportDir);
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'pass');
      assert.equal(report.semanticDiscovery.status, 'pass');
      const ref = readJson(join(outputDir, 'artifacts/cold-start/live-eval-report-ref.json'));
      assert.match(ref.exporterManifestDigest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('copies merged multi-runtime live runtime coverage into aggregate report', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-merged-live-coverage-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-merged-live-coverage-report-'));
    try {
      const liveReport = writeMergedLiveColdStartBundleWithCoverage(reportDir);
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.runtimeCoverage.scan.sourceKind, 'multi-runtime');
      assert.match(report.gateRuntimeCoverageExplanation, /OpenCode/);
      assert.match(report.gateRuntimeCoverageExplanation, /Codex/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('keeps OpenCode-only live coverage limitation visible after aggregate member discovery pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-opencode-only-coverage-'));
    const productDiscoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-opencode-only-coverage-report-'));
    try {
      const liveReport = writeProductDiscoveryRoot(productDiscoveryDir);
      const sourceReport = readJson(liveReport);
      sourceReport.runtimeCoverage = liveRuntimeCoverage({
        coverageLimitation: 'OpenCode-only coverage; cannot represent Codex or Claude Code user history',
      });
      sourceReport.gateCoverage = {
        totalGateLines: 2,
        totalGateWindows: 2,
        sessionsSentToGate: { opencode: 2 },
        gateAnswerCoverageExplanation: 'Gate saw OpenCode only; cannot represent Codex or Claude Code user history.',
      };
      writeJson(liveReport, sourceReport);
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const openCodeOnly = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(openCodeOnly.memberDiscovery.status, 'pass');
      assert.equal(openCodeOnly.semanticDiscovery.status, 'pass');
      assert.match(openCodeOnly.runtimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
      assert.deepEqual(openCodeOnly.runtimeCoverage.corpus.missingAttemptedRuntimes ?? [], []);
      assert.match(openCodeOnly.gateRuntimeCoverageExplanation, /cannot represent Codex or Claude Code user history/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productDiscoveryDir, { recursive: true, force: true });
    }
  });

  it('keeps missing-runtime live coverage attempted runtime and limitation visible in aggregate report', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-missing-runtime-coverage-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-missing-runtime-coverage-report-'));
    try {
      const liveReport = writeLiveColdStartBundle(reportDir, {
        report: {
          runtimeCoverage: liveRuntimeCoverage({
            representedRuntimes: ['opencode'],
            missingAttemptedRuntimes: ['codex'],
            coverageLimitation: 'OpenCode coverage only; Codex was attempted but missing, so aggregate cannot represent Codex user history',
          }),
          gateCoverage: {
            totalGateLines: 2,
            totalGateWindows: 2,
            sessionsSentToGate: { opencode: 2 },
            gateAnswerCoverageExplanation: 'OpenCode evidence only; Codex attempted but missing.',
          },
        },
      });
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const missingRuntime = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert(missingRuntime.runtimeCoverage.corpus.missingAttemptedRuntimes.includes('codex'));
      assert.match(missingRuntime.runtimeCoverage.coverageLimitation, /cannot represent Codex user history/);
      assert.match(missingRuntime.gateRuntimeCoverageExplanation, /Codex.*attempted|cannot represent/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('accepts complete zero-candidate live cold-start reports as observed pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-zero-live-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-zero-live-report-'));
    try {
      const liveReport = writeZeroCandidateLiveColdStartBundle(reportDir);
      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'pass');
      assert.equal(report.coldStartLiveObserved.candidateCount, 0);
      assert.equal(report.coldStartLiveObserved.evidenceQualityContract, 'pass');
      assert.equal(report.semanticDiscovery.status, 'not-proven');
      assert.equal(report.semanticDiscovery.discoveryProofKind, 'diagnosticZeroCandidate');
      assert.equal(report.memberDiscovery.status, 'not-proven');
      assert.equal(report.verdict, 'fail');
      assert.ok(report.issues.some((issue) => /diagnostic.*product member discovery/i.test(issue)));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('aggregates product-runner discovery as product member discovery while manual retained stays not-proven', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-'));
    const productDiscoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-report-'));
    const manualOutputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-manual-discovery-'));
    const manualReportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-manual-discovery-report-'));
    try {
      const productReport = writeProductDiscoveryRoot(productDiscoveryDir);
      const productResult = runEval(['--out', outputDir, '--cold-start-live-report', productReport]);
      assert.equal(productResult.status, 0, productResult.stderr || productResult.stdout);
      const productAggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(productAggregate.memberDiscovery.status, 'pass');
      assert.equal(productAggregate.memberDiscovery.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(productAggregate.semanticDiscovery.status, 'pass');

      const manualReport = writeLiveColdStartBundle(manualReportDir, {
        gateDiagnostics: { status: 'pass', adapterKind: 'agent-assisted-parent-turn', gateRun: true, flaggedLineCount: 2, inputArtifactRef: 'attempt-1/member-need-gate-input.json', rawOutputArtifactRef: 'attempt-1/member-need-gate-raw-output.json', parsedOutputArtifactRef: 'attempt-1/member-need-gate-parsed-output.json', parseErrors: [] },
        extractorDiagnostics: { status: 'pass', adapterKind: 'agent-assisted-parent-turn', extractorRun: true, inputArtifactRef: 'attempt-1/member-candidate-extractor-input.json', rawOutputArtifactRef: 'attempt-1/member-candidate-extractor-raw-output.json', parsedOutputArtifactRef: 'attempt-1/member-candidate-extractor-parsed-output.json', parseErrors: [] },
        report: { memberDiscoveryAnswerSource: { artifactKind: 'member-discovery-answer-source', phase: 'extractor', sourceKind: 'manual-retained', productEligible: false } },
      });
      const manualResult = runEval(['--out', manualOutputDir, '--cold-start-live-report', manualReport]);
      assert.equal(manualResult.status, 0, manualResult.stderr || manualResult.stdout);
      const manualAggregate = readJson(join(manualOutputDir, 'member-system-e2e-report.json'));
      assert.equal(manualAggregate.memberDiscovery.status, 'not-proven');
      assert.equal(manualAggregate.memberDiscovery.memberDiscoveryProofScope, 'manual-retained');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productDiscoveryDir, { recursive: true, force: true });
      rmSync(manualOutputDir, { recursive: true, force: true });
      rmSync(manualReportDir, { recursive: true, force: true });
    }
  });

  it('blocks product-runner aggregate proof when gate observed-turn digest is forged', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-forged-gate-'));
    const productDiscoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-forged-gate-report-'));
    try {
      const productReport = writeProductDiscoveryRoot(productDiscoveryDir);
      const gateSourcePath = join(productDiscoveryDir, 'member-discovery-answer-source-gate.json');
      const gateSource = readJson(gateSourcePath);
      gateSource.observedTurnDigest = sha256Text('forged gate observed turn artifact bytes');
      writeJson(gateSourcePath, gateSource);

      const result = runEval(['--out', outputDir, '--cold-start-live-report', productReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /gate.*observed.*digest|turn digest|product proof/i);
      assert.equal(report.memberDiscovery.status, 'not-proven');
      assert.equal(report.semanticDiscovery.status, 'not-proven');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productDiscoveryDir, { recursive: true, force: true });
    }
  });

  it('blocks product-runner aggregate proof when observed turns point at retained corpus instead of DB exporter evidence', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-corpus-turn-'));
    const productDiscoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-corpus-turn-report-'));
    try {
      const productReport = writeProductDiscoveryRoot(productDiscoveryDir);
      for (const phase of ['gate', 'extractor']) {
        const turnPath = join(productDiscoveryDir, `observed-parent-${phase}-turn.json`);
        const turn = readJson(turnPath);
        turn.source.sessionExportRef = './session-corpus-export.json';
        writeJson(turnPath, turn);
        const sourcePath = join(productDiscoveryDir, `member-discovery-answer-source-${phase}.json`);
        const source = readJson(sourcePath);
        source.observedTurnDigest = sha256Text(readFileSync(turnPath, 'utf8'));
        writeJson(sourcePath, source);
      }
      const result = runEval(['--out', outputDir, '--cold-start-live-report', productReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /sessionExportRef|DB exporter|OpenCode SQLite/i);
      assert.equal(report.memberDiscovery.status, 'not-proven');
      assert.equal(report.semanticDiscovery.status, 'not-proven');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productDiscoveryDir, { recursive: true, force: true });
    }
  });

  it('downgrades controller-retained observed answers even when stale productEligible is true', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-controller-retained-'));
    const productDiscoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-product-discovery-controller-retained-report-'));
    try {
      const productReport = writeProductDiscoveryRoot(productDiscoveryDir);
      for (const phase of ['gate', 'extractor']) {
        const sourcePath = join(productDiscoveryDir, `member-discovery-answer-source-${phase}.json`);
        const source = readJson(sourcePath);
        source.answerCaptureKind = 'controller-retained-output';
        source.productEligible = true;
        writeJson(sourcePath, source);
      }
      const reportPath = join(productDiscoveryDir, 'member-session-cold-start-live-eval-report.json');
      const productRunnerReport = readJson(reportPath);
      productRunnerReport.memberDiscoveryAnswerSource.answerCaptureKind = 'controller-retained-output';
      productRunnerReport.memberDiscoveryAnswerSource.productEligible = true;
      writeJson(reportPath, productRunnerReport);

      const result = runEval(['--out', outputDir, '--cold-start-live-report', productReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'pass');
      assert.equal(report.coldStartLiveObserved.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(report.memberDiscovery.status, 'not-proven');
      assert.equal(report.memberDiscovery.memberDiscoveryProofScope, 'manual-retained');
      assert.match(report.memberDiscovery.reason, /manual-retained|product member discovery/i);
      assert.equal(report.semanticDiscovery.status, 'not-proven');
      assert.equal(report.semanticDiscovery.retainedSemanticRegressionProof, 'pass');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(productDiscoveryDir, { recursive: true, force: true });
    }
  });

  it('classifies retained natural-use proof as retained-only and not product natural-use pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-retained-'));
    const naturalUseDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-retained-report-'));
    try {
      const naturalUseReport = join(naturalUseDir, 'natural-use-e2e-report.json');
      writeJson(naturalUseReport, {
        reportKind: 'context-tree-member-discovery-natural-use-e2e',
        status: 'pass',
        memberName: 'proof-tier-specialist',
        usedSourceInputRef: 'session:root-a:message:1',
        confirmedBeforeUse: true,
        memberInvocationObserved: true,
        returnedToParentAgent: true,
        proofScope: 'retained-observed',
        retainedRefs: { discoveryRoot: naturalUseDir, invokeMemberSummary: join(naturalUseDir, 'invoke-member-summary.json') },
      });
      const result = runEval(['--out', outputDir, '--natural-use-report', naturalUseReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.status, 'not-proven');
      assert.equal(report.naturalDiscoveredMemberUse.retainedRegressionProof, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.proofScope, 'retained-observed');
      assert.match(report.naturalDiscoveredMemberUse.reason, /retained.*product/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(naturalUseDir, { recursive: true, force: true });
    }
  });

  it('keeps zero-candidate natural-use reports not-applicable while aggregate verdict passes', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-na-'));
    const naturalUseDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-na-report-'));
    try {
      const naturalUseReport = join(naturalUseDir, 'natural-use-e2e-report.json');
      writeJson(naturalUseReport, {
        reportKind: 'context-tree-member-discovery-natural-use-e2e',
        status: 'not-applicable',
        reason: 'discovery produced zero candidates',
        proofScope: 'not-applicable',
        candidateCount: 0,
        confirmedBeforeUse: false,
        memberInvocationObserved: false,
        returnedToParentAgent: false,
      });
      const result = runEval(['--out', outputDir, '--natural-use-report', naturalUseReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.status, 'not-applicable');
      assert.equal(report.naturalDiscoveredMemberUse.proofScope, 'not-applicable');
      assert.equal(report.naturalDiscoveredMemberUse.memberInvocationObserved, false);
      assert.equal(report.naturalDiscoveredMemberUse.returnedToParentAgent, false);
      assert.equal(report.explicitInvocation.status, 'not-applicable');
      assert.equal(report.coldStartCandidate.status, 'not-applicable');
      assert.equal(report.workbench.status, 'not-applicable');
      assert.equal(report.artifacts.memberTaskRun, undefined);
      assert.equal(existsSync(join(outputDir, 'artifacts/invocation/member-task-run.json')), false);
      assert.equal(existsSync(join(outputDir, 'artifacts/cold-start/member-profile-candidates.json')), false);
      assert.equal(existsSync(join(outputDir, 'artifacts/workbench/overview.txt')), false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(naturalUseDir, { recursive: true, force: true });
    }
  });

  it('accepts release-grade live-observed natural-use proof as product natural-use pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-live-'));
    const naturalUseDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-live-report-'));
    const discoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-live-discovery-'));
    try {
      writeLiveColdStartBundle(discoveryDir, { manifest: { source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db', dbDigest: sha256Text('real opencode db bytes') } } });
      const expectedInputDigest = sha256Text('natural-use invocation packet');
      const parentCallRecord = {
        kind: 'parent-agent-tool-call-record',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        route: 'authorized-explicit-member-activation',
        sourceThreadId: 'ses_naturalUse1234567890',
        parentTurnId: 'msg_naturalUse1234567890',
        invocationId: 'call_naturalUse1234567890',
        invocationSurface: 'cli-called-by-agent',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-skill-designer',
        expectedInputDigest,
        observedAt: '2026-07-10T00:00:00.000Z',
        rawCall: {
          callId: 'call_naturalUse1234567890',
          source: 'opencode-parent-call-exporter',
          ref: 'opencode-session:ses_naturalUse1234567890:msg_naturalUse1234567890:call_naturalUse1234567890',
          sessionExportRef: './opencode-session-export.json',
          sessionMessageId: 'msg_naturalUse1234567890',
          sessionPartId: 'prt_naturalUse1234567890',
        },
      };
      const transcriptPath = join(naturalUseDir, 'observed-parent-call-transcript.json');
      const parentCallRecordPath = join(naturalUseDir, 'observed-natural-use-parent-call.json');
      writeJson(transcriptPath, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [parentCallRecord] });
      writeJson(parentCallRecordPath, parentCallRecord);
      const naturalUseReport = join(naturalUseDir, 'natural-use-e2e-report.json');
      writeJson(naturalUseReport, {
        reportKind: 'context-tree-member-discovery-natural-use-e2e',
        status: 'pass',
        discoveryRoot: discoveryDir,
        memberName: 'skill-designer',
        usedSourceInputRef: 'session:root-a:message:1',
        confirmedBeforeUse: true,
        memberInvocationObserved: true,
        returnedToParentAgent: true,
        proofScope: 'live-observed',
        observedNaturalUse: { transcriptRef: transcriptPath, transcriptDigest: sha256Text(readFileSync(transcriptPath, 'utf8')), parentCallRecordRef: parentCallRecordPath },
      });
      const result = runEval(['--out', outputDir, '--natural-use-report', naturalUseReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.status, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.proofScope, 'live-observed');
      assert.equal(report.naturalDiscoveredMemberUse.releaseGradeProvenance, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.memberName, 'skill-designer');
      assert.equal(report.naturalDiscoveredMemberUse.usedSourceInputRef, 'session:root-a:message:1');
      assert.equal(report.explicitInvocation.status, 'not-applicable');
      assert.equal(existsSync(join(outputDir, 'artifacts/invocation/member-task-run.json')), false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(naturalUseDir, { recursive: true, force: true });
      rmSync(discoveryDir, { recursive: true, force: true });
    }
  });

  it('downgrades live-observed natural-use proof with fake exporter provenance to product-shape only', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-shape-'));
    const naturalUseDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-shape-report-'));
    const discoveryDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-natural-shape-discovery-'));
    try {
      writeLiveColdStartBundle(discoveryDir);
      const parentCallRecord = {
        kind: 'parent-agent-tool-call-record',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        route: 'authorized-explicit-member-activation',
        sourceThreadId: 'ses_naturalShape1234567890',
        parentTurnId: 'msg_naturalShape1234567890',
        invocationId: 'call_naturalShape1234567890',
        invocationSurface: 'cli-called-by-agent',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-skill-designer',
        expectedInputDigest: sha256Text('natural-use invocation packet'),
        observedAt: '2026-07-10T00:00:00.000Z',
        rawCall: {
          callId: 'call_naturalShape1234567890',
          source: 'opencode-parent-call-exporter',
          ref: 'opencode-session:ses_naturalShape1234567890:msg_naturalShape1234567890:call_naturalShape1234567890',
          sessionExportRef: './opencode-session-export.json',
          sessionMessageId: 'msg_naturalShape1234567890',
          sessionPartId: 'prt_naturalShape1234567890',
        },
      };
      const transcriptPath = join(naturalUseDir, 'observed-parent-call-transcript.json');
      const parentCallRecordPath = join(naturalUseDir, 'observed-natural-use-parent-call.json');
      writeJson(transcriptPath, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [parentCallRecord] });
      writeJson(parentCallRecordPath, parentCallRecord);
      const naturalUseReport = join(naturalUseDir, 'natural-use-e2e-report.json');
      writeJson(naturalUseReport, {
        reportKind: 'context-tree-member-discovery-natural-use-e2e',
        status: 'pass',
        discoveryRoot: discoveryDir,
        memberName: 'skill-designer',
        usedSourceInputRef: 'session:root-a:message:1',
        confirmedBeforeUse: true,
        memberInvocationObserved: true,
        returnedToParentAgent: true,
        proofScope: 'live-observed',
        observedNaturalUse: { transcriptRef: transcriptPath, transcriptDigest: sha256Text(readFileSync(transcriptPath, 'utf8')), parentCallRecordRef: parentCallRecordPath },
      });
      const result = runEval(['--out', outputDir, '--natural-use-report', naturalUseReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.naturalDiscoveredMemberUse.status, 'not-proven');
      assert.equal(report.naturalDiscoveredMemberUse.productShapeProof, 'pass');
      assert.match(report.naturalDiscoveredMemberUse.reason, /full OpenCode SQLite dbDigest/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(naturalUseDir, { recursive: true, force: true });
      rmSync(discoveryDir, { recursive: true, force: true });
    }
  });

  it('does not accept all-lines non-default gate output as semantic zero-candidate discovery', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-semantic-zero-all-lines-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-semantic-zero-all-lines-report-'));
    try {
      const liveReport = writeZeroCandidateLiveColdStartBundle(reportDir);
      writeJson(join(reportDir, 'attempt-1/member-need-gate-input.json'), { prompt: 'line 1\nline 2' });
      writeJson(join(reportDir, 'attempt-1/member-need-gate-raw-output.json'), { hit: true, ordinals: [1, 2] });
      writeJson(join(reportDir, 'attempt-1/member-need-gate-parsed-output.json'), { hit: true, ordinals: [1, 2] });
      writeJson(join(reportDir, 'attempt-1/member-candidate-extractor-input.json'), { prompt: 'semantic extractor input' });
      writeJson(join(reportDir, 'attempt-1/member-candidate-extractor-raw-output.json'), { proposals: [] });
      writeJson(join(reportDir, 'attempt-1/member-candidate-extractor-parsed-output.json'), { proposals: [] });
      const report = readJson(liveReport);
      const gateDiagnostics = {
        status: 'pass',
        adapterKind: 'fixture-semantic-gate',
        gateRun: true,
        lineCount: 2,
        flaggedLineCount: 2,
        allLinesFlagged: true,
        semanticClaim: true,
        inputArtifactRef: 'attempt-1/member-need-gate-input.json',
        rawOutputArtifactRef: 'attempt-1/member-need-gate-raw-output.json',
        parsedOutputArtifactRef: 'attempt-1/member-need-gate-parsed-output.json',
        parseErrors: [],
      };
      const extractorDiagnostics = {
        status: 'pass',
        adapterKind: 'fixture-semantic-extractor',
        extractorRun: true,
        semanticClaim: true,
        inputArtifactRef: 'attempt-1/member-candidate-extractor-input.json',
        rawOutputArtifactRef: 'attempt-1/member-candidate-extractor-raw-output.json',
        parsedOutputArtifactRef: 'attempt-1/member-candidate-extractor-parsed-output.json',
        parseErrors: [],
      };
      report.discoveryProofKind = 'semanticZeroCandidate';
      report.liveSessionDerivedCandidate.discoveryProofKind = 'semanticZeroCandidate';
      report.evidenceQuality.gateDiagnostics = gateDiagnostics;
      report.evidenceQuality.extractorDiagnostics = extractorDiagnostics;
      report.evidenceQuality.pipelineDiagnostics.gateDiagnostics = gateDiagnostics;
      report.evidenceQuality.pipelineDiagnostics.extractorDiagnostics = extractorDiagnostics;
      report.evidenceQuality.pipelineDiagnostics.zeroCandidateKind = 'semanticZeroCandidate';
      writeJson(liveReport, report);

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const aggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(aggregate.coldStartLiveObserved.status, 'blocked');
      assert.match(aggregate.coldStartLiveObserved.reason, /all-lines|selectivity|flagged/i);
      assert.equal(aggregate.semanticDiscovery.status, 'not-proven');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('downgrades forged agent-assisted product proof when observed transcriptRef is missing', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-missing-transcript-'));
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-missing-transcript-out-'));
    try {
      const liveReport = writeAgentAssistedZeroCandidateLiveColdStartBundle(reportDir, { transcriptRef: undefined });
      const report = readJson(liveReport);
      delete report.memberDiscoveryAnswerSource.transcriptRef;
      writeJson(liveReport, report);

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const aggregate = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(aggregate.coldStartLiveObserved.status, 'pass');
      assert.equal(aggregate.coldStartLiveObserved.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(aggregate.memberDiscovery.status, 'not-proven');
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('blocks forged agent-assisted product proof when observed turn digest does not match transcript bytes', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-digest-'));
    try {
      const liveReport = writeAgentAssistedZeroCandidateLiveColdStartBundle(reportDir, { observedTurnDigest: 'sha256:wrongdigest' });

      assertAgentAssistedProductBlocked(liveReport, /digest|observed parent-agent turn/i);
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks forged agent-assisted product proof when observed answer differs from retained raw output', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-answer-'));
    try {
      const liveReport = writeAgentAssistedZeroCandidateLiveColdStartBundle(reportDir, { observedTurn: { answer: 'y: 1' } });

      assertAgentAssistedProductBlocked(liveReport, /answer|raw output|observed parent-agent turn/i);
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks forged agent-assisted product proof when observed request path does not match requestRef', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-request-'));
    try {
      const liveReport = writeAgentAssistedZeroCandidateLiveColdStartBundle(reportDir, { observedTurn: { requestPath: join(reportDir, 'other-request.json') } });

      assertAgentAssistedProductBlocked(liveReport, /request.*match|requestRef|observed parent-agent turn|under report root/i);
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks forged agent-assisted product proof when artifact refs escape the report root', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-agent-assisted-traversal-'));
    try {
      const liveReport = writeAgentAssistedZeroCandidateLiveColdStartBundle(reportDir, { answerFileRef: '../outside-answer.txt' });

      assertAgentAssistedProductBlocked(liveReport, /under report root|relative path|answerFileRef/i);
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks live cold-start aggregate pass when gate/extractor diagnostics are missing', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-missing-diagnostics-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        report: {
          discoveryProofKind: undefined,
          evidenceQuality: {
            modeSource: { status: 'pass' },
            candidateCount: { status: 'pass', count: 1 },
            defaultExpert: { status: 'pass', defaultExpert: false },
            roleRoutingResponsibilities: { status: 'pass' },
            rootSessionOrCorroboration: { status: 'pass' },
            countedEvidenceExcludesNonGenuine: { status: 'pass' },
            excludedEvidenceDiagnostics: { status: 'pass' },
            manifestValidation: { status: 'pass' },
            noRegexOnlyPass: { status: 'pass' },
            sourceBackedRoleSummary: { status: 'pass' },
            candidateEvidenceRefsAreGenuine: { status: 'pass' },
            pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 1 } },
          },
        },
      });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /gate.*extractor|diagnostics/i);
      assert.equal(report.semanticDiscovery.status, 'not-proven');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks live cold-start aggregate pass when the live input source is missing exporter manifest proof', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-cold-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, { liveInput: { exporterManifestRef: undefined } });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /exporterManifestRef/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks live cold-start aggregate pass when quality contract fields are absent even if candidate status is pass', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-quality-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, { report: { evidenceQuality: undefined, candidateManifestValidation: undefined } });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /quality contract|evidenceQuality|candidateManifestValidation/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks live cold-start aggregate pass when candidate lacks source-backed role contract', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-role-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, { report: { liveSessionDerivedCandidate: { status: 'pass', memberName: 'dynamic-reviewer', defaultExpert: false, evidenceCoverage: { rootSessionCount: 2 }, sessionRefs: ['session:root-a', 'session:root-b'] } } });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /role|routing|responsibilities/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks forged aggregate live pass when noRegexOnlyPass is claimed without source grounding', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-forged-regex-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        report: {
          liveSessionDerivedCandidate: {
            status: 'pass',
            memberName: 'ai-agents',
            defaultExpert: false,
            role: 'Ai Agents Reviewer',
            routingDescription: 'Use for recurring parent-session review or inspection needs around ai agents.',
            responsibilities: ['Review recurring source-backed requests before candidate promotion.'],
            sessionRefs: ['session:root-a', 'session:root-b'],
            evidenceCoverage: { rootSessionCount: 2, messageCount: 2, supportingRunCount: 0 },
            evidenceRefs: [
              { kind: 'session-message', ref: 'session:root-a:message:1', digest: msgDigest1 },
              { kind: 'session-message', ref: 'session:root-b:message:1', digest: msgDigest2 },
            ],
          },
          evidenceQuality: {
            modeSource: { status: 'pass' },
            candidateCount: { status: 'pass', count: 1 },
            defaultExpert: { status: 'pass', defaultExpert: false },
            roleRoutingResponsibilities: { status: 'pass' },
            rootSessionOrCorroboration: { status: 'pass' },
            countedEvidenceExcludesNonGenuine: { status: 'pass' },
            excludedEvidenceDiagnostics: { status: 'pass' },
            manifestValidation: { status: 'pass' },
            noRegexOnlyPass: { status: 'pass' },
            sourceBackedRoleSummary: { status: 'pass' },
            candidateEvidenceRefsAreGenuine: { status: 'pass' },
            gateDiagnostics: { status: 'pass', adapterKind: 'fixture-semantic-gate', gateRun: true, flaggedLineCount: 2, inputArtifactRef: 'attempt-1/member-need-gate-input.json', rawOutputArtifactRef: 'attempt-1/member-need-gate-raw-output.json', parsedOutputArtifactRef: 'attempt-1/member-need-gate-parsed-output.json', parseErrors: [] },
            extractorDiagnostics: { status: 'pass', adapterKind: 'fixture-semantic-extractor', extractorRun: true, inputArtifactRef: 'attempt-1/member-candidate-extractor-input.json', rawOutputArtifactRef: 'attempt-1/member-candidate-extractor-raw-output.json', parsedOutputArtifactRef: 'attempt-1/member-candidate-extractor-parsed-output.json', parseErrors: [] },
            pipelineDiagnostics: { status: 'pass', discoveryCompleted: true, dreamerDiagnostics: { extractorRun: true }, hostValidatorDiagnostics: { validatorRun: true, acceptedCount: 1 } },
          },
        },
      });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /source-backed|regex-only|grounding/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks aggregate live pass when evidence refs are not genuine scan messages', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-evidence-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, {
        report: {
          sessionCorpusScan: {
            scanDiagnostics: { genuineUserMessageCount: 2, excludedSyntheticCount: 0, excludedHandoffCount: 0, excludedToolOutputCount: 2 },
            excludedSessions: [],
            scannedMessages: [
              { role: 'user', sessionId: 'root-a', ordinal: 1, text: 'ask skill-designer to review routing', ref: 'session:root-a:message:1', digest: msgDigest1, evidenceSourceKind: 'tool-output' },
              { role: 'user', sessionId: 'root-b', ordinal: 1, text: 'skill-designer should check responsibilities again', ref: 'session:root-b:message:1', digest: msgDigest2, evidenceSourceKind: 'genuine-user-message' },
            ],
          },
        },
      });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /genuine scan message|tool-output|evidence refs/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks live cold-start aggregate pass when the corpus digest does not match live-input-source', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-cold-digest-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, { corpusDigest: 'sha256:wrongdigest' });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /corpus digest/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('blocks live cold-start aggregate pass when exporter manifest identity drifts from the corpus', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-live-cold-manifest-block-'));
    const reportDir = mkdtempSync(join(tmpdir(), 'ctree-member-session-cold-start-live-eval-'));
    try {
      const liveReportPath = writeLiveColdStartBundle(reportDir, { manifest: { projectIdentity: '/repo/other-project' } });

      const result = runEval(['--out', outputDir, '--cold-start-live-report', liveReportPath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = readJson(join(outputDir, 'member-system-e2e-report.json'));
      assert.equal(report.coldStartLiveObserved.status, 'blocked');
      assert.match(report.coldStartLiveObserved.reason, /project identity/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(reportDir, { recursive: true, force: true });
    }
  });
});
