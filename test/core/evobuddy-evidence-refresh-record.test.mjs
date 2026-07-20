import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createEvidenceRefreshRecord } from '../../src/core/evobuddy-evidence-refresh-record.mjs';

describe('evobuddy evidence refresh record', () => {
  it('creates a versioned evidence refresh record with stable digest', () => {
    const record = createEvidenceRefreshRecord({
      refreshId: 'refresh-1',
      roomId: 'taskroom:alpha',
      refreshedAt: '2026-07-20T02:00:00.000Z',
      descriptors: [
        {
          descriptorId: 'session-1',
          runtime: 'codex',
          refreshedAt: '2026-07-20T02:00:00.000Z',
          evidenceRef: 'evidence:codex:1',
          observation: {
            state: 'working',
            sourceKind: 'runtime-hook',
            sourceRef: 'hook:1',
            observedAt: '2026-07-20T02:00:00.000Z',
            confidence: 'high',
            staleAfter: '2026-07-20T02:05:00.000Z',
          },
          diagnostics: [],
        },
      ],
    });

    assert.equal(record.schema, 'evobuddy.evidence-refresh.v1');
    assert.equal(record.recordVersion, 1);
    assert.match(record.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(record.descriptors[0].observation.sourceKind, 'runtime-hook');
  });

  it('rejects unknown top-level fields and mismatched schema/version', () => {
    assert.throws(() => createEvidenceRefreshRecord({
      schema: 'evobuddy.evidence-refresh.v2',
      recordVersion: 2,
      refreshId: 'refresh-1',
      roomId: 'taskroom:alpha',
      refreshedAt: '2026-07-20T02:00:00.000Z',
      descriptors: [],
      unexpectedField: true,
    }), /schema|recordVersion|unexpectedField/i);
  });

  it('rejects unknown nested fields inside descriptor refresh and observation objects', () => {
    assert.throws(() => createEvidenceRefreshRecord({
      refreshId: 'refresh-3',
      roomId: 'taskroom:alpha',
      refreshedAt: '2026-07-20T02:00:00.000Z',
      descriptors: [
        {
          descriptorId: 'session-1',
          runtime: 'codex',
          refreshedAt: '2026-07-20T02:00:00.000Z',
          evidenceRef: 'evidence:codex:1',
          observation: {
            state: 'working',
            sourceKind: 'runtime-hook',
            sourceRef: 'hook:1',
            observedAt: '2026-07-20T02:00:00.000Z',
            confidence: 'high',
            staleAfter: '2026-07-20T02:05:00.000Z',
          },
          unexpectedNestedField: true,
          diagnostics: [],
        },
      ],
    }), /unexpectedNestedField|descriptor/i);

    assert.throws(() => createEvidenceRefreshRecord({
      refreshId: 'refresh-4',
      roomId: 'taskroom:alpha',
      refreshedAt: '2026-07-20T02:00:00.000Z',
      descriptors: [
        {
          descriptorId: 'session-1',
          runtime: 'codex',
          refreshedAt: '2026-07-20T02:00:00.000Z',
          evidenceRef: 'evidence:codex:1',
          observation: {
            state: 'working',
            sourceKind: 'runtime-hook',
            sourceRef: 'hook:1',
            observedAt: '2026-07-20T02:00:00.000Z',
            confidence: 'high',
            staleAfter: '2026-07-20T02:05:00.000Z',
            unexpectedNestedField: true,
          },
          diagnostics: [],
        },
      ],
    }), /unexpectedNestedField|observation/i);
  });

  it('rejects terminal output as completion proof and rejects secret-bearing diagnostics', () => {
    assert.throws(() => createEvidenceRefreshRecord({
      refreshId: 'refresh-2',
      roomId: 'taskroom:alpha',
      refreshedAt: '2026-07-20T02:00:00.000Z',
      descriptors: [
        {
          descriptorId: 'session-1',
          runtime: 'codex',
          refreshedAt: '2026-07-20T02:00:00.000Z',
          evidenceRef: 'evidence:codex:2',
          observation: {
            state: 'completed',
            sourceKind: 'terminal-output',
            sourceRef: 'tmux:capture-pane',
            observedAt: '2026-07-20T02:00:00.000Z',
            confidence: 'low',
            staleAfter: '2026-07-20T02:05:00.000Z',
          },
          diagnostics: ['API_KEY=secret'],
        },
      ],
    }), /terminal output|completion proof|secret|API_KEY/i);
  });
});
