const MECHANISM_NAMED_PROMPT = /spawn_agent|wait_agent|invoke-buddy|invoke-member|context-tree:|\bctree\b|subagent|native mechanism/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function pass(status = 'pass', extra = {}) {
  return { status, ...extra };
}

function blocked(reason) {
  return { status: 'blocked', reason };
}

function hasSurfacePass(surfaceState) {
  return surfaceState?.status === 'pass' && Array.isArray(surfaceState.files) && surfaceState.files.length > 0;
}

function hasChildInvocation(invocation) {
  return Boolean(invocation?.childSessionId || invocation?.spawnId || invocation?.childThreadId);
}

function hasParentResult(resultReturn) {
  return resultReturn?.returnedTo === 'parent-agent' && Boolean(resultReturn?.resultDigest || resultReturn?.resultRef);
}

function codexActorName(actorName) {
  return String(actorName).replaceAll('-', '_');
}

function sourceThreadSpawn(session) {
  return session?.source?.subagent?.thread_spawn ?? session?.source?.SubAgent?.ThreadSpawn ?? null;
}

function matchesActor(value, actorName) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  const normalized = value.trim();
  return normalized === actorName || normalized === codexActorName(actorName) || normalized.endsWith(`/${actorName}`) || normalized.endsWith(`/${codexActorName(actorName)}`);
}

function hasTeamAgentSession(session, actorName) {
  const threadSpawn = sourceThreadSpawn(session);
  const codexThreadAttribution = session?.threadSource === 'subagent' && (
    matchesActor(session?.agentRole, actorName)
    || matchesActor(session?.agentPath, actorName)
    || matchesActor(threadSpawn?.agent_role, actorName)
    || matchesActor(threadSpawn?.agent_path, actorName)
  );
  return Boolean(
    session?.selectedActorName === actorName
    || session?.activeActorName === actorName
    || session?.participantActorName === actorName
    || codexThreadAttribution
  );
}

export function createCodexActorSurfaceProof(input) {
  return {
    schema: 'codex-actor-surface-proof.v1',
    runtime: 'codex',
    actorName: requireString(input.actorName, 'actorName'),
    actorKind: requireString(input.actorKind, 'actorKind'),
    surfaceState: requireObject(input.surfaceState, 'surfaceState'),
    session: input.session ?? null,
    invocation: input.invocation ?? null,
    resultReturn: input.resultReturn ?? null,
    prompt: requireString(input.prompt, 'prompt'),
    proofLayer: input.proofLayer ?? 'naturalUse',
    reportRefs: input.reportRefs ?? {},
  };
}

export function classifyCodexActorProofLayers(proof) {
  const surfacePass = hasSurfacePass(proof.surfaceState);
  const mechanismNamed = MECHANISM_NAMED_PROMPT.test(proof.prompt ?? '');
  const childInvocationObserved = hasChildInvocation(proof.invocation);
  const parentResultObserved = hasParentResult(proof.resultReturn);
  const teamAgentSessionObserved = hasTeamAgentSession(proof.session, proof.actorName);

  if (proof.actorKind === 'team-agent') {
    const knownLosses = [];
    if (!teamAgentSessionObserved) knownLosses.push('missing Codex TeamAgent thread attribution evidence');
    if (!parentResultObserved) knownLosses.push('missing TeamAgent result return evidence');
    return {
      surfaceCurrent: surfacePass ? pass() : blocked('surface-not-current'),
      teamAgentSessionObserved: surfacePass && teamAgentSessionObserved ? pass() : blocked(!surfacePass ? 'surface-not-current' : 'missing-team-agent-session'),
      teamAgentResultObserved: surfacePass && teamAgentSessionObserved && parentResultObserved ? pass() : blocked(!surfacePass ? 'surface-not-current' : (!teamAgentSessionObserved ? 'missing-team-agent-session' : 'missing-team-agent-result-return')),
      failedLayer: !surfacePass ? 'surface' : (!teamAgentSessionObserved ? 'team-agent-selection' : (!parentResultObserved ? 'team-agent-result-return' : null)),
      knownLosses,
    };
  }

  const knownLosses = [];
  if (!childInvocationObserved) knownLosses.push('missing spawn_agent invocation evidence');
  if (!childInvocationObserved) knownLosses.push('missing child final answer evidence');
  if (!parentResultObserved) knownLosses.push('missing parent result-return evidence');
  return {
    surfaceCurrent: surfacePass ? pass() : blocked('surface-not-current'),
    nativeMechanismObserved: surfacePass && childInvocationObserved ? pass() : blocked(!surfacePass ? 'surface-not-current' : 'missing-child-invocation'),
    naturalUseObserved: surfacePass && childInvocationObserved && parentResultObserved && !mechanismNamed
      ? pass()
      : blocked(!surfacePass ? 'surface-not-current' : (mechanismNamed ? 'mechanism-named-prompt' : (!childInvocationObserved ? 'missing-child-invocation' : 'missing-result-return'))),
    childResultReturnObserved: surfacePass && parentResultObserved ? pass() : blocked(!surfacePass ? 'surface-not-current' : 'missing-result-return'),
    failedLayer: !surfacePass ? 'surface' : (!childInvocationObserved ? 'routing' : (!parentResultObserved ? 'return-contract' : (mechanismNamed ? 'natural-use' : null))),
    knownLosses,
  };
}
