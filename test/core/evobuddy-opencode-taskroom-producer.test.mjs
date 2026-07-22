import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { discoverTaskroomSessionIds, validateObservedTaskRoomRoot, produceOpenCodeTaskRoomObservedRoot, produceOpenCodeRealtimeForkHandoffTaskRoomProof } from '../../src/core/evobuddy-opencode-taskroom-producer.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const now = '2026-07-18T00:00:00.000Z';

function exportedTaskroomCorpus(overrides = {}) {
  const parentSessionId = overrides.parentSessionId ?? 'ses-parent';
  const builderSessionId = overrides.builderSessionId ?? 'ses-builder';
  const reviewerSessionId = overrides.reviewerSessionId ?? 'ses-reviewer';
  const evolutionSessionId = overrides.evolutionSessionId ?? 'ses-evolution';
  const parentPrompt = overrides.parentPrompt ?? 'Improve the registration flow and have the team review the result before returning it.';
  const reviewerRound2Text = overrides.reviewerRound2Text ?? 'Findings round 2 with prior review context';
  return {
    corpus: {
      sessions: [
        {
          sessionId: parentSessionId,
          observedAgentName: 'Sisyphus (Ultraworker)',
          isSubagent: false,
          parentSessionId: null,
          updatedAt: now,
          promptLineage: { kind: 'root-user-prompt', parentSessionId: null, receivedPromptText: parentPrompt },
          messages: [
            { role: 'user', messageId: 'msg-parent-user', text: parentPrompt },
            { role: 'assistant', messageId: 'msg-parent-final', text: 'Final result returned to parent' },
          ],
        },
        {
          sessionId: builderSessionId,
          observedAgentName: 'builder',
          isSubagent: true,
          parentSessionId,
          updatedAt: now,
          messages: [
            { role: 'assistant', messageId: 'msg-builder-1', text: 'Patch round 1' },
            { role: 'assistant', messageId: 'msg-builder-2', text: 'Patch round 2' },
          ],
        },
        {
          sessionId: reviewerSessionId,
          observedAgentName: 'reviewer',
          isSubagent: true,
          parentSessionId,
          updatedAt: now,
          messages: [
            { role: 'assistant', messageId: 'msg-reviewer-1', text: 'Findings round 1' },
            { role: 'assistant', messageId: 'msg-reviewer-2', text: reviewerRound2Text },
          ],
        },
        {
          sessionId: evolutionSessionId,
          observedAgentName: 'evolution-agent',
          isSubagent: true,
          parentSessionId,
          updatedAt: now,
          messages: [
            { role: 'assistant', messageId: 'msg-evolution-1', text: 'Propose SOP improvement' },
          ],
        },
      ].filter((session) => !overrides.omitAgents?.includes(session.observedAgentName)),
    },
    manifest: {
      source: { dbDigest: 'sha256:db' },
    },
  };
}

