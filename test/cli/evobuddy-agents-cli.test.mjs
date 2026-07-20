import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');
const PRESET_AGENTS_REGISTRY = join(REPO_ROOT, 'src/presets/agents/registry.json');
const PRESET_BUDDIES_REGISTRY = join(REPO_ROOT, 'src/presets/buddies/registry.json');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('evobuddy agents CLI', () => {
  it('agents sync dispatches actor-aware projection installation', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-agents-sync-'));
    try {
      const result = run(['agents', 'sync', '--project', root, '--agents-registry', PRESET_AGENTS_REGISTRY, '--registry', PRESET_BUDDIES_REGISTRY, '--member', 'evolution-agent']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'pass');
      assert.equal(existsSync(join(root, '.codex/agents/evolution_agent.toml')), true);
      assert.equal(existsSync(join(root, 'evobuddy-actor-projection-install-report.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
