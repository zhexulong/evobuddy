import { createCliNativeSessionAdapter } from './native-session-adapter-helpers.mjs';

const PI_ADAPTER_CONFIG = Object.freeze({
  runtime: 'pi',
  binary: 'pi',
  binaryEnv: 'EVOBUDDY_PI_BIN',
  exact: (providerConversationRef) => ['--session', providerConversationRef],
  heuristic: { args: ['--continue'], source: '--continue' },
});

export function createPiNativeSessionAdapter(deps = {}) {
  const binary = deps.binary ?? process.env[PI_ADAPTER_CONFIG.binaryEnv] ?? PI_ADAPTER_CONFIG.binary;
  return {
    ...createCliNativeSessionAdapter(PI_ADAPTER_CONFIG, deps),
    buildRpcLaunchArgv() {
      return [binary, '--mode', 'rpc', '--no-session'];
    },
  };
}

export const piNativeSessionAdapter = createPiNativeSessionAdapter();

export default piNativeSessionAdapter;
