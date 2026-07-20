#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureContextTreeProjectState, resolveContextTreeProjectState } from '../../src/core/context-tree-project-state.mjs';
import { installOpenCodeMemberInstructions } from '../../src/install/opencode-member-instructions.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OPENCODE_DB = '/home/prosumer/.local/share/opencode/opencode.db';
const BUNDLED_REGISTRY = join(REPO_ROOT, 'fixtures/member-surface/registry.json');
const PACKAGE_JSON = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf8'));

const TARGETS = {
  invoke: 'scripts/context-tree/invoke-member.mjs',
  invokeBuddy: 'scripts/context-tree/invoke-buddy.mjs',
  buddyLoop: 'scripts/context-tree/run-evobuddy-product-grade-loop-v0.mjs',
  import: 'scripts/context-tree/run-member-setup-import.mjs',
  memberDiscoveryAgentAssisted: 'scripts/context-tree/run-member-discovery-agent-assisted.mjs',
  memberDiscoveryProduct: 'scripts/context-tree/run-member-discovery-product.mjs',
  workbench: 'scripts/context-tree/render-member-workbench.mjs',
  syncBuddyProjections: 'scripts/context-tree/install-member-projections.mjs',
  exportOpenCodeCorpus: 'scripts/context-tree/export-opencode-session-corpus.mjs',
  exportClaudeNativeBuddySurfaceProof: 'scripts/context-tree/export-claude-native-buddy-surface-proof.mjs',
  exportCodexNativeBuddySurfaceProof: 'scripts/context-tree/export-codex-native-buddy-surface-proof.mjs',
  finalizeRuntimeNativeBuddyProductRoot: 'scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs',
  runThreeRuntimeBuddySurfaceReleaseEval: 'scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs',
  coldStart: 'scripts/context-tree/run-member-session-cold-start.mjs',
  probeThreeRuntimeBuddySurfaces: 'scripts/context-tree/probe-three-runtime-buddy-surfaces.mjs',
};

function usage() {
  return `Usage:
  ctree setup --project <path> --runtime opencode
  ctree doctor [--project <path>] [--json]
  ctree members import --project <path>
  ctree members import --action <json> --project <path> --candidates <path> ...
  ctree members discover --project <path> [--db <path>] [--out <path>] [--json]
  ctree buddies invoke <buddyName> --task <text> --project <path>
  ctree buddies sync --project <path>
  ctree buddies loop --project <path> --out <path>
  ctree buddies native probe --project <path> --out <path> --require-runtimes opencode,claude,codex
  ctree buddies native finalize --runtime-proof <path> --out <product-root>
  ctree buddies native release-eval --project <path> --member <member> --out <path> --require-runtimes opencode,claude,codex
  ctree buddies native claude-proof --session-corpus <path> --baseline-report <path> --member <name> --out <path>
  ctree buddies native codex-proof --session-corpus <path> --baseline-report <path> --member <name> --out <path>
  ctree members invoke <memberName> --task <text> --project <path>
  ctree workbench [render-member-workbench options]
  ctree --version

ctree is a thin dispatcher for Context Tree / EvoBuddy runtime adapters. Discovery, memory policy, product proof policy, native-spawn proof, autonomous Buddy selection, and durable member mutations stay in explicit evidence-producing commands.
`;
}

function discoverHelp() {
  return `Usage:
  ctree members discover --project <path> [--db <path>] [--out <path>] [--json]
  ctree members discover product --project <path> --db <path> --out <path> [--json]
  ctree members discover product prepare --session-corpus-export <path>|--db <path> --project-identity <path> --out <path>
  ctree members discover answer-gate --state <path> --answer-file <path> [--answer-source manual-retained|observed-parent-agent-turn --transcript-ref <path> --observed-turn-digest <sha256:...>]
  ctree members discover answer-extractor --state <path> --answer-file <path> [--answer-source manual-retained|observed-parent-agent-turn --transcript-ref <path> --observed-turn-digest <sha256:...>]
  ctree members discover product answer-gate --state <path> --observed-turn <path>
  ctree members discover product answer-extractor --state <path> --observed-turn <path>

Product-facing alias. Prepare exports an OpenCode session corpus and writes the first agent-assisted member-discovery request packet.
Answer phases delegate to scripts/context-tree/run-member-discovery-agent-assisted.mjs. Discovery creates unconfirmed candidates only.
Product proof phases delegate to scripts/context-tree/run-member-discovery-product.mjs and require runtime-observer-shaped observed parent-agent turn artifacts.
`;
}

