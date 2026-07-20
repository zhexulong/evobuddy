# EvoBuddy Raft-Style Agent Team and OMO-Style Subagent Design

## 0. Design Philosophy

This design fixes the product split that earlier EvoBuddy designs blurred:

```text
Agent team / primary-agent group: follow Raft.
Subagent / specialist delegate layer: follow OMO.
Evolution / knowledge substrate: follow EvoBuddy's existing Trellis/GenericAgent-informed direction.
```

The design principle is:

```text
EvoBuddy is not one stronger parent prompt.
EvoBuddy is a team workspace for coding agents, with OMO-style specialists available inside that team, and an evolution layer that improves the team from real work.
```

### 0.1 What Raft Contributes

Raft is the primary reference for the agent-team layer. The important product ideas are:

- agents are visible teammates, not just tool calls;
- a teammate has identity, profile, status, workspace, and runtime session continuity;
- work happens in channels, threads, tasks, and shared visible context;
- teammates can be mentioned, assigned, claim tasks, hand work off, and review each other;
- messages and wake signals are communication boundaries, not hidden prompt rewrites;
- the team record is visible and inspectable by the user.

Therefore EvoBuddy's main product surface should be a **Raft-style agent team**, not a central OMO-style orchestrator.

### 0.2 What OMO Contributes

OMO is the primary reference for the subagent/specialist layer. The useful ideas are:

- `explore`-style codebase exploration;
- `librarian`-style external/reference research;
- `sisyphus-junior`-style bounded executor/debugger;
- `oracle`/`momus`-style reviewer/critic consultants;
- strong role prompts, tool restrictions, return discipline, and verification culture.

OMO's subagent definitions are valuable. OMO's fixed single-parent-orchestrator prompt is **not** the primary architecture for EvoBuddy.

### 0.3 What EvoBuddy Adds

EvoBuddy adds what Raft and OMO do not fully provide together:

- cross-runtime projection into OpenCode, Claude Code, and Codex;
- project-local agent and subagent definitions;
- durable knowledge/SOP/Buddy evolution from real runs;
- product-grade evidence for routing, invocation, handoff, and result return;
- Workbench/TUI management over team state, projections, updates, and proof.

## 1. Problem Statement

Earlier EvoBuddy language used `Buddy` for both:

1. a primary agent the user may choose as the main worker; and
2. a subagent/specialist that a primary agent delegates to.

That is wrong. OMO itself distinguishes primary agents such as Sisyphus/Hephaestus from subagents such as Librarian or Sisyphus-Junior. Raft goes further: agents are team members in a workspace, not merely a parent with helpers.

EvoBuddy therefore needs two first-class actor types:

```text
TeamAgent: visible team member / possible primary agent / task-room participant.
SubagentBuddy: OMO-style delegate specialist / callable helper / focused child worker.
```

They may both have runtime sessions, memory, and projection files, but they have different product semantics.

## 2. Core Product Model

### 2.1 TeamAgent

A `TeamAgent` is a Raft-style teammate. It can be selected by the user as a main agent, invited into a task room, assigned work, mentioned, and observed over time.

A TeamAgent definition should answer:

- Who is this teammate?
- What work does it normally claim?
- How does it communicate in a task thread?
- What is its authority to edit, review, or coordinate?
- What runtime/model/profile does it prefer?
- What workspace/session continuity does it keep?
- What should it not do?

It should **not** primarily answer:

- Which exact subagent names must it call?
- What fixed workflow must it always follow?
- What hidden orchestration policy should it impose on every task?

A TeamAgent is a team seat, not a capability-router schema.

### 2.2 SubagentBuddy

A `SubagentBuddy` is an OMO-style specialist delegate. It may be invoked by a TeamAgent, mentioned by the user, or selected by runtime-native subagent mechanisms.

A SubagentBuddy definition should answer:

- What focused job does this specialist perform?
- When is it useful?
- When should it not be used?
- Is it read-only or allowed to mutate code?
- What tools are allowed or denied?
- What should it return to the parent/team thread?
- Can it call further subagents, or must it remain leaf-only?

The subagent layer may borrow stronger prompt discipline from OMO because subagents are narrower and less likely to over-constrain the user's main conversation.

### 2.3 TaskRoom

A `TaskRoom` is the shared work container for a concrete task. It is the EvoBuddy analog of Raft channel/thread/task composition.

A TaskRoom owns:

- task title and objective;
- parent/user-visible thread;
- participating TeamAgents;
- participating SubagentBuddy runs or instances;
- artifacts: patches, review notes, test output, decisions, unresolved risks;
- mailbox/handoff messages;
- budget and stop condition;
- final summary and optional evolution handoff.

