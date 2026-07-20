import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NATIVE_SESSION_LIFECYCLES,
  createNativeSessionDescriptor,
  transitionNativeSessionDescriptor,
  validateNativeSessionDescriptor,
} from '../../src/core/evobuddy-native-session-descriptor.mjs';

function baseInput() {
  return {
    descriptorId: 'session-1',
    roomId: 'taskroom:alpha',
    agentInstanceId: 'instance-1',
    runtime: 'codex',
    workspace: '/repo',
    terminalSubstrate: 'tmux',
    terminalSessionRef: 'evb-repo-room-builder-a1',
    providerConversationRef: 'codex:conversation-1',
    launchCommandRef: 'launch-plan:codex-default',
    runtimeCapabilityRef: 'runtime-capability:codex-v1',
    lifecycle: 'creating',
    createdAt: '2026-07-20T00:00:00.000Z',
    lastAttachedAt: null,
    safetyMode: 'workspace-write',
    contextPacketRef: 'context-packet:room-1',
    evidenceRefs: ['evidence:1'],
    recoveryPolicy: 'reconcile-existing',
  };
}

describe('evobuddy native session descriptor', () => {
  it('exports the exact allowed native session lifecycles', () => {
    assert.deepEqual(NATIVE_SESSION_LIFECYCLES, [
      'creating', 'attachable', 'attached', 'detached',
      'stale', 'failed', 'terminated',
    ]);
  });

  it('creates an exact versioned descriptor with stable digest', () => {
    const descriptor = createNativeSessionDescriptor(baseInput());

    assert.deepEqual(Object.keys(descriptor).sort(), [
      'agentInstanceId',
      'contextPacketRef',
      'createdAt',
      'descriptorId',
      'descriptorVersion',
      'digest',
      'evidenceRefs',
      'lastAttachedAt',
      'launchCommandRef',
      'lifecycle',
      'providerConversationRef',
      'recoveryPolicy',
      'roomId',
      'runtime',
      'runtimeCapabilityRef',
      'safetyMode',
      'schema',
      'terminalSessionRef',
      'terminalSubstrate',
      'workspace',
    ]);
    assert.equal(descriptor.schema, 'evobuddy.native-session.v1');
    assert.equal(descriptor.descriptorVersion, 1);
    assert.match(descriptor.digest, /^sha256:[a-f0-9]{64}$/);

    const reordered = createNativeSessionDescriptor({
      ...baseInput(),
      evidenceRefs: ['evidence:1'],
    });
    assert.equal(reordered.digest, descriptor.digest);
    assert.deepEqual(validateNativeSessionDescriptor(descriptor), descriptor);
  });

  it('rejects executable command strings and secrets', () => {
    assert.throws(() => createNativeSessionDescriptor({
      descriptorId: 'session-1',
      roomId: 'room-1',
      agentInstanceId: 'instance-1',
      runtime: 'codex',
      workspace: '/repo',
      substrate: 'tmux',
      substrateSessionRef: 'evb-repo-room-builder-a1',
      lifecycle: 'creating',
      launchCommand: 'codex --dangerous',
      env: { API_KEY: 'secret' },
    }), /launchCommand|secret|env/i);
  });

  it('rejects deriving taskroom identity from terminal session refs', () => {
    assert.throws(() => createNativeSessionDescriptor({
      ...baseInput(),
      roomId: 'evb-repo-room-builder-a1',
    }), /roomId|session/i);
  });

  it('descriptor attach transition records lastAttachedAt without execution data', () => {
    const attachable = transitionNativeSessionDescriptor(createNativeSessionDescriptor(baseInput()), {
      kind: 'attachable',
    });
    const attached = transitionNativeSessionDescriptor(attachable, {
      kind: 'attached',
      at: '2026-07-20T01:00:00.000Z',
    });

    assert.equal(attached.lifecycle, 'attached');
    assert.equal(attached.lastAttachedAt, '2026-07-20T01:00:00.000Z');
    assert.equal(typeof attached.launchCommandRef, 'string');
    assert.equal('launchCommand' in attached, false);
    assert.equal('argv' in attached, false);
    assert.equal('env' in attached, false);
    assert.match(attached.digest, /^sha256:[a-f0-9]{64}$/);
  });

  it('supports explicit fail-closed lifecycle transitions only', () => {
    const creating = createNativeSessionDescriptor(baseInput());
    const attachable = transitionNativeSessionDescriptor(creating, { kind: 'attachable' });
    assert.equal(attachable.lifecycle, 'attachable');

    assert.throws(() => transitionNativeSessionDescriptor(attachable, {
      kind: 'creating',
    }), /transition|creating/i);
  });
});
