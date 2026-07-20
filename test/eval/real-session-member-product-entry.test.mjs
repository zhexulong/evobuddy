import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const EVAL_CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-system-e2e-eval.mjs');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runEval(args) {
  return spawnSync(process.execPath, [EVAL_CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
}

describe('real session member product entry aggregate guard', () => {
  it('fails closed instead of accepting fixture roots as fresh product proof', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-real-product-entry-'));
    try {
      const result = runEval([
        '--out', out,
        '--product-root', join(REPO_ROOT, 'evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-corroborated-product'),
        '--require-fresh-product-root',
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'blocked');
      assert.match(report.productObserved.reason, /fresh product root/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