A TaskRoom is not a hidden workflow. It is the visible shared place where work happens.

### 2.4 Evolution Layer

Evolution happens after or at stable boundaries in real work. It should not replace live working context.

The evolution layer may propose changes to:

- TeamAgent definitions;
- SubagentBuddy definitions;
- Knowledge/SOP material;
- runtime skill projections derived from SOPs when needed;
- routing/activation examples;
- recent update summaries;
- split/merge/deactivate decisions when a role grows too large or too noisy.

Evolution is source-backed and reviewable. It must not silently rewrite the team.
In product terms, evolution is owned by an `evolution-agent`, not an
`evolution-buddy`: users need to be able to talk to it directly, give feedback
on proposed changes, ask why a change is safe, and ask it to revise a patch.
It is a Raft-style team participant that edits the team substrate carefully; it
is not a hidden subagent that one-shot rewrites definitions.

## 3. File and Definition Model

The durable product source should separate team agents from subagent buddies.

```text
.evobuddy/
  agents/
    <agent>/AGENT.md
  buddies/
    <buddy>/BUDDY.md
  knowledge/
    facts.md
    sops/<topic>.md
  updates/
    recent.json
  projections/
    ... generated runtime files and proof only ...
```

Preset product source mirrors this split:

```text
src/presets/agents/<agent>/AGENT.md
src/presets/buddies/<buddy>/BUDDY.md
src/presets/knowledge/...
src/presets/projection-templates/...
```

Projection output must not become source authority. OpenCode/Claude/Codex runtime files are generated from these sources.

### 3.1 Skill vs SOP

Skill is not equivalent to SOP, but Skill should not remain an independent
durable ontology in EvoBuddy.

The durable "how we do this" source lives in knowledge/SOP material:

```text
.evobuddy/knowledge/sops/<topic>.md
```

A Skill is a runtime-facing projection/package that may be generated from
knowledge/SOP plus Agent/Buddy references when a runtime benefits from a
discoverable, callable, progressively disclosed procedure. It is not source
authority.

Therefore:

- SOP/knowledge is the canonical reusable procedure or project convention.
- TeamAgents and SubagentBuddies reference SOP/knowledge directly.
- `.evobuddy/skills/` is not a durable product source root for V0.
- `SKILL.md` may be generated into runtime/projection output when Codex, Claude,
  OpenCode, or another runtime has a useful skill surface.
- A generated Skill must reference the SOP digest or source ref it came from and
  must not duplicate or supersede the canonical SOP.
- Not every SOP needs a generated Skill.

This preserves one knowledge substrate while still allowing skill-shaped runtime
activation when it is useful.

## 4. TeamAgent Definition Shape

`AGENT.md` should be human-readable and runtime-projectable. It should be closer to a Raft team profile than an OMO system prompt.

Recommended sections:

```markdown
---
name: builder
description: Implements scoped code changes, runs verification, and reports patch/test results in task threads.
kind: team-agent
---

# Builder

## Team Role
What this teammate is for.

## Best At
Task types this agent should normally claim.

## Working Style
How it works in a TaskRoom: progress updates, artifact posting, handoff behavior.

## Authority
What it can do without further confirmation, and what requires explicit user/team confirmation.

## Communication Contract
How it reports status, asks for review, returns completion, and handles blockers.

## Not For
Tasks this teammate should not claim.

## Knowledge References
Pointers to shared SOPs/knowledge. Do not inline everything. Runtime Skill surfaces may be generated from these refs, but are not durable source authority.
```

### 4.1 What `AGENT.md` Must Avoid

`AGENT.md` must not become an OMO-style all-purpose parent prompt. Avoid:

- `always explore`;
- `always use librarian`;
- `always delegate`;
- hard-coded subagent names as required steps;
- universal plan/critic/executor loops;
- hidden instructions that make the user unable to tell why work is happening.

Team behavior should emerge from visible task-room messages, assignments, mentions, and role profiles.

### 4.2 Initial TeamAgent Presets

The V0 preset team should stay small.

#### `builder`

Raft-style implementation teammate.

- Claims concrete implementation/fix tasks.
- Edits code when authorized by the active runtime/user context.
- Runs focused verification.
- Sends patch summary and test result to the task thread.
- Requests review when the task room has a reviewer or the user asks for one.

#### `reviewer`

Raft-style review teammate.

