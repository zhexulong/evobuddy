export const DEFAULT_SOURCE_DECLARATIONS = Object.freeze({
  opencode: {
    needsInputSource: {
      kind: 'runtime-exporter',
      status: 'pass',
      reason: null,
      note: 'Stable exporter/session signal when available; otherwise Unknown. Workbench never answers permission prompts.',
    },
    evidenceSource: {
      kind: 'runtime-exporter',
      status: 'pass',
      reason: null,
      note: 'exporter/session artifacts and TaskRoom handoff records',
    },
  },
  claude: {
    needsInputSource: {
      kind: 'runtime-hook',
      status: 'pass',
      reason: null,
      note: 'Stable hook/protocol signal when available. Workbench never answers permission prompts.',
    },
    evidenceSource: {
      kind: 'runtime-exporter',
      status: 'pass',
      reason: null,
      note: 'runtime/exporter artifacts and explicit return record',
    },
  },
  codex: {
    needsInputSource: {
      kind: 'app-server',
      status: 'pass',
      reason: null,
      note: 'Stable app-server or exporter signal when available. Workbench never answers permission prompts.',
    },
    evidenceSource: {
      kind: 'app-server',
      status: 'pass',
      reason: null,
      note: 'app-server/exporter artifacts and explicit return record',
    },
  },
  gemini: {
    needsInputSource: {
      kind: 'unknown',
      status: 'unknown',
      reason: 'No stable runtime hook/protocol signal declared for permission prompts',
      note: 'Unsupported needs-input is shown as blocked; Workbench never answers permission prompts.',
    },
    evidenceSource: {
      kind: 'runtime-exporter',
      status: 'pass',
      reason: null,
      note: 'runtime/exporter artifacts and explicit return record when available',
    },
  },
});

export function resolveRuntimeSources(adapter, runtime) {
  if (typeof adapter.declareSources === 'function') {
    const declared = adapter.declareSources();
    return {
      needsInputSource: {
        kind: declared.needsInputSource?.kind ?? 'unknown',
        status: declared.needsInputSource?.status ?? 'unknown',
        reason: declared.needsInputSource?.reason ?? null,
        note: declared.needsInputSource?.note ?? null,
      },
      evidenceSource: {
        kind: declared.evidenceSource?.kind ?? 'unknown',
        status: declared.evidenceSource?.status ?? 'unknown',
        reason: declared.evidenceSource?.reason ?? null,
        note: declared.evidenceSource?.note ?? null,
      },
    };
  }
  const defaults = DEFAULT_SOURCE_DECLARATIONS[runtime] ?? {
    needsInputSource: { kind: 'unknown', status: 'unknown', reason: 'No needs-input source declared', note: null },
    evidenceSource: { kind: 'unknown', status: 'unknown', reason: 'No evidence source declared', note: null },
  };
  return {
    needsInputSource: { ...defaults.needsInputSource },
    evidenceSource: { ...defaults.evidenceSource },
  };
}

export async function resolveRuntimeAuth(adapter, capability) {
  if (typeof adapter.probeAuth === 'function') {
    const auth = await adapter.probeAuth({ capability });
    return {
      authenticated: Boolean(auth?.authenticated),
      status: auth?.status === 'pass' && auth?.authenticated ? 'pass' : 'blocked',
      reason: auth?.reason
        ?? (auth?.authenticated
          ? null
          : 'auth status not confirmed without interactive permission prompts'),
    };
  }
  if (!capability.supportsFreshSession) {
    return {
      authenticated: false,
      status: 'blocked',
      reason: capability.unsupportedReason ?? 'runtime CLI missing',
    };
  }
  return {
    authenticated: false,
    status: 'blocked',
    reason: 'auth status not confirmed without interactive permission prompts',
  };
}
