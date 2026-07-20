#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createTeamPolicyIndex,
  defaultTeamPolicyMarkdown,
  validateTeamPolicyIndex,
} from '../../src/core/evobuddy-team-policy.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { json: false, inPlace: false, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--in-place') args.inPlace = true;
    else if (arg === '--check') args.check = true;
    else if (arg === '--json') args.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.inPlace && !args.out && !args.check) throw new Error('missing value for --out');
  if (args.inPlace && args.out) throw new Error('--out and --in-place are mutually exclusive');
  return args;
}

async function ensurePolicySource(projectRoot) {
  const policyPath = join(projectRoot, '.evobuddy/team-policy.md');
  if (!existsSync(policyPath)) {
    await mkdir(dirname(policyPath), { recursive: true });
    await writeFile(policyPath, defaultTeamPolicyMarkdown(), 'utf8');
  }
  return policyPath;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relativePolicyRef() {
  return '.evobuddy/team-policy.md';
}

function relativeIndexRef() {
  return '.evobuddy/team-policy.json';
}

export async function generateTeamPolicyIndexCli(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(args.project);
  const policyPath = await ensurePolicySource(projectRoot);
  const markdown = await readFile(policyPath, 'utf8');
  const indexPath = join(args.check ? projectRoot : resolve(args.inPlace ? projectRoot : args.out), relativeIndexRef());

  if (args.check) {
    const reportPath = join(projectRoot, '.evobuddy/team-policy-check-report.json');
    try {
      const index = JSON.parse(await readFile(indexPath, 'utf8'));
      const validated = validateTeamPolicyIndex({ index, markdown });
      const report = { status: 'pass', policyRef: relativePolicyRef(), indexRef: relativeIndexRef(), sourceDigest: validated.sourceDigest, blockedReasons: [] };
      await writeJson(reportPath, report);
      return { ...report, reportPath };
    } catch (error) {
      const report = {
        status: 'stale',
        policyRef: relativePolicyRef(),
        indexRef: relativeIndexRef(),
        blockedReasons: [error instanceof Error ? error.message : String(error)],
      };
      await writeJson(reportPath, report);
      const failure = new Error(JSON.stringify({ ...report, reportPath }));
      failure.report = report;
      failure.reportPath = reportPath;
      throw failure;
    }
  }

  const index = createTeamPolicyIndex({ sourceRef: relativePolicyRef(), markdown });
  await writeJson(indexPath, index);
  return {
    status: 'pass',
    policyRef: relativePolicyRef(),
    indexRef: relativeIndexRef(),
    indexPath,
    sourceDigest: index.sourceDigest,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  try {
    const result = await generateTeamPolicyIndexCli(args);
    process.stdout.write(json ? `${JSON.stringify(result)}\n` : `wrote ${result.indexPath ?? result.reportPath}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json && error?.report) process.stdout.write(`${JSON.stringify({ ...error.report, reportPath: error.reportPath })}\n`);
    else process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
