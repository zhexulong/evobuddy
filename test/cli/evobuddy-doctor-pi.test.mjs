import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');

describe('evobuddy doctor runtime probes', () => {
  it('includes soft pi and tmux runtime fields in JSON output', () => {
    const result = spawnSync(process.execPath, [CLI, 'doctor', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(typeof report.runtimes.pi.present, 'boolean');
    assert.ok(Object.hasOwn(report.runtimes.pi, 'version'));
    assert.ok(Object.hasOwn(report.runtimes.pi, 'path'));
    assert.equal(typeof report.runtimes.tmux.present, 'boolean');
    assert.ok(Object.hasOwn(report.runtimes.tmux, 'version'));
    assert.equal(typeof report.memory.note, 'string');
    assert.match(report.memory.note, /250MB|memory budget/i);
    assert.ok(Object.hasOwn(report.memory, 'selfRssKb'));
  });

  it('reports pi missing honestly without failing doctor when pi is absent from PATH', () => {
    const result = spawnSync(process.execPath, [CLI, 'doctor', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, PATH: '' },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'pass');
    assert.deepEqual(report.runtimes.pi, {
      present: false,
      version: null,
      path: null,
    });
  });
});
