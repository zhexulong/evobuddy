import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  buildReviewerPrompt,
  auditPromptForLeaks,
  createCanarySet,
  expectedCanariesForCase,
  forbiddenCanariesForCase,
} from './canaries.mjs';
import {
  applyEvidenceGate,
  classifyCompactionFinding,
  classifyToolResultFinding,
} from './verdicts.mjs';
import { createCapabilityReport, writeCapabilityReport } from './report.mjs';
import { createCaptureManifest } from '../core/manifest.mjs';
import {
  createCheckpointManifest,
  createSpawnRunManifest,
  createSpawnResultManifest,
} from '../core/context-tree-manifest.mjs';
import { writeContextTreeManifestArtifacts } from '../core/context-tree-artifacts.mjs';
import { buildHelperIdentityReminder } from '../core/helper-reminder.mjs';
import { recordMemberTaskRunToContextTree } from '../core/member-task-run-record.mjs';
import { createEvidenceCollector } from '../adapters/codex-evidence.mjs';
import {
  forkReviewerFromThread,
  injectToolResultCanary,
  probeCurrentBoundarySpawn,
  startEvalThread,
} from '../adapters/codex-context-fork.mjs';
import {
  buildThreadForkParams,
  buildThreadRollbackParams,
  buildThreadStartParams,
  buildTurnStartParams,
} from '../adapters/codex-protocol.mjs';
import { nativeSpawnCaseResultFromArtifact } from './native-spawn-artifact.mjs';

const DEFAULT_MODEL = 'codex-context-fork-capability-eval';
const DEFAULT_RUN_DIR = '/tmp/context-tree-codex-context-fork-task-10';
const TURN_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 25;

const CASE_IDS = Object.freeze([
  'negative-fresh-thread',
  'negative-summary-only',
  'user-assistant-canary',
  'negative-fork-turns-none',
  'tool-result-canary',
  'rollback-canary',
  'compaction-canary',
  'current-boundary-spawn-canary',
]);

const BASE_KNOWN_LOSSES = Object.freeze([
  'no model KV/cache',
  'no provider prompt cache',
  'forked rollout may filter reasoning items',
  'forked rollout may filter tool outputs',
]);

const COMPACTION_TRANSFORM_LAYERS = Object.freeze([
  'pre-compaction-turn',
  'compaction-summary',
  'post-compaction-turn',
]);

const SPAWN_UNAVAILABLE = 'inconclusive:spawn-surface-unavailable';
const COMPACTION_TRIGGER_UNAVAILABLE = 'compaction trigger unavailable';
const COMPACTION_TRIGGER_LOSS =
  'compaction trigger unavailable: no observed compaction/replacement-history boundary';
const LIVE_ROLLBACK_SEARCHABLE_HISTORY_LOSS =
  'live thread/rollback on ephemeral forks is unsupported; using searchable-history mounted rollback compatibility path';
const LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS =
  'live reviewer turn used tools or exposed tool results and can self-contaminate negative controls';
const REVIEWER_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    answer: {
      type: 'string',
      enum: ['known', 'unknown'],
    },
    values: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['answer', 'values'],
  additionalProperties: false,
});
const REVIEWER_SANDBOX_POLICY = Object.freeze({
  type: 'readOnly',
  writableRoots: [],
  networkAccess: false,
  excludeTmpdirEnvVar: true,
  excludeSlashTmp: true,
});
const REVIEWER_APPROVAL_POLICY = 'never';
const LIVE_NO_TOOLS_INSTRUCTION =
  'do not use tools, shell commands, MCP resources, memory, or workspace search.';
const LIVE_REVIEWER_NO_TOOLS_PREAMBLE =
  `Reviewer rule: ${LIVE_NO_TOOLS_INSTRUCTION} ` +
  'Answer only from the preserved conversation/thread context already visible in this turn. ' +
  'If the context is insufficient, answer unknown with values=[].';
const LIVE_SOURCE_NO_TOOLS_PREAMBLE =
  `Eval seeding rule: ${LIVE_NO_TOOLS_INSTRUCTION} ` +
  'Treat the following text as the complete setup record and reply without inspecting files.';

// ─── Validation / extraction helpers ─────────────────────────────────

