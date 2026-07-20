import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const GENERATE_CLI = join(REPO_ROOT, 'scripts/context-tree/generate-evobuddy-actor-projections.mjs');
const DOCTOR_CLI = join(REPO_ROOT, 'scripts/context-tree/doctor-evobuddy-actor-projections.mjs');

function run(cli, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('doctor-evobuddy-actor-projections CLI', () => {
  it('passes on generated files and detects drift after corruption', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-actor-doctor-cli-'));
    const out = join(root, 'projected');
    const reportOut = join(root, 'doctor-report.json');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', out, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);

      const pass = run(DOCTOR_CLI, ['--project', out, '--report-out', reportOut, '--include', 'active,available']);
      assert.equal(pass.status, 0, pass.stderr || pass.stdout);
      assert.equal(JSON.parse(readFileSync(reportOut, 'utf8')).status, 'pass');

      const codexPath = join(out, '.codex/agents/evolution_agent.toml');
      writeFileSync(codexPath, `${readFileSync(codexPath, 'utf8')}\n# drift\n`, 'utf8');

      const drift = run(DOCTOR_CLI, ['--project', out, '--report-out', reportOut, '--include', 'active,available']);
      assert.equal(drift.status, 0, drift.stderr || drift.stdout);
      const report = JSON.parse(readFileSync(reportOut, 'utf8'));
      assert.equal(report.status, 'drift');
      assert.equal(report.issues.some((issue) => issue.path === '.codex/agents/evolution_agent.toml' && issue.issue === 'drift'), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
