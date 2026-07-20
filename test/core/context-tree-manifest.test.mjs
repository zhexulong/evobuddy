import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCheckpointManifest,
  createSpawnRunManifest,
  createSpawnResultManifest,
} from '../../src/core/context-tree-manifest.mjs';

function checkpoint(overrides = {}) {
  return createCheckpointManifest({
    id: 'cp-design',
    nodeId: 'node-parent',
    sessionRef: 'thread-parent',
    anchor: { messageId: 'msg-10', createdAt: '2026-07-06T00:00:00.000Z' },
    label: 'design checkpoint',
    purpose: 'review implementation plan',
    capture: {
      platform: 'codex',
      sessionRecordRef: 'rollout:parent',
      searchableHistoryRef: 'history:parent',
      knownLosses: [],
    },
    ...overrides,
  });
}

describe('createCheckpointManifest', () => {
  it('records checkpoint anchor and capture refs', () => {
    const m = checkpoint();
    assert.equal(m.id, 'cp-design');
    assert.equal(m.anchor.messageId, 'msg-10');
    assert.equal(m.capture.searchableHistoryRef, 'history:parent');
  });

  it('rejects checkpoint without anchor createdAt', () => {
    assert.throws(
      () => checkpoint({ anchor: { messageId: 'msg-10' } }),
      { message: /anchor\.createdAt/i },
    );
  });

  it('rejects placeholder checkpoint anchors', () => {
    assert.throws(
      () => checkpoint({ anchor: { turnIndex: 0, createdAt: '1970-01-01T00:00:00.000Z' } }),
      { message: /real observed anchor/i },
    );
  });

  it('rejects positive turnIndex-only checkpoint anchors without a stable boundary id', () => {
    assert.throws(
      () => checkpoint({ anchor: { turnIndex: 42, createdAt: '2026-07-06T00:00:00.000Z' } }),
      { message: /messageId|turnId|checkpointId/i },
    );
  });
});

describe('createSpawnRunManifest', () => {
  it('records base requester target and material path', () => {
    const m = createSpawnRunManifest({
      id: 'spawn-1',
      baseCheckpointId: 'cp-design',
      requesterNodeId: 'node-child',
      targetNodeId: 'node-target',
      task: {
        kind: 'review',
        prompt: 'Review target-plan.',
        targetRefs: ['target-plan.md'],
      },
      materialSelectionMode: 'native-fork',
      fidelity: 'native-context-fork',
      evidenceRefs: [{ kind: 'prompt-audit', ref: 'prompt-audit:inline' }],
      knownLosses: [],
    });

    assert.equal(m.baseCheckpointId, 'cp-design');
    assert.equal(m.materialSelectionMode, 'native-fork');
    assert.equal(m.fidelity, 'native-context-fork');
  });

  it('accepts searchable-history as first-class material path', () => {
    const m = createSpawnRunManifest({
      id: 'spawn-history',
      baseCheckpointId: 'cp-design',
      requesterNodeId: 'node-child',
      task: {
        kind: 'review',
        prompt: 'Review using prior constraints.',
        targetRefs: ['target-plan.md'],
      },
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      searchableHistoryRef: 'history:parent',
      evidenceRefs: [{ kind: 'history-search', ref: 'history-query:1' }],
      knownLosses: ['not model-visible until queried'],
    });

    assert.equal(m.materialSelectionMode, 'searchable-history');
    assert.equal(m.searchableHistoryRef, 'history:parent');
  });

  it('rejects searchable-history pass without history-search evidence', () => {
    assert.throws(
      () => createSpawnRunManifest({
        id: 'spawn-history',
        baseCheckpointId: 'cp-design',
        requesterNodeId: 'node-child',
        task: { kind: 'review', prompt: 'Review using history.', targetRefs: [] },
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        searchableHistoryRef: 'history:parent',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'spawn:1' }],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /history-search evidence/i },
    );
  });

  it('rejects searchable-history pass without searchableHistoryRef', () => {
    assert.throws(
      () => createSpawnRunManifest({
        id: 'spawn-history',
        baseCheckpointId: 'cp-design',
        requesterNodeId: 'node-child',
        task: { kind: 'review', prompt: 'Review using history.', targetRefs: [] },
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        evidenceRefs: [{ kind: 'history-search', ref: 'history-query:1' }],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /searchableHistoryRef/i },
    );
  });

  it('rejects summary-only pass material path', () => {
    assert.throws(
      () => createSpawnRunManifest({
        id: 'spawn-summary',
        baseCheckpointId: 'cp-design',
        requesterNodeId: 'node-child',
        task: { kind: 'review', prompt: 'Review.', targetRefs: [] },
        materialSelectionMode: 'summary-only',
        fidelity: 'summary-only',
        evidenceRefs: [],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /summary-only.*pass/i },
    );
  });
});

describe('createSpawnResultManifest', () => {
  it('records result return destination and full output ref', () => {
    const m = createSpawnResultManifest({
      id: 'result-1',
      spawnRunId: 'spawn-1',
      resultRef: 'result:spawn-1',
      returnedTo: 'parent-agent',
      summary: 'Reviewer found one issue.',
      fullOutputRef: 'file:/tmp/spawn-1.txt',
      evidenceRefs: [{ kind: 'reviewer-answer', ref: 'answer:spawn-1' }],
    });

    assert.equal(m.spawnRunId, 'spawn-1');
    assert.equal(m.returnedTo, 'parent-agent');
    assert.equal(m.fullOutputRef, 'file:/tmp/spawn-1.txt');
  });
});
