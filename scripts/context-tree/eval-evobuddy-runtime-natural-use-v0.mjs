#!/usr/bin/env node

import { evaluateEvobuddyRuntimeNaturalUse } from '../../src/eval/evobuddy-runtime-natural-use.mjs';

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

async function main() {
  const argv = process.argv.slice(2);
  const productRoot = valueAfter(argv, '--product-root');
  const outDir = valueAfter(argv, '--out');
  if (!productRoot) throw new Error('missing value for --product-root');
  if (!outDir) throw new Error('missing value for --out');
  const report = await evaluateEvobuddyRuntimeNaturalUse({
    runtime: valueAfter(argv, '--runtime') ?? 'opencode',
    productRoot,
    outDir,
    requireFreshProductRoot: argv.includes('--require-fresh-product-root'),
    nativeSpawnArtifactRef: valueAfter(argv, '--native-spawn-artifact'),
    nativeSpawnCanarySeed: valueAfter(argv, '--native-spawn-canary-seed') ?? 'evobuddy-native-spawn',
    nativeSpawnArtifactMode: valueAfter(argv, '--native-spawn-artifact-mode') ?? 'live',
    nativeBuddyTaskProofRef: valueAfter(argv, '--native-buddy-task-proof'),
    runtimeNativeBuddySurfaceProofRef: valueAfter(argv, '--runtime-native-buddy-surface-proof'),
    requireAutonomousChoice: argv.includes('--require-autonomous-choice'),
    releaseGrade: argv.includes('--release-grade'),
  });
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(report)}\n` : `Evobuddy runtime natural use: ${report.status}\n`);
  if (report.status === 'fail') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
