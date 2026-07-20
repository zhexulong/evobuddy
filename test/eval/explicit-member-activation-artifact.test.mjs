import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanarySet } from '../../src/eval/canaries.mjs';
import { explicitMemberActivationCaseResultFromArtifact } from '../../src/eval/explicit-member-activation-artifact.mjs';
import { createCapabilityReport } from '../../src/eval/report.mjs';

const canaries = createCanarySet('explicit-member-live');

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function readJsonUrl(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function assertNoRetainedFixturePathLeak(value, path = 'fixture') {
  if (typeof value === 'string') {
    assert.doesNotMatch(value, /\/home\/prosumer\/agent\/context-tree/, `${path} must not leak the local repo path`);
    assert.doesNotMatch(
      value,
      /\/tmp\/opencode\/runtime-observer-export-source-corroborated/,
      `${path} must not leak the corroborated source /tmp path`,
    );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRetainedFixturePathLeak(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      assertNoRetainedFixturePathLeak(item, `${path}.${key}`);
    }
  }
}

function loadRetainedExplicitFixture() {
  const fixtureDir = new URL('../../evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-positive/', import.meta.url);
  const acceptanceProofUrl = new URL('acceptance-proof.json', fixtureDir);
  return {
    fixtureDir,
    rawArtifact: readJsonUrl(acceptanceProofUrl),
    artifact: {
      ...readJsonUrl(acceptanceProofUrl),
      __artifactSourcePath: acceptanceProofUrl.pathname,
    },
    request: readJsonUrl(new URL('member-task-request.json', fixtureDir)),
    run: readJsonUrl(new URL('member-task-run.json', fixtureDir)),
    render: readJsonUrl(new URL('member-context-render.json', fixtureDir)),
    selection: readJsonUrl(new URL('material-selection-report.json', fixtureDir)),
    executorInput: readJsonUrl(new URL('explicit-member-executor-input.json', fixtureDir)),
    executorOutput: readJsonUrl(new URL('explicit-member-executor-output.json', fixtureDir)),
    executorObservation: readJsonUrl(new URL('explicit-member-executor-observation.json', fixtureDir)),
  };
}

function loadRetainedCorroboratedExplicitProductFixture() {
  const fixtureDir = new URL('../../evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-corroborated-product/', import.meta.url);
  const acceptanceProofUrl = new URL('acceptance-proof.json', fixtureDir);
  return {
    fixtureDir,
    rawArtifact: readJsonUrl(acceptanceProofUrl),
    artifact: {
      ...readJsonUrl(acceptanceProofUrl),
      __artifactSourcePath: acceptanceProofUrl.pathname,
    },
    transcript: readJsonUrl(new URL('observed-parent-call-transcript.json', fixtureDir)),
    parentCallRecord: readJsonUrl(new URL('parent-call-record.json', fixtureDir)),
    parentSource: readJsonUrl(new URL('explicit-member-parent-invocation-source.json', fixtureDir)),
    parentInvocation: readJsonUrl(new URL('explicit-member-parent-invocation.json', fixtureDir)),
    evalReport: readJsonUrl(new URL('eval/capability-matrix.json', fixtureDir)),
  };
}

function createExplicitBundle(overrides = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-member-'));
  const memberName = overrides.memberName ?? 'skill-designer';
  const resolvedMemberId = overrides.resolvedMemberId ?? 'mem-sd-001';
  const roleCanary = 'ROLE-CANARY-live-member';
  const targetCanary = 'TARGET-CANARY-live-member';
  const answer = overrides.answer ?? `executor saw ${canaries.survive} ${roleCanary} ${targetCanary}`;
  const requestPath = join(rootDir, 'member-task-request.json');
  const runPath = join(rootDir, 'member-task-run.json');
  const renderPath = join(rootDir, 'member-context-render.json');
  const selectionPath = join(rootDir, 'material-selection-report.json');
  const inputPath = join(rootDir, 'explicit-member-executor-input.json');
  const packetPath = join(rootDir, 'member-invocation-packet.json');
  const outputPath = join(rootDir, 'explicit-member-executor-output.json');
  const observationPath = join(rootDir, 'explicit-member-executor-observation.json');
  const parentSourcePath = join(rootDir, 'explicit-member-parent-invocation-source.json');
  const parentCallRecordPath = join(rootDir, 'parent-call-record.json');
  const profileRef = join(rootDir, `${memberName}.json`);
  const targetRef = join(rootDir, 'target.md');

  const request = {
    id: 'mtreq-explicit-001',
    memberName,
    resolvedMemberId,
    expectedResultReturn: 'parent-agent',
    memberContextRenderRef: renderPath,
    materialSelectionReportRef: selectionPath,
    memberInvocationPacketRef: packetPath,
    preparedChildInput: { kind: 'prompt-text', text: 'prepared explicit member input' },
    preparedChildInputDigest: 'sha256:executor-input-explicit',
    baselineDigest: 'sha256:baseline-explicit',
    deltaDigest: 'sha256:delta-explicit',
    baselineReuseStatus: 're-rendered',
    profileRef,
    targetRefs: [targetRef],
  };
  const render = {
    renderId: 'sha256:render-explicit',
    memberName,
    profileRef,
    selectionReportRef: selectionPath,
    baselineDigest: request.baselineDigest,
    deltaDigest: request.deltaDigest,
    baselineReuseStatus: request.baselineReuseStatus,
    baselineVersion: 'explicit-v1',
    m0Refs: [profileRef],
    m1Refs: [profileRef, targetRef],
  };
  const selection = {
    reportId: 'sha256:selection-explicit',
    memberName,
    baselineRefs: [profileRef],
    invocationRequestedRefs: [targetRef],
    finalM0Refs: [profileRef],
    finalM1Refs: [profileRef, targetRef],
    searchableRefs: [],
    sourceOnlyRefs: [],
  };
  const runOverrides = overrides.run ?? {};
  const run = {
    id: 'mtr-explicit-001',
    memberName,
    resolvedMemberId,
    memberTaskRequestRef: requestPath,
    memberContextRenderRef: renderPath,
    materialSelectionReportRef: selectionPath,
    materialSelectionMode: 'explicit-route',
    baselineDigest: request.baselineDigest,
    deltaDigest: request.deltaDigest,
    baselineReuseStatus: request.baselineReuseStatus,
    baselineVersion: render.baselineVersion,
    materials: {
      items: [
        { materialRef: profileRef, sourceRef: profileRef, visibility: 'intended-model-input' },
        { materialRef: targetRef, sourceRef: targetRef, visibility: 'intended-model-input' },
      ],
    },
    materialProof: {
      status: 'pass',
      required: { roleHistory: [roleCanary], targetMaterial: [targetCanary] },
      observed: [canaries.survive, roleCanary, targetCanary],
      missing: { roleHistory: [], targetMaterial: [] },
      pass: true,
    },
    inputDigests: {
      preparedChildInputDigest: request.preparedChildInputDigest,
      runtimeInputDigest: 'sha256:executor-input-explicit',
    },
    packetDeliveryEvidence: {
      kind: 'member-packet-delivery-evidence',
      deliveryKind: 'custom-agent-task',
      deliveryAuthority: 'adapter-observed',
      runtimeSurface: 'opencode',
      memberInvocationPacketRef: packetPath,
      deliveredInputDigest: 'sha256:executor-input-explicit',
      evidenceRef: observationPath,
    },
    resultReturnEvidence: {
      kind: 'member-result-return-evidence',
      returnedTo: 'parent-agent',
      evidenceKind: 'adapter-parent-call-record',
      evidenceRef: join(rootDir, 'explicit-member-parent-invocation.json'),
      resultDigest: digest(answer),
    },
    result: {
      resultRef: outputPath,
      returnedTo: 'parent-agent',
      summary: answer,
      resultDigest: digest(answer),
      evidenceRefs: [{ kind: 'adapter-parent-call-record', ref: join(rootDir, 'explicit-member-parent-invocation.json') }],
      ...(runOverrides.result ?? {}),
    },
    ...runOverrides,
  };
  if (runOverrides.result) {
    run.result = {
      resultRef: outputPath,
      returnedTo: 'parent-agent',
      summary: answer,
      resultDigest: digest(answer),
      evidenceRefs: [{ kind: 'adapter-parent-call-record', ref: join(rootDir, 'explicit-member-parent-invocation.json') }],
      ...runOverrides.result,
    };
  }
  const executorOutput = {
    kind: overrides.executorKind ?? 'agent-runtime',
    answer,
    answerDigest: digest(answer),
    inputDigest: 'sha256:executor-input-explicit',
    ...(overrides.executorOutput ?? {}),
  };
  const executorInput = {
    kind: 'explicit-member-executor-input',
    route: 'authorized-explicit-member-activation',
    method: 'context-tree-explicit-member-executor',
    memberName,
    resolvedMemberId,
    memberTaskRequestRef: requestPath,
    memberContextRenderRef: renderPath,
    materialSelectionReportRef: selectionPath,
    memberInvocationPacketRef: packetPath,
    inputDigest: executorOutput.inputDigest,
    ...(overrides.executorInput ?? {}),
  };
  const memberInvocationPacket = {
    kind: 'member-invocation-packet',
    memberName,
    memberTaskRequestRef: requestPath,
    memberContextRenderRef: renderPath,
    materialSelectionReportRef: selectionPath,
    task: { kind: 'review', question: 'Review explicit path', targetRefs: [targetRef], ...(overrides.request?.task ?? {}) },
    expectedResultReturn: 'parent-agent',
    preparedChildInput: request.preparedChildInput,
    preparedChildInputDigest: request.preparedChildInputDigest,
    m0Refs: render.m0Refs,
    m1Refs: render.m1Refs,
    targetRefs: request.targetRefs,
    writeback: { expectedResultReturn: 'parent-agent' },
    invocationPacketDigest: 'sha256:invocation-packet-explicit',
    ...(overrides.memberInvocationPacket ?? {}),
  };
  const parentInvocationPath = join(rootDir, 'explicit-member-parent-invocation.json');
  const parentCallRecord = {
    kind: 'parent-agent-tool-call-record',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-explicit',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'cli-called-by-agent',
    memberName,
    resolvedMemberId,
    expectedInputDigest: executorInput.inputDigest,
    observedAt: '2026-07-08T12:00:00.500Z',
    ...(overrides.parentCallRecord ?? {}),
  };
  const parentCallDigest = digest(JSON.stringify(parentCallRecord));
  const observation = {
    kind: 'explicit-member-executor-observation',
    runtimeAgentId: 'agent-explicit-1',
    memberName,
    authoritySource: overrides.authoritySource ?? 'adapter-observed',
    fixture: overrides.fixture ?? false,
    executorKind: overrides.executorKind ?? 'agent-runtime',
    invocationId: 'explicit-invocation-1',
    status: 'completed',
    startedAt: '2026-07-08T12:00:01.000Z',
    completedAt: '2026-07-08T12:00:02.000Z',
    executionRef: 'process:agent-runtime-harness:1',
    inputRef: './explicit-member-executor-input.json',
    outputRef: './explicit-member-executor-output.json',
    inputDigest: executorOutput.inputDigest,
    outputDigest: executorOutput.answerDigest,
    parentInvocationRef: parentInvocationPath,
    observedAt: '2026-07-08T12:00:00.000Z',
    ...(overrides.observation ?? {}),
  };
  const parentSource = {
    kind: 'explicit-member-parent-invocation-source',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    sourceThreadId: 'parent-thread-explicit',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'cli-called-by-agent',
    route: 'authorized-explicit-member-activation',
    memberName,
    resolvedMemberId,
    expectedInputDigest: executorInput.inputDigest,
    sourceKind: 'observed-parent-agent-call',
    parentCallRecordRef: parentCallRecordPath,
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: parentCallRecordPath, digest: parentCallDigest }],
    observedAt: '2026-07-08T12:00:00.500Z',
    ...(overrides.parentSource ?? {}),
  };
  const parentInvocation = {
    kind: 'explicit-member-parent-invocation',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-explicit',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'cli-called-by-agent',
    authorized: true,
    memberName,
    resolvedMemberId,
    executorKind: overrides.executorKind ?? 'agent-runtime',
    executorInputRef: inputPath,
    executorObservationRef: observationPath,
    observedCallPathRef: parentSourcePath,
    observerKind: 'parent-agent-runtime-observer',
    sourceKind: 'observed-parent-agent-call',
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: parentCallRecordPath, digest: parentCallDigest }],
    inputDigest: executorInput.inputDigest,
    expectedInputDigest: executorInput.inputDigest,
    invokedAt: '2026-07-08T12:00:00.000Z',
    completedAt: '2026-07-08T12:00:03.000Z',
    status: 'completed',
    returnedTo: 'parent-agent',
    ...(overrides.parentInvocation ?? {}),
  };

  writeJson(requestPath, { ...request, ...(overrides.request ?? {}) });
  writeJson(renderPath, { ...render, ...(overrides.render ?? {}) });
  writeJson(selectionPath, { ...selection, ...(overrides.selection ?? {}) });
  writeJson(runPath, run);
  writeJson(inputPath, executorInput);
  writeJson(packetPath, memberInvocationPacket);
  writeJson(outputPath, executorOutput);
  writeJson(observationPath, observation);
  writeJson(parentCallRecordPath, parentCallRecord);
  if (overrides.writeParentSource !== false) {
    writeJson(parentSourcePath, parentSource);
  }
  if (overrides.writeParentInvocation !== false) {
    writeJson(parentInvocationPath, parentInvocation);
  }

  const artifact = {
    artifactKind: 'explicit-member-activation-capability-artifact',
    caseId: 'authorized-explicit-member-activation',
    acceptanceMode: 'authorized-explicit-member-activation',
    acceptanceTier: { id: 'authorized-explicit-member-activation' },
    sourceThreadId: 'parent-thread-explicit',
    reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the explicit member executor output? Answer unknown when not visible; do not guess.',
    requestedMember: memberName,
    resolvedMemberId,
    providerForcedLiveProof: false,
    deterministicProviderProof: false,
    artifactRefs: {
      memberTaskRequestPath: requestPath,
      memberTaskRunPath: runPath,
      executorInputPath: inputPath,
      executorOutputPath: outputPath,
      executorObservationPath: observationPath,
      memberInvocationPacketPath: packetPath,
      parentInvocationPath,
    },
    executorProof: {
      authority: overrides.authority ?? 'agent-runtime',
      authoritySource: overrides.authoritySource ?? 'adapter-observed',
      fixture: overrides.fixture ?? false,
      inputDigest: executorInput.inputDigest,
      outputDigest: executorOutput.answerDigest,
      observedInputDigest: observation.inputDigest,
      observedOutputDigest: observation.outputDigest,
      outputRef: outputPath,
      observationRef: observationPath,
      parentInvocationRef: observation.parentInvocationRef,
      kind: overrides.executorKind ?? 'agent-runtime',
      ...(overrides.executorProof ?? {}),
    },
    __artifactSourcePath: join(rootDir, 'acceptance-proof.json'),
    ...(overrides.artifact ?? {}),
  };
  writeJson(artifact.__artifactSourcePath, artifact);

  return { rootDir, artifact, paths: { inputPath, outputPath, observationPath, packetPath, runPath, requestPath, parentInvocationPath, parentSourcePath, parentCallRecordPath } };
}

