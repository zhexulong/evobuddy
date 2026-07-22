#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createEvidenceRefreshRecord } from '../../src/core/evobuddy-evidence-refresh-record.mjs';
import { classifySessionReconciliation, commitNativeSession, listNativeSessions, readNativeSession, reserveNativeSession } from '../../src/core/evobuddy-native-session-store.mjs';
import { createRuntimeSessionOpenPlan, getRuntimeSessionAdapter, buildManagedTerminalSessionRef } from '../../src/core/evobuddy-runtime-session-router.mjs';
import { installOpenCodeMemberInstructions } from '../../src/install/opencode-member-instructions.mjs';
import { generateRecentUpdateSummary, readRecentUpdateSummary } from '../../src/core/evobuddy-update-summary.mjs';
import {
  createHandoffFromDraft,
  createTaskRoomFromDraft,
} from '../../src/core/evobuddy-taskroom-mutation.mjs';
import { listTaskRooms } from '../../src/core/evobuddy-taskroom-store.mjs';
import { listWakes, pullHandoffBodyAfterWake } from '../../src/core/evobuddy-taskroom-wake-store.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_JSON = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf8'));

const TARGETS = {
  invoke: 'scripts/context-tree/invoke-member.mjs',
  invokeBuddy: 'scripts/context-tree/invoke-buddy.mjs',
  syncBuddyProjections: 'scripts/context-tree/install-member-projections.mjs',
  workbench: 'scripts/context-tree/render-member-workbench.mjs',
  workbenchStateExport: 'scripts/context-tree/export-evobuddy-workbench-state.mjs',
  evolutionApply: 'scripts/context-tree/apply-evobuddy-evolution-patch.mjs',
};

function usage() {
  return `Usage:
  evobuddy setup --project <path> --runtime opencode
  evobuddy doctor [--project <path>] [--json]
  evobuddy agents sync --project <path> --agents-registry <path> [--registry <path>]
  evobuddy agents doctor --project <path> --agents-registry <path> [--registry <path>]
  evobuddy buddies invoke <buddyName> --task <text> --project <path>
  evobuddy buddies sync --project <path>
  evobuddy workbench --project <path>
  evobuddy taskroom create --project <path> --objective <text> [--runtime <name>] --json
  evobuddy taskroom handoff create --project <path> --room <id> --from <id> --to <id> --body <text> --json
  evobuddy taskroom list --project <path> --json
  evobuddy taskroom session reserve --project <path> --room <id> --instance <id> --runtime <name>
  evobuddy taskroom session list --project <path> --json
  evobuddy taskroom session plan-open --project <path> --room <id> --instance <id> --runtime <name> --json
  evobuddy evolution apply --project <path> --patch <path>
  evobuddy updates recent --project <path> --json --limit <n>
  evobuddy members invoke <memberName> --task <text> --project <path>
  evobuddy --version

evobuddy is the EvoBuddy product dispatcher. Project state authority lives in .evobuddy/.
`;
}

function setupHelp() {
  return `Usage: evobuddy setup --project <path> --runtime opencode [--json]

Initializes the project state layout without destructive overwrite:
  .evobuddy/state.json           project state schema
  .evobuddy/registry.json        confirmed Buddy registry
  .evobuddy/runs/                Buddy invocation/product artifacts
  .evobuddy/imports/             unconfirmed cold-start candidate bundles
  .evobuddy/knowledge/           knowledge index, facts, and SOPs
  .evobuddy/buddies/             project Buddy overlays/candidates
  .evobuddy/skills/              project Skill definitions/candidates
  .evobuddy/projections/         runtime projection refs/reports
  .evobuddy/instructions/        runtime-facing instruction install reports/text
  .evobuddy/release/             release-eval reports and readiness artifacts

Setup seeds missing bundled product presets such as evolution-buddy and preserves user-defined collisions.
`;
}

function buddySyncHelp() {
  return `Usage: evobuddy buddies sync --project <path> [--registry <path>] [--member <member>] [--runtime all|opencode|claude|codex] [--report-out <path>] [--dry-run]

Uses the project registry at .evobuddy/registry.json by default.
`;
}

function buddyDoctorHelp() {
  return `Usage: evobuddy buddies doctor --project <path> [--registry <path>] [--member <member>] [--runtime all|opencode|claude|codex] [--report-out <path>]

Checks runtime definition drift against the project registry at .evobuddy/registry.json by default.
`;
}

function agentSyncHelp() {
  return `Usage: evobuddy agents sync --project <path> --agents-registry <path> [--registry <path>] [--member <actor>] [--runtime all|opencode|claude|codex] [--report-out <path>] [--dry-run]

Uses the supplied TeamAgent registry plus the Buddy registry for combined actor-aware runtime projections.
`;
}

