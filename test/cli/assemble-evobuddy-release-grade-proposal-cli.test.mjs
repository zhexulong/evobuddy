import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/assemble-evobuddy-release-grade-proposal.mjs');

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('assemble-evobuddy-release-grade-proposal CLI', () => {
  it('writes a release-grade proposal artifact with run/model/observed-turn closure and matching digests', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-assemble-evobuddy-proposal-'));
    try {
      const outDir = join(root, 'assembled');
      const runRef = join(root, 'evolution-buddy-run.json');
      const modelOutputRef = join(root, 'evolution-buddy-model-output.json');
      const observedTurnRef = join(root, 'evolution-buddy-observed-turn.json');
      const modelOutput = {
        targetKind: 'existing-buddy-update',
        targetRef: 'buddy:skill-designer',
        updateFacet: 'skill',
        decisionReason: 'Repeated feedback says skill-designer must check symptom-driven trigger language first.',
        patchReasoning: 'The Buddy should check symptom-driven trigger language before implementation details.',
        proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.',
        sourceRefs: ['member-task-run:before', 'message:u-feedback-1'],
      };
      const observedTurn = {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'ses-evolution:turn-1',
        outputDigest: sha256Text(JSON.stringify(modelOutput)),
      };
      writeJson(runRef, { evolutionBuddyName: 'evolution-buddy', proposalSource: 'evolution-buddy' });
      writeText(modelOutputRef, JSON.stringify(modelOutput));
      writeJson(observedTurnRef, observedTurn);

      const result = run([
        '--buddy-name', 'skill-designer',
        '--evolution-buddy-run', runRef,
        '--model-output', modelOutputRef,
        '--observed-turn', observedTurnRef,
        '--out', outDir,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.ok(summary.proposalRef);
      assert.ok(existsSync(summary.proposalRef));
      const proposal = readJson(summary.proposalRef);
      assert.equal(proposal.proposalSource, 'evolution-buddy');
      assert.equal(proposal.targetRef, 'buddy:skill-designer');
      assert.equal(proposal.evolutionBuddyRunRef, runRef);
      assert.equal(proposal.evolutionBuddyRunDigest, sha256Text(readFileSync(runRef, 'utf8')));
      assert.equal(proposal.modelOutputRef, modelOutputRef);
      assert.equal(proposal.modelOutputDigest, sha256Text(readFileSync(modelOutputRef, 'utf8')));
      assert.equal(proposal.observedTurnRef, observedTurnRef);
      assert.equal(proposal.observedTurnDigest, sha256Text(readFileSync(observedTurnRef, 'utf8')));
      assert.equal(summary.proposalDigest, sha256Text(readFileSync(summary.proposalRef, 'utf8')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
