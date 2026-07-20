#!/usr/bin/env node

import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import {
  evaluateMemberRuntimeProjectionReport,
} from '../../src/install/member-projection-installer.mjs';

const REPORT_FILE = 'member-runtime-projection-eval-report.json';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { report: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report') parsed.report = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.report) throw new Error('missing value for --report');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function pathHasSymlink(path) {
  const resolved = resolve(path);
  const root = resolved.startsWith(sep) ? sep : resolve('.').split(sep)[0];
  const relativeParts = relative(root, resolved).split(sep).filter(Boolean);
  let current = root;
  for (const part of relativeParts) {
    current = current === sep ? `${sep}${part}` : resolve(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return false;
}

async function safeWriteFile(path, content) {
  if (await pathHasSymlink(path)) throw new Error('refuses to write eval report through symlinked path');
  await mkdir(dirname(path), { recursive: true });
  if (await pathHasSymlink(path)) throw new Error('refuses to write eval report through symlinked path');
  await writeFile(path, content, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportRef = resolve(args.report);
  const outDir = resolve(args.out);
  const report = JSON.parse(await readFile(reportRef, 'utf8'));
  const evalReport = evaluateMemberRuntimeProjectionReport(report, { checkedReportRef: reportRef });
  await mkdir(outDir, { recursive: true });
  await safeWriteFile(resolve(outDir, REPORT_FILE), `${JSON.stringify(evalReport, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(evalReport, null, 2)}\n`);
  if (evalReport.verdict === 'fail') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
