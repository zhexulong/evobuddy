#!/usr/bin/env node

import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseParentCallRecord } from '../../src/adapters/explicit-member-parent-call-record.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const RUN_AUTHORIZED_EXPLICIT_CLI = join(REPO_ROOT, 'scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs');
const WRITE_PARENT_CALL_RECORD_CLI = join(REPO_ROOT, 'scripts/context-tree/write-explicit-member-parent-call-record.mjs');

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { authorized: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--authorized') parsed.authorized = true;
    else if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--executor') parsed.executor = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.authorized) throw new Error('explicit parent transcript acceptance requires --authorized');
  if (process.env.CTREE_AUTHORIZED_MEMBER_ACTIVATION !== '1') {
    throw new Error('explicit parent transcript acceptance requires CTREE_AUTHORIZED_MEMBER_ACTIVATION=1');
  }
  if (!parsed.config) throw new Error('missing value for --config');
  if (!parsed.executor) throw new Error('missing value for --executor');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function resolveMaybeRepo(path) {
  return resolve(REPO_ROOT, path);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runNodeCli(command, args, options = {}) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function requireObservedTranscript(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('observed transcript must be an object');
  if (value.kind !== 'observed-parent-agent-call-transcript') throw new Error('observed transcript kind must be observed-parent-agent-call-transcript');
  if (!Array.isArray(value.calls)) throw new Error('observed transcript requires calls[]');
  return value;
}

function selectMatchingCall(transcript, seedInput) {
  for (const call of transcript.calls) {
    const record = parseParentCallRecord(call);
    if (record.expectedInputDigest === seedInput.inputDigest) return record;
  }
  throw new Error('observed transcript has no call with matching seed digest');
}

function inspectExplicitProductProof({ proof, report, source, parentCallRecordPath }) {
  const tiers = report?.summary?.acceptanceTiers ?? {};
  return Boolean(
    proof?.caseId === 'authorized-explicit-member-activation'
    && proof?.acceptanceMode === 'authorized-explicit-member-activation'
    && proof?.testEligibilityOnly === undefined
    && source?.sourceKind === 'observed-parent-agent-call'
    && source?.parentCallRecordRef === parentCallRecordPath
    && report?.summary?.explicitMemberMechanismPass === true
    && report?.summary?.explicitMemberActivationPass === true
    && tiers['authorized-explicit-member-activation'] === 'pass'
    && tiers['provider-forced-live-runtime'] === 'not-run'
    && tiers['authorized-natural-native-spawn'] === 'not-run'
    && report?.summary?.nativeSpawnPass === false
    && report?.summary?.spawnPass === false
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(args.out);
  const seedDir = join(outDir, 'seed');
  const productDir = join(outDir, 'product');
  const summaryPath = join(outDir, 'explicit-parent-transcript-acceptance-summary.json');
  await mkdir(seedDir, { recursive: true });
  await mkdir(productDir, { recursive: true });

  const baseSummary = { seedDir, productDir };
  const writeSummary = async (summary) => writeJson(summaryPath, { ...baseSummary, ...summary });

  runNodeCli(RUN_AUTHORIZED_EXPLICIT_CLI, [
    '--authorized',
    '--config', args.config,
    '--executor', args.executor,
    '--executor-authority', 'agent-runtime',
    '--executor-kind', 'agent-runtime-parent-invocation-harness',
    '--parent-invocation-source', join(REPO_ROOT, 'evals/fixtures/member-task-runs/authorized-explicit-member-parent-invocation-source.json'),
    '--out', seedDir,
  ], { env: { CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' } });
  const seedInput = await readJson(join(seedDir, 'explicit-member-executor-input.json'));

  const externalTranscriptPath = process.env.RUNTIME_OBSERVER_EXPORT_PATH;
  if (!externalTranscriptPath || !(await isFile(resolveMaybeRepo(externalTranscriptPath)))) {
    await writeSummary({
      status: 'blocked',
      reason: 'RUNTIME_OBSERVER_EXPORT_PATH must point to an existing observed parent call transcript file',
      transcriptPath: externalTranscriptPath || undefined,
    });
    process.exitCode = 1;
    return;
  }

  const sourceTranscriptPath = resolveMaybeRepo(externalTranscriptPath);
  const productTranscriptPath = join(productDir, 'observed-parent-call-transcript.json');
  const parentCallRecordPath = join(productDir, 'parent-call-record.json');
  const parentInvocationSourcePath = join(productDir, 'explicit-member-parent-invocation-source.json');
  const acceptanceProofPath = join(productDir, 'acceptance-proof.json');
  const evalReportPath = join(productDir, 'eval', 'capability-matrix.json');

  let selectedCall;
  try {
    const transcript = requireObservedTranscript(await readJson(sourceTranscriptPath));
    selectedCall = selectMatchingCall(transcript, seedInput);
  } catch (error) {
    await writeSummary({
      status: 'blocked',
      reason: error instanceof Error ? error.message : String(error),
      transcriptPath: sourceTranscriptPath,
    });
    process.exitCode = 1;
    return;
  }

  await copyFile(sourceTranscriptPath, productTranscriptPath);

  try {
    runNodeCli(WRITE_PARENT_CALL_RECORD_CLI, [
      '--observed-transcript', productTranscriptPath,
      '--call-id', selectedCall.invocationId,
      '--out-record', parentCallRecordPath,
      '--out-source', parentInvocationSourcePath,
    ]);

    runNodeCli(RUN_AUTHORIZED_EXPLICIT_CLI, [
      '--authorized',
      '--config', args.config,
      '--executor', args.executor,
      '--executor-authority', 'agent-runtime',
      '--executor-kind', 'agent-runtime-parent-invocation-harness',
      '--parent-invocation-source', parentInvocationSourcePath,
      '--out', productDir,
    ], { env: { CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1' } });

    const proof = await readJson(acceptanceProofPath);
    const report = await readJson(evalReportPath);
    const source = await readJson(parentInvocationSourcePath);
    const status = inspectExplicitProductProof({ proof, report, source, parentCallRecordPath }) ? 'pass' : 'fail';
    await writeSummary({
      status,
      ...(status === 'fail' ? { reason: 'explicit product proof/report fields did not exactly pass' } : {}),
      transcriptPath: productTranscriptPath,
      parentCallRecordPath,
      parentInvocationSourcePath,
      acceptanceProofPath,
      evalReportPath,
      summary: report.summary,
    });
    if (status !== 'pass') process.exitCode = 1;
  } catch (error) {
    await writeSummary({
      status: 'fail',
      reason: error instanceof Error ? error.message : String(error),
      transcriptPath: productTranscriptPath,
      parentCallRecordPath,
      parentInvocationSourcePath,
      acceptanceProofPath,
      evalReportPath,
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