function mixedParentExportedTaskroomCorpus() {
  return {
    corpus: {
      sessions: [
        {
          sessionId: 'ses-parent-old',
          observedAgentName: 'build',
          isSubagent: false,
          parentSessionId: null,
          createdAt: '2026-07-17T00:00:00.000Z',
          updatedAt: '2026-07-17T00:00:00.000Z',
          promptLineage: { kind: 'root-user-prompt', parentSessionId: null, receivedPromptText: 'Use TeamAgent fork/handoff TaskRoom proof for this task.' },
          messages: [
            { role: 'user', messageId: 'msg-parent-old-user', text: 'Use TeamAgent fork/handoff TaskRoom proof for this task.' },
            { role: 'assistant', messageId: 'msg-parent-old-final', text: 'Old loop final result returned to parent' },
          ],
        },
        {
          sessionId: 'ses-builder-old',
          observedAgentName: 'builder',
          isSubagent: true,
          parentSessionId: 'ses-parent-old',
          createdAt: '2026-07-17T00:01:00.000Z',
          updatedAt: '2026-07-17T00:01:00.000Z',
          messages: [
            { role: 'assistant', messageId: 'msg-builder-old-1', text: 'Old patch round 1' },
            { role: 'assistant', messageId: 'msg-builder-old-2', text: 'Old patch round 2' },
          ],
        },
        {
          sessionId: 'ses-reviewer-old',
          observedAgentName: 'reviewer',
          isSubagent: true,
          parentSessionId: 'ses-parent-old',
          createdAt: '2026-07-17T00:02:00.000Z',
          updatedAt: '2026-07-17T00:02:00.000Z',
          messages: [
            { role: 'assistant', messageId: 'msg-reviewer-old-1', text: 'Old findings round 1' },
            { role: 'assistant', messageId: 'msg-reviewer-old-2', text: 'Old findings round 2 with prior review context' },
          ],
        },
        {
          sessionId: 'ses-evolution-old',
          observedAgentName: 'evolution-agent',
          isSubagent: true,
          parentSessionId: 'ses-parent-old',
          createdAt: '2026-07-17T00:03:00.000Z',
          updatedAt: '2026-07-17T00:03:00.000Z',
          messages: [
            { role: 'assistant', messageId: 'msg-evolution-old-1', text: 'Old SOP improvement' },
          ],
        },
        {
          sessionId: 'ses-oracle-old-later',
          observedAgentName: 'oracle',
          isSubagent: true,
          parentSessionId: 'ses-parent-old',
          createdAt: '2026-07-19T00:00:00.000Z',
          updatedAt: '2026-07-19T00:00:00.000Z',
          messages: [
            { role: 'assistant', messageId: 'msg-oracle-old-later', text: 'Later unrelated review activity' },
          ],
        },
        {
          sessionId: 'ses-parent-new',
          observedAgentName: 'Hephaestus (Deep Agent)',
          isSubagent: false,
          parentSessionId: null,
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:00.000Z',
          promptLineage: { kind: 'root-user-prompt', parentSessionId: null, receivedPromptText: 'Review the current realtime team design and make the smallest implementation or documentation correction needed to make the product path clearer.' },
          messages: [
            { role: 'user', messageId: 'msg-parent-new-user', text: 'Review the current realtime team design and make the smallest implementation or documentation correction needed to make the product path clearer.' },
            { role: 'assistant', messageId: 'msg-parent-new-final', text: 'New loop returned partial findings to the parent' },
          ],
        },
        {
          sessionId: 'ses-reviewer-new',
          observedAgentName: 'reviewer',
          isSubagent: true,
          parentSessionId: 'ses-parent-new',
          createdAt: '2026-07-18T00:02:00.000Z',
          updatedAt: '2026-07-18T00:02:00.000Z',
          messages: [
            { role: 'assistant', messageId: 'msg-reviewer-new-1', text: 'New findings round 1' },
            { role: 'assistant', messageId: 'msg-reviewer-new-2', text: 'New findings round 2 with prior review context' },
          ],
        },
      ],
    },
    manifest: {
      source: { dbDigest: 'sha256:db' },
    },
  };
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

test('accepts product-observed observed roots with closed loop and evolution evidence', () => {
  const result = validateObservedTaskRoomRoot(validObservedRoot());
  assert.equal(result.status, 'pass');
});

test('blocks handwritten or placeholder roots without exporter or session closure', () => {
  const placeholder = validObservedRoot();
  placeholder.taskRoomLoop.exporterRefs = [];
  const result = validateObservedTaskRoomRoot(placeholder);
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockedReasons.some((reason) => /exporterRefs|product-observed/i.test(reason)));
});