function productDiscoverHelp() {
  return `Usage:
  ctree members discover product --project <path> --db <path> --out <path> [--json]
  ctree members discover product prepare --session-corpus-export <path>|--db <path> --project-identity <path> --out <path>
  ctree members discover product answer-gate --state <path> --observed-turn <path>
  ctree members discover product answer-extractor --state <path> --observed-turn <path>

Delegates to scripts/context-tree/run-member-discovery-product.mjs for product discovery proof. Local answer files, manual retained answers, fixtures, and diagnostics are not product discovery proof.
When no phase is supplied, product defaults to prepare; --project is forwarded as --project-identity.
`;
}

function setupHelp() {
  return `Usage: ctree setup --project <path> --runtime opencode [--json]

Initializes the project state layout without destructive overwrite:
  .context-tree/registry.json        confirmed member registry
  .context-tree/runs/                member invocation/product artifacts
  .context-tree/imports/             unconfirmed cold-start candidate bundles
  .context-tree/mutations.jsonl      Confirm/Rename/Add to existing Expert/Discard mutation log
  .context-tree/projections/         runtime projection refs/reports
  .context-tree/instructions/        runtime-facing instruction install reports/text
  .context-tree/release/             release-eval reports and readiness artifacts

OpenCode instruction install: writes parent-agent guidance explaining when to call
ctree members invoke, how to choose confirmed members, and why import candidates
remain unconfirmed until an explicit mutation action.
`;
}

function invokeHelp() {
  return `Usage: ctree members invoke <memberName> --task <text> --project <path> [--out <path>] [--registry <path>] [--json]

Product-facing alias; delegates to scripts/context-tree/invoke-member.mjs as:
  --member-name <memberName> --task <text> --project-identity <path>

This dispatcher does not invoke members itself and does not claim product proof.
`;
}

function buddyInvokeHelp() {
  return `Usage: ctree buddies invoke <buddyName> --task <text> --project <path> [--out <path>] [--registry <path>] [--json]

Preferred Evobuddy product-facing alias; delegates to scripts/context-tree/invoke-buddy.mjs as:
  --buddy-name <buddyName> --task <text> --project-identity <path>

Existing invoke-member artifacts remain accepted for compatibility. This dispatcher is runtime-callable adapter glue; product proof requires an observed parent-agent transcript, and stronger proof requires native-spawn or autonomous host-model routing evidence.
`;
}

function buddyLoopHelp() {
  return `Usage: ctree buddies loop --project <path> --out <path> [--json]

Delegates to scripts/context-tree/run-evobuddy-product-grade-loop-v0.mjs.
This command reports pass|blocked|fail. pass requires real runtime/model artifacts; missing live parent-agent, evolution-buddy proposal, or applied-version second-call evidence is blocked rather than synthesized.
`;
}

function buddySyncHelp() {
  return `Usage: ctree buddies sync --project <path> [--registry <path>] [--member <member>] [--runtime all|opencode|claude|codex] [--report-out <path>] [--dry-run]

Delegates to scripts/context-tree/install-member-projections.mjs sync.
Writes deterministic baseline runtime definitions and instruction install reports for OpenCode, Claude Code, and Codex.
`;
}

function buddyNativeProbeHelp() {
  return `Usage: ctree buddies native probe --project <path> --out <path> --require-runtimes opencode,claude,codex

Delegates to scripts/context-tree/probe-three-runtime-buddy-surfaces.mjs.
This dispatcher is discovery only and does not claim proof or pass.
`;
}

function buddyNativeClaudeProofHelp() {
  return `Usage: ctree buddies native claude-proof --session-corpus <path> --baseline-report <path> --member <name> --out <path>

Delegates to scripts/context-tree/export-claude-native-buddy-surface-proof.mjs.
Fails closed when the observed Claude exporter corpus cannot prove runtime-native subagent evidence.
`;
}

function buddyNativeCodexProofHelp() {
  return `Usage: ctree buddies native codex-proof --session-corpus <path> --baseline-report <path> --member <name> --out <path>

Delegates to scripts/context-tree/export-codex-native-buddy-surface-proof.mjs.
Fails closed when the observed Codex exporter corpus cannot prove runtime-native spawn_agent/wait_agent evidence.
`;
}

function buddyNativeFinalizeHelp() {
  return `Usage: ctree buddies native finalize --runtime-proof <path> --out <product-root>

Delegates to scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs.
Finalizes a validated runtime-native Buddy surface proof into product-root artifacts without reintroducing OpenCode-only proof authority.
`;
}

