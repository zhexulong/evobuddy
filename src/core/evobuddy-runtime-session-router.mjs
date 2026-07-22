import { randomUUID } from 'node:crypto';

import { deriveContinuationAction } from './evobuddy-runtime-capability.mjs';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { createRuntimeLaunchPlan, writeRuntimeLaunchPlan } from './evobuddy-runtime-launch-plan.mjs';
import { opencodeNativeSessionAdapter } from '../adapters/opencode-native-session.mjs';
import { claudeNativeSessionAdapter } from '../adapters/claude-native-session.mjs';
import { codexNativeSessionAdapter } from '../adapters/codex-native-session.mjs';
import { geminiNativeSessionAdapter } from '../adapters/gemini-native-session.mjs';
import { piNativeSessionAdapter } from '../adapters/pi-native-session.mjs';

const DEFAULT_ADAPTERS = Object.freeze({
  opencode: opencodeNativeSessionAdapter,
  claude: claudeNativeSessionAdapter,
  codex: codexNativeSessionAdapter,
  gemini: geminiNativeSessionAdapter,
  pi: piNativeSessionAdapter,
});

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function optionalString(value, name) {
  if (value === undefined || value === null) return null;
  return requireString(value, name);
}

function resolveAdapter(runtime, adapters) {
  const adapter = adapters[runtime];
  if (!adapter) throw new Error(`unsupported runtime adapter: ${runtime}`);
  return adapter;
}

function requestedContinuation(requestedMode, capability, sessionFacts, candidates) {
  if (!requestedMode) {
    return deriveContinuationAction(capability, {
      ...sessionFacts,
      heuristicCandidateCount: candidates.length,
    });
  }
  if (requestedMode === 'exact-resume') {
    if (capability.exactResume.supported && sessionFacts.providerConversationRef && sessionFacts.providerConversationRefValidated === true) {
      return { kind: 'exact-resume', reason: null };
    }
    return { kind: 'unsupported', reason: 'Exact resume requires a validated provider conversation identity.' };
  }
  if (requestedMode === 'heuristic-resume') {
    if (capability.heuristicResume.supported && candidates.length > 0) return { kind: 'heuristic-resume', reason: null };
    return { kind: 'unsupported', reason: 'Heuristic resume candidates are unavailable.' };
  }
  if (requestedMode === 'continue-with-context') {
    if (capability.supportsContextContinuation && sessionFacts.contextPacketRef) return { kind: 'continue-with-context', reason: null };
    return { kind: 'unsupported', reason: 'Context continuation requires a context packet.' };
  }
  if (requestedMode === 'fresh-session') {
    if (capability.supportsFreshSession) return { kind: 'fresh-session', reason: null };
    return { kind: 'unsupported', reason: capability.unsupportedReason ?? 'Fresh session unsupported.' };
  }
  return { kind: 'unsupported', reason: `unsupported requested mode: ${requestedMode}` };
}

function buildCommandArgv(adapter, continuation, input, candidates) {
  if (continuation.kind === 'exact-resume') {
    return adapter.buildExactResumeArgv({
      workspace: input.workspace,
      providerConversationRef: input.providerConversationRef,
      safetyMode: input.safetyMode,
    });
  }
  if (continuation.kind === 'heuristic-resume') {
    if (typeof adapter.buildHeuristicResumeArgv === 'function') {
      return adapter.buildHeuristicResumeArgv({
        workspace: input.workspace,
        safetyMode: input.safetyMode,
        candidate: candidates[0] ?? null,
      });
    }
    if (candidates[0]?.providerConversationRef) {
      return adapter.buildExactResumeArgv({
        workspace: input.workspace,
        providerConversationRef: candidates[0].providerConversationRef,
        safetyMode: input.safetyMode,
      });
    }
  }
  return adapter.buildLaunchArgv({
    workspace: input.workspace,
    contextPacketRef: input.contextPacketRef,
    safetyMode: input.safetyMode,
  });
}

