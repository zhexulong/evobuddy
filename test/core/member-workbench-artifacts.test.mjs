import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMemberWorkbenchArtifacts } from '../../src/core/member-workbench-artifacts.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURE_ROOT = resolve(ROOT, 'fixtures/member-surface/final-acceptance');
const POSITIVE_ROOT = resolve(FIXTURE_ROOT, 'positive');
const REGISTRY_REF = resolve(ROOT, 'fixtures/member-surface/registry.json');

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('readMemberWorkbenchArtifacts', () => {
  it('wraps member-surface artifacts and report semantics for the final acceptance root', async () => {
    const result = await readMemberWorkbenchArtifacts({
      inputRoot: FIXTURE_ROOT,
      registryRef: REGISTRY_REF,
      materialProofRequirements: {
        'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
      },
    });

    assert.equal(result.surfaceReport.reportKind, 'context-tree-member-surface');
    assert.equal(result.surfaceArtifacts.rootKind, 'aggregate-root');
    assert.equal(result.runs.length, result.surfaceReport.runs.length);
    assert.equal(result.runs.length, result.surfaceArtifacts.runs.length);
    assert.deepEqual(
      result.runs.map(({ run }) => run.id),
      result.surfaceArtifacts.runs.map(({ run }) => run.id),
    );
    assert.equal(result.surfaceReport.generatedFrom.inputRoot, FIXTURE_ROOT);
    assert.equal(result.surfaceReport.runs.find((run) => run.runId.endsWith('positive')).materialProof.status, 'pass');
  });

  it('loads explicit member artifacts next to each raw run and resolves observed call path refs locally', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-explicit-'));
    try {
      const runDir = join(tempRoot, 'explicit-source-writer');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json', 'acceptance-proof.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }

      const parentInvocation = {
        artifactKind: 'explicit-member-parent-invocation',
        invocationId: 'parent-invocation-1',
        observedCallPathRef: 'explicit-member-parent-invocation-source.json',
      };
      const parentInvocationSource = {
        artifactKind: 'explicit-member-parent-invocation-source',
        transcript: ['parent called explicit-source-writer'],
      };
      const executorInput = { artifactKind: 'explicit-member-executor-input', prompt: 'review this' };
      const executorOutput = { artifactKind: 'explicit-member-executor-output', answer: 'known' };
      const executorObservation = { artifactKind: 'explicit-member-executor-observation', observed: true };

      writeJson(join(runDir, 'explicit-member-parent-invocation.json'), parentInvocation);
      writeJson(join(runDir, 'explicit-member-parent-invocation-source.json'), parentInvocationSource);
      writeJson(join(runDir, 'explicit-member-executor-input.json'), executorInput);
      writeJson(join(runDir, 'explicit-member-executor-output.json'), executorOutput);
      writeJson(join(runDir, 'explicit-member-executor-observation.json'), executorObservation);

      const result = await readMemberWorkbenchArtifacts({ inputRoot: tempRoot });

      assert.equal(result.runs.length, 1);
      const enrichedRun = result.runs[0];
      assert.equal(enrichedRun.acceptanceProof.caseId, 'current-boundary-spawn-canary');
      assert.deepEqual(enrichedRun.explicitParentInvocation, parentInvocation);
      assert.deepEqual(enrichedRun.explicitParentInvocationSource, parentInvocationSource);
      assert.deepEqual(enrichedRun.explicitExecutorInput, executorInput);
      assert.deepEqual(enrichedRun.explicitExecutorOutput, executorOutput);
      assert.deepEqual(enrichedRun.explicitExecutorObservation, executorObservation);
      assert.equal(enrichedRun.explicitArtifactRefs.acceptanceProofPath, join(runDir, 'acceptance-proof.json'));
      assert.equal(enrichedRun.explicitArtifactRefs.explicitParentInvocationPath, join(runDir, 'explicit-member-parent-invocation.json'));
      assert.equal(enrichedRun.explicitArtifactRefs.explicitParentInvocationSourcePath, join(runDir, 'explicit-member-parent-invocation-source.json'));
      assert.equal(enrichedRun.explicitArtifactRefs.explicitExecutorInputPath, join(runDir, 'explicit-member-executor-input.json'));
      assert.equal(enrichedRun.explicitArtifactRefs.explicitExecutorOutputPath, join(runDir, 'explicit-member-executor-output.json'));
      assert.equal(enrichedRun.explicitArtifactRefs.explicitExecutorObservationPath, join(runDir, 'explicit-member-executor-observation.json'));
      assert.doesNotMatch(result.warnings.join('\n'), /explicit-member-executor-input|explicit-member-executor-output|explicit-member-executor-observation/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads same-run absolute observed call path refs from generated product roots', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-product-root-'));
    try {
      const runDir = join(tempRoot, 'explicit-product-run');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json', 'acceptance-proof.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }

      const parentInvocationSourcePath = join(runDir, 'explicit-member-parent-invocation-source.json');
      const parentInvocationSource = {
        artifactKind: 'explicit-member-parent-invocation-source',
        sourceKind: 'observed-parent-agent-call',
      };
      writeJson(join(runDir, 'explicit-member-parent-invocation.json'), {
        artifactKind: 'explicit-member-parent-invocation',
        invocationId: 'parent-invocation-absolute-ref',
        observedCallPathRef: parentInvocationSourcePath,
      });
      writeJson(parentInvocationSourcePath, parentInvocationSource);

      const result = await readMemberWorkbenchArtifacts({ inputRoot: tempRoot });

      assert.equal(result.runs.length, 1);
      assert.deepEqual(result.runs[0].explicitParentInvocationSource, parentInvocationSource);
      assert.equal(result.runs[0].explicitArtifactRefs.explicitParentInvocationSourcePath, parentInvocationSourcePath);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('warns for missing optional explicit files but rejects an explicit missing observed call path ref', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-missing-explicit-'));
    try {
      const runDir = join(tempRoot, 'explicit-source-writer');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }

      const warningsResult = await readMemberWorkbenchArtifacts({ inputRoot: tempRoot });
      assert.match(warningsResult.warnings.join('\n'), /missing optional explicit artifact acceptance-proof\.json/);
      assert.match(warningsResult.warnings.join('\n'), /missing optional explicit artifact explicit-member-parent-invocation\.json/);

      writeJson(join(runDir, 'explicit-member-parent-invocation.json'), {
        artifactKind: 'explicit-member-parent-invocation',
        observedCallPathRef: 'missing-observed-call-path.json',
      });

      await assert.rejects(
        () => readMemberWorkbenchArtifacts({ inputRoot: tempRoot }),
        /observedCallPathRef.*missing-observed-call-path\.json/,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects observed call path refs that escape the run directory', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-escaped-ref-'));
    try {
      const runDir = join(tempRoot, 'explicit-source-writer');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }
      writeJson(join(tempRoot, 'outside.json'), {
        artifactKind: 'explicit-member-parent-invocation-source',
        shouldNotBeRead: true,
      });
      writeJson(join(runDir, 'explicit-member-parent-invocation.json'), {
        artifactKind: 'explicit-member-parent-invocation',
        observedCallPathRef: '../outside.json',
      });

      await assert.rejects(
        () => readMemberWorkbenchArtifacts({ inputRoot: tempRoot }),
        /observedCallPathRef.*local|run directory|boundary/i,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads packet, return, memory, and deferred suggestion artifacts from the run directory', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-lifecycle-artifacts-'));
    try {
      const runDir = join(tempRoot, 'skill-designer-live');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }

      const request = readJson(join(runDir, 'member-task-request.json'));
      request.memberInvocationPacketRef = './member-invocation-packet.json';
      writeJson(join(runDir, 'member-task-request.json'), request);

      const run = readJson(join(runDir, 'member-task-run.json'));
      run.packetDeliveryEvidence = {
        kind: 'member-packet-delivery-evidence',
        deliveryKind: 'native-fork',
        deliveryAuthority: 'adapter-observed',
        runtimeSurface: 'codex-native-spawn',
        memberInvocationPacketRef: './member-invocation-packet.json',
        deliveredInputDigest: 'sha256:child-input',
        evidenceRef: 'native-spawn:natural-parent-thread:natural-child-thread:v1-terminal-status',
      };
      run.resultReturnEvidence = {
        kind: 'member-result-return-evidence',
        returnedTo: 'parent-agent',
        evidenceKind: 'runtime-wait-result',
        evidenceRef: 'native-spawn:natural-parent-thread:natural-child-thread:v1-terminal-status',
        resultDigest: 'sha256:result',
      };
      run.memberRetrospectiveLearningRef = './member-retrospective-learning.json';
      run.roleMemoryCandidateRef = './role-memory-candidate.json';
      run.memberDreamerRunRef = './member-dreamer-run.json';
      run.memberProfileCandidatesRef = './member-profile-candidates.json';
      writeJson(join(runDir, 'member-task-run.json'), run);

      const packet = {
        kind: 'member-invocation-packet',
        id: 'packet-1',
        memberName: 'skill-designer',
      };
      const retrospective = {
        id: 'retro-1',
        memberName: 'skill-designer',
        status: 'recorded',
        candidateRefs: ['role-memory-candidate:1'],
      };
      const roleMemoryCandidate = {
        id: 'role-memory-candidate:1',
        memberName: 'skill-designer',
        proposedType: 'review_rubric',
        content: 'Preserve packet/result-return boundary checks.',
        sourceRefs: ['run:1'],
        creationSource: 'retrospective-learning',
        sourceAuthority: 'host-applied',
        signalType: 'feedback',
        proposedDefaultVisibility: 'searchable',
        confidence: 0.66,
        createdAt: '2026-07-10T00:00:00.000Z',
        status: 'pending',
      };
      const memberDreamerRun = {
        id: 'dreamer-1',
        memberName: 'skill-designer',
        taskName: 'retrospective-learning',
        trigger: 'after-run',
        leaseKey: 'lease-1',
        inputRefs: ['run:1'],
        appliedMutationRefs: [],
        status: 'partial',
      };
      const memberProfileCandidates = {
        artifactKind: 'member-profile-candidates',
        candidates: [
          {
            memberName: 'suggested-reviewer',
            confidence: 0.62,
            status: 'candidate',
            source: 'retained-future-suggestion',
          },
        ],
      };

      writeJson(join(runDir, 'member-invocation-packet.json'), packet);
      writeJson(join(runDir, 'member-retrospective-learning.json'), retrospective);
      writeJson(join(runDir, 'role-memory-candidate.json'), roleMemoryCandidate);
      writeJson(join(runDir, 'member-dreamer-run.json'), memberDreamerRun);
      writeJson(join(runDir, 'member-profile-candidates.json'), memberProfileCandidates);

      const result = await readMemberWorkbenchArtifacts({ inputRoot: tempRoot });

      assert.equal(result.runs.length, 1);
      const enrichedRun = result.runs[0];
      assert.deepEqual(enrichedRun.memberInvocationPacket, packet);
      assert.deepEqual(enrichedRun.packetDeliveryEvidence, run.packetDeliveryEvidence);
      assert.deepEqual(enrichedRun.resultReturnEvidence, run.resultReturnEvidence);
      assert.deepEqual(enrichedRun.memberRetrospectiveLearning, retrospective);
      assert.deepEqual(enrichedRun.roleMemoryCandidate, roleMemoryCandidate);
      assert.deepEqual(enrichedRun.memberDreamerRun, memberDreamerRun);
      assert.deepEqual(enrichedRun.memberProfileCandidates, memberProfileCandidates);
      assert.equal(enrichedRun.workbenchArtifactRefs.memberInvocationPacketPath, join(runDir, 'member-invocation-packet.json'));
      assert.equal(enrichedRun.workbenchArtifactRefs.memberRetrospectiveLearningPath, join(runDir, 'member-retrospective-learning.json'));
      assert.equal(enrichedRun.workbenchArtifactRefs.roleMemoryCandidatePath, join(runDir, 'role-memory-candidate.json'));
      assert.equal(enrichedRun.workbenchArtifactRefs.memberDreamerRunPath, join(runDir, 'member-dreamer-run.json'));
      assert.equal(enrichedRun.workbenchArtifactRefs.memberProfileCandidatesPath, join(runDir, 'member-profile-candidates.json'));
      assert.equal(result.warnings.some((warning) => /member-invocation-packet|role-memory-candidate|member-profile-candidates/.test(warning)), false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('warns when a lifecycle run references packet, return, memory, or suggestion artifacts that are missing', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-missing-lifecycle-artifacts-'));
    try {
      const runDir = join(tempRoot, 'skill-designer-missing-artifacts');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }

      const request = readJson(join(runDir, 'member-task-request.json'));
      request.memberInvocationPacketRef = './member-invocation-packet.json';
      writeJson(join(runDir, 'member-task-request.json'), request);

      const run = readJson(join(runDir, 'member-task-run.json'));
      run.memberRetrospectiveLearningRef = './member-retrospective-learning.json';
      run.roleMemoryCandidateRef = './role-memory-candidate.json';
      run.memberDreamerRunRef = './member-dreamer-run.json';
      run.memberProfileCandidatesRef = './member-profile-candidates.json';
      delete run.packetDeliveryEvidence;
      delete run.resultReturnEvidence;
      writeJson(join(runDir, 'member-task-run.json'), run);

      const result = await readMemberWorkbenchArtifacts({ inputRoot: tempRoot });
      const warnings = result.warnings.join('\n');
      assert.match(warnings, /missing referenced packet artifact member-invocation-packet\.json/);
      assert.match(warnings, /missing referenced packet-delivery evidence in member-task-run\.json/);
      assert.match(warnings, /missing referenced result-return evidence in member-task-run\.json/);
      assert.match(warnings, /missing referenced memory artifact member-retrospective-learning\.json/);
      assert.match(warnings, /missing referenced memory artifact role-memory-candidate\.json/);
      assert.match(warnings, /missing referenced memory artifact member-dreamer-run\.json/);
      assert.match(warnings, /missing referenced suggestion artifact member-profile-candidates\.json/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads discovery ledger and utility artifacts for setup/import Workbench visibility', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-discovery-artifacts-'));
    try {
      const runDir = join(tempRoot, 'skill-designer-live');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        copyFileSync(resolve(POSITIVE_ROOT, name), join(runDir, name));
      }
      const candidateLedger = { artifactKind: 'member-candidate-ledger', entries: [{ candidateId: 'candidate:eval-proof-reviewer', memberName: 'eval-proof-reviewer', seenCount: 2, overlapCandidateIds: ['candidate:proof-auditor'], warnings: [{ reason: 'confirm overlap' }] }] };
      const memberUtilityDiscovery = { status: 'candidate-discovered', warningCount: 1, warnings: [{ reason: 'confirm overlap' }], rejectedProposals: [] };
      const candidates = { candidates: [{ id: 'candidate:eval-proof-reviewer', memberName: 'eval-proof-reviewer', status: 'candidate', confidence: 0.82, evidenceRefs: ['event:a'] }] };
      writeJson(join(tempRoot, 'member-candidate-ledger.json'), candidateLedger);
      writeJson(join(tempRoot, 'member-utility-discovery.json'), memberUtilityDiscovery);
      writeJson(join(tempRoot, 'member-profile-candidates.json'), candidates);

      const result = await readMemberWorkbenchArtifacts({ inputRoot: tempRoot });

      assert.deepEqual(result.candidateLedger, candidateLedger);
      assert.deepEqual(result.memberUtilityDiscovery, memberUtilityDiscovery);
      assert.deepEqual(result.setupImportCandidates, candidates);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