function agentDoctorHelp() {
  return `Usage: evobuddy agents doctor --project <path> --agents-registry <path> [--registry <path>] [--member <actor>] [--runtime all|opencode|claude|codex] [--report-out <path>]

Checks actor-aware runtime definition drift against the supplied TeamAgent and Buddy registries.
`;
}

function buddyInvokeHelp() {
  return `Usage: evobuddy buddies invoke <buddyName> --task <text> --project <path> [--out <path>] [--registry <path>] [--json]

Uses the project registry at .evobuddy/registry.json by default. Direct CLI execution is adapter glue, not product proof.
`;
}

function workbenchHelp() {
  return `Usage: evobuddy workbench --project <path> [--view <name>] [--out <path>] [--json-out <path>]

Default product route launches the Rust EvoBuddy TUI when available.

Interactive EvoBuddy Workbench mode:
  evobuddy workbench --project <path> --interactive --input-root <root>
  evobuddy workbench --project <path> --interactive --aggregate-report <path> --plan1-report <path> --plan2-report <path> --taskroom-report <path> [--taskroom-report <path>]
  evobuddy workbench --project <path> --input-root <root> --json-out <path>
  evobuddy workbench --project <path> --headless-snapshot <path>
  evobuddy workbench --project <path> --legacy-text

When interactive EvoBuddy mode is selected, the command routes to the actor-aware TeamAgent / Focused Buddy / TaskRoom TUI.
When actor-aware report flags are selected with --json-out, the command exports normalized WorkbenchState JSON for the Rust TUI backend.
If the Rust binary is missing, the command exits non-zero with a build instruction instead of silently falling back.
`;
}

