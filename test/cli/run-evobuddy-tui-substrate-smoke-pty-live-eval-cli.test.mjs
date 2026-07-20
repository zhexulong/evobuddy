import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve('.');

describe('run-evobuddy-tui-substrate-smoke-pty-live-eval CLI', () => {
  it('writes Gate A report with schema, claim ceiling, and non-fake product claim', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-tui-substrate-smoke-'));
    let stdout;
    let code = 0;
    try {
      const result = await execFileAsync(
        process.execPath,
        ['scripts/context-tree/run-evobuddy-tui-substrate-smoke-pty-live-eval.mjs', '--out', out],
        { cwd: root, timeout: 600000 },
      );
      stdout = result.stdout;
    } catch (error) {
      code = error.code ?? 1;
      stdout = error.stdout ?? '';
    }
    const summary = JSON.parse(String(stdout).trim().split('\n').filter(Boolean).at(-1));
    const report = JSON.parse(
      await readFile(join(out, 'evobuddy-tui-substrate-smoke-pty-eval-report.json'), 'utf8'),
    );
    assert.equal(report.schema, 'evobuddy.tui-real-use-pty-eval.v1');
    assert.equal(report.gate, 'substrate-smoke');
    assert.match(report.claimCeiling, /not real runtime product proof/i);
    assert.ok(['pass', 'fail', 'blocked'].includes(report.status));
    if (report.status === 'pass') {
      assert.equal(report.runtime, 'fake-native');
    }
    assert.equal(summary.reportPath, join(out, 'evobuddy-tui-substrate-smoke-pty-eval-report.json'));
    assert.ok(code === 0 || code === 1);
  });
});
