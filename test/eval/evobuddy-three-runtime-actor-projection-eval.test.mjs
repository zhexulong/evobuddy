import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { generateActorProjectionsCli } from '../../scripts/context-tree/generate-evobuddy-actor-projections.mjs';
import { doctorActorProjectionsCli } from '../../scripts/context-tree/doctor-evobuddy-actor-projections.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

test('same actor sources project to all three runtimes with actor-kind parity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-three-runtime-actor-projection-eval-'));
  const project = join(root, 'project');
  const doctorReport = join(root, 'projection-doctor-report.json');

  try {
    const generated = await generateActorProjectionsCli(['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
    assert.equal(generated.status, 'pass');

    const doctor = await doctorActorProjectionsCli(['--project', project, '--report-out', doctorReport, '--include', 'active,available']);
    assert.equal(doctor.status, 'pass');

    const installReport = JSON.parse(readFileSync(join(project, 'evobuddy-actor-projection-install-report.json'), 'utf8'));
    const checked = JSON.parse(readFileSync(doctorReport, 'utf8'));
    const evolutionAgent = installReport.actors.find((actor) => actor.actorName === 'evolution-agent');
    const librarian = installReport.actors.find((actor) => actor.actorName === 'librarian');

    assert.ok(evolutionAgent, 'expected evolution-agent projection');
    assert.ok(librarian, 'expected librarian projection');
    assert.equal(evolutionAgent.actorKind, 'team-agent');
    assert.equal(librarian.actorKind, 'subagent-buddy');
    assert.deepEqual(Object.keys(evolutionAgent.runtimeFiles).sort(), ['claude', 'codex', 'opencode']);
    assert.deepEqual(Object.keys(librarian.runtimeFiles).sort(), ['claude', 'codex', 'opencode']);
    assert.equal(evolutionAgent.runtimeFiles.codex.runtimeActorName, 'evolution_agent');
    assert.equal(librarian.runtimeFiles.codex.runtimeActorName, 'librarian');
    assert.match(readFileSync(join(project, '.codex/agents/evolution_agent.toml'), 'utf8'), /Actor kind: team-agent/);
    assert.match(readFileSync(join(project, '.opencode/agents/librarian.md'), 'utf8'), /SubagentBuddy/);
    assert.equal(checked.status, 'pass');
    assert.ok(checked.checked.some((entry) => entry.actorName === 'evolution-agent' && entry.runtime === 'codex'));
    assert.ok(checked.checked.some((entry) => entry.actorName === 'librarian' && entry.runtime === 'opencode'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