test('blocks producer when no observed taskroom root is available yet', async () => {
  const result = await produceOpenCodeTaskRoomObservedRoot({ projectRoot: process.cwd(), out: '/tmp/unused-taskroom-root' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.proofScope, 'product-observed');
  assert.ok(result.blockedReasons.some((reason) => /observed taskroom root|producer/i.test(reason)));
});

test('builds observed taskroom root from exported OpenCode team-agent sessions', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-producer-'));
  try {
    const result = await produceOpenCodeTaskRoomObservedRoot({
      projectRoot: REPO_ROOT,
      runtime: 'opencode',
      out,
      exportSessionCorpus: async () => ({
        corpus: {
          sessions: [
            {
              sessionId: 'ses-parent',
              observedAgentName: 'Sisyphus (Ultraworker)',
              isSubagent: false,
              parentSessionId: null,
              updatedAt: '2026-07-18T00:00:00.000Z',
              messages: [
                { role: 'assistant', messageId: 'msg-parent-1', text: 'Parent prompt' },
                { role: 'assistant', messageId: 'msg-parent-final', text: 'Final result returned to parent' },
              ],
            },
            {
              sessionId: 'ses-builder',
              observedAgentName: 'builder',
              isSubagent: true,
              parentSessionId: 'ses-parent',
              updatedAt: '2026-07-18T00:01:00.000Z',
              messages: [
                { role: 'assistant', messageId: 'msg-builder-1', text: 'Patch round 1' },
                { role: 'assistant', messageId: 'msg-builder-2', text: 'Patch round 2' },
              ],
            },
            {
              sessionId: 'ses-reviewer',
              observedAgentName: 'reviewer',
              isSubagent: true,
              parentSessionId: 'ses-parent',
              updatedAt: '2026-07-18T00:02:00.000Z',
              messages: [
                { role: 'assistant', messageId: 'msg-reviewer-1', text: 'Findings round 1' },
                { role: 'assistant', messageId: 'msg-reviewer-2', text: 'Findings round 2 with prior review context' },
              ],
            },
            {
              sessionId: 'ses-evolution',
              observedAgentName: 'evolution-agent',
              isSubagent: true,
              parentSessionId: 'ses-parent',
              updatedAt: '2026-07-18T00:03:00.000Z',
              messages: [
                { role: 'assistant', messageId: 'msg-evolution-1', text: 'Propose SOP improvement' },
              ],
            },
          ],
        },
        manifest: {
          source: {
            dbDigest: 'sha256:db',
          },
        },
      }),
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.source, 'exported-opencode-taskroom-root');
    const written = JSON.parse(readFileSync(join(out, 'observed-taskroom-root.json'), 'utf8'));
    assert.equal(written.taskRoomLoop.participants[0].runtimeSessionRef, 'opencode:session:ses-builder');
    assert.equal(written.taskRoomLoop.participants[1].runtimeSessionRef, 'opencode:session:ses-reviewer');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].actorName, 'builder');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].runtimeSessionRef, 'opencode:session:ses-builder');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].definitionDigest.startsWith('sha256:'), true);
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].projectedDigest.startsWith('sha256:'), true);
    assert.match(written.taskRoomLoop.surfaceCurrentAnchors[0].projectionRef, /\.opencode\/agents\/builder\.md$/);
    assert.equal(written.evolutionHandoff.agentName, 'evolution-agent');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('writes release-grade fork/handoff artifacts from native OpenCode session evidence', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-fork-handoff-'));
  try {
    const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'opencode',
      out,
      exportSessionCorpus: async () => exportedTaskroomCorpus(),
    });

    assert.equal(result.status, 'pass');
    assert.equal(existsSync(join(out, 'observed-taskroom-root.json')), true);
    assert.equal(existsSync(join(out, 'session-corpus-export-manifest.json')), true);
    assert.equal(existsSync(join(out, 'instances.jsonl')), true);
    assert.equal(existsSync(join(out, 'forks.jsonl')), true);
    assert.equal(existsSync(join(out, 'handoffs.jsonl')), true);
    assert.equal(existsSync(join(out, 'wakes.jsonl')), true);
    assert.equal(existsSync(join(out, 'artifacts', 'msg-builder-1.txt')), true);
    const proof = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
    assert.equal(proof.status, 'pass');
    assert.equal(proof.forkObserved.status, 'pass');
    assert.equal(proof.handoffObserved.status, 'pass');
    assert.deepEqual(proof.naturalInputNegativeControls, []);
    const forks = readFileSync(join(out, 'forks.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(forks.every((fork) => fork.forkKind === 'native-context-fork'), true);
    assert.equal(forks.every((fork) => fork.runtimeEvidenceRefs.every((ref) => ref.startsWith('exporter:spawn:'))), true);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('blocks release proof when builder and reviewer reuse the same observed session', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-same-session-'));
  try {
    const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'opencode',
      out,
      exportSessionCorpus: async () => exportedTaskroomCorpus({ reviewerSessionId: 'ses-builder' }),
    });

    assert.equal(result.status, 'blocked');
    assert.match(result.blockedReasons.join('\n'), /distinct observed TeamAgent participant sessions|same observed session/i);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('blocks release proof when required TeamAgent sessions are missing', async () => {
  const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
    projectRoot: REPO_ROOT,
    out: '/tmp/unused-realtime-fork-handoff-missing-agent',
    exportSessionCorpus: async () => exportedTaskroomCorpus({ omitAgents: ['reviewer'] }),
  });

  assert.equal(result.status, 'blocked');
  assert.match(result.blockedReasons.join('\n'), /missing required TeamAgent session\(s\): reviewer/i);
});

