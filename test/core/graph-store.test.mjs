import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeId, makeRunId } from '../../src/core/ids.mjs';
import { createGraphStore } from '../../src/core/graph-store.mjs';

// ─── makeId ────────────────────────────────────────────────────────

describe('makeId', () => {
  it('produces exact deterministic id per brief spec', () => {
    assert.equal(makeId('node', 'Codex Thread A'), 'node-codex-thread-a');
  });

  it('lowercases and replaces spaces with hyphens', () => {
    assert.equal(makeId('NODE', 'Foo BAR'), 'node-foo-bar');
    assert.equal(makeId('edge', 'Session B'), 'edge-session-b');
  });

  it('replaces special characters with hyphens, collapses multiples', () => {
    const id = makeId('run', '2024-01-01T00:00:00.000Z');
    assert.ok(id.startsWith('run-'));
    assert.ok(!id.includes('  '));
    assert.ok(!id.endsWith('-'));
  });

  it('handles empty seed gracefully', () => {
    const id = makeId('prefix', '');
    assert.equal(typeof id, 'string');
    assert.ok(id.startsWith('prefix'));
  });
});

// ─── makeRunId ─────────────────────────────────────────────────────

describe('makeRunId', () => {
  it('produces a run-prefixed id', () => {
    const id = makeRunId();
    assert.ok(id.startsWith('run-'));
    assert.equal(typeof id, 'string');
  });

  it('uses provided Date for deterministic output', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const id = makeRunId(d);
    assert.ok(id.includes('2024'));
  });

  it('produces same id for same date', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    assert.equal(makeRunId(d), makeRunId(d));
  });
});

// ─── GraphStore: node shape ────────────────────────────────────────

function freshStore() {
  return createGraphStore({ now: () => '2024-01-01T00:00:00.000Z' });
}

describe('GraphStore node shape', () => {
  it('contains all required fields', () => {
    const store = freshStore();
    const node = store.addNode({
      id: 'n1',
      platform: 'codex',
      sessionRef: 'sess-1',
      label: 'Test Node',
    });

    assert.equal(node.id, 'n1');
    assert.equal(node.platform, 'codex');
    assert.equal(node.sessionRef, 'sess-1');
    assert.equal(node.label, 'Test Node');
    assert.equal(node.createdAt, '2024-01-01T00:00:00.000Z');
  });

  it('supports optional rolloutRef and turnRef', () => {
    const store = freshStore();
    const node = store.addNode({
      id: 'n2',
      platform: 'codex',
      sessionRef: 'sess-2',
      label: 'With Rollout',
      rolloutRef: 'roll-1',
      turnRef: 'turn-3',
    });

    assert.equal(node.rolloutRef, 'roll-1');
    assert.equal(node.turnRef, 'turn-3');
  });

  it('supports optional manifestId', () => {
    const store = freshStore();
    const node = store.addNode({
      id: 'n3',
      platform: 'codex',
      sessionRef: 'sess-3',
      label: 'Manifested',
      manifestId: 'manifest-abc',
    });

    assert.equal(node.manifestId, 'manifest-abc');
  });

  it('does NOT contain forbidden fields: role, status, returnRef, forkMode', () => {
    const store = freshStore();
    const node = store.addNode({
      id: 'n4',
      platform: 'codex',
      sessionRef: 'sess-4',
      label: 'Clean',
    });

    assert.ok(!('role' in node), 'role must not be present');
    assert.ok(!('status' in node), 'status must not be present');
    assert.ok(!('returnRef' in node), 'returnRef must not be present');
    assert.ok(!('forkMode' in node), 'forkMode must not be present');
  });
});

// ─── GraphStore: edge kinds ────────────────────────────────────────

describe('GraphStore edge kinds', () => {
  function storeWithNodes() {
    const store = createGraphStore({ now: () => '2024-01-01T00:00:00.000Z' });
    store.addNode({ id: 'a', platform: 'codex', sessionRef: 's', label: 'A' });
    store.addNode({ id: 'b', platform: 'codex', sessionRef: 's', label: 'B' });
    return store;
  }

  const validKinds = ['spawned-from', 'requested-by', 'reviews', 'guides'];

  for (const kind of validKinds) {
    it(`accepts kind "${kind}"`, () => {
      const store = storeWithNodes();
      const edge = store.addEdge({ id: `e-${kind}`, kind, from: 'a', to: 'b' });
      assert.equal(edge.kind, kind);
    });
  }

  it('rejects invalid edge kind', () => {
    const store = storeWithNodes();
    assert.throws(
      () => store.addEdge({ id: 'e-bad', kind: 'branches-from', from: 'a', to: 'b' }),
      { message: /unknown.*kind/i }
    );
  });
});

