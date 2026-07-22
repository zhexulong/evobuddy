import { createHash, randomUUID } from 'node:crypto';

import { deriveContinuationAction } from './evobuddy-runtime-capability.mjs';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import {
  createRuntimeLaunchPlan,
  writeRuntimeLaunchPlan,
} from './evobuddy-runtime-launch-plan.mjs';
import {
  sanitizeSessionDisplayName,
  sanitizeTerminalSessionSlug,
  validateWorkspacePath,
} from './evobuddy-native-session-descriptor.mjs';
import { opencodeNativeSessionAdapter } from '../adapters/opencode-native-session.mjs';
import { claudeNativeSessionAdapter } from '../adapters/claude-native-session.mjs';
import { codexNativeSessionAdapter } from '../adapters/codex-native-session.mjs';
import { geminiNativeSessionAdapter } from '../adapters/gemini-native-session.mjs';

const DEFAULT_ADAPTERS = Object.freeze({
  opencode: opencodeNativeSessionAdapter,
  claude: claudeNativeSessionAdapter,
  codex: codexNativeSessionAdapter,
  gemini: geminiNativeSessionAdapter,
});

const DESTRUCTIVE_ACTIONS = Object.freeze({
  detach: {
    action: 'detach',
    requiresConfirmation: false,
    effects: {
      process: 'retained',
      providerConversation: 'retained',
      worktree: 'retained',
      evidence: 'retained',
    },
  },
  'stop-process': {
    action: 'stop-process',
    requiresConfirmation: true,
    effects: {
      process: 'stopped',
      providerConversation: 'retained',
      worktree: 'retained',
      evidence: 'retained',
    },
  },
  'terminate-session': {
    action: 'terminate-session',
    requiresConfirmation: true,
    effects: {
      process: 'stopped',
      providerConversation: 'retained',
      worktree: 'retained',
      evidence: 'retained',
    },
  },
  archive: {
    action: 'archive',
    requiresConfirmation: true,
    effects: {
      process: 'stopped-if-running',
      providerConversation: 'archived-reference',
      worktree: 'retained',
      evidence: 'retained',
    },
  },
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

function sanitizeDisplayLabel(value) {
  const text = requireString(value, 'displayLabel');
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error('control bytes are forbidden in display label');
  return text
    .replace(/[;&|`$<>\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortId(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
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

export function buildManagedTerminalSessionRef({ runtime, roomId, agentInstanceId, descriptorId = null }) {
  const runtimeSlug = sanitizeTerminalSessionSlug(runtime);
  const roomSlug = sanitizeTerminalSessionSlug(roomId);
  const idSeed = descriptorId ?? `${runtime}:${roomId}:${agentInstanceId}`;
  return `evb-${runtimeSlug}-${roomSlug}-${shortId(idSeed)}`;
}

export function getRuntimeSessionAdapter(runtime, adapters = DEFAULT_ADAPTERS) {
  return resolveAdapter(runtime, adapters);
}

export function describeDestructiveLifecycleAction(action, _context = {}) {
  const description = DESTRUCTIVE_ACTIONS[action];
  if (!description) throw new Error(`unknown destructive lifecycle action: ${action}`);
  return {
    action: description.action,
    requiresConfirmation: description.requiresConfirmation,
    effects: { ...description.effects },
  };
}

export function confirmDestructiveLifecycleAction(action, { confirmed = false } = {}) {
  const description = describeDestructiveLifecycleAction(action);
  if (description.requiresConfirmation && confirmed !== true) {
    throw new Error(`confirmation required for ${action}`);
  }
  return { action: description.action, confirmed: true };
}

export async function createRuntimeSessionOpenPlan(input, deps = {}) {
  const projectRoot = requireString(input.projectRoot, 'projectRoot');
  const descriptorId = requireString(input.descriptorId, 'descriptorId');
  const roomId = requireString(input.roomId, 'roomId');
  const agentInstanceId = requireString(input.agentInstanceId, 'agentInstanceId');
  const runtime = requireString(input.runtime, 'runtime');
  const workspace = validateWorkspacePath(input.workspace, { projectRoot, mustExist: true });
  const participant = sanitizeDisplayLabel(input.participant ?? input.agentInstanceId);
  const contextPacketRef = optionalString(input.contextPacketRef ?? roomId, 'contextPacketRef');
  const providerConversationRef = optionalString(input.providerConversationRef, 'providerConversationRef');
  const terminalSessionRef = requireString(
    input.terminalSessionRef
      ?? buildManagedTerminalSessionRef({ runtime, roomId, agentInstanceId, descriptorId }),
    'terminalSessionRef',
  );
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
  if (!Array.isArray(argv) || argv.length === 0) throw new Error('adapter produced empty argv');
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
      heuristicCandidateSource: capability.heuristicResume?.source ?? null,
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
        detachShortcut: 'Ctrl+B d',
      },
    },
    runtimeCapabilityRef,
    launchCommandRef,
  };
}

// keep export used by security tests that may call the strict sanitizer
export { sanitizeSessionDisplayName };
