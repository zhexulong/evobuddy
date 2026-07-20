#!/usr/bin/env node

import { resolve } from 'node:path';
import { createEvolutionBuddyRun, loadFollowingMessages, writeEvolutionBuddyRunArtifacts } from '../../src/core/evolution-buddy-run.mjs';

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

async function main() {
  const argv = process.argv.slice(2);
  const outDir = resolve(valueAfter(argv, '--out') ?? '/tmp/context-tree-evolution-buddy-v0');
  const run = await createEvolutionBuddyRun({
    runRef: valueAfter(argv, '--run-ref') ? resolve(valueAfter(argv, '--run-ref')) : undefined,
    followingMessages: await loadFollowingMessages(valueAfter(argv, '--following-messages')),
    currentBuddyState: { buddyName: valueAfter(argv, '--buddy-name') ?? 'skill-designer', version: valueAfter(argv, '--current-version') ?? '1', routingRules: [] },
    proposedChangeKind: valueAfter(argv, '--proposed-change-kind') ?? 'execution-step',
    createdAt: '2026-07-12T00:00:00.000Z',
  });
  const summary = await writeEvolutionBuddyRunArtifacts({ run, outDir });
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(summary)}\n` : `Evolution Buddy target: ${summary.targetKind}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
