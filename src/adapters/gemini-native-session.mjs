import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

export function createGeminiNativeSessionAdapter(deps = {}) {
  return createCliNativeSessionAdapter({
    runtime: 'gemini',
    binary: 'gemini',
    binaryEnv: 'EVOBUDDY_GEMINI_BIN',
    exact: (providerConversationRef) => ['--resume', providerConversationRef],
    heuristic: { args: ['--resume'], source: '--resume latest' },
    // Source-qualified attention via classifyAttention / refreshEvidence (Task 15).
    evidenceDefaultStaleMs: 5 * 60 * 1000,
  }, deps);
}

export const geminiNativeSessionAdapter = createGeminiNativeSessionAdapter();
