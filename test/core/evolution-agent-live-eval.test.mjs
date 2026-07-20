import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { runEvolutionAgentSubstrateEval } from '../../src/core/evolution-agent-live-eval.mjs';

test('live eval report passes for current source-backed evolution-agent substrate', async () => {
  const out = await mkdtemp(join(tmpdir(), 'evobuddy-team-agent-substrate-test-'));
  const report = await runEvolutionAgentSubstrateEval({
    projectRoot: new URL('../..', import.meta.url).pathname,
    out,
    mode: 'test-live-shape',
    evidenceRefs: ['docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md'],
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.actorKind, 'team-agent');
  assert.equal(report.agentName, 'evolution-agent');
  assert.equal(report.stableMutation.status, 'pass');
  assert.equal(report.highRiskNegativeControl.status, 'blocked');
  assert.equal(report.highRiskDeclaredControl.status, 'pending-review');
  assert.equal(report.generatedSkillProjection.status, 'pass');
  assert.equal(report.durableApply.status, 'pass');
  assert.equal(report.recentUpdate.status, 'pass');
  assert.ok(report.evidenceRefs.length >= 1);
  assert.match(report.evidenceRefs[0].digest, /^sha256:/);

  const saved = JSON.parse(await readFile(join(out, 'evobuddy-team-agent-substrate-live-eval-report.json'), 'utf8'));
  assert.equal(saved.status, 'pass');
  assert.equal(saved.issues.length, 0);
  assert.equal(saved.durableApply.status, 'pass');
  assert.equal(saved.recentUpdate.status, 'pass');
  assert.match(saved.sourceDigests.reviewer, /^sha256:/);
  assert.match(saved.sourceDigests.generatedSkillProjection, /^sha256:/);
});

test('live eval report fails when evolution-buddy remains active and evolution-agent is absent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'evobuddy-team-agent-substrate-fixture-'));
  const out = await mkdtemp(join(tmpdir(), 'evobuddy-team-agent-substrate-fail-'));
  await mkdir(join(root, 'src/presets/agents'), { recursive: true });
  await mkdir(join(root, 'src/presets/agents/evolution-agent'), { recursive: true });
  await mkdir(join(root, 'src/presets/knowledge/sops'), { recursive: true });
  await mkdir(join(root, 'src/presets/buddies'), { recursive: true });
  await mkdir(join(root, 'src/presets/buddies/evolution-buddy'), { recursive: true });
  await mkdir(join(root, 'docs/superpowers/specs'), { recursive: true });

  const repoRoot = new URL('../..', import.meta.url).pathname;
  await cp(join(repoRoot, 'src/presets/agents/reviewer/AGENT.md'), join(root, 'src/presets/agents/reviewer/AGENT.md'));
  await cp(join(repoRoot, 'src/presets/agents/evolution-agent/AGENT.md'), join(root, 'src/presets/agents/evolution-agent/AGENT.md'));
  await cp(join(repoRoot, 'src/presets/knowledge/sops/evolution-stable-mutation.md'), join(root, 'src/presets/knowledge/sops/evolution-stable-mutation.md'));
  await cp(join(repoRoot, 'src/presets/buddies/evolution-buddy/BUDDY.md'), join(root, 'src/presets/buddies/evolution-buddy/BUDDY.md'));
  await cp(
    join(repoRoot, 'docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md'),
    join(root, 'docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md'),
  );
  await writeFile(join(root, 'src/presets/agents/registry.json'), `${JSON.stringify({ version: '1', agents: [] }, null, 2)}\n`);
  await writeFile(join(root, 'src/presets/buddies/registry.json'), `${JSON.stringify({
    version: '1',
    members: [{
      name: 'evolution-buddy',
      aliases: ['evolution-agent'],
      resolvedMemberId: 'preset-evolution-buddy',
      profileRef: './evolution-buddy.json',
      definitionRef: './evolution-buddy/BUDDY.md',
      sourceKind: 'product-preset',
      presetVersion: '2026-07-17',
      visibility: 'active',
      sourceFamily: 'omo-derived',
      exposure: 'buddy',
      knowledgeRefs: ['knowledge/sops/evolution-stable-mutation.md'],
      skillRefs: [],
      routingPriority: 'default',
    }],
  }, null, 2)}\n`);

  const report = await runEvolutionAgentSubstrateEval({
    projectRoot: root,
    out,
    mode: 'test-live-shape',
    evidenceRefs: ['docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md'],
  });

  assert.equal(report.status, 'fail');
  assert.ok(report.issues.includes('missing active evolution-agent TeamAgent'));
  assert.ok(report.issues.includes('evolution-buddy remains active SubagentBuddy'));
  assert.equal(report.durableApply.status, 'pass');
});
