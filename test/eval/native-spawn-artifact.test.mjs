import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanarySet } from '../../src/eval/canaries.mjs';
import { nativeSpawnCaseResultFromArtifact } from '../../src/eval/native-spawn-artifact.mjs';

const canaries = createCanarySet('native-seed');

function validArtifact(overrides = {}) {
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    sourceThreadId: 'parent-thread-1',
    checkpointAnchor: {
      turnId: 'turn-parent-1',
      createdAt: '2026-07-06T00:00:00.000Z',
    },
    spawnedAgentId: 'agent-native-1',
    forkMode: 'fork_context',
    reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
    observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
    evidenceRefs: [
      {
        kind: 'reviewer-answer',
        ref: 'native-spawn:agent-native-1:final',
        threadId: 'agent-native-1',
        excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
      },
      {
        kind: 'native-spawn-result',
        ref: 'native-spawn:agent-native-1:wait-agent',
        threadId: 'agent-native-1',
        contains: [canaries.survive],
        missing: Object.values(canaries).filter((value) => value !== canaries.survive),
      },
    ],
    ...overrides,
  };
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createLifecycleBundle(overrides = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-lifecycle-'));
  const memberTaskRequestPath = join(rootDir, 'member-task-request.json');
  const memberTaskRunPath = join(rootDir, 'member-task-run.json');
  const memberContextRenderPath = join(rootDir, 'member-context-render.json');
  const materialSelectionReportPath = join(rootDir, 'material-selection-report.json');

  const refs = {
    profile: join(rootDir, 'skill-designer.json'),
    roleHistory: join(rootDir, 'skill-designer-corrections.md'),
    target: join(rootDir, 'plan.md'),
    searchable: join(rootDir, 'searchable-memory.md'),
    sourceOnly: join(rootDir, 'source-only.md'),
  };

  const baselineDigest = 'sha256:baseline-001';
  const deltaDigest = 'sha256:delta-001';
  const baselineVersion = 'skill-designer-m0-v1';
  const baselineReuseStatus = 're-rendered';

  const request = {
    id: 'mtreq-skill-designer-reviewer-20260708123456',
    preparedAt: '2026-07-08T12:34:56.000Z',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    activationPoint: {
      turnId: 'static-config-turn',
      createdAt: '2026-07-08T12:34:56.000Z',
      checkpointId: 'cp-design',
    },
    task: {
      kind: 'reviewer',
      question: 'Which lifecycle artifacts and identifiers are visible?',
      targetRefs: [refs.target],
    },
    profileRef: refs.profile,
    roleHistoryRefs: [refs.roleHistory],
    targetRefs: [refs.target],
    requestedMaterials: [refs.profile],
    expectedResultReturn: 'parent-agent',
    preparedChildInput: {
      kind: 'prompt-text',
      text: 'Prepared child input',
    },
    preparedChildInputDigest: 'sha256:prepared-001',
    materialSnapshots: [],
    materialSelectionReportRef: materialSelectionReportPath,
    memberContextRenderRef: memberContextRenderPath,
    baselineDigest,
    deltaDigest,
    baselineReuseStatus,
    lifecycleTrace: [
      { event: 'prepared', at: '2026-07-08T12:34:56.000Z' },
    ],
    requestPromptText: 'prompt',
    requestPromptDigest: 'sha256:prompt-001',
    ...(overrides.request ?? {}),
  };

  const selectionReport = {
    reportId: 'sha256:selection-001',
    memberName: 'skill-designer',
    activationPoint: request.activationPoint,
    taskKind: 'reviewer',
    inputRefs: [refs.profile, refs.target, refs.roleHistory],
    explicitRequestedRefs: [refs.profile],
    candidates: [
      {
        ref: refs.profile,
        kind: 'profile',
        source: 'registry',
        lifecycleStatus: 'member-profile',
        explicit: false,
        rank: 10,
        rankGroup: 'baseline-profile',
        reasons: ['resolved member profile'],
        selected: true,
        placement: 'm0',
      },
      {
        ref: refs.roleHistory,
        kind: 'role-memory',
        source: 'role-history',
        lifecycleStatus: 'active',
        explicit: false,
        rank: 11,
        rankGroup: 'baseline-role-memory',
        reasons: ['active role memory baseline'],
        selected: true,
        placement: 'm0',
      },
      {
        ref: refs.target,
        kind: 'target',
        source: 'task-target',
        lifecycleStatus: 'target-material',
        explicit: true,
        rank: 12,
        rankGroup: 'activation-target',
        reasons: ['task target ref'],
        selected: true,
        placement: 'm1',
      },
    ],
    baselineRefs: [refs.profile, refs.roleHistory],
    invocationRequestedRefs: [refs.target],
    finalM0Refs: [refs.profile, refs.roleHistory],
    finalM1Refs: [refs.profile, refs.target],
    mountedRefs: [],
    searchableRefs: [refs.searchable],
    sourceOnlyRefs: [refs.sourceOnly],
    trimmingDecisions: [],
    knownLosses: [
      'Selection and placement are accounting only; they are not visibility proof or consumption proof.',
    ],
    ...(overrides.selectionReport ?? {}),
  };

  const render = {
    renderId: 'sha256:render-001',
    memberName: 'skill-designer',
    profileRef: refs.profile,
    activationPoint: request.activationPoint,
    renderSchemaVersion: '1',
    baselineVersion,
    baselineDigest,
    baselineCacheKey: { renderSchemaVersion: '1', runtime: 'unknown' },
    baselineReuseStatus,
    baselineReuseEvidenceRefs: [],
    baselineMaterials: [
      { ref: refs.roleHistory, contentDigest: 'sha256:role-001' },
      { ref: refs.profile, contentDigest: 'sha256:profile-001' },
    ],
    deltaDigest,
    deltaMaterials: [
      { ref: 'task:question', contentDigest: 'sha256:question-001' },
      { ref: refs.profile, contentDigest: 'sha256:profile-001' },
      { ref: refs.target, contentDigest: 'sha256:target-001' },
    ],
    m0Refs: [refs.profile, refs.roleHistory],
    m1Refs: [refs.profile, refs.target],
    selectionReportRef: materialSelectionReportPath,
    knownLosses: [
      'Selection and placement are accounting only; they are not visibility proof or consumption proof.',
    ],
    ...(overrides.render ?? {}),
  };

  const run = {
    id: 'mtr-skill-designer-reviewer-20260708123456',
    memberName: 'skill-designer',
    requesterRef: 'node-parent',
    activationPoint: {
      turnId: '019f4212-0493-7543-afbe-2eb1aa29b046',
      createdAt: '2026-07-08T12:34:56.000Z',
      checkpointId: 'cp-design',
    },
    task: request.task,
    memberTaskRequestRef: memberTaskRequestPath,
    contextSources: [
      { kind: 'member-profile', memberName: 'skill-designer', profileRef: refs.profile },
      { kind: 'role-history', memberName: 'skill-designer', historyRef: refs.roleHistory },
      { kind: 'target-material', targetRef: refs.target },
    ],
    materials: {
      items: [
        {
          materialRef: refs.profile,
          sourceRef: refs.profile,
          selectionMode: 'prepared-prompt',
          visibility: 'intended-model-input',
          evidenceRefs: [{ kind: 'prompt-audit', ref: memberTaskRequestPath }],
          contentDigest: 'sha256:profile-001',
        },
        {
          materialRef: refs.roleHistory,
          sourceRef: refs.roleHistory,
          selectionMode: 'prepared-prompt',
          visibility: 'intended-model-input',
          evidenceRefs: [{ kind: 'prompt-audit', ref: memberTaskRequestPath }],
          contentDigest: 'sha256:role-001',
        },
        {
          materialRef: refs.target,
          sourceRef: refs.target,
          selectionMode: 'prepared-prompt',
          visibility: 'intended-model-input',
          evidenceRefs: [{ kind: 'prompt-audit', ref: memberTaskRequestPath }],
          contentDigest: 'sha256:target-001',
        },
      ],
      intendedInputEvidenceRefs: [{ kind: 'prompt-audit', ref: memberTaskRequestPath }],
      runtimeInputEvidenceRefs: [],
      providerModelInputEvidenceRefs: [],
      mountedEvidenceRefs: [],
      searchableEvidenceRefs: [],
      sourceOnlyRefs: [],
    },
    inputDigests: {
      preparedChildInputDigest: request.preparedChildInputDigest,
    },
    lifecycleTrace: [
      { event: 'prepared', at: '2026-07-08T12:34:56.000Z' },
      { event: 'recorded', at: '2026-07-08T14:11:45.535Z' },
    ],
    materialSelectionMode: 'native-fork',
    fidelity: 'native-context-fork',
    evidenceRefs: [
      { kind: 'reviewer-answer', ref: 'native-spawn:agent-native-1:final' },
      { kind: 'native-spawn-result', ref: 'native-spawn:agent-native-1:wait-agent' },
      { kind: 'turn-read', ref: 'thread/read:agent-native-1', source: 'thread/read' },
    ],
    knownLosses: ['no model KV/cache', 'no provider prompt cache'],
    outcome: {
      status: 'pass',
      summary: 'Native spawn member task run recorded.',
    },
    memberContextRenderRef: memberContextRenderPath,
    materialSelectionReportRef: materialSelectionReportPath,
    baselineVersion,
    baselineDigest,
    baselineReuseStatus,
    baselineReuseEvidenceRefs: [],
    deltaDigest,
    result: {
      resultRef: join(rootDir, 'spawn-result.json'),
      returnedTo: 'parent-agent',
      summary: 'ok',
    },
    resolvedMemberId: 'mem-sd-001',
    runtime: {
      runtimeAgentId: 'agent-native-1',
      runtimeAgentType: 'codex-native-spawn',
    },
    compatibilityRefs: {
      checkpointManifestRef: join(rootDir, 'checkpoint-manifest.json'),
      spawnRunManifestRef: join(rootDir, 'spawn-manifest.json'),
      spawnResultManifestRef: join(rootDir, 'spawn-result.json'),
    },
    ...(overrides.run ?? {}),
  };

  writeJson(memberTaskRequestPath, request);
  writeJson(materialSelectionReportPath, selectionReport);
  writeJson(memberContextRenderPath, render);
  writeJson(memberTaskRunPath, run);

  return {
    rootDir,
    paths: {
      memberTaskRequestPath,
      memberTaskRunPath,
      memberContextRenderPath,
      materialSelectionReportPath,
    },
    refs,
  };
}