function buddyNativeReleaseEvalHelp() {
  return `Usage: ctree buddies native release-eval --project <path> --member <member> --out <path> --require-runtimes opencode,claude,codex

Delegates to scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs.
Release passes only when OpenCode, Claude, and Codex each retain validated nativeMechanism and naturalUse runtime-native proof.
`;
}

function versionText() {
  return `${PACKAGE_JSON.name} ${PACKAGE_JSON.version}\n`;
}

function importHelp() {
  return `Usage:
  ctree members import --project <path> [--db <path>] [--out <path>] [--json]
  ctree members import --action <json> --project <path> --candidates <path> --source-ref <path> --reason <text> --created-at <iso> --out <path> [...]
  ctree members import --action <json> --candidates <path> --registry <path> --source-ref <path> --reason <text> --created-at <iso> --out <path> [...]

Cold-start import writes candidate artifacts; candidates remain unconfirmed.
Confirmation, Rename, Add to existing Expert, and Discard require explicit setup-import action inputs and are not automatic durable writes.
Actions delegate to scripts/context-tree/run-member-setup-import.mjs; this dispatcher must not silently confirm durable members.
`;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
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
    else if (arg === '--member') parsed.member = requireValue(argv, i += 1, arg);
    else if (arg === '--report-out') parsed.reportOut = requireValue(argv, i += 1, arg);
    else if (arg === '--db') parsed.db = requireValue(argv, i += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else {
      parsed.passthrough.push(arg);
      if (arg.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) parsed.passthrough.push(argv[i += 1]);
    }
  }
  return parsed;
}

async function setupProject(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: setupHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if ((args.runtime ?? 'opencode') !== 'opencode') throw new Error(`runtime not implemented for setup: ${args.runtime}`);
  const state = ensureContextTreeProjectState({ projectRoot: args.project });
  const instructionInstall = installOpenCodeMemberInstructions({ projectRoot: args.project });
  const report = { status: 'pass', project: state.projectRoot, stateRoot: state.stateRoot, runtime: 'opencode', registryCreated: state.created.registry, mutationsCreated: state.created.mutationLog, instructionPath: instructionInstall.instructionPath, instructionInstall };
  return { stdout: args.json ? `${JSON.stringify(report)}\n` : `Context Tree setup complete: ${state.stateRoot}\nOpenCode instructions: ${instructionInstall.instructionPath}\n` };
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function doctor(argv) {
  const json = argv.includes('--json');
  const args = parseFlags(argv);
  const commands = Object.fromEntries(Object.entries(TARGETS).map(([name, target]) => [name, { target, exists: existsSync(join(REPO_ROOT, target)) }]));
  const report = {
    status: Object.values(commands).every((entry) => entry.exists) && PACKAGE_JSON.bin?.ctree === 'scripts/context-tree/ctree.mjs' ? 'pass' : 'fail',
    bin: 'ctree',
    packageBin: PACKAGE_JSON.bin?.ctree,
    dispatcherThin: true,
    liveRuntimeRequired: false,
    commands,
  };
  if (args.project) {
    const state = resolveContextTreeProjectState({ projectRoot: args.project });
    report.project = state.projectRoot;
    report.setup = {
      status: [state.registryPath, state.runsPath, state.importsPath, state.mutationLogPath, state.releasePathRoot].every((path) => existsSync(path)) ? 'pass' : 'fail',
      requiredPaths: [state.registryPath, state.runsPath, state.importsPath, state.mutationLogPath, state.releasePathRoot],
    };
    const projectionReport = await readJsonIfExists(join(state.projectRoot, 'context-tree-member-projection-install-report.json'));
    report.sync = projectionReport?.summary?.status === 'pass'
      ? { status: 'pass', reportRef: join(state.projectRoot, 'context-tree-member-projection-install-report.json') }
      : { status: 'blocked', blockedReasons: ['missing projection sync report or pass summary'], reportRef: join(state.projectRoot, 'context-tree-member-projection-install-report.json') };
    const releaseReportRef = state.releasePath('three-runtime-buddy-surface-release-report.json');
    const releaseReport = await readJsonIfExists(releaseReportRef);
    report.releaseReadiness = releaseReport?.verdict === 'pass'
      ? { status: 'pass', reportRef: releaseReportRef }
      : { status: 'blocked', reportRef: releaseReportRef, blockedReasons: ['missing runtime proof release eval in .context-tree/release or verdict not pass'] };
    report.status = report.setup.status === 'fail' || report.status === 'fail'
      ? 'fail'
      : [report.sync.status, report.releaseReadiness.status].includes('blocked') ? 'blocked' : 'pass';
  }
  return { stdout: json ? `${JSON.stringify(report)}\n` : `${usage()}\nDoctor status: ${report.status}\n`, code: report.status === 'pass' ? 0 : 1 };
}

async function buddiesSync(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: buddySyncHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const state = ensureContextTreeProjectState({ projectRoot: resolve(args.project) });
  const forwarded = ['sync', '--registry', resolve(args.registry ?? state.registryPath), '--project', state.projectRoot];
  if (args.member) forwarded.push('--member', args.member);
  forwarded.push(...args.passthrough);
  if (args.reportOut) forwarded.push('--report-out', args.reportOut);
  return spawnNode(TARGETS.syncBuddyProjections, forwarded);
}

function spawnNode(scriptRel, args) {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, scriptRel), ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status ?? 1 };
}

