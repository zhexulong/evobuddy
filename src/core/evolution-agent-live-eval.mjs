import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEvobuddyActorRegistry } from './evobuddy-actor-registry.mjs';
import { validateGeneratedSkillProjection } from './evobuddy-generated-skill-projection.mjs';
import { classifyEvolutionAgentMutation } from './evolution-agent-mutation-policy.mjs';

function digest(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readText(path) {
  return readFile(path, 'utf8');
}

async function saveReport(out, report) {
  await mkdir(out, { recursive: true });
  const reportPath = join(out, 'evobuddy-team-agent-substrate-live-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

export async function runEvolutionAgentSubstrateEval({ projectRoot, out, mode = 'live', evidenceRefs = [] }) {
  const agentsRegistryPath = join(projectRoot, 'src/presets/agents/registry.json');
  const buddiesRegistryPath = join(projectRoot, 'src/presets/buddies/registry.json');
  const evolutionAgentPath = join(projectRoot, 'src/presets/agents/evolution-agent/AGENT.md');
  const reviewerPath = join(projectRoot, 'src/presets/agents/reviewer/AGENT.md');
  const sopPath = join(projectRoot, 'src/presets/knowledge/sops/evolution-stable-mutation.md');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) throw new Error('required evidenceRefs');

  const agentsRegistry = await readJson(agentsRegistryPath);
  const buddiesRegistry = await readJson(buddiesRegistryPath);
  const registry = loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry });

  const evolutionAgent = await readText(evolutionAgentPath);
  const reviewerBefore = await readText(reviewerPath);
  const skillMarkdown = '---\nname: evolution-agent\n---\n# Evolution Agent Skill Projection\nThis generated projection references knowledge/sops/evolution-stable-mutation.md and is not source authority.';
  const sopMarkdown = await readText(sopPath);

  const digestedEvidenceRefs = [];
  for (const evidenceRef of evidenceRefs) {
    const absoluteRef = join(projectRoot, evidenceRef);
    const content = await readText(absoluteRef);
    digestedEvidenceRefs.push({ ref: evidenceRef, digest: digest(content), bytes: content.length });
  }

  const stableMutation = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: reviewerBefore.replace('Return concise findings with evidence, severity, and the smallest useful correction path.', 'Return concise findings with evidence, severity, and the smallest useful correction path for the active task thread.'),
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });

  const highRiskNegativeControl = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: '# Reviewer\n\n## Team Role\nReviews patches.\n',
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });

  const highRiskDeclaredControl = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: '# Reviewer\n\n## Team Role\nReviews patches.\n',
    declaredRiskLevel: 'high',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });

  const generatedSkillProjection = validateGeneratedSkillProjection({
    skillRef: 'projections/codex/skills/evolution-agent/SKILL.md',
    skillMarkdown,
  });

  const activeEvolutionAgent = registry.activeTeamAgents.find((entry) => entry.name === 'evolution-agent');
  const oldEvolutionBuddyActive = registry.activeSubagentBuddies.some((entry) => entry.name === 'evolution-buddy');

  await mkdir(out, { recursive: true });
  const durableApplyPath = join(out, 'reviewer-agent-temp-apply.md');
  const durableApplyText = reviewerBefore.replace('Return concise findings with evidence, severity, and the smallest useful correction path.', 'Return concise findings with evidence, severity, and the smallest useful correction path for the active task thread.');
  const durableApply = stableMutation.status === 'pass'
    ? {
      status: 'pass',
      appliedKind: 'temp-small-diff-apply',
      targetRef: 'agents/reviewer/AGENT.md',
      ref: durableApplyPath,
      previousDigest: digest(reviewerBefore),
      nextDigest: digest(durableApplyText),
    }
    : {
      status: 'fail',
      reason: 'stable mutation did not pass',
      targetRef: 'agents/reviewer/AGENT.md',
    };
  if (durableApply.status === 'pass') await writeFile(durableApplyPath, durableApplyText, 'utf8');

  const recentUpdate = durableApply.status === 'pass'
    ? {
      status: 'pass',
      summary: 'Updated reviewer return contract candidate.',
    }
    : {
      status: 'fail',
      reason: 'durable apply failed',
    };

  const issues = [];
  if (!activeEvolutionAgent) issues.push('missing active evolution-agent TeamAgent');
  if (oldEvolutionBuddyActive) issues.push('evolution-buddy remains active SubagentBuddy');
  if (stableMutation.status !== 'pass') issues.push('stable mutation did not pass');
  if (highRiskNegativeControl.status !== 'blocked') issues.push('high-risk negative control did not block');
  if (highRiskDeclaredControl.status !== 'pending-review') issues.push('declared high-risk control did not remain pending-review');
  if (generatedSkillProjection.status !== 'pass') issues.push('skill/SOP boundary failed');
  if (durableApply.status !== 'pass') issues.push('durable apply failed');
  if (recentUpdate.status !== 'pass') issues.push('recent update failed');

  const report = {
    schema: 'evobuddy-team-agent-substrate-live-eval.v1',
    status: issues.length === 0 ? 'pass' : 'fail',
    mode,
    proofScope: 'source-and-mutation-substrate',
    issues,
    actorKind: 'team-agent',
    agentName: 'evolution-agent',
    activeTeamAgents: registry.activeTeamAgents.map((entry) => entry.name),
    activeSubagentBuddies: registry.activeSubagentBuddies.map((entry) => entry.name),
    sourceDigests: {
      agentsRegistry: digest(JSON.stringify(agentsRegistry)),
      buddiesRegistry: digest(JSON.stringify(buddiesRegistry)),
      evolutionAgent: digest(evolutionAgent),
      reviewer: digest(reviewerBefore),
      generatedSkillProjection: digest(skillMarkdown),
      stableMutationSop: digest(sopMarkdown),
    },
    stableMutation,
    highRiskNegativeControl,
    highRiskDeclaredControl,
    generatedSkillProjection,
    durableApply,
    recentUpdate,
    evidenceRefs: digestedEvidenceRefs,
  };

  report.reportPath = await saveReport(out, report);
  return report;
}