- Claims review tasks.
- Keeps review continuity across rounds.
- Reviews patches/artifacts from builder or user.
- Sends findings back to the task thread.
- Does not directly rewrite implementation unless explicitly assigned.

#### `coordinator` / `captain` as available, not mandatory

A coordination teammate can maintain task-room status, assignments, and final synthesis. It should be optional and not become the hidden center of every workflow.

This preserves the Raft-style team model: coordination is a role someone may claim, not a universal parent-agent requirement.

#### `evolution-agent`

Raft-style team participant for durable improvement.

- Reviews completed or checkpointed real work.
- Talks directly with the user or active team when feedback is needed.
- Proposes source-backed updates to TeamAgents, SubagentBuddies, knowledge/SOP material, or regenerated runtime Skill projections.
- Produces small, reviewable patches rather than wholesale rewrites.
- Classifies risk and keeps high-risk changes pending until explicitly
  accepted.
- Maintains recent update summaries so users and agents can see what changed.

## 5. SubagentBuddy Definition Shape

`BUDDY.md` should be OMO-style: narrower, stronger, and more operational than `AGENT.md`.

Recommended sections:

```markdown
---
name: librarian
description: Read-only external documentation and open-source reference researcher.
kind: subagent-buddy
---

# Librarian

## Role
Focused specialist identity.

## Use When
Concrete triggers and examples.

## Do Not Use When
Negative triggers.

## Tools and Authority
Allowed/denied tool classes and mutation boundary.

## Operating Rules
OMO-style discipline for this specific role.

## Return Contract
What to return to the parent/team thread.

## Knowledge References
Pointers to shared SOPs/knowledge. Runtime Skill surfaces may be generated from these refs, but are not durable source authority.
```

### 5.1 Initial SubagentBuddy Presets

The OMO-derived default subagent roster should be useful but not bloated.

#### `explore`

- Read-only codebase exploration.
- Finds relevant files, architecture boundaries, prior patterns, and local evidence.
- Returns concise findings and source refs.

#### `librarian`

- Read-only external documentation, upstream repository, API, and standards research.
- Prefers primary sources.
- Returns source-bounded facts and freshness caveats.

#### `sisyphus-junior`

- Bounded executor/debugger subagent.
- Handles focused implementation, test repair, or failure diagnosis when delegated.
- Verifies before returning.
- Should not become the user's default primary agent.

#### `oracle`

- Expensive high-reasoning review/architecture consultant.
- Available by explicit request or clear high-risk review need.
- Not active by default if it causes routing noise.

#### `momus`

- Plan/check critic.
- Useful for reviewing plans, invariants, and hidden assumptions.
- Not a default parent workflow.

## 6. Relationship Between TeamAgents and SubagentBuddies

The product should not encode a fixed dependency graph such as:

```text
builder -> must call explore -> must call librarian -> must call reviewer
```

Instead, relationship is established by visible workspace mechanics:

- user mentions an agent or buddy;
- a TeamAgent asks a SubagentBuddy for help;
- a task is assigned to a TeamAgent;
- a reviewer replies in the task thread;
- a wake/message asks an instance to check its mailbox;
- Workbench shows the team roster and recent activity.

Optional metadata may help search and projection, but it is not the user-facing contract.

### 6.1 Acceptable Lightweight Metadata

Small metadata is allowed when it helps runtime projection or search:

```text
kind: team-agent | subagent-buddy | skill
visibility: active | available | internal | archived
tags: implementation, review, research, evolution
runtimePreferences: optional
```

This metadata must not become a rigid routing ontology. The authoritative behavior remains the readable `AGENT.md` / `BUDDY.md` plus visible task-room interaction.

## 7. Runtime Projection

EvoBuddy must project both layers to OpenCode, Claude Code, and Codex.

### 7.1 TeamAgent Projection

TeamAgents should project to the closest runtime-native primary/agent surface available:

- OpenCode: agent definitions that can be selected or invoked as user-visible agents;
- Claude Code: agent/subagent or channel/plugin-compatible definitions where available;
- Codex: agent/skill/plugin surfaces that make the team profile visible and callable.

Projection must preserve:

- display name;
- description;
- team role;
- task claim style;
- authority boundary;
- communication contract;
- knowledge/SOP refs;
- generated provenance block/digest.

### 7.2 SubagentBuddy Projection

SubagentBuddies project to native subagent/specialist surfaces:

- OpenCode: `.opencode/agents/*.md` or equivalent;
- Claude Code: `.claude/agents/*.md` or equivalent;
- Codex: `.codex/agents/*.toml`, skill/plugin surface, or the closest native subagent surface.

