import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FIXTURE_ROOT = resolve('fixtures/evobuddy-workbench/team-taskroom-retained');
const PROJECT_ROOT = resolve('.');

describe('export-evobuddy-workbench-state CLI', () => {
  it('writes normalized state JSON to --out for explicit report inputs', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-state-cli-'));
    const outPath = join(outDir, 'workbench-state.json');

    const result = await execFileAsync('node', [
      'scripts/context-tree/export-evobuddy-workbench-state.mjs',
      '--project', PROJECT_ROOT,
      '--aggregate-report', resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
      '--plan1-report', resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      '--plan2-report', resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      '--taskroom-report', resolve(FIXTURE_ROOT, 'taskrooms/opencode-taskroom-team-loop-report.json'),
      '--taskroom-report', resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json'),
      '--out', outPath,
    ]);

    assert.equal(result.stdout, '');
    const written = JSON.parse(await readFile(outPath, 'utf8'));
    assert.equal(written.schema, 'evobuddy.workbench.state.v1');
    assert.equal(written.projectRoot, PROJECT_ROOT);
    assert.equal(written.taskRooms.length, 2);
    assert.equal(written.runtimeSetup.find((entry) => entry.runtime === 'Codex').status, 'Partial');
  });

  it('prints normalized state JSON to stdout when --out is omitted', async () => {
    const result = await execFileAsync('node', [
      'scripts/context-tree/export-evobuddy-workbench-state.mjs',
      '--project', PROJECT_ROOT,
      '--plan1-report', resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      '--plan2-report', resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      '--taskroom-report', resolve(FIXTURE_ROOT, 'taskrooms/opencode-taskroom-team-loop-report.json'),
    ]);

    const state = JSON.parse(result.stdout);
    assert.equal(state.schema, 'evobuddy.workbench.state.v1');
    assert.equal(state.projectRoot, PROJECT_ROOT);
    assert.equal(Array.isArray(state.actors.teamAgents), true);
  });
});
