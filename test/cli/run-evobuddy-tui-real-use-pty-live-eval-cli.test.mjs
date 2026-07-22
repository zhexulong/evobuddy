import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve('.');

describe('run-evobuddy-tui-real-use-pty-live-eval CLI', () => {
  it('writes Gate B report and never passes with fake-native', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-tui-real-use-'));
    let stdout;
    let code = 0;
    try {
      const result = await execFileAsync(
        process.execPath,
        [
          'scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs',
          '--project',
          root,
          '--out',
          out,
        ],
        { cwd: root, timeout: 300000 },
      );
      stdout = result.stdout;
    } catch (error) {
      code = error.code ?? 1;
      stdout = error.stdout ?? '';
    }
    const summary = JSON.parse(String(stdout).trim().split('\n').filter(Boolean).at(-1));
    const report = JSON.parse(
      await readFile(join(out, 'evobuddy-tui-real-use-pty-eval-report.json'), 'utf8'),
    );
    assert.equal(report.schema, 'evobuddy.tui-real-use-pty-eval.v1');
    assert.equal(report.gate, 'real-runtime');
    assert.match(report.claimCeiling, /real-use TaskRoom create/i);
    assert.ok(['pass', 'fail', 'blocked'].includes(report.status));
    if (report.status === 'pass') {
      assert.notEqual(report.runtime, 'fake-native');
      assert.ok(report.runtime);
    }
    assert.equal(summary.reportPath, join(out, 'evobuddy-tui-real-use-pty-eval-report.json'));
    assert.ok(code === 0 || code === 1);
  });
});
