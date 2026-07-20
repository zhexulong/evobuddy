import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/render-member-surface.mjs');
const FIXTURE_ROOT = join(REPO_ROOT, 'fixtures/member-surface/final-acceptance');
const POSITIVE_ROOT = join(FIXTURE_ROOT, 'positive');
const REGISTRY_REF = join(REPO_ROOT, 'fixtures/member-surface/registry.json');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('render-member-surface CLI', () => {
  it('writes member-surface JSON and HTML and prints a compact summary', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-surface-'));
    try {
      const result = run([
        '--input', FIXTURE_ROOT,
        '--out', outputDir,
        '--registry', REGISTRY_REF,
        '--required-canary', 'skill-designer:ROLE-CANARY-natural-final',
        '--required-canary', 'skill-designer:TARGET-CANARY-natural-final',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.members, 1);
      assert.equal(parsed.runs, 3);
      assert.equal(parsed.warnings, 0);
      assert.equal(parsed.inputKind, 'aggregate-root');
      assert.equal(parsed.requiredCanaryMode, 'fixture-eval-helper');
      assert.ok(existsSync(parsed.jsonPath));
      assert.ok(existsSync(parsed.htmlPath));

      const report = JSON.parse(readFileSync(parsed.jsonPath, 'utf8'));
      assert.equal(report.members.length, 1);
      assert.equal(report.runs.length, 3);
      assert.equal(report.members[0].memberName, 'skill-designer');

      const html = readFileSync(parsed.htmlPath, 'utf8');
      assert.match(html, /skill-designer/);
      assert.match(html, /ROLE-CANARY-natural-final/);
      assert.match(html, /TARGET-CANARY-natural-final/);
      assert.match(html, /knownLosses/);
      assert.match(html, /native-fork/);
      assert.match(html, /material proof: fail/i);
      assert.doesNotMatch(html, /provider-observed/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('renders directly from a single real run root without needing registry input', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-surface-single-run-'));
    try {
      const result = run([
        '--input', POSITIVE_ROOT,
        '--out', outputDir,
        '--required-canary', 'skill-designer:ROLE-CANARY-natural-final',
        '--required-canary', 'skill-designer:TARGET-CANARY-natural-final',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.members, 1);
      assert.equal(parsed.runs, 1);
      assert.equal(parsed.warnings, 0);
      assert.equal(parsed.inputKind, 'single-run-root');
      const report = JSON.parse(readFileSync(parsed.jsonPath, 'utf8'));
      assert.equal(report.members.length, 1);
      assert.equal(report.runs.length, 1);
      assert.equal(report.members[0].role, 'Skill Designer');
      assert.equal(report.generatedFrom.inputRoot, POSITIVE_ROOT);
      assert.equal(report.generatedFrom.finalSummaryRef, join(FIXTURE_ROOT, 'final-summary.json'));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('exits nonzero on missing required args', () => {
    const result = run(['--input', FIXTURE_ROOT]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing value for --out/i);
  });
});