Projection must preserve:

- role;
- triggers and anti-triggers;
- tool authority;
- operating rules;
- return contract;
- generated provenance block/digest.

### 7.3 No CLI Wrapper as Product Center

Wrapper CLI invocation may remain as compatibility/eval glue, but the product path must be runtime-native when the runtime supports native agents/subagents. Adapter-only evidence is not sufficient for native release claims.

## 8. TaskRoom / Mailbox / Wake Model

Raft's wake contract gives a useful boundary: a wake is a content-free attention signal; message bodies are pulled by the agent through the normal channel/message mechanism.

EvoBuddy should adopt the same principle:

```text
Wake/notification: tells an agent instance that work or a message exists.
Message/task room: contains the actual content and artifacts.
Runtime session: owns what the model actually sees and does.
Proof sidecars: record delivery, not replace the conversation.
```

This avoids pushing full task bodies through hidden plugin notifications and keeps user-visible work in the task room.

TaskRoom evidence should record:

- room id;
- participant agent/buddy ids;
- runtime session refs;
- message/handoff refs;
- artifact refs;
- wake/delivery attempts;
- returned-to-thread evidence;
- final status.

## 9. Evolution Semantics

Evolution is not the same as live task context.

During a task:

- TeamAgents and SubagentBuddies use their own runtime context and the task-room record.
- Reviewer/builder loops preserve live working state in their sessions.

After a task, or at explicit stable checkpoints:

- `evolution-agent` may inspect source-backed evidence;
- propose updates to `AGENT.md`, `BUDDY.md`, or knowledge/SOP files;
- produce recent update summaries;
- recommend split/deactivate/archive if definitions get too large or noisy.

### 9.1 Stable Mutation Contract

Evolution must be stable and surgical. The main failure to avoid is a one-shot
agent edit that deletes large parts of the team substrate or rewrites a working
definition beyond recognition.

`evolution-agent` must follow this mutation contract:

- Prefer minimal diffs over full-file rewrites.
- Preserve existing headings, examples, and source refs unless the proposal
  explicitly explains why they are obsolete.
- Add or narrow before deleting.
- Mark material as superseded before removing it when history matters.
- Do not delete active definitions as part of a low-risk change.
- Do not remove large sections, change authority boundaries, or change active
  roster status without high-risk review.
- Split a large definition by first adding referenced SOP/knowledge material,
  then replacing inline detail with pointers; do not drop content in the same
  step.
- Include a rollback note or previous digest for every durable apply.
- If the safe patch cannot be expressed as a small diff, leave a candidate
  proposal instead of applying.

This contract is product behavior, not just eval hygiene. It makes evolution
usable as a direct user-facing agent.

### 9.2 High-Risk Evolution

High-risk changes require explicit review before durable apply. High-risk includes:

- changing a TeamAgent's authority to edit, delete, or run destructive commands;
- making a coordinator/captain mandatory;
- changing default active team roster;
- changing `evolution-agent` itself;
- creating or activating a new primary TeamAgent;
- broadening a SubagentBuddy from read-only to mutation-capable;
- deleting or archiving active definitions;
- importing large unverified external instructions.

Low-risk examples:

- adding a source-backed SOP note;
- adding a negative example to reduce false routing;
- refining return-contract wording without changing authority;
- adding a recent update summary;
- adding a candidate definition under `_candidates/` without activating it.

## 10. Workbench/TUI Surface

Workbench should reflect the split clearly:

```text
Team Agents
  builder
  reviewer
  coordinator (available)
  evolution-agent

Subagent Buddies
  explore
  librarian
  sisyphus-junior
  oracle (available)
  momus (available)

Task Rooms
  active rooms, participants, handoffs, artifacts, status

Updates
  recent evolution summaries, pending candidates, applied changes
```

The TUI is not the primary work surface. The primary work surface remains the user's runtime agent. Workbench is for visibility, setup/import, projection status, update review, and proof inspection.

## 11. Behavior Evaluation

### 11.1 Team-Agent Natural Use

Example:

```text
User starts a task-room-style coding task.
Builder claims implementation.
Reviewer reviews the patch in a separate retained review session.
Builder receives findings and fixes.
Reviewer continues from the same review context and returns pass/fail.
```

Expected evidence:

- task room created or observed;
- builder and reviewer are TeamAgent participants;
- both have runtime session refs;
- review round 2 reuses reviewer continuity or references prior review context;
- handoff messages/artifacts are visible;
- final result returns to the user/thread.

Failure signals:

