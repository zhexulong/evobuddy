import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkbenchInvocation } from '../../scripts/evobuddy/evobuddy.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('evobuddy product CLI dispatcher', () => {
  it('workbench --help documents the interactive EvoBuddy TUI path', () => {
    const result = run(['workbench', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /evobuddy workbench --project <path>/);
    assert.match(result.stdout, /--interactive --input-root <root>/);
    assert.match(result.stdout, /actor-aware TeamAgent \/ Focused Buddy \/ TaskRoom TUI/i);
  });

  it('setup seeds bundled Buddy presets into .evobuddy and is idempotent', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-dispatcher-setup-'));
    try {
      const first = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(first.status, 0, first.stderr || first.stdout);
      const firstReport = JSON.parse(first.stdout);
      assert.equal(firstReport.status, 'pass');
      assert.equal(firstReport.stateRoot, join(root, '.evobuddy'));
      assert.deepEqual(firstReport.presetSeeding.added, ['explore', 'librarian', 'sisyphus-junior']);
      assert.equal(existsSync(join(root, '.evobuddy/registry.json')), true);
      assert.equal(existsSync(join(root, '.context-tree/registry.json')), false);
      assert.equal(readJson(join(root, '.evobuddy/registry.json')).members.some((member) => member.name === 'explore'), true);
      assert.equal(readJson(join(root, '.evobuddy/registry.json')).members.some((member) => member.name === 'librarian'), true);
      assert.equal(readJson(join(root, '.evobuddy/registry.json')).members.some((member) => member.name === 'sisyphus-junior'), true);

      const registryBefore = readFileSync(join(root, '.evobuddy/registry.json'), 'utf8');
      const second = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(second.status, 0, second.stderr || second.stdout);
      assert.equal(readFileSync(join(root, '.evobuddy/registry.json'), 'utf8'), registryBefore);
      assert.deepEqual(JSON.parse(second.stdout).presetSeeding.preserved, ['explore', 'librarian', 'sisyphus-junior']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('setup then buddies sync projects active Buddy presets to runtime definitions', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-setup-active-buddy-sync-'));
    try {
      const project = join(root, 'project');
      const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const sync = run(['buddies', 'sync', '--project', project]);
      assert.equal(sync.status, 0, sync.stderr || sync.stdout);
      const stdout = JSON.parse(sync.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(existsSync(join(project, '.opencode/agents/explore.md')), true);
      assert.equal(existsSync(join(project, '.claude/agents/explore.md')), true);
      assert.equal(existsSync(join(project, '.codex/agents/explore.toml')), true);
      assert.equal(existsSync(join(project, '.opencode/agents/librarian.md')), true);
      assert.equal(existsSync(join(project, '.claude/agents/librarian.md')), true);
      assert.equal(existsSync(join(project, '.codex/agents/librarian.toml')), true);
      assert.equal(existsSync(join(project, '.opencode/agents/sisyphus-junior.md')), true);
      assert.equal(existsSync(join(project, '.claude/agents/sisyphus-junior.md')), true);
      assert.equal(existsSync(join(project, '.codex/agents/sisyphus_junior.toml')), true);
      const opencodeDefinition = readFileSync(join(project, '.opencode/agents/explore.md'), 'utf8');
      assert.match(opencodeDefinition, /## Operating Rules/);
      assert.match(opencodeDefinition, /Stay read-only/);
      assert.match(opencodeDefinition, /Return Shape/);
      const sisyphusDefinition = readFileSync(join(project, '.opencode/agents/sisyphus-junior.md'), 'utf8');
      assert.match(sisyphusDefinition, /bounded execution Buddy/i);
      assert.match(sisyphusDefinition, /Reproduce failures before fixing/i);
      assert.match(sisyphusDefinition, /root-cause evidence/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies doctor catches removed active preset content after setup sync', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-active-buddy-doctor-drift-'));
    try {
      const project = join(root, 'project');
      const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const sync = run(['buddies', 'sync', '--project', project]);
      assert.equal(sync.status, 0, sync.stderr || sync.stdout);
      const opencodePath = join(project, '.opencode/agents/explore.md');
      const edited = readFileSync(opencodePath, 'utf8').replace(/Stay read-only/g, '');
      assert.notEqual(edited, readFileSync(opencodePath, 'utf8'));
      writeFileSync(opencodePath, edited, 'utf8');
      const doctor = run(['buddies', 'doctor', '--project', project]);
      assert.notEqual(doctor.status, 0);
      assert.equal(JSON.parse(doctor.stdout).status, 'drift');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies invoke defaults to seeded project registry instead of fixture fallback', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-buddies-invoke-seeded-'));
    try {
      const out = join(root, '.evobuddy/runs/invoke-test');
      const setup = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const result = run(['buddies', 'invoke', 'explore', '--task', 'Map durable evolution signals.', '--project', root, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.memberName, 'explore');
      assert.equal(summary.returnedTo, 'parent-agent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('updates recent returns JSON summary from .evobuddy updates', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-updates-recent-cli-'));
    try {
      const setup = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      writeFileSync(join(root, '.evobuddy/evolution/ledger.jsonl'), `${JSON.stringify({ action: 'applied', patchId: 'patch-cli', targetKind: 'buddy-routing', targetRef: 'buddy:skill-designer', createdAt: '2026-07-13T00:00:00.000Z', summary: 'Applied skill-designer routing update: check trigger wording first.', activeTargetRef: join(root, '.evobuddy/registry.json') })}\n`, 'utf8');
      const result = run(['updates', 'recent', '--project', root, '--json', '--limit', '1']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.schemaVersion, 'evobuddy-update-summary-v1');
      assert.deepEqual(summary.items.map((item) => item.ref), ['patch-cli']);
      assert.doesNotMatch(JSON.stringify(summary.items), /sha256|digest|proof/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('workbench marks actor-aware interactive requests as PTY-preserving product invocations', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-workbench-interactive-'));
    try {
      const project = join(root, 'project');
      const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      const invocation = resolveWorkbenchInvocation([
        '--project', project,
        '--interactive',
        '--input-root', 'fixtures/evobuddy-workbench/team-taskroom-retained',
      ], {
        runsPath: join(project, '.evobuddy/runs'),
        registryPath: join(project, '.evobuddy/registry.json'),
      });

      assert.equal(invocation.actorAwareRequest, true);
      assert.equal(invocation.interactive, true);
      assert.equal(invocation.stateExport, false);
      assert.deepEqual(invocation.forwarded.slice(0, 4), ['--evobuddy', '--view', 'overview', '--interactive']);
      assert.equal(invocation.forwarded.includes('--input-root'), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('workbench preserves the legacy-text compatibility route even when actor-aware flags include --json-out', () => {
    const project = '/tmp/evobuddy-project';
    const invocation = resolveWorkbenchInvocation([
      '--project', project,
      '--legacy-text',
      '--input-root', 'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--json-out', 'ignored-by-legacy-route.json',
    ], {
      runsPath: join(project, '.evobuddy/runs'),
      registryPath: join(project, '.evobuddy/registry.json'),
    });

    assert.equal(invocation.actorAwareRequest, true);
    assert.equal(invocation.legacyText, true);
    assert.equal(invocation.stateExport, false);
    assert.equal(invocation.rustProductRoute, false);
    assert.equal(invocation.forwarded.includes('--json-out'), true);
  });

  it('workbench state export forwards input-root and writes evobuddy.workbench.state.v1', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-workbench-state-export-'));
    try {
      const project = join(root, 'project');
      const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const retainedInputRoot = join(REPO_ROOT, 'fixtures/evobuddy-workbench/team-taskroom-retained');
      const jsonOut = join(root, 'workbench state output.json');

      const result = run([
        'workbench',
        '--project', project,
        '--input-root', retainedInputRoot,
        '--json-out', jsonOut,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const exported = readJson(jsonOut);
      assert.equal(exported.schema, 'evobuddy.workbench.state.v1');
      assert.equal(exported.projectRoot, resolve(project));
      assert.equal(exported.taskRooms.length, 2);
      assert.deepEqual(exported.taskRooms.map((room) => room.id), [
        'taskroom:retained-review-loop-claude',
        'taskroom:retained-review-loop-opencode',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
