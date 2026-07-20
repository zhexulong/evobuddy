import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { doctorActorProjections } from '../../src/core/evobuddy-actor-projection-doctor.mjs';
import { generateActorRuntimeProjections, renderActorProjectionFile } from '../../src/core/evobuddy-actor-runtime-projection.mjs';

async function write(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

test('doctor passes generated TeamAgent and SubagentBuddy files and detects drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'evobuddy-actor-doctor-'));
  const actor = {
    actorKind: 'team-agent',
    name: 'evolution-agent',
    definitionRef: './evolution-agent/AGENT.md',
    visibility: 'active',
    sourceFamily: 'evobuddy-native',
    knowledgeRefs: [],
    skillRefs: [],
  };
  const projections = generateActorRuntimeProjections({ actor, sourceMarkdown: '# Evolution Agent', sourceDigest: 'sha256:test' });
  await write(join(root, '.codex/agents/evolution_agent.toml'), renderActorProjectionFile(projections.codex));
  await write(join(root, '.claude/agents/evolution-agent.md'), renderActorProjectionFile(projections.claude));
  await write(join(root, '.opencode/agents/evolution-agent.md'), renderActorProjectionFile(projections.opencode));

  const pass = await doctorActorProjections({ projectRoot: root, projections: [projections] });
  assert.equal(pass.status, 'pass');
  await write(join(root, '.codex/agents/evolution_agent.toml'), 'broken');
  const drift = await doctorActorProjections({ projectRoot: root, projections: [projections] });
  assert.equal(drift.status, 'drift');
  assert.ok(drift.issues.some((issue) => issue.runtime === 'codex'));
});
