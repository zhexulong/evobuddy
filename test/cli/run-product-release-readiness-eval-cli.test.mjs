import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { sha256File, sha256Text } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const RELEASE_EVAL_CLI = join(REPO_ROOT, 'scripts/context-tree/run-product-release-readiness-eval.mjs');
const THREE_RUNTIME_RELEASE_EVAL_CLI = join(REPO_ROOT, 'scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs');
const EVOBUDDY = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');
const WORKBENCH_FIXTURE_ROOT = join(REPO_ROOT, 'fixtures/member-surface/final-acceptance');

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

const RELEASE_MEMBER = 'sisyphus-junior';

function runtimeAgentName(memberName, runtime) {
  return runtime === 'codex' ? memberName.replaceAll('-', '_') : memberName;
}

function proof(runtime = 'opencode', overrides = {}) {
  const memberName = overrides.memberName ?? RELEASE_MEMBER;
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime,
    memberName,
    runtimeAgentName: runtimeAgentName(memberName, runtime),
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: runtime === 'claude' ? 'claude-subagent' : runtime === 'codex' ? 'codex-native-subagent' : 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: digest('a'),
    baselineDefinitionRef: `./${runtime}-${memberName}-definition`,
    baselineDefinitionDigest: digest('b'),
    parentSessionRef: `${runtime}:parent-session`,
    childSessionRef: `${runtime}:child-session`,
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent-1', childId: 'child-1' },
    invocationPromptRef: `${runtime}:child-prompt`,
    invocationPromptDigest: digest('c'),
    resultReturn: { returnedTo: 'parent-agent', resultRef: `${runtime}:result-return`, resultDigest: digest('d') },
    exporterManifestRef: `./${runtime}-exporter-manifest.json`,
    exporterManifestDigest: digest('e'),
    sourceTranscriptRef: `./${runtime}-source-transcript.jsonl`,
    sourceTranscriptDigest: digest('f'),
    negativeControls: {
      adapterOnly: false,
      projectionOnly: false,
      retainedOnly: false,
      summaryOnly: false,
      answerCanaryOnly: false,
      selfClaimOnly: false,
      mechanismNamedPrompt: false,
    },
    knownLosses: [],
    runtimeEvidence: { runtimeSpecific: { runtime } },
    parentPromptText: 'Please review this skill plan naturally.',
    ...overrides,
  };
}

function writeProofRoot(root, runtime, proofBody, folder) {
  const runtimeRoot = join(root, runtime, folder);
  mkdirSync(runtimeRoot, { recursive: true });
  writeJson(join(runtimeRoot, 'runtime-native-buddy-surface-proof.json'), proofBody);
  return runtimeRoot;
}

async function createValidBenchmarkObservedProofRoot(root, { prefix = '', digestSeed = '1', projectIdentity = `proj-${prefix || 'native'}` } = {}) {
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, `${prefix}product-root`), { recursive: true });
  const dbPath = join(root, `${prefix}opencode.db`);
  writeFileSync(dbPath, `sqlite bytes ${digestSeed}\n`, 'utf8');
  const dbDigest = await sha256File(dbPath);
  const invocationDigest = sha256Text(`invoke payload ${digestSeed}`);
  const parentCallRecord = {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'evobuddy-natural-buddy-invocation',
    sourceThreadId: `thread-${digestSeed}`,
    parentTurnId: `turn-${digestSeed}`,
    invocationId: `invoke-${digestSeed}`,
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'buddy.skill-designer',
    expectedInputDigest: invocationDigest,
    observedAt: '2026-07-14T00:00:00.000Z',
    rawCall: {
      sessionExportRef: `./${prefix}opencode.db`,
      observedProjectIdentity: projectIdentity,
    },
  };
  const transcript = {
    kind: 'observed-parent-agent-call-transcript',
    calls: [parentCallRecord],
  };
  const exporterManifest = {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity,
    source: {
      kind: 'opencode-sqlite',
      dbPath: `./${prefix}opencode.db`,
      dbDigest,
    },
  };
  const focusedReport = {
    reportKind: 'evobuddy-core-product-path-v0',
    status: 'pass',
    summary: 'product path passed',
  };
  const finalSummary = {
    reportKind: 'native-buddy-product-root-summary-v0',
    status: 'pass',
    outputRef: `../${prefix}result.txt`,
  };
  writeJson(join(root, `${prefix}parent-call-record.json`), parentCallRecord);
  writeJson(join(root, `${prefix}observed-parent-call-transcript.json`), transcript);
  writeJson(join(root, `${prefix}exporter-manifest.json`), exporterManifest);
  writeJson(join(root, `${prefix}focused-buddy-product-report.json`), focusedReport);
  writeJson(join(root, `${prefix}product-root`, 'native-buddy-product-root-summary.json'), finalSummary);
  writeFileSync(join(root, `${prefix}result.txt`), 'final answer\n', 'utf8');
  return {
    transcriptDigest: sha256Text(`${JSON.stringify(transcript, null, 2)}\n`),
    parentCallRecordDigest: createParentCallRecordDigest(parentCallRecord),
    invocationDigest,
    dbDigest,
    projectIdentity,
  };
}

