import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { ensureContextTreeProjectState } from '../core/context-tree-project-state.mjs';

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

export function renderClaudeMemberInstructions({ registry, agentsRegistry, updateSummaryRef = '.evobuddy/updates/recent.json' } = {}) {
  return `# EvoBuddy Actors

This project has EvoBuddy TeamAgents and SubagentBuddies available through Claude Code runtime surfaces.

Synced native Buddy definitions live at \.claude/agents/<member>\.md. TeamAgents are visible team seats when the runtime supports them; SubagentBuddies are focused delegate specialists.

Use a TeamAgent when the task needs a durable team seat such as implementation, review, or evolution governance. Use a Buddy when a task clearly benefits from an independent specialist context. Keep the parent agent as the user-facing owner, and use the child result as input to the parent answer.

Apply \.evobuddy/team-policy.md before deciding whether to work alone or open visible TaskRoom state. Policy-driven TeamAgent fork/handoff means recording why the parent worked alone or created team seats, the current owner, fork lineage, pending handoffs, review-loop status, result return, and evolution handoff in the TaskRoom. There is no hidden mandatory orchestrator: the parent agent or a visible coordinator may apply policy, but coordination must remain visible in TaskRoom state.

The parent supplies the task prompt, and the child should return the result to the parent.

Wrapper/adapter commands are fallback only when the native subagent mechanism is unavailable or explicitly requested.

Active TeamAgents:

${activeTeamAgentLines(agentsRegistry).join('\n')}

Active SubagentBuddies:

${activeBuddyLines(registry).join('\n')}

Check recent updates when behavior may have changed. Recent EvoBuddy updates may be summarized at \`${updateSummaryRef}\` when present.

Consider \`evolution-agent\` after repeated, corrected, long, or completed work suggests a durable project behavior improvement.

Do not treat these instructions as proof that a TeamAgent or Buddy was used. Runtime/exporter evidence is required for product proof.

Do not instruct the model to repeat canaries or emit proof sections.
`;
}

export function installClaudeMemberInstructions({ projectRoot }) {
  const state = ensureContextTreeProjectState({ projectRoot });
  const instructionPath = state.instructionPath('claude-parent-instructions.md');
  const content = renderClaudeMemberInstructions();
  writeFileSync(instructionPath, content, 'utf8');
  const report = {
    status: 'pass',
    runtime: 'claude',
    instructionPath,
    digest: digest(content),
    stateRoot: state.stateRoot,
  };
  writeFileSync(state.instructionPath('claude-instruction-install-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