async function membersInvoke(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: invokeHelp() };
  const memberName = argv[0];
  if (!memberName || memberName.startsWith('--')) throw new Error('missing memberName');
  const args = parseFlags(argv.slice(1));
  if (!args.task) throw new Error('missing value for --task');
  if (!args.project) throw new Error('missing value for --project');
  const project = resolve(args.project);
  const state = ensureContextTreeProjectState({ projectRoot: project });
  const out = args.out ? resolve(args.out) : state.runPath(`invoke-${Date.now()}`);
  const forwarded = ['--member-name', memberName, '--task', args.task, '--project-identity', project, '--out', out];
  if (args.registry) forwarded.push('--registry', args.registry);
  else {
    const stateRegistry = JSON.parse(await readFile(state.registryPath, 'utf8'));
    if ((stateRegistry.members ?? []).length > 0) forwarded.push('--registry', state.registryPath);
    else if (existsSync(BUNDLED_REGISTRY)) forwarded.push('--registry', BUNDLED_REGISTRY);
  }
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
  const project = resolve(args.project);
  const state = ensureContextTreeProjectState({ projectRoot: project });
  const out = args.out ? resolve(args.out) : state.runPath(`invoke-buddy-${Date.now()}`);
  const forwarded = ['--buddy-name', buddyName, '--task', args.task, '--project-identity', project, '--out', out];
  if (args.registry) forwarded.push('--registry', args.registry);
  else {
    const stateRegistry = JSON.parse(await readFile(state.registryPath, 'utf8'));
    if ((stateRegistry.members ?? []).length > 0) forwarded.push('--registry', state.registryPath);
    else if (existsSync(BUNDLED_REGISTRY)) forwarded.push('--registry', BUNDLED_REGISTRY);
  }
  forwarded.push(...args.passthrough);
  if (args.json) forwarded.push('--json');
  return spawnNode(TARGETS.invokeBuddy, forwarded);
}

async function membersImport(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: importHelp() };
  if (argv.includes('--action')) return spawnNode(TARGETS.import, argv);
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const project = resolve(args.project);
  const state = ensureContextTreeProjectState({ projectRoot: project });
  const importRoot = resolve(args.out ?? state.importPath(`import-${Date.now()}`));
  const corpusRoot = join(importRoot, 'session-corpus');
  const exported = spawnNode(TARGETS.exportOpenCodeCorpus, ['--db', args.db ?? DEFAULT_OPENCODE_DB, '--project-identity', project, '--out', corpusRoot]);
  if (exported.code !== 0) return exported;
  const corpus = JSON.parse(exported.stdout);
  const cold = spawnNode(TARGETS.coldStart, ['--session-corpus', corpus.corpusPath, '--project-identity', project, '--out', importRoot]);
  if (cold.code !== 0) return cold;
  const summary = { status: 'pass', out: importRoot, candidatesRemainUnconfirmed: true, export: corpus, coldStart: JSON.parse(cold.stdout) };
  return { stdout: args.json ? `${JSON.stringify(summary)}\n` : `Cold-start candidates written (unconfirmed): ${importRoot}\n`, code: 0 };
}

