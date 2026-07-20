import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTINUATION_KINDS,
  createRuntimeCapabilityDescriptor,
  deriveContinuationAction,
} from '../../src/core/evobuddy-runtime-capability.mjs';

describe('evobuddy runtime capability descriptor', () => {
  it('exports the exact continuation kinds', () => {
    assert.deepEqual(CONTINUATION_KINDS, [
      'exact-resume', 'heuristic-resume', 'continue-with-context',
      'fresh-session', 'unsupported',
    ]);
  });

  it('creates an exact versioned capability descriptor', () => {
    const capability = createRuntimeCapabilityDescriptor({
      capabilityId: 'runtime-capability:codex-v1',
      runtime: 'codex',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: {
        supported: true,
        requiresValidatedProviderConversationRef: true,
      },
      heuristicResume: {
        supported: true,
        source: 'latest-local-conversation',
      },
      notes: ['No exact resume without validated provider identity.'],
    });

    assert.equal(capability.schema, 'evobuddy.runtime-capability.v1');
    assert.equal(capability.capabilityVersion, 1);
    assert.match(capability.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(capability.exactResume.supported, true);
    assert.equal(capability.heuristicResume.source, 'latest-local-conversation');
  });

  it('rejects unknown top-level fields and mismatched schema/version', () => {
    assert.throws(() => createRuntimeCapabilityDescriptor({
      schema: 'evobuddy.runtime-capability.v2',
      capabilityVersion: 2,
      capabilityId: 'runtime-capability:codex-v1',
      runtime: 'codex',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: {
        supported: true,
        requiresValidatedProviderConversationRef: true,
      },
      heuristicResume: {
        supported: true,
        source: 'latest-local-conversation',
      },
      extraField: true,
    }), /schema|capabilityVersion|extraField/i);
  });

  it('rejects secret env and command-bearing fields or values', () => {
    assert.throws(() => createRuntimeCapabilityDescriptor({
      capabilityId: 'runtime-capability:codex-v1',
      runtime: 'codex',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: {
        supported: true,
        requiresValidatedProviderConversationRef: true,
      },
      heuristicResume: {
        supported: true,
        source: 'latest-local-conversation',
      },
      env: { API_KEY: 'secret' },
      launchCommand: 'codex --dangerous',
    }), /env|launchCommand|API_KEY|secret|command/i);
  });

  it('rejects unknown nested fields inside exactResume and heuristicResume', () => {
    assert.throws(() => createRuntimeCapabilityDescriptor({
      capabilityId: 'runtime-capability:codex-v1',
      runtime: 'codex',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: {
        supported: true,
        requiresValidatedProviderConversationRef: true,
        extraNestedField: true,
      },
      heuristicResume: {
        supported: true,
        source: 'latest-local-conversation',
      },
    }), /exactResume|extraNestedField/i);

    assert.throws(() => createRuntimeCapabilityDescriptor({
      capabilityId: 'runtime-capability:codex-v1',
      runtime: 'codex',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: {
        supported: true,
        requiresValidatedProviderConversationRef: true,
      },
      heuristicResume: {
        supported: true,
        source: 'latest-local-conversation',
        extraNestedField: true,
      },
    }), /heuristicResume|extraNestedField/i);
  });

  it('continuation action distinguishes exact, heuristic, context, fresh, and unsupported', () => {
    const exactCapability = createRuntimeCapabilityDescriptor({
      capabilityId: 'cap:exact',
      runtime: 'opencode',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: { supported: true, requiresValidatedProviderConversationRef: true },
      heuristicResume: { supported: true, source: 'latest-local-conversation' },
    });
    const heuristicCapability = createRuntimeCapabilityDescriptor({
      capabilityId: 'cap:heuristic',
      runtime: 'codex',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: { supported: false, requiresValidatedProviderConversationRef: true },
      heuristicResume: { supported: true, source: 'latest-local-conversation' },
    });
    const contextCapability = createRuntimeCapabilityDescriptor({
      capabilityId: 'cap:context',
      runtime: 'claude',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: { supported: false, requiresValidatedProviderConversationRef: true },
      heuristicResume: { supported: false, source: null },
    });
    const freshCapability = createRuntimeCapabilityDescriptor({
      capabilityId: 'cap:fresh',
      runtime: 'gemini',
      supportsFreshSession: true,
      supportsContextContinuation: false,
      exactResume: { supported: false, requiresValidatedProviderConversationRef: false },
      heuristicResume: { supported: false, source: null },
    });
    const unsupportedCapability = createRuntimeCapabilityDescriptor({
      capabilityId: 'cap:unsupported',
      runtime: 'codex',
      supportsFreshSession: false,
      supportsContextContinuation: false,
      exactResume: { supported: false, requiresValidatedProviderConversationRef: true },
      heuristicResume: { supported: false, source: null },
      unsupportedReason: 'runtime CLI missing',
    });

    const exactFacts = {
      providerConversationRef: 'opencode:conversation-1',
      providerConversationRefValidated: true,
    };
    const heuristicFacts = { heuristicCandidateCount: 1 };
    const contextFacts = { contextPacketRef: 'context-packet:room-1' };

    assert.equal(deriveContinuationAction(exactCapability, exactFacts).kind, 'exact-resume');
    assert.equal(deriveContinuationAction(heuristicCapability, heuristicFacts).kind, 'heuristic-resume');
    assert.equal(deriveContinuationAction(contextCapability, contextFacts).kind, 'continue-with-context');
    assert.equal(deriveContinuationAction(freshCapability, {}).kind, 'fresh-session');
    assert.equal(deriveContinuationAction(unsupportedCapability, {}).kind, 'unsupported');
  });

  it('fails closed rather than overclaiming exact resume', () => {
    const capability = createRuntimeCapabilityDescriptor({
      capabilityId: 'cap:no-overclaim',
      runtime: 'opencode',
      supportsFreshSession: true,
      supportsContextContinuation: true,
      exactResume: { supported: true, requiresValidatedProviderConversationRef: true },
      heuristicResume: { supported: false, source: null },
    });

    const action = deriveContinuationAction(capability, {
      providerConversationRef: 'opencode:conversation-1',
      providerConversationRefValidated: false,
      contextPacketRef: 'context-packet:room-1',
    });

    assert.equal(action.kind, 'continue-with-context');
    assert.match(action.reason, /validated|exact/i);
  });
});
