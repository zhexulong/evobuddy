import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { produceClaudeRealtimeForkHandoffTaskRoomProof, produceClaudeTaskRoomObservedRoot } from '../../src/core/evobuddy-claude-taskroom-producer.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function claudeTaskroomExportFixture() {
  return {
    corpus: {
      source: 'claude-code-jsonl-session-corpus-export',
      projectIdentity: '/repo',
      sessions: [
        {
          sessionId: 'claude-parent',
          sessionRef: 'claude-session:claude-parent',
          runtime: 'claude-code',
          isSubagent: false,
          updatedAt: '2026-07-18T00:00:00.000Z',
          messages: [
            { role: 'user', digest: 'sha256:parent-user-1', sourceRef: { path: '/tmp/root.jsonl', line: 0 }, text: 'Review the current design and make the smallest focused correction.' },
            { role: 'assistant', digest: 'sha256:parent-1', sourceRef: { path: '/tmp/root.jsonl', line: 1 }, text: 'Parent taskroom setup' },
            { role: 'assistant', digest: 'sha256:parent-2', sourceRef: { path: '/tmp/root.jsonl', line: 2 }, text: 'Builder and reviewer results returned to parent' },
          ],
          nativeBuddy: {
            parentSessionRef: 'claude-session:claude-parent',
            resultReturn: {
              returnedToParent: true,
              resultRef: 'claude-session:claude-parent:result',
              resultDigest: 'sha256:result-return',
            },
          },
        },
        {
          sessionId: 'claude-builder',
          sessionRef: 'claude-session:claude-builder',
          runtime: 'claude-code',
          isSubagent: true,
          parentSessionId: 'claude-parent',
          updatedAt: '2026-07-18T00:01:00.000Z',
          nativeBuddy: {
            memberName: 'builder',
            parentSessionRef: 'claude-session:claude-parent',
          },
          messages: [
            { role: 'assistant', messageId: 'msg-builder-1', digest: 'sha256:builder-1', sourceRef: { path: '/tmp/subagents/builder.jsonl', line: 1 }, text: 'Patch round 1' },
            { role: 'assistant', messageId: 'msg-builder-2', digest: 'sha256:builder-2', sourceRef: { path: '/tmp/subagents/builder.jsonl', line: 2 }, text: 'Patch round 2' },
          ],
        },
        {
          sessionId: 'claude-reviewer',
          sessionRef: 'claude-session:claude-reviewer',
          runtime: 'claude-code',
          isSubagent: true,
          parentSessionId: 'claude-parent',
          updatedAt: '2026-07-18T00:02:00.000Z',
          nativeBuddy: {
            memberName: 'reviewer',
            parentSessionRef: 'claude-session:claude-parent',
          },
          messages: [
            { role: 'assistant', messageId: 'msg-reviewer-1', digest: 'sha256:reviewer-1', sourceRef: { path: '/tmp/subagents/reviewer.jsonl', line: 1 }, text: 'Findings round 1' },
            { role: 'assistant', messageId: 'msg-reviewer-2', digest: 'sha256:reviewer-2', sourceRef: { path: '/tmp/subagents/reviewer.jsonl', line: 2 }, text: 'Findings round 2 with prior review context' },
          ],
        },
        {
          sessionId: 'claude-evolution',
          sessionRef: 'claude-session:claude-evolution',
          runtime: 'claude-code',
          isSubagent: true,
          parentSessionId: 'claude-parent',
          updatedAt: '2026-07-18T00:03:00.000Z',
          nativeBuddy: {
            memberName: 'evolution-agent',
            parentSessionRef: 'claude-session:claude-parent',
          },
          messages: [
            { role: 'assistant', messageId: 'msg-evolution-1', digest: 'sha256:evolution-1', sourceRef: { path: '/tmp/subagents/evolution-agent.jsonl', line: 1 }, text: 'Propose SOP improvement' },
          ],
        },
      ],
    },
    manifest: {
      digest: 'sha256:claude-manifest',
      source: {
        kind: 'claude-code-jsonl',
        claudeProjectDir: '/tmp/claude-project',
      },
    },
  };
}