- reviewer is recreated from scratch without access to previous review state;
- all work happens inside one hidden parent prompt;
- proof relies on adapter-only CLI invocation while claiming native team behavior;
- user cannot tell which participant did what.

### 11.2 OMO-Style Subagent Natural Use

Example:

```text
A TeamAgent needs current external API behavior.
It invokes or mentions librarian.
Librarian performs read-only source research and returns concise cited findings.
```

Expected evidence:

- librarian projected as native subagent/specialist;
- observed runtime invocation or natural route;
- read-only boundary preserved;
- result returns to parent/team thread;
- no fixed OMO parent prompt is required for the route to pass.

Failure signals:

- librarian mutates files;
- route only works because the benchmark explicitly names the mechanism;
- result never returns to the parent/team thread;
- runtime proof is retained/fixture-only but claimed as product-observed.

### 11.3 Evolution After Work

Example:

```text
After repeated review-loop failures, evolution-agent proposes a source-backed SOP update and a reviewer return-contract refinement; any Skill output is regenerated projection, not source.
```

Expected evidence:

- proposal is tied to real task-room/run evidence;
- update target is correct: Agent, Buddy, or Knowledge/SOP; generated Skill output is projection-only;
- high-risk changes are not auto-applied;
- mutation follows the Stable Mutation Contract;
- update appears in recent summary;
- projections can be regenerated and doctor detects drift.

Failure signals:

- user feedback is directly written as durable memory without review;
- evolution changes live context instead of durable source files;
- generated projection becomes source of truth;
- `_candidates` becomes active without explicit activation evidence.

## 12. Release Gate Implications

A release-grade EvoBuddy claim now needs three families of proof.

### 12.1 Agent Team Proof

At least one real task-room loop must prove:

```text
TeamAgent A works -> TeamAgent B reviews -> A fixes -> B continues -> result returns.
```

This must be runtime/exporter/session-bound, not fixture-only.

### 12.2 OMO-Style Subagent Proof

At least one real subagent route per required runtime must prove:

```text
TeamAgent or user naturally uses an OMO-style SubagentBuddy -> result returns.
```

Default proof targets should include `explore` or `librarian`, because they have clear read-only boundaries.

### 12.3 Evolution Proof

At least one real post-task evolution loop must prove:

```text
real work evidence -> evolution-agent proposal -> durable Agent/Buddy/SOP apply or reviewed candidate -> projection update, including any generated Skill surface -> next use sees applied version.
```

Blocked is acceptable during intermediate development, but not for the final release gate that claims this design is implemented.

## 13. Compatibility With Existing Designs

This design updates earlier EvoBuddy direction as follows:

- `Buddy` no longer covers every actor. Product copy may still say EvoBuddy, but implementation must distinguish TeamAgent from SubagentBuddy.
- OMO replacement is reframed: EvoBuddy does not replace OMO by copying Sisyphus as a parent prompt; it replaces OMO by combining Raft-style team workspace with OMO-style specialists and EvoBuddy evolution.
- Subagent baseline remains valid for SubagentBuddy projection.
- Buddy/Skill co-evolution is reframed: durable update targets are TeamAgent, SubagentBuddy, and Knowledge/SOP; Skill is generated projection when needed.
- Evolution is a TeamAgent, not a SubagentBuddy, because users need to give
  direct feedback on durable team changes.
- Natural-use benchmark must add agent-team scenarios, not only specialist-subagent scenarios.
- Capability tags are allowed as metadata, but not as the primary product contract.

## 14. Open Questions for Implementation Planning

These should be settled in the implementation plan, not hidden in code:

1. Which runtime currently has the strongest user-selectable TeamAgent surface for V0?
2. How should Codex project TeamAgents differently from SubagentBuddies?
3. Should `coordinator` ship as available-only until a real task-room benchmark proves value?
4. How much of TaskRoom is filesystem state versus runtime session/thread observation in V0?
5. Which release benchmark family should prove builder-reviewer continuity first?

## 15. Summary

The design center is:

```text
Raft-style visible agent team
  + OMO-style focused subagents
  + EvoBuddy durable evolution
  + cross-runtime native projection
  + product-grade proof
```

This gives EvoBuddy a clearer product identity than either OMO or a pure memory/skill system:

- OMO gives strong specialists and parent discipline, but not a true agent-team workspace.
- Raft gives agent-team product semantics, but not EvoBuddy's cross-runtime local projection and evolution layer.
- EvoBuddy should combine them: team agents for visible collaborative work, subagent buddies for focused delegation, and evolution-agent for durable improvement after real tasks.
