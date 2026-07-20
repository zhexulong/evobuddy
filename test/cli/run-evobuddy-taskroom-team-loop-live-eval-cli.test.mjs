import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-evobuddy-taskroom-team-loop-live-eval.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
}

function validObservedRoot() {
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
        { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer', reviewerFindingDigest: 'sha256:review-1', reviewerTranscriptRef: 'opencode:reviewer:round:1' },
        { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'], priorReviewDigests: ['sha256:review-1'], reviewerFindingDigest: 'sha256:review-2', reviewerTranscriptRef: 'opencode:reviewer:round:2' },
      ],
      handoffs: [{ from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:1' }, { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'msg:2' }],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'msg:final', observedParentThreadRef: 'opencode:parent:thread', digest: 'sha256:final' },
      exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' },
  };
}

describe('run-evobuddy-taskroom-team-loop-live-eval CLI', () => {
  it('allow-retained-fixture produces blocked retained report', () => {
    const out = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-retained-'));
    try {
      const result = run(['--project', ROOT, '--runtime', 'opencode', '--out', out, '--allow-retained-fixture']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-taskroom-team-loop-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.proofScope, 'retained');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('passes when observed root contains closed product-observed proof', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-observed-'));
    const observedRoot = join(root, 'observed');
    const out = join(root, 'out');
    try {
      mkdirSync(observedRoot, { recursive: true });
      writeFileSync(join(observedRoot, 'observed-taskroom-root.json'), `${JSON.stringify(validObservedRoot(), null, 2)}\n`, 'utf8');
      const result = run(['--project', ROOT, '--runtime', 'opencode', '--out', out, '--observed-taskroom-root', observedRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-taskroom-team-loop-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.proofScope, 'product-observed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports the Claude runtime when a Claude observed root is provided', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-claude-observed-'));
    const observedRoot = join(root, 'observed');
    const out = join(root, 'out');
    try {
      mkdirSync(observedRoot, { recursive: true });
      const claudeObservedRoot = {
        ...validObservedRoot(),
        runtime: 'claude',
        taskRoomLoop: {
          ...validObservedRoot().taskRoomLoop,
          participants: [
            { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'claude-session:builder' },
            { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'claude-session:reviewer' },
          ],
          rounds: [
            { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'claude-session:reviewer', reviewerFindingDigest: 'sha256:review-1', reviewerTranscriptRef: 'claude-session:reviewer:1' },
            { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'claude-session:reviewer', priorReviewRefs: ['artifact:review:1'], priorReviewDigests: ['sha256:review-1'], reviewerFindingDigest: 'sha256:review-2', reviewerTranscriptRef: 'claude-session:reviewer:2' },
          ],
          resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'claude-session:parent:result', observedParentThreadRef: 'claude-session:parent', digest: 'sha256:final' },
          exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'claude-code-session-corpus-exporter', dbDigest: 'sha256:manifest', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['claude-session:builder', 'claude-session:reviewer'] }],
        },
      };
      writeFileSync(join(observedRoot, 'observed-taskroom-root.json'), `${JSON.stringify(claudeObservedRoot, null, 2)}\n`, 'utf8');
      const result = run(['--project', ROOT, '--runtime', 'claude', '--out', out, '--observed-taskroom-root', observedRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-taskroom-team-loop-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.runtime, 'claude');
      assert.equal(report.proofScope, 'product-observed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts --claude-project-dir for fresh Claude evidence runs', () => {
    const out = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-claude-cli-'));
    try {
      const result = run(['--project', ROOT, '--runtime', 'claude', '--out', out, '--claude-project-dir', '/tmp/missing-claude-project']);
      assert.notEqual(result.status, 1, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-taskroom-team-loop-report.json'), 'utf8'));
      assert.equal(report.runtime, 'claude');
      assert.equal(report.status, 'blocked');
      assert.ok(report.blockedReasons.some((reason) => /Claude project directory|No Claude JSONL|claudeProjectDir/i.test(reason)));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('blocks handwritten observed root without exporter/session closure', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-handwritten-'));
    const observedRoot = join(root, 'observed');
    const out = join(root, 'out');
    try {
      mkdirSync(observedRoot, { recursive: true });
      const broken = validObservedRoot();
      broken.taskRoomLoop.exporterRefs = [];
      writeFileSync(join(observedRoot, 'observed-taskroom-root.json'), `${JSON.stringify(broken, null, 2)}\n`, 'utf8');
      const result = run(['--project', ROOT, '--runtime', 'opencode', '--out', out, '--observed-taskroom-root', observedRoot]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-taskroom-team-loop-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.proofScope, 'product-observed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