function benchmarkArm(root, { arm = 'evobuddy-no-orchestrator', promptInjection = { kind: 'none', allowedForNativeEvoBuddy: true }, prefix = '', digestSeed = '1' } = {}) {
  return {
    arm,
    evidenceTier: 'product-observed',
    promptInjection,
    observations: {
      relevantBuddySelected: true,
      contextCollected: true,
      resultReturnedToParent: true,
      parentUsedBuddyResult: true,
      verificationPerformed: true,
      unnecessaryWorkflowOverheadAvoided: true,
      focusedBuddyProductReportPassed: true,
      matchingBuddyIdentity: true,
    },
    refs: {
      observedParentCallRef: join(root, `${prefix}observed-parent-call-transcript.json`),
      exporterManifestRef: join(root, `${prefix}exporter-manifest.json`),
      parentCallRecordRef: join(root, `${prefix}parent-call-record.json`),
      focusedBuddyProductReportRef: join(root, `${prefix}focused-buddy-product-report.json`),
      finalizedProductRootRef: join(root, `${prefix}product-root`),
      parentVisibleResultRef: join(root, `${prefix}result.txt`),
      buddyName: 'skill-designer',
      memberName: 'skill-designer',
      invocationDigest: `sha256:${digestSeed.repeat(6)}aaa`,
      projectIdentity: `proj-${prefix || 'native'}`,
      transcriptDigest: `sha256:${digestSeed.repeat(3)}`,
      dbDigest: `sha256:${digestSeed.repeat(3)}db`,
    },
  };
}

