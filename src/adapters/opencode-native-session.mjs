import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

export function createOpenCodeNativeSessionAdapter(deps = {}) {
  return createCliNativeSessionAdapter({
    runtime: 'opencode',
    binary: 'opencode',
    binaryEnv: 'EVOBUDDY_OPENCODE_BIN',
    exact: (providerConversationRef) => ['--session', providerConversationRef],
    heuristic: { args: ['--continue'], source: '--continue' },
    // Source-qualified attention via classifyAttention / refreshEvidence (Task 15).
    evidenceDefaultStaleMs: 5 * 60 * 1000,
  }, deps);
}

export const opencodeNativeSessionAdapter = createOpenCodeNativeSessionAdapter();
