import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

export function createGeminiNativeSessionAdapter(deps = {}) {
  return createCliNativeSessionAdapter({
    runtime: 'gemini',
    binary: 'gemini',
    binaryEnv: 'EVOBUDDY_GEMINI_BIN',
    exact: (providerConversationRef) => ['--resume', providerConversationRef],
    heuristic: { args: ['--resume'], source: '--resume latest' },
  }, deps);
}

export const geminiNativeSessionAdapter = createGeminiNativeSessionAdapter();
