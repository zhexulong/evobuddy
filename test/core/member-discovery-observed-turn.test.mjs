import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createObservedParentAgentTurn,
  sha256Text,
  validateObservedParentAgentTurn,
} from '../../src/core/member-discovery-observed-turn.mjs';

describe('member discovery observed parent-agent turns', () => {
  it('binds phase, request bytes, answer bytes, and digest', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-'));
    try {
      writeFileSync(join(root, 'member-discovery-gate-request.json'), '{"packetKind":"member-discovery-gate-request"}\n');
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), 'y: 1, 2\n');
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'y: 1, 2\n';
      const turn = createObservedParentAgentTurn({
        phase: 'gate',
        requestRef: 'member-discovery-gate-request.json',
        requestText,
        answerRef: 'member-need-gate-raw-output.txt',
        answerText,
        projectIdentity: '/repo/product-discovery',
        source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
        observedAt: '2026-07-11T00:00:00.000Z',
      });
      assert.equal(turn.kind, 'observed-parent-agent-turn');
      assert.equal(turn.phase, 'gate');
      assert.equal(turn.requestDigest, sha256Text(requestText));
      assert.equal(turn.answerDigest, sha256Text(answerText));
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);

      const validation = await validateObservedParentAgentTurn({
        root,
        turnRef: 'observed-parent-gate-turn.json',
        expectedPhase: 'gate',
        expectedRequestRef: 'member-discovery-gate-request.json',
        expectedAnswerRef: 'member-need-gate-raw-output.txt',
        expectedProjectIdentity: '/repo/product-discovery',
      });
      assert.equal(validation.status, 'pass');
      assert.match(validation.digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when answer bytes drift after observation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-drift-'));
    try {
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'n\n';
      writeFileSync(join(root, 'member-discovery-gate-request.json'), requestText);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), answerText);
      const turn = createObservedParentAgentTurn({ phase: 'gate', requestRef: 'member-discovery-gate-request.json', requestText, answerRef: 'member-need-gate-raw-output.txt', answerText, projectIdentity: '/repo/product-discovery', source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), 'y: 1\n');

      const validation = await validateObservedParentAgentTurn({ root, turnRef: 'observed-parent-gate-turn.json', expectedPhase: 'gate', expectedRequestRef: 'member-discovery-gate-request.json', expectedAnswerRef: 'member-need-gate-raw-output.txt', expectedProjectIdentity: '/repo/product-discovery' });
      assert.equal(validation.status, 'fail');
      assert.match(validation.reason, /answerDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects artifact-only observed turns without runtime provenance', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-artifact-only-'));
    try {
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'n\n';
      writeFileSync(join(root, 'member-discovery-gate-request.json'), requestText);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), answerText);
      const turn = createObservedParentAgentTurn({ phase: 'gate', requestRef: 'member-discovery-gate-request.json', requestText, answerRef: 'member-need-gate-raw-output.txt', answerText, source: { runtime: 'opencode', captureKind: 'parent-agent-turn-artifact' }, observedAt: '2026-07-11T00:00:00.000Z' });
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);
      const validation = await validateObservedParentAgentTurn({ root, turnRef: 'observed-parent-gate-turn.json', expectedPhase: 'gate', expectedRequestRef: 'member-discovery-gate-request.json', expectedAnswerRef: 'member-need-gate-raw-output.txt', expectedProjectIdentity: '/repo/product-discovery' });
      assert.equal(validation.status, 'fail');
      assert.match(validation.reason, /runtime|provenance|capture/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects observed turns whose runtime source is not bound to the expected DB/exporter evidence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-exporter-binding-'));
    try {
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'n\n';
      writeFileSync(join(root, 'member-discovery-gate-request.json'), requestText);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), answerText);
      const turn = createObservedParentAgentTurn({
        phase: 'gate',
        requestRef: 'member-discovery-gate-request.json',
        requestText,
        answerRef: 'member-need-gate-raw-output.txt',
        answerText,
        projectIdentity: '/repo/product-discovery',
        source: {
          runtime: 'opencode',
          captureKind: 'runtime-observer-export',
          sourceThreadId: 'ses_product_gate',
          parentTurnId: 'msg_product_gate',
          sessionPartId: 'prt_product_gate',
          sessionExportRef: './session-corpus-export.json',
          observedProjectIdentity: '/repo/product-discovery',
        },
        observedAt: '2026-07-11T00:00:00.000Z',
      });
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);

      const validation = await validateObservedParentAgentTurn({
        root,
        turnRef: 'observed-parent-gate-turn.json',
        expectedPhase: 'gate',
        expectedRequestRef: 'member-discovery-gate-request.json',
        expectedAnswerRef: 'member-need-gate-raw-output.txt',
        expectedProjectIdentity: '/repo/product-discovery',
        expectedSessionExportRef: '/tmp/opencode.db',
      });
      assert.equal(validation.status, 'fail');
      assert.match(validation.reason, /sessionExportRef|exporter|DB/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects observed turn refs that escape the artifact root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-traversal-'));
    try {
      const outsideRoot = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-outside-'));
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'n\n';
      writeFileSync(join(root, 'member-discovery-gate-request.json'), requestText);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), answerText);
      const turn = createObservedParentAgentTurn({ phase: 'gate', requestRef: 'member-discovery-gate-request.json', requestText, answerRef: 'member-need-gate-raw-output.txt', answerText, projectIdentity: '/repo/product-discovery', source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      writeFileSync(join(outsideRoot, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);

      const outsideTurn = await validateObservedParentAgentTurn({ root, turnRef: join(outsideRoot, 'observed-parent-gate-turn.json'), expectedPhase: 'gate', expectedRequestRef: 'member-discovery-gate-request.json', expectedAnswerRef: 'member-need-gate-raw-output.txt', expectedProjectIdentity: '/repo/product-discovery' });
      assert.equal(outsideTurn.status, 'fail');
      assert.match(outsideTurn.reason, /under root|relative/i);

      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify({ ...turn, answerRef: '../outside-answer.txt' }, null, 2)}\n`);
      const escapedAnswer = await validateObservedParentAgentTurn({ root, turnRef: 'observed-parent-gate-turn.json', expectedPhase: 'gate', expectedRequestRef: 'member-discovery-gate-request.json', expectedAnswerRef: '../outside-answer.txt', expectedProjectIdentity: '/repo/product-discovery' });
      assert.equal(escapedAnswer.status, 'fail');
      assert.match(escapedAnswer.reason, /under root/i);
      rmSync(outsideRoot, { recursive: true, force: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
