import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/generate-evobuddy-actor-projections.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('generate-evobuddy-actor-projections CLI', () => {
  it('writes TeamAgent and SubagentBuddy projections plus install report', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-actor-generate-'));
    const out = join(root, 'projected');
    try {
      const result = run(['--project', REPO_ROOT, '--out', out, '--include', 'active,available']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      for (const path of [
        '.codex/agents/evolution_agent.toml',
        '.claude/agents/evolution-agent.md',
        '.opencode/agents/evolution-agent.md',
        '.codex/agents/librarian.toml',
        '.claude/agents/librarian.md',
        '.opencode/agents/librarian.md',
      ]) {
        assert.equal(existsSync(join(out, path)), true, path);
      }

      assert.match(readFileSync(join(out, '.codex/agents/evolution_agent.toml'), 'utf8'), /Actor kind: team-agent/);
      assert.match(readFileSync(join(out, '.opencode/agents/librarian.md'), 'utf8'), /actor_kind: subagent-buddy/);

      const report = JSON.parse(readFileSync(join(out, 'evobuddy-actor-projection-install-report.json'), 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-actor-projection-install-report');
      assert.equal(report.actors.some((actor) => actor.actorName === 'evolution-agent' && actor.actorKind === 'team-agent'), true);
      assert.equal(report.actors.some((actor) => actor.actorName === 'librarian' && actor.actorKind === 'subagent-buddy'), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
