#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cold-start-root') parsed.coldStartRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--setup-import-root') parsed.setupImportRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--retrospective-root') parsed.retrospectiveRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function tryJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return undefined; } }
async function tryText(path) { try { return await readFile(path, 'utf8'); } catch { return undefined; } }
function check(status, details = {}) { return { status, ...details }; }

async function evaluateSetupImport(root, issues) {
  if (!root) return check('not-run', { reason: 'no --setup-import-root supplied' });
  const base = resolve(root);
  const candidates = await tryJson(join(base, 'member-profile-candidates.json'));
  const mutations = await tryJson(join(base, 'member-lifecycle-mutation-log.json'));
  const roleMemory = await tryJson(join(base, 'role-memory-candidates.json'));
  const workbench = await tryText(join(base, 'setup-import-workbench.txt')) ?? await tryText(join(base, 'setup-import-summary.txt')) ?? '';
  const candidateList = candidates?.candidates ?? [];
  const memoryList = roleMemory?.candidates ?? [];
  const failures = [];
  if (candidateList.some((candidate) => candidate.defaultExpert === true)) failures.push('candidate defaultExpert must remain false');
  if (!Array.isArray(mutations) || mutations.length === 0) failures.push('setup/import mutation log missing');
  if (memoryList.some((memory) => memory.status === 'active' || memory.defaultVisibility === 'm0' || memory.proposedDefaultVisibility === 'm0')) failures.push('Add to existing Expert must not active-promote memory');
  for (const label of ['Suggested Experts', 'Actions', 'Confirm', 'Rename', 'Add to existing Expert', 'Discard']) {
    if (!workbench.includes(label)) failures.push(`Workbench setup/import first layer missing ${label}`);
  }
  if (/MECHANISM PASS|PRODUCT PASS|authorized-explicit-member-activation/i.test(workbench)) failures.push('Workbench setup/import first layer leaks proof taxonomy');
  issues.push(...failures.map((failure) => `setupImportObserved: ${failure}`));
  return check(failures.length === 0 ? 'pass' : 'fail', { candidateCount: candidateList.length, mutationCount: Array.isArray(mutations) ? mutations.length : 0, failures });
}

async function evaluateRetrospective(root, issues) {
  if (!root) return check('not-run', { reason: 'no --retrospective-root supplied' });
  const base = resolve(root);
  const candidate = await tryJson(join(base, 'role-memory-candidate.json'));
  const materialization = await tryJson(join(base, 'materialization-report.json'));
  const failures = [];
  if (!candidate?.content || candidate.content === candidate.sourceQuote || candidate.content.length > 180) failures.push('retrospective candidate must be distilled, not raw quote');
  if (!Array.isArray(materialization?.m0) || materialization.m0.some((item) => item.status !== 'active' || item.confidence < 0.8 || item.importance < 70)) failures.push('materialization thresholds not met for m0');
  if (!Array.isArray(materialization?.excluded) || !materialization.excluded.some((item) => /candidate.*promoted|promoted.*candidate/i.test(item.reason ?? ''))) failures.push('materialization must exclude candidate m0 without promotion');
  issues.push(...failures.map((failure) => `retrospectiveObserved: ${failure}`));
  return check(failures.length === 0 ? 'pass' : 'fail', { failures });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outRoot = resolve(args.out);
  await mkdir(outRoot, { recursive: true });
  const issues = [];
  const setupImportObserved = await evaluateSetupImport(args.setupImportRoot, issues);
  const retrospectiveObserved = await evaluateRetrospective(args.retrospectiveRoot, issues);
  const materializationObserved = retrospectiveObserved.status === 'pass' ? check('pass') : (retrospectiveObserved.status === 'not-run' ? check('not-run') : check('fail'));
  const lifecycleObserved = [setupImportObserved.status, retrospectiveObserved.status].includes('fail')
    ? check('fail')
    : ([setupImportObserved.status, retrospectiveObserved.status].includes('pass') ? check('pass') : check('not-run'));
  const report = {
    reportKind: 'context-tree-member-lifecycle-v0-eval',
    version: '1',
    lifecycleObserved,
    setupImportObserved,
    retrospectiveObserved,
    materializationObserved,
    coldStartLiveObserved: args.coldStartRoot ? check('blocked', { reason: 'live cold-start proof not supplied to lifecycle v0 eval' }) : check('not-run'),
    correctionLoop: { status: issues.length === 0 ? 'not-needed' : 'failed-after-max-attempts', attempts: 1, maxCorrectionAttempts: 3, issues, attemptRefs: [] },
    issues,
  };
  const reportPath = join(outRoot, 'member-lifecycle-v0-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ reportPath, verdict: issues.length === 0 ? 'pass' : 'fail' })}\n`);
  if (issues.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
