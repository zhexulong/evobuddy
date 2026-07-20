#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateRuntimeNativeBuddySurfaceProof } from '../../src/core/runtime-native-buddy-surface-proof.mjs';

const RUNTIMES = ['opencode', 'claude', 'codex'];
const REPORT_NAME = 'three-runtime-buddy-surface-release-report.json';
const PROOF_FILE = 'runtime-native-buddy-surface-proof.json';
const DEFAULT_ACTIVE_BUDDIES = Object.freeze(['explore', 'librarian', 'sisyphus-junior']);

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseRequireRuntimes(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function parseArgs(argv) {
  const parsed = { requireRuntimes: ['opencode', 'claude', 'codex'] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') parsed.project = requireValue(argv, index += 1, arg);
    else if (arg === '--member') parsed.member = requireValue(argv, index += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, index += 1, arg);
    else if (arg === '--require-runtimes') parsed.requireRuntimes = parseRequireRuntimes(requireValue(argv, index += 1, arg));
    else if (arg === '--projection-install-report') parsed.projectionInstallReport = requireValue(argv, index += 1, arg);
    else if (arg === '--roster-registry') parsed.rosterRegistry = requireValue(argv, index += 1, arg);
    else if (/^--product-root-(opencode|claude|codex)$/.test(arg)) parsed[arg.slice(2)] = requireValue(argv, index += 1, arg);
    else if (/^--natural-root-(opencode|claude|codex)$/.test(arg)) parsed[arg.slice(2)] = requireValue(argv, index += 1, arg);
    else if (/^--product-proof-(opencode|claude|codex)$/.test(arg)) parsed[arg.slice(2)] = requireValue(argv, index += 1, arg);
    else if (/^--natural-proof-(opencode|claude|codex)$/.test(arg)) parsed[arg.slice(2)] = requireValue(argv, index += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.project) throw new Error('missing value for --project');
  if (!parsed.member) throw new Error('missing value for --member');
  if (!parsed.outDir) throw new Error('missing value for --out');
  return parsed;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJsonIfExists(path) {
  if (!path) return undefined;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
    throw error;
  }
}

async function expectedActiveBuddies(registryRef) {
  const registry = await readJsonIfExists(registryRef);
  if (!registry) return [...DEFAULT_ACTIVE_BUDDIES];
  return (registry.members ?? [])
    .filter((member) => member?.visibility === 'active')
    .map((member) => member.name ?? member.memberName)
    .filter(Boolean)
    .sort();
}

function runtimeActiveBuddies(projectionReport, runtime) {
  return (projectionReport?.members ?? [])
    .filter((member) => member?.visibility === 'active')
    .filter((member) => typeof member.runtimeFiles?.[runtime]?.ref === 'string')
    .map((member) => member.memberName ?? member.name)
    .filter(Boolean)
    .sort();
}

async function evaluateRosterProjectionParity({ project, projectionInstallReport, rosterRegistry }) {
  const defaultProjectionReport = resolve(project, 'context-tree-member-projection-install-report.json');
  const reportRef = projectionInstallReport ? resolve(projectionInstallReport) : defaultProjectionReport;
  const projectionReport = await readJsonIfExists(reportRef);
  const expected = await expectedActiveBuddies(rosterRegistry ? resolve(rosterRegistry) : undefined);
  if (!projectionReport) {
    return { status: 'not-claimed', expectedActiveBuddies: expected, runtimes: {}, issues: [], reportRef };
  }
  const runtimes = Object.fromEntries(RUNTIMES.map((runtime) => [runtime, runtimeActiveBuddies(projectionReport, runtime)]));
  const issues = [];
  for (const runtime of RUNTIMES) {
    for (const buddy of expected) {
      if (!runtimes[runtime].includes(buddy)) issues.push(`${runtime} missing ${buddy}`);
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'fail', expectedActiveBuddies: expected, runtimes, issues, reportRef };
}

async function loadProofRef(rootFlagValue, proofFlagValue) {
  if (proofFlagValue) return resolve(proofFlagValue);
  if (rootFlagValue) return resolve(rootFlagValue, PROOF_FILE);
  return undefined;
}

async function readProofBundle({ runtime, layer, proofRef, requiredMemberName }) {
  if (!proofRef) {
    return {
      status: 'blocked',
      blockedReasons: [`missing ${runtime} ${layer} proof evidence`],
      issues: [],
      proofRef: undefined,
      proofDigest: undefined,
      proof: undefined,
    };
  }
  try {
    const raw = await readFile(proofRef, 'utf8');
    const parsed = JSON.parse(raw);
    const validation = validateRuntimeNativeBuddySurfaceProof(parsed, { requiredRuntime: runtime, requiredMemberName });
    return {
      ...validation,
      blockedReasons: [],
      proofRef,
      proofDigest: sha256Text(raw),
    };
  } catch (error) {
    return {
      status: 'blocked',
      blockedReasons: [`missing ${runtime} ${layer} proof evidence at ${proofRef}`],
      issues: [error instanceof Error ? error.message : String(error)],
      proofRef,
      proofDigest: undefined,
      proof: undefined,
    };
  }
}

function summarizeRuntime(runtime, mechanismBundle, naturalBundle) {
  const proof = naturalBundle.proof ?? mechanismBundle.proof;
  const blockedReasons = [...mechanismBundle.blockedReasons, ...naturalBundle.blockedReasons];
  const issues = [...mechanismBundle.issues, ...naturalBundle.issues];
  const baselineProjectionPass = Boolean(mechanismBundle.proof?.baselineProjectionPass) && Boolean(naturalBundle.proof?.baselineProjectionPass);
  const nativeMechanismPass = Boolean(mechanismBundle.proof?.nativeMechanismPass);
  const naturalUsePass = Boolean(naturalBundle.proof?.naturalUsePass);
  const status = blockedReasons.length > 0 ? 'blocked' : issues.length > 0 ? 'fail' : baselineProjectionPass && nativeMechanismPass && naturalUsePass ? 'pass' : 'fail';
  return {
    runtime,
    status,
    baselineProjectionPass,
    nativeMechanismPass,
    naturalUsePass,
    proofRef: naturalBundle.proofRef ?? mechanismBundle.proofRef,
    proofDigest: naturalBundle.proofDigest ?? mechanismBundle.proofDigest,
    knownLosses: Array.isArray(proof?.knownLosses) ? proof.knownLosses : [],
    blockedReasons,
    issues,
    mechanismProofRef: mechanismBundle.proofRef,
    naturalProofRef: naturalBundle.proofRef,
  };
}

export async function runThreeRuntimeBuddySurfaceReleaseEval(input) {
  const requireRuntimes = input.requireRuntimes ?? ['opencode', 'claude', 'codex'];
  const expected = RUNTIMES.join(',');
  if (requireRuntimes.join(',') !== expected) {
    throw new Error(`MVP requires --require-runtimes ${expected}`);
  }

  const rosterRegistryRef = input.rosterRegistry
    ? resolve(input.rosterRegistry)
    : resolve(input.project, '.evobuddy', 'registry.json');
  const activeReleaseBuddies = await expectedActiveBuddies(rosterRegistryRef);
  if (!activeReleaseBuddies.includes(input.member)) {
    throw new Error(`--member ${input.member} is not an active preset Buddy. Active release Buddies: ${activeReleaseBuddies.join(', ')}`);
  }

  const outDir = resolve(input.outDir);
  const runtimes = {};
  for (const runtime of RUNTIMES) {
    const mechanismBundle = await readProofBundle({
      runtime,
      layer: 'nativeMechanism',
      proofRef: await loadProofRef(input[`product-root-${runtime}`], input[`product-proof-${runtime}`]),
      requiredMemberName: input.member,
    });
    const naturalBundle = await readProofBundle({
      runtime,
      layer: 'naturalUse',
      proofRef: await loadProofRef(input[`natural-root-${runtime}`], input[`natural-proof-${runtime}`]),
      requiredMemberName: input.member,
    });
    runtimes[runtime] = summarizeRuntime(runtime, mechanismBundle, naturalBundle);
  }

  const runtimeSummaries = Object.values(runtimes);
  const rosterProjectionParity = await evaluateRosterProjectionParity({
    ...input,
    rosterRegistry: rosterRegistryRef,
  });
  const aggregate = {
    baselineProjectionPass: runtimeSummaries.every((runtime) => runtime.baselineProjectionPass),
    nativeMechanismPass: runtimeSummaries.every((runtime) => runtime.nativeMechanismPass),
    naturalUsePass: runtimeSummaries.every((runtime) => runtime.naturalUsePass),
  };
  const blockedReasons = runtimeSummaries.flatMap((runtime) => runtime.blockedReasons.map((reason) => `${runtime.runtime}: ${reason}`));
  const failedReasons = runtimeSummaries.flatMap((runtime) => runtime.issues.map((reason) => `${runtime.runtime}: ${reason}`));
  if (rosterProjectionParity.status === 'fail') failedReasons.push(...rosterProjectionParity.issues);
  const verdict = blockedReasons.length > 0 ? 'blocked' : failedReasons.length > 0 ? 'fail' : aggregate.baselineProjectionPass && aggregate.nativeMechanismPass && aggregate.naturalUsePass ? 'pass' : 'fail';
  const report = {
    reportKind: 'three-runtime-buddy-surface-release-eval-legacy',
    legacyEvaluator: true,
    deprecated: 'Use run-evobuddy-three-runtime-team-subagent-live-eval.mjs for actor-aware TeamAgent/SubagentBuddy release evaluation.',
    project: resolve(input.project),
    member: input.member,
    requireRuntimes,
    verdict,
    aggregate,
    rosterProjectionParity,
    runtimes,
    blockedReasons,
    failedReasons,
    reportPath: join(outDir, REPORT_NAME),
  };
  await writeJson(report.reportPath, report);
  return report;
}

export async function runThreeRuntimeBuddySurfaceReleaseEvalCli(argv) {
  return runThreeRuntimeBuddySurfaceReleaseEval(parseArgs(argv));
}

async function main() {
  const report = await runThreeRuntimeBuddySurfaceReleaseEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.verdict !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
