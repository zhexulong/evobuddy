import { spawnSync } from 'node:child_process';

import { createRuntimeCapabilityDescriptor } from '../core/evobuddy-runtime-capability.mjs';
import { listNativeSessions } from '../core/evobuddy-native-session-store.mjs';
import {
  buildAdapterEvidenceObservation,
  formatSourceQualifiedAttentionLabel,
  reduceNativeSessionEvidence,
} from '../core/evobuddy-native-session-evidence.mjs';

function parseSemver(text) {
  const match = String(text ?? '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1).map((value) => Number.parseInt(value, 10));
}

function compareSemver(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a - b;
  }
  return 0;
}

function defaultRunCommand(binary, args) {
  try {
    const result = spawnSync(binary, args, { encoding: 'utf8' });
    return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } catch (error) {
    return { status: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
}

function sortSessions(sessions) {
  return [...sessions].sort((left, right) => (
    String(right.lastAttachedAt ?? right.createdAt ?? '').localeCompare(String(left.lastAttachedAt ?? left.createdAt ?? ''))
      || String(left.descriptorId).localeCompare(String(right.descriptorId))
  ));
}

export function createCliNativeSessionAdapter(config, deps = {}) {
  const runCommand = deps.runCommand ?? defaultRunCommand;
  const listSessions = deps.listNativeSessions ?? listNativeSessions;
  const binary = deps.binary ?? process.env[config.binaryEnv] ?? config.binary;

  return {
    runtime: config.runtime,
    async probe({ projectRoot }) {
      const version = runCommand(binary, config.versionArgs ?? ['--version'], { projectRoot });
      const parsedVersion = parseSemver(`${version.stdout}\n${version.stderr}`);
      const available = version.status === 0;
      const exactSupported = available && (config.minimumExactVersion ? parsedVersion && compareSemver(parsedVersion, config.minimumExactVersion) >= 0 : true);
      const heuristicSupported = available && Boolean(config.heuristic);
      return createRuntimeCapabilityDescriptor({
        capabilityId: `runtime-capability:${config.runtime}-v1`,
        runtime: config.runtime,
        supportsFreshSession: available,
        supportsContextContinuation: available,
        exactResume: {
          supported: exactSupported,
          requiresValidatedProviderConversationRef: true,
        },
        heuristicResume: {
          supported: heuristicSupported,
          source: heuristicSupported ? config.heuristic.source : null,
        },
        unsupportedReason: available ? null : `${binary} CLI missing`,
        notes: parsedVersion ? [`version ${parsedVersion.join('.')}`] : [],
      });
    },
    buildLaunchArgv() {
      return [binary, ...(config.launchArgs ?? [])];
    },
    buildExactResumeArgv({ providerConversationRef }) {
      return [binary, ...config.exact(providerConversationRef)];
    },
    buildHeuristicResumeArgv() {
      return [binary, ...(config.heuristic?.args ?? [])];
    },
    async discoverHeuristicCandidates({ projectRoot }) {
      const sessions = await listSessions(projectRoot);
      return sortSessions(sessions.filter((session) => session.runtime === config.runtime)).map((session) => ({
        candidateId: session.descriptorId,
        label: `${config.runtime} ${session.providerConversationRef ?? 'latest'}`,
        providerConversationRef: session.providerConversationRef ?? null,
        sourceRef: `descriptor:${session.descriptorId}`,
        observedAt: session.lastAttachedAt ?? session.createdAt,
        confidence: session.providerConversationRef ? 'medium' : 'low',
      }));
    },
    classifyAttention(runtimeEvidence = {}) {
      const now = runtimeEvidence.observedAt ?? new Date().toISOString();
      const evidenceList = Array.isArray(runtimeEvidence.runtimeEvidence)
        ? runtimeEvidence.runtimeEvidence
        : (runtimeEvidence.state || runtimeEvidence.sourceKind)
          ? [{
            state: runtimeEvidence.state ?? 'Working',
            sourceKind: runtimeEvidence.sourceKind ?? 'runtime-exporter',
            sourceRef: runtimeEvidence.sourceRef ?? `runtime:${config.runtime}`,
            observedAt: now,
            confidence: runtimeEvidence.confidence ?? 'medium',
            staleAfter: runtimeEvidence.staleAfter ?? now,
          }]
          : [];
      const reduced = reduceNativeSessionEvidence({
        terminal: runtimeEvidence.terminal ?? null,
        runtimeEvidence: evidenceList,
        handoffs: runtimeEvidence.handoffs ?? [],
        roomOutcome: runtimeEvidence.roomOutcome ?? null,
        runtime: config.runtime,
        now: runtimeEvidence.now ?? now,
      });
      return {
        ...reduced.observation,
        attentionLabel: reduced.attentionLabel
          ?? formatSourceQualifiedAttentionLabel({
            state: reduced.observation.state,
            runtime: config.runtime,
            provisional: reduced.provisional,
            stale: reduced.stale,
          }),
        workState: reduced.workState,
        roomState: reduced.roomState,
        provisional: reduced.provisional,
        stale: reduced.stale,
      };
    },
    async refreshEvidence({ descriptor, projectRoot, runtimeEvidence = [], terminal = null, now } = {}) {
      void projectRoot;
      // Never capture pane output as proof. Only structured adapter/runtime facts.
      const refreshed = buildAdapterEvidenceObservation({
        runtime: config.runtime,
        descriptor,
        runtimeEvidence,
        terminal,
        now: now ?? new Date().toISOString(),
        defaultStaleMs: config.evidenceDefaultStaleMs ?? 5 * 60 * 1000,
      });
      const diagnostics = [
        ...list(refreshed.diagnostics),
      ];
      if (terminal?.paneCapture || terminal?.capturePane) {
        diagnostics.push('pane output capture ignored; not used as evidence');
      }
      return {
        evidenceRef: refreshed.evidenceRef,
        observation: refreshed.observation,
        attentionLabel: refreshed.attentionLabel,
        workState: refreshed.workState,
        roomState: refreshed.roomState,
        diagnostics,
      };
    },
  };
}

function list(value) {
  return Array.isArray(value) ? value : [];
}