function createAuthorizedMemberActivationBundle(overrides = {}) {
  const authorizedCanaries = createCanarySet('authorized-member-live');
  const bundle = createLifecycleBundle({
    request: { expectedResultReturn: 'parent-agent' },
    run: {
      memberName: 'skill-designer',
      result: {
        resultRef: './spawn-result.json',
        returnedTo: 'parent-agent',
        summary: 'authorized member result',
      },
    },
    ...overrides,
  });

  const artifact = validArtifact({
    caseId: 'authorized-natural-member-activation',
    acceptanceMode: 'authorized-natural-native-spawn',
    acceptanceTier: { id: 'authorized-natural-native-spawn' },
    providerForcedLiveProof: false,
    deterministicProviderProof: false,
    observedAnswer: JSON.stringify({ answer: 'known', values: [authorizedCanaries.survive] }),
    evidenceRefs: [
      {
        kind: 'reviewer-answer',
        ref: 'native-spawn:agent-native-1:final',
        threadId: 'agent-native-1',
        excerpt: JSON.stringify({ answer: 'known', values: [authorizedCanaries.survive] }),
      },
      {
        kind: 'native-spawn-result',
        ref: 'native-spawn:agent-native-1:wait-agent',
        threadId: 'agent-native-1',
        contains: [authorizedCanaries.survive],
        missing: Object.values(authorizedCanaries).filter((value) => value !== authorizedCanaries.survive),
      },
    ],
    artifactRefs: {
      memberTaskRequestPath: bundle.paths.memberTaskRequestPath,
      memberTaskRunPath: bundle.paths.memberTaskRunPath,
    },
    ...overrides.artifact,
  });

  return {
    ...bundle,
    artifact,
  };
}

