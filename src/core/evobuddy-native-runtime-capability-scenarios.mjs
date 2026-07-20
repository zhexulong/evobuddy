import { deriveContinuationAction } from './evobuddy-runtime-capability.mjs';

export function makeScenario(status, reason, details = {}) {
  return { status, reason, ...details };
}

export function evaluateExample1({ substrate, installed, capability }) {
  if (substrate.status !== 'pass') {
    return makeScenario('blocked', substrate.reason ?? 'terminal substrate unavailable');
  }
  if (!installed) {
    return makeScenario('blocked', capability.unsupportedReason ?? 'runtime CLI missing');
  }
  if (!capability.supportsFreshSession) {
    return makeScenario('blocked', capability.unsupportedReason ?? 'fresh session unsupported');
  }
  return makeScenario(
    'pass',
    'safe launch path available: substrate + installed runtime + fresh-session capability (no-op/safe workspace only; no permission automation)',
  );
}

export function evaluateExample3({ installed, capability, needsInputSource }) {
  if (!installed) {
    return makeScenario('blocked', capability.unsupportedReason ?? 'runtime CLI missing');
  }
  if (needsInputSource.kind === 'unknown' || needsInputSource.status === 'unknown') {
    return makeScenario(
      'blocked',
      needsInputSource.reason
        ?? 'needs-input source unknown; Workbench must not automate or answer permission prompts',
    );
  }
  return makeScenario(
    'pass',
    `needs-input source declared as ${needsInputSource.kind}; Workbench shows Needs input and never answers native permission prompts`,
    { permissionAutomation: 'never' },
  );
}

export function evaluateExample5({ installed, capability }) {
  if (!installed) {
    return makeScenario('blocked', capability.unsupportedReason ?? 'runtime CLI missing');
  }

  const exactFacts = {
    providerConversationRef: `${capability.runtime}:validated-ref`,
    providerConversationRefValidated: true,
    contextPacketRef: 'context-packet:room-1',
  };
  const unvalidatedFacts = {
    providerConversationRef: `${capability.runtime}:unvalidated-ref`,
    providerConversationRefValidated: false,
    contextPacketRef: 'context-packet:room-1',
  };

  const exactAction = deriveContinuationAction(capability, exactFacts);
  const unvalidatedAction = deriveContinuationAction(capability, unvalidatedFacts);

  if (capability.exactResume.supported) {
    if (exactAction.kind !== 'exact-resume') {
      return makeScenario('fail', `exact resume capability claimed but derivation returned ${exactAction.kind}`);
    }
    if (unvalidatedAction.kind === 'exact-resume') {
      return makeScenario('fail', 'exact resume overclaim: unvalidated provider ref must not yield exact-resume');
    }
    return makeScenario(
      'pass',
      `exact resume available only with validated provider identity; unvalidated path is ${unvalidatedAction.kind} (not exact)`,
      { exactAction: exactAction.kind, unvalidatedAction: unvalidatedAction.kind },
    );
  }

  if (unvalidatedAction.kind === 'exact-resume' || exactAction.kind === 'exact-resume') {
    return makeScenario('fail', 'exact resume overclaim: capability marks exact unsupported but derivation returned exact-resume');
  }

  const contextOk = capability.supportsContextContinuation
    && (
      unvalidatedAction.kind === 'continue-with-context'
      || exactAction.kind === 'continue-with-context'
      || unvalidatedAction.kind === 'fresh-session'
      || exactAction.kind === 'fresh-session'
    );
  if (!contextOk && !capability.supportsFreshSession) {
    return makeScenario(
      'blocked',
      capability.unsupportedReason ?? 'no exact resume and no context/fresh continuation path',
    );
  }

  return makeScenario(
    'pass',
    `exact resume not supported; continuation is ${unvalidatedAction.kind} (context/fresh, not exact)`,
    { exactAction: exactAction.kind, unvalidatedAction: unvalidatedAction.kind },
  );
}
