import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

export function createClaudeNativeSessionAdapter(deps = {}) {
  return createCliNativeSessionAdapter({
    runtime: 'claude',
    binary: 'claude',
    binaryEnv: 'EVOBUDDY_CLAUDE_BIN',
    exact: (providerConversationRef) => ['--resume', providerConversationRef],
    heuristic: { args: ['--continue'], source: '--continue' },
    // Source-qualified attention via classifyAttention / refreshEvidence (Task 15).
    evidenceDefaultStaleMs: 5 * 60 * 1000,
  }, deps);
}

export const claudeNativeSessionAdapter = createClaudeNativeSessionAdapter();
