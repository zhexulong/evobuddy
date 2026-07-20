import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeOpenCodeNativeBuddyTaskCapability } from '../../src/core/opencode-native-buddy-capability-probe.mjs';

function manifest(overrides = {}) {
  return {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    source: {
      kind: 'opencode-sqlite',
      dbPath: '/tmp/opencode.db',
      dbDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    sessions: {
      total: 2,
      entries: [
        {
          sessionId: 'ses-parent',
          raw: {
            sessionDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        },
        {
          sessionId: 'ses-child',
          raw: {
            sessionDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          },
        },
      ],
    },
    ...overrides,
  };
}

function corpus(overrides = {}) {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'opencode-sqlite-session-corpus-export',
    projectIdentity: '/repo/context-tree',
    sessions: [
      {
        sessionId: 'ses-parent',
        runtime: 'opencode',
        isSubagent: false,
        parentSessionId: null,
        updatedAt: '2026-07-13T10:00:00.000Z',
        promptLineage: {
          kind: 'root-user-prompt',
          parentSessionId: null,
          receivedPromptText: 'Parent prompt',
        },
        messages: [
          { role: 'user', text: 'Parent prompt', createdAt: '2026-07-13T10:00:00.000Z' },
          { role: 'assistant', text: 'Child result returned to parent.', createdAt: '2026-07-13T10:03:00.000Z' },
        ],
      },
      {
        sessionId: 'ses-child',
        runtime: 'opencode',
        isSubagent: true,
        parentSessionId: 'ses-parent',
        updatedAt: '2026-07-13T10:02:00.000Z',
        promptLineage: {
          kind: 'opencode-task-child-prompt',
          parentSessionId: 'ses-parent',
          receivedPromptText: 'Context Tree Buddy task child prompt',
        },
        messages: [
          { role: 'user', text: 'Context Tree Buddy task child prompt', createdAt: '2026-07-13T10:01:00.000Z' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('probeOpenCodeNativeBuddyTaskCapability', () => {
  it('passes when child-session lineage, prompt lineage, parent result return, and exporter DB digest are all observable', () => {
    const result = probeOpenCodeNativeBuddyTaskCapability({
      corpus: corpus(),
      manifest: manifest(),
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.capability, 'opencode-native-task-child-session-observable');
    assert.deepEqual(result.observedSignals, {
      childSessionParentId: true,
      childPromptLineage: true,
      parentResultReturnCandidate: true,
      exporterDbDigest: true,
    });
    assert.deepEqual(result.blockedReasons, []);
    assert.deepEqual(result.failedReasons, []);
  });

  it('blocks when no child sessions have parentSessionId linkage', () => {
    const result = probeOpenCodeNativeBuddyTaskCapability({
      corpus: corpus({
        sessions: corpus().sessions.map((session) => (session.sessionId === 'ses-child'
          ? { ...session, parentSessionId: null, isSubagent: false, promptLineage: { ...session.promptLineage, parentSessionId: null } }
          : session)),
      }),
      manifest: manifest(),
    });

    assert.equal(result.status, 'blocked');
    assert.equal(result.capability, 'not-observable');
    assert.equal(result.observedSignals.childSessionParentId, false);
    assert.match(result.blockedReasons.join('\n'), /child session/i);
  });

  it('blocks when parent result-return evidence is not observable after child task activity', () => {
    const result = probeOpenCodeNativeBuddyTaskCapability({
      corpus: corpus({
        sessions: [
          { ...corpus().sessions[0], messages: [{ role: 'user', text: 'Parent prompt', createdAt: '2026-07-13T10:00:00.000Z' }] },
          corpus().sessions[1],
        ],
      }),
      manifest: manifest(),
    });

    assert.equal(result.status, 'blocked');
    assert.equal(result.observedSignals.parentResultReturnCandidate, false);
    assert.match(result.blockedReasons.join('\n'), /result-return|result return|parent result/i);
  });

  it('fails when corpus claims child lineage but manifest lacks DB digest or session digest refs', () => {
    const result = probeOpenCodeNativeBuddyTaskCapability({
      corpus: corpus(),
      manifest: manifest({ source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db' }, sessions: { total: 2, entries: [{ sessionId: 'ses-parent', raw: {} }, { sessionId: 'ses-child', raw: {} }] } }),
    });

    assert.equal(result.status, 'fail');
    assert.equal(result.capability, 'not-observable');
    assert.equal(result.observedSignals.childSessionParentId, true);
    assert.equal(result.observedSignals.exporterDbDigest, false);
    assert.match(result.failedReasons.join('\n'), /digest|manifest/i);
  });
});