function loadAuthorizedMemberActivationFixture(overrides = {}) {
  const fixtureDir = new URL('../../evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/', import.meta.url);
  const artifactPath = new URL('acceptance-proof.json', fixtureDir);
  const artifact = {
    ...JSON.parse(readFileSync(artifactPath, 'utf8')),
    ...overrides.artifact,
    __artifactSourcePath: artifactPath.pathname,
  };

  if (overrides.run || overrides.request || overrides.render || overrides.selection) {
    const rootDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-member-activation-fixture-'));
    cpSync(fixtureDir, rootDir, { recursive: true });
    const fixtureRoot = existsSync(join(rootDir, 'acceptance-proof.json'))
      ? rootDir
      : join(rootDir, 'authorized-natural-member-activation-positive');
    const requestPath = join(fixtureRoot, 'member-task-request.json');
    const runPath = join(fixtureRoot, 'member-task-run.json');
    const renderPath = join(fixtureRoot, 'member-context-render.json');
    const selectionPath = join(fixtureRoot, 'material-selection-report.json');

    if (overrides.request) writeJson(requestPath, { ...JSON.parse(readFileSync(requestPath, 'utf8')), ...overrides.request });
    if (overrides.run) writeJson(runPath, { ...JSON.parse(readFileSync(runPath, 'utf8')), ...overrides.run });
    if (overrides.render) writeJson(renderPath, { ...JSON.parse(readFileSync(renderPath, 'utf8')), ...overrides.render });
    if (overrides.selection) writeJson(selectionPath, { ...JSON.parse(readFileSync(selectionPath, 'utf8')), ...overrides.selection });

    return {
      artifact: {
        ...artifact,
        __artifactSourcePath: join(fixtureRoot, 'acceptance-proof.json'),
      },
      rootDir,
    };
  }

  return { artifact, rootDir: null };
}