function invokeHelp() {
  return `Usage: evobuddy members invoke <memberName> --task <text> --project <path> [--out <path>] [--registry <path>] [--json]

Uses the project registry at .evobuddy/registry.json by default.
`;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function isoNow() {
  return new Date().toISOString();
}

function parseFlags(argv) {
  const parsed = { passthrough: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') parsed.project = requireValue(argv, i += 1, arg);
    else if (arg === '--runtime') parsed.runtime = requireValue(argv, i += 1, arg);
    else if (arg === '--task') parsed.task = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--agents-registry') parsed.agentsRegistry = requireValue(argv, i += 1, arg);
    else if (arg === '--member') parsed.member = requireValue(argv, i += 1, arg);
    else if (arg === '--report-out') parsed.reportOut = requireValue(argv, i += 1, arg);
    else if (arg === '--patch') parsed.patch = requireValue(argv, i += 1, arg);
    else if (arg === '--apply-intent') parsed.applyIntent = requireValue(argv, i += 1, arg);
    else if (arg === '--actor-ref') parsed.actorRef = requireValue(argv, i += 1, arg);
    else if (arg === '--created-at') parsed.createdAt = requireValue(argv, i += 1, arg);
    else if (arg === '--limit') parsed.limit = Number.parseInt(requireValue(argv, i += 1, arg), 10);
    else if (arg === '--view') parsed.view = requireValue(argv, i += 1, arg);
    else if (arg === '--room') parsed.room = requireValue(argv, i += 1, arg);
    else if (arg === '--instance') parsed.instance = requireValue(argv, i += 1, arg);
    else if (arg === '--workspace') parsed.workspace = requireValue(argv, i += 1, arg);
    else if (arg === '--mode') parsed.mode = requireValue(argv, i += 1, arg);
    else if (arg === '--participant') parsed.participant = requireValue(argv, i += 1, arg);
    else if (arg === '--descriptor') parsed.descriptor = requireValue(argv, i += 1, arg);
    else if (arg === '--substrate-ref') parsed.substrateRef = requireValue(argv, i += 1, arg);
    else if (arg === '--session-ref') parsed.sessionRef = requireValue(argv, i += 1, arg);
    else if (arg === '--context-packet-ref') parsed.contextPacketRef = requireValue(argv, i += 1, arg);
    else if (arg === '--provider-conversation-ref') parsed.providerConversationRef = requireValue(argv, i += 1, arg);
    else if (arg === '--safety-mode') parsed.safetyMode = requireValue(argv, i += 1, arg);
    else if (arg === '--objective') parsed.objective = requireValue(argv, i += 1, arg);
    else if (arg === '--title') parsed.title = requireValue(argv, i += 1, arg);
    else if (arg === '--actor') parsed.actor = requireValue(argv, i += 1, arg);
    else if (arg === '--from') parsed.from = requireValue(argv, i += 1, arg);
    else if (arg === '--to') parsed.to = requireValue(argv, i += 1, arg);
    else if (arg === '--body') parsed.body = requireValue(argv, i += 1, arg);
    else if (arg === '--acceptance') parsed.acceptanceCriteria = requireValue(argv, i += 1, arg);
    else if (arg === '--acceptance-criteria') parsed.acceptanceCriteria = requireValue(argv, i += 1, arg);
    else if (arg === '--json-out') parsed.jsonOut = requireValue(argv, i += 1, arg);
    else if (arg === '--input-root') parsed.inputRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--aggregate-report') parsed.aggregateReport = requireValue(argv, i += 1, arg);
    else if (arg === '--plan1-report') parsed.plan1Report = requireValue(argv, i += 1, arg);
    else if (arg === '--plan2-report') parsed.plan2Report = requireValue(argv, i += 1, arg);
    else if (arg === '--headless-snapshot') parsed.headlessSnapshot = requireValue(argv, i += 1, arg);
    else if (arg === '--headless-width') parsed.headlessWidth = requireValue(argv, i += 1, arg);
    else if (arg === '--headless-height') parsed.headlessHeight = requireValue(argv, i += 1, arg);
    else if (arg === '--frame-dump-path') parsed.frameDumpPath = requireValue(argv, i += 1, arg);
    else if (arg === '--legacy-text') parsed.legacyText = true;
    else if (arg === '--json') parsed.json = true;
    else {
      parsed.passthrough.push(arg);
      if (arg.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) parsed.passthrough.push(argv[i += 1]);
    }
  }
  return parsed;
}

function firstNonEmptyLine(text) {
  return String(text ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function resolveCommandPath(command) {
  const lookup = process.platform === 'win32'
    ? spawnSync('where', [command], { encoding: 'utf8' })
    : spawnSync('which', [command], { encoding: 'utf8' });
  if (lookup.error || lookup.status !== 0) return null;
  return firstNonEmptyLine(lookup.stdout);
}

function probeCommandVersion(commandPath, args) {
  const result = spawnSync(commandPath, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return firstNonEmptyLine(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
}

function probeCliRuntime(command, versionArgs, { includePath = false } = {}) {
  const commandPath = resolveCommandPath(command);
  const present = Boolean(commandPath);
  const version = present ? probeCommandVersion(commandPath, versionArgs) : null;
  const base = { present, version };
  return includePath ? { ...base, path: commandPath } : base;
}

function probeDoctorRuntimes() {
  return {
    pi: probeCliRuntime('pi', ['--version'], { includePath: true }),
    tmux: probeCliRuntime('tmux', ['-V']),
  };
}

function sampleSelfRssKb() {
  if (process.platform !== 'linux') return null;
  try {
    const status = readFileSync(`/proc/${process.pid}/status`, 'utf8');
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function doctorMemoryBudgetNote() {
  return {
    note: 'Soft memory budget (spec A3/S3): idle pi rpc p95 < 250MB; 2× pi sum < 500MB; multi-seat pi sum ≤ 40% of one OpenCode process tree when sampled.',
    sampleCommand: 'node scripts/context-tree/sample-seat-rss.mjs --count 2 --hold-ms 3000 --include-opencode',
    selfRssKb: sampleSelfRssKb(),
  };
}

function taskroomHelp() {
  return `Usage:
  evobuddy taskroom create --project <path> --objective <text> [--runtime <name>] [--title <text>] [--actor <name>] [--workspace <path>] [--safety-mode <mode>] [--acceptance <text>] --json
  evobuddy taskroom handoff create --project <path> --room <id> --from <id> --to <id> --body <text> --json
  evobuddy taskroom wake list --project <path> --room <id> --json
  evobuddy taskroom message check --project <path> --room <id> --participant <id> --json
  evobuddy taskroom list --project <path> --json
  evobuddy taskroom session reserve --project <path> --room <id> --instance <id> --runtime <name> [--workspace <path>] [--participant <name>] [--json]
  evobuddy taskroom session list --project <path> [--json]
  evobuddy taskroom session plan-open --project <path> --room <id> --instance <id> --runtime <name> [--workspace <path>] [--mode <kind>] [--participant <name>] [--json]
  evobuddy taskroom session commit --project <path> --descriptor <id> --substrate-ref <ref> [--json]
  evobuddy taskroom session inspect --project <path> --descriptor <id> [--json]
  evobuddy taskroom session reconcile --project <path> [--json]
  evobuddy taskroom refresh --project <path> --room <id> [--json]
`;
}

function taskroomSessionHelp() {
  return taskroomHelp();
}

async function taskroomCreate(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.objective) throw new Error('missing value for --objective');
  const runtime = args.runtime ?? 'pi';
  const projectRoot = resolve(args.project);
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createTaskRoomFromDraft(projectRoot, {
    objective: args.objective,
    acceptanceCriteria: args.acceptanceCriteria,
    workspace: args.workspace ? resolve(args.workspace) : projectRoot,
    actor: args.actor,
    runtime,
    safetyMode: args.safetyMode,
    title: args.title,
  });
  return { stdout: args.json ? `${JSON.stringify(room)}\n` : `${room.roomId}\n` };
}

async function taskroomHandoffCreate(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  if (!args.from) throw new Error('missing value for --from');
  if (!args.to) throw new Error('missing value for --to');
  if (!args.body) throw new Error('missing value for --body');
  const projectRoot = resolve(args.project);
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const handoff = await createHandoffFromDraft(projectRoot, {
    roomId: args.room,
    from: args.from,
    to: args.to,
    body: args.body,
  });
  return { stdout: args.json ? `${JSON.stringify(handoff)}\n` : `${handoff.handoffId}\n` };
}

async function taskroomWakeList(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  const projectRoot = resolve(args.project);
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const wakes = await listWakes(projectRoot, args.room);
  return { stdout: args.json ? `${JSON.stringify({ wakes })}\n` : `${wakes.length}\n` };
}

async function taskroomMessageCheck(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  if (!args.participant) throw new Error('missing value for --participant');
  const projectRoot = resolve(args.project);
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const pulled = await pullHandoffBodyAfterWake(projectRoot, {
    roomId: args.room,
    participantId: args.participant,
  });
  return { stdout: args.json ? `${JSON.stringify(pulled)}\n` : `${pulled.body}\n` };
}

async function taskroomList(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const projectRoot = resolve(args.project);
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const rooms = await listTaskRooms(projectRoot);
  const payload = { schema: 'evobuddy.taskroom-list.v1', rooms };
  return { stdout: args.json ? `${JSON.stringify(payload)}\n` : `${rooms.map((room) => room.roomId).join('\n')}${rooms.length ? '\n' : ''}` };
}

async function taskroomSessionReserve(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomSessionHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  if (!args.instance) throw new Error('missing value for --instance');
  if (!args.runtime) throw new Error('missing value for --runtime');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const adapter = getRuntimeSessionAdapter(args.runtime);
  const capability = await adapter.probe({ projectRoot: state.projectRoot, workspace: resolve(args.workspace ?? state.projectRoot) });
  const descriptor = await reserveNativeSession(state.projectRoot, {
    descriptorId: args.descriptor ?? `native-session-${randomUUID()}`,
    roomId: args.room,
    agentInstanceId: args.instance,
    runtime: args.runtime,
    workspace: resolve(args.workspace ?? state.projectRoot),
    terminalSubstrate: 'tmux',
    terminalSessionRef: args.sessionRef ?? buildManagedTerminalSessionRef({ runtime: args.runtime, roomId: args.room, agentInstanceId: args.instance }),
    providerConversationRef: args.providerConversationRef ?? null,
    launchCommandRef: `launch-command:${args.runtime}:pending`,
    runtimeCapabilityRef: capability.capabilityId,
    createdAt: isoNow(),
    lastAttachedAt: null,
    safetyMode: args.safetyMode ?? 'workspace-write',
    contextPacketRef: args.contextPacketRef ?? args.room,
    evidenceRefs: [],
    recoveryPolicy: 'reconcile-existing',
  });
  return { stdout: args.json ? `${JSON.stringify(descriptor)}\n` : `${descriptor.descriptorId}\n` };
}

async function taskroomSessionPlanOpen(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomSessionHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  if (!args.instance) throw new Error('missing value for --instance');
  if (!args.runtime) throw new Error('missing value for --runtime');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const descriptorId = args.descriptor ?? `native-session-${randomUUID()}`;
  const plan = await createRuntimeSessionOpenPlan({
    projectRoot: state.projectRoot,
    descriptorId,
    roomId: args.room,
    agentInstanceId: args.instance,
    runtime: args.runtime,
    workspace: resolve(args.workspace ?? state.projectRoot),
    providerConversationRef: args.providerConversationRef ?? null,
    providerConversationRefValidated: Boolean(args.providerConversationRef),
    terminalSessionRef: args.sessionRef ?? buildManagedTerminalSessionRef({ runtime: args.runtime, roomId: args.room, agentInstanceId: args.instance }),
    contextPacketRef: args.contextPacketRef ?? args.room,
    safetyMode: args.safetyMode ?? 'workspace-write',
    participant: args.participant ?? args.instance,
    requestedMode: args.mode ?? null,
  });
  return { stdout: args.json ? `${JSON.stringify(plan)}\n` : `${plan.createSessionRequest.launcherPlanRef}\n` };
}

async function taskroomSessionCommit(argv) {
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.descriptor) throw new Error('missing value for --descriptor');
  if (!args.substrateRef) throw new Error('missing value for --substrate-ref');
  const committed = await commitNativeSession(resolve(args.project), args.descriptor, {
    sessionRef: args.substrateRef,
    exists: true,
  });
  return { stdout: args.json ? `${JSON.stringify(committed)}\n` : `${committed.descriptorId}\n` };
}

async function taskroomSessionInspect(argv) {
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.descriptor) throw new Error('missing value for --descriptor');
  const descriptor = await readNativeSession(resolve(args.project), args.descriptor);
  return { stdout: args.json ? `${JSON.stringify(descriptor)}\n` : `${descriptor.descriptorId}\n` };
}

async function taskroomSessionList(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomSessionHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const descriptors = await listNativeSessions(resolve(args.project));
  if (args.json) {
    return { stdout: `${JSON.stringify(descriptors)}\n` };
  }
  return {
    stdout: descriptors.length === 0
      ? ''
      : `${descriptors.map((descriptor) => descriptor.descriptorId).join('\n')}\n`,
  };
}

async function taskroomSessionReconcile(argv) {
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const descriptors = await listNativeSessions(resolve(args.project));
  const classifications = classifySessionReconciliation(descriptors, []);
  return { stdout: args.json ? `${JSON.stringify({ status: 'pass', classifications })}\n` : `${classifications.length}\n` };
}

async function taskroomRefresh(argv) {
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const descriptors = (await listNativeSessions(state.projectRoot)).filter((descriptor) => descriptor.roomId === args.room);
  const refreshedAt = isoNow();
  const entries = [];
  for (const descriptor of descriptors) {
    const adapter = getRuntimeSessionAdapter(descriptor.runtime);
    const refreshed = await adapter.refreshEvidence({ descriptor, projectRoot: state.projectRoot });
    entries.push({
      descriptorId: descriptor.descriptorId,
      runtime: descriptor.runtime,
      refreshedAt,
      evidenceRef: refreshed.evidenceRef,
      observation: refreshed.observation,
      diagnostics: refreshed.diagnostics,
    });
  }
  const record = createEvidenceRefreshRecord({
    refreshId: `refresh-${randomUUID()}`,
    roomId: args.room,
    refreshedAt,
    descriptors: entries,
  });
  const targetPath = state.evidenceRefreshRecordPath(args.room);
  writeFileSync(targetPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return { stdout: args.json ? `${JSON.stringify(record)}\n` : `${targetPath}\n` };
}

function spawnNode(scriptRel, args) {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, scriptRel), ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status ?? 1 };
}

function spawnNodeInteractive(scriptRel, args) {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, scriptRel), ...args], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  return { code: result.status ?? 0 };
}

function spawnBinary(binaryPath, args) {
  const result = spawnSync(binaryPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status ?? 1 };
}

function spawnBinaryInteractive(binaryPath, args) {
  const result = spawnSync(binaryPath, args, { cwd: REPO_ROOT, stdio: 'inherit' });
  return { code: result.status ?? 1 };
}

export function resolveRustWorkbenchBinary(repoRoot = REPO_ROOT, env = process.env) {
  if (env.EVOBUDDY_RUST_WORKBENCH_BINARY) {
    const overridePath = resolve(env.EVOBUDDY_RUST_WORKBENCH_BINARY);
    return existsSync(overridePath) ? overridePath : undefined;
  }
  const releasePath = join(repoRoot, 'target/release/evobuddy-tui');
  if (existsSync(releasePath)) return releasePath;
  const debugPath = join(repoRoot, 'target/debug/evobuddy-tui');
  if (existsSync(debugPath)) return debugPath;
  return undefined;
}

function missingRustWorkbenchBinaryResult() {
  return {
    stderr: 'Rust workbench binary not found. Run npm run evobuddy:tui-build\n',
    code: 1,
  };
}

export function resolveWorkbenchInvocation(argv, stateRoot) {
  const args = parseFlags(argv);
  const actorAwareRequest = Boolean(
    args.inputRoot
      || args.aggregateReport
      || args.plan1Report
      || args.plan2Report
      || args.passthrough.includes('--taskroom-report')
      || args.passthrough.includes('--evobuddy')
      || args.passthrough.includes('--interactive')
      || args.passthrough.includes('--actor')
      || args.passthrough.includes('--taskroom')
  );
  const forwarded = actorAwareRequest
    ? ['--evobuddy', '--view', args.view ?? 'overview']
    : ['--input', stateRoot.runsPath, '--registry', stateRoot.registryPath, '--view', args.view ?? 'overview'];
  if (actorAwareRequest && args.passthrough.includes('--interactive')) forwarded.push('--interactive');
  if (actorAwareRequest && args.inputRoot) forwarded.push('--input-root', resolve(args.inputRoot));
  if (actorAwareRequest && args.aggregateReport) forwarded.push('--aggregate-report', resolve(args.aggregateReport));
  if (actorAwareRequest && args.plan1Report) forwarded.push('--plan1-report', resolve(args.plan1Report));
  if (actorAwareRequest && args.plan2Report) forwarded.push('--plan2-report', resolve(args.plan2Report));
  for (let index = 0; index < args.passthrough.length; index += 1) {
    if (args.passthrough[index] === '--taskroom-report' && args.passthrough[index + 1]) {
      forwarded.push('--taskroom-report', resolve(args.passthrough[index + 1]));
      index += 1;
    }
  }
  if (args.out) forwarded.push('--out', resolve(args.out));
  if (args.jsonOut) forwarded.push('--json-out', resolve(args.jsonOut));
  forwarded.push(...args.passthrough.filter((value) => value !== '--interactive'));
  return {
    actorAwareRequest,
    interactive: actorAwareRequest && args.passthrough.includes('--interactive'),
    stateExport: actorAwareRequest
      && Boolean(args.jsonOut)
      && !args.legacyText
      && !args.passthrough.includes('--interactive'),
    legacyText: Boolean(args.legacyText),
    rustProductRoute: !args.legacyText && !args.jsonOut,
    forwarded,
  };
}

function collectResolvedTaskroomReports(passthrough) {
  const reports = [];
  for (let index = 0; index < passthrough.length; index += 1) {
    if (passthrough[index] === '--taskroom-report' && passthrough[index + 1]) {
      reports.push(resolve(passthrough[index + 1]));
      index += 1;
    }
  }
  return reports;
}

function resolveWorkbenchStateExportArgs(argv, projectRoot) {
  const args = parseFlags(argv);
  const forwarded = ['--project', projectRoot];
  if (args.inputRoot) forwarded.push('--input-root', resolve(args.inputRoot));
  if (args.aggregateReport) forwarded.push('--aggregate-report', resolve(args.aggregateReport));
  if (args.plan1Report) forwarded.push('--plan1-report', resolve(args.plan1Report));
  if (args.plan2Report) forwarded.push('--plan2-report', resolve(args.plan2Report));
  for (const reportPath of collectResolvedTaskroomReports(args.passthrough)) {
    forwarded.push('--taskroom-report', reportPath);
  }
  if (args.jsonOut) forwarded.push('--out', resolve(args.jsonOut));
  return forwarded;
}

function resolveRustWorkbenchArgs(argv, projectRoot) {
  const args = parseFlags(argv);
  const forwarded = ['--project', projectRoot];
  if (args.inputRoot) forwarded.push('--input-root', resolve(args.inputRoot));
  if (args.aggregateReport) forwarded.push('--aggregate-report', resolve(args.aggregateReport));
  if (args.plan1Report) forwarded.push('--plan1-report', resolve(args.plan1Report));
  if (args.plan2Report) forwarded.push('--plan2-report', resolve(args.plan2Report));
  for (const reportPath of collectResolvedTaskroomReports(argv)) {
    forwarded.push('--taskroom-report', reportPath);
  }
  if (args.headlessSnapshot) forwarded.push('--headless-snapshot', resolve(args.headlessSnapshot));
  if (args.headlessWidth) forwarded.push('--headless-width', args.headlessWidth);
  if (args.headlessHeight) forwarded.push('--headless-height', args.headlessHeight);
  if (args.frameDumpPath) forwarded.push('--frame-dump-path', resolve(args.frameDumpPath));
  if (args.headlessSnapshot) forwarded.push('--quit-after-render');
  return forwarded;
}

async function setupProject(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: setupHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if ((args.runtime ?? 'opencode') !== 'opencode') throw new Error(`runtime not implemented for setup: ${args.runtime}`);
  const state = await ensureEvobuddyProjectState({ projectRoot: args.project });
  const instructionInstall = installOpenCodeMemberInstructions({ projectRoot: state.projectRoot });
  const report = {
    status: 'pass',
    project: state.projectRoot,
    stateRoot: state.stateRoot,
    runtime: 'opencode',
    registryCreated: state.created.registry,
    knowledgePath: state.knowledgePath,
    presetSeeding: state.presetSeeding,
    instructionPath: instructionInstall.instructionPath,
    instructionInstall,
  };
  return { stdout: args.json ? `${JSON.stringify(report)}\n` : `EvoBuddy setup complete: ${state.stateRoot}\nOpenCode instructions: ${instructionInstall.instructionPath}\n` };
}

async function doctor(argv) {
  const json = argv.includes('--json');
  const args = parseFlags(argv);
  const commands = Object.fromEntries(Object.entries(TARGETS).map(([name, target]) => [name, { target, exists: existsSync(join(REPO_ROOT, target)) }]));
  const report = {
    status: Object.values(commands).every((entry) => entry.exists) && PACKAGE_JSON.bin?.evobuddy === 'scripts/evobuddy/evobuddy.mjs' ? 'pass' : 'fail',
    bin: 'evobuddy',
    packageBin: PACKAGE_JSON.bin?.evobuddy,
    dispatcherThin: true,
    liveRuntimeRequired: false,
    runtimes: probeDoctorRuntimes(),
    memory: doctorMemoryBudgetNote(),
    commands,
  };
  if (args.project) {
    const state = resolveEvobuddyProjectState({ projectRoot: args.project });
    report.project = state.projectRoot;
    const requiredPaths = [state.stateSchemaPath, state.registryPath, state.runsPath, state.importsPath, state.releasePathRoot, state.knowledgePath, state.knowledgeIndexPath, state.knowledgeFactsPath, state.knowledgeSopsPath, state.projectBuddiesPath, state.projectSkillsPath, state.recentUpdatesPath];
    report.setup = { status: requiredPaths.every((path) => existsSync(path)) ? 'pass' : 'fail', requiredPaths };
    report.status = report.setup.status === 'pass' && report.status === 'pass' ? 'pass' : 'fail';
  }
  return { stdout: json ? `${JSON.stringify(report)}\n` : `${usage()}\nDoctor status: ${report.status}\n`, code: report.status === 'pass' ? 0 : 1 };
}

async function buddiesSync(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: buddySyncHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const forwarded = ['sync', '--registry', resolve(args.registry ?? state.registryPath), '--project', state.projectRoot];
  if (args.member) forwarded.push('--member', args.member);
  forwarded.push(...args.passthrough);
  if (args.reportOut) forwarded.push('--report-out', args.reportOut);
  return spawnNode(TARGETS.syncBuddyProjections, forwarded);
}

async function buddiesDoctor(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: buddyDoctorHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const forwarded = ['doctor', '--registry', resolve(args.registry ?? state.registryPath), '--project', state.projectRoot];
  if (args.member) forwarded.push('--member', args.member);
  forwarded.push(...args.passthrough);
  if (args.reportOut) forwarded.push('--report-out', args.reportOut);
  return spawnNode(TARGETS.syncBuddyProjections, forwarded);
}

async function agentsSync(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: agentSyncHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.agentsRegistry) throw new Error('missing value for --agents-registry');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const forwarded = ['sync', '--agents-registry', resolve(args.agentsRegistry), '--registry', resolve(args.registry ?? state.registryPath), '--project', state.projectRoot];
  if (args.member) forwarded.push('--member', args.member);
  forwarded.push(...args.passthrough);
  if (args.reportOut) forwarded.push('--report-out', args.reportOut);
  return spawnNode(TARGETS.syncBuddyProjections, forwarded);
}

