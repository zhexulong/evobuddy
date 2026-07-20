import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { produceCodexRealtimeForkHandoffTaskRoomProof } from '../../src/core/evobuddy-codex-taskroom-producer.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function codexTaskroomExportFixture({ naturalUserText = 'Review the current design and make the smallest focused correction.' } = {}) {
  return {
    corpus: {
      source: 'codex-jsonl-session-corpus-export',
      projectIdentity: '/repo',
      sessions: [
        {
          sessionId: 'codex-parent',
          sessionRef: 'codex-thread:codex-parent',
          runtime: 'codex',
          isSubagent: false,
          updatedAt: '2026-07-18T00:00:00.000Z',
          messages: [
            { role: 'user', digest: 'sha256:parent-user-1', sourceRef: { path: '/tmp/rollout-parent.jsonl', line: 1 }, text: naturalUserText },
            { role: 'assistant', digest: 'sha256:parent-1', sourceRef: { path: '/tmp/rollout-parent.jsonl', line: 2 }, text: 'Parent coordinated builder and reviewer work and returned the result.' },
          ],
          nativeBuddy: {
            parentThreadRef: 'codex-thread:codex-parent',
            invocationCandidates: [
              {
                surface: 'spawn_agent',
                source: 'SubAgentSource::thread_spawn',
                forkMode: 'fork_turns:all',
                childThreadId: 'child-builder',
                childThreadRef: 'codex-thread:child-builder',
                memberName: 'builder',
                runtimeAgentName: 'builder',
                promptText: 'Implement the focused correction.',
                promptDigest: 'sha256:builder-prompt',
                evidenceRef: '/tmp/rollout-parent.jsonl:3:fc_builder',
              },
              {
                surface: 'spawn_agent',
                source: 'SubAgentSource::thread_spawn',
                forkMode: 'fork_turns:all',
                childThreadId: 'child-reviewer',
                childThreadRef: 'codex-thread:child-reviewer',
                memberName: 'reviewer',
                runtimeAgentName: 'reviewer',
                promptText: 'Review the focused correction.',
                promptDigest: 'sha256:reviewer-prompt',
                evidenceRef: '/tmp/rollout-parent.jsonl:4:fc_reviewer',
              },
              {
                surface: 'spawn_agent',
                source: 'SubAgentSource::thread_spawn',
                forkMode: 'fork_turns:all',
                childThreadId: 'child-evolution',
                childThreadRef: 'codex-thread:child-evolution',
                memberName: 'evolution-agent',
                runtimeAgentName: 'evolution_agent',
                promptText: 'Capture durable review-loop improvement.',
                promptDigest: 'sha256:evolution-prompt',
                evidenceRef: '/tmp/rollout-parent.jsonl:5:fc_evolution',
              },
            ],
            waitCompletionCandidates: [
              {
                surface: 'wait_agent',
                childThreadId: 'child-builder',
                memberName: 'builder',
                runtimeAgentName: 'builder',
                evidenceRef: '/tmp/rollout-parent.jsonl:6:fc_wait_builder',
                completionObserved: true,
              },
              {
                surface: 'wait_agent',
                childThreadId: 'child-reviewer',
                memberName: 'reviewer',
                runtimeAgentName: 'reviewer',
                evidenceRef: '/tmp/rollout-parent.jsonl:7:fc_wait_reviewer',
                completionObserved: true,
              },
              {
                surface: 'wait_agent',
                childThreadId: 'child-evolution',
                memberName: 'evolution-agent',
                runtimeAgentName: 'evolution_agent',
                evidenceRef: '/tmp/rollout-parent.jsonl:8:fc_wait_evolution',
                completionObserved: true,
              },
            ],
            childFinalAnswerCandidates: [
              {
                childThreadId: 'child-builder',
                memberName: 'builder',
                runtimeAgentName: 'builder',
                answerRef: '/tmp/rollout-parent.jsonl:6:call_builder',
                answerDigest: 'sha256:builder-answer-1',
              },
              {
                childThreadId: 'child-builder',
                memberName: 'builder',
                runtimeAgentName: 'builder',
                answerRef: '/tmp/rollout-parent.jsonl:9:call_builder_2',
                answerDigest: 'sha256:builder-answer-2',
              },
              {
                childThreadId: 'child-reviewer',
                memberName: 'reviewer',
                runtimeAgentName: 'reviewer',
                answerRef: '/tmp/rollout-parent.jsonl:7:call_reviewer',
                answerDigest: 'sha256:reviewer-answer-1',
              },
              {
                childThreadId: 'child-reviewer',
                memberName: 'reviewer',
                runtimeAgentName: 'reviewer',
                answerRef: '/tmp/rollout-parent.jsonl:10:call_reviewer_2',
                answerDigest: 'sha256:reviewer-answer-2',
              },
              {
                childThreadId: 'child-evolution',
                memberName: 'evolution-agent',
                runtimeAgentName: 'evolution_agent',
                answerRef: '/tmp/rollout-parent.jsonl:8:call_evolution',
                answerDigest: 'sha256:evolution-answer',
              },
            ],
            resultReturnCandidates: [
              {
                returnedToParent: true,
                memberName: 'builder',
                runtimeAgentName: 'builder',
                childThreadId: 'child-builder',
                resultRef: '/tmp/rollout-parent.jsonl:9:call_builder_2',
                resultDigest: 'sha256:builder-answer-2',
              },
              {
                returnedToParent: true,
                memberName: 'reviewer',
                runtimeAgentName: 'reviewer',
                childThreadId: 'child-reviewer',
                resultRef: '/tmp/rollout-parent.jsonl:10:call_reviewer_2',
                resultDigest: 'sha256:reviewer-answer-2',
              },
              {
                returnedToParent: true,
                memberName: 'evolution-agent',
                runtimeAgentName: 'evolution_agent',
                childThreadId: 'child-evolution',
                resultRef: '/tmp/rollout-parent.jsonl:8:call_evolution',
                resultDigest: 'sha256:evolution-answer',
              },
            ],
            resultReturn: {
              returnedToParent: true,
              memberName: 'reviewer',
              runtimeAgentName: 'reviewer',
              childThreadId: 'child-reviewer',
              resultRef: '/tmp/rollout-parent.jsonl:10:call_reviewer_2',
              resultDigest: 'sha256:reviewer-answer-2',
            },
          },
        },
      ],
    },
    manifest: {
      digest: 'sha256:codex-manifest',
      source: {
        kind: 'codex-jsonl',
        codexHome: '/tmp/codex-home',
      },
    },
  };
}

