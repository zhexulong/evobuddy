import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const EVOBUDDY_CLI = resolve(ROOT, 'scripts/evobuddy/evobuddy.mjs');

function readRepo(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('EvoBuddy product-facing naming boundary', () => {
  it('keeps the README main product flow on evobuddy commands', () => {
    const readme = readRepo('README.md');
    assert.match(readme, /npm run evobuddy:run-product-release-readiness-eval/);
    assert.match(readme, /npm run evobuddy:run-three-runtime-buddy-surface-release-eval/);
    assert.match(readme, /npm run evobuddy:eval-runtime-natural-use-v0/);
    assert.match(readme, /npm run evobuddy:eval-evolution-loop-v0/);
    assert.doesNotMatch(readme, /npm run context-tree:run-product-release-readiness-eval/);
    assert.doesNotMatch(readme, /npm run context-tree:run-three-runtime-buddy-surface-release-eval/);
    assert.doesNotMatch(readme, /npm run context-tree:eval-evobuddy-runtime-natural-use-v0/);
    assert.doesNotMatch(readme, /npm run context-tree:eval-evobuddy-evolution-loop-v0/);
  });

  it('exposes evobuddy aliases for product-facing projection and release commands', () => {
    const packageJson = JSON.parse(readRepo('package.json'));
    assert.equal(packageJson.bin.evobuddy, 'scripts/evobuddy/evobuddy.mjs');
    for (const scriptName of [
      'evobuddy:install-member-projections',
      'evobuddy:eval-member-runtime-projection',
      'evobuddy:run-natural-use-benchmark',
      'evobuddy:eval-runtime-natural-use-v0',
      'evobuddy:eval-evolution-loop-v0',
      'evobuddy:run-three-runtime-buddy-surface-release-eval',
      'evobuddy:run-product-release-readiness-eval',
    ]) {
      assert.equal(typeof packageJson.scripts[scriptName], 'string', scriptName);
    }
  });

  it('prints evobuddy as the product name for --version', () => {
    const result = spawnSync(process.execPath, [EVOBUDDY_CLI, '--version'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /^evobuddy 0\.0\.0\n$/);
  });
});
