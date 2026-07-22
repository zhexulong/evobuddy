import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

export function createCodexNativeSessionAdapter(deps = {}) {
  return createCliNativeSessionAdapter({
    runtime: 'codex',
    binary: 'codex',
    binaryEnv: 'EVOBUDDY_CODEX_BIN',
    minimumExactVersion: [0, 30, 0],
    exact: (providerConversationRef) => ['resume', providerConversationRef],
    heuristic: { args: ['resume', '--last'], source: 'resume --last' },
  }, deps);
}

export const codexNativeSessionAdapter = createCodexNativeSessionAdapter();
