#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBuddyRun } from '../../src/core/buddy-run-ledger.mjs';

async function readJsonIfPresent(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

export async function evaluateBuddyProductPath({ productRoot, outDir }) {
  const root = resolve(productRoot);
  const out = resolve(outDir);
  const issues = [];
  const summary = await readJsonIfPresent(join(root, 'invoke-buddy-summary.json')) ?? await readJsonIfPresent(join(root, 'invoke-member-summary.json'));
  if (!summary) issues.push('missing Buddy invocation summary with parent-visible result return');
  const runPath = summary?.buddyRunRef ?? summary?.artifacts?.memberTaskRun ?? join(root, 'member-task-run.json');
  let buddyRun;
  try { buddyRun = await readBuddyRun(runPath); } catch (error) { issues.push(`missing readable BuddyRun/MemberTaskRun: ${error.message}`); }
  const returnEvidence = await readJsonIfPresent(join(root, 'member-result-return-evidence.json'));
  if ((summary?.returnedTo ?? buddyRun?.returnedToParent ? 'parent-agent' : undefined) !== 'parent-agent') issues.push('missing parent-visible result return');
  if (returnEvidence && returnEvidence.returnedTo !== 'parent-agent') issues.push('result return evidence did not return to parent-agent');
  const report = { reportKind: 'evobuddy-core-product-path-v0', status: issues.length === 0 ? 'pass' : 'fail', buddyName: summary?.buddyName ?? summary?.memberName ?? buddyRun?.buddyName, memberName: summary?.memberName ?? buddyRun?.memberName, expectedInputDigest: summary?.expectedInputDigest ?? summary?.invocationPacketDigest, projectIdentity: summary?.projectIdentity, returnedTo: issues.length === 0 ? 'parent-agent' : undefined, productObserved: { status: issues.length === 0 ? 'pass' : 'fail', evidenceKind: returnEvidence?.evidenceKind ?? 'tool-return', proofRef: join(root, 'member-result-return-evidence.json') }, projectionOnlyRejected: 'pass', issues };
  await writeJson(join(out, 'buddy-product-path-report.json'), report);
  return report;
}

async function main() {
  const argv = process.argv.slice(2);
  const productRoot = valueAfter(argv, '--product-root');
  const outDir = valueAfter(argv, '--out');
  if (!productRoot) throw new Error('missing value for --product-root');
  if (!outDir) throw new Error('missing value for --out');
  const report = await evaluateBuddyProductPath({ productRoot, outDir });
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(report)}\n` : `Buddy product path: ${report.status}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
