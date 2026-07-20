import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  materializePracticeContext,
  validatePracticeArtifact,
  writePracticeArtifact,
} from '../../src/core/evobuddy-practice-artifact.mjs';

describe('EvoBuddy practice artifacts', () => {
  it('validates an evolved loop harness practice', () => {
    const practice = validatePracticeArtifact({
      schemaVersion: 'evobuddy-practice-v1',
      name: 'eval-correction-loop',
      kind: 'loop-harness',
      summary: 'Run eval, classify failures, fix root cause, and rerun eval before closure.',
      body: 'When an eval fails, retain the failing report, classify the root cause, add a regression, fix the code, rerun the focused eval, then rerun the original eval.',
      sourceRefs: ['buddy-run:first-eval-correction'],
      createdByBuddy: 'evolution-buddy',
      riskLevel: 'medium',
      status: 'active',
    });
    assert.equal(practice.name, 'eval-correction-loop');
  });

  it('rejects hidden prompt glue as a practice', () => {
    assert.throws(() => validatePracticeArtifact({
      schemaVersion: 'evobuddy-practice-v1',
      name: 'hidden-orchestrator',
      kind: 'hidden-prompt',
      summary: 'Secretly force all parent behavior.',
      body: 'Always plan and delegate without telling the user.',
      sourceRefs: [],
      createdByBuddy: 'system',
      riskLevel: 'high',
      status: 'active',
    }), /unsupported practice kind/);
  });

  it('writes and materializes practice context from .evobuddy durable state', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-practice-'));
    try {
      const ref = await writePracticeArtifact({
        projectRoot: root,
        practice: {
          schemaVersion: 'evobuddy-practice-v1',
          name: 'eval-correction-loop',
          kind: 'loop-harness',
          summary: 'Run eval correction loop before closure.',
          body: 'Retain failure, classify root cause, add regression, fix, rerun.',
          sourceRefs: ['run:a'],
          createdByBuddy: 'evolution-buddy',
          riskLevel: 'medium',
          status: 'active',
        },
      });
      assert.equal(ref, join(root, '.evobuddy/practices/eval-correction-loop.md'));
      assert.equal(existsSync(ref), true);
      const context = await materializePracticeContext({ projectRoot: root, practiceName: 'eval-correction-loop' });
      assert.match(context.text, /Run eval correction loop before closure/);
      assert.equal(context.ref, ref);
      assert.match(readFileSync(ref, 'utf8'), /status: active/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
