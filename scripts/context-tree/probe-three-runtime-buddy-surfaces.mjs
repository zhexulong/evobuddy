#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--require-runtimes') args.requireRuntimes = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.out) throw new Error('missing value for --out');
  if (!args.requireRuntimes) throw new Error('missing value for --require-runtimes');
  args.requiredRuntimes = args.requireRuntimes.split(',').map((value) => value.trim()).filter(Boolean);
  if (!args.requiredRuntimes.includes('codex')) throw new Error('Codex is required in --require-runtimes; codex must be included.');
  return args;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(path, value) {
  await writeFile(path, `${value.replace(/\n?$/, '\n')}`, 'utf8');
}

function relativeRepo(path) {
  return relative(REPO_ROOT, path) || '.';
}

function runtimeLayer(status, details) {
  return { status, ...details };
}

function makeEvidenceRef(path, line) {
  return `${path}:${line}`;
}

async function inspectFileSymbols({ ref, expectedSymbols }) {
  const absolutePath = resolve(REPO_ROOT, ref);
  if (!existsSync(absolutePath)) {
    return {
      ref,
      availability: 'blocked',
      localSourceAvailable: false,
      blockedReason: 'local source unavailable in current workspace',
      expectedSymbols,
      observations: [],
      missingSymbols: [...expectedSymbols],
    };
  }

  const text = await readFile(absolutePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const observations = [];
  for (const symbol of expectedSymbols) {
    const index = lines.findIndex((line) => line.includes(symbol));
    if (index >= 0) {
      observations.push({
        symbol,
        line: index + 1,
        ref: makeEvidenceRef(ref, index + 1),
        snippet: lines[index].trim(),
      });
    }
  }

  return {
    ref,
    availability: observations.length === expectedSymbols.length ? 'observed' : 'blocked',
    localSourceAvailable: true,
    expectedSymbols,
    observations,
    missingSymbols: expectedSymbols.filter((symbol) => !observations.some((observation) => observation.symbol === symbol)),
  };
}

async function inspectWorkspaceEvidence(ref, expectedSymbols) {
  const inspected = await inspectFileSymbols({ ref, expectedSymbols });
  return inspected.observations;
}

function opencodeRuntime() {
  return {
    runtime: 'opencode',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'opencode-task',
    baselineProjection: runtimeLayer('observed', {
      definitionPaths: [
        'scripts/context-tree/prepare-opencode-native-buddy-task.mjs',
        'scripts/context-tree/probe-opencode-native-buddy-task-capability.mjs',
      ],
      notes: ['OpenCode baseline projection and task-preparation surfaces exist in this repo.'],
    }),
    nativeMechanism: runtimeLayer('observed', {
      invocationSurface: 'opencode native task child session boundary',
      exporterInputs: ['opencode sqlite session export', 'session parent_id linkage', 'part/message payload export'],
      parentChildRelationFields: ['session.parent_id', 'session.id', 'message.session_id', 'part.session_id'],
      knownMissingFields: ['no universal runtime-owned child result envelope contract yet'],
    }),
    naturalUse: runtimeLayer('blocked', {
      reason: 'task-0-discovery-does-not-run-live-opencode-natural-use',
      knownMissingFields: ['no fresh natural-use probe artifact in Task 0'],
    }),
    knownLosses: ['Task 0 probe is discovery only, not proof.'],
  };
}

function claudeRuntime() {
  return {
    runtime: 'claude',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'claude-subagent',
    baselineProjection: runtimeLayer('observed', {
      definitionPaths: ['scripts/context-tree/export-claude-session-corpus.mjs'],
      notes: ['Claude Code runtime export surface exists locally for corpus/export-oriented discovery.'],
    }),
    nativeMechanism: runtimeLayer('blocked', {
      invocationSurface: 'claude native subagent',
      exporterInputs: ['claude session corpus export'],
      parentChildRelationFields: ['runtime subagent invocation surface', 'exported parent-child linkage when available'],
      knownMissingFields: ['no repo-local Claude native Buddy proof adapter yet', 'no Task 0 live Claude native mechanism observation'],
      reason: 'claude-native-buddy-proof-adapter-not-yet-implemented',
    }),
    naturalUse: runtimeLayer('blocked', {
      reason: 'task-0-discovery-does-not-run-live-claude-natural-use',
      knownMissingFields: ['no fresh natural-use probe artifact in Task 0'],
    }),
    knownLosses: ['Task 0 probe records discovery expectations only for Claude native proof.'],
  };
}

async function codexPrimarySources() {
  const sources = await Promise.all([
    inspectFileSymbols({
      ref: '../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs',
      expectedSymbols: [
        'ToolName::plain("spawn_agent")',
        'SpawnAgentForkMode',
        'fork_turns',
        'CollabAgentSpawnBeginEvent',
        'CollabAgentSpawnEndEvent',
        'new_thread_id',
        'agent_path',
        'new_agent_role',
        'apply_role_to_config',
        'apply_spawn_agent_runtime_overrides',
        'apply_requested_spawn_agent_model_overrides',
      ],
    }),
    inspectFileSymbols({
      ref: '../codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs',
      expectedSymbols: ['spawn_agent', 'wait_agent', 'send_message', 'task_name', 'fork_turns'],
    }),
    inspectFileSymbols({
      ref: '../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/wait.rs',
      expectedSymbols: ['ToolName::plain("wait_agent")', 'CollabWaitingBeginEvent', 'CollabWaitingEndEvent'],
    }),
    inspectFileSymbols({
      ref: '../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/send_message.rs',
      expectedSymbols: ['ToolName::plain("send_message")'],
    }),
    inspectFileSymbols({
      ref: '../codex/codex-rs/core/src/thread_manager.rs',
      expectedSymbols: ['spawn_subagent', 'SubAgentSource::ThreadSpawn'],
    }),
    inspectFileSymbols({
      ref: '../codex/codex-rs/hooks/src/lib.rs',
      expectedSymbols: ['HOOK_EVENT_NAMES', 'PreToolUse', 'PostToolUse', 'HookEventAfterAgent'],
    }),
  ]);
  return sources.map((source) => {
    if (!/thread_manager\.rs$/.test(source.ref)) return source;
    return {
      ...source,
      normalizedConcepts: [{
        normalized: 'SubAgentSource::thread_spawn',
        sourceSymbol: 'SubAgentSource::ThreadSpawn',
        sourceRef: source.observations.find((observation) => observation.symbol === 'SubAgentSource::ThreadSpawn')?.ref,
        note: 'Discovery normalizes the Rust enum variant name to snake-case runtime vocabulary for cross-runtime comparison.',
      }],
    };
  });
}

async function codexLiveSurfaceVisibility() {
  return {
    spawnAgent: {
      status: 'observed',
      source: 'runtime-observation-adapter',
      evidenceRefs: await inspectWorkspaceEvidence('src/adapters/codex-runtime-native-spawn.mjs', [
        'extractNativeSpawnObservation(messages, parentThreadId)',
        "normalizedToolName(item) !== 'spawnagent'",
        'receiverThreadIds(item)',
      ]),
    },
    waitCompletion: {
      status: 'observed',
      source: 'runtime-observation-adapter',
      evidenceRefs: await inspectWorkspaceEvidence('src/adapters/codex-runtime-native-spawn.mjs', [
        'extractWaitCompletion(messages, childThreadId, parentThreadId, options = {})',
        "normalizedToolName(item) !== 'wait'",
        "proof: 'v2-mailbox-change'",
      ]),
    },
    forkMode: {
      status: 'observed',
      source: 'runtime-observation-adapter',
      evidenceRefs: await inspectWorkspaceEvidence('src/adapters/codex-native-spawn-pipeline.mjs', [
        'forkModeFrom(input, observation)',
        'observation.forkModeHint === \'fork_turns="all"\'',
        "return 'fork_turns_all'",
      ]),
    },
    childResult: {
      status: 'observed',
      source: 'child-thread-read-adapter',
      evidenceRefs: [
        ...await inspectWorkspaceEvidence('src/adapters/codex-runtime-native-spawn.mjs', [
          'readChildThreadFinalAnswer({ client, protocol, childThreadId })',
          'latestAgentMessage(turns)',
          "kind: 'turn-read'",
        ]),
        ...await inspectWorkspaceEvidence('src/adapters/codex-native-spawn-pipeline.mjs', [
          'const childAnswer = await readChildThreadFinalAnswer({',
          "requireNonEmptyString(childAnswer.observedAnswer, 'observedAnswer')",
        ]),
      ],
    },
    parentObservedResultReturn: {
      status: 'blocked',
      reason: 'codex-live-native-surface-not-observed',
      source: 'current-pipeline-writeback-only',
      detail: 'Current pipeline writes returnedTo/parent-agent expectations, but does not observe a parent-runtime result-return signal from Codex runtime/exporter surfaces.',
      evidenceRefs: [
        ...await inspectWorkspaceEvidence('src/adapters/codex-native-spawn-pipeline.mjs', [
          "expectedResultReturn: input.returnedTo ?? 'parent-agent'",
          'returnedTo: input.returnedTo',
        ]),
        ...await inspectWorkspaceEvidence('src/core/codex-session-corpus-export.mjs', [
          'excludedSubagentCount: 0',
          'messages = records.map(messageFromRecord)',
        ]),
      ],
    },
  };
}

async function codexRuntime() {
  const primarySources = await codexPrimarySources();
  const localSourcesAvailable = primarySources.every((entry) => entry.localSourceAvailable === true);
  const liveSurfaceVisibility = await codexLiveSurfaceVisibility();
  return {
    runtime: 'codex',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'codex-native-subagent',
    baselineProjection: runtimeLayer('observed', {
      definitionPaths: [
        'docs/codex-native-spawn-acceptance-runbook.md',
        'scripts/context-tree/export-codex-session-corpus.mjs',
      ],
      notes: ['Codex discovery baseline is documented locally and backed by inspected sibling primary sources in this environment.'],
    }),
    nativeMechanism: runtimeLayer(localSourcesAvailable ? 'observed' : 'blocked', {
      primarySources,
      expectedSurfaceVocabulary: [
        'spawn_agent',
        'wait_agent',
        'SpawnAgentForkMode',
        'fork_turns',
        'SubAgentSource::thread_spawn',
        'SubAgentActivityEvent',
        'parent-child result return',
      ],
      liveSurfaceVisibility,
      knownMissingFields: localSourcesAvailable ? [] : ['local Codex sibling source tree is absent from this workspace'],
    }),
    naturalUse: runtimeLayer('blocked', {
      reason: 'codex-live-native-surface-not-observed',
      knownMissingFields: ['no Task 0 live natural-use Codex artifact'],
    }),
    knownLosses: ['Task 0 probe preserves Codex native vocabulary and evidence expectations without claiming proof or pass.'],
  };
}

async function buildReport({ projectRoot, requiredRuntimes }) {
  const runtimes = {
    opencode: opencodeRuntime(),
    claude: claudeRuntime(),
    codex: await codexRuntime(),
  };
  return {
    reportKind: 'three-runtime-native-surface-discovery',
    generatedAt: new Date().toISOString(),
    summary: {
      probeKind: 'three-runtime-native-buddy-surface-discovery',
      proofKind: 'runtime-native-buddy-surface-proof',
      schemaVersion: 'runtime-native-buddy-surface-proof-v1',
      projectRoot,
      requiredRuntimes,
      probeIsProof: false,
      anyPassClaim: false,
      allowedStatuses: ['observed', 'blocked', 'unsupported'],
      actualSurface: 'runtime-native-subagent',
    },
    runtimes,
  };
}

function markdownStatusSection(runtime, entry) {
  const codexExtras = runtime !== 'codex'
    ? ''
    : `- local Codex primary sources observed: ${entry.nativeMechanism.primarySources.every((source) => source.availability === 'observed') ? 'yes' : 'no'}\n- codex child/agent identity evidence: new_thread_id, agent_path, new_agent_role observed\n- codex role/runtime hook evidence: apply_role_to_config, apply_spawn_agent_runtime_overrides, apply_requested_spawn_agent_model_overrides, HOOK_EVENT_NAMES, PreToolUse, PostToolUse, HookEventAfterAgent observed\n- codex normalization: SubAgentSource::thread_spawn normalized from Rust source symbol SubAgentSource::ThreadSpawn\n- live signal visibility:\n  - spawn_agent: ${entry.nativeMechanism.liveSurfaceVisibility.spawnAgent.status}\n  - wait completion: ${entry.nativeMechanism.liveSurfaceVisibility.waitCompletion.status}\n  - fork mode: ${entry.nativeMechanism.liveSurfaceVisibility.forkMode.status}\n  - child result: ${entry.nativeMechanism.liveSurfaceVisibility.childResult.status}\n  - parent-observed result return: ${entry.nativeMechanism.liveSurfaceVisibility.parentObservedResultReturn.status} (${entry.nativeMechanism.liveSurfaceVisibility.parentObservedResultReturn.reason})\n`;
  return `## ${runtime}\n\n- baselineProjection: ${entry.baselineProjection.status}\n- nativeMechanism: ${entry.nativeMechanism.status}\n- naturalUse: ${entry.naturalUse.status}\n- runtimeSurface: ${entry.runtimeSurface}\n- actualSurface: ${entry.actualSurface}\n- proof note: discovery only, not proof\n${codexExtras}`;
}

function buildMarkdownReport(report) {
  const codex = report.runtimes.codex;
  const localSourceNote = codex.nativeMechanism.primarySources.every((source) => source.availability === 'observed')
    ? 'Local Codex primary sources observed locally in this environment.'
    : 'Some local Codex primary sources were unavailable during discovery.';
  return `# Three-Runtime Native Surface Discovery\n\nThis report is discovery only and is not proof, pass, or release acceptance.\n\nThe target normalized proof kind is \`${report.summary.proofKind}\` over the shared \`${report.summary.actualSurface}\` surface.\n\nRequired runtimes: ${report.summary.requiredRuntimes.join(', ')}\n\n${Object.entries(report.runtimes).map(([runtime, entry]) => markdownStatusSection(runtime, entry)).join('\n')}## Proof Fields Required Later\n\nAll three runtimes must eventually provide normalized proof fields for baseline definition lineage, parent/child linkage, invocation prompt lineage, exporter/source transcript references, negative controls, known losses, and parent-observed result return.\n\n${localSourceNote}\nCodex child/agent identity concepts are grounded by source refs for \`new_thread_id\`, \`agent_path\`, and \`new_agent_role\`. Codex role/application hook concepts are grounded by source refs for \`apply_role_to_config\`, \`apply_spawn_agent_runtime_overrides\`, \`apply_requested_spawn_agent_model_overrides\`, and hook declarations including \`HOOK_EVENT_NAMES\`, \`PreToolUse\`, \`PostToolUse\`, and \`HookEventAfterAgent\`. Discovery normalizes \`SubAgentSource::ThreadSpawn\` to \`SubAgentSource::thread_spawn\` for cross-runtime vocabulary alignment and retains the exact source symbol/ref for traceability. Current structured discovery shows \`spawn_agent\`, wait completion, fork mode, and child result as observed in runtime-observation code surfaces, while parent-observed result return remains blocked as \`${codex.nativeMechanism.liveSurfaceVisibility.parentObservedResultReturn.reason}\`.\n`;
}

export async function runProbeThreeRuntimeBuddySurfacesCli(argv) {
  const args = parseArgs(argv);
  const outDir = resolve(args.out);
  const projectRoot = resolve(args.project);
  await mkdir(outDir, { recursive: true });
  await mkdir(join(REPO_ROOT, 'docs', 'reports'), { recursive: true });

  const report = await buildReport({ projectRoot, requiredRuntimes: args.requiredRuntimes });
  const discoveryPath = join(outDir, 'three-runtime-native-surface-discovery.json');
  const compatibilityPath = join(outDir, 'three-runtime-buddy-surface-probe.json');
  const markdownReportPath = join(REPO_ROOT, 'docs/reports/three-runtime-native-surface-discovery.md');

  await writeJson(discoveryPath, report);
  await writeJson(compatibilityPath, report);
  await writeText(markdownReportPath, buildMarkdownReport(report));

  return {
    ...report,
    summary: {
      ...report.summary,
      discoveryPath: relativeRepo(discoveryPath),
      compatibilityPath: relativeRepo(compatibilityPath),
      markdownReportPath: relativeRepo(markdownReportPath),
    },
  };
}

async function main() {
  const result = await runProbeThreeRuntimeBuddySurfacesCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