test('blocks Claude producer when no claudeProjectDir is available for fresh evidence export', async () => {
  const result = await produceClaudeTaskRoomObservedRoot({ projectRoot: process.cwd(), out: '/tmp/unused-claude-taskroom-root' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.proofScope, 'product-observed');
  assert.ok(result.blockedReasons.some((reason) => /claudeProjectDir|Claude project directory/i.test(reason)));
});

test('builds observed taskroom root from exported Claude taskroom sessions', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-taskroom-producer-'));
  try {
    const result = await produceClaudeTaskRoomObservedRoot({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => claudeTaskroomExportFixture(),
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.source, 'exported-claude-taskroom-root');
    const written = JSON.parse(readFileSync(join(out, 'observed-taskroom-root.json'), 'utf8'));
    assert.equal(written.runtime, 'claude');
    assert.equal(written.taskRoomLoop.participants[0].runtimeSessionRef, 'claude-session:claude-builder');
    assert.equal(written.taskRoomLoop.participants[1].runtimeSessionRef, 'claude-session:claude-reviewer');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].actorName, 'builder');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].runtimeSessionRef, 'claude-session:claude-builder');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].definitionDigest.startsWith('sha256:'), true);
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].projectedDigest.startsWith('sha256:'), true);
    assert.match(written.taskRoomLoop.surfaceCurrentAnchors[0].projectionRef, /\.claude\/agents\/builder\.md$/);
    assert.equal(written.taskRoomLoop.exporterRefs[0].sourceKind, 'claude-code-session-corpus-exporter');
    assert.equal(written.taskRoomLoop.resultReturn.observedParentThreadRef, 'claude-session:claude-parent');
    assert.equal(written.evolutionHandoff.agentName, 'evolution-agent');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('writes Claude realtime fork/handoff release proof artifacts from exported sessions', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-fork-handoff-'));
  try {
    const result = await produceClaudeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => claudeTaskroomExportFixture(),
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.source, 'exported-claude-fork-handoff-proof');
    const proof = JSON.parse(readFileSync(join(out, 'evobuddy-fork-handoff-release-proof.json'), 'utf8'));
    assert.equal(proof.status, 'pass');
    assert.equal(proof.proofScope, 'product-observed');
    assert.equal(proof.forkObserved.status, 'pass');
    assert.equal(proof.handoffObserved.status, 'pass');
    assert.equal(proof.continuityObserved.status, 'pass');
    assert.equal(proof.resultReturn.status, 'pass');
    assert.equal(proof.evolutionHandoff.status, 'pass');
    assert.deepEqual(proof.naturalInputNegativeControls, []);

    const forks = readFileSync(join(out, 'forks.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const handoffs = readFileSync(join(out, 'handoffs.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const instances = readFileSync(join(out, 'instances.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(instances.length, 4);
    assert.equal(forks.length, 3);
    assert.ok(forks.every((fork) => fork.runtime === 'claude'));
    assert.ok(forks.every((fork) => fork.forkKind === 'native-context-fork'));
    assert.ok(handoffs.length >= 3);
    assert.equal(JSON.parse(readFileSync(join(out, 'session-corpus-export-manifest.json'), 'utf8')).digest, 'sha256:claude-manifest');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('prefers a complete older Claude parent cohort over a newer incomplete parent', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-fork-handoff-cohort-'));
  try {
    const base = claudeTaskroomExportFixture();
    // Older complete parent cohort.
    const oldParent = structuredClone(base.corpus.sessions[0]);
    oldParent.sessionId = 'claude-parent-old';
    oldParent.sessionRef = 'claude-session:claude-parent-old';
    oldParent.updatedAt = '2026-07-17T00:00:00.000Z';
    oldParent.createdAt = '2026-07-17T00:00:00.000Z';
    oldParent.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-old';
    oldParent.nativeBuddy.resultReturn.resultRef = 'claude-session:claude-parent-old:result';
    const oldBuilder = structuredClone(base.corpus.sessions[1]);
    oldBuilder.sessionId = 'claude-builder-old';
    oldBuilder.sessionRef = 'claude-session:claude-builder-old';
    oldBuilder.parentSessionId = 'claude-parent-old';
    oldBuilder.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-old';
    oldBuilder.updatedAt = '2026-07-17T00:01:00.000Z';
    const oldReviewer = structuredClone(base.corpus.sessions[2]);
    oldReviewer.sessionId = 'claude-reviewer-old';
    oldReviewer.sessionRef = 'claude-session:claude-reviewer-old';
    oldReviewer.parentSessionId = 'claude-parent-old';
    oldReviewer.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-old';
    oldReviewer.updatedAt = '2026-07-17T00:02:00.000Z';
    const oldEvolution = structuredClone(base.corpus.sessions[3]);
    oldEvolution.sessionId = 'claude-evolution-old';
    oldEvolution.sessionRef = 'claude-session:claude-evolution-old';
    oldEvolution.parentSessionId = 'claude-parent-old';
    oldEvolution.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-old';
    oldEvolution.updatedAt = '2026-07-17T00:03:00.000Z';

    // Newer incomplete parent: only builder, no reviewer/evolution.
    const newParent = structuredClone(base.corpus.sessions[0]);
    newParent.sessionId = 'claude-parent-new';
    newParent.sessionRef = 'claude-session:claude-parent-new';
    newParent.updatedAt = '2026-07-19T00:00:00.000Z';
    newParent.createdAt = '2026-07-19T00:00:00.000Z';
    newParent.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-new';
    newParent.nativeBuddy.resultReturn.resultRef = 'claude-session:claude-parent-new:result';
    const newBuilder = structuredClone(base.corpus.sessions[1]);
    newBuilder.sessionId = 'claude-builder-new';
    newBuilder.sessionRef = 'claude-session:claude-builder-new';
    newBuilder.parentSessionId = 'claude-parent-new';
    newBuilder.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-new';
    newBuilder.updatedAt = '2026-07-19T00:01:00.000Z';

    const result = await produceClaudeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => ({
        corpus: {
          source: 'claude-code-jsonl-session-corpus-export',
          projectIdentity: '/repo',
          sessions: [oldParent, oldBuilder, oldReviewer, oldEvolution, newParent, newBuilder],
        },
        manifest: base.manifest,
      }),
    });

    assert.equal(result.status, 'pass', JSON.stringify(result.blockedReasons ?? result.issues));
    const instances = readFileSync(join(out, 'instances.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.ok(instances.some((instance) => instance.runtimeSessionRef === 'claude-session:claude-builder-old'));
    assert.ok(!instances.some((instance) => instance.runtimeSessionRef === 'claude-session:claude-builder-new'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('does not let a newer Buddy-only Claude parent hide an older incomplete TeamAgent cohort diagnosis', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-fork-handoff-buddy-only-'));
  try {
    const base = claudeTaskroomExportFixture();
    // Older parent has builder + reviewer only.
    const teamParent = structuredClone(base.corpus.sessions[0]);
    teamParent.sessionId = 'claude-parent-team';
    teamParent.sessionRef = 'claude-session:claude-parent-team';
    teamParent.updatedAt = '2026-07-18T00:00:00.000Z';
    teamParent.createdAt = '2026-07-18T00:00:00.000Z';
    teamParent.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-team';
    const builder = structuredClone(base.corpus.sessions[1]);
    builder.sessionId = 'claude-builder-team';
    builder.sessionRef = 'claude-session:claude-builder-team';
    builder.parentSessionId = 'claude-parent-team';
    builder.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-team';
    const reviewer = structuredClone(base.corpus.sessions[2]);
    reviewer.sessionId = 'claude-reviewer-team';
    reviewer.sessionRef = 'claude-session:claude-reviewer-team';
    reviewer.parentSessionId = 'claude-parent-team';
    reviewer.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-team';

    // Newer parent only has explore Buddy helper.
    const buddyParent = structuredClone(base.corpus.sessions[0]);
    buddyParent.sessionId = 'claude-parent-buddy';
    buddyParent.sessionRef = 'claude-session:claude-parent-buddy';
    buddyParent.updatedAt = '2026-07-19T00:00:00.000Z';
    buddyParent.createdAt = '2026-07-19T00:00:00.000Z';
    buddyParent.nativeBuddy.parentSessionRef = 'claude-session:claude-parent-buddy';
    const explore = structuredClone(base.corpus.sessions[1]);
    explore.sessionId = 'claude-explore';
    explore.sessionRef = 'claude-session:claude-explore';
    explore.parentSessionId = 'claude-parent-buddy';
    explore.nativeBuddy = {
      memberName: 'explore',
      parentSessionRef: 'claude-session:claude-parent-buddy',
    };

    const result = await produceClaudeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => ({
        corpus: {
          source: 'claude-code-jsonl-session-corpus-export',
          projectIdentity: '/repo',
          sessions: [teamParent, builder, reviewer, buddyParent, explore],
        },
        manifest: base.manifest,
      }),
    });

    assert.equal(result.status, 'blocked');
    // Diagnosis must be about the TeamAgent cohort, not the newer Buddy-only parent.
    assert.ok(
      result.blockedReasons.some((reason) => /missing required TeamAgent session\(s\): evolution-agent/i.test(reason)),
      JSON.stringify(result.blockedReasons),
    );
    assert.equal(result.selectedParentSessionId, 'claude-parent-team');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('prefers multi-round Claude TeamAgent sessions over later one-shot revision sessions', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-fork-handoff-multiturn-'));
  try {
    const base = claudeTaskroomExportFixture();
    const parent = structuredClone(base.corpus.sessions[0]);
    // Multi-turn builder/reviewer (2 assistant messages each).
    const multiBuilder = structuredClone(base.corpus.sessions[1]);
    multiBuilder.sessionId = 'claude-builder-multi';
    multiBuilder.sessionRef = 'claude-session:claude-builder-multi';
    multiBuilder.updatedAt = '2026-07-18T00:01:00.000Z';
    multiBuilder.messages = [
      { role: 'assistant', messageId: 'mb1', digest: 'sha256:mb1', text: 'Patch round 1' },
      { role: 'assistant', messageId: 'mb2', digest: 'sha256:mb2', text: 'Patch round 2' },
    ];
    const multiReviewer = structuredClone(base.corpus.sessions[2]);
    multiReviewer.sessionId = 'claude-reviewer-multi';
    multiReviewer.sessionRef = 'claude-session:claude-reviewer-multi';
    multiReviewer.updatedAt = '2026-07-18T00:02:00.000Z';
    multiReviewer.messages = [
      { role: 'assistant', messageId: 'mr1', digest: 'sha256:mr1', text: 'Findings round 1' },
      { role: 'assistant', messageId: 'mr2', digest: 'sha256:mr2', text: 'Findings round 2' },
    ];
    // Later one-shot revision sessions with only one assistant answer each.
    const oneShotBuilder = structuredClone(base.corpus.sessions[1]);
    oneShotBuilder.sessionId = 'claude-builder-oneshot';
    oneShotBuilder.sessionRef = 'claude-session:claude-builder-oneshot';
    oneShotBuilder.updatedAt = '2026-07-18T00:05:00.000Z';
    oneShotBuilder.messages = [
      { role: 'assistant', messageId: 'ob1', digest: 'sha256:ob1', text: 'One-shot revision only' },
    ];
    const oneShotReviewer = structuredClone(base.corpus.sessions[2]);
    oneShotReviewer.sessionId = 'claude-reviewer-oneshot';
    oneShotReviewer.sessionRef = 'claude-session:claude-reviewer-oneshot';
    oneShotReviewer.updatedAt = '2026-07-18T00:06:00.000Z';
    oneShotReviewer.messages = [
      { role: 'assistant', messageId: 'or1', digest: 'sha256:or1', text: 'One-shot review only' },
    ];
    const evolution = structuredClone(base.corpus.sessions[3]);

    const result = await produceClaudeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => ({
        corpus: {
          source: 'claude-code-jsonl-session-corpus-export',
          projectIdentity: '/repo',
          sessions: [parent, multiBuilder, multiReviewer, oneShotBuilder, oneShotReviewer, evolution],
        },
        manifest: base.manifest,
      }),
    });

    assert.equal(result.status, 'pass', JSON.stringify(result.blockedReasons ?? result.issues));
    const instances = readFileSync(join(out, 'instances.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.ok(instances.some((instance) => instance.runtimeSessionRef === 'claude-session:claude-builder-multi'));
    assert.ok(instances.some((instance) => instance.runtimeSessionRef === 'claude-session:claude-reviewer-multi'));
    assert.ok(!instances.some((instance) => instance.runtimeSessionRef === 'claude-session:claude-builder-oneshot'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('blocks Claude realtime fork/handoff proof when natural input names mechanism terms', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-fork-handoff-mech-'));
  try {
    const fixture = claudeTaskroomExportFixture();
    fixture.corpus.sessions[0].messages[0].text = 'Please open a TaskRoom and fork a builder/reviewer agent team.';
    const result = await produceClaudeRealtimeForkHandoffTaskRoomProof({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => fixture,
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