async function evaluateExplicit(overrides = {}) {
  const bundle = createExplicitBundle(overrides);
  try {
    const result = await explicitMemberActivationCaseResultFromArtifact(bundle.artifact, { canaries, mode: 'mock' });
    return { result, cleanup: () => rmSync(bundle.rootDir, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(bundle.rootDir, { recursive: true, force: true });
    throw error;
  }
}

describe('authorized-explicit-member-activation', () => {
  it('passes product acceptance for a non-fixture explicit route when lifecycle artifacts prove the same member path', async () => {
    const { result, cleanup } = await evaluateExplicit();
    try {
      assert.equal(result.caseId, 'authorized-explicit-member-activation');
      assert.equal(result.acceptanceTier.id, 'authorized-explicit-member-activation');
      assert.equal(result.verdict, 'pass');
      assert.equal(result.explicitMemberMechanismPass, true);
      assert.equal(result.explicitMemberActivationPass, true);
      assert.equal(result.lifecycleVerdict.status, 'pass');
      assert.equal(result.executorProof.fixture, false);
      assert.equal(result.executorProof.authority, 'agent-runtime');
      assert.equal(result.manifest.recoveryMethod, 'context-tree-explicit-member-executor');
      assert.equal(result.manifest.codexApi, 'mock');
    } finally {
      cleanup();
    }
  });

  it('passes mechanism validation but keeps product acceptance not-run for fixture executor proof', async () => {
    const { result, cleanup } = await evaluateExplicit({ fixture: true, authority: 'fixture', authoritySource: 'fixture', executorKind: 'fixture' });
    try {
      assert.equal(result.verdict, 'pass');
      assert.equal(result.explicitMemberMechanismPass, true);
      assert.equal(result.explicitMemberActivationPass, false);
      assert.equal(result.productAcceptance, 'not-run');
    } finally {
      cleanup();
    }
  });

  it('fails when memberTaskRun.memberName does not match the requested member in the proof envelope', async () => {
    const { result, cleanup } = await evaluateExplicit({ run: { memberName: 'different-member' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /memberName|requestedMember/i);
    } finally {
      cleanup();
    }
  });

  it('fails when artifact.requestedMember drifts from memberTaskRequest.memberName', async () => {
    const { result, cleanup } = await evaluateExplicit({ request: { memberName: 'different-member' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /requestedMember|memberTaskRequest\.memberName/i);
    } finally {
      cleanup();
    }
  });

  it('fails when artifact.resolvedMemberId drifts from memberTaskRequest.resolvedMemberId', async () => {
    const { result, cleanup } = await evaluateExplicit({ request: { resolvedMemberId: 'mem-different-001' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /resolvedMemberId|resolved member proof/i);
    } finally {
      cleanup();
    }
  });

  it('keeps product acceptance not-run when executorProof.kind is fixture despite non-fixture output', async () => {
    const { result, cleanup } = await evaluateExplicit({ executorProof: { kind: 'fixture' } });
    try {
      assert.equal(result.verdict, 'pass');
      assert.equal(result.explicitMemberMechanismPass, true);
      assert.equal(result.explicitMemberActivationPass, false);
      assert.equal(result.productAcceptance, 'not-run');
    } finally {
      cleanup();
    }
  });

  it('fails when result.returnedTo is not parent-agent', async () => {
    const { result, cleanup } = await evaluateExplicit({ run: { result: { returnedTo: 'child-agent' } } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /returnedTo|parent-agent/i);
    } finally {
      cleanup();
    }
  });

  it('fails product explicit member activation without member-invocation-packet evidence', async () => {
    const { result, cleanup } = await evaluateExplicit({ request: { memberInvocationPacketRef: undefined } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /member-invocation-packet|packet delivery/i);
    } finally {
      cleanup();
    }
  });

  it('fails parent-agent returnedTo when only file evidence exists', async () => {
    const { result, cleanup } = await evaluateExplicit({
      run: {
        result: { returnedTo: 'parent-agent', evidenceRefs: [{ kind: 'file', ref: './explicit-member-executor-output.json' }] },
        resultReturnEvidence: undefined,
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /parent-agent.*return/i);
    } finally {
      cleanup();
    }
  });

  it('fails when result.resultRef does not resolve to explicit-member-executor-output.json', async () => {
    const { result, cleanup } = await evaluateExplicit({ run: { result: { resultRef: './wrong-output.json' } } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /explicit-member-executor-output\.json|resultRef/i);
    } finally {
      cleanup();
    }
  });

  it('fails when memberTaskRun.result.summary does not match executorOutput.answer', async () => {
    const { result, cleanup } = await evaluateExplicit({ run: { result: { summary: 'drifted summary' } } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /summary|executorOutput\.answer/i);
    } finally {
      cleanup();
    }
  });

  it('passes product-evidence mode when answer omits material canaries but input/delivery evidence is present', async () => {
    const { result, cleanup } = await evaluateExplicit({ answer: 'executor omitted the canaries' });
    try {
      assert.equal(result.verdict, 'pass');
      assert.equal(result.explicitMemberMechanismPass, true);
      assert.equal(result.failureReason, null);
    } finally {
      cleanup();
    }
  });

  it('fails product-evidence mode when delivery evidence is missing even if answer contains canaries', async () => {
    const { result, cleanup } = await evaluateExplicit({
      run: { packetDeliveryEvidence: undefined },
      answer: `executor saw ${canaries.survive} ROLE-CANARY-live-member TARGET-CANARY-live-member`,
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /packet delivery evidence|delivery evidence/i);
    } finally {
      cleanup();
    }
  });

  it('legacy-answer-canary mode fails when expected canaries are absent from executorOutput.answer', async () => {
    const { result, cleanup } = await evaluateExplicit({
      answer: 'executor omitted the canaries',
      artifact: { materialProofMode: 'legacy-answer-canary' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /missing expected canary|executorOutput\.answer/i);
    } finally {
      cleanup();
    }
  });

  it('fails when memberTaskRun.result.resultDigest does not match executorOutput.answerDigest', async () => {
    const { result, cleanup } = await evaluateExplicit({ run: { result: { resultDigest: 'sha256:edited-result-digest' } } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /resultDigest|answerDigest/i);
    } finally {
      cleanup();
    }
  });

  it('fails when executor input output and observation digests disagree', async () => {
    const { result, cleanup } = await evaluateExplicit({ observation: { inputDigest: 'sha256:wrong-input', outputDigest: 'sha256:wrong-output' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /observation|digest/i);
    } finally {
      cleanup();
    }
  });

  it('keeps product acceptance not-run when parent invocation evidence is missing', async () => {
    const { result, cleanup } = await evaluateExplicit({ observation: { parentInvocationRef: undefined } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /parent invocation|parentInvocationRef/i);
    } finally {
      cleanup();
    }
  });

  it('fails when parent invocation proof points to a missing artifact', async () => {
    const { result, cleanup } = await evaluateExplicit({
      observation: { parentInvocationRef: 'missing-parent-invocation.json' },
      executorProof: { parentInvocationRef: 'missing-parent-invocation.json' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /parent invocation|readable JSON|parentInvocationRef/i);
    } finally {
      cleanup();
    }
  });

  it('fails when proof digests drift from executor artifacts', async () => {
    const { result, cleanup } = await evaluateExplicit({ executorProof: { inputDigest: 'sha256:forged-input' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /executorProof\.inputDigest|input digest/i);
    } finally {
      cleanup();
    }
  });

  it('fails when product-grade proof digest fields are omitted', async () => {
    const { result, cleanup } = await evaluateExplicit({
      executorProof: {
        inputDigest: undefined,
        outputDigest: undefined,
        observedInputDigest: undefined,
        observedOutputDigest: undefined,
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /executorProof\.(inputDigest|outputDigest|observedInputDigest|observedOutputDigest)/i);
    } finally {
      cleanup();
    }
  });

  it('fails when executor observation omits the parent invocation binding', async () => {
    const { result, cleanup } = await evaluateExplicit({
      observation: { parentInvocationRef: undefined },
      executorProof: { parentInvocationRef: './explicit-member-parent-invocation.json' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /executor observation parentInvocationRef|parent invocation/i);
    } finally {
      cleanup();
    }
  });

  it('fails when executor output is marked fixture even with an agent-runtime kind', async () => {
    const { result, cleanup } = await evaluateExplicit({ executorOutput: { fixture: true } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /executorOutput\.fixture|fixture/i);
    } finally {
      cleanup();
    }
  });

  it('fails when executor input identity drifts from the lifecycle member', async () => {
    const { result, cleanup } = await evaluateExplicit({ executorInput: { memberName: 'different-member', resolvedMemberId: 'mem-different-001' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /executor input (memberName|resolvedMemberId)/i);
    } finally {
      cleanup();
    }
  });

  it('fails when proof authority drifts from executor observation', async () => {
    const { result, cleanup } = await evaluateExplicit({ observation: { authoritySource: 'self-attested' } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /authoritySource|executor observation/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent invocation is file-writer-only', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { invocationSurface: 'file-writer' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /invocationSurface|parent-agent call path|file-writer/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when an allowed surface label lacks observed parent source evidence', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { observedCallPathRef: undefined, observerKind: undefined },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /observedCallPathRef|observerKind|parent source/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent source is fixture wildcard or lacks provenance digests', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { inputDigest: '*', expectedInputDigest: '*', sourceKind: 'fixture', provenanceRefs: [] },
      parentSource: { expectedInputDigest: '*', sourceKind: 'fixture', provenanceRefs: [{ kind: 'fixture', ref: 'evals/fixtures/source.json' }] },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /fixture|wildcard|provenance|exact input digest/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent source lacks a real parent call record digest closure', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentSource: { parentCallRecordRef: undefined },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /parentCallRecordRef|parent call record/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent invocation provenance digest does not match the parent call record', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: {
        provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: './parent-call-record.json', digest: 'sha256:placeholder-parent-invocation-digest' }],
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /parent invocation provenanceRefs\[0\]\.digest|parent call record digest/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent invocation sourceKind drifts from parent source sourceKind', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { sourceKind: 'cli-parent-source-writer' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /sourceKind.*match|parent invocation sourceKind/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when executor observation lacks execution boundary fields', async () => {
    const { result, cleanup } = await evaluateExplicit({
      observation: {
        invocationId: undefined,
        status: undefined,
        startedAt: undefined,
        completedAt: undefined,
        executionRef: undefined,
        inputRef: undefined,
        outputRef: undefined,
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /invocationId|startedAt|completedAt|executionRef|inputRef|outputRef/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when observation refs do not resolve to actual artifacts', async () => {
    const { result, cleanup } = await evaluateExplicit({
      observation: { inputRef: './forged-input.json', outputRef: './forged-output.json' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /inputRef|outputRef|explicit-member-executor/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent invocation and observation invocationId drift', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { invocationId: 'explicit-invocation-parent' },
      observation: { invocationId: 'explicit-invocation-observation' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /invocationId/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent input output observation and proof digests disagree', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { inputDigest: 'sha256:parent-forged-input' },
      executorProof: { outputDigest: 'sha256:proof-forged-output' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /digest|inputDigest|outputDigest/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent and executor timing order is impossible', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: { invokedAt: '2026-07-08T12:00:02.500Z', completedAt: '2026-07-08T12:00:01.500Z' },
      observation: { startedAt: '2026-07-08T12:00:01.000Z', completedAt: '2026-07-08T12:00:02.000Z' },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /timing|invokedAt|startedAt|completedAt|complete before/i);
    } finally {
      cleanup();
    }
  });

  it('fails when executor used role-history or target refs absent from material selection evidence', async () => {
    const { result, cleanup } = await evaluateExplicit({ observation: { usedMaterialRefs: ['/tmp/untracked-role.md', '/tmp/untracked-target.md'] } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /usedMaterialRefs|material selection/i);
    } finally {
      cleanup();
    }
  });

  it('fails agent-runtime executor proof unless authoritySource is adapter-observed', async () => {
    const { result, cleanup } = await evaluateExplicit({ authoritySource: 'sidecar-retained' });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /adapter-observed|authoritySource/i);
    } finally {
      cleanup();
    }
  });

  it('fails agent-runtime executor proof without an observation artifact', async () => {
    const { result, cleanup } = await evaluateExplicit({ executorProof: { observationRef: undefined } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /explicit-member-executor-observation\.json|observationRef/i);
    } finally {
      cleanup();
    }
  });

  it('fails when provider-forced or retained-only shortcuts are used', async () => {
    const { result, cleanup } = await evaluateExplicit({ artifact: { providerForcedLiveProof: true, deterministicProviderProof: true } });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /provider-forced|retained|deterministic/i);
    } finally {
      cleanup();
    }
  });

  it('keeps the route member registry generic rather than requiring skill-designer', async () => {
    const { result, cleanup } = await evaluateExplicit({
      memberName: 'research-reviewer',
      resolvedMemberId: 'mem-research-001',
    });
    try {
      assert.equal(result.verdict, 'pass');
      assert.equal(result.memberName, 'research-reviewer');
      assert.equal(result.explicitMemberActivationPass, true);
    } finally {
      cleanup();
    }
  });

  it('parses the checked-in retained explicit mechanism-positive fixture without product acceptance', async () => {
    const fixture = loadRetainedExplicitFixture();

    const result = await explicitMemberActivationCaseResultFromArtifact(fixture.artifact, {
      canaries: createCanarySet('authorized-explicit-member-activation'),
      mode: 'mock',
    });
    const report = createCapabilityReport({ caseResults: [result], nativeSpawnArtifacts: [] });

    assert.equal(result.caseId, 'authorized-explicit-member-activation');
    assert.equal(result.acceptanceTier?.id, 'authorized-explicit-member-activation');
    assert.equal(result.acceptanceTier?.mechanism, 'authorized-explicit-member-executor');
    assert.equal(fixture.artifact.acceptanceMode, 'authorized-explicit-member-activation');
    assert.equal(result.verdict, 'pass');
    assert.equal(result.explicitMemberMechanismPass, true);
    assert.equal(result.explicitMemberActivationPass, false);
    assert.equal(result.productAcceptance, 'not-run');
    assert.equal(report.summary.explicitMemberMechanismPass, true);
    assert.equal(report.summary.explicitMemberActivationPass, false);
    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
    assert.equal(report.summary.nativeSpawnPass, false);
    assert.equal(report.summary.spawnPass, false);
    assert.equal(report.summary.summaryBaselinePass, false);
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal(result.executorProof.authority, 'fixture');
    assert.equal(result.executorProof.fixture, true);
    assert.equal(result.executorProof.method, 'context-tree-explicit-member-executor');
    assert.equal(result.manifest.recoveryMethod, 'context-tree-explicit-member-executor');
    assert.equal(result.manifest.codexApi, 'mock');
  });

  it('retained explicit fixture keeps result, executor, lifecycle, taxonomy, and portability invariants aligned', () => {
    const fixture = loadRetainedExplicitFixture();

    assert.equal(fixture.run.result.returnedTo, 'parent-agent');
    assert.equal(fixture.run.result.resultRef, './explicit-member-executor-output.json');
    assert.equal(fixture.run.result.resultDigest, fixture.executorOutput.answerDigest);
    assert.equal(fixture.run.result.summary, fixture.executorOutput.answer);
    assert.equal(fixture.executorOutput.inputDigest, fixture.executorObservation.inputDigest);
    assert.equal(fixture.executorOutput.answerDigest, fixture.executorObservation.outputDigest);
    assert.equal(fixture.executorInput.inputDigest, fixture.executorOutput.inputDigest);
    assert.equal(fixture.artifact.artifactRefs.memberTaskRequestPath, './member-task-request.json');
    assert.equal(fixture.artifact.artifactRefs.memberTaskRunPath, './member-task-run.json');
    assert.equal(fixture.artifact.artifactRefs.executorOutputPath, './explicit-member-executor-output.json');
    assert.equal(fixture.artifact.executorProof.outputRef, './explicit-member-executor-output.json');
    assert.equal(fixture.artifact.executorProof.observationRef, './explicit-member-executor-observation.json');
    assert.equal(fixture.run.memberTaskRequestRef, './member-task-request.json');
    assert.equal(fixture.run.memberContextRenderRef, './member-context-render.json');
    assert.equal(fixture.run.materialSelectionReportRef, './material-selection-report.json');
    assert.equal(fixture.request.memberContextRenderRef, './member-context-render.json');
    assert.equal(fixture.request.materialSelectionReportRef, './material-selection-report.json');
    assert.equal(fixture.render.selectionReportRef, './material-selection-report.json');
    assert.equal(fixture.run.baselineDigest, fixture.request.baselineDigest);
    assert.equal(fixture.run.deltaDigest, fixture.request.deltaDigest);
    assert.equal(fixture.run.baselineDigest, fixture.render.baselineDigest);
    assert.equal(fixture.run.deltaDigest, fixture.render.deltaDigest);
    assert.deepEqual(fixture.selection.finalM0Refs, fixture.render.m0Refs);
    assert.deepEqual(fixture.selection.finalM1Refs, fixture.render.m1Refs);
    assert.equal(fixture.executorInput.method, 'context-tree-explicit-member-executor');
    assert.equal(fixture.artifact.executorProof.method, 'context-tree-explicit-member-executor');
    assert.notEqual(fixture.artifact.acceptanceMode, 'authorized-natural-native-spawn');
    assert.notEqual(fixture.artifact.executorProof.method, 'codex-spawn-agent-full-history');
    assert.equal(fixture.artifact.acceptanceTier.runtimeNativeSpawn, false);
    assertNoRetainedFixturePathLeak(fixture.rawArtifact);
    assertNoRetainedFixturePathLeak(fixture.request);
    assertNoRetainedFixturePathLeak(fixture.run);
    assertNoRetainedFixturePathLeak(fixture.render);
    assertNoRetainedFixturePathLeak(fixture.selection);
    assertNoRetainedFixturePathLeak(fixture.executorInput);
    assertNoRetainedFixturePathLeak(fixture.executorOutput);
    assertNoRetainedFixturePathLeak(fixture.executorObservation);
  });

  it('locks the retained corroborated explicit product fixture as explicit pass without native tier pollution', async () => {
    const fixture = loadRetainedCorroboratedExplicitProductFixture();

    const result = await explicitMemberActivationCaseResultFromArtifact(fixture.artifact, {
      canaries: createCanarySet('authorized-explicit-member-activation'),
      mode: 'mock',
    });
    const report = createCapabilityReport({ caseResults: [result], nativeSpawnArtifacts: [] });
    const expectedParentCallDigest = digest(JSON.stringify(fixture.parentCallRecord));

    assert.equal(fixture.transcript.kind, 'observed-parent-agent-call-transcript');
    assert.equal(fixture.transcript.calls?.[0]?.kind, 'parent-agent-tool-call-record');
    assert.deepEqual(fixture.transcript.calls?.[0], fixture.parentCallRecord);
    assert.equal(fixture.parentSource.sourceKind, 'observed-parent-agent-call');
    assert.equal(fixture.parentInvocation.sourceKind, 'observed-parent-agent-call');
    assert.equal(fixture.parentSource.parentCallRecordRef, './parent-call-record.json');
    assert.equal(fixture.parentSource.provenanceRefs?.[0]?.digest, expectedParentCallDigest);
    assert.equal(fixture.parentInvocation.provenanceRefs?.[0]?.digest, expectedParentCallDigest);
    assert.notEqual(fixture.rawArtifact.testEligibilityOnly, true);
    assert.equal(result.verdict, 'pass');
    assert.equal(result.productAcceptance, 'pass');
    assert.equal(result.explicitMemberActivationPass, true);
    assert.equal(report.summary.explicitMemberActivationPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal(report.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
    assert.equal(report.summary.acceptanceTiers['natural-skill-request'], 'not-run');
    assert.equal(report.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'not-run');
    assert.equal(report.summary.nativeSpawnPass, false);
    assert.equal(report.summary.spawnPass, false);
    assert.equal(fixture.evalReport.summary.explicitMemberActivationPass, true);
    assert.equal(fixture.evalReport.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
    assert.equal(fixture.evalReport.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal(fixture.evalReport.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
    assert.equal(fixture.evalReport.summary.acceptanceTiers['natural-skill-request'], 'not-run');
    assert.equal(fixture.evalReport.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'not-run');
    assert.equal(fixture.evalReport.summary.nativeSpawnPass, false);
    assert.equal(fixture.evalReport.summary.spawnPass, false);
    assertNoRetainedFixturePathLeak(fixture.rawArtifact);
    assertNoRetainedFixturePathLeak(fixture.transcript);
    assertNoRetainedFixturePathLeak(fixture.parentCallRecord);
    assertNoRetainedFixturePathLeak(fixture.parentSource);
    assertNoRetainedFixturePathLeak(fixture.parentInvocation);
    assertNoRetainedFixturePathLeak(fixture.evalReport);
  });
});
