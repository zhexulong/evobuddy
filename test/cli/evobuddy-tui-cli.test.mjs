import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, copyFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('evobuddy-tui CLI', () => {
  it('renders a headless snapshot from explicit state JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'evobuddy-tui-smoke-'));
    const statePath = join(dir, 'state.json');
    const snapshotPath = join(dir, 'snapshot.txt');
    await copyFile(resolve('test/fixtures/evobuddy-workbench-state-v1.json'), statePath);

    await execFileAsync('cargo', [
      'run', '-p', 'evobuddy-tui', '--',
      '--project', resolve('.'),
      '--state-json', statePath,
      '--headless-snapshot', snapshotPath,
      '--headless-width', '100',
      '--headless-height', '32',
      '--quit-after-render',
    ], { cwd: resolve('.') });

    const snapshot = await readFile(snapshotPath, 'utf8');
    assert.match(snapshot, /EvoBuddy/);
    assert.match(snapshot, /OpenCode/);
    assert.match(snapshot, /Codex/);
  });
});
