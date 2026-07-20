import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

export function createClaudeNativeSessionAdapter(deps = {}) {
  return createCliNativeSessionAdapter({
    runtime: 'claude',
    binary: 'claude',
    binaryEnv: 'EVOBUDDY_CLAUDE_BIN',
    exact: (providerConversationRef) => ['--resume', providerConversationRef],
    heuristic: { args: ['--continue'], source: '--continue' },
  }, deps);
}

export const claudeNativeSessionAdapter = createClaudeNativeSessionAdapter();
