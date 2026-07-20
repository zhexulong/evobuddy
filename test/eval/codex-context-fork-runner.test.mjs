import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { buildReviewerPrompt, createCanarySet } from '../../src/eval/canaries.mjs';
import { runCodexContextForkCapabilityEval } from '../../src/eval/codex-context-fork-runner.mjs';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';

const CASE_IDS = [
  'negative-fresh-thread',
  'negative-summary-only',
  'user-assistant-canary',
  'negative-fork-turns-none',
  'tool-result-canary',
  'rollback-canary',
  'compaction-canary',
  'current-boundary-spawn-canary',
];

const CANARY_RE = /CTREE-(?:USER|DECISION|TOOL|PRECOMPACT|COMPACT-SUMMARY|POSTCOMPACT|SURVIVE|ROLLBACK)-[A-Za-z0-9_-]+/g;

function fakeProtocol(overrides = {}) {
  const features = {
    threadForkExcludeTurns: true,
    threadInjectItems: true,
    threadRead: true,
    threadTurnsList: false,
    spawnSurface: false,
    reviewSurface: true,
    ...(overrides.features ?? {}),
  };

  return {
    kind: 'protocol-discovery',
    timestamp: new Date('2026-07-04T00:00:00.000Z').toISOString(),
    methods: {
      supported: [
        'thread/start',
        'thread/fork',
        'thread/rollback',
        'thread/read',
        'thread/inject_items',
        'turn/start',
        ...(overrides.methods?.supported ?? []),
      ],
      unsupported: overrides.methods?.unsupported ?? [],
    },
    features,
  };
}

function extractPrompt(params) {
  const input = params.input ?? [];
  const first = input[0] ?? {};
  return typeof first.text === 'string' ? first.text : '';
}

function tokenList(text) {
  return [...new Set(String(text).match(CANARY_RE) ?? [])];
}

function removeToken(text, token) {
  return String(text).split(token).join(`[filtered:${token.slice(0, token.indexOf('-', 6))}]`);
}

function fakeClient(options = {}) {
  const calls = [];
  const observed = [];
    const threads = new Map();
    let threadSeq = 0;
    let turnSeq = 0;

  function nextThreadId(prefix = 'thread') {
    threadSeq += 1;
    return `${prefix}-${threadSeq}`;
  }

  function nextTurnId() {
    turnSeq += 1;
    return `turn-${turnSeq}`;
  }

  function cloneThread(source, targetId) {
    return {
      threadId: targetId,
      turns: source.turns.map((turn) => ({
        turnId: turn.turnId,
        items: turn.items.map((item) => structuredClone(item)),
      })),
    };
  }

  function threadText(thread) {
    return thread.turns
      .flatMap((turn) => turn.items)
      .map((item) => {
        if (typeof item.text === 'string') return item.text;
        if (Array.isArray(item.content)) {
          return item.content.map((part) => part.text ?? '').join('\n');
        }
        return '';
      })
      .join('\n');
  }

  function filterThreadText(thread, token) {
    for (const turn of thread.turns) {
      for (const item of turn.items) {
        if (typeof item.text === 'string') item.text = removeToken(item.text, token);
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (typeof part.text === 'string') part.text = removeToken(part.text, token);
          }
        }
      }
    }
  }

  function pushCompleted(threadId, turnId) {
    observed.push({
      direction: 'in',
      method: 'notifications/turn/completed',
      params: { threadId, turnId },
    });
  }

  function pushAgentMessage(threadId, turnId, text) {
    observed.push({
      direction: 'in',
      method: 'notifications/item/agentMessage/delta',
      params: { threadId, turnId, item: { role: 'agent', text } },
    });
  }

  function isReviewerPrompt(prompt) {
    return (
      prompt.includes('do not guess') ||
      prompt.includes('Summary-only context') ||
      prompt.includes('Question:')
    );
  }

  function answerForThread(threadId, outputSchema) {
    if (options.suppressReviewerCanaries) return JSON.stringify({ answer: 'unknown', values: [] });
    const thread = threads.get(threadId);
    const visibleTokens = tokenList(
      thread
        ? (options.hiddenRollbackLeak && typeof thread.hiddenReviewerText === 'string'
            ? thread.hiddenReviewerText
            : threadText(thread))
        : ''
    );
    if (outputSchema?.properties?.values) {
      return JSON.stringify({
        answer: visibleTokens.length > 0 ? 'known' : 'unknown',
        values: visibleTokens,
      });
    }
    return visibleTokens.length > 0
      ? `Answer from visible context: ${visibleTokens.join(' ')}`
      : 'Answer: unknown.';
  }

  async function request(method, params = {}) {
    calls.push({ method, params: structuredClone(params) });
    observed.push({ direction: 'out', method, params: structuredClone(params) });

    if (method === 'thread/start') {
      const threadId = nextThreadId('source');
      threads.set(threadId, { threadId, turns: [] });
      return { threadId };
    }

    if (method === 'turn/start') {
      const thread = threads.get(params.threadId);
      assert.ok(thread, `unknown thread ${params.threadId}`);
      const prompt = extractPrompt(params);
      assert.equal(
        isReviewerPrompt(prompt) ? tokenList(prompt).length : 0,
        0,
        'reviewer prompts must not leak CTREE canaries',
      );

      const turnId = nextTurnId();
      const userItem = { role: 'user', content: [{ type: 'text', text: prompt }] };
      if (isReviewerPrompt(prompt)) {
        const answer = answerForThread(params.threadId, params.outputSchema);
        thread.turns.push({
          turnId,
          items: [userItem, { role: 'agent', content: [{ type: 'text', text: answer }], text: answer }],
        });
        if (options.stallNextReviewerTurn) {
          options.stallNextReviewerTurn = false;
          return { turnId };
        }
        const delayedCompletionMs = prompt.includes('Summary-only context')
          ? options.delaySummaryOnlyReviewerCompletedMs
          : options.delayReviewerCompletedMs;
        if (delayedCompletionMs) {
          setTimeout(() => {
            pushAgentMessage(params.threadId, turnId, answer);
            pushCompleted(params.threadId, turnId);
          }, delayedCompletionMs);
        } else {
          pushAgentMessage(params.threadId, turnId, answer);
          pushCompleted(params.threadId, turnId);
        }
      } else {
        const echoed = tokenList(prompt).join(' ');
        const text = echoed ? `Seeded context: ${echoed}` : 'Seeded context without canaries.';
        thread.turns.push({
          turnId,
          items: [userItem, { role: 'agent', content: [{ type: 'text', text }], text }],
        });
        pushCompleted(params.threadId, turnId);
      }
      return { turnId };
    }

    if (method === 'thread/fork') {
      assert.equal('forkTurns' in params, false, 'runner must not pass forkTurns to app-server thread/fork');
      assert.equal('fork_turns' in params, false, 'runner must not pass fork_turns to app-server thread/fork');
      const source = threads.get(params.threadId);
      assert.ok(source, `unknown source thread ${params.threadId}`);
      if (options.failForkWithoutRollout && source.turns.length === 0) {
        const err = new Error(`no rollout found for thread id ${params.threadId}`);
        err.code = -32600;
        throw err;
      }
      const threadId = nextThreadId(params.ephemeral ? 'ephemeral' : 'fork');
      const forked = cloneThread(source, threadId);
      if (typeof params.lastTurnId === 'string') {
        if (options.hiddenRollbackLeak) {
          forked.hiddenReviewerText = threadText(source);
        }
        const cutoff = forked.turns.findIndex((turn) => turn.turnId === params.lastTurnId);
        assert.notEqual(cutoff, -1, `unknown lastTurnId ${params.lastTurnId}`);
        forked.turns = forked.turns.slice(0, cutoff + 1);
      }
      if (Array.isArray(params.excludeTurns) && params.excludeTurns.length > 0) {
        forked.turns = [];
      }
      if (options.filterToolResult) {
        filterThreadText(forked, createCanarySet('runner-seed').tool);
      }
      threads.set(threadId, forked);
      return { threadId };
    }

    if (method === 'thread/inject_items') {
      const thread = threads.get(params.threadId);
      assert.ok(thread, `unknown inject target ${params.threadId}`);
      const turnId = nextTurnId();
      const text = params.items.map((item) => item.output ?? item.arguments ?? '').join('\n');
      thread.turns.push({
        turnId,
        items: [{ role: 'tool', content: [{ type: 'text', text }], text }],
      });
      return { ok: true };
    }

    if (method === 'thread/rollback') {
      const thread = threads.get(params.threadId);
      assert.ok(thread, `unknown rollback target ${params.threadId}`);
      thread.turns.pop();
      return { ok: true };
    }

    if (method === 'thread/read') {
      const thread = threads.get(params.threadId);
      if (!thread) return options.nestedThreadRead ? { thread: { threadId: params.threadId, turns: [] } } : { threadId: params.threadId, turns: [] };
      const cloned = structuredClone(thread);
      return options.nestedThreadRead ? { thread: cloned } : cloned;
    }

    if (method === 'spawn/full_history') {
      if (!options.supportSpawnFullHistory && !options.forceSearchableHistoryPath) {
        const err = new Error('spawn full-history unsupported');
        err.code = -32601;
        throw err;
      }
      const source = threads.get(params.sourceThreadId);
      assert.ok(source, `unknown spawn source ${params.sourceThreadId}`);
      if (options.forceSearchableHistoryPath) {
        const err = new Error('spawn full-history unsupported');
        err.code = -32601;
        throw err;
      }
      const spawnedThreadId = nextThreadId('spawn');
      threads.set(spawnedThreadId, cloneThread(source, spawnedThreadId));
      const reviewerTurnId = nextTurnId();
      const observedAnswer = answerForThread(spawnedThreadId);
      return {
        sourceThreadId: params.sourceThreadId,
        spawnedThreadId,
        reviewerTurnId,
        observedAnswer,
        evidenceRefs: [
          {
            kind: 'reviewer-answer',
            ref: `mock-spawn:${spawnedThreadId}:${reviewerTurnId}`,
            threadId: spawnedThreadId,
            turnId: reviewerTurnId,
            excerpt: observedAnswer,
          },
        ],
      };
    }

    throw new Error(`unexpected method ${method}`);
  }

  return {
    calls,
    observed,
    threads,
    request,
    getObservedMessages() {
      return [...observed];
    },
    onServerRequest() {},
  };
}