async function agentsDoctor(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: agentDoctorHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.agentsRegistry) throw new Error('missing value for --agents-registry');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const forwarded = ['doctor', '--agents-registry', resolve(args.agentsRegistry), '--registry', resolve(args.registry ?? state.registryPath), '--project', state.projectRoot];
  if (args.member) forwarded.push('--member', args.member);
  forwarded.push(...args.passthrough);
  if (args.reportOut) forwarded.push('--report-out', args.reportOut);
  return spawnNode(TARGETS.syncBuddyProjections, forwarded);
}

async function membersInvoke(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: invokeHelp() };
  const memberName = argv[0];
  if (!memberName || memberName.startsWith('--')) throw new Error('missing memberName');
  const args = parseFlags(argv.slice(1));
  if (!args.task) throw new Error('missing value for --task');
  if (!args.project) throw new Error('missing value for --project');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const out = args.out ? resolve(args.out) : state.runPath(`invoke-${Date.now()}`);
  const forwarded = ['--member-name', memberName, '--task', args.task, '--project-identity', state.projectRoot, '--out', out, '--registry', resolve(args.registry ?? state.registryPath)];
  if (args.json) forwarded.push('--json');
  return spawnNode(TARGETS.invoke, forwarded);
}

async function buddiesInvoke(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: buddyInvokeHelp() };
  const buddyName = argv[0];
  if (!buddyName || buddyName.startsWith('--')) throw new Error('missing buddyName');
  const args = parseFlags(argv.slice(1));
  if (!args.task) throw new Error('missing value for --task');
  if (!args.project) throw new Error('missing value for --project');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const out = args.out ? resolve(args.out) : state.runPath(`invoke-buddy-${Date.now()}`);
  const forwarded = ['--buddy-name', buddyName, '--task', args.task, '--project-identity', state.projectRoot, '--out', out, '--registry', resolve(args.registry ?? state.registryPath)];
  forwarded.push(...args.passthrough);
  if (args.json) forwarded.push('--json');
  return spawnNode(TARGETS.invokeBuddy, forwarded);
}

