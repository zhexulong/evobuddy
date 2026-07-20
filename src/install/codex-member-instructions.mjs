import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { ensureContextTreeProjectState } from '../core/context-tree-project-state.mjs';

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function codexAgentName(memberName) {
  return String(memberName ?? '').replaceAll('-', '_');
}

function activeTeamAgentLines(agentsRegistry) {
  const agents = agentsRegistry?.agents?.filter((agent) => (agent.visibility ?? 'active') === 'active') ?? [];
  if (agents.length === 0) {
    return [
      '- evolution-agent (Codex native agent: `evolution_agent`) - durable project behavior improvement proposals and stable mutation review for the TeamAgent substrate.',
      '- builder (Codex native agent: `builder`) - implementation-focused TeamAgent seat.',
      '- reviewer (Codex native agent: `reviewer`) - review-focused TeamAgent seat.',
    ];
  }
  return agents.map((agent) => `- ${agent.name} (Codex native agent: \`${codexAgentName(agent.name)}\`) - ${agent.profile?.description ?? 'active EvoBuddy TeamAgent.'}`);
}

function activeBuddyLines(registry) {
  const members = registry?.members?.filter((member) => (member.visibility ?? 'active') === 'active') ?? [];
  if (members.length === 0) {
    return [
      '- explore (Codex native agent: `explore`) - read-only codebase exploration.',
      '- librarian (Codex native agent: `librarian`) - read-only external/reference research.',
      '- sisyphus-junior (Codex native agent: `sisyphus_junior`) - bounded debugging, implementation, and issue-resolution work.',
    ];
  }
  return members.map((member) => `- ${member.name} (Codex native agent: \`${codexAgentName(member.name)}\`) - ${member.profile?.description ?? 'active EvoBuddy Buddy.'}`);
}

export function renderCodexMemberInstructions({ registry, agentsRegistry, updateSummaryRef = '.evobuddy/updates/recent.json' } = {}) {
  return `# EvoBuddy Actors

This project has EvoBuddy TeamAgents and SubagentBuddies available through Codex runtime surfaces.

Synced runtime definitions live at .codex/agents/<codex-agent-name>.toml. EvoBuddy names use hyphens, while Codex native agent names map those hyphens to underscores.

TeamAgents are visible team seats when the runtime supports that surface. SubagentBuddies remain focused delegate specialists. Surface visibility alone is not proof that Codex selected the TeamAgent or spawned the SubagentBuddy.

Use a TeamAgent when the task needs a durable team seat such as implementation, review, or evolution governance. Use a SubagentBuddy when a task clearly benefits from an independent specialist context. Keep the parent agent as the user-facing owner, and use the child result as input to the parent answer.

Apply \.evobuddy/team-policy.md before deciding whether to work alone or open visible TaskRoom state. Policy-driven TeamAgent fork/handoff means recording why the parent worked alone or created team seats, the current owner, fork lineage, pending handoffs, review-loop status, result return, and evolution handoff in the TaskRoom. There is no hidden mandatory orchestrator: the parent agent or a visible coordinator may apply policy, but coordination must remain visible in TaskRoom state.

Write a normal consequential task description for the fitting actor. The parent supplies the task prompt, and the actor should return the result to the parent rather than creating proof sections or repeated canaries.

When the native Codex surface is available, do not substitute repo-local \`invoke-buddy\` wrappers or other project-local Buddy CLI glue for that route.

Active TeamAgents:

${activeTeamAgentLines(agentsRegistry).join('\n')}

Active SubagentBuddies:

${activeBuddyLines(registry).join('\n')}

Check recent updates when behavior may have changed. Recent EvoBuddy updates may be summarized at \`${updateSummaryRef}\` when present.

Route to Codex native agent \`evolution_agent\` for EvoBuddy \`evolution-agent\` by default when repeated, corrected, hard-case, or completed work points to one durable project-behavior change for TeamAgents, Buddies, skills, routing, return contracts, or proof-boundary handling.

If an older compatibility registry still exposes \`evolution-buddy\`, treat it as legacy Buddy compatibility rather than current product authority.

This includes repeated release-proof confusion, shipping proof vs retained eval boundary correction, and routing/return-contract improvement that needs a durable fix rather than a one-off report.

Keep the task local when it is a docs-only rewrite without behavior change, proof report formatting only, a single ordinary specialist task, or a one-off recommendation without a repeated durable signal.

Do not treat these instructions as proof that an actor was used. Runtime/exporter evidence is required for product proof.

Do not instruct the model to repeat canaries, emit proof sections, or name adapter mechanisms when testing natural routing.
`;
}

export function installCodexMemberInstructions({ projectRoot }) {
  const state = ensureContextTreeProjectState({ projectRoot });
  const instructionPath = state.instructionPath('codex-parent-instructions.md');
  const content = renderCodexMemberInstructions();
  writeFileSync(instructionPath, content, 'utf8');
  const report = {
    status: 'pass',
    runtime: 'codex',
    instructionPath,
    digest: digest(content),
    stateRoot: state.stateRoot,
  }; 
  writeFileSync(state.instructionPath('codex-instruction-install-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