function nativeSpawnArtifact(overrides = {}) {
  const canaries = createCanarySet('runner-seed');
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    sourceThreadId: 'artifact-source-thread',
    checkpointAnchor: {
      turnId: 'artifact-source-turn',
      createdAt: '2026-07-06T00:00:00.000Z',
    },
    spawnedAgentId: 'artifact-agent-1',
    forkMode: 'fork_context',
    reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
    observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
    evidenceRefs: [
      {
        kind: 'reviewer-answer',
        ref: 'native-spawn:artifact-agent-1:final',
        threadId: 'artifact-agent-1',
        excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
      },
      {
        kind: 'native-spawn-result',
        ref: 'native-spawn:artifact-agent-1:wait-agent',
        threadId: 'artifact-agent-1',
        contains: [canaries.survive],
        missing: Object.values(canaries).filter((value) => value !== canaries.survive),
      },
    ],
    ...overrides,
  };
}

function fixtureJson(relPath) {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, '../../', relPath), 'utf8'));
}

function nativeSpawnLifecycleFixture(overrides = {}) {
  const fixtureDir = resolve(import.meta.dirname, '../../evals/fixtures/codex-native-spawn/member-lifecycle-positive');
  const artifact = fixtureJson('evals/fixtures/codex-native-spawn/member-lifecycle-positive/acceptance-proof.json');
  const run = fixtureJson('evals/fixtures/codex-native-spawn/member-lifecycle-positive/member-task-run.json');
  const render = fixtureJson('evals/fixtures/codex-native-spawn/member-lifecycle-positive/member-context-render.json');
  const selection = fixtureJson('evals/fixtures/codex-native-spawn/member-lifecycle-positive/material-selection-report.json');
  const request = fixtureJson('evals/fixtures/codex-native-spawn/member-lifecycle-positive/member-task-request.json');
  return {
    artifact: {
      ...artifact,
      ...overrides.artifact,
      artifactRefs: {
        ...artifact.artifactRefs,
        memberTaskRequestPath: join(fixtureDir, 'member-task-request.json'),
        memberTaskRunPath: join(fixtureDir, 'member-task-run.json'),
      },
    },
    run: { ...run, ...overrides.run },
    render: { ...render, ...overrides.render },
    selection: { ...selection, ...overrides.selection },
    request: { ...request, ...overrides.request },
    fixtureDir,
  };
}

