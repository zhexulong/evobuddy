import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Text } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/write-evobuddy-routing-decision.mjs');

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('write-evobuddy-routing-decision CLI', () => {
  it('writes digest-bound routing-decision artifact from observed model turn and rejects adapter-named prompts', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-1',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Please decide which Buddy should handle this review.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.routingDecisionRef));
      const artifactRaw = readFileSync(parsed.routingDecisionRef, 'utf8');
      const artifact = JSON.parse(artifactRaw);
      assert.equal(parsed.routingDecisionDigest, sha256Text(artifactRaw));
      assert.equal(artifact.selectedBuddyName, 'skill-designer');
      assert.equal(artifact.adapterCommandNamedInPrompt, false);
      assert.equal(artifact.modelOutputDigest, sha256Text('Select skill-designer because the request needs skill review.'));
      assert.equal(artifact.observedTurnDigest, sha256Text(readFileSync(observedTurnRef, 'utf8')));

      const rejected = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Run ctree buddies invoke skill-designer now.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(rejected.status, 0);
      assert.match(`${rejected.stderr}\n${rejected.stdout}`, /adapter command named in prompt/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('accepts --prompt-ref file path as an alternative to --prompt-text', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const promptRef = join(out, 'prompt.txt');
      writeFileSync(promptRef, 'Please decide which Buddy should handle this review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-2',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-ref', promptRef,
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.routingDecisionRef));
      const artifactRaw = readFileSync(parsed.routingDecisionRef, 'utf8');
      const artifact = JSON.parse(artifactRaw);
      assert.equal(artifact.selectedBuddyName, 'skill-designer');
      assert.equal(artifact.promptDigest, sha256Text('Please decide which Buddy should handle this review.'));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects prompt containing invoke-buddy', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-3',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Use invoke-buddy to call skill-designer.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /adapter command named in prompt/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects prompt containing invoke-member', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-4',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Run invoke-member to select skill-designer.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /adapter command named in prompt/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects prompt containing scripts/context-tree', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-5',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Use scripts/context-tree to invoke skill-designer.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /adapter command named in prompt/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects when observed-turn outputDigest does not match model output', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-6',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('a completely different text that does not match'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Please decide which Buddy should handle this review.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /outputDigest/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects when --out already contains routing-decision.json', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const existing = join(out, 'routing-decision.json');
      writeFileSync(existing, '{}', 'utf8');
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-7',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Please decide which Buddy should handle this review.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /already exists/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('creates nonexistent --out directory and writes routing-decision artifact', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-nonexistent-dir',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const nonexistentDir = join(out, 'nonexistent-subdir');
      const result = spawnSync(process.execPath, [CLI,
        '--out', nonexistentDir,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
        '--prompt-text', 'Please decide which Buddy should handle this review.',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.routingDecisionRef));
      const artifactRaw = readFileSync(parsed.routingDecisionRef, 'utf8');
      const artifact = JSON.parse(artifactRaw);
      assert.equal(artifact.selectedBuddyName, 'skill-designer');
      assert.equal(artifact.adapterCommandNamedInPrompt, false);
      assert.equal(artifact.modelOutputDigest, sha256Text('Select skill-designer because the request needs skill review.'));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects when no prompt source is provided', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const modelOutputRef = join(out, 'observed-model-output.txt');
      writeFileSync(modelOutputRef, 'Select skill-designer because the request needs skill review.', 'utf8');
      const observedTurnRef = join(out, 'observed-routing-turn.json');
      writeJson(observedTurnRef, {
        artifactKind: 'observed-parent-agent-model-turn',
        turnRef: 'session-1:turn-8',
        outputRef: modelOutputRef,
        outputDigest: sha256Text('Select skill-designer because the request needs skill review.'),
      });
      const result = spawnSync(process.execPath, [CLI,
        '--out', out,
        '--selected-buddy', 'skill-designer',
        '--observed-turn', observedTurnRef,
        '--model-output', modelOutputRef,
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /prompt-text or --prompt-ref/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
