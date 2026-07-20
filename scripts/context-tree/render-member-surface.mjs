#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readMemberSurfaceArtifacts } from '../../src/core/member-task-run-reader.mjs';
import { buildMemberSurfaceViewModel } from '../../src/core/member-surface-view-model.mjs';
import { renderMemberSurfaceHtml } from '../../src/report/member-surface-html.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseRequiredCanary(value) {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`invalid --required-canary value: ${value}`);
  }
  return {
    memberName: value.slice(0, separator),
    canary: value.slice(separator + 1),
  };
}

function parseArgs(argv) {
  const parsed = {
    input: undefined,
    out: undefined,
    registry: undefined,
    requiredCanaries: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--required-canary') parsed.requiredCanaries.push(parseRequiredCanary(requireValue(argv, i += 1, arg)));
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!parsed.input) throw new Error('missing value for --input');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function buildMaterialProofRequirements(entries) {
  const requirements = {};
  for (const entry of entries) {
    if (!requirements[entry.memberName]) requirements[entry.memberName] = [];
    if (!requirements[entry.memberName].includes(entry.canary)) requirements[entry.memberName].push(entry.canary);
  }
  return requirements;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = resolve(args.out);
  const artifacts = await readMemberSurfaceArtifacts({
    inputRoot: resolve(args.input),
    ...(args.registry ? { registryRef: resolve(args.registry) } : {}),
  });
  const materialProofRequirements = buildMaterialProofRequirements(args.requiredCanaries);
  const report = buildMemberSurfaceViewModel({
    artifacts,
    ...(Object.keys(materialProofRequirements).length > 0 ? { materialProofRequirements } : {}),
  });
  const html = renderMemberSurfaceHtml(report);
  const jsonPath = resolve(outputDir, 'member-surface.json');
  const htmlPath = resolve(outputDir, 'member-surface.html');

  await mkdir(outputDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(htmlPath, `${html}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify({
    jsonPath,
    htmlPath,
    members: report.members.length,
    runs: report.runs.length,
    warnings: report.warnings.length,
    inputKind: report.generatedFrom.inputKind,
    requiredCanaryMode: 'fixture-eval-helper',
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
