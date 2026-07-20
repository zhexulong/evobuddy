import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCanarySet } from '../../src/eval/canaries.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const BUILD_CLI = join(REPO_ROOT, 'scripts/eval/write-native-spawn-artifact.mjs');
const EVAL_CLI = join(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');

function runNode(cli, args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

describe('write-native-spawn-artifact CLI', () => {
  it('writes an artifact that eval mock mode ingests as a native spawn pass', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-artifact-'));
    try {
      const canaries = createCanarySet('capture-seed');
      const promptPath = join(runDir, 'reviewer-prompt.txt');
      const answerPath = join(runDir, 'observed-answer.txt');
      const artifactPath = join(runDir, 'native-spawn-artifact.json');

      writeFileSync(promptPath, 'Which exact CTREE-* identifiers are visible from the spawn boundary?', 'utf8');
      writeFileSync(answerPath, JSON.stringify({ answer: 'known', values: [canaries.survive] }), 'utf8');

      const build = runNode(BUILD_CLI, [
        '--seed', 'capture-seed',
        '--out', artifactPath,
        '--source-thread-id', 'parent-thread-123',
        '--spawned-agent-id', 'spawned-agent-456',
        '--reviewer-prompt-file', promptPath,
        '--observed-answer-file', answerPath,
        '--checkpoint-created-at', '2026-07-06T12:34:56.000Z',
        '--checkpoint-turn-id', 'turn-parent-123',
      ]);
      assert.equal(build.status, 0, build.stderr || build.stdout);

      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      assert.equal(artifact.artifactKind, 'codex-native-spawn-capability-artifact');
      assert.equal(artifact.checkpointAnchor.turnId, 'turn-parent-123');
      assert.equal(artifact.evidenceRefs[1].kind, 'native-spawn-result');
      assert.deepEqual(artifact.evidenceRefs[1].contains, [canaries.survive]);

      const evalResult = runNode(EVAL_CLI, [
        '--mode', 'mock',
        '--seed', 'capture-seed',
        '--out', runDir,
        '--native-spawn-artifact', artifactPath,
      ]);
      assert.equal(evalResult.status, 0, evalResult.stderr || evalResult.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      assert.equal(report.summary.nativeSpawnPass, true);
      const spawnCase = report.caseResults.find((entry) => entry.caseId === 'current-boundary-spawn-canary');
      assert.equal(spawnCase.verdict, 'pass');
      assert.equal(spawnCase.forkedThreadId, 'spawned-agent-456');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });
});