test('prefers a complete TeamAgent parent cohort over a newer incomplete parent', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-complete-cohort-'));
  try {
    // Older parent has builder+reviewer+evolution-agent; newer parent has only reviewer.
    // Prefer the complete cohort for product-observed proof instead of blocking on the incomplete fresher root.
    // Old parent natural input intentionally names mechanism terms, so the proof remains blocked on natural-input controls.
    const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      out,
      exportSessionCorpus: async () => mixedParentExportedTaskroomCorpus(),
    });

    assert.equal(result.status, 'blocked');
    assert.match(
      result.blockedReasons.join('\n'),
      /natural input names mechanism terms|missing required TeamAgent session\(s\)/i,
    );
    // Must not claim the incomplete newer parent won and only missed builder/evolution-agent
    // without first considering the complete older cohort path.
    if (/missing required TeamAgent session\(s\): builder, evolution-agent/i.test(result.blockedReasons.join('\n'))) {
      assert.fail('selected incomplete newer parent instead of complete older TeamAgent cohort');
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('blocks when every parent cohort is missing required TeamAgent sessions', async () => {
  const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
    projectRoot: REPO_ROOT,
    out: '/tmp/unused-realtime-fork-handoff-all-incomplete',
    exportSessionCorpus: async () => ({
      corpus: {
        sessions: [
          {
            sessionId: 'ses-parent-new',
            observedAgentName: 'build',
            isSubagent: false,
            parentSessionId: null,
            createdAt: '2026-07-18T00:00:00.000Z',
            updatedAt: '2026-07-18T00:00:00.000Z',
            promptLineage: { kind: 'root-user-prompt', parentSessionId: null, receivedPromptText: 'Clarify the product path without naming mechanisms.' },
            messages: [
              { role: 'user', messageId: 'msg-parent-new-user', text: 'Clarify the product path without naming mechanisms.' },
              { role: 'assistant', messageId: 'msg-parent-new-final', text: 'Partial findings returned' },
            ],
          },
          {
            sessionId: 'ses-reviewer-new',
            observedAgentName: 'reviewer',
            isSubagent: true,
            parentSessionId: 'ses-parent-new',
            createdAt: '2026-07-18T00:02:00.000Z',
            updatedAt: '2026-07-18T00:02:00.000Z',
            messages: [
              { role: 'assistant', messageId: 'msg-reviewer-new-1', text: 'Findings round 1' },
              { role: 'assistant', messageId: 'msg-reviewer-new-2', text: 'Findings round 2' },
            ],
          },
        ],
      },
      manifest: { source: { dbDigest: 'sha256:db' } },
    }),
  });

  assert.equal(result.status, 'blocked');
  assert.match(result.blockedReasons.join('\n'), /missing required TeamAgent session\(s\): builder, evolution-agent/i);
});

