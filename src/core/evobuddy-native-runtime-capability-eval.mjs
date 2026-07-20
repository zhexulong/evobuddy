import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createOpenCodeNativeSessionAdapter } from '../adapters/opencode-native-session.mjs';
import { createClaudeNativeSessionAdapter } from '../adapters/claude-native-session.mjs';
import { createCodexNativeSessionAdapter } from '../adapters/codex-native-session.mjs';
import { createGeminiNativeSessionAdapter } from '../adapters/gemini-native-session.mjs';
import {
  evaluateExample1,
  evaluateExample3,
  evaluateExample5,
  makeScenario,
} from './evobuddy-native-runtime-capability-scenarios.mjs';
import {
  resolveRuntimeAuth,
  resolveRuntimeSources,
} from './evobuddy-native-runtime-capability-sources.mjs';

export const RUNTIMES = Object.freeze(['opencode', 'claude', 'codex', 'gemini']);
export const REPORT_KIND = 'evobuddy-native-runtime-capability-eval-report';
export const REPORT_FILE = 'evobuddy-native-runtime-capability-eval-report.json';

const SAFE_MODE = Object.freeze({
  workspace: 'no-op/test workspaces only',
  permissionPrompts: 'never automated',
  claimCeiling: 'capability probe + declared sources only; not TaskRoom completion proof',
});

export function defaultNativeRuntimeAdapters() {
  return {
    opencode: createOpenCodeNativeSessionAdapter(),
    claude: createClaudeNativeSessionAdapter(),
    codex: createCodexNativeSessionAdapter(),
    gemini: createGeminiNativeSessionAdapter(),
  };
}

export function probeTmuxSubstrate() {
  const result = spawnSync('tmux', ['-V'], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT' || result.status !== 0) {
    return {
      status: 'blocked',
      kind: 'tmux',
      reason: 'tmux-missing: tmux binary is unavailable in the current environment',
      version: null,
    };
  }
  return {
    status: 'pass',
    kind: 'tmux',
    reason: null,
    version: String(result.stdout ?? result.stderr ?? '').trim() || null,
  };
}

function missingAdapterEntry(runtime) {
  const reason = `adapter missing for ${runtime}`;
  return {
    runtime,
    installed: false,
    installedStatus: 'blocked',
    authenticated: false,
    authenticatedStatus: 'blocked',
    authenticatedReason: reason,
    capability: {
      capabilityId: `runtime-capability:${runtime}-v1`,
      supportsFreshSession: false,
      supportsContextContinuation: false,
      unsupportedReason: reason,
      notes: [],
    },
    exactResume: {
      supported: false,
      requiresValidatedProviderConversationRef: true,
      status: 'blocked',
      reason,
    },
    heuristicResume: { supported: false, source: null, status: 'blocked' },
    needsInputSource: { kind: 'unknown', status: 'unknown', reason, note: null },
    evidenceSource: { kind: 'unknown', status: 'unknown', reason, note: null },
    permissionAutomation: 'never',
    scenarios: {
      'example-1-launch-new': makeScenario('blocked', reason),
      'example-3-needs-input': makeScenario('blocked', reason),
      'example-5-exact-vs-context': makeScenario('blocked', reason),
    },
    blockedReasons: [reason],
    safeMode: { ...SAFE_MODE },
  };
}

function exactResumeStatus(installed, capability) {
  if (!installed) {
    return {
      status: 'blocked',
      reason: capability.unsupportedReason ?? 'runtime CLI missing',
    };
  }
  if (capability.exactResume.supported) {
    return {
      status: 'pass',
      reason: 'exact resume supported only with validated provider conversation identity',
    };
  }
  return {
    status: 'blocked',
    reason: 'exact resume not supported for this runtime/version',
  };
}

async function evaluateRuntime(runtime, adapter, substrate, projectRoot) {
  const capability = await adapter.probe({ projectRoot, workspace: projectRoot });
  const installed = capability.supportsFreshSession === true && !capability.unsupportedReason;
  const auth = await resolveRuntimeAuth(adapter, capability);
  const sources = resolveRuntimeSources(adapter, runtime);
  const blockedReasons = [];
  const exact = exactResumeStatus(installed, capability);

  if (!installed) blockedReasons.push(capability.unsupportedReason ?? `${runtime} CLI missing`);
  if (auth.status === 'blocked' && auth.reason) blockedReasons.push(auth.reason);
  if (substrate.status !== 'pass' && substrate.reason) blockedReasons.push(substrate.reason);

  return {
    runtime,
    installed,
    installedStatus: installed ? 'pass' : 'blocked',
    authenticated: auth.authenticated,
    authenticatedStatus: auth.status,
    authenticatedReason: auth.reason,
    capability: {
      capabilityId: capability.capabilityId,
      supportsFreshSession: capability.supportsFreshSession,
      supportsContextContinuation: capability.supportsContextContinuation,
      unsupportedReason: capability.unsupportedReason ?? null,
      notes: capability.notes ?? [],
    },
    exactResume: {
      supported: capability.exactResume.supported,
      requiresValidatedProviderConversationRef: capability.exactResume.requiresValidatedProviderConversationRef,
      status: exact.status,
      reason: exact.reason,
    },
    heuristicResume: {
      supported: capability.heuristicResume.supported,
      source: capability.heuristicResume.source,
      status: !installed
        ? 'blocked'
        : capability.heuristicResume.supported
          ? 'pass'
          : 'blocked',
    },
    needsInputSource: sources.needsInputSource,
    evidenceSource: sources.evidenceSource,
    permissionAutomation: 'never',
    scenarios: {
      'example-1-launch-new': evaluateExample1({ substrate, installed, capability }),
      'example-3-needs-input': evaluateExample3({
        installed,
        capability,
        needsInputSource: sources.needsInputSource,
      }),
      'example-5-exact-vs-context': evaluateExample5({ installed, capability }),
    },
    blockedReasons,
    safeMode: { ...SAFE_MODE },
  };
}

function aggregateStatus(substrate, runtimes) {
  if (substrate.status === 'fail') return 'fail';
  const scenarioStatuses = runtimes.flatMap((entry) => Object.values(entry.scenarios).map((s) => s.status));
  if (scenarioStatuses.includes('fail')) return 'fail';
  if (substrate.status === 'blocked') return 'blocked';
  if (scenarioStatuses.includes('pass')) return 'pass';
  return 'blocked';
}

export async function buildNativeRuntimeCapabilityReport(input = {}) {
  const projectRoot = resolve(input.projectRoot ?? '.');
  const substrate = input.substrate ?? probeTmuxSubstrate();
  const adapters = input.adapters ?? defaultNativeRuntimeAdapters();
  const runtimes = [];

  for (const runtime of RUNTIMES) {
    const adapter = adapters[runtime];
    if (!adapter) {
      runtimes.push(missingAdapterEntry(runtime));
      continue;
    }
    runtimes.push(await evaluateRuntime(runtime, adapter, substrate, projectRoot));
  }

  return {
    reportKind: REPORT_KIND,
    status: aggregateStatus(substrate, runtimes),
    proofScope: 'native-runtime-capability',
    projectRoot,
    generatedAt: new Date().toISOString(),
    substrate,
    runtimes,
    examplesObserved: ['example-1-launch-new', 'example-3-needs-input', 'example-5-exact-vs-context'],
    claimCeiling: [
      'Per-runtime capability acceptance only.',
      'Unavailable runtimes are blocked entries, not synthetic passes.',
      'Does not require every runtime to support exact resume.',
      'Does not automate permission prompts.',
      'Not a universal client; not TaskRoom completion proof.',
    ],
  };
}
