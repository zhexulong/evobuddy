import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-evobuddy-realtime-fork-handoff-taskroom-live-eval.mjs');
const now = '2026-07-19T00:00:00.000Z';

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
}

function observedRoot() {
  return {
    schema: 'evobuddy-observed-taskroom-root.v1',
    proofScope: 'product-observed',
    runtime: 'opencode',
    taskRoomLoop: {
      schema: 'evobuddy-taskroom-loop-proof.v1',
      proofScope: 'product-observed',
      roomId: 'taskroom:demo',
      participants: [
        { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
        { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
      ],
      rounds: [
        { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer', reviewerFindingDigest: 'sha256:review-1', reviewerTranscriptRef: 'message:reviewer:1' },
        { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'], priorReviewDigests: ['sha256:review-1'], reviewerFindingDigest: 'sha256:review-2', reviewerTranscriptRef: 'message:reviewer:2' },
      ],
      handoffs: [
        { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'message:review-request:1', artifactRefs: ['artifact:patch:1'] },
        { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'message:review-findings:1', artifactRefs: ['artifact:review:1'] },
      ],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'message:final', observedParentThreadRef: 'opencode:session:parent', digest: 'sha256:final' },
      exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
      nativeForkEvidenceRefs: ['exporter:spawn:builder', 'exporter:spawn:reviewer'],
      surfaceCurrentAnchors: [
        { actorName: 'builder', runtimeSessionRef: 'opencode:session:builder', projectionRef: '.opencode/agents/builder.md', projectedDigest: 'sha256:builder-projection', definitionRef: 'src/agents/builder.md', definitionDigest: 'sha256:builder-definition' },
        { actorName: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer', projectionRef: '.opencode/agents/reviewer.md', projectedDigest: 'sha256:reviewer-projection', definitionRef: 'src/agents/reviewer.md', definitionDigest: 'sha256:reviewer-definition' },
      ],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: now },
  };
}

function forkHandoff() {
  return {
    instances: [
      { instanceId: 'instance:parent', roomId: 'taskroom:demo', actorName: 'parent', actorKind: 'user', role: 'coordinator', runtime: 'opencode', runtimeSessionRef: 'opencode:session:parent', lifecycle: 'active', createdAt: now },
      { instanceId: 'instance:builder', roomId: 'taskroom:demo', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtime: 'opencode', runtimeSessionRef: 'opencode:session:builder', lifecycle: 'active', createdAt: now, createdByForkId: 'fork:builder' },
      { instanceId: 'instance:reviewer', roomId: 'taskroom:demo', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtime: 'opencode', runtimeSessionRef: 'opencode:session:reviewer', lifecycle: 'active', createdAt: now, createdByForkId: 'fork:reviewer' },
    ],
    forks: [
      { forkId: 'fork:builder', roomId: 'taskroom:demo', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:builder', actorName: 'builder', actorKind: 'team-agent', role: 'builder', forkKind: 'native-context-fork', runtime: 'opencode', runtimeEvidenceRefs: ['exporter:spawn:builder'], triggerHandoffId: 'handoff:builder', createdAt: now },
      { forkId: 'fork:reviewer', roomId: 'taskroom:demo', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:reviewer', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', forkKind: 'native-context-fork', runtime: 'opencode', runtimeEvidenceRefs: ['exporter:spawn:reviewer'], triggerHandoffId: 'handoff:reviewer', createdAt: now },
    ],
    handoffs: [
      { handoffId: 'handoff:builder', roomId: 'taskroom:demo', fromInstanceId: 'instance:parent', toInstanceId: 'instance:builder', handoffKind: 'assignment', artifactRefs: ['artifact:brief'], evidenceRefs: ['message:assignment:builder'], linkedForkId: 'fork:builder', createdAt: now },
      { handoffId: 'handoff:reviewer', roomId: 'taskroom:demo', fromInstanceId: 'instance:parent', toInstanceId: 'instance:reviewer', handoffKind: 'review-request', artifactRefs: ['artifact:patch:1'], evidenceRefs: ['message:review-request:1'], linkedForkId: 'fork:reviewer', createdAt: now },
      { handoffId: 'handoff:review-findings:1', roomId: 'taskroom:demo', fromInstanceId: 'instance:reviewer', toInstanceId: 'instance:builder', handoffKind: 'review-findings', artifactRefs: ['artifact:review:1'], evidenceRefs: ['message:review-findings:1'], linkedForkId: null, createdAt: now },
    ],
    wakes: [],
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeJsonl(path, values) {
  writeFileSync(path, values.map((value) => JSON.stringify(value)).join('\n') + (values.length > 0 ? '\n' : ''), 'utf8');
}

function writeObservedFixture(root, mutate = (payload) => payload) {
  mkdirSync(root, { recursive: true });
  const payload = mutate({ observedRoot: observedRoot(), forkHandoff: forkHandoff() });
  writeJson(join(root, 'observed-taskroom-root.json'), payload.observedRoot);
  writeJsonl(join(root, 'instances.jsonl'), payload.forkHandoff.instances);
  writeJsonl(join(root, 'forks.jsonl'), payload.forkHandoff.forks);
  writeJsonl(join(root, 'handoffs.jsonl'), payload.forkHandoff.handoffs);
  writeJsonl(join(root, 'wakes.jsonl'), payload.forkHandoff.wakes);
}

describe('run-evobuddy-realtime-fork-handoff-taskroom-live-eval CLI', () => {
  it('allow-retained-fixture produces blocked retained report', () => {
    const out = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-retained-'));
    try {
      const result = run(['--project', ROOT, '--runtime', 'opencode', '--out', out, '--allow-retained-fixture']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.proofScope, 'retained');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('passes when observed root contains release-grade fork/handoff records', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-observed-'));
    const observed = join(root, 'observed');
    const out = join(root, 'out');
    try {
      writeObservedFixture(observed);
      const result = run(['--project', ROOT, '--runtime', 'opencode', '--out', out, '--observed-taskroom-root', observed]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.forkObserved.status, 'pass');
      assert.equal(report.handoffObserved.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks observed roots with missing fork records or continuity', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-blocked-'));
    try {
      const noForks = join(root, 'no-forks');
      const noForksOut = join(root, 'no-forks-out');
      writeObservedFixture(noForks, (payload) => ({ ...payload, forkHandoff: { ...payload.forkHandoff, forks: [] } }));
      const noForksResult = run(['--project', ROOT, '--runtime', 'opencode', '--out', noForksOut, '--observed-taskroom-root', noForks]);
      assert.equal(noForksResult.status, 1, noForksResult.stderr || noForksResult.stdout);
      const noForksReport = JSON.parse(readFileSync(join(noForksOut, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
      assert.equal(noForksReport.forkObserved.status, 'fail');

      const noContinuity = join(root, 'no-continuity');
      const noContinuityOut = join(root, 'no-continuity-out');
      writeObservedFixture(noContinuity, (payload) => {
        payload.observedRoot.taskRoomLoop.rounds[1].priorReviewRefs = [];
        return payload;
      });
      const noContinuityResult = run(['--project', ROOT, '--runtime', 'opencode', '--out', noContinuityOut, '--observed-taskroom-root', noContinuity]);
      assert.equal(noContinuityResult.status, 1, noContinuityResult.stderr || noContinuityResult.stdout);
      const noContinuityReport = JSON.parse(readFileSync(join(noContinuityOut, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
      assert.equal(noContinuityReport.continuityObserved.status, 'fail');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