export function buildManagedTerminalSessionRef({ runtime, roomId, agentInstanceId }) {
  const sanitize = (value) => String(value ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'x';
  return `eb_${sanitize(runtime)}_${sanitize(roomId)}_${sanitize(agentInstanceId)}`.slice(0, 200);
}

export function getRuntimeSessionAdapter(runtime, adapters = DEFAULT_ADAPTERS) {
  return resolveAdapter(runtime, adapters);
}

export async function createRuntimeSessionOpenPlan(input, deps = {}) {
  const projectRoot = requireString(input.projectRoot, 'projectRoot');
  const descriptorId = requireString(input.descriptorId, 'descriptorId');
  const roomId = requireString(input.roomId, 'roomId');
  const agentInstanceId = requireString(input.agentInstanceId, 'agentInstanceId');
  const runtime = requireString(input.runtime, 'runtime');
  const workspace = requireString(input.workspace, 'workspace');
  const participant = requireString(input.participant ?? input.agentInstanceId, 'participant');
  const contextPacketRef = optionalString(input.contextPacketRef ?? roomId, 'contextPacketRef');
  const providerConversationRef = optionalString(input.providerConversationRef, 'providerConversationRef');
  const terminalSessionRef = requireString(input.terminalSessionRef ?? buildManagedTerminalSessionRef({ runtime, roomId, agentInstanceId }), 'terminalSessionRef');
  const safetyMode = requireString(input.safetyMode ?? 'workspace-write', 'safetyMode');
  const adapters = deps.adapters ?? DEFAULT_ADAPTERS;
  const adapter = resolveAdapter(runtime, adapters);
  const capability = await adapter.probe({ projectRoot, workspace });
  const candidates = await adapter.discoverHeuristicCandidates({ projectRoot, workspace, descriptorId, roomId, agentInstanceId });
  const continuation = requestedContinuation(input.requestedMode ?? null, capability, {
    providerConversationRef,
    providerConversationRefValidated: input.providerConversationRefValidated === true,
    contextPacketRef,
  }, candidates);
  const argv = buildCommandArgv(adapter, continuation, { workspace, providerConversationRef, contextPacketRef, safetyMode }, candidates);
  const program = argv[0];
  const args = argv.slice(1);
  const planId = input.planId ?? `launch-plan-${randomUUID()}`;
  const runtimeCapabilityRef = input.runtimeCapabilityRef ?? capability.capabilityId;
  const launchCommandRef = input.launchCommandRef ?? `launch-command:${runtime}:${continuation.kind}`;
  const launchPlan = createRuntimeLaunchPlan({
    planId,
    descriptorId,
    runtime,
    agentInstanceId,
    program,
    args,
    cwd: workspace,
    environmentPolicyRef: `environment-policy:${safetyMode}`,
    contextPacketRef,
    safetyMode,
    launchCommandRef,
    runtimeCapabilityRef,
  });
  const persisted = writeRuntimeLaunchPlan(projectRoot, launchPlan);
  const state = resolveEvobuddyProjectState({ projectRoot });
  return {
    schema: 'evobuddy.runtime-session-open-plan.v1',
    descriptorId,
    continuation: {
      kind: continuation.kind,
      heuristicCandidateSource: capability.heuristicResume.source,
      candidateCount: candidates.length,
      candidates,
      requiresStructuredChoice: continuation.kind === 'heuristic-resume' && candidates.length > 1,
      disabledReason: continuation.kind === 'unsupported' ? continuation.reason ?? capability.unsupportedReason : null,
    },
    intent: {
      roomId,
      agentInstanceId,
      runtime,
      workspace,
      launchMode: continuation.kind,
      providerConversationRef,
      terminalSessionRef,
      contextPacketRef,
      safetyMode,
      expectedEvidencePath: state.evidenceRefreshRecordPath(roomId),
      recoveryHint: 'reconcile-existing-before-creating-duplicate',
    },
    createSessionRequest: {
      descriptorId,
      sessionRef: terminalSessionRef,
      launcherPlanRef: persisted.launcherPlanRef,
      program,
      args,
      cwd: workspace,
      environmentPolicyRef: `environment-policy:${safetyMode}`,
      display: {
        participant,
        runtime,
        workspace,
        safetyMode,
        detachShortcut: 'F10 or Ctrl+\\\\',
      },
    },
    runtimeCapabilityRef,
    launchCommandRef,
  };
}