async function workbench(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: workbenchHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  await generateRecentUpdateSummary({ projectRoot: state.projectRoot, limit: 10 });
  const invocation = resolveWorkbenchInvocation(argv, state);
  if (invocation.stateExport) return spawnNode(TARGETS.workbenchStateExport, resolveWorkbenchStateExportArgs(argv, state.projectRoot));
  if (invocation.rustProductRoute) {
    const binaryPath = resolveRustWorkbenchBinary(REPO_ROOT);
    if (!binaryPath) return missingRustWorkbenchBinaryResult();
    const rustArgs = resolveRustWorkbenchArgs(argv, state.projectRoot);
    const interactive = !args.headlessSnapshot;
    return interactive ? spawnBinaryInteractive(binaryPath, rustArgs) : spawnBinary(binaryPath, rustArgs);
  }
  return invocation.interactive
    ? spawnNodeInteractive(TARGETS.workbench, invocation.forwarded)
    : spawnNode(TARGETS.workbench, invocation.forwarded);
}

async function evolutionApply(argv) {
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.patch) throw new Error('missing value for --patch');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const forwarded = [
    '--project', state.projectRoot,
    '--patch', resolve(args.patch),
    '--apply-intent', args.applyIntent ?? 'none',
    '--actor-ref', args.actorRef ?? 'parent-agent',
  ];
  if (args.createdAt) forwarded.push('--created-at', args.createdAt);
  forwarded.push(...args.passthrough);
  if (args.json) forwarded.push('--json');
  return spawnNode(TARGETS.evolutionApply, forwarded);
}