function requireObject(value, name) {
  if (!value || typeof value !== 'object') {
    throw new Error(`required object: ${name}`);
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function extractThreadId(result, name) {
  const threadId =
    result?.threadId ??
    result?.forkedThreadId ??
    result?.spawnedThreadId ??
    result?.newThreadId ??
    result?.id ??
    result?.thread?.id;
  requireNonEmptyString(threadId, name);
  return threadId;
}

function extractTurnId(result, name) {
  const turnId = result?.turnId ?? result?.reviewerTurnId ?? result?.id ?? result?.turn?.id;
  requireNonEmptyString(turnId, name);
  return turnId;
}

function turnWaitOptions(input = {}) {
  return {
    timeoutMs: input.turnTimeoutMs ?? TURN_TIMEOUT_MS,
    pollIntervalMs: input.pollIntervalMs ?? POLL_INTERVAL_MS,
  };
}

function appendKnownLoss(knownLosses, loss) {
  if (knownLosses.some((known) => known.includes(loss))) return knownLosses;
  return [...knownLosses, loss];
}

function defaultKnownLosses(extra = []) {
  return [...BASE_KNOWN_LOSSES, ...extra];
}

function requestModelFor(input) {
  return input.mode === 'live' ? input.model : (input.model ?? DEFAULT_MODEL);
}

function liveReviewerTurnOptions(input) {
  if (input.mode !== 'live') return {};
  const options = {
    outputSchema: REVIEWER_OUTPUT_SCHEMA,
    sandbox: REVIEWER_SANDBOX_POLICY,
    approvalPolicy: REVIEWER_APPROVAL_POLICY,
  };
  if (typeof input.reviewerCwd === 'string' && input.reviewerCwd.trim().length > 0) {
    options.cwd = input.reviewerCwd;
  }
  return options;
}

function liveSourceTurnOptions(input) {
  if (input.mode !== 'live') return {};
  return {
    sandbox: REVIEWER_SANDBOX_POLICY,
    approvalPolicy: REVIEWER_APPROVAL_POLICY,
  };
}

function liveSourcePrompt(input, text) {
  if (input.mode !== 'live') return text;
  return `${LIVE_SOURCE_NO_TOOLS_PREAMBLE}\n\n${text}`;
}

function collectorFor(input) {
  return input.evidenceCollector ?? createEvidenceCollector({
    client: input.client,
    protocol: input.protocol,
    runDir: input.runDir ?? DEFAULT_RUN_DIR,
  });
}

function nativeSpawnArtifactForCase(input, ...caseIds) {
  const artifacts = input.nativeSpawnArtifacts;
  if (!Array.isArray(artifacts)) return null;
  return artifacts.find((artifact) => caseIds.includes(artifact?.caseId)) ?? null;
}

function helperReviewerPrompt({ baseCheckpointId, prompt }) {
  return buildHelperIdentityReminder({
    baseCheckpointId,
    taskKind: 'review',
    returnedTo: 'eval-runner',
  }) + prompt;
}

function attachContextTreeSpawnAttempt(caseResult, input = {}) {
  return {
    ...caseResult,
    contextTree: {
      ...(caseResult.contextTree ?? {}),
      spawnAttempt: {
        id: `attempt-${caseResult.caseId}`,
        verdict: caseResult.verdict ?? 'inconclusive',
        failureReason: caseResult.failureReason ?? input.failureReason ?? null,
        capabilityFinding: caseResult.capabilityFinding ?? input.capabilityFinding,
        knownLosses: caseResult.knownLosses ?? caseResult.manifest?.knownLosses ?? [],
      },
    },
  };
}

function attachContextTreeManifests(caseResult, input = {}) {
  requireObject(input.checkpointAnchor, `checkpointAnchor for ${caseResult.caseId}`);
  requireNonEmptyString(input.checkpointAnchor.createdAt, 'checkpointAnchor.createdAt');

  const sourceThreadId = caseResult.sourceThreadId ?? caseResult.manifest?.sourceThreadId;
  requireNonEmptyString(sourceThreadId, 'sourceThreadId');
  const forkedThreadId = caseResult.forkedThreadId ?? caseResult.manifest?.spawnedThreadId;
  const materialSelectionMode = input.materialSelectionMode ?? caseResult.materialSelectionMode ?? 'native-fork';
  const fidelity = input.fidelity ?? caseResult.fidelity ?? 'native-context-fork';
  const searchableHistoryRef = input.searchableHistoryRef ?? caseResult.searchableHistoryRef;
  const evidenceRefs = caseResult.evidenceRefs ?? caseResult.manifest?.evidenceRefs ?? [];
  const knownLosses = caseResult.knownLosses ?? caseResult.manifest?.knownLosses ?? [];
  const checkpointId = `cp-${caseResult.caseId}`;

  const checkpointManifest = createCheckpointManifest({
    id: checkpointId,
    nodeId: `node-${sourceThreadId}`,
    sessionRef: sourceThreadId,
    anchor: input.checkpointAnchor,
    label: `${caseResult.caseId} checkpoint`,
    purpose: `Capability case ${caseResult.caseId}`,
    capture: {
      platform: 'codex',
      sessionRecordRef: caseResult.manifest?.rolloutRef ?? sourceThreadId,
      searchableHistoryRef,
      knownLosses,
    },
  });

  const spawnRunManifest = createSpawnRunManifest({
    id: `spawn-${caseResult.caseId}`,
    baseCheckpointId: checkpointManifest.id,
    requesterNodeId: `node-${sourceThreadId}`,
    childNodeId: forkedThreadId ? `node-${forkedThreadId}` : undefined,
    task: {
      kind: 'review',
      prompt: input.reviewerPrompt ?? 'capability reviewer prompt unavailable',
      targetRefs: [],
    },
    materialSelectionMode,
    fidelity,
    searchableHistoryRef,
    evidenceRefs,
    knownLosses,
    verdict: caseResult.verdict,
  });

  const spawnResultManifest = caseResult.observedAnswer
    ? createSpawnResultManifest({
        id: `result-${caseResult.caseId}`,
        spawnRunId: spawnRunManifest.id,
        resultRef: `answer:${caseResult.caseId}`,
        returnedTo: 'eval-runner',
        summary: String(caseResult.observedAnswer).slice(0, 240),
        evidenceRefs,
      })
    : undefined;

  return {
    ...caseResult,
    contextTree: {
      ...(caseResult.contextTree ?? {}),
      checkpointManifest,
      spawnRunManifest,
      ...(spawnResultManifest ? { spawnResultManifest } : {}),
    },
  };
}

async function writeContextTreeArtifactsForCases(caseResults, runDir) {
  return Promise.all(caseResults.map(async (caseResult) => {
    const contextTree = caseResult.contextTree;
    if (!contextTree?.checkpointManifest && !contextTree?.spawnRunManifest && !contextTree?.spawnResultManifest) {
      return caseResult;
    }

    const outputDir = join(runDir, 'context-tree', caseResult.caseId);
    const written = await writeContextTreeManifestArtifacts({
      outputDir,
      checkpointManifest: contextTree.checkpointManifest,
      spawnRunManifest: contextTree.spawnRunManifest,
      spawnResultManifest: contextTree.spawnResultManifest,
    });
    const artifactRefs = {};
    if (written.checkpointManifestPath) artifactRefs.checkpointManifestPath = written.checkpointManifestPath;
    if (written.spawnRunManifestPath) artifactRefs.spawnRunManifestPath = written.spawnRunManifestPath;
    if (written.spawnResultManifestPath) artifactRefs.spawnResultManifestPath = written.spawnResultManifestPath;

    return {
      ...caseResult,
      contextTree: {
        ...contextTree,
        artifactRefs,
      },
    };
  }));
}

function contextTreeArtifactOutputDir(runDir, caseId) {
  return join(runDir, 'context-tree', caseId);
}

// ─── Prompt / evidence helpers ───────────────────────────────────────

function promptAuditEvidence(prompt, canaries) {
  const audit = auditPromptForLeaks(prompt, canaries);
  if (audit.leaked) {
    throw new Error(`prompt leak detected: ${audit.leaks.join(', ')}`);
  }

  const allCanaries = Object.values(canaries);
  return {
    kind: 'prompt-audit',
    ref: 'prompt-audit:inline',
    contains: audit.leaks,
    missing: allCanaries.filter((canary) => !audit.leaks.includes(canary)),
    leaked: audit.leaked,
  };
}

function reviewerPromptForCase(caseId) {
  if (caseId === 'negative-fresh-thread' || caseId === 'negative-fork-turns-none') {
    return buildReviewerPrompt('user-assistant-canary');
  }
  return buildReviewerPrompt(caseId);
}

function buildSummaryOnlyReviewerPrompt(sanitizedSummary) {
  return (
    'Summary-only context (negative control — not a success path):\n' +
    String(sanitizedSummary) +
    '\n\n' +
    buildReviewerPrompt('user-assistant-canary')
  );
}

function liveReviewerPrompt(input, prompt) {
  if (input.mode !== 'live') return prompt;
  return `${LIVE_REVIEWER_NO_TOOLS_PREAMBLE}\n\n${prompt}`;
}

function reviewerAnswerText(evidenceRefs) {
  return evidenceRefs
    .filter((ref) => ref.kind === 'reviewer-answer')
    .map((ref) => ref.excerpt ?? ref.text ?? ref.observedAnswer ?? '')
    .filter((text) => text.length > 0)
    .join('\n')
    .trim();
}

function rolloutToolContaminationObserved(evidenceRefs = []) {
  return evidenceRefs.some((ref) =>
    ref.kind === 'rollout' && (ref.toolsUsed === true || ref.toolResultExposed === true)
  );
}

function isTurnCompletionTimeout(err) {
  return /timed out waiting for turn\/completed/i.test(String(err?.message ?? err));
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function parseReviewerOracle(ref) {
  const raw = ref?.excerpt ?? ref?.text ?? ref?.observedAnswer ?? '';
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      answer: parsed.answer,
      values: uniqueStrings(Array.isArray(parsed.values) ? parsed.values : []),
    };
  } catch {
    return null;
  }
}

function observedCanariesFromEvidenceRefs(evidenceRefs) {
  const reviewerAnswers = evidenceRefs
    .filter((ref) => ref.kind === 'reviewer-answer')
    .map(parseReviewerOracle)
    .filter(Boolean);
  if (reviewerAnswers.length > 0) {
    return uniqueStrings(reviewerAnswers.flatMap((answer) => answer.values));
  }
  const text = reviewerAnswerText(evidenceRefs);
  return uniqueStrings(text.match(/CTREE-(?:USER|DECISION|TOOL|PRECOMPACT|COMPACT-SUMMARY|POSTCOMPACT|SURVIVE|ROLLBACK)-[A-Za-z0-9_-]+/g) ?? []);
}

function mergeEvidenceRefs(...groups) {
  return groups.flat().filter((ref) => ref && typeof ref === 'object');
}

function threadTurnsFromThreadRead(threadData) {
  if (Array.isArray(threadData?.turns)) return threadData.turns;
  if (Array.isArray(threadData?.thread?.turns)) return threadData.thread.turns;
  return [];
}

function threadTurnId(turn) {
  if (typeof turn?.turnId === 'string') return turn.turnId;
  if (typeof turn?.id === 'string') return turn.id;
  return undefined;
}

function isAssistantHistoryItem(item) {
  return item?.role === 'agent' || item?.role === 'assistant' || item?.type === 'agentMessage';
}

function extractPersistedAssistantText(threadData, excludeTurnId) {
  const parts = [];
  const turns = threadTurnsFromThreadRead(threadData);
  for (const turn of turns) {
    if (excludeTurnId !== undefined && threadTurnId(turn) === excludeTurnId) continue;
    for (const item of turn?.items ?? []) {
      if (!isAssistantHistoryItem(item)) continue;
      if (typeof item.text === 'string' && item.text.length > 0) parts.push(item.text);
      for (const part of item?.content ?? []) {
        if (part?.type === 'text' && typeof part.text === 'string' && part.text.length > 0) {
          parts.push(part.text);
        }
      }
    }
  }
  return parts.join('\n');
}

function historySearchEvidenceRef({ searchableHistoryRef, threadId, canaries, text }) {
  const allCanaries = Object.values(canaries);
  const contains = allCanaries.filter((canary) => text.includes(canary));
  const missing = allCanaries.filter((canary) => !contains.includes(canary));
  return {
    kind: 'history-search',
    ref: `${searchableHistoryRef}#current-boundary-search`,
    threadId,
    searchableHistoryRef,
    persistedHistory: true,
    contains,
    missing,
    excerpt: text,
  };
}

function stableDigest(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function optionalNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function buildSearchableHistoryMaterialItem({ historyRef, evidenceRef, text, index }) {
  const immutableSnapshotRef = `${evidenceRef.ref}#item-${index + 1}`;
  return {
    materialRef: immutableSnapshotRef,
    sourceRef: historyRef,
    selectionMode: 'searchable-history',
    visibility: 'searchable',
    evidenceRefs: [{ kind: evidenceRef.kind, ref: evidenceRef.ref }],
    contentDigest: stableDigest(text),
    immutableSnapshotRef,
  };
}

function buildPreparedPromptMaterialItems(config, preparedPromptEvidence) {
  const items = [];
  const prepared = preparedMemberRequestFor(config);
  const snapshotByRef = new Map((prepared?.materialSnapshots ?? []).map((snapshot) => [snapshot.materialRef, snapshot]));
  const immutableProofFields = (ref) => {
    const snapshot = snapshotByRef.get(ref);
    if (!snapshot || typeof snapshot !== 'object') {
      return { digestUnavailable: 'prepared-request-snapshot-missing' };
    }
    return {
      ...(typeof snapshot.contentDigest === 'string' && snapshot.contentDigest.trim().length > 0
        ? { contentDigest: snapshot.contentDigest }
        : {}),
      ...(typeof snapshot.snapshotRef === 'string' && snapshot.snapshotRef.trim().length > 0
        ? { snapshotRef: snapshot.snapshotRef }
        : {}),
      ...(typeof snapshot.digestUnavailable === 'string' && snapshot.digestUnavailable.trim().length > 0
        ? { digestUnavailable: snapshot.digestUnavailable }
        : {}),
    };
  };
  if (optionalNonEmptyString(prepared?.profileRef)) {
    items.push({
      materialRef: prepared.profileRef,
      sourceRef: prepared.profileRef,
      selectionMode: 'prepared-prompt',
      visibility: 'intended-model-input',
      evidenceRefs: [preparedPromptEvidence],
      ...immutableProofFields(prepared.profileRef),
    });
  }
  for (const ref of prepared?.roleHistoryRefs ?? []) {
    items.push({
      materialRef: ref,
      sourceRef: ref,
      selectionMode: 'prepared-prompt',
      visibility: 'intended-model-input',
      evidenceRefs: [preparedPromptEvidence],
      ...immutableProofFields(ref),
    });
  }
  for (const ref of prepared?.targetRefs ?? []) {
    items.push({
      materialRef: ref,
      sourceRef: ref,
      selectionMode: 'prepared-prompt',
      visibility: 'intended-model-input',
      evidenceRefs: [preparedPromptEvidence],
      ...immutableProofFields(ref),
    });
  }
  return items;
}

function buildSearchableHistoryDiagnostic({
  caseResult,
  config,
  checkpointAnchor,
  searchableHistoryRef,
  historyEvidenceRef,
  historyText,
}) {
  const preparedPromptEvidence = optionalNonEmptyString(config?.memberTaskRequestRef)
    ? [{
        kind: 'prompt-audit',
        ref: config.memberTaskRequestRef,
        ...(optionalNonEmptyString(config.requestPromptDigest) ? { digest: config.requestPromptDigest } : {}),
      }][0]
    : undefined;
  const contextSources = [
    { kind: 'searchable-history', historyRef: searchableHistoryRef },
    { kind: 'parent-session', sessionRef: caseResult.sourceThreadId, anchor: { turnId: checkpointAnchor.turnId } },
    ...(preparedMemberRequestFor(config)?.targetRefs ?? []).map((targetRef) => ({ kind: 'target-material', targetRef })),
    ...(optionalNonEmptyString(preparedMemberRequestFor(config)?.profileRef)
      ? [{ kind: 'member-profile', memberName: preparedMemberRequestFor(config).memberName, profileRef: preparedMemberRequestFor(config).profileRef }]
      : []),
    ...(preparedMemberRequestFor(config)?.roleHistoryRefs ?? []).map((historyRef) => ({
      kind: 'role-history',
      memberName: preparedMemberRequestFor(config).memberName,
      historyRef,
    })),
  ];
  const items = [
    buildSearchableHistoryMaterialItem({ historyRef: searchableHistoryRef, evidenceRef: historyEvidenceRef, text: historyText, index: 0 }),
    ...(preparedPromptEvidence ? buildPreparedPromptMaterialItems(config, preparedPromptEvidence) : []),
  ];
  return {
    memberName: preparedMemberRequestFor(config)?.memberName,
    resolvedMemberId: preparedMemberRequestFor(config)?.resolvedMemberId,
    memberTaskRequestRef: config?.memberTaskRequestRef,
    task: preparedMemberRequestFor(config)?.task ?? {
      kind: config?.taskKind ?? 'review',
      question: config?.question ?? caseResult.observedAnswer,
      targetRefs: config?.targetRefs ?? [],
    },
    materialSelectionMode: 'searchable-history',
    fidelity: 'session-record-mounted',
    contextSources,
    materials: {
      items,
      intendedInputEvidenceRefs: preparedPromptEvidence ? [preparedPromptEvidence] : [],
      runtimeInputEvidenceRefs: [],
      providerModelInputEvidenceRefs: [],
      mountedEvidenceRefs: [],
      searchableEvidenceRefs: [{ kind: historyEvidenceRef.kind, ref: historyEvidenceRef.ref }],
      sourceOnlyRefs: [],
    },
    outcome: {
      status: caseResult.verdict === 'pass' && config?.preparedMemberRequest ? 'inconclusive' : (caseResult.verdict === 'pass' ? 'inconclusive' : caseResult.verdict),
      summary: config?.preparedMemberRequest
        ? 'Searchable-history material path observed but member execution proof boundary not satisfied.'
        : 'Searchable-history material path observed without prepared member execution proof.',
    },
    result: {
      resultRef: `answer:${caseResult.caseId}`,
      returnedTo: config?.expectedResultReturn ?? 'eval-runner',
      summary: caseResult.observedAnswer,
    },
    evidenceRefs: caseResult.evidenceRefs,
  };
}

function preparedMemberRequestFor(config) {
  return config?.preparedMemberRequest
    ?? config?.preparedMemberRequestPathData
    ?? config?.preparedRequest
    ?? undefined;
}

async function maybeRecordSearchableHistoryMemberTaskRun({
  caseResult,
  input,
  checkpointAnchor,
  searchableHistoryRef,
  historyEvidenceRef,
  historyText,
}) {
  const config = input.memberTaskRunConfig;
  if (caseResult.caseId !== 'current-boundary-spawn-canary' || caseResult.method !== 'searchable-history-query') {
    return caseResult;
  }

  const diagnostic = buildSearchableHistoryDiagnostic({
    caseResult,
    config,
    checkpointAnchor,
    searchableHistoryRef,
    historyEvidenceRef,
    historyText,
  });

  const baseContextTree = {
    ...(caseResult.contextTree ?? {}),
    memberTaskRunDiagnostic: diagnostic,
  };

  const prepared = preparedMemberRequestFor(config);
  const spawnResultManifestRef = caseResult.contextTree?.artifactRefs?.spawnResultManifestPath
    ?? join(contextTreeArtifactOutputDir(input.runDir, caseResult.caseId), 'spawn-result.json');
  const hasReturnedResult = typeof caseResult.observedAnswer === 'string' && caseResult.observedAnswer.trim().length > 0;
  const canRecordSuccessfulMemberRun = (
    prepared
    && config.forceSearchableHistoryPath === true
    && caseResult.verdict === 'pass'
    && hasReturnedResult
    && typeof spawnResultManifestRef === 'string'
    && spawnResultManifestRef.trim().length > 0
  );
  if (!canRecordSuccessfulMemberRun) {
    return {
      ...caseResult,
      contextTree: baseContextTree,
    };
  }

  const preparedPromptEvidence = {
    kind: 'prompt-audit',
    ref: config.memberTaskRequestRef,
    ...(optionalNonEmptyString(config.requestPromptDigest) ? { digest: config.requestPromptDigest } : {}),
  };
  const materials = {
    items: [
      buildSearchableHistoryMaterialItem({ historyRef: searchableHistoryRef, evidenceRef: historyEvidenceRef, text: historyText, index: 0 }),
      ...buildPreparedPromptMaterialItems(config, preparedPromptEvidence),
    ],
    intendedInputEvidenceRefs: [preparedPromptEvidence],
    runtimeInputEvidenceRefs: [],
    providerModelInputEvidenceRefs: [],
    mountedEvidenceRefs: [],
    searchableEvidenceRefs: [{ kind: historyEvidenceRef.kind, ref: historyEvidenceRef.ref }],
    sourceOnlyRefs: [],
  };
  const contextSources = [
    { kind: 'searchable-history', historyRef: searchableHistoryRef },
    { kind: 'parent-session', sessionRef: caseResult.sourceThreadId, anchor: { turnId: checkpointAnchor.turnId } },
    { kind: 'member-profile', memberName: prepared.memberName, profileRef: prepared.profileRef },
    ...prepared.roleHistoryRefs.map((historyRef) => ({ kind: 'role-history', memberName: prepared.memberName, historyRef })),
    ...prepared.targetRefs.map((targetRef) => ({ kind: 'target-material', targetRef })),
  ];

  const recorded = await recordMemberTaskRunToContextTree({
    outputDir: input.runDir,
    memberName: prepared.memberName,
    resolvedMemberId: prepared.resolvedMemberId,
    requesterRef: caseResult.sourceThreadId,
    activationPoint: {
      ...prepared.activationPoint,
      checkpointId: caseResult.contextTree?.checkpointManifest?.id,
    },
    task: prepared.task,
    memberTaskRequestRef: config.memberTaskRequestRef,
    contextSources,
    materials,
    materialSelectionMode: 'searchable-history',
    fidelity: 'session-record-mounted',
    evidenceRefs: caseResult.evidenceRefs,
    knownLosses: caseResult.knownLosses,
    outcome: {
      status: 'pass',
      summary: 'Searchable-history member task run recorded through a child execution boundary.',
    },
    result: {
      resultRef: spawnResultManifestRef,
      returnedTo: prepared.expectedResultReturn,
      summary: caseResult.observedAnswer,
    },
  });

  return {
    ...caseResult,
    contextTree: {
      ...baseContextTree,
      memberTaskRun: recorded.memberTaskRun,
      memberTaskRunPath: recorded.memberTaskRunPath,
      memberTaskRunDiagnostic: undefined,
    },
  };
}

function hasKnownLoss(knownLosses, fragment) {
  return knownLosses.some((loss) => typeof loss === 'string' && loss.includes(fragment));
}

function turnReadContainsCanary(evidenceRefs, canary) {
  return evidenceRefs.some((ref) =>
    ref?.kind === 'turn-read'
    && ref?.persistedHistory === true
    && Array.isArray(ref.contains)
    && ref.contains.includes(canary)
  );
}

function rollbackCompatibilityFinding({ caseId, mode, knownLosses, evidenceRefs, observedCanaries, canaries }) {
  if (caseId !== 'rollback-canary' || mode !== 'live') return null;
  if (!hasKnownLoss(knownLosses, 'lastTurnId compatibility path')) return null;

  const reviewerSawRolledBackCanary = observedCanaries.includes(canaries.rollback);
  const persistedHistoryShowsRolledBackCanary = turnReadContainsCanary(evidenceRefs, canaries.rollback);

  if (reviewerSawRolledBackCanary && !persistedHistoryShowsRolledBackCanary) {
    return 'rollback compatibility path retained hidden context beyond persisted history';
  }

  return null;
}

function hasObservedCompactionBoundary(evidenceRefs) {
  return evidenceRefs.some((ref) => {
    if (ref?.boundary === 'compaction-boundary') return true;
    if (ref?.observedBoundary === 'compaction-boundary') return true;
    const details = [ref?.ref, ref?.reason, ref?.event, ref?.phase]
      .filter((value) => typeof value === 'string')
      .join(' ');
    return /\bcompaction\b|replacement[-_ ]history/i.test(details);
  });
}

// ─── Client operation helpers ────────────────────────────────────────

async function startOwnedThread(input) {
  const { client, cwd } = input;
  const result = await client.request(
    'thread/start',
    buildThreadStartParams({ cwd, model: requestModelFor(input) }),
  );
  return {
    threadId: extractThreadId(result, 'threadId'),
    evidenceRefs: [],
    evalOwned: true,
  };
}

async function appendContextTurn(input) {
  const { client, collector, cwd, threadId, text } = input;
  const turnOptions = liveSourceTurnOptions(input);
  const turnResult = await client.request(
    'turn/start',
    buildTurnStartParams({
      threadId,
      input: liveSourcePrompt(input, text),
      cwd,
      model: requestModelFor(input),
      approvalPolicy: input.approvalPolicy ?? turnOptions.approvalPolicy,
      sandbox: input.sandbox ?? turnOptions.sandbox,
    }),
  );
  const turnId = extractTurnId(turnResult, 'turnId');
  await collector.waitForTurnCompleted(threadId, turnId, turnWaitOptions(input));
  return turnId;
}

async function runDirectReviewerTurn({
  client,
  collector,
  cwd,
  threadId,
  prompt,
  canaries,
  mode,
  model,
  outputSchema,
  sandbox,
  approvalPolicy,
  turnTimeoutMs,
  pollIntervalMs,
}) {
  const turnResult = await client.request(
    'turn/start',
    buildTurnStartParams({
      threadId,
      input: prompt,
      cwd,
      model: requestModelFor({ client, collector, cwd, threadId, prompt, canaries, mode, model }),
      approvalPolicy,
      outputSchema,
      sandbox,
    }),
  );
  const reviewerTurnId = extractTurnId(turnResult, 'reviewerTurnId');
  try {
    await collector.waitForTurnCompleted(
      threadId,
      reviewerTurnId,
      turnWaitOptions({ turnTimeoutMs, pollIntervalMs }),
    );
  } catch (err) {
    err.reviewerTurnId = reviewerTurnId;
    err.threadId = threadId;
    err.partialEvidenceRefs = mergeEvidenceRefs(
      await collector.collectThreadEvidence(threadId, canaries),
      await collector.collectModelRequestEvidence(canaries),
    );
    throw err;
  }
  return {
    reviewerTurnId,
    evidenceRefs: mergeEvidenceRefs(
      await collector.collectReviewerAnswer(threadId, reviewerTurnId),
      await collector.collectThreadEvidence(threadId, canaries, { excludeTurnId: reviewerTurnId }),
      await collector.collectModelRequestEvidence(canaries),
    ),
  };
}

async function forkReviewer({
  client,
  protocol,
  runDir,
  cwd,
  threadId,
  sourceThreadId,
  caseId,
  prompt,
  canaries,
  excludeTurns,
  recoveryMethod = 'codex-thread-fork',
  boundary = 'current-stable-turn',
  transformLayers = [],
  knownLosses = [],
  mode,
  model,
  outputSchema,
  sandbox,
  approvalPolicy,
  turnTimeoutMs,
  pollIntervalMs,
}) {
  const forkFromThreadId = threadId ?? sourceThreadId;
  return forkReviewerFromThread(client, protocol, {
    threadId: forkFromThreadId,
    sourceThreadId,
    cwd,
    model: requestModelFor({ mode, model }),
    approvalPolicy,
    caseId,
    prompt,
    canaries,
    excludeTurns,
    recoveryMethod,
    boundary,
    transformLayers,
    knownLosses,
    runDir,
    outputSchema,
    sandbox,
    timeoutMs: turnTimeoutMs ?? TURN_TIMEOUT_MS,
    pollIntervalMs: pollIntervalMs ?? POLL_INTERVAL_MS,
  });
}

async function startUserAssistantSource(input, canaries) {
  const turnOptions = liveSourceTurnOptions(input);
  return startEvalThread(input.client, input.protocol, {
    cwd: input.cwd,
    model: requestModelFor(input),
    canaries,
    approvalPolicy: input.approvalPolicy ?? turnOptions.approvalPolicy,
    sandbox: input.sandbox ?? turnOptions.sandbox,
    promptPreamble: input.mode === 'live' ? LIVE_SOURCE_NO_TOOLS_PREAMBLE : undefined,
    runDir: input.runDir,
    timeoutMs: input.turnTimeoutMs ?? TURN_TIMEOUT_MS,
    pollIntervalMs: input.pollIntervalMs ?? POLL_INTERVAL_MS,
  });
}

// ─── Verdict / manifest assembly ─────────────────────────────────────

function decideCaseVerdict({
  caseId,
  expectedCanaries,
  forbiddenCanaries,
  observedCanaries,
  knownLosses,
  negativeControl,
  method,
  forcedVerdict,
  forcedFailureReason,
}) {
  const leakedCanary = forbiddenCanaries.find((canary) => observedCanaries.includes(canary)) ?? null;
  if (leakedCanary) {
    return {
      verdict: 'fail',
      failureReason: 'negative control leaked canary',
      leakedCanary,
    };
  }

  if (forcedVerdict) {
    return {
      verdict: forcedVerdict,
      failureReason: forcedFailureReason ?? null,
      leakedCanary,
    };
  }

  if (negativeControl) {
    return {
      verdict: method === 'summary-only' ? 'inconclusive' : 'pass',
      failureReason: null,
      leakedCanary,
    };
  }

  const missingExpected = expectedCanaries.filter((canary) => !observedCanaries.includes(canary));
  if (missingExpected.length > 0) {
    if (
      caseId === 'tool-result-canary' &&
      knownLosses.some((loss) => loss.includes('tool-result'))
    ) {
      return {
        verdict: 'inconclusive',
        failureReason: 'known-loss:tool-result-filtered',
        leakedCanary,
      };
    }

    return {
      verdict: 'fail',
      failureReason: `missing expected canary: ${missingExpected.join(', ')}`,
      leakedCanary,
    };
  }

  return {
    verdict: 'pass',
    failureReason: null,
    leakedCanary,
  };
}

function createManifestForResult({
  verdict,
  method,
  sourceThreadId,
  forkedThreadId,
  boundary,
  codexApi,
  transformLayers,
  knownLosses,
  evidenceRefs,
  negativeControl,
  compatFallback,
}) {
  return createCaptureManifest({
    verdict,
    recoveryMethod: method,
    sourceThreadId,
    spawnedThreadId: forkedThreadId,
    boundary,
    codexApi,
    transformLayers,
    knownLosses,
    evidenceRefs,
    negativeControl,
    compatFallback,
  });
}

function finalizeCaseResult(input) {
  const expectedCanaries = expectedCanariesForCase(input.caseId, input.canaries);
  const forbiddenCanaries = forbiddenCanariesForCase(input.caseId, input.canaries);
  const observedAnswer = input.observedAnswer ?? reviewerAnswerText(input.evidenceRefs);
  const observedCanaries = observedCanariesFromEvidenceRefs(input.evidenceRefs);
  const rollbackFinding = rollbackCompatibilityFinding({
    caseId: input.caseId,
    mode: input.mode,
    knownLosses: input.knownLosses,
    evidenceRefs: input.evidenceRefs,
    observedCanaries,
    canaries: input.canaries,
  });
  const knownLosses = rollbackFinding
    ? appendKnownLoss(input.knownLosses, rollbackFinding)
    : input.knownLosses;

  const decision = decideCaseVerdict({
    caseId: input.caseId,
    expectedCanaries,
    forbiddenCanaries,
    observedCanaries,
    knownLosses,
    negativeControl: input.negativeControl,
    method: input.method,
    forcedVerdict: input.forcedVerdict,
    forcedFailureReason: input.forcedFailureReason,
  });

  const manifest = createManifestForResult({
    verdict: decision.verdict,
    method: input.method,
    sourceThreadId: input.sourceThreadId,
    forkedThreadId: input.forkedThreadId,
    boundary: input.boundary,
    codexApi: input.codexApi,
    transformLayers: input.transformLayers,
    knownLosses,
    evidenceRefs: input.evidenceRefs,
    negativeControl: input.negativeControl,
    compatFallback: input.compatFallback,
  });

  const baseResult = {
    caseId: input.caseId,
    sourceThreadId: input.sourceThreadId,
    method: input.method,
    expectedCanaries,
    forbiddenCanaries,
    observedAnswer,
    evidenceRefs: input.evidenceRefs,
    knownLosses,
    verdict: decision.verdict,
    failureReason:
      rollbackFinding && decision.failureReason === 'negative control leaked canary'
        ? `${decision.failureReason}: ${rollbackFinding}`
        : decision.failureReason,
    manifest,
    leakedCanary: decision.leakedCanary,
  };
  if (input.forkedThreadId !== undefined) baseResult.forkedThreadId = input.forkedThreadId;

  const gated = applyEvidenceGate(baseResult, { mode: input.mode });
  const finalEvidenceRefs = gated.manifest.evidenceRefs;
  const finalKnownLosses = gated.manifest.knownLosses ?? knownLosses;
  const finalManifest = createManifestForResult({
    verdict: gated.verdict,
    method: input.method,
    sourceThreadId: input.sourceThreadId,
    forkedThreadId: input.forkedThreadId,
    boundary: input.boundary,
    codexApi: input.codexApi,
    transformLayers: input.transformLayers,
    knownLosses: finalKnownLosses,
    evidenceRefs: finalEvidenceRefs,
    negativeControl: input.negativeControl,
    compatFallback: input.compatFallback,
  });

  const finalResult = {
    caseId: input.caseId,
    sourceThreadId: input.sourceThreadId,
    method: input.method,
    expectedCanaries,
    forbiddenCanaries,
    observedAnswer,
    evidenceRefs: finalEvidenceRefs,
    knownLosses: finalKnownLosses,
    verdict: gated.verdict,
    failureReason:
      rollbackFinding
      && (gated.failureReason ?? decision.failureReason) === 'negative control leaked canary'
        ? `negative control leaked canary: ${rollbackFinding}`
        : (gated.failureReason ?? decision.failureReason ?? null),
    manifest: finalManifest,
  };
  if (input.forkedThreadId !== undefined) finalResult.forkedThreadId = input.forkedThreadId;

  if (input.caseId === 'tool-result-canary') {
    finalResult.capabilityFinding = classifyToolResultFinding(finalResult);
  } else if (input.caseId === 'compaction-canary') {
    finalResult.capabilityFinding = classifyCompactionFinding(finalResult);
  } else if (input.caseId === 'rollback-canary' && rollbackFinding) {
    finalResult.capabilityFinding = rollbackFinding;
  } else if (input.capabilityFinding !== undefined) {
    finalResult.capabilityFinding = input.capabilityFinding;
  }

  return finalResult;
}

// ─── Case runners ────────────────────────────────────────────────────

async function runUserAssistantCase(input, canaries) {
  const source = await startUserAssistantSource(input, canaries);
  const prompt = liveReviewerPrompt(input, reviewerPromptForCase('user-assistant-canary'));
  const auditRef = promptAuditEvidence(prompt, canaries);
  const forked = await forkReviewer({
    ...input,
    ...liveReviewerTurnOptions(input),
    sourceThreadId: source.threadId,
    caseId: 'user-assistant-canary',
    prompt,
    canaries,
  });

  return finalizeCaseResult({
    caseId: 'user-assistant-canary',
    canaries,
    mode: input.mode,
    sourceThreadId: forked.sourceThreadId,
    forkedThreadId: forked.forkedThreadId,
    method: forked.manifest.recoveryMethod,
    boundary: forked.manifest.boundary,
    codexApi: input.mode === 'mock' ? 'mock' : forked.manifest.codexApi,
    transformLayers: forked.manifest.transformLayers,
    knownLosses: forked.manifest.knownLosses,
    evidenceRefs: mergeEvidenceRefs(source.evidenceRefs, auditRef, forked.evidenceRefs),
  });
}

async function runNegativeFreshThreadCase(input, canaries) {
  const source = await startOwnedThread(input);
  if (input.mode === 'live') {
    await appendContextTurn({
      ...input,
      threadId: source.threadId,
      text:
        'Fresh thread baseline only. No preserved eval records or canaries are available in this thread.',
    });
  }
  const prompt = liveReviewerPrompt(input, reviewerPromptForCase('negative-fresh-thread'));
  const auditRef = promptAuditEvidence(prompt, canaries);
  let forked;
  try {
    forked = await forkReviewer({
      ...input,
      ...liveReviewerTurnOptions(input),
      sourceThreadId: source.threadId,
      caseId: 'negative-fresh-thread',
      prompt,
      canaries,
    });
  } catch (err) {
    const partialEvidenceRefs = err?.partialEvidenceRefs ?? [];
      if (input.mode === 'live' && isTurnCompletionTimeout(err) && rolloutToolContaminationObserved(partialEvidenceRefs)) {
      return finalizeCaseResult({
        caseId: 'negative-fresh-thread',
        canaries,
        mode: input.mode,
        sourceThreadId: source.threadId,
        forkedThreadId: err?.forkedThreadId,
        method: 'codex-thread-fork',
        boundary: 'current-stable-turn',
        codexApi: 'app-server-thread-fork',
        transformLayers: [],
          knownLosses: defaultKnownLosses([LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS]),
        evidenceRefs: mergeEvidenceRefs(auditRef, partialEvidenceRefs),
        negativeControl: true,
        forcedVerdict: 'inconclusive',
          forcedFailureReason: LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS,
          capabilityFinding: LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS,
      });
    }
    throw err;
  }

  return finalizeCaseResult({
    caseId: 'negative-fresh-thread',
    canaries,
    mode: input.mode,
    sourceThreadId: forked.sourceThreadId,
    forkedThreadId: forked.forkedThreadId,
    method: forked.manifest.recoveryMethod,
    boundary: forked.manifest.boundary,
    codexApi: input.mode === 'mock' ? 'mock' : forked.manifest.codexApi,
    transformLayers: forked.manifest.transformLayers,
    knownLosses: forked.manifest.knownLosses,
    evidenceRefs: mergeEvidenceRefs(auditRef, forked.evidenceRefs),
    negativeControl: true,
  });
}

async function runNegativeSummaryOnlyCase(input, canaries) {
  const source = await startOwnedThread(input);
  const prompt = liveReviewerPrompt(
    input,
    buildSummaryOnlyReviewerPrompt(
      'Sanitized summary only: no turn-level detail and no canary-bearing context are available.',
    ),
  );
  const auditRef = promptAuditEvidence(prompt, canaries);
  let reviewer;
  try {
    reviewer = await runDirectReviewerTurn({
      ...input,
      ...liveReviewerTurnOptions(input),
      threadId: source.threadId,
      prompt,
      canaries,
    });
  } catch (err) {
    const partialEvidenceRefs = err?.partialEvidenceRefs ?? [];
      if (input.mode === 'live' && isTurnCompletionTimeout(err) && rolloutToolContaminationObserved(partialEvidenceRefs)) {
      return finalizeCaseResult({
        caseId: 'negative-summary-only',
        canaries,
        mode: input.mode,
        sourceThreadId: source.threadId,
        method: 'summary-only',
        boundary: 'unknown',
        codexApi: 'app-server-thread-fork',
        transformLayers: [],
        knownLosses: defaultKnownLosses([
          'summary-only lacks full turn-level detail',
            LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS,
        ]),
        evidenceRefs: mergeEvidenceRefs(auditRef, partialEvidenceRefs),
        negativeControl: true,
        compatFallback: true,
        forcedVerdict: 'inconclusive',
          forcedFailureReason: LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS,
          capabilityFinding: LIVE_REVIEWER_TOOL_CONTAMINATION_LOSS,
      });
    }
    throw err;
  }

  return finalizeCaseResult({
    caseId: 'negative-summary-only',
    canaries,
    mode: input.mode,
    sourceThreadId: source.threadId,
    method: 'summary-only',
    boundary: 'unknown',
    codexApi: input.mode === 'mock' ? 'mock' : 'app-server-thread-fork',
    transformLayers: [],
    knownLosses: defaultKnownLosses(['summary-only lacks full turn-level detail']),
    evidenceRefs: mergeEvidenceRefs(auditRef, reviewer.evidenceRefs),
    negativeControl: true,
    compatFallback: true,
    forcedVerdict: 'inconclusive',
  });
}

async function runNegativeForkTurnsNoneCase(input, canaries) {
  const source = await startUserAssistantSource(input, canaries);
  const prompt = liveReviewerPrompt(input, reviewerPromptForCase('negative-fork-turns-none'));
  const auditRef = promptAuditEvidence(prompt, canaries);

  const probed = await probeCurrentBoundarySpawn(input.client, input.protocol, {
    sourceThreadId: source.threadId,
    threadId: source.threadId,
    cwd: input.cwd,
    model: requestModelFor(input),
    caseId: 'negative-fork-turns-none',
    prompt,
    canaries,
    forkTurns: 'none',
  });

  return finalizeCaseResult({
    caseId: 'negative-fork-turns-none',
    canaries,
    mode: input.mode,
    sourceThreadId: probed.sourceThreadId ?? source.threadId,
    method: 'codex-spawn-agent-full-history',
    boundary: probed.manifest?.boundary ?? 'current-stable-turn',
    codexApi: probed.manifest?.codexApi ?? 'multiagent-v2-fork_turns',
    transformLayers: [],
    knownLosses: defaultKnownLosses([SPAWN_UNAVAILABLE]),
    evidenceRefs: mergeEvidenceRefs(source.evidenceRefs, auditRef, probed.evidenceRefs ?? []),
    negativeControl: true,
    forcedVerdict: 'inconclusive',
    forcedFailureReason: SPAWN_UNAVAILABLE,
    capabilityFinding: SPAWN_UNAVAILABLE,
  });
}

async function runToolResultCase(input, canaries) {
  const source = await startOwnedThread(input);
  const injectionRefs = await injectToolResultCanary(input.client, input.protocol, {
    threadId: source.threadId,
    canaries,
    seed: input.seed,
    evalOwned: source.evalOwned,
  });
  const prompt = liveReviewerPrompt(input, reviewerPromptForCase('tool-result-canary'));
  const auditRef = promptAuditEvidence(prompt, canaries);
  const forked = await forkReviewer({
    ...input,
    ...liveReviewerTurnOptions(input),
    sourceThreadId: source.threadId,
    caseId: 'tool-result-canary',
    prompt,
    canaries,
  });

  const evidenceRefs = mergeEvidenceRefs(injectionRefs, auditRef, forked.evidenceRefs);
  const observedAnswer = reviewerAnswerText(evidenceRefs);
  let knownLosses = [...forked.manifest.knownLosses];
  if (
    !observedAnswer.includes(canaries.tool) ||
    injectionRefs.some((ref) => String(ref.reason ?? ref.ref ?? '').includes('tool-injection-unavailable'))
  ) {
    knownLosses = appendKnownLoss(knownLosses, 'tool-result-filtered');
  }

  return finalizeCaseResult({
    caseId: 'tool-result-canary',
    canaries,
    mode: input.mode,
    sourceThreadId: forked.sourceThreadId,
    forkedThreadId: forked.forkedThreadId,
    method: forked.manifest.recoveryMethod,
    boundary: forked.manifest.boundary,
    codexApi: input.mode === 'mock' ? 'mock' : forked.manifest.codexApi,
    transformLayers: forked.manifest.transformLayers,
    knownLosses,
    evidenceRefs,
    observedAnswer,
  });
}

async function runRollbackCase(input, canaries) {
  const source = await startOwnedThread(input);
  const surviveTurnId = await appendContextTurn({
    ...input,
    threadId: source.threadId,
    text:
      'Rollback survivor record. This turn must survive rollback recovery.\n' +
      `ROLLBACK_SURVIVOR = ${canaries.survive}`,
  });

  if (input.mode === 'live') {
    const rolledBackTurnId = await appendContextTurn({
      ...input,
      threadId: source.threadId,
      text:
        'Rolled-back record. This turn must disappear after rollback recovery.\n' +
        `ROLLED_BACK_RECORD = ${canaries.rollback}`,
    });

    const threadData = await input.client.request('thread/read', {
      threadId: source.threadId,
      includeTurns: true,
    });
    const persistedText = extractPersistedAssistantText(threadData, rolledBackTurnId);
    const searchableHistoryRef = `thread/read:${source.threadId}`;
    const historySearchRef = historySearchEvidenceRef({
      searchableHistoryRef,
      threadId: source.threadId,
      canaries,
      text: persistedText,
    });
    const historySeedThread = await startOwnedThread(input);
    await appendContextTurn({
      ...input,
      threadId: historySeedThread.threadId,
      text:
        'Mounted rollback-compatible persisted history excerpt.\n' +
        persistedText,
    });

    const prompt = liveReviewerPrompt(input, reviewerPromptForCase('rollback-canary'));
    const auditRef = promptAuditEvidence(prompt, canaries);
    const reviewer = await runDirectReviewerTurn({
      ...input,
      ...liveReviewerTurnOptions(input),
      threadId: historySeedThread.threadId,
      prompt,
      canaries,
    });

    const finalized = finalizeCaseResult({
      caseId: 'rollback-canary',
      canaries,
      mode: input.mode,
      sourceThreadId: source.threadId,
      forkedThreadId: historySeedThread.threadId,
      method: 'searchable-history-query',
      boundary: 'rollback-boundary',
      codexApi: 'thread/read-mounted-history',
      transformLayers: [],
      knownLosses: defaultKnownLosses([
        LIVE_ROLLBACK_SEARCHABLE_HISTORY_LOSS,
        'searchable-history requires mounted persisted history, not native rollback state',
      ]),
      evidenceRefs: mergeEvidenceRefs(auditRef, historySearchRef, reviewer.evidenceRefs),
      compatFallback: true,
    });
    return attachContextTreeManifests(finalized, {
      checkpointAnchor: {
        turnId: surviveTurnId,
        createdAt: new Date().toISOString(),
      },
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      searchableHistoryRef,
      reviewerPrompt: prompt,
    });
  }

  const ephemeralResult = await input.client.request(
    'thread/fork',
    buildThreadForkParams({ threadId: source.threadId, ephemeral: true }),
  );
  const ephemeralThreadId = extractThreadId(ephemeralResult, 'ephemeralThreadId');
  await appendContextTurn({
    ...input,
    threadId: ephemeralThreadId,
    text:
      'Rolled-back record. This turn must disappear after rollback.\n' +
      `ROLLED_BACK_RECORD = ${canaries.rollback}`,
  });
  await input.client.request(
    'thread/rollback',
    buildThreadRollbackParams({ threadId: ephemeralThreadId, numTurns: 1 }),
  );

  const prompt = liveReviewerPrompt(input, reviewerPromptForCase('rollback-canary'));
  const auditRef = promptAuditEvidence(prompt, canaries);
  const forked = await forkReviewer({
    ...input,
    ...liveReviewerTurnOptions(input),
    threadId: ephemeralThreadId,
    sourceThreadId: source.threadId,
    caseId: 'rollback-canary',
    prompt,
    canaries,
    recoveryMethod: 'codex-thread-rollback-plus-fork',
    boundary: 'rollback-boundary',
  });

  return finalizeCaseResult({
    caseId: 'rollback-canary',
    canaries,
    mode: input.mode,
    sourceThreadId: forked.sourceThreadId,
    forkedThreadId: forked.forkedThreadId,
    method: forked.manifest.recoveryMethod,
    boundary: forked.manifest.boundary,
    codexApi: input.mode === 'mock' ? 'mock' : forked.manifest.codexApi,
    transformLayers: forked.manifest.transformLayers,
    knownLosses: forked.manifest.knownLosses,
    evidenceRefs: mergeEvidenceRefs(auditRef, forked.evidenceRefs),
  });
}

async function runCompactionCase(input, canaries) {
  const source = await startOwnedThread(input);
  await appendContextTurn({
    ...input,
    threadId: source.threadId,
    text:
      'Pre-compaction boundary record.\n' +
      `PRE_COMPACTION_CANARY = ${canaries.preCompact}`,
  });
  await appendContextTurn({
    ...input,
    threadId: source.threadId,
    text:
      'Compaction summary boundary record.\n' +
      `COMPACTION_SUMMARY_CANARY = ${canaries.compactSummary}`,
  });
  await appendContextTurn({
    ...input,
    threadId: source.threadId,
    text:
      'Post-compaction boundary record.\n' +
      `POST_COMPACTION_CANARY = ${canaries.postCompact}`,
  });

  const prompt = liveReviewerPrompt(input, reviewerPromptForCase('compaction-canary'));
  const auditRef = promptAuditEvidence(prompt, canaries);
  const forked = await forkReviewer({
    ...input,
    ...liveReviewerTurnOptions(input),
    sourceThreadId: source.threadId,
    caseId: 'compaction-canary',
    prompt,
    canaries,
    boundary: 'compaction-boundary',
    transformLayers: input.mode === 'mock' ? [...COMPACTION_TRANSFORM_LAYERS] : [],
  });

  const evidenceRefs = mergeEvidenceRefs(auditRef, forked.evidenceRefs);
  const observedCompactionBoundary = hasObservedCompactionBoundary(evidenceRefs);
  const liveCompactionUnavailable = input.mode === 'live' && !observedCompactionBoundary;
  const transformLayers = liveCompactionUnavailable
    ? []
    : [...COMPACTION_TRANSFORM_LAYERS];
  const knownLosses = liveCompactionUnavailable
    ? appendKnownLoss(forked.manifest.knownLosses, COMPACTION_TRIGGER_LOSS)
    : forked.manifest.knownLosses;

  return finalizeCaseResult({
    caseId: 'compaction-canary',
    canaries,
    mode: input.mode,
    sourceThreadId: forked.sourceThreadId,
    forkedThreadId: forked.forkedThreadId,
    method: forked.manifest.recoveryMethod,
    boundary: forked.manifest.boundary,
    codexApi: input.mode === 'mock' ? 'mock' : forked.manifest.codexApi,
    transformLayers,
    knownLosses,
    evidenceRefs,
    forcedVerdict: liveCompactionUnavailable ? 'inconclusive' : undefined,
    forcedFailureReason: liveCompactionUnavailable ? COMPACTION_TRIGGER_UNAVAILABLE : undefined,
  });
}

async function callMockSpawnFullHistory(input) {
  const params = {
    sourceThreadId: input.sourceThreadId,
    prompt: input.prompt,
    cwd: input.cwd,
    model: requestModelFor(input),
  };

  if (typeof input.client.spawnFullHistory === 'function') {
    return input.client.spawnFullHistory(params);
  }
  if (typeof input.client.spawnReviewerFromCurrentBoundary === 'function') {
    return input.client.spawnReviewerFromCurrentBoundary(params);
  }
  return input.client.request('spawn/full_history', params);
}

async function runCurrentBoundarySpawnCase(input, canaries) {
  const artifact = nativeSpawnArtifactForCase(
    input,
    'current-boundary-spawn-canary',
    'authorized-natural-member-activation',
  );
  if (artifact) {
    const artifactResult = await nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode: input.mode });
    return attachContextTreeManifests(artifactResult, {
      checkpointAnchor: artifactResult.checkpointAnchor,
      materialSelectionMode: artifactResult.materialSelectionMode,
      fidelity: artifactResult.fidelity,
      searchableHistoryRef: artifactResult.searchableHistoryRef,
      reviewerPrompt: artifact.reviewerPrompt,
    });
  }

  const source = await startOwnedThread(input);
  const sourceTurnId = await appendContextTurn({
    ...input,
    threadId: source.threadId,
    text:
      'Current boundary survivor record.\n' +
      `CURRENT_BOUNDARY_CANARY = ${canaries.survive}`,
  });
  const checkpointAnchor = {
    turnId: sourceTurnId,
    createdAt: new Date().toISOString(),
  };

  const basePrompt = liveReviewerPrompt(input, reviewerPromptForCase('current-boundary-spawn-canary'));
  const prompt = helperReviewerPrompt({
    baseCheckpointId: 'cp-current-boundary-spawn-canary',
    prompt: basePrompt,
  });
  const auditRef = promptAuditEvidence(prompt, canaries);

  if (input.mode === 'mock') {
    try {
      const spawned = await callMockSpawnFullHistory({
        ...input,
        sourceThreadId: source.threadId,
        prompt,
      });
      if (spawned) {
        const forkedThreadId = extractThreadId(spawned, 'spawnedThreadId');
        const evidenceRefs = mergeEvidenceRefs(
          auditRef,
          spawned.evidenceRefs ?? [],
          spawned.observedAnswer
            ? [{
                kind: 'reviewer-answer',
                ref: `mock-spawn-answer:${forkedThreadId}`,
                threadId: forkedThreadId,
                turnId: spawned.reviewerTurnId,
                excerpt: spawned.observedAnswer,
              }]
            : [],
        );

        const finalized = finalizeCaseResult({
          caseId: 'current-boundary-spawn-canary',
          canaries,
          mode: input.mode,
          sourceThreadId: source.threadId,
          forkedThreadId,
          method: 'codex-spawn-agent-full-history',
          boundary: 'current-stable-turn',
          codexApi: 'mock',
          transformLayers: [],
          knownLosses: defaultKnownLosses(),
          evidenceRefs,
          observedAnswer: spawned.observedAnswer,
        });
        if (finalized.observedAnswer) {
          return attachContextTreeManifests(finalized, {
            checkpointAnchor,
            materialSelectionMode: 'native-fork',
            fidelity: 'native-context-fork',
            reviewerPrompt: prompt,
          });
        }
        return finalized;
      }
    } catch (err) {
      void err;
    }
  }

  if (
    input.protocol.features.threadRead
    && (input.mode === 'live' || input.memberTaskRunConfig?.forceSearchableHistoryPath === true)
  ) {
    const threadData = await input.client.request('thread/read', {
      threadId: source.threadId,
      includeTurns: true,
    });
    const persistedText = extractPersistedAssistantText(threadData);
    const searchableHistoryRef = `thread/read:${source.threadId}`;
    const historySearchRef = historySearchEvidenceRef({
      searchableHistoryRef,
      threadId: source.threadId,
      canaries,
      text: persistedText,
    });

    if (historySearchRef.contains.includes(canaries.survive)) {
      const historySeedThread = await startOwnedThread(input);
      await appendContextTurn({
        ...input,
        threadId: historySeedThread.threadId,
        text:
          'Mounted searchable history excerpt for current-boundary review.\n' +
          persistedText,
      });
      const reviewer = await runDirectReviewerTurn({
        client: input.client,
        collector: input.evidenceCollector,
        cwd: typeof input.reviewerCwd === 'string' && input.reviewerCwd.trim().length > 0
          ? input.reviewerCwd
          : input.cwd,
        threadId: historySeedThread.threadId,
        prompt,
        canaries,
        mode: input.mode,
        model: input.model,
        outputSchema: REVIEWER_OUTPUT_SCHEMA,
        sandbox: REVIEWER_SANDBOX_POLICY,
        approvalPolicy: REVIEWER_APPROVAL_POLICY,
        turnTimeoutMs: input.turnTimeoutMs,
        pollIntervalMs: input.pollIntervalMs,
      });
      const evidenceRefs = mergeEvidenceRefs(auditRef, historySearchRef, reviewer.evidenceRefs);
      const finalized = finalizeCaseResult({
        caseId: 'current-boundary-spawn-canary',
        canaries,
        mode: input.mode,
        sourceThreadId: source.threadId,
        forkedThreadId: historySeedThread.threadId,
        method: 'searchable-history-query',
        boundary: 'current-stable-turn',
        codexApi: 'thread/read-mounted-history',
        transformLayers: [],
        knownLosses: defaultKnownLosses(['searchable-history requires mounted persisted history, not native fork state']),
        evidenceRefs,
        observedAnswer: reviewerAnswerText(reviewer.evidenceRefs),
      });
      const withManifests = attachContextTreeManifests(finalized, {
        checkpointAnchor,
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        searchableHistoryRef,
        reviewerPrompt: prompt,
      });
      return maybeRecordSearchableHistoryMemberTaskRun({
        caseResult: withManifests,
        input,
        checkpointAnchor,
        searchableHistoryRef,
        historyEvidenceRef: historySearchRef,
        historyText: persistedText,
      });
    }
  }

  const probed = await probeCurrentBoundarySpawn(input.client, input.protocol, {
    threadId: source.threadId,
    sourceThreadId: source.threadId,
    cwd: input.cwd,
    model: requestModelFor(input),
    caseId: 'current-boundary-spawn-canary',
    prompt,
    canaries,
  });
  const evidenceRefs = mergeEvidenceRefs(auditRef, probed.evidenceRefs ?? []);

  const finalized = finalizeCaseResult({
    caseId: 'current-boundary-spawn-canary',
    canaries,
    mode: input.mode,
    sourceThreadId: source.threadId,
    method: 'codex-spawn-agent-full-history',
    boundary: 'current-stable-turn',
    codexApi: input.mode === 'mock' ? 'mock' : 'multiagent-v2-fork_turns',
    transformLayers: [],
    knownLosses: defaultKnownLosses([SPAWN_UNAVAILABLE]),
    evidenceRefs,
    forcedVerdict: 'inconclusive',
    forcedFailureReason: SPAWN_UNAVAILABLE,
    capabilityFinding: SPAWN_UNAVAILABLE,
  });
  return attachContextTreeSpawnAttempt(finalized, {
    failureReason: SPAWN_UNAVAILABLE,
    capabilityFinding: SPAWN_UNAVAILABLE,
  });
}