async function membersDiscover(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: discoverHelp() };
  if (argv[0] === 'product') {
    const productArgs = argv.slice(1);
    if (productArgs.includes('--help') || productArgs.includes('-h') || productArgs.length === 0) return { stdout: productDiscoverHelp() };
    return spawnNode(TARGETS.memberDiscoveryProduct, productArgs);
  }
  if (argv[0] === 'answer-gate' || argv[0] === 'answer-extractor') return spawnNode(TARGETS.memberDiscoveryAgentAssisted, argv);
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const project = resolve(args.project);
  const state = ensureContextTreeProjectState({ projectRoot: project });
  const discoverRoot = resolve(args.out ?? state.importPath(`member-discovery-${Date.now()}`));
  const corpusRoot = join(discoverRoot, 'session-corpus');
  const exported = spawnNode(TARGETS.exportOpenCodeCorpus, ['--db', args.db ?? DEFAULT_OPENCODE_DB, '--project-identity', project, '--out', corpusRoot]);
  if (exported.code !== 0) return exported;
  const corpus = JSON.parse(exported.stdout);
  return spawnNode(TARGETS.memberDiscoveryAgentAssisted, ['prepare', '--session-corpus', corpus.corpusPath, '--project-identity', project, '--out', discoverRoot]);
}

async function dispatch(argv) {
  const [command, subcommand, action, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') return { stdout: usage() };
  if (command === '--version' || command === 'version') return { stdout: versionText() };
  if (command === 'setup') return setupProject(argv.slice(1));
  if (command === 'doctor') return doctor(argv.slice(1));
  if (command === 'workbench') {
    if (argv.includes('--help')) return { stdout: `Usage: ctree workbench --project <path> [render-member-workbench options]\nDelegates to scripts/context-tree/render-member-workbench.mjs.\n` };
    const args = parseFlags(argv.slice(1));
    if (args.project && !argv.includes('--input')) {
      const state = resolveContextTreeProjectState({ projectRoot: args.project });
      return spawnNode(TARGETS.workbench, ['--input', state.runsPath, ...args.passthrough]);
    }
    return spawnNode(TARGETS.workbench, argv.slice(1));
  }
  if (command === 'members') {
    if (subcommand === 'invoke') return membersInvoke([action, ...rest].filter((value) => value !== undefined));
    if (subcommand === 'import') return membersImport([action, ...rest].filter((value) => value !== undefined));
    if (subcommand === 'discover') return membersDiscover([action, ...rest].filter((value) => value !== undefined));
  }
  if (command === 'buddies') {
    if (subcommand === 'invoke') return buddiesInvoke([action, ...rest].filter((value) => value !== undefined));
    if (subcommand === 'sync') return buddiesSync([action, ...rest].filter((value) => value !== undefined));
    if (subcommand === 'loop') {
      const args = [action, ...rest].filter((value) => value !== undefined);
      if (args.includes('--help') || args.includes('-h')) return { stdout: buddyLoopHelp() };
      return spawnNode(TARGETS.buddyLoop, args);
    }
    if (subcommand === 'native' && action === 'probe') {
      const args = rest;
      if (args.includes('--help') || args.includes('-h')) return { stdout: buddyNativeProbeHelp() };
      return spawnNode(TARGETS.probeThreeRuntimeBuddySurfaces, args);
    }
    if (subcommand === 'native' && action === 'finalize') {
      const args = rest;
      if (args.includes('--help') || args.includes('-h')) return { stdout: buddyNativeFinalizeHelp() };
      return spawnNode(TARGETS.finalizeRuntimeNativeBuddyProductRoot, args);
    }
    if (subcommand === 'native' && action === 'release-eval') {
      const args = rest;
      if (args.includes('--help') || args.includes('-h')) return { stdout: buddyNativeReleaseEvalHelp() };
      return spawnNode(TARGETS.runThreeRuntimeBuddySurfaceReleaseEval, args);
    }
    if (subcommand === 'native' && action === 'claude-proof') {
      const args = rest;
      if (args.includes('--help') || args.includes('-h')) return { stdout: buddyNativeClaudeProofHelp() };
      return spawnNode(TARGETS.exportClaudeNativeBuddySurfaceProof, args);
    }
    if (subcommand === 'native' && action === 'codex-proof') {
      const args = rest;
      if (args.includes('--help') || args.includes('-h')) return { stdout: buddyNativeCodexProofHelp() };
      return spawnNode(TARGETS.exportCodexNativeBuddySurfaceProof, args);
    }
  }
  throw new Error(`unknown command: ${argv.join(' ')}\n${usage()}`);
}

dispatch(process.argv.slice(2)).then((result) => {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.code ?? 0;
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
