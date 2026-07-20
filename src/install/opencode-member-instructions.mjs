import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolveEvobuddyProjectState } from '../core/evobuddy-project-state.mjs';

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function activeTeamAgentLines(agentsRegistry) {
  const agents = agentsRegistry?.agents?.filter((agent) => (agent.visibility ?? 'active') === 'active') ?? [];
  if (agents.length === 0) return [
    '- evolution-agent — durable project behavior improvement proposals and stable mutation review for the TeamAgent substrate.',
    '- builder — implementation-focused TeamAgent seat.',
    '- reviewer — review-focused TeamAgent seat.',
  ];
  return agents.map((agent) => `- ${agent.name} — ${agent.profile?.description ?? 'active EvoBuddy TeamAgent.'}`);
}

function activeBuddyLines(registry) {
  const members = registry?.members?.filter((member) => (member.visibility ?? 'active') === 'active') ?? [];
  if (members.length === 0) return [
    '- explore — read-only codebase exploration.',
    '- librarian — read-only external/reference research.',
    '- sisyphus-junior — bounded debugging, implementation, and issue-resolution work.',
  ];
  return members.map((member) => `- ${member.name} — ${member.profile?.description ?? 'active EvoBuddy Buddy.'}`);
}

export function renderOpenCodeMemberInstructions({ registry, agentsRegistry, updateSummaryRef = '.evobuddy/updates/recent.json' } = {}) {
  return `# EvoBuddy Actors

This project has EvoBuddy TeamAgents and SubagentBuddies available through OpenCode runtime surfaces.

In OpenCode, synced EvoBuddy TeamAgents and Buddies both appear as native child-agent definitions. TeamAgents still represent visible task-room seats semantically; Buddies remain specialist helpers.

Use a TeamAgent when the task needs a durable team seat such as implementation, review, or evolution governance. Use a Buddy when a task clearly benefits from an independent specialist context. Keep the parent agent as the user-facing owner, invoke the fitting child agent natively, and use the child result as input to the parent answer.

Apply \.evobuddy/team-policy.md before deciding whether to work alone or open visible TaskRoom state. Policy-driven TeamAgent fork/handoff means recording why the parent worked alone or created team seats, the current owner, fork lineage, pending handoffs, review-loop status, result return, and evolution handoff in the TaskRoom. There is no hidden mandatory orchestrator: the parent agent or a visible coordinator may apply policy, but coordination must remain visible in TaskRoom state.

Write a normal task prompt for that TeamAgent or Buddy using task wording that matches its role directly (for example: build/implement -> builder, review/check -> reviewer, durable improvement/update behavior -> evolution-agent); dynamic task prompt is parent-supplied.

Return the child result to the parent conversation.

Use EvoBuddy wrapper/CLI only when native subagent invocation is unavailable or explicitly requested, and label it fallback. This is not the normal Buddy surface.

Active TeamAgents:

${activeTeamAgentLines(agentsRegistry).join('\n')}

Active SubagentBuddies:

${activeBuddyLines(registry).join('\n')}

Check recent updates when behavior may have changed. Recent EvoBuddy updates may be summarized at \`${updateSummaryRef}\` when present.

Consider \`evolution-agent\` after repeated, corrected, long, or completed work suggests a durable project behavior improvement.

These instructions cannot force the model to use a particular actor. Runtime/exporter evidence is required for product proof.

Fallback commands, when explicit fallback is required:

- \`evobuddy members invoke <memberName> --task <text> --project <path>\`
- \`evobuddy buddies invoke <buddyName> --task <text> --project <path>\`
`;
}

export function installOpenCodeMemberInstructions({ projectRoot }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  mkdirSync(state.instructionsPath, { recursive: true });
  const instructionPath = state.instructionPath();
  const registry = existsSync(state.registryPath)
    ? JSON.parse(readFileSync(state.registryPath, 'utf8'))
    : undefined;
  const agentsRegistryPath = resolveEvobuddyProjectState({ projectRoot }).projectRoot;
  const agentPresetRegistry = `${agentsRegistryPath}/src/presets/agents/registry.json`;
  const agentsRegistry = existsSync(agentPresetRegistry)
    ? JSON.parse(readFileSync(agentPresetRegistry, 'utf8'))
    : undefined;
  const content = renderOpenCodeMemberInstructions({ registry, agentsRegistry });
  writeFileSync(instructionPath, content, 'utf8');
  const report = {
    status: 'pass',
    runtime: 'opencode',
    instructionPath,
    digest: digest(content),
    stateRoot: state.stateRoot,
  };
  writeFileSync(state.instructionPath('opencode-instruction-install-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