async function updatesRecent(argv) {
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
  const summary = await readRecentUpdateSummary({ projectRoot: state.projectRoot, limit: Number.isInteger(args.limit) ? args.limit : 10 });
  return { stdout: args.json ? `${JSON.stringify(summary)}\n` : `${summary.items.map((item) => `- ${item.text}`).join('\n')}\n` };
}

async function dispatch(argv) {
  const [command, subcommand, action, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') return { stdout: usage() };
  if (command === '--version' || command === 'version') return { stdout: `evobuddy ${PACKAGE_JSON.version}\n` };
  if (command === 'setup') return setupProject(argv.slice(1));
  if (command === 'doctor') return doctor(argv.slice(1));
  if (command === 'workbench') return workbench(argv.slice(1));
  if (command === 'taskroom' && subcommand === 'create') return taskroomCreate([action, ...rest].filter((value) => value !== undefined));
  if (command === 'taskroom' && subcommand === 'list') return taskroomList([action, ...rest].filter((value) => value !== undefined));
  if (command === 'taskroom' && subcommand === 'handoff' && action === 'create') return taskroomHandoffCreate(rest);
  if (command === 'taskroom' && subcommand === 'wake' && action === 'list') return taskroomWakeList(rest);
  if (command === 'taskroom' && subcommand === 'message' && action === 'check') return taskroomMessageCheck(rest);
  if (command === 'taskroom' && subcommand === 'session' && action === 'reserve') return taskroomSessionReserve(rest);
  if (command === 'taskroom' && subcommand === 'session' && action === 'list') return taskroomSessionList(rest);
  if (command === 'taskroom' && subcommand === 'session' && action === 'plan-open') return taskroomSessionPlanOpen(rest);
  if (command === 'taskroom' && subcommand === 'session' && action === 'commit') return taskroomSessionCommit(rest);
  if (command === 'taskroom' && subcommand === 'session' && action === 'inspect') return taskroomSessionInspect(rest);
  if (command === 'taskroom' && subcommand === 'session' && action === 'reconcile') return taskroomSessionReconcile(rest);
  if (command === 'taskroom' && subcommand === 'refresh') return taskroomRefresh([action, ...rest].filter((value) => value !== undefined));
  if (command === 'evolution' && subcommand === 'apply') return evolutionApply([action, ...rest].filter((value) => value !== undefined));
  if (command === 'updates' && subcommand === 'recent') return updatesRecent([action, ...rest].filter((value) => value !== undefined));
  if (command === 'members' && subcommand === 'invoke') return membersInvoke([action, ...rest].filter((value) => value !== undefined));
  if (command === 'agents' && subcommand === 'sync') return agentsSync([action, ...rest].filter((value) => value !== undefined));
  if (command === 'agents' && subcommand === 'doctor') return agentsDoctor([action, ...rest].filter((value) => value !== undefined));
  if (command === 'buddies' && subcommand === 'invoke') return buddiesInvoke([action, ...rest].filter((value) => value !== undefined));
  if (command === 'buddies' && subcommand === 'sync') return buddiesSync([action, ...rest].filter((value) => value !== undefined));
  if (command === 'buddies' && subcommand === 'doctor') return buddiesDoctor([action, ...rest].filter((value) => value !== undefined));
  throw new Error(`unknown command: ${argv.join(' ')}\n${usage()}`);
}

async function main(argv = process.argv.slice(2)) {
  const result = await dispatch(argv);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.code ?? 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