// ─── GraphStore: unknown node rejection ────────────────────────────

describe('GraphStore unknown node rejection', () => {
  it('rejects edge with unknown from-node', () => {
    const store = createGraphStore();
    store.addNode({ id: 'x', platform: 'codex', sessionRef: 's', label: 'X' });

    assert.throws(
      () => store.addEdge({ id: 'e1', kind: 'guides', from: 'nonexistent', to: 'x' }),
      { message: /unknown.*node/i }
    );
  });

  it('rejects edge with unknown to-node', () => {
    const store = createGraphStore();
    store.addNode({ id: 'x', platform: 'codex', sessionRef: 's', label: 'X' });

    assert.throws(
      () => store.addEdge({ id: 'e1', kind: 'guides', from: 'x', to: 'nonexistent' }),
      { message: /unknown.*node/i }
    );
  });
});

// ─── GraphStore: duplicate rejection ───────────────────────────────

describe('GraphStore duplicate rejection', () => {
  it('rejects duplicate node ids', () => {
    const store = createGraphStore();
    store.addNode({ id: 'dup', platform: 'codex', sessionRef: 's', label: 'First' });

    assert.throws(
      () => store.addNode({ id: 'dup', platform: 'codex', sessionRef: 's', label: 'Second' }),
      { message: /duplicate.*node/i }
    );
  });

  it('rejects duplicate edge ids', () => {
    const store = createGraphStore();
    store.addNode({ id: 'a', platform: 'codex', sessionRef: 's', label: 'A' });
    store.addNode({ id: 'b', platform: 'codex', sessionRef: 's', label: 'B' });
    store.addEdge({ id: 'de', kind: 'guides', from: 'a', to: 'b' });

    assert.throws(
      () => store.addEdge({ id: 'de', kind: 'reviews', from: 'a', to: 'b' }),
      { message: /duplicate.*edge/i }
    );
  });
});

// ─── GraphStore: insertion order ───────────────────────────────────

describe('GraphStore insertion order', () => {
  it('preserves insertion order in toJSON', () => {
    const store = createGraphStore({ now: () => '2024-01-01T00:00:00.000Z' });

    store.addNode({ id: 'c', platform: 'codex', sessionRef: 's', label: 'Third' });
    store.addNode({ id: 'a', platform: 'codex', sessionRef: 's', label: 'First' });
    store.addNode({ id: 'b', platform: 'codex', sessionRef: 's', label: 'Second' });

    store.addEdge({ id: 'e2', kind: 'guides', from: 'a', to: 'b' });
    store.addEdge({ id: 'e1', kind: 'reviews', from: 'c', to: 'a' });

    const json = store.toJSON();

    assert.deepEqual(
      json.nodes.map((n) => n.id),
      ['c', 'a', 'b']
    );
    assert.deepEqual(
      json.edges.map((e) => e.id),
      ['e2', 'e1']
    );
  });
});

// ─── GraphStore: getNode ───────────────────────────────────────────

describe('GraphStore.getNode', () => {
  it('returns the node for a known id', () => {
    const store = createGraphStore();
    store.addNode({ id: 'n1', platform: 'codex', sessionRef: 's', label: 'One' });

    const node = store.getNode('n1');
    assert.equal(node.id, 'n1');
  });

  it('returns undefined for unknown id', () => {
    const store = createGraphStore();
    assert.equal(store.getNode('nonexistent'), undefined);
  });
});

// ─── GraphStore: shared validation ─────────────────────────────────

describe('GraphStore shared validation', () => {
  it('rejects empty string for node id', () => {
    const store = createGraphStore();

    assert.throws(
      () => store.addNode({ id: '', platform: 'codex', sessionRef: 's', label: 'Bad' }),
      { message: /required.*string/i }
    );
  });

  it('rejects empty string for platform', () => {
    const store = createGraphStore();

    assert.throws(
      () => store.addNode({ id: 'x', platform: '', sessionRef: 's', label: 'Bad' }),
      { message: /required.*string/i }
    );
  });

  it('rejects empty string for edge id', () => {
    const store = createGraphStore();
    store.addNode({ id: 'a', platform: 'codex', sessionRef: 's', label: 'A' });
    store.addNode({ id: 'b', platform: 'codex', sessionRef: 's', label: 'B' });

    assert.throws(
      () => store.addEdge({ id: '', kind: 'guides', from: 'a', to: 'b' }),
      { message: /required.*string/i }
    );
  });
});