describe('nativeSpawnCaseResultFromArtifact', () => {
  it('converts a valid native spawn artifact into a passing case result', async () => {
    const result = await nativeSpawnCaseResultFromArtifact(validArtifact(), { canaries, mode: 'live' });

    assert.equal(result.caseId, 'current-boundary-spawn-canary');
    assert.equal(result.method, 'codex-spawn-agent-full-history');
    assert.equal(result.verdict, 'pass');
    assert.equal(result.failureReason, null);
    assert.equal(result.forkedThreadId, 'agent-native-1');
    assert.equal(result.manifest.recoveryMethod, 'codex-spawn-agent-full-history');
    assert.equal(result.manifest.codexApi, 'multiagent-v1-fork_context');
    assert.deepEqual(result.expectedCanaries, [canaries.survive]);
  });

  it('fails when the artifact reviewer answer leaks a forbidden canary', async () => {
    const result = await nativeSpawnCaseResultFromArtifact(validArtifact({
      observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive, canaries.rollback] }),
      evidenceRefs: [
        {
          kind: 'reviewer-answer',
          ref: 'native-spawn:agent-native-1:final',
          threadId: 'agent-native-1',
          excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive, canaries.rollback] }),
        },
        {
          kind: 'native-spawn-result',
          ref: 'native-spawn:agent-native-1:wait-agent',
          threadId: 'agent-native-1',
          contains: [canaries.survive, canaries.rollback],
          missing: Object.values(canaries).filter((value) => value !== canaries.survive && value !== canaries.rollback),
        },
      ],
    }), { canaries, mode: 'live' });

    assert.equal(result.verdict, 'fail');
    assert.match(result.failureReason, /negative control leaked canary/);
  });

  it('downgrades to inconclusive when supporting evidence is absent', async () => {
    const result = await nativeSpawnCaseResultFromArtifact(validArtifact({
      evidenceRefs: [
        {
          kind: 'reviewer-answer',
          ref: 'native-spawn:agent-native-1:final',
          threadId: 'agent-native-1',
          excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
        },
      ],
    }), { canaries, mode: 'live' });

    assert.equal(result.verdict, 'inconclusive');
    assert.match(result.failureReason, /no .*evidence/);
  });

  it('rejects an artifact whose prompt contains an expected canary', async () => {
    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({
        reviewerPrompt: `bad prompt ${canaries.survive}`,
      }), { canaries, mode: 'live' }),
      /prompt leak detected/,
    );
  });

  it('rejects a native spawn artifact without checkpointAnchor', async () => {
    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({ checkpointAnchor: undefined }), { canaries, mode: 'mock' }),
      { message: /checkpointAnchor/i },
    );
  });

  it('rejects placeholder checkpoint anchors', async () => {
    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({
        checkpointAnchor: {
          turnId: 'turn-parent-1',
          createdAt: '1970-01-01T00:00:00.000Z',
        },
      }), { canaries, mode: 'mock' }),
      { message: /placeholder/i },
    );

    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({
        checkpointAnchor: {
          turnIndex: 0,
          createdAt: '2026-07-06T00:00:00.000Z',
        },
      }), { canaries, mode: 'mock' }),
      { message: /turnId|messageId|checkpointId/i },
    );
  });

  it('rejects positive turnIndex-only checkpoint anchors', async () => {
    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({
        checkpointAnchor: {
          turnIndex: 42,
          createdAt: '2026-07-06T00:00:00.000Z',
        },
      }), { canaries, mode: 'mock' }),
      { message: /turnId|messageId|checkpointId/i },
    );
  });

  it('parses the retained example fixture', async () => {
    const fixture = JSON.parse(readFileSync(
      new URL('../../evals/fixtures/codex-native-spawn/current-boundary-pass.example.json', import.meta.url),
      'utf8',
    ));
    const fixtureCanaries = createCanarySet('example');
    const result = await nativeSpawnCaseResultFromArtifact(fixture, { canaries: fixtureCanaries, mode: 'live' });

    assert.equal(result.verdict, 'pass');
    assert.equal(result.forkedThreadId, 'example-native-agent');
  });

  it('preserves checkpoint anchor and searchable-history material fields', async () => {
    const artifact = validArtifact({
      checkpointAnchor: {
        turnId: 'turn-source-1',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      searchableHistoryRef: 'history:source-1',
      evidenceRefs: [
        { kind: 'history-search', ref: 'history-query:1', excerpt: canaries.survive },
        ...validArtifact().evidenceRefs,
      ],
    });

    const result = await nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode: 'mock' });

    assert.equal(result.checkpointAnchor.turnId, 'turn-source-1');
    assert.equal(result.materialSelectionMode, 'searchable-history');
    assert.equal(result.fidelity, 'session-record-mounted');
    assert.equal(result.searchableHistoryRef, 'history:source-1');
  });

  it('defaults missing material fields to native fork semantics', async () => {
    const result = await nativeSpawnCaseResultFromArtifact(validArtifact(), { canaries, mode: 'mock' });

    assert.equal(result.materialSelectionMode, 'native-fork');
    assert.equal(result.fidelity, 'native-context-fork');
    assert.equal(result.searchableHistoryRef, undefined);
  });

  it('mock-mode artifact ingestion keeps artifact provenance instead of relabeling refs as mock', async () => {
    const result = await nativeSpawnCaseResultFromArtifact(validArtifact({
      acceptanceMode: 'provider-forced-live',
      evidenceRefs: [
        {
          kind: 'reviewer-answer',
          ref: 'native-spawn:agent-native-1:final',
          threadId: 'agent-native-1',
          excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
        },
        {
          kind: 'native-spawn-result',
          ref: 'native-spawn:agent-native-1:wait-agent',
          threadId: 'agent-native-1',
          contains: [canaries.survive],
          missing: Object.values(canaries).filter((value) => value !== canaries.survive),
        },
        {
          kind: 'turn-read',
          ref: 'thread/read:agent-native-1',
          threadId: 'agent-native-1',
          source: 'thread/read',
        },
      ],
    }), { canaries, mode: 'mock' });

    assert.equal(result.evidenceRefs[0].source, 'provider-forced-live');
    assert.equal(result.evidenceRefs[1].source, 'provider-forced-live');
    assert.equal(result.evidenceRefs[2].source, 'provider-forced-live');
    assert.equal(result.evidenceRefs[3].source, 'thread/read');
  });

  it('preserves optional acceptance tier metadata from native spawn artifacts', async () => {
    const artifact = validArtifact({
      acceptanceMode: 'natural-scenario-provider-driven-native-spawn',
      acceptanceTier: {
        id: 'natural-provider-driven-native-spawn',
        mechanism: 'provider-driven',
        scope: 'single-parent-turn',
        runtimeNativeSpawn: true,
        autonomousTrigger: false,
        defaultRegression: true,
        productRole: 'mechanism-proof',
      },
    });
    const result = await nativeSpawnCaseResultFromArtifact(artifact, {
      canaries: createCanarySet('native-spawn-artifact-seed'),
      mode: 'mock',
    });

    assert.deepEqual(result.acceptanceTier, artifact.acceptanceTier);
  });

  it('preserves reviewer runtime diagnosis metadata from native spawn artifacts', async () => {
    const artifact = validArtifact({
      reviewerRuntimeDiagnosis: {
        status: 'degraded',
        code: 'missing-child-repo-access',
        source: 'child-answer',
        message: 'Delegated reviewer quality is degraded because the child runtime could not inspect the expected repo or skill files.',
        recommendedAction: 'Verify repo access before trusting reviewer findings.',
      },
    });
    const result = await nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode: 'mock' });

    assert.deepEqual(result.reviewerRuntimeDiagnosis, artifact.reviewerRuntimeDiagnosis);
  });

  it('rejects searchable-history artifact without searchableHistoryRef', async () => {
    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({
        materialSelectionMode: 'searchable-history',
        evidenceRefs: [
          { kind: 'history-search', ref: 'history-query:1', excerpt: canaries.survive },
          ...validArtifact().evidenceRefs,
        ],
      }), { canaries, mode: 'mock' }),
      { message: /searchableHistoryRef/i },
    );
  });

  it('rejects searchable-history artifact without history-search evidence', async () => {
    await assert.rejects(
      nativeSpawnCaseResultFromArtifact(validArtifact({
        materialSelectionMode: 'searchable-history',
        searchableHistoryRef: 'history:source-1',
      }), { canaries, mode: 'mock' }),
      { message: /history-search evidence/i },
    );
  });

  it('passes when the artifact points to an aligned lifecycle bundle', async () => {
    const bundle = createLifecycleBundle();
    try {
      const result = await nativeSpawnCaseResultFromArtifact(validArtifact({
        artifactRefs: {
          memberTaskRequestPath: bundle.paths.memberTaskRequestPath,
          memberTaskRunPath: bundle.paths.memberTaskRunPath,
        },
      }), { canaries, mode: 'live' });

      assert.equal(result.verdict, 'pass');
      assert.equal(result.failureReason, null);
      assert.deepEqual(result.lifecycleVerdict?.issues, []);
      assert.equal(result.lifecycleVerdict?.status, 'pass');
      assert.equal(result.lifecycleVerdict?.checked, true);
    } finally {
      rmSync(bundle.rootDir, { recursive: true, force: true });
    }
  });

  it('parses the checked-in live-derived lifecycle fixture bundle', async () => {
    const fixtureUrl = new URL('../../evals/fixtures/codex-native-spawn/member-lifecycle-positive/acceptance-proof.json', import.meta.url);
    const fixture = {
      ...JSON.parse(readFileSync(
      fixtureUrl,
      'utf8',
      )),
      __artifactSourcePath: fixtureUrl.pathname,
    };

    const result = await nativeSpawnCaseResultFromArtifact(fixture, {
      canaries: createCanarySet('live-member-path'),
      mode: 'mock',
    });

    assert.equal(result.verdict, 'pass');
    assert.equal(result.forkedThreadId, '019f4212-055b-79b1-8a6c-7c24a9f928bb');
    assert.equal(result.lifecycleVerdict?.status, 'pass');
  });

  it('checked-in live-derived fixture keeps refs, digests, and placement invariants aligned', () => {
    const fixtureDir = new URL('../../evals/fixtures/codex-native-spawn/member-lifecycle-positive/', import.meta.url);
    const run = JSON.parse(readFileSync(new URL('member-task-run.json', fixtureDir), 'utf8'));
    const render = JSON.parse(readFileSync(new URL('member-context-render.json', fixtureDir), 'utf8'));
    const selection = JSON.parse(readFileSync(new URL('material-selection-report.json', fixtureDir), 'utf8'));

    assert.equal(run.memberContextRenderRef, './member-context-render.json');
    assert.equal(run.materialSelectionReportRef, './material-selection-report.json');
    assert.equal(render.selectionReportRef, './material-selection-report.json');
    assert.equal(run.baselineVersion, render.baselineVersion);
    assert.equal(run.baselineDigest, render.baselineDigest);
    assert.equal(run.deltaDigest, render.deltaDigest);
    assert.deepEqual(selection.finalM0Refs, render.m0Refs);
    assert.deepEqual(selection.finalM1Refs, render.m1Refs);
  });

  it('fails when the checked-in live-derived fixture claims provider cache reuse without evidence', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-live-fixture-cache-'));
    const fixtureDir = join(rootDir, 'member-lifecycle-positive');
    cpSync(new URL('../../evals/fixtures/codex-native-spawn/member-lifecycle-positive/', import.meta.url), fixtureDir, { recursive: true });

    try {
      const runPath = join(fixtureDir, 'member-task-run.json');
      const renderPath = join(fixtureDir, 'member-context-render.json');
      const run = JSON.parse(readFileSync(runPath, 'utf8'));
      const render = JSON.parse(readFileSync(renderPath, 'utf8'));
      run.baselineReuseStatus = 'provider-cache-hit';
      run.baselineReuseEvidenceRefs = [];
      render.baselineReuseStatus = 'provider-cache-hit';
      render.baselineReuseEvidenceRefs = [];
      writeJson(runPath, run);
      writeJson(renderPath, render);

      const artifactPath = join(fixtureDir, 'acceptance-proof.json');
      const fixture = {
        ...JSON.parse(readFileSync(artifactPath, 'utf8')),
        __artifactSourcePath: artifactPath,
      };

      const result = await nativeSpawnCaseResultFromArtifact(fixture, {
        canaries: createCanarySet('live-member-path'),
        mode: 'mock',
      });

      assert.equal(result.verdict, 'fail');
      assert.equal(result.lifecycleVerdict?.status, 'fail');
      assert.match(result.failureReason, /provider-cache-hit|provider-cache|model-request/i);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when lifecycle digests drift between member-task-run and member-context-render artifacts', async () => {
    const bundle = createLifecycleBundle({
      render: { deltaDigest: 'sha256:delta-drift-999' },
    });
    try {
      const result = await nativeSpawnCaseResultFromArtifact(validArtifact({
        artifactRefs: {
          memberTaskRequestPath: bundle.paths.memberTaskRequestPath,
          memberTaskRunPath: bundle.paths.memberTaskRunPath,
        },
      }), { canaries, mode: 'live' });

      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /deltaDigest|memberContextRender/i);
      assert.equal(result.lifecycleVerdict?.status, 'fail');
      assert.match(result.lifecycleVerdict?.issues?.join(' '), /deltaDigest|memberContextRender/i);
    } finally {
      rmSync(bundle.rootDir, { recursive: true, force: true });
    }
  });

  it('fails when searchable or source-only refs are overclaimed as intended model input', async () => {
    const bundle = createLifecycleBundle();
    try {
      const run = JSON.parse(readFileSync(bundle.paths.memberTaskRunPath, 'utf8'));
      run.materials.items = [
        {
          materialRef: bundle.refs.searchable,
          sourceRef: bundle.refs.searchable,
          selectionMode: 'prepared-prompt',
          visibility: 'intended-model-input',
          evidenceRefs: [{ kind: 'prompt-audit', ref: bundle.paths.memberTaskRequestPath }],
          contentDigest: 'sha256:searchable-001',
        },
      ];
      run.materials.intendedInputEvidenceRefs = [{ kind: 'prompt-audit', ref: bundle.paths.memberTaskRequestPath }];
      writeJson(bundle.paths.memberTaskRunPath, run);

      const result = await nativeSpawnCaseResultFromArtifact(validArtifact({
        artifactRefs: {
          memberTaskRequestPath: bundle.paths.memberTaskRequestPath,
          memberTaskRunPath: bundle.paths.memberTaskRunPath,
        },
      }), { canaries, mode: 'live' });

      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /searchable|source-only|model-visible|intended-model-input/i);
      assert.equal(result.lifecycleVerdict?.status, 'fail');
    } finally {
      rmSync(bundle.rootDir, { recursive: true, force: true });
    }
  });

  describe('authorized-natural-member-activation', () => {
    it('passes authorized-natural-member-activation only when the artifact proves the member lifecycle path', async () => {
      const bundle = createAuthorizedMemberActivationBundle();
      try {
        const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
          canaries: createCanarySet('authorized-member-live'),
          mode: 'mock',
        });

        assert.equal(result.caseId, 'authorized-natural-member-activation');
        assert.equal(result.acceptanceTier?.id, 'authorized-natural-native-spawn');
        assert.equal(result.verdict, 'pass');
        assert.equal(result.lifecycleVerdict?.status, 'pass');
        assert.equal(result.lifecycleVerdict?.checked, true);
        assert.deepEqual(result.lifecycleVerdict?.issues, []);
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });

    it('passes authorized-natural-member-activation for any aligned explicit member lifecycle', async () => {
      const bundle = createAuthorizedMemberActivationBundle({
        request: { memberName: 'review-bot', resolvedMemberId: 'mem-review-001' },
        run: { memberName: 'review-bot', resolvedMemberId: 'mem-review-001' },
        render: { memberName: 'review-bot' },
        selectionReport: { memberName: 'review-bot' },
      });
      try {
        const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
          canaries: createCanarySet('authorized-member-live'),
          mode: 'mock',
        });

        assert.equal(result.caseId, 'authorized-natural-member-activation');
        assert.equal(result.verdict, 'pass');
        assert.equal(result.lifecycleVerdict?.status, 'pass');
        assert.deepEqual(result.lifecycleVerdict?.issues, []);
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });

    it('fails authorized-natural-member-activation when the artifact is provider-forced or retained-only', async () => {
      const bundle = createAuthorizedMemberActivationBundle({
        artifact: {
          providerForcedLiveProof: true,
          deterministicProviderProof: true,
        },
      });
      try {
        const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
          canaries: createCanarySet('authorized-member-live'),
          mode: 'mock',
        });

        assert.equal(result.verdict, 'fail');
        assert.match(result.failureReason, /provider-forced|retained|authorized-natural-member-activation/i);
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });

    it('fails authorized-natural-member-activation when returnedTo is not parent-agent', async () => {
      const bundle = createAuthorizedMemberActivationBundle({
        run: {
          result: {
            resultRef: './spawn-result.json',
            returnedTo: 'child-agent',
            summary: 'wrong target',
          },
        },
      });
      try {
        const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
          canaries: createCanarySet('authorized-member-live'),
          mode: 'mock',
        });

        assert.equal(result.verdict, 'fail');
        assert.match(result.failureReason, /returnedTo|parent-agent/i);
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });

    it('fails authorized-natural-member-activation when lifecycle refs are missing', async () => {
      const bundle = createAuthorizedMemberActivationBundle({
        artifact: {
          artifactRefs: undefined,
        },
      });
      try {
        const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
          canaries: createCanarySet('authorized-member-live'),
          mode: 'mock',
        });

        assert.equal(result.verdict, 'fail');
        assert.equal(result.lifecycleVerdict?.status, 'fail');
        assert.match(result.failureReason, /member lifecycle path|memberTaskRunPath|authorized-natural-member-activation/i);
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });

    it('parses the checked-in authorized-natural-member-activation fixture bundle', async () => {
      const fixture = loadAuthorizedMemberActivationFixture();
      try {
        const result = await nativeSpawnCaseResultFromArtifact(fixture.artifact, {
          canaries: createCanarySet('live-member-path'),
          mode: 'mock',
        });

        assert.equal(result.caseId, 'authorized-natural-member-activation');
        assert.equal(result.acceptanceTier?.id, 'authorized-natural-native-spawn');
        assert.equal(result.lifecycleVerdict?.status, 'pass');
      } finally {
        if (fixture.rootDir) rmSync(fixture.rootDir, { recursive: true, force: true });
      }
    });

    it('fails when the authorized fixture is relabeled post hoc to a different member', async () => {
      const fixture = loadAuthorizedMemberActivationFixture({
        run: { memberName: 'different-member' },
      });
      try {
        const result = await nativeSpawnCaseResultFromArtifact(fixture.artifact, {
          canaries: createCanarySet('live-member-path'),
          mode: 'mock',
        });

        assert.equal(result.verdict, 'fail');
        assert.match(result.failureReason, /memberTaskRun\.memberName|memberTaskRequest\.memberName|post-hoc|memberName/i);
      } finally {
        if (fixture.rootDir) rmSync(fixture.rootDir, { recursive: true, force: true });
      }
    });

    it('checked-in authorized fixture keeps portable refs and acceptance invariants aligned', () => {
      const fixtureDir = new URL('../../evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/', import.meta.url);
      const acceptance = JSON.parse(readFileSync(new URL('acceptance-proof.json', fixtureDir), 'utf8'));
      const request = JSON.parse(readFileSync(new URL('member-task-request.json', fixtureDir), 'utf8'));
      const run = JSON.parse(readFileSync(new URL('member-task-run.json', fixtureDir), 'utf8'));
      const render = JSON.parse(readFileSync(new URL('member-context-render.json', fixtureDir), 'utf8'));
      const selection = JSON.parse(readFileSync(new URL('material-selection-report.json', fixtureDir), 'utf8'));

      assert.equal(acceptance.acceptanceTier?.id, 'authorized-natural-native-spawn');
      assert.equal(acceptance.providerForcedLiveProof, false);
      assert.equal(acceptance.deterministicProviderProof, false);
      assert.equal(acceptance.artifactRefs?.memberTaskRequestPath, './member-task-request.json');
      assert.equal(acceptance.artifactRefs?.memberTaskRunPath, './member-task-run.json');
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.equal(run.memberContextRenderRef, './member-context-render.json');
      assert.equal(run.materialSelectionReportRef, './material-selection-report.json');
      assert.equal(render.selectionReportRef, './material-selection-report.json');
      assert.equal(request.profileRef, 'fixtures/member-task-runs/skill-designer.json');
      assert.doesNotMatch(acceptance.reviewerPrompt, /\/home\/prosumer\/agent\/context-tree/);
      assert.doesNotMatch(request.preparedChildInput.text, /\/home\/prosumer\/agent\/context-tree/);
      assert.doesNotMatch(request.requestPromptText, /\/home\/prosumer\/agent\/context-tree/);
      assert.equal(run.baselineDigest, render.baselineDigest);
      assert.equal(run.deltaDigest, render.deltaDigest);
      assert.deepEqual(selection.finalM0Refs, render.m0Refs);
      assert.deepEqual(selection.finalM1Refs, render.m1Refs);
    });
  });

  describe('explicit-route non-overclaim guards', () => {
    it('rejects explicit fixture artifacts before they can produce native spawn method fields', async () => {
      await assert.rejects(
        nativeSpawnCaseResultFromArtifact(validArtifact({
          artifactKind: 'explicit-member-activation-capability-artifact',
          caseId: 'authorized-explicit-member-activation',
          acceptanceMode: 'authorized-explicit-member-activation',
          acceptanceTier: { id: 'authorized-explicit-member-activation' },
          executorProof: { authority: 'fixture', fixture: true },
        }), { canaries: createCanarySet('explicit-member-live'), mode: 'mock' }),
        /unknown native spawn artifactKind|explicit-member/i,
      );
    });

    it('does not allow explicit sidecar evidence to satisfy authorized-natural-native-spawn by sharing canaries', async () => {
      const bundle = createAuthorizedMemberActivationBundle({
        artifact: {
          caseId: 'authorized-explicit-member-activation',
          acceptanceMode: 'authorized-explicit-member-activation',
          acceptanceTier: { id: 'authorized-natural-native-spawn' },
          evidenceRefs: [
            {
              kind: 'reviewer-answer',
              ref: 'explicit-member-executor-output.json',
              excerpt: JSON.stringify({ answer: 'known', values: [createCanarySet('authorized-member-live').survive] }),
            },
          ],
        },
      });
      try {
        await assert.rejects(
          nativeSpawnCaseResultFromArtifact(bundle.artifact, {
            canaries: createCanarySet('authorized-member-live'),
            mode: 'mock',
          }),
          /unsupported caseId|authorized-explicit-member-activation/i,
        );
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });

    it('provider-forced explicit-looking native artifacts cannot set a native-spawn Codex API', async () => {
      const bundle = createAuthorizedMemberActivationBundle({
        artifact: {
          providerForcedLiveProof: true,
          deterministicProviderProof: true,
          evidenceRefs: [
            {
              kind: 'reviewer-answer',
              ref: 'explicit-sidecar:answer',
              excerpt: JSON.stringify({ answer: 'known', values: [createCanarySet('authorized-member-live').survive] }),
            },
          ],
        },
      });
      try {
        const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
          canaries: createCanarySet('authorized-member-live'),
          mode: 'mock',
        });

        assert.equal(result.verdict, 'fail');
        assert.match(result.failureReason, /provider-forced|retained|authorized-natural-member-activation/i);
      } finally {
        rmSync(bundle.rootDir, { recursive: true, force: true });
      }
    });
  });
});