async function runCase(caseId, input, canaries) {
  if (caseId === 'user-assistant-canary') return runUserAssistantCase(input, canaries);
  if (caseId === 'negative-fresh-thread') return runNegativeFreshThreadCase(input, canaries);
  if (caseId === 'negative-summary-only') return runNegativeSummaryOnlyCase(input, canaries);
  if (caseId === 'negative-fork-turns-none') return runNegativeForkTurnsNoneCase(input, canaries);
  if (caseId === 'tool-result-canary') return runToolResultCase(input, canaries);
  if (caseId === 'rollback-canary') return runRollbackCase(input, canaries);
  if (caseId === 'compaction-canary') return runCompactionCase(input, canaries);
  if (caseId === 'current-boundary-spawn-canary') {
    return runCurrentBoundarySpawnCase(input, canaries);
  }
  throw new Error(`unsupported caseId: ${caseId}`);
}

// ─── Public API ──────────────────────────────────────────────────────

export async function runCodexContextForkCapabilityEval({
  client,
  protocol,
  evidenceCollector,
  seed,
  cwd,
  mode,
  model,
  turnTimeoutMs,
  pollIntervalMs,
  runDir,
  reviewerCwd,
  nativeSpawnArtifacts,
  memberTaskRunConfig,
}) {
  requireObject(client, 'client');
  requireObject(protocol, 'protocol');
  requireNonEmptyString(cwd, 'cwd');

  const normalizedInput = {
    client,
    protocol,
    evidenceCollector,
    seed: seed ?? 'task-10',
    cwd,
    mode: mode ?? 'live',
    model: mode === 'mock' ? (model ?? DEFAULT_MODEL) : model,
    turnTimeoutMs,
    pollIntervalMs,
    runDir: runDir ?? DEFAULT_RUN_DIR,
    reviewerCwd,
    nativeSpawnArtifacts,
    memberTaskRunConfig,
  };
  normalizedInput.collector = collectorFor(normalizedInput);

  const canaries = createCanarySet(normalizedInput.seed);
  const caseResults = [];
  for (const caseId of CASE_IDS) {
    caseResults.push(await runCase(caseId, normalizedInput, canaries));
  }

  const caseResultsWithArtifacts = await writeContextTreeArtifactsForCases(
    caseResults,
    normalizedInput.runDir,
  );
  const report = createCapabilityReport({
    caseResults: caseResultsWithArtifacts,
    nativeSpawnArtifacts: normalizedInput.nativeSpawnArtifacts,
  });
  await writeCapabilityReport(report, normalizedInput.runDir);
  return report;
}
