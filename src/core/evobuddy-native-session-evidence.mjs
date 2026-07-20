/**
 * Source-qualified native-session evidence reduction.
 *
 * Precedence (strongest first):
 *   runtime-hook / runtime-protocol
 *   → runtime-exporter
 *   → terminal-lifecycle
 *   → bounded-pattern (provisional only)
 *   → unknown
 *
 * Terminal idleness/output and pattern hints cannot prove Returned or Completed.
 */

export const SOURCE_KIND_PRECEDENCE = Object.freeze({
  'runtime-hook': 0,
  'runtime-protocol': 1,
  'runtime-exporter': 2,
  'terminal-lifecycle': 3,
  'terminal-output': 4,
  'bounded-pattern': 5,
  unknown: 6,
});

const PROVISIONAL_SOURCE_KINDS = new Set(['bounded-pattern', 'terminal-output', 'unknown']);
const STRONG_RETURN_SOURCE_KINDS = new Set(['runtime-hook', 'runtime-protocol', 'runtime-exporter']);

const RUNTIME_DISPLAY = Object.freeze({
  opencode: 'OpenCode',
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeStateToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function titleCaseRuntime(runtime) {
  const key = cleanString(runtime)?.toLowerCase();
  if (key && RUNTIME_DISPLAY[key]) return RUNTIME_DISPLAY[key];
  if (!key) return 'runtime';
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function precedenceRank(sourceKind) {
  const kind = cleanString(sourceKind) ?? 'unknown';
  return SOURCE_KIND_PRECEDENCE[kind] ?? SOURCE_KIND_PRECEDENCE.unknown;
}

export function isObservationStale(observation, now = new Date().toISOString()) {
  const staleAfter = cleanString(observation?.staleAfter);
  if (!staleAfter) return false;
  return Date.parse(staleAfter) < Date.parse(now);
}

export function formatSourceQualifiedAttentionLabel({ state, runtime, provisional = false, stale = false } = {}) {
  if (stale) return 'Stale';
  const token = normalizeStateToken(state);
  const runtimeLabel = titleCaseRuntime(runtime);

  if (token === 'needs-input' || token === 'waiting') {
    return provisional ? `Provisional needs input in ${runtimeLabel}` : `Needs input in ${runtimeLabel}`;
  }
  if (token === 'permission-required' || token === 'permission') {
    return provisional ? `Provisional permission required in ${runtimeLabel}` : `Permission required in ${runtimeLabel}`;
  }
  if (token === 'working' || token === 'running' || token === 'in-progress' || token === 'active') {
    return provisional ? `Provisional working in ${runtimeLabel}` : `Working in ${runtimeLabel}`;
  }
  if (token === 'idle' || token === 'available') {
    return `Idle in ${runtimeLabel}`;
  }
  if (token === 'returned' || token === 'done' || token === 'pass') {
    return 'Returned';
  }
  if (token === 'completed') {
    return 'Completed';
  }
  if (token === 'blocked') {
    return `Blocked in ${runtimeLabel}`;
  }
  if (token === 'failed' || token === 'fail' || token === 'error') {
    return `Failed in ${runtimeLabel}`;
  }
  if (token === 'queued' || token === 'ready') {
    return `Queued in ${runtimeLabel}`;
  }
  if (token === 'unknown' || !token) {
    return 'Unknown';
  }
  return provisional ? `Provisional ${token} in ${runtimeLabel}` : `${token} in ${runtimeLabel}`;
}

function normalizeObservation(raw, { now, runtime } = {}) {
  const observedAt = cleanString(raw?.observedAt) ?? now ?? new Date().toISOString();
  const sourceKind = cleanString(raw?.sourceKind) ?? 'unknown';
  return {
    state: normalizeStateToken(raw?.state) || 'unknown',
    sourceKind: SOURCE_KIND_PRECEDENCE[sourceKind] !== undefined ? sourceKind : 'unknown',
    sourceRef: cleanString(raw?.sourceRef) ?? `runtime:${runtime ?? 'unknown'}`,
    observedAt,
    confidence: cleanString(raw?.confidence) ?? 'medium',
    staleAfter: cleanString(raw?.staleAfter) ?? observedAt,
  };
}

function selectStrongestObservation(runtimeEvidence, { now, runtime }) {
  const observations = list(runtimeEvidence).map((entry) => normalizeObservation(entry, { now, runtime }));
  if (observations.length === 0) return null;

  return [...observations].sort((left, right) => {
    const rankDelta = precedenceRank(left.sourceKind) - precedenceRank(right.sourceKind);
    if (rankDelta !== 0) return rankDelta;
    return String(right.observedAt).localeCompare(String(left.observedAt));
  })[0];
}

function terminalObservation(terminal, { now, runtime }) {
  if (!terminal || typeof terminal !== 'object') return null;
  const observedAt = cleanString(terminal.lastActivityAt) ?? now ?? new Date().toISOString();
  const childAlive = terminal.childAlive === true;
  const idle = terminal.idle === true;
  let state = 'queued';
  if (childAlive && idle) state = 'idle';
  else if (childAlive) state = 'working';
  else if (terminal.childAlive === false) state = 'available';

  return {
    state,
    sourceKind: 'terminal-lifecycle',
    sourceRef: cleanString(terminal.sourceRef) ?? `terminal:${runtime ?? 'unknown'}`,
    observedAt,
    confidence: 'low',
    staleAfter: cleanString(terminal.staleAfter) ?? observedAt,
  };
}

function unknownObservation({ now, runtime }) {
  const observedAt = now ?? new Date().toISOString();
  return {
    state: 'unknown',
    sourceKind: 'unknown',
    sourceRef: `unknown:${runtime ?? 'none'}`,
    observedAt,
    confidence: 'low',
    staleAfter: observedAt,
  };
}

function hasReturnEvidence(handoffs) {
  return list(handoffs).some((handoff) => {
    if (!handoff || typeof handoff !== 'object') return false;
    const returnedTo = cleanString(handoff.returnedTo);
    if (!returnedTo) return false;
    const sourceKind = cleanString(handoff.sourceKind) ?? 'runtime-exporter';
    if (PROVISIONAL_SOURCE_KINDS.has(sourceKind) || sourceKind === 'terminal-lifecycle' || sourceKind === 'terminal-output') {
      return false;
    }
    return STRONG_RETURN_SOURCE_KINDS.has(sourceKind);
  });
}

function hasAcceptedRoomOutcome(roomOutcome) {
  if (!roomOutcome || typeof roomOutcome !== 'object') return false;
  if (roomOutcome.accepted !== true) return false;
  const sourceKind = cleanString(roomOutcome.sourceKind) ?? 'runtime-exporter';
  return STRONG_RETURN_SOURCE_KINDS.has(sourceKind);
}

function mapWorkStateFromObservation(observation, { provisional, canProveReturn, canProveCompletion, returned, completed }) {
  if (completed) return 'completed';
  if (returned) return 'returned';

  const token = normalizeStateToken(observation.state);
  if (token === 'needs-input' || token === 'waiting' || token === 'permission-required' || token === 'permission') {
    return provisional && !canProveReturn ? 'needs-input' : 'needs-input';
  }
  if (token === 'returned' || token === 'done' || token === 'pass') {
    // Observation alone cannot prove return without handoff/result evidence.
    if (!canProveReturn) {
      if (observation.sourceKind === 'terminal-lifecycle' || provisional) return 'working';
      return 'working';
    }
    return 'returned';
  }
  if (token === 'completed') {
    if (!canProveCompletion) return 'working';
    return 'completed';
  }
  if (token === 'blocked') return 'blocked';
  if (token === 'failed' || token === 'fail' || token === 'error') return 'failed';
  if (token === 'idle' || token === 'available') return token === 'idle' ? 'idle' : 'available';
  if (token === 'queued' || token === 'ready') return token === 'ready' ? 'queued' : 'queued';
  if (token === 'working' || token === 'running' || token === 'in-progress' || token === 'active') return 'working';
  if (token === 'unknown') return 'unknown';
  return token || 'unknown';
}

function mapRoomState({ returned, completed, workState }) {
  if (completed) return 'completed';
  if (returned) return 'returned';
  if (workState === 'needs-input') return 'needs-input';
  if (workState === 'blocked') return 'blocked';
  if (workState === 'failed') return 'failed';
  if (workState === 'working' || workState === 'idle' || workState === 'available') return 'working';
  if (workState === 'queued') return 'queued';
  return 'unknown';
}

/**
 * Reduce terminal facts, runtime evidence observations, and handoffs into a
 * source-qualified attention / work-state projection.
 *
 * @param {object} input
 * @param {object|null} [input.terminal]
 * @param {object[]} [input.runtimeEvidence]
 * @param {object[]} [input.handoffs]
 * @param {object|null} [input.roomOutcome]
 * @param {string} [input.runtime]
 * @param {string} [input.now]
 */
export function reduceNativeSessionEvidence(input = {}) {
  const now = cleanString(input.now) ?? new Date().toISOString();
  const runtime = cleanString(input.runtime);

  const selectedFromEvidence = selectStrongestObservation(input.runtimeEvidence, { now, runtime });
  const fromTerminal = terminalObservation(input.terminal, { now, runtime });

  // Runtime evidence wins by precedence among itself; terminal only fills when none exists.
  let observation = selectedFromEvidence ?? fromTerminal ?? unknownObservation({ now, runtime });

  const stale = isObservationStale(observation, now);
  let workingObservation = { ...observation };

  if (stale) {
    workingObservation = {
      ...workingObservation,
      state: 'unknown',
      confidence: 'low',
    };
  }

  const provisional = PROVISIONAL_SOURCE_KINDS.has(workingObservation.sourceKind)
    || workingObservation.sourceKind === 'bounded-pattern';

  // Pattern / terminal-output cannot prove permission, return, or completion.
  const canProvePermission = !provisional
    && STRONG_RETURN_SOURCE_KINDS.has(workingObservation.sourceKind)
    && !stale;
  const returned = hasReturnEvidence(input.handoffs);
  const completed = returned && hasAcceptedRoomOutcome(input.roomOutcome);
  const canProveReturn = returned;
  const canProveCompletion = completed;

  // Strip claimed return/completion from weak observation states.
  if (
    (workingObservation.state === 'returned' || workingObservation.state === 'completed')
    && (provisional
      || workingObservation.sourceKind === 'terminal-lifecycle'
      || workingObservation.sourceKind === 'terminal-output'
      || workingObservation.sourceKind === 'bounded-pattern')
  ) {
    workingObservation = {
      ...workingObservation,
      state: workingObservation.sourceKind === 'terminal-lifecycle' ? 'idle' : 'working',
    };
  }

  let workState = mapWorkStateFromObservation(workingObservation, {
    provisional,
    canProveReturn,
    canProveCompletion,
    returned,
    completed,
  });

  // Return/completion require durable handoff/outcome evidence, never terminal idle.
  if (returned) {
    workState = 'returned';
  } else if (stale) {
    workState = 'unknown';
  } else {
    if (workState === 'returned') workState = 'working';
    if (workState === 'completed') workState = 'working';
  }

  const roomState = mapRoomState({ returned, completed, workState });

  const attentionLabel = formatSourceQualifiedAttentionLabel({
    state: (stale && !returned) ? 'unknown' : (returned ? 'returned' : workingObservation.state),
    runtime,
    provisional: provisional && !returned,
    stale: stale && !returned,
  });

  return {
    workState,
    roomState,
    observation: workingObservation,
    attentionLabel,
    stale,
    provisional,
    canProvePermission,
    canProveReturn,
    canProveCompletion,
    diagnostics: stale
      ? ['observation stale; downgraded to unknown']
      : provisional
        ? ['pattern or weak source is provisional only']
        : [],
  };
}

/**
 * Build a refresh observation from adapter-supplied runtime facts without capturing pane output.
 */
export function buildAdapterEvidenceObservation({
  runtime,
  descriptor,
  runtimeEvidence = [],
  terminal = null,
  now = new Date().toISOString(),
  defaultStaleMs = 5 * 60 * 1000,
} = {}) {
  const reduced = reduceNativeSessionEvidence({
    terminal,
    runtimeEvidence: runtimeEvidence.length > 0
      ? runtimeEvidence
      : descriptor
        ? [{
          state: descriptor.lifecycle === 'attached'
            ? 'working'
            : descriptor.lifecycle === 'attachable'
              ? 'queued'
              : descriptor.lifecycle === 'detached'
                ? 'available'
                : descriptor.lifecycle === 'failed'
                  ? 'failed'
                  : 'queued',
          sourceKind: 'runtime-exporter',
          sourceRef: `descriptor:${descriptor.descriptorId}`,
          observedAt: cleanString(descriptor.lastAttachedAt) ?? cleanString(descriptor.createdAt) ?? now,
          confidence: 'medium',
          staleAfter: new Date(Date.parse(now) + defaultStaleMs).toISOString(),
        }]
        : [],
    handoffs: [],
    runtime,
    now,
  });

  return {
    evidenceRef: descriptor?.providerConversationRef
      ?? (descriptor ? `descriptor:${descriptor.descriptorId}` : `runtime:${runtime ?? 'unknown'}`),
    observation: reduced.observation,
    attentionLabel: reduced.attentionLabel,
    workState: reduced.workState,
    roomState: reduced.roomState,
    diagnostics: reduced.diagnostics,
    stale: reduced.stale,
    provisional: reduced.provisional,
  };
}