test('blocks Codex producer when no codexHome is available for fresh evidence export', async () => {
  const result = await produceCodexRealtimeForkHandoffTaskRoomProof({
    projectRoot: process.cwd(),
    out: '/tmp/unused-codex-taskroom-root',
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.proofScope, 'product-observed');
  assert.ok(result.blockedReasons.some((reason) => /codexHome|Codex home/i.test(reason)));
});

test('writes Codex realtime fork/handoff release proof artifacts from parent spawn/wait evidence', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-codex-fork-handoff-'));
  try {
    const result = await produceCodexRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'codex',
      out,
      codexHome: '/tmp/codex-home',
      exportSessionCorpus: async () => codexTaskroomExportFixture(),
    });

    assert.equal(result.status, 'pass', JSON.stringify(result.blockedReasons ?? result.issues ?? result));
    assert.equal(result.source, 'exported-codex-fork-handoff-proof');
    const proof = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
    assert.equal(proof.status, 'pass');
    assert.equal(proof.proofScope, 'product-observed');
    assert.equal(proof.forkObserved.status, 'pass');
    assert.equal(proof.handoffObserved.status, 'pass');
    assert.equal(proof.continuityObserved.status, 'pass');
    assert.equal(proof.resultReturn.status, 'pass');
    assert.equal(proof.evolutionHandoff.status, 'pass');
    assert.deepEqual(proof.naturalInputNegativeControls, []);

    const observed = JSON.parse(readFileSync(join(out, 'observed-taskroom-root.json'), 'utf8'));
    assert.equal(observed.runtime, 'codex');
    assert.equal(observed.taskRoomLoop.resultReturn.observedParentThreadRef, 'codex-thread:codex-parent');
    assert.equal(observed.taskRoomLoop.exporterRefs[0].sourceKind, 'codex-jsonl-session-corpus-exporter');

    const forks = readFileSync(join(out, 'forks.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const handoffs = readFileSync(join(out, 'handoffs.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const instances = readFileSync(join(out, 'instances.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(instances.length, 4);
    assert.equal(forks.length, 3);
    assert.ok(forks.every((fork) => fork.runtime === 'codex'));
    assert.ok(forks.every((fork) => fork.forkKind === 'native-context-fork'));
    assert.ok(handoffs.length >= 3);
    assert.equal(JSON.parse(readFileSync(join(out, 'session-corpus-export-manifest.json'), 'utf8')).digest, 'sha256:codex-manifest');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('blocks Codex realtime fork/handoff proof when natural input names mechanism terms', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-codex-fork-handoff-mech-'));
  try {
    const result = await produceCodexRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'codex',
      out,
      codexHome: '/tmp/codex-home',
      exportSessionCorpus: async () => codexTaskroomExportFixture({
        naturalUserText: 'Please open a TaskRoom and fork a builder/reviewer agent team.',
      }),
    });
    assert.equal(result.status, 'blocked');
    assert.ok(result.blockedReasons.some((reason) => /mechanism terms|natural input/i.test(reason)));
    const proof = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
    assert.equal(proof.status, 'blocked');
    assert.ok(Array.isArray(proof.naturalInputNegativeControls));
    assert.ok(proof.naturalInputNegativeControls.length > 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('blocks Codex realtime fork/handoff proof when required TeamAgent spawn evidence is missing', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-codex-fork-handoff-missing-'));
  try {
    const fixture = codexTaskroomExportFixture();
    fixture.corpus.sessions[0].nativeBuddy.invocationCandidates = fixture.corpus.sessions[0].nativeBuddy.invocationCandidates
      .filter((candidate) => candidate.memberName !== 'evolution-agent');
    const result = await produceCodexRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'codex',
      out,
      codexHome: '/tmp/codex-home',
      exportSessionCorpus: async () => fixture,
    });
    assert.equal(result.status, 'blocked');
    assert.ok(result.blockedReasons.some((reason) => /evolution-agent/i.test(reason)));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
