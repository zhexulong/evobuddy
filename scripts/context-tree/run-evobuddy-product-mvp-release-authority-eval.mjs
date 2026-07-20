#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { evaluateEvobuddyProductMvpReleaseAuthority } from '../../src/core/evobuddy-product-mvp-release-authority.mjs';

const DEFAULT_REQUIRE_RUNTIMES = Object.freeze(['opencode', 'claude', 'codex']);
const REPORT_NAME = 'evobuddy-product-mvp-release-authority-report.json';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseRequireRuntimes(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function parseArgs(argv) {
  const args = {
    realtimeForkHandoffReports: [],
    requireRuntimes: [...DEFAULT_REQUIRE_RUNTIMES],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') args.project = requireValue(argv, index += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, index += 1, arg);
    else if (arg === '--sisyphus-readiness-report') args.sisyphusReadinessReport = requireValue(argv, index += 1, arg);
    else if (arg === '--realtime-fork-handoff-report') args.realtimeForkHandoffReports.push(requireValue(argv, index += 1, arg));
    else if (arg === '--july17-readiness-report') args.july17ReadinessReport = requireValue(argv, index += 1, arg);
    else if (arg === '--legacy-product-readiness-report') args.legacyProductReadinessReport = requireValue(argv, index += 1, arg);
    else if (arg === '--legacy-release-report') args.legacyReleaseReport = requireValue(argv, index += 1, arg);
    else if (arg === '--require-runtimes') args.requireRuntimes = parseRequireRuntimes(requireValue(argv, index += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.out) throw new Error('missing value for --out');
  if (!args.sisyphusReadinessReport) throw new Error('missing value for --sisyphus-readiness-report');
  if (args.realtimeForkHandoffReports.length === 0) throw new Error('missing value for --realtime-fork-handoff-report');
  if (args.requireRuntimes.join(',') !== DEFAULT_REQUIRE_RUNTIMES.join(',')) {
    throw new Error(`MVP requires --require-runtimes ${DEFAULT_REQUIRE_RUNTIMES.join(',')}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonIfPresent(path) {
  if (!path) return undefined;
  if (!existsSync(path)) throw new Error(`missing report file: ${path}`);
  return readJson(path);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function runEvobuddyProductMvpReleaseAuthorityEvalCli(argv) {
  const args = parseArgs(argv);
  const sisyphusReadinessPath = resolve(args.sisyphusReadinessReport);
  const realtimeForkHandoffReportPaths = args.realtimeForkHandoffReports.map((path) => resolve(path));
  const july17Path = args.july17ReadinessReport ? resolve(args.july17ReadinessReport) : undefined;
  const productReadinessPath = args.legacyProductReadinessReport ? resolve(args.legacyProductReadinessReport) : undefined;
  const legacyReleasePath = args.legacyReleaseReport ? resolve(args.legacyReleaseReport) : undefined;

  const report = evaluateEvobuddyProductMvpReleaseAuthority({
    project: resolve(args.project),
    sisyphusReadiness: readJson(sisyphusReadinessPath),
    sisyphusReadinessPath,
    realtimeForkHandoffReports: realtimeForkHandoffReportPaths.map((path) => readJson(path)),
    realtimeForkHandoffReportPaths,
    july17: july17Path ? readJsonIfPresent(july17Path) : undefined,
    july17Path,
    productReadiness: productReadinessPath ? readJsonIfPresent(productReadinessPath) : undefined,
    productReadinessPath,
    legacyRelease: legacyReleasePath ? readJsonIfPresent(legacyReleasePath) : undefined,
    legacyReleasePath,
    requireRuntimes: args.requireRuntimes,
  });

  report.project = resolve(args.project);
  report.reportPath = join(resolve(args.out), REPORT_NAME);
  writeJson(report.reportPath, report);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = runEvobuddyProductMvpReleaseAuthorityEvalCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify({ verdict: report.verdict, reportPath: report.reportPath })}\n`);
    if (report.verdict !== 'pass') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
