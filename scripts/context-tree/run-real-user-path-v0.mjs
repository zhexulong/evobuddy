#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { installContextTreeCodexSkills } from '../../src/install/codex-skill-install.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const ACCEPTANCE_CLI = resolve(REPO_ROOT, 'scripts/context-tree/run-native-spawn-acceptance.mjs');
const EVAL_CLI = resolve(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { config: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.config) throw new Error('missing value for --config');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
}

function parseJsonStdout(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`.trim());
  }
  return JSON.parse(result.stdout);
}

function deriveEvalSeed(acceptance) {
  const observedAnswer = typeof acceptance.observedAnswer === 'string'
    ? acceptance.observedAnswer
    : JSON.stringify(acceptance.observedAnswer ?? '');
  const match = observedAnswer.match(/CTREE-SURVIVE-([A-Za-z0-9._-]+)/);
  return match?.[1] ?? 'real-user-path-seed';
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const outputDir = resolve(parsed.out);
  await mkdir(outputDir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve(parsed.config), 'utf8'));

  const tempCodexHome = mkdtempSync(join(outputDir, 'codex-home-'));
  const installResult = await installContextTreeCodexSkills({
    codexHome: tempCodexHome,
    sourceRoot: REPO_ROOT,
  });

  const acceptanceConfigPath = join(outputDir, 'real-user-path-acceptance-config.json');
  const acceptanceConfig = {
    ...config,
    mode: 'provider-forced-live',
    codexHome: tempCodexHome,
    cwd: config.cwd ?? REPO_ROOT,
  };
  writeFileSync(acceptanceConfigPath, JSON.stringify(acceptanceConfig, null, 2), 'utf8');

  const acceptance = parseJsonStdout(
    runNodeScript(ACCEPTANCE_CLI, ['--config', acceptanceConfigPath, '--out', outputDir]),
    'provider-forced-live acceptance',
  );

  const evalOutDir = join(outputDir, 'eval');
  const evalSeed = deriveEvalSeed(acceptance);
  const evalResult = runNodeScript(EVAL_CLI, [
    '--mode', 'mock',
    '--seed', evalSeed,
    '--out', evalOutDir,
    '--acceptance-proof', acceptance.acceptanceProofPath,
  ]);
  if (evalResult.status !== 0) {
    throw new Error(`eval ingest failed: ${evalResult.stderr || evalResult.stdout}`.trim());
  }
  const evalReportPath = evalResult.stdout.trim().replace(/^capability report:\s*/i, '');

  const payload = {
    tempCodexHome,
    installedSkillPaths: installResult.installedSkillPaths,
    acceptance,
    acceptanceProofPath: acceptance.acceptanceProofPath,
    evalSeed,
    manifestPaths: {
      checkpointManifestPath: acceptance.checkpointManifestPath,
      spawnRunManifestPath: acceptance.spawnRunManifestPath,
      spawnResultManifestPath: acceptance.spawnResultManifestPath,
    },
    evalReportPath,
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