test('discovers the freshest parent even when it has no required TeamAgent children yet', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-opencode-discovery-'));
  const dbPath = join(root, 'opencode.db');
  try {
    execFileSync('sqlite3', [dbPath, `
      create table session (id text primary key, parent_id text, agent text, directory text, time_created integer);
      insert into session values ('ses-parent-old', null, 'Sisyphus (Ultraworker)', '${REPO_ROOT}', 1000);
      insert into session values ('ses-builder-old', 'ses-parent-old', 'builder', '${REPO_ROOT}', 1100);
      insert into session values ('ses-reviewer-old', 'ses-parent-old', 'reviewer', '${REPO_ROOT}', 1200);
      insert into session values ('ses-evolution-old', 'ses-parent-old', 'evolution-agent', '${REPO_ROOT}', 1300);
      insert into session values ('ses-parent-new', null, 'Sisyphus (Ultraworker)', '${REPO_ROOT}', 2000);
    `]);

    const discovered = await discoverTaskroomSessionIds({ dbPath, projectRoot: REPO_ROOT });

    assert.ok(discovered.sessionIds.includes('ses-parent-new'));
    assert.ok(discovered.sessionIds.includes('ses-parent-old'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('blocks release proof when fork or handoff records are missing', async () => {
  const noForks = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
    projectRoot: REPO_ROOT,
    out: '/tmp/unused-realtime-fork-handoff-no-forks',
    exportSessionCorpus: async () => exportedTaskroomCorpus(),
    buildForkHandoffRecords: () => ({ instances: [], forks: [], handoffs: [], wakes: [] }),
  });
  assert.equal(noForks.status, 'blocked');
  assert.match(noForks.blockedReasons.join('\n'), /ForkRecord closure|fork/i);

  const noHandoffs = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
    projectRoot: REPO_ROOT,
    out: '/tmp/unused-realtime-fork-handoff-no-handoffs',
    exportSessionCorpus: async () => exportedTaskroomCorpus(),
    buildForkHandoffRecords: ({ defaultRecords }) => ({ ...defaultRecords, handoffs: [] }),
  });
  assert.equal(noHandoffs.status, 'blocked');
  assert.match(noHandoffs.blockedReasons.join('\n'), /HandoffRecord closure|handoff/i);
});

test('blocks release proof when reviewer round 2 lacks prior-review continuity', async () => {
  const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
    projectRoot: REPO_ROOT,
    out: '/tmp/unused-realtime-fork-handoff-no-continuity',
    exportSessionCorpus: async () => exportedTaskroomCorpus(),
    includePriorReviewContinuity: false,
  });

  assert.equal(result.status, 'blocked');
  assert.match(result.blockedReasons.join('\n'), /round-2-missing-prior-review-ref|continuity/i);
});

test('blocks natural product proof when the user prompt names plan-forbidden mechanism terms', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-realtime-mechanism-input-'));
  try {
    const result = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      out,
      exportSessionCorpus: async () => exportedTaskroomCorpus({
        parentPrompt: 'Use TeamAgent fork/handoff TaskRoom proof, then spawn the builder and reviewer agent team for this task.',
      }),
    });

    assert.equal(result.status, 'blocked');
    assert.match(result.blockedReasons.join('\n'), /natural input names mechanism terms/i);
    const proof = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
    assert.equal(proof.status, 'blocked');
    assert.deepEqual(proof.naturalInputNegativeControls.map((entry) => entry.term), [
      'TeamAgent',
      'fork',
      'handoff',
      'TaskRoom',
      'builder',
      'reviewer',
      'spawn',
      'agent team',
    ]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