function writeLifecycleFixtureBundle(runDir, bundle) {
  const fixtureDir = join(runDir, 'member-lifecycle-positive');
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(join(fixtureDir, 'acceptance-proof.json'), `${JSON.stringify({
    ...bundle.artifact,
    artifactRefs: {
      ...bundle.artifact.artifactRefs,
      memberTaskRequestPath: join(fixtureDir, 'member-task-request.json'),
      memberTaskRunPath: join(fixtureDir, 'member-task-run.json'),
    },
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(fixtureDir, 'member-task-request.json'), `${JSON.stringify(bundle.request, null, 2)}\n`, 'utf8');
  writeFileSync(join(fixtureDir, 'member-task-run.json'), `${JSON.stringify({
    ...bundle.run,
    memberTaskRequestRef: join(fixtureDir, 'member-task-request.json'),
    memberContextRenderRef: join(fixtureDir, 'member-context-render.json'),
    materialSelectionReportRef: join(fixtureDir, 'material-selection-report.json'),
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(fixtureDir, 'member-context-render.json'), `${JSON.stringify({
    ...bundle.render,
    selectionReportRef: join(fixtureDir, 'material-selection-report.json'),
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(fixtureDir, 'material-selection-report.json'), `${JSON.stringify(bundle.selection, null, 2)}\n`, 'utf8');
  return join(fixtureDir, 'acceptance-proof.json');
}

function writeMemberRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'Prefer evidence-backed review wording.\n', 'utf8');
  writeFileSync(join(membersDir, 'skill-designer.json'), `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when reviewing member task run evidence.',
    role: 'Skill Designer',
    responsibilities: ['Review context-bearing member execution records'],
    standardsRefs: ['docs/contracts/member-task-run-record-contract.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    activationHints: ['member task run'],
    negativeActivationHints: ['fresh thread only'],
  }, null, 2)}\n`, 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{
      name: 'skill-designer',
      aliases: ['designer'],
      resolvedMemberId: 'mem-sd-001',
      profileRef: './skill-designer.json',
    }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

async function validMemberTaskRunConfig(baseDir, overrides = {}) {
  const registryRef = writeMemberRegistryFixture(baseDir);
  const prepared = await prepareMemberTaskRequest({
    outputDir: baseDir,
    registryRef,
    memberName: 'skill-designer',
    activationPoint: {
      createdAt: '2026-07-07T10:30:00.000Z',
      taskRef: 'task-4-searchable-history-member-run',
    },
    task: {
      kind: 'review',
      question: 'Review the searchable-history evidence path for member execution.',
      targetRefs: ['docs/contracts/member-task-run-record-contract.md'],
    },
    roleHistoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    targetRefs: ['docs/contracts/member-task-run-record-contract.md'],
    requestedMaterials: ['docs/contracts/member-task-run-record-contract.md'],
    expectedResultReturn: 'eval-runner',
  });
  return {
    memberName: 'skill-designer',
    registryRef,
    taskKind: 'review',
    question: 'Review the searchable-history evidence path for member execution.',
    targetRefs: ['docs/contracts/member-task-run-record-contract.md'],
    roleHistoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    requestedMaterials: ['docs/contracts/member-task-run-record-contract.md'],
    expectedResultReturn: 'eval-runner',
    forceSearchableHistoryPath: true,
    preparedMemberRequest: prepared.request,
    preparedMemberTaskRequestPath: prepared.memberTaskRequestPath,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    requestPromptText: prepared.requestPromptText,
    requestPromptDigest: prepared.requestPromptDigest,
    ...overrides,
  };
}

async function runWithFakeClient(options = {}, runnerOverrides = {}) {
  const runDir = runnerOverrides.runDir ?? mkdtempSync(join(tmpdir(), 'ctree-runner-'));
  const reviewerCwd = runnerOverrides.reviewerCwd ?? join(runDir, 'reviewer-cwd');
  mkdirSync(reviewerCwd, { recursive: true });
  if (runnerOverrides.providerLogContent !== undefined) {
    writeFileSync(join(runDir, 'provider-request.log'), runnerOverrides.providerLogContent, 'utf8');
  }
  if (Array.isArray(runnerOverrides.rolloutTraceEntries)) {
    for (const entry of runnerOverrides.rolloutTraceEntries) {
      const traceDir = join(runDir, 'rollout-trace', entry.traceName);
      const payloadDir = join(traceDir, 'payloads');
      mkdirSync(payloadDir, { recursive: true });
      const traceLines = [JSON.stringify({
        payload: {
          type: 'inference_started',
          thread_id: entry.threadId,
          request_payload: { path: `payloads/${entry.payloadName}` },
        },
      })];
      writeFileSync(join(payloadDir, entry.payloadName), JSON.stringify(entry.payload), 'utf8');
      if (entry.responsePayloadName && entry.responsePayload !== undefined) {
        traceLines.push(JSON.stringify({
          payload: {
            type: 'inference_completed',
            thread_id: entry.threadId,
            response_payload: { path: `payloads/${entry.responsePayloadName}` },
          },
        }));
        writeFileSync(
          join(payloadDir, entry.responsePayloadName),
          JSON.stringify(entry.responsePayload),
          'utf8',
        );
      }
      if (Array.isArray(entry.extraTraceEvents)) {
        for (const event of entry.extraTraceEvents) traceLines.push(JSON.stringify(event));
      }
      writeFileSync(join(traceDir, 'trace.jsonl'), `${traceLines.join('\n')}\n`, 'utf8');
    }
  }
  const client = fakeClient(options);
  const protocol = fakeProtocol(runnerOverrides.protocol ?? {});
  const evidenceCollector = createEvidenceCollector({ client, protocol, runDir });

  const report = await runCodexContextForkCapabilityEval({
    client,
    protocol,
    evidenceCollector,
    seed: 'runner-seed',
    cwd: '/workspace/project',
    mode: runnerOverrides.mode ?? 'mock',
    model: runnerOverrides.model,
    turnTimeoutMs: runnerOverrides.turnTimeoutMs,
    runDir,
    reviewerCwd,
    nativeSpawnArtifacts: runnerOverrides.nativeSpawnArtifacts,
    memberTaskRunConfig: runnerOverrides.memberTaskRunConfig,
  });

  return { client, protocol, report, runDir };
}

function byId(report, caseId) {
  const found = report.caseResults.find((result) => result.caseId === caseId);
  assert.ok(found, `missing case result ${caseId}`);
  return found;
}

function assertRequiredCaseFields(result) {
  for (const key of [
    'sourceThreadId',
    'method',
    'expectedCanaries',
    'forbiddenCanaries',
    'observedAnswer',
    'evidenceRefs',
    'knownLosses',
    'verdict',
    'manifest',
  ]) {
    assert.ok(key in result, `${result.caseId} must include ${key}`);
  }
  assert.equal(Array.isArray(result.expectedCanaries), true);
  assert.equal(Array.isArray(result.forbiddenCanaries), true);
  assert.equal(Array.isArray(result.evidenceRefs), true);
  assert.equal(Array.isArray(result.knownLosses), true);
  assert.equal(result.manifest.sourceThreadId, result.sourceThreadId);
  assert.equal(result.manifest.recoveryMethod, result.method);
  assert.deepEqual(result.manifest.evidenceRefs, result.evidenceRefs);
  assert.deepEqual(result.manifest.knownLosses, result.knownLosses);
}

describe('runCodexContextForkCapabilityEval', () => {
  it('exports the Task 10 runner function', () => {
    assert.equal(typeof runCodexContextForkCapabilityEval, 'function');
  });

  it('runs sterile negative controls before canary-seeding cases', async () => {
    const { report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true }, { mode: 'live' });
    try {
      assert.equal(report.caseResults[0]?.caseId, 'negative-fresh-thread');
      assert.equal(report.caseResults[1]?.caseId, 'negative-summary-only');
      assert.equal(report.caseResults[2]?.caseId, 'user-assistant-canary');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock positive user/assistant fork passes, negative controls are blocked, and report is written', async () => {
    const { client, report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      assert.deepEqual(report.caseResults.map((result) => result.caseId), CASE_IDS);
      for (const result of report.caseResults) assertRequiredCaseFields(result);

      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'pass');
      assert.ok(positive.observedAnswer.includes('CTREE-USER-runner-seed'));
      assert.ok(positive.observedAnswer.includes('CTREE-DECISION-runner-seed'));
      assert.ok(positive.forkedThreadId, 'fork cases should attach forkedThreadId');
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'prompt-audit'));
      assert.ok(positive.evidenceRefs.every((ref) => ref.source === 'mock'));

      const freshThread = byId(report, 'negative-fresh-thread');
      assert.equal(freshThread.verdict, 'pass');
      assert.equal(freshThread.manifest.negativeControl, true);
      assert.equal(tokenList(freshThread.observedAnswer).length, 0, 'negative-fresh-thread must not leak canaries');

      const forkTurnsNone = byId(report, 'negative-fork-turns-none');
      assert.equal(forkTurnsNone.verdict, 'inconclusive');
      assert.equal(forkTurnsNone.failureReason, 'inconclusive:spawn-surface-unavailable');
      assert.equal(forkTurnsNone.capabilityFinding, 'inconclusive:spawn-surface-unavailable');
      assert.equal(forkTurnsNone.method, 'codex-spawn-agent-full-history');
      assert.notEqual(forkTurnsNone.method, 'codex-thread-fork');
      assert.equal(forkTurnsNone.manifest.negativeControl, true);
      assert.equal(tokenList(forkTurnsNone.observedAnswer).length, 0, 'negative-fork-turns-none must not leak canaries');
      assert.equal(
        client.calls.some((call) => call.method === 'thread/fork' && call.params.threadId === forkTurnsNone.sourceThreadId),
        false,
        'negative-fork-turns-none must not use app-server thread/fork for forkTurns:none',
      );

      const summaryOnly = byId(report, 'negative-summary-only');
      assert.equal(summaryOnly.verdict, 'inconclusive');
      assert.equal(summaryOnly.method, 'summary-only');
      assert.equal(summaryOnly.manifest.negativeControl, true);
      assert.equal(report.summary.summaryBaselinePass, false);

      const parsed = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      assert.equal(parsed.reportKind, 'codex-context-fork-capability');
      assert.equal(parsed.workflowEvalIncluded, false);
      assert.deepEqual(parsed.caseResults.map((result) => result.caseId), CASE_IDS);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('negative summary-only sends the positive user/assistant reviewer question over a summary-only recovery path', async () => {
    const { client, report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      const summaryOnly = byId(report, 'negative-summary-only');
      assert.equal(summaryOnly.method, 'summary-only');
      assert.equal(summaryOnly.manifest.negativeControl, true);
      assert.equal(summaryOnly.manifest.compatFallback, true);
      assert.equal(summaryOnly.verdict, 'inconclusive');

      const positivePrompt = buildReviewerPrompt('user-assistant-canary');
      const positiveQuestion = 'Question: Which exact CTREE-* identifiers are visible for the original user messages and assistant decision records preserved in the context?';
      assert.ok(positivePrompt.includes(positiveQuestion));

      const prompts = client.calls
        .filter((call) => call.method === 'turn/start')
        .map((call) => extractPrompt(call.params));
      const summaryPrompt = prompts.find((prompt) => prompt.includes('Summary-only context'));

      assert.ok(summaryPrompt, 'summary-only reviewer prompt should be sent');
      assert.ok(summaryPrompt.includes(positiveQuestion));
      assert.ok(summaryPrompt.includes('do not guess'));
      assert.equal(
        summaryPrompt.includes('Based on the summary above, can you reconstruct full turn-level detail?'),
        false,
      );
      assert.equal(tokenList(summaryPrompt).length, 0, 'summary-only reviewer prompt must remain canary-free');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock tool-result case with reviewer-answer only does not claim request-level inheritance', async () => {
    const { report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      const tool = byId(report, 'tool-result-canary');
      assert.equal(tool.verdict, 'pass');
      assert.ok(tool.observedAnswer.includes('CTREE-TOOL-runner-seed'));
      assert.equal(
        tool.evidenceRefs.some((ref) => ref.kind === 'model-request' || ref.kind === 'rollout'),
        false,
      );
      assert.equal(tool.capabilityFinding, 'inconclusive:no-request-evidence');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock tool-result case records a known loss when tool output is filtered', async () => {
    const { report, runDir } = await runWithFakeClient({ filterToolResult: true, supportSpawnFullHistory: true });
    try {
      const tool = byId(report, 'tool-result-canary');
      assert.equal(tool.verdict, 'inconclusive');
      assert.equal(tool.observedAnswer.includes('CTREE-TOOL-runner-seed'), false);
      assert.ok(tool.knownLosses.some((loss) => loss.includes('tool-result')));
      assert.equal(tool.capabilityFinding, 'known-loss:tool-result-filtered');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock compaction case records transform layers', async () => {
    const { report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      const compaction = byId(report, 'compaction-canary');
      assert.equal(compaction.verdict, 'pass');
      assert.deepEqual(compaction.manifest.transformLayers, [
        'pre-compaction-turn',
        'compaction-summary',
        'post-compaction-turn',
      ]);
      assert.deepEqual(compaction.capabilityFinding, compaction.manifest.transformLayers);
      for (const canary of compaction.expectedCanaries) {
        assert.ok(compaction.observedAnswer.includes(canary));
      }
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock rollback case preserves the surviving rollback canary and excludes the rolled-back canary', async () => {
    const { client, report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      const rollback = byId(report, 'rollback-canary');
      assert.equal(rollback.verdict, 'pass');
      assert.ok(rollback.observedAnswer.includes('CTREE-SURVIVE-runner-seed'));
      assert.equal(rollback.observedAnswer.includes('CTREE-ROLLBACK-runner-seed'), false);
      assert.equal(rollback.method, 'codex-thread-rollback-plus-fork');
      assert.equal(rollback.manifest.boundary, 'rollback-boundary');
      const rollbackCallIndex = client.calls.findIndex((call) => call.method === 'thread/rollback');
      const reviewerFork = client.calls
        .slice(rollbackCallIndex + 1)
        .find((call) => call.method === 'thread/fork');
      assert.ok(reviewerFork, 'rollback case must fork a reviewer after rollback');
      assert.match(reviewerFork.params.threadId, /^ephemeral-/);
      assert.deepEqual(client.calls[rollbackCallIndex].params, {
        threadId: reviewerFork.params.threadId,
        numTurns: 1,
      });
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock current-boundary spawn passes only when the mock client supports spawn full-history', async () => {
    const supported = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      const spawn = byId(supported.report, 'current-boundary-spawn-canary');
      assert.equal(spawn.verdict, 'pass');
      assert.equal(spawn.method, 'codex-spawn-agent-full-history');
      assert.ok(spawn.forkedThreadId.startsWith('spawn-'));
      assert.ok(spawn.observedAnswer.includes('CTREE-SURVIVE-runner-seed'));
      assert.equal(supported.report.summary.nativeSpawnPass, false);
      assert.equal(
        supported.client.calls.some((call) => call.method === 'thread/fork' && ('forkTurns' in call.params || 'fork_turns' in call.params)),
        false,
      );
    } finally {
      rmSync(supported.runDir, { recursive: true, force: true });
    }

    const unsupported = await runWithFakeClient({ supportSpawnFullHistory: false });
    try {
      const spawn = byId(unsupported.report, 'current-boundary-spawn-canary');
      assert.equal(spawn.verdict, 'inconclusive');
      assert.equal(spawn.failureReason, 'inconclusive:spawn-surface-unavailable');
      assert.equal(unsupported.report.summary.nativeSpawnPass, false);
    } finally {
      rmSync(unsupported.runDir, { recursive: true, force: true });
    }
  });

  it('uses a native spawn artifact to pass current-boundary spawn without app-server support', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: false },
      { nativeSpawnArtifacts: [nativeSpawnArtifact()] },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');
      assert.equal(spawn.verdict, 'pass');
      assert.equal(spawn.method, 'codex-spawn-agent-full-history');
      assert.equal(spawn.forkedThreadId, 'artifact-agent-1');
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(spawn.lifecycleVerdict?.status, 'not-run');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('uses an authorized member activation artifact to pass the authorized native spawn tier without a bridge artifact', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-runner-authorized-native-artifact-'));
    const canaries = createCanarySet('runner-seed');
    const baseBundle = nativeSpawnLifecycleFixture();
    const bundle = nativeSpawnLifecycleFixture({
      artifact: {
        caseId: 'authorized-natural-member-activation',
        acceptanceMode: 'authorized-natural-native-spawn',
        acceptanceTier: { id: 'authorized-natural-native-spawn' },
        providerForcedLiveProof: false,
        deterministicProviderProof: false,
        observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
        evidenceRefs: [
          {
            kind: 'reviewer-answer',
            ref: 'native-spawn:artifact-agent-authorized:final',
            threadId: 'artifact-agent-authorized',
            excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
          },
          {
            kind: 'native-spawn-result',
            ref: 'native-spawn:artifact-source-thread:artifact-agent-authorized:v1-terminal-status',
            sourceThreadId: 'artifact-source-thread',
            childThreadId: 'artifact-agent-authorized',
            observableChildId: 'artifact-agent-authorized',
            waitProof: 'v1-terminal-status',
            contains: [canaries.survive],
            missing: Object.values(canaries).filter((value) => value !== canaries.survive),
          },
        ],
      },
      request: {
        memberName: 'skill-designer',
        expectedResultReturn: 'parent-agent',
      },
      run: {
        memberName: 'skill-designer',
        result: {
          ...baseBundle.run.result,
          returnedTo: 'parent-agent',
        },
      },
    });
    const artifactPath = writeLifecycleFixtureBundle(runDir, bundle);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    try {
      const { report } = await runWithFakeClient(
        { supportSpawnFullHistory: false },
        { runDir, nativeSpawnArtifacts: [artifact] },
      );

      const spawn = byId(report, 'authorized-natural-member-activation');
      assert.equal(spawn.verdict, 'pass');
      assert.equal(spawn.lifecycleVerdict?.status, 'pass');
      assert.equal(spawn.acceptanceTier?.id, 'authorized-natural-native-spawn');
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
      assert.equal(report.summary.nativeSpawnLifecyclePass, true);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('downgrades a retained native spawn artifact when lifecycle artifacts drift', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-runner-native-lifecycle-drift-'));
    const bundle = nativeSpawnLifecycleFixture({
      render: { deltaDigest: 'sha256:delta-drift-runner' },
    });
    const artifactPath = writeLifecycleFixtureBundle(runDir, bundle);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    const { report } = await runWithFakeClient(
      { supportSpawnFullHistory: false },
      { runDir, nativeSpawnArtifacts: [artifact] },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');
      assert.equal(spawn.verdict, 'fail');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.nativeSpawnLifecyclePass, false);
      assert.equal(spawn.lifecycleVerdict?.status, 'fail');
      assert.match(spawn.failureReason, /deltaDigest|memberContextRender/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode treats persisted-history turn-read evidence as corroboration but not enough to pass', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      { mode: 'live' },
    );
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'inconclusive');
      assert.equal(positive.failureReason, 'no supporting evidence');
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'reviewer-answer'));
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'turn-read' && ref.persistedHistory === true));
      assert.equal(positive.evidenceRefs.some((ref) => ref.kind === 'model-request'), false);
      assert.equal(positive.evidenceRefs.some((ref) => ref.kind === 'rollout'), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live compaction is inconclusive without an observed compaction boundary and reports no fake transform layers', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      { mode: 'live' },
    );
    try {
      const compaction = byId(report, 'compaction-canary');
      assert.equal(compaction.verdict, 'inconclusive');
      assert.equal(compaction.failureReason, 'compaction trigger unavailable');
      assert.deepEqual(compaction.manifest.transformLayers, []);
      assert.deepEqual(compaction.capabilityFinding, []);
      assert.ok(
        compaction.knownLosses.some((loss) => loss.includes('compaction trigger unavailable')),
        'live compaction inconclusive result must record an explicit caveat/known loss',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live negative-fresh-thread creates a benign baseline turn before forking when app-server requires a rollout', async () => {
    const { client, report, runDir } = await runWithFakeClient(
      { failForkWithoutRollout: true, supportSpawnFullHistory: true },
      { mode: 'live' },
    );
    try {
      const freshThread = byId(report, 'negative-fresh-thread');
      assert.notEqual(freshThread.failureReason, 'no rollout found for thread id source-3');
      const sourceThreadId = freshThread.sourceThreadId;
      const forkCallIndex = client.calls.findIndex(
        (call) => call.method === 'thread/fork' && call.params.threadId === sourceThreadId,
      );
      assert.notEqual(forkCallIndex, -1, 'negative-fresh-thread should still fork once a rollout exists');
      const priorTurns = client.calls.slice(0, forkCallIndex).filter(
        (call) => call.method === 'turn/start' && call.params.threadId === sourceThreadId,
      );
      assert.ok(priorTurns.length >= 1, 'runner should create a neutral baseline turn before forking a fresh live thread');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('downgrades a timed-out live negative control to inconclusive when rollout evidence shows actual reviewer tool use', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true, stallNextReviewerTurn: true },
      {
        mode: 'live',
        turnTimeoutMs: 50,
        rolloutTraceEntries: [{
          traceName: 'trace-negative-fresh-thread',
          threadId: 'fork-2',
          payloadName: '4.json',
          payload: { input: 'request stayed clean' },
          extraTraceEvents: [{ payload: { type: 'tool_call_started', thread_id: 'fork-2' } }],
        }],
      },
    );
    try {
      const freshThread = byId(report, 'negative-fresh-thread');
      assert.equal(freshThread.verdict, 'inconclusive');
      assert.equal(
        freshThread.failureReason,
        'live reviewer turn used tools or exposed tool results and can self-contaminate negative controls',
      );
      assert.ok(freshThread.evidenceRefs.some((ref) => ref.kind === 'rollout' && ref.toolsUsed === true));
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live tool-result case can pass from inherited tool-result rollout evidence when the reviewer does not start a new tool', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      {
        mode: 'live',
        rolloutTraceEntries: ['fork-5', 'fork-6', 'fork-7', 'fork-8', 'fork-9'].map((threadId) => ({
          traceName: `trace-tool-result-case-${threadId}`,
          threadId,
          payloadName: '4.json',
          payload: {
            input: [
              {
                type: 'function_call_output',
                call_id: 'call-1',
                output: 'tool output carries CTREE-TOOL-runner-seed',
              },
            ],
          },
        })),
      },
    );
    try {
      const tool = byId(report, 'tool-result-canary');
      assert.equal(tool.verdict, 'pass');
      assert.equal(tool.failureReason, null);
      assert.ok(tool.evidenceRefs.some((ref) => ref.kind === 'rollout' && ref.toolResultExposed === true));
      assert.equal(
        tool.evidenceRefs.some((ref) => ref.kind === 'rollout' && ref.toolsUsed === true),
        false,
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live reviewer turns are bounded with structured output, sterile cwd, read-only sandbox, never-approve policy, and no-tool instructions', async () => {
    const { client, report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      { mode: 'live' },
    );
    try {
      const freshThread = byId(report, 'negative-fresh-thread');
      const reviewerTurn = client.calls.find(
        (call) => call.method === 'turn/start' && call.params.threadId === freshThread.forkedThreadId,
      );
      assert.ok(reviewerTurn, 'live negative-fresh-thread reviewer turn must be recorded');
      assert.deepEqual(reviewerTurn.params.outputSchema, {
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
      assert.deepEqual(reviewerTurn.params.sandboxPolicy, {
        type: 'readOnly',
        writableRoots: [],
        networkAccess: false,
        excludeTmpdirEnvVar: true,
        excludeSlashTmp: true,
      });
      assert.equal(reviewerTurn.params.cwd, join(runDir, 'reviewer-cwd'));
      assert.equal(reviewerTurn.params.approvalPolicy, 'never');
      assert.match(
        reviewerTurn.params.input?.[0]?.text ?? '',
        /do not use tools, shell commands, MCP resources, memory, or workspace search/i,
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live source and context seeding turns are bounded with read-only sandbox, never-approve policy, and no-tool instructions', async () => {
    const { client, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      { mode: 'live' },
    );
    try {
      const nonReviewerTurns = client.calls.filter((call) => {
        if (call.method !== 'turn/start') return false;
        const text = call.params.input?.[0]?.text ?? '';
        return !text.includes('Question:');
      });
      assert.ok(nonReviewerTurns.length > 0, 'live eval should create source/context seeding turns');
      for (const turn of nonReviewerTurns) {
        assert.deepEqual(turn.params.sandboxPolicy, {
          type: 'readOnly',
          writableRoots: [],
          networkAccess: false,
          excludeTmpdirEnvVar: true,
          excludeSlashTmp: true,
        });
        assert.equal(turn.params.approvalPolicy, 'never');
        assert.match(
          turn.params.input?.[0]?.text ?? '',
          /do not use tools, shell commands, MCP resources, memory, or workspace search/i,
        );
      }
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live exact-canary reviewer contract can pass when reviewer output and request evidence both carry the expected identifiers', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      {
        mode: 'live',
        providerLogContent: 'request carries CTREE-USER-runner-seed and CTREE-DECISION-runner-seed',
      },
    );
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'pass');
      assert.equal(positive.failureReason, null);
      assert.ok(positive.observedAnswer.includes('"values"'));
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'model-request'));
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live exact-canary reviewer contract can pass from rollout-trace request evidence without provider logs', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      {
        mode: 'live',
        rolloutTraceEntries: [{
          traceName: 'trace-user-assistant',
          threadId: 'fork-5',
          payloadName: '4.json',
          payload: { input: 'request carries CTREE-USER-runner-seed and CTREE-DECISION-runner-seed' },
        }],
      },
    );
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'pass');
      assert.equal(positive.failureReason, null);
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'rollout'));
      assert.equal(positive.evidenceRefs.some((ref) => ref.kind === 'model-request'), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live rollout evidence with only tool schemas can pass when canaries match', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      {
        mode: 'live',
        rolloutTraceEntries: [{
          traceName: 'trace-user-assistant-tools-exposed',
          threadId: 'fork-5',
          payloadName: '4.json',
          payload: {
            input: 'request carries CTREE-USER-runner-seed and CTREE-DECISION-runner-seed',
            tools: [{ name: 'exec_command' }],
          },
        }],
      },
    );
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'pass');
      assert.equal(positive.failureReason, null);
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'rollout' && ref.toolsOffered === true));
      assert.equal(
        positive.evidenceRefs.some((ref) => ref.kind === 'rollout' && ref.toolsUsed === true),
        false,
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live rollout support with tool-result content downgrades matching reviewer canaries to inconclusive', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      {
        mode: 'live',
        rolloutTraceEntries: [{
          traceName: 'trace-user-assistant-tool-result-contaminated',
          threadId: 'fork-5',
          payloadName: '4.json',
          payload: {
            input: [
              {
                type: 'function_call_output',
                call_id: 'call-1',
                output: 'tool output carries CTREE-USER-runner-seed and CTREE-DECISION-runner-seed',
              },
            ],
          },
        }],
      },
    );
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'inconclusive');
      assert.equal(positive.failureReason, 'live request or rollout evidence exposed tool results');
      assert.ok(positive.evidenceRefs.some((ref) => ref.kind === 'rollout' && ref.toolResultExposed === true));
      assert.ok(
        positive.knownLosses.includes('live request or rollout evidence exposed tool results'),
        'tool-result-contaminated rollout evidence should be preserved as a known loss',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live persisted-history evidence excludes reviewer-turn canaries when evaluating support', async () => {
    const { client, report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      { mode: 'live' },
    );
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'inconclusive');
      assert.equal(positive.failureReason, 'no supporting evidence');

      const reviewerTurn = client.calls.find(
        (call) => call.method === 'turn/start' && call.params.threadId === positive.forkedThreadId,
      );
      assert.ok(reviewerTurn, 'reviewer turn should run on the forked thread');

      const turnReadRef = positive.evidenceRefs.find((ref) => ref.kind === 'turn-read');
      assert.ok(turnReadRef, 'live positive case should include turn-read evidence');
      assert.equal(
        turnReadRef.contains.includes('CTREE-TOOL-runner-seed'),
        false,
        'turn-read evidence must not be polluted by reviewer-turn output from a different canary set',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live rollback case uses mounted searchable history instead of thread/rollback', async () => {
    const { client, report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true }, { mode: 'live' });
    try {
      const rollback = byId(report, 'rollback-canary');
      assert.equal(rollback.observedAnswer.includes('CTREE-SURVIVE-runner-seed'), true);
      assert.equal(rollback.observedAnswer.includes('CTREE-ROLLBACK-runner-seed'), false);
      assert.equal(rollback.method, 'searchable-history-query');
      assert.ok(
        rollback.knownLosses.some((loss) =>
          loss.includes('live thread/rollback on ephemeral forks is unsupported; using searchable-history mounted rollback compatibility path')),
      );
      assert.equal(client.calls.some((call) => call.method === 'thread/rollback'), false);
      assert.equal(
        client.calls.some((call) => call.method === 'thread/fork' && typeof call.params.lastTurnId === 'string'),
        false,
      );
      assert.ok(rollback.evidenceRefs.some((ref) => ref.kind === 'history-search'));
      assert.equal(rollback.contextTree?.spawnRunManifest?.materialSelectionMode, 'searchable-history');
      assert.equal(rollback.contextTree?.spawnRunManifest?.fidelity, 'session-record-mounted');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live rollback mounted-history fallback reads real nested thread/read history', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true, nestedThreadRead: true },
      { mode: 'live' },
    );
    try {
      const rollback = byId(report, 'rollback-canary');
      assert.equal(rollback.verdict, 'pass');
      assert.equal(rollback.observedAnswer.includes('CTREE-SURVIVE-runner-seed'), true);
      assert.equal(rollback.observedAnswer.includes('CTREE-ROLLBACK-runner-seed'), false);
      const historySearchRef = rollback.evidenceRefs.find((ref) => ref.kind === 'history-search');
      assert.ok(historySearchRef);
      assert.ok(historySearchRef.contains.includes('CTREE-SURVIVE-runner-seed'));
      assert.equal(historySearchRef.contains.includes('CTREE-ROLLBACK-runner-seed'), false);
      assert.match(historySearchRef.excerpt, /CTREE-SURVIVE-runner-seed/);
      assert.doesNotMatch(historySearchRef.excerpt, /CTREE-ROLLBACK-runner-seed/);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live rollback mounted-history fallback bypasses the old lastTurnId hidden-context leak', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true, hiddenRollbackLeak: true },
      { mode: 'live' },
    );
    try {
      const rollback = byId(report, 'rollback-canary');
      assert.equal(rollback.verdict, 'pass');
      assert.ok(rollback.observedAnswer.includes('CTREE-SURVIVE-runner-seed'));
      assert.equal(rollback.observedAnswer.includes('CTREE-ROLLBACK-runner-seed'), false);
      assert.equal(rollback.failureReason, null);
      const historySearchRef = rollback.evidenceRefs.find((ref) => ref.kind === 'history-search');
      assert.ok(historySearchRef);
      assert.ok(historySearchRef.contains.includes('CTREE-SURVIVE-runner-seed'));
      assert.equal(historySearchRef.contains.includes('CTREE-ROLLBACK-runner-seed'), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('uses an explicit caller-supplied model across live thread and turn requests', async () => {
    const explicitModel = 'codex-live-real-model';
    const { client, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: true },
      { mode: 'live', model: explicitModel },
    );
    try {
      const modeledCalls = client.calls.filter(
        (call) =>
          call.method === 'thread/start' ||
          call.method === 'turn/start' ||
          call.method === 'spawn/full_history',
      );
      assert.ok(modeledCalls.length > 0, 'runner should issue modeled thread/turn requests');
      for (const call of modeledCalls) {
        assert.equal(
          call.params.model,
          explicitModel,
          `${call.method} must use the explicit caller-supplied live model`,
        );
      }
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('attaches V0 context tree manifests and artifact refs to current-boundary mock spawn results', async () => {
    const { client, report, runDir } = await runWithFakeClient({ supportSpawnFullHistory: true });
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');

      assert.ok(spawn.contextTree?.checkpointManifest, 'actual spawn should attach checkpointManifest');
      assert.ok(spawn.contextTree?.spawnRunManifest, 'actual spawn should attach spawnRunManifest');
      assert.ok(spawn.contextTree?.spawnResultManifest, 'actual spawn should attach spawnResultManifest');
      assert.equal(spawn.contextTree.spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(spawn.contextTree.spawnRunManifest.fidelity, 'native-context-fork');
      assert.equal(spawn.contextTree.spawnRunManifest.childNodeId, `node-${spawn.forkedThreadId}`);
      assert.match(spawn.contextTree.checkpointManifest.anchor.turnId, /^turn-/);
      assert.match(spawn.contextTree.checkpointManifest.anchor.createdAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.notEqual(spawn.contextTree.checkpointManifest.anchor.createdAt, '1970-01-01T00:00:00.000Z');
      assert.ok(spawn.contextTree.artifactRefs?.checkpointManifestPath);
      assert.ok(spawn.contextTree.artifactRefs?.spawnRunManifestPath);
      assert.ok(spawn.contextTree.artifactRefs?.spawnResultManifestPath);
      assert.equal(
        JSON.parse(readFileSync(spawn.contextTree.artifactRefs.spawnRunManifestPath, 'utf8')).id,
        spawn.contextTree.spawnRunManifest.id,
      );

      const spawnCall = client.calls.find((call) => call.method === 'spawn/full_history');
      assert.ok(spawnCall, 'mock spawn should call spawn/full_history');
      assert.match(spawnCall.params.prompt, /<context-tree-helper-reminder>/);
      assert.equal(tokenList(spawnCall.params.prompt).length, 0, 'helper reminder must not leak task canaries');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('preserves searchable-history material path from native artifact V0 manifests', async () => {
    const canaries = createCanarySet('runner-seed');
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: false },
      {
        nativeSpawnArtifacts: [nativeSpawnArtifact({
          materialSelectionMode: 'searchable-history',
          fidelity: 'session-record-mounted',
          searchableHistoryRef: 'history:artifact-source-thread',
          evidenceRefs: [
            { kind: 'history-search', ref: 'history-query:artifact-source-thread', excerpt: canaries.survive },
            ...nativeSpawnArtifact().evidenceRefs,
          ],
        })],
      },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');

      assert.equal(spawn.contextTree.spawnRunManifest.materialSelectionMode, 'searchable-history');
      assert.equal(spawn.contextTree.spawnRunManifest.fidelity, 'session-record-mounted');
      assert.equal(spawn.contextTree.spawnRunManifest.searchableHistoryRef, 'history:artifact-source-thread');
      assert.ok(spawn.contextTree.spawnRunManifest.evidenceRefs.some((ref) => ref.kind === 'history-search'));
      assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 1);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('falls back to a live searchable-history material path when native spawn is unavailable', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: false },
      { mode: 'live', protocol: { features: { spawnSurface: false, threadRead: true } } },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');

      assert.equal(spawn.verdict, 'pass');
      assert.equal(spawn.method, 'searchable-history-query');
      assert.equal(spawn.contextTree.spawnRunManifest.materialSelectionMode, 'searchable-history');
      assert.equal(spawn.contextTree.spawnRunManifest.fidelity, 'session-record-mounted');
      assert.match(spawn.contextTree.spawnRunManifest.searchableHistoryRef, /^thread\/read:/);
      assert.ok(spawn.evidenceRefs.some((ref) => ref.kind === 'history-search'));
      assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 2);
      assert.equal(spawn.contextTree.spawnAttempt, undefined);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('writes searchable-history member artifacts only when a prepared member request crosses a child execution boundary with a returned result', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-runner-member-searchable-'));
    const memberTaskRunConfig = await validMemberTaskRunConfig(runDir);
    const { report } = await runWithFakeClient(
      { supportSpawnFullHistory: false, forceSearchableHistoryPath: true },
      {
        mode: 'mock',
        runDir,
        protocol: { features: { spawnSurface: true, threadRead: true } },
        memberTaskRunConfig,
      },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');
      const memberTaskRequestPath = join(runDir, 'member-task-request.json');
      const memberTaskRunPath = join(runDir, 'member-task-run.json');

      assert.equal(spawn.method, 'searchable-history-query');
      assert.equal(spawn.contextTree.spawnRunManifest.materialSelectionMode, 'searchable-history');
      assert.equal(spawn.contextTree.memberTaskRunDiagnostic, undefined);
      assert.equal(spawn.contextTree.memberTaskRunPath, memberTaskRunPath);

      const memberTaskRequest = JSON.parse(readFileSync(memberTaskRequestPath, 'utf8'));
      const memberTaskRun = JSON.parse(readFileSync(memberTaskRunPath, 'utf8'));
      assert.equal(memberTaskRun.memberName, 'skill-designer');
      assert.equal(memberTaskRun.resolvedMemberId, 'mem-sd-001');
      assert.equal(memberTaskRun.memberTaskRequestRef, memberTaskRequestPath);
      assert.equal(memberTaskRun.materialSelectionMode, 'searchable-history');
      assert.equal(memberTaskRun.fidelity, 'session-record-mounted');
      assert.equal(memberTaskRun.outcome.status, 'pass');
      assert.equal(memberTaskRun.result.returnedTo, 'eval-runner');
      assert.equal(
        memberTaskRun.result.resultRef,
        join(runDir, 'context-tree', 'current-boundary-spawn-canary', 'spawn-result.json'),
      );
      assert.equal(memberTaskRun.runtime, undefined);
      assert.deepEqual(memberTaskRun.materials.runtimeInputEvidenceRefs, []);
      assert.deepEqual(memberTaskRun.materials.providerModelInputEvidenceRefs, []);
      assert.ok(memberTaskRun.contextSources.some((source) => source.kind === 'searchable-history'));
      assert.ok(memberTaskRun.contextSources.some((source) => source.kind === 'parent-session'));
      assert.ok(memberTaskRun.materials.searchableEvidenceRefs.some((ref) => ref.kind === 'history-search'));

      const searchableItems = memberTaskRun.materials.items.filter((item) => item.selectionMode === 'searchable-history');
      assert.ok(searchableItems.length > 0, 'expected searchable-history material items');
      for (const item of searchableItems) {
        assert.equal(item.visibility, 'searchable');
        assert.ok(item.evidenceRefs.some((ref) => ref.kind === 'history-search'));
        assert.ok(item.contentDigest || item.immutableSnapshotRef, 'searchable item must carry digest or immutable snapshot ref');
        assert.match(item.contentDigest, /^sha256:[0-9a-f]{64}$/);
      }
      assert.equal(
        searchableItems[0].contentDigest,
        `sha256:${createHash('sha256').update('Seeded context: CTREE-SURVIVE-runner-seed\nSeeded context: CTREE-SURVIVE-runner-seed').digest('hex')}`,
      );

      const preparedPromptItems = memberTaskRun.materials.items.filter((item) => item.selectionMode === 'prepared-prompt');
      assert.ok(preparedPromptItems.length > 0, 'expected prepared-prompt material items');
      assert.equal(memberTaskRequest.memberName, memberTaskRun.memberName);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('keeps searchable-history as a material-path diagnostic when no prepared member request proves a member child execution', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: false, forceSearchableHistoryPath: true },
      {
        mode: 'mock',
        protocol: { features: { spawnSurface: true, threadRead: true } },
        memberTaskRunConfig: { forceSearchableHistoryPath: true },
      },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');

      assert.equal(spawn.method, 'searchable-history-query');
      assert.equal(spawn.contextTree.memberTaskRun, undefined);
      assert.equal(spawn.contextTree.memberTaskRunPath, undefined);
      assert.equal(spawn.contextTree.memberTaskRunDiagnostic.materialSelectionMode, 'searchable-history');
      assert.equal(spawn.contextTree.memberTaskRunDiagnostic.fidelity, 'session-record-mounted');
      assert.equal(spawn.contextTree.memberTaskRunDiagnostic.memberName, undefined);
      assert.equal(spawn.contextTree.memberTaskRunDiagnostic.resolvedMemberId, undefined);
      assert.equal(spawn.contextTree.memberTaskRunDiagnostic.memberTaskRequestRef, undefined);
      assert.notEqual(spawn.contextTree.memberTaskRunDiagnostic.outcome.status, 'pass');
      assert.ok(spawn.contextTree.memberTaskRunDiagnostic.contextSources.some((source) => source.kind === 'searchable-history'));
      assert.deepEqual(spawn.contextTree.memberTaskRunDiagnostic.materials.runtimeInputEvidenceRefs, []);
      assert.deepEqual(spawn.contextTree.memberTaskRunDiagnostic.materials.providerModelInputEvidenceRefs, []);
      assert.notEqual(spawn.contextTree.memberTaskRunDiagnostic.outcome.status, 'pass');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('does not record a successful searchable-history member run when the reviewer path does not produce a pass verdict', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-runner-member-searchable-nonpass-'));
    const memberTaskRunConfig = await validMemberTaskRunConfig(runDir);
    const { report } = await runWithFakeClient(
      { supportSpawnFullHistory: false, forceSearchableHistoryPath: true, suppressReviewerCanaries: true },
      {
        mode: 'mock',
        runDir,
        protocol: { features: { spawnSurface: true, threadRead: true } },
        memberTaskRunConfig,
      },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');

      assert.notEqual(spawn.verdict, 'pass');
      assert.equal(spawn.contextTree.memberTaskRun, undefined);
      assert.equal(spawn.contextTree.memberTaskRunPath, undefined);
      assert.ok(spawn.contextTree.memberTaskRunDiagnostic, 'non-pass searchable-history path should remain diagnostic');
      assert.notEqual(spawn.contextTree.memberTaskRunDiagnostic.outcome.status, 'pass');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('does not record summary-only as a successful searchable-history member run', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-runner-member-summary-only-'));
    const memberTaskRunConfig = await validMemberTaskRunConfig(runDir);
    const { report } = await runWithFakeClient(
      { supportSpawnFullHistory: false },
      {
        mode: 'mock',
        runDir,
        protocol: { features: { spawnSurface: false, threadRead: true } },
        memberTaskRunConfig,
      },
    );
    try {
      const summaryOnly = byId(report, 'negative-summary-only');
      assert.equal(summaryOnly.method, 'summary-only');
      assert.notEqual(summaryOnly.verdict, 'pass');
      assert.equal(summaryOnly.contextTree?.memberTaskRun, undefined);
      assert.equal(summaryOnly.contextTree?.memberTaskRunPath, undefined);
      assert.equal(summaryOnly.contextTree?.memberTaskRunDiagnostic, undefined);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('records spawn unavailable as a spawn attempt without material bucket increments', async () => {
    const { report, runDir } = await runWithFakeClient(
      { supportSpawnFullHistory: false },
      { protocol: { features: { spawnSurface: false } } },
    );
    try {
      const spawn = byId(report, 'current-boundary-spawn-canary');
      const buckets = report.summary.materialSelectionModes;

      assert.ok(spawn.contextTree?.spawnAttempt);
      assert.equal(spawn.contextTree.spawnAttempt.verdict, 'inconclusive');
      assert.equal(spawn.contextTree.spawnAttempt.failureReason, 'inconclusive:spawn-surface-unavailable');
      assert.ok(spawn.contextTree.spawnAttempt.knownLosses.includes('inconclusive:spawn-surface-unavailable'));
      assert.equal(spawn.contextTree.spawnRunManifest, undefined);
      assert.equal(spawn.contextTree.checkpointManifest, undefined);
      assert.equal(spawn.contextTree.spawnResultManifest, undefined);
      assert.equal(buckets.nativeFork.inconclusive, 0);
      assert.equal(buckets.platformSelectedContext.inconclusive, 0);
      assert.equal(
        Object.values(buckets).flatMap((bucket) => Object.values(bucket)).reduce((sum, value) => sum + value, 0),
        0,
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('uses caller-supplied turnTimeoutMs for slow reviewer completions', async () => {
    await assert.rejects(
      runWithFakeClient(
        { delaySummaryOnlyReviewerCompletedMs: 80, supportSpawnFullHistory: true },
        { mode: 'live', turnTimeoutMs: 20 },
      ),
      /timed out waiting for turn\/completed/,
    );

    const { report, runDir } = await runWithFakeClient(
      { delaySummaryOnlyReviewerCompletedMs: 80, supportSpawnFullHistory: true },
      { mode: 'live', turnTimeoutMs: 200 },
    );
    try {
      const summaryOnly = byId(report, 'negative-summary-only');
      assert.ok(summaryOnly, 'report should be produced when caller allows a longer reviewer timeout');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('never uses expected canaries from test code to synthesize reviewer answers', async () => {
    const { report, runDir } = await runWithFakeClient({ suppressReviewerCanaries: true, supportSpawnFullHistory: true });
    try {
      const positive = byId(report, 'user-assistant-canary');
      assert.equal(positive.observedAnswer, '{"answer":"unknown","values":[]}');
      for (const canary of positive.expectedCanaries) {
        assert.equal(positive.observedAnswer.includes(canary), false);
      }
      assert.notEqual(positive.verdict, 'pass');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });
});