async function writeNaturalUseBenchmarkReport(root, overrides = {}) {
  const proof = await createValidBenchmarkObservedProofRoot(root);
  const reportPath = join(root, 'evobuddy-natural-use-benchmark-report.json');
  writeJson(reportPath, {
    schemaVersion: 'evobuddy-natural-use-benchmark-v1',
    proofValidationVersion: 'evobuddy-natural-use-benchmark-proof-v1',
    status: 'pass',
    scenarioKind: 'implementation-plan-review',
    coverageSummary: {
      nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'eval-correction-loop'],
      nativeLightAffordancePassScenarioKinds: [],
      nativeEvolvedLoopPassScenarioKinds: [],
    },
    scenarioCoverageEvidence: {
      nativeNoOrchestrator: [
        { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: join(root, 'scenario-implementation-plan-review.json') },
        { scenarioKind: 'eval-correction-loop', status: 'pass', reportRef: join(root, 'scenario-eval-correction-loop.json') },
      ],
      nativeLightAffordance: [],
      nativeEvolvedLoop: [],
    },
    nativeEvoBuddy: { status: 'pass', arms: ['evobuddy-no-orchestrator'] },
    omoHostedCompatibility: { status: 'blocked', arms: [] },
    decision: { fixedOrchestratorRecommendation: 'not-needed' },
    arms: [{
      ...benchmarkArm(root),
      status: 'pass',
      effectiveEvidenceTier: 'product-observed',
      proofIssues: [],
      blockedReasons: [],
      failedReasons: [],
      validatedRefs: [{ kind: 'focused Buddy product report', ref: join(root, 'focused-buddy-product-report.json'), digest: 'sha256:embedded-proof-digest' }],
      focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
      refs: {
        ...benchmarkArm(root).refs,
        invocationDigest: proof.invocationDigest,
        transcriptDigest: proof.transcriptDigest,
        parentCallRecordDigest: proof.parentCallRecordDigest,
        dbDigest: proof.dbDigest,
        projectIdentity: proof.projectIdentity,
      },
    }],
    ...overrides,
  });
  return reportPath;
}

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'members');
  mkdirSync(membersDir, { recursive: true });
  const profilePath = join(membersDir, 'skill-designer.json');
  writeFileSync(profilePath, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: [],
    activationHints: ['skill design'],
    negativeActivationHints: ['native spawn debugging'],
  }, null, 2)}\n`, 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{ name: 'skill-designer', profileRef: './skill-designer.json', aliases: ['designer'] }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

function buildProjectFixture(root) {
  const project = join(root, 'project');
  const registry = writeRegistryFixture(root);
  const setup = runNode([EVOBUDDY, 'setup', '--project', project, '--runtime', 'opencode', '--json']);
  assert.equal(setup.status, 0, setup.stderr || setup.stdout);
  const seededRegistry = JSON.parse(readFileSync(join(project, '.evobuddy', 'registry.json'), 'utf8'));
  const skillRegistry = JSON.parse(readFileSync(registry, 'utf8'));
  const existingNames = new Set((seededRegistry.members ?? []).map((member) => member.name));
  seededRegistry.members.push(...skillRegistry.members.filter((member) => !existingNames.has(member.name)));
  writeJson(join(project, '.evobuddy', 'registry.json'), seededRegistry);
  if (!seededRegistry.members.some((member) => member.name === 'skill-designer' && typeof member.profileRef === 'string' && member.profileRef.includes('src/presets/buddies/skill-designer'))) {
    writeFileSync(join(project, '.evobuddy', 'skill-designer.json'), readFileSync(join(root, 'members', 'skill-designer.json'), 'utf8'), 'utf8');
  }
  const sync = runNode([EVOBUDDY, 'buddies', 'sync', '--project', project, '--json']);
  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
  cpSync(WORKBENCH_FIXTURE_ROOT, join(project, '.evobuddy', 'runs', 'mechanism-opencode'), { recursive: true });
  cpSync(WORKBENCH_FIXTURE_ROOT, join(project, '.evobuddy', 'runs', 'mechanism-claude'), { recursive: true });
  cpSync(WORKBENCH_FIXTURE_ROOT, join(project, '.evobuddy', 'runs', 'mechanism-codex'), { recursive: true });
  cpSync(WORKBENCH_FIXTURE_ROOT, join(project, '.evobuddy', 'runs', 'natural-opencode'), { recursive: true });
  cpSync(WORKBENCH_FIXTURE_ROOT, join(project, '.evobuddy', 'runs', 'natural-claude'), { recursive: true });
  cpSync(WORKBENCH_FIXTURE_ROOT, join(project, '.evobuddy', 'runs', 'natural-codex'), { recursive: true });
  writeFileSync(join(project, '.evobuddy', 'evolution', 'ledger.jsonl'), `${JSON.stringify({ action: 'applied', patchId: 'patch-applied', targetKind: 'skill', skillAction: 'update-existing', targetRef: 'buddy:skill-designer', activeTargetRef: join(project, '.evobuddy/buddies/skill-designer/skills/active.md'), createdAt: '2026-07-13T00:00:00.000Z', summary: 'Applied skill-designer skill update: ask for source evidence first.' })}\n`, 'utf8');
  for (const runtime of ['opencode', 'claude', 'codex']) {
      writeProofRoot(root, runtime, proof(runtime, { proofLayer: 'nativeMechanism' }), 'mechanism-root');
      writeProofRoot(root, runtime, proof(runtime), 'natural-root');
    }
  const releaseOut = join(root, 'release-out');
    const releaseEval = runNode([
      THREE_RUNTIME_RELEASE_EVAL_CLI,
      '--project', project,
      '--member', RELEASE_MEMBER,
      '--out', releaseOut,
    '--require-runtimes', 'opencode,claude,codex',
    '--product-root-opencode', join(root, 'opencode', 'mechanism-root'),
    '--product-root-claude', join(root, 'claude', 'mechanism-root'),
    '--product-root-codex', join(root, 'codex', 'mechanism-root'),
    '--natural-root-opencode', join(root, 'opencode', 'natural-root'),
    '--natural-root-claude', join(root, 'claude', 'natural-root'),
    '--natural-root-codex', join(root, 'codex', 'natural-root'),
  ]);
  assert.equal(releaseEval.status, 0, releaseEval.stderr || releaseEval.stdout);
  return { project, releaseReport: join(releaseOut, 'three-runtime-buddy-surface-release-report.json') };
}

describe('product release readiness eval CLI', () => {
  it('blocks foundation readiness when product-observed proof is missing and does not claim benchmark sufficiency', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-foundation-readiness-blocked-'));
    try {
      const project = join(root, 'project');
      const setup = runNode([join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs'), 'setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const out = join(root, 'readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-foundation-readiness-eval');
      assert.equal(report.scope, 'foundation-readiness-only');
      assert.equal(report.verdict, 'fail');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.recommendation, 'not-run');
      assert.equal(report.gates.naturalUseBenchmark.nativeEvoBuddy.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.omoHostedCompatibility.status, 'not-run');
      assert.equal(report.gates.productObservedProof.status, 'blocked');
      assert.equal(report.gates.workbench.status, 'fail');
      assert.doesNotMatch(JSON.stringify(report), /OMO replacement|no-orchestrator sufficiency|natural-use benchmark success/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when setup sync doctor release report workbench and docs gates all pass', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-readiness-pass-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root);
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.gates.setupState.status, 'pass');
      assert.equal(report.gates.syncDefinitions.status, 'pass');
      assert.equal(report.gates.doctor.status, 'pass');
      assert.equal(report.gates.releaseReport.status, 'pass');
      assert.equal(report.presetRoster.status, 'pass');
      assert.equal(report.rosterProjectionParity.status, 'pass');
      assert.equal(report.naturalUseRosterFamilies.status, 'pass');
      assert.equal(report.naturalUseRosterFamilies.controlCountsAsPass, false);
      assert.equal(report.gates.naturalUseBenchmark.status, 'pass');
      assert.equal(report.gates.naturalUseBenchmark.nativeEvoBuddy.status, 'pass');
      assert.equal(report.gates.workbench.status, 'pass');
      assert.equal(report.gates.workbench.modelSummary.experts > 0, true);
      assert.equal(report.gates.workbench.modelSummary.tasks > 0, true);
      assert.equal(report.gates.docs.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when three-runtime active roster parity is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-readiness-roster-'));
    try {
      const releaseReport = join(root, 'three-runtime-buddy-surface-release-report.json');
      writeJson(releaseReport, {
        member: RELEASE_MEMBER,
        verdict: 'pass',
        runtimes: {
          opencode: { status: 'pass', nativeMechanismPass: true, naturalUsePass: true },
          claude: { status: 'pass', nativeMechanismPass: true, naturalUsePass: true },
          codex: { status: 'pass', nativeMechanismPass: true, naturalUsePass: true },
        },
        rosterProjectionParity: {
          status: 'fail',
          expectedActiveBuddies: ['explore', 'librarian', 'sisyphus-junior'],
          runtimes: {
            opencode: ['explore', 'librarian', 'sisyphus-junior'],
            claude: ['explore', 'librarian', 'sisyphus-junior'],
            codex: ['explore', 'sisyphus-junior'],
          },
          issues: ['codex missing librarian'],
        },
      });
      const project = join(root, 'project');
      const setup = runNode([EVOBUDDY, 'setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const out = join(root, 'out');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.notEqual(report.verdict, 'pass');
      assert.equal(report.presetRoster.status, 'pass');
      assert.equal(report.rosterProjectionParity.status, 'fail');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when the Workbench model is structurally present but empty', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-product-readiness-empty-workbench-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      rmSync(join(project, '.evobuddy', 'runs'), { recursive: true, force: true });
      mkdirSync(join(project, '.evobuddy', 'runs'), { recursive: true });
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root);
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.gates.workbench.status, 'fail');
      assert.match(report.gates.workbench.issues.join('\n'), /at least one expert|at least one task/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when benchmark coverage summary names extra scenario kinds without matching coverage evidence entries', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-coverage-mismatch-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root, {
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'code-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [
            { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: join(root, 'scenario-implementation-plan-review.json') },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
      });
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.match(report.gates.naturalUseBenchmark.blockedReasons.join('\n'), /embedded summary disagrees|native EvoBuddy natural-use benchmark must pass/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when a validated native benchmark lacks cross-scenario sufficiency', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-insufficient-cross-scenario-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root, {
        status: 'blocked',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [
            { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: join(root, 'scenario-implementation-plan-review.json') },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
        nativeEvoBuddy: { status: 'pass', arms: ['evobuddy-no-orchestrator'] },
        decision: { fixedOrchestratorRecommendation: 'insufficient-cross-scenario-native-evidence' },
      });
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.recommendation, 'insufficient-cross-scenario-native-evidence');
      assert.match(report.gates.naturalUseBenchmark.blockedReasons.join('\n'), /does not authorize release sufficiency/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when retained roots contain raw DB artifacts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-readiness-retained-db-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root);
      writeFileSync(join(project, '.evobuddy', 'runs', 'natural-opencode', 'opencode-session-corpus-source.sqlite'), 'raw sqlite bytes', 'utf8');
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.gates.retainedArtifactGuard.status, 'fail');
      assert.match(report.failedReasons.join('\n'), /retained raw DB artifact.*opencode-session-corpus-source\.sqlite/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when release evidence is adapter-only even if setup sync and workbench exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-readiness-adapter-only-'));
    try {
      const { project } = buildProjectFixture(root);
      writeProofRoot(root, 'codex', proof('codex', { negativeControls: { ...proof('codex').negativeControls, adapterOnly: true } }), 'natural-root');
      const failReleaseOut = join(root, 'release-fail-out');
      const releaseEval = runNode([
        THREE_RUNTIME_RELEASE_EVAL_CLI,
        '--project', project,
        '--member', RELEASE_MEMBER,
        '--out', failReleaseOut,
        '--require-runtimes', 'opencode,claude,codex',
        '--product-root-opencode', join(root, 'opencode', 'mechanism-root'),
        '--product-root-claude', join(root, 'claude', 'mechanism-root'),
        '--product-root-codex', join(root, 'codex', 'mechanism-root'),
        '--natural-root-opencode', join(root, 'opencode', 'natural-root'),
        '--natural-root-claude', join(root, 'claude', 'natural-root'),
        '--natural-root-codex', join(root, 'codex', 'natural-root'),
      ]);
      assert.notEqual(releaseEval.status, 0);

      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', join(failReleaseOut, 'three-runtime-buddy-surface-release-report.json')]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.gates.releaseReport.status, 'fail');
      assert.match(report.failedReasons.join('\n'), /adapter-only|codex/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not count OMO-hosted compatibility as EvoBuddy-native natural use', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-omo-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const omoProof = await createValidBenchmarkObservedProofRoot(root, { prefix: 'omo-', digestSeed: '3', projectIdentity: 'proj-omo' });
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root, {
        status: 'blocked',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: [],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        nativeEvoBuddy: { status: 'blocked', arms: [] },
        omoHostedCompatibility: { status: 'pass', arms: ['omo-hosted-compatibility'] },
        decision: { fixedOrchestratorRecommendation: 'insufficient-native-evidence' },
        arms: [{
          ...benchmarkArm(root, { arm: 'omo-hosted-compatibility', promptInjection: { kind: 'omo-hosted', allowedForNativeEvoBuddy: false }, prefix: 'omo-', digestSeed: '3' }),
          status: 'pass',
          effectiveEvidenceTier: 'product-observed',
          proofIssues: [],
          blockedReasons: [],
          failedReasons: [],
          validatedRefs: [{ kind: 'focused Buddy product report', ref: join(root, 'omo-focused-buddy-product-report.json'), digest: 'sha256:omo-embedded-proof-digest' }],
          focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
          refs: {
            ...benchmarkArm(root, { arm: 'omo-hosted-compatibility', promptInjection: { kind: 'omo-hosted', allowedForNativeEvoBuddy: false }, prefix: 'omo-', digestSeed: '3' }).refs,
            invocationDigest: omoProof.invocationDigest,
            transcriptDigest: omoProof.transcriptDigest,
            parentCallRecordDigest: omoProof.parentCallRecordDigest,
            dbDigest: omoProof.dbDigest,
            projectIdentity: omoProof.projectIdentity,
          },
        }],
      });
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'blocked');
      assert.equal(report.gates.releaseReport.status, 'pass');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.recommendation, 'insufficient-native-evidence');
      assert.equal(report.gates.naturalUseBenchmark.nativeEvoBuddy.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.omoHostedCompatibility.status, 'pass');
      assert.match(report.blockedReasons.join('\n'), /native EvoBuddy natural-use benchmark must pass/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves honest control evidence for debugging-like scenarios without counting it as native EvoBuddy pass', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-control-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root, {
        status: 'blocked',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: [],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
        nativeEvoBuddy: { status: 'blocked', arms: ['evobuddy-no-orchestrator'] },
        honestControlEvidence: { status: 'pass', arms: ['evobuddy-no-orchestrator'] },
        decision: { fixedOrchestratorRecommendation: 'insufficient-evidence' },
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'control-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: false,
            contextCollected: true,
            resultReturnedToParent: false,
            parentUsedBuddyResult: false,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: false,
            matchingBuddyIdentity: false,
          },
          controlOutcome: {
            kind: 'no-relevant-buddy-selected',
            reason: 'runtime naturally handled debugging through a non-Buddy route',
          },
        }],
      });
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'blocked');
      assert.equal(report.gates.releaseReport.status, 'pass');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.nativeEvoBuddy.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.honestControlEvidence.status, 'pass');
      assert.deepEqual(report.gates.naturalUseBenchmark.honestControlEvidence.arms, ['evobuddy-no-orchestrator']);
      assert.equal(report.gates.naturalUseBenchmark.recommendation, 'insufficient-evidence');
      assert.match(report.blockedReasons.join('\n'), /native EvoBuddy natural-use benchmark must pass/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the benchmark report claims pass without any validated passing arm evidence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-invalid-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root, {
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs: {
            observedParentCallRef: '/tmp/product/observed-parent-call-transcript.json',
            exporterManifestRef: '/tmp/product/exporter-manifest.json',
            parentCallRecordRef: '/tmp/product/parent-call-record.json',
            focusedBuddyProductReportRef: '/tmp/product/focused-buddy-product-report.json',
            finalizedProductRootRef: '/tmp/product/root',
            parentVisibleResultRef: '/tmp/product/result.txt',
            buddyName: 'skill-designer',
            memberName: 'skill-designer',
            invocationDigest: 'sha256:111aaa',
            projectIdentity: 'proj-invalid',
            transcriptDigest: 'sha256:111',
            dbDigest: 'sha256:222',
          },
        }],
      });
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'blocked');
      assert.equal(report.gates.releaseReport.status, 'pass');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.nativeEvoBuddy.status, 'blocked');
      assert.match(report.gates.naturalUseBenchmark.blockedReasons.join('\n'), /invalid benchmark|validated passing arm evidence|unreadable observed proof ref/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the benchmark summary claims pass but current benchmark proof artifacts no longer validate', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-stale-proof-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const staleRoot = join(root, 'stale-benchmark');
      mkdirSync(staleRoot, { recursive: true });
      const staleProof = await createValidBenchmarkObservedProofRoot(staleRoot);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root, {
        nativeEvoBuddy: { status: 'pass', arms: ['evobuddy-no-orchestrator'] },
        arms: [{
          ...benchmarkArm(staleRoot),
          status: 'pass',
          effectiveEvidenceTier: 'product-observed',
          proofIssues: [],
          blockedReasons: [],
          failedReasons: [],
          validatedRefs: [{ kind: 'focused Buddy product report', ref: join(staleRoot, 'focused-buddy-product-report.json'), digest: 'sha256:stale-proof-digest' }],
          focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
          refs: {
            ...benchmarkArm(staleRoot).refs,
            invocationDigest: staleProof.invocationDigest,
            transcriptDigest: staleProof.transcriptDigest,
            parentCallRecordDigest: staleProof.parentCallRecordDigest,
            dbDigest: staleProof.dbDigest,
            projectIdentity: staleProof.projectIdentity,
          },
        }],
      });
      rmSync(join(staleRoot, 'product-root'), { recursive: true, force: true });
      const out = join(root, 'product-readiness');
      const result = runNode([RELEASE_EVAL_CLI, '--project', project, '--out', out, '--require-runtimes', 'opencode,claude,codex', '--release-report', releaseReport, '--natural-use-benchmark-report', naturalUseBenchmarkReport]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'blocked');
      assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
      assert.match(report.gates.naturalUseBenchmark.blockedReasons.join('\n'), /invalid benchmark report|product-observed/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when a supplied release report targets a non-evolution release subject', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-readiness-wrong-release-subject-'));
    try {
      const { project, releaseReport } = buildProjectFixture(root);
      const wrongSubjectReleaseReport = join(root, 'wrong-subject-release-report.json');
      const reportBody = JSON.parse(readFileSync(releaseReport, 'utf8'));
      reportBody.member = 'explore';
      writeJson(wrongSubjectReleaseReport, reportBody);
      const naturalUseBenchmarkReport = await writeNaturalUseBenchmarkReport(root);
      const out = join(root, 'product-readiness');
      const result = runNode([
        RELEASE_EVAL_CLI,
        '--project', project,
        '--out', out,
        '--require-runtimes', 'opencode,claude,codex',
        '--release-report', wrongSubjectReleaseReport,
        '--natural-use-benchmark-report', naturalUseBenchmarkReport,
      ]);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.gates.releaseReport.status, 'fail');
      assert.match(report.gates.releaseReport.issues.join('\n'), /subject must be sisyphus-junior/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
