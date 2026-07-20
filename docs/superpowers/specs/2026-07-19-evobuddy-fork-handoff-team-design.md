# EvoBuddy Fork/Handoff Team Design

## 0. Design Position

This design extends `2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`.

The earlier design correctly split:

```text
TeamAgent: visible teammate / possible primary agent / TaskRoom participant.
SubagentBuddy: OMO-style focused specialist delegated by a TeamAgent.
TaskRoom: visible shared work container.
EvolutionAgent: user-facing team participant for durable improvement.
```

This design adds the missing operational distinction:

```text
Fork creates another live agent instance with its own runtime context.
Handoff transfers work, state, or result between agent instances.
```

Those are not the same product action. Treating everything as a handoff loses the value of parallel long-lived agent contexts. Treating everything as a fork creates unnecessary copies and coordination overhead.

EvoBuddy's team model should therefore be:

```text
visible TeamAgents + cheap runtime forks + explicit handoffs + TaskRoom continuity + optional coordination policy
```

not:

```text
one parent prompt orchestrating a fixed workflow
```

## 1. Reference Interpretation

### 1.1 Raft / WorkBuddy Direction

The useful product idea from Raft-style and WorkBuddy-style systems is not merely "agents with names". It is that agents are visible collaborators with task state, identity, and ongoing workspaces.

For EvoBuddy this means:

- users can see which agent instance is doing what;
- an implementation agent and a review agent can both remain alive across rounds;
- review is not just a one-shot prompt; it can retain its own thread context;
- task state is inspectable in a team surface instead of hidden in parent-agent prose.

### 1.2 Trellis Direction

Trellis is useful for staged task artifacts and explicit task context. It is less useful as the final team model because Trellis emphasizes workflow state and file manifests more than live agent teammates.

EvoBuddy should borrow:

- task artifacts;
- context manifests;
- explicit phase/status records;
- "files outlive compaction" discipline.

EvoBuddy should not reduce the team to a static workflow document.

### 1.3 GenericAgent Direction

GenericAgent's plan/review/verify SOPs show why independent review matters. A reviewer that shares all parent-agent context and incentives is weaker than a reviewer with an independent execution context and a review-only role.

EvoBuddy should borrow:

- independent review discipline;
- verification loops;
- memory/evolution only after verified work;
- small durable updates.

EvoBuddy should not copy a mandatory global plan-mode workflow as the product center.

### 1.4 A2A Direction

A2A is useful as a vocabulary and future interoperability target: Task, Message, Artifact, status update, push notification, and opaque agent state.

For EvoBuddy V0, A2A should inform the shape of TaskRoom records, not require a full network protocol implementation.

## 2. Core Terms

### 2.1 Agent Instance

An `AgentInstance` is a live or previously live runtime participant.

It has:

- `instanceId`;
- `actorName`, such as `builder` or `reviewer`;
- `actorKind`, usually `team-agent` or `subagent-buddy`;
- `runtime`, such as `opencode`, `claude`, or `codex`;
- `runtimeSessionRef` when observed;
- lifecycle: `created`, `active`, `waiting`, `returned`, `destroyed`, or `expired`;
- optional parent/fork source refs.

An instance is not the same thing as an actor definition. `reviewer/AGENT.md` defines the role. A `reviewer` instance is a concrete runtime thread/process/session that can retain context.

### 2.2 Fork

A `Fork` creates a new AgentInstance from an existing task/thread/context boundary.

Fork is appropriate when EvoBuddy wants independent thinking, parallel work, or continuity that should not pollute the current parent context.

Examples:

- fork `reviewer` before a design doc is finalized, so review can inspect the design independently;
- fork `reviewer` after builder produces a patch, then keep that reviewer alive for round 2;
- fork `explore` to map code while builder keeps implementing;
- fork `evolution-agent` after the TaskRoom completes, so durable learning happens outside the active task discussion.

A fork carries enough starting context for the assigned work, but it is not required to copy the entire parent transcript. The fidelity policy is runtime-specific:

- `native-context-fork`: runtime creates child from parent/session context;
- `selected-material-fork`: EvoBuddy supplies selected TaskRoom messages/artifacts/context refs;
- `fresh-assignment-fork`: new instance gets only assignment plus explicit source refs;
- `searchable-history-fork`: instance may search session corpus/history under explicit refs.

Fork is not inherently high risk. It is a normal team operation. Its cost is token/runtime budget, not authority risk. Risk comes from what the fork is allowed to do, not from the fact that it exists.

A product fork must have a durable `ForkRecord`. The record is the bridge between visible TaskRoom state and runtime evidence. Minimal fields:

- `forkId`;
- `taskRoomId`;
- `parentInstanceId`;
- `childInstanceId`;
- `actorName`;
- `actorKind`;
- `runtime`;
- `forkKind`, one of the fidelity policies above;
- `sourceContextRefs`;
- `assignmentMessageRef`;
- `createdAt`;
- `destroyPolicy`;
- `authorityPolicy`;
- `evidenceRefs`, including runtime/exporter/session refs when observed.

Without a `ForkRecord`, a runtime transcript can still be useful diagnostic evidence, but it cannot by itself prove that EvoBuddy created or tracked a product fork.

### 2.3 Handoff

A `Handoff` transfers work, evidence, or ownership from one instance to another.

Handoff is appropriate when the receiving instance should act on a concrete result, not independently reconstruct the full task.

Examples:

- builder hands patch summary and test output to reviewer;
- reviewer hands blocking findings back to builder;
- explorer hands code map to builder;
- parent hands a completed TaskRoom evidence bundle to evolution-agent;
- evolution-agent hands a proposed durable patch back to the user/team for acceptance.

A handoff should contain:

- sender and receiver instance ids;
- TaskRoom id;
- message id;
- artifact refs;
- concise body;
- expected next action;
- return destination.

Handoff does not create a new runtime context by itself. It may target an existing instance or trigger a fork if no suitable instance exists. When a handoff triggers a fork, EvoBuddy must record both actions: a `ForkRecord` for the new instance and a `HandoffRecord` for the transferred work. The handoff record must reference the fork; it must not be treated as fork proof by itself.

### 2.4 Wake

A `Wake` is a content-free attention signal.

It tells an instance that a TaskRoom message exists. It must not carry the task body, patch, review text, or artifact content. The content lives in TaskRoom messages/artifacts and is pulled or supplied through the runtime's normal visible channel.

### 2.5 Destroy / Expire

Forked instances can be disposable. EvoBuddy should support destroying or expiring instances after they return or go idle.

This is important because the team is "copy yourself when useful", not "keep every agent alive forever".

An instance may be destroyed when:

- its assigned task is complete;
- its result has been handed off and acknowledged;
- the user cancels the TaskRoom;
- a budget/idle policy expires it;
- a newer fork supersedes it.

Destroying an instance does not delete TaskRoom records or durable evidence. It only marks live participation closed.

Destroy/expire also does not require the runtime to physically kill or delete the underlying session. In V0 it is enough to mark the EvoBuddy `AgentInstance` lifecycle as `destroyed` or `expired`, stop routing new handoffs to it, and keep its TaskRoom records available for inspection and future evolution.

## 3. Orchestrator vs Team Policy

### 3.1 No Mandatory Hidden Orchestrator

EvoBuddy should not require a hidden OMO-style orchestrator prompt that dictates every task.

The parent agent remains the user's visible main surface unless the user explicitly chooses another TeamAgent as primary. Coordination can be performed by:

- the current parent agent following installed EvoBuddy instructions;
- a visible `coordinator` TeamAgent;
- a runtime-native team feature if the runtime provides one;
- user commands in Workbench/TUI.

The product rule is: coordination must be visible as TaskRoom state, not hidden as uninspectable prompt choreography.

### 3.2 User-Configurable Team Policy

Fork/handoff behavior should be driven by project/user-configurable policy.

Default policy should be low-friction. Forking a reviewer or explorer is not a dangerous action by itself. The policy should manage cost, timing, and authority, not treat fork as a permission boundary.

Policy evaluation has two layers.

Hard constraints are not preferences and cannot be overridden by user/project policy:

- runtime capability and exporter/proof availability;
- actor authority policy;
- hard budget limits;
- destructive-action confirmation requirements;
- release proof requirements.

Within those hard constraints, preference precedence should be explicit:

```text
explicit user request
> project `.evobuddy/team-policy.md`
> generated structured policy/index, if present
> built-in default
```

The parent agent, coordinator, or Workbench may apply this policy, but they should not invent a conflicting hidden workflow when a higher-precedence source is present. A user request can make forking more aggressive or more conservative, but it cannot turn unsupported runtime behavior into product-observed proof.

Example policy concepts:

```yaml
teamPolicy:
  defaultMode: auto-light
  forkBudget:
    maxActiveInstances: 4
    maxReviewRounds: 3
  autoFork:
    designReview: true
    implementationReview: true
    codeReview: true
    explorationForLargeChanges: true
    evolutionAfterCompletion: true
  askBefore:
    destructiveActions: true
    highCostParallelism: true
    externalNetworkResearch: project-default
  destroy:
    afterReturn: true
    idleMinutes: 30
```

This policy is not an orchestrator script. It is a declarative preference layer that the parent agent, coordinator, or Workbench can apply after hard constraints are checked.

### 3.3 Default Policy

The default should not be "be cautious and avoid forks". The default should be:

```text
Use cheap TeamAgent forks when they make work clearer, more independent, or more reviewable.
Keep authority boundaries strict. Keep costs visible. Destroy idle instances.
```

Default suggested behavior:

- For design docs: fork reviewer before finalizing the design when the design affects product architecture, proof gates, runtime boundaries, or persistent state.
- For implementation plans: fork reviewer before execution when the plan changes release gates, durable schema, projection behavior, or runtime evidence semantics.
- For implementation tasks: use builder + reviewer when there is a nontrivial code change or release gate.
- For small edits: parent may work alone under `auto-light`, but this is a cost/benefit default, not a risk restriction. User or project policy may still fork for small tasks.
- For completed tasks with repeated correction/eval evidence: fork or hand off to evolution-agent.

The user can make this more aggressive or more conservative.

## 4. Fork vs Handoff Decision Rules

### 4.1 Prefer Fork When

Use fork when the receiver benefits from an independent context or long-lived continuity.

Signals:

- independent review is valuable;
- parallel exploration avoids bloating parent context;
- the receiver should remember previous round state;
- the task may loop across multiple rounds;
- the current parent context is noisy or biased;
- the receiver should own a subproblem for a while.

Examples:

```text
Design draft -> fork reviewer -> review returns findings.
Patch produced -> fork reviewer -> reviewer stays alive for follow-up review.
Large codebase unknown -> fork explore -> return map to builder.
```

### 4.2 Prefer Handoff When

Use handoff when the receiver only needs a concrete artifact or next action.

Signals:

- receiver already exists and should continue;
- artifact is small and sufficient;
- ownership is changing rather than parallelizing;
- the next action is clear;
- no independent long-lived thread is needed.

Examples:

```text
Reviewer findings -> handoff to existing builder.
Builder fix summary -> handoff to existing reviewer.
TaskRoom final evidence -> handoff to evolution-agent.
```

### 4.3 Fork Then Handoff

The common team loop is both:

```text
parent -> fork builder
parent -> fork reviewer
builder -> handoff patch to reviewer
reviewer -> handoff findings to builder
builder -> handoff fix to reviewer
reviewer -> handoff final verdict to parent
parent -> handoff completed evidence to evolution-agent
```

This is the core EvoBuddy task-team pattern.

## 5. Product Flow Examples

### 5.1 Design Review Before Writing the Design

The user asks for a design doc.

Flow:

1. Parent opens TaskRoom.
2. Parent or coordinator forks `designer` if configured, or parent acts as designer.
3. Parent forks `reviewer` early with the problem statement, constraints, and expected design boundary.
4. Designer drafts the design.
5. Designer hands draft artifact to reviewer.
6. Reviewer returns findings.
7. Designer revises.
8. Parent returns final design and notes review status.

The key point is that the reviewer can exist before the design is finished. It can preserve assumptions and challenge drift rather than only react at the end.

V0 should not ship `designer` as a default active TeamAgent. Design drafting can be done by the parent or `builder`; `designer` remains a project-created or evolution-created candidate until real usage proves it deserves an active role. The default design-team value is the early reviewer fork, not a larger preset roster.

### 5.2 Implementation + Review Loop

The user asks for a code change.

Flow:

1. Parent opens TaskRoom.
2. Fork `builder` for implementation.
3. Fork `reviewer` for review continuity.
4. Builder returns patch/test artifact.
5. Handoff to reviewer.
6. Reviewer returns blocking findings or pass.
7. If findings exist, handoff to builder.
8. Builder fixes and hands back.
9. Reviewer reviews with continuity from round 1.
10. Parent returns final result to user.

The review instance should retain its prior findings and not behave like a stateless one-shot reviewer.

### 5.3 Explore + Build

The user asks for a change in unfamiliar code.

Flow:

1. Parent forks `explore` or a TeamAgent explorer if configured.
2. Explore maps files, ownership, risks, and likely edit points.
3. Handoff map to builder.
4. Builder uses the map without consuming the entire exploration trace in parent context.

This is one of the main context-saving benefits of forked teams.

### 5.4 Evolution After Completion

After a task completes, evolution should usually be a handoff, not inline mutation.

Flow:

1. Parent or coordinator hands completed TaskRoom evidence to `evolution-agent`.
2. Evolution-agent decides whether the evidence warrants:
   - SOP update;
   - AGENT.md update;
   - BUDDY.md update;
   - new candidate actor;
   - skill projection adjustment;
   - no durable change.
3. Low-risk changes may be applied under project policy.
4. High-risk changes remain pending review.
5. Recent update summary is written.

## 6. Runtime Semantics

### 6.1 OpenCode

OpenCode is the first product target because it currently gives the strongest session/exporter evidence.

OpenCode V0 should prove:

- runtime-native TeamAgent/Buddy projections are current;
- forked instances have observed parent/child or participant session refs;
- handoffs are visible in TaskRoom messages/artifacts;
- reviewer continuity is preserved across at least two rounds;
- result returns to parent/user;
- evolution handoff is source-backed.

### 6.2 Claude Code

Claude should follow the same product semantics using the closest available native agent/subagent/session surface.

If Claude can project definitions but cannot yet prove observed fork/result-return, release gates should pass projection and block product-observed fork loop proof honestly.

### 6.3 Codex

Codex should not be treated as lacking a surface. It has `.codex/agents/*.toml` projection and related runtime/subagent vocabulary, but current evidence must distinguish:

- surface current;
- TeamAgent selected/active evidence;
- SubagentBuddy native child spawn evidence;
- result-return evidence.

Codex can pass surface-current gates while fork/result-return remains blocked until observed runtime evidence exists.

## 7. Durable State Model

This design should extend `.evobuddy` without creating a large new ontology.

Preset source authority remains in product source:

```text
src/presets/agents/<agent>/AGENT.md
src/presets/buddies/<buddy>/BUDDY.md
src/presets/knowledge/sops/<topic>.md
```

Project/user source authority lives under `.evobuddy`:

```text
.evobuddy/agents/<agent>/AGENT.md
.evobuddy/buddies/<buddy>/BUDDY.md
.evobuddy/knowledge/facts.md
.evobuddy/knowledge/sops/<topic>.md
```

Generated runtime projections are not source authority.

Task/team state may live under:

```text
.evobuddy/taskrooms/<taskroom-id>/room.json
.evobuddy/taskrooms/<taskroom-id>/instances.jsonl
.evobuddy/taskrooms/<taskroom-id>/messages.jsonl
.evobuddy/taskrooms/<taskroom-id>/handoffs.jsonl
.evobuddy/taskrooms/<taskroom-id>/wakes.jsonl
.evobuddy/taskrooms/<taskroom-id>/artifacts/
```

Policy source may live under:

```text
.evobuddy/team-policy.md
```

or a structured companion if needed:

```text
.evobuddy/team-policy.json
```

The human-readable policy is the user-editable source. JSON is a generated parsed index for deterministic product code. It must include at least `sourceRef`, `sourceDigest`, `generatedAt`, `parserVersion`, and normalized policy fields. Runtime code may apply the JSON only when its `sourceDigest` matches the Markdown source. User-authored JSON is not policy authority for V0.

## 8. Workbench/TUI Requirements

Workbench should make fork/handoff visible.

Minimum surfaces:

- active TaskRooms;
- active/returned/destroyed instances;
- who forked from whom;
- current owner;
- pending handoffs;
- last message per instance;
- review loop status;
- final result return;
- evolution handoff and recent update summary;
- active team policy and selected mode;
- fork budget and active instance count;
- why an instance was forked or why the parent worked alone.

The TUI should not only show static Buddy definitions. It should show the team actually working.

## 9. Evidence and Release Gates

### 9.1 Product Proof Requirements

A product-observed fork/handoff loop pass requires:

- current runtime projections for involved actors;
- observed runtime session/participant refs for forked instances;
- `ForkRecord` closure for every claimed fork;
- TaskRoom record with participant ids;
- handoff messages and artifact digests;
- reviewer continuity across at least two review turns when review loop is claimed;
- parent/user result return;
- exporter/session digest closure where available;
- no adapter-only or handwritten proof roots counted as product-observed pass.

Release reports should expose these gates separately:

- `projectionCurrent.status`;
- `forkObserved.status`;
- `handoffObserved.status`;
- `continuityObserved.status`;
- `resultReturn.status`;
- `evolutionHandoff.status`.

A pass requires all applicable gates to pass. A blocked fork gate should not hide a passing projection gate, and a passing fork gate should not imply handoff or continuity closure.

### 9.2 Negative Controls

The eval must block if:

- a single parent transcript roleplays both builder and reviewer;
- reviewer round 2 has no continuity link to round 1;
- handoff content is hidden only in prompt text and not recorded as TaskRoom message/artifact;
- a handoff-triggered fork lacks either the `ForkRecord` or the linked `HandoffRecord`;
- wake carries content;
- static projection is counted as fork proof;
- adapter/CLI wrapper output is counted as runtime-native fork proof;
- evolution-agent applies high-risk changes automatically.

### 9.3 Minimal Live Eval

The first release-grade live eval should be OpenCode-first:

```text
natural user task
-> TaskRoom opened
-> builder fork observed
-> reviewer fork observed
-> builder patch artifact
-> handoff to reviewer
-> reviewer findings
-> handoff to builder
-> builder fix
-> handoff to same reviewer instance
-> reviewer final pass with continuity
-> parent result return
-> evolution-agent handoff
```

The report may honestly say Claude/Codex fork-loop product proof is blocked while projection parity passes.

The natural-use input for this eval must be mechanism-clean. It must not name `fork`, `TaskRoom`, `builder`, `reviewer`, `spawn`, `agent team`, adapter commands, proof fields, or runtime mechanics unless the eval arm is explicitly labeled as an explicit-control scenario. A mechanism-named prompt can be useful as a control, but it must not count as natural fork/handoff product proof.

## 10. Design Decisions

### Decision 1: Fork is normal, not exceptional

Forking a reviewer or explorer is a cheap team action. It should be constrained by budget and authority, not treated as inherently high risk.

### Decision 2: Handoff is explicit state transfer

Handoff is how work moves between instances. It should be recorded and visible.

### Decision 3: Orchestration is policy, not one hidden boss

The user may configure team policy. The parent agent or coordinator applies it, but it should not become an opaque mandatory orchestrator prompt.

### Decision 4: Coordinator is optional and visible

`coordinator` may be useful for complex TaskRooms, but it should be an available TeamAgent, not the universal center of every task.

### Decision 5: Evolution is a post-task team participant

Evolution-agent receives evidence and proposes stable durable changes. It does not replace active builder/reviewer work.

## 11. Open Questions

1. Should `.evobuddy/team-policy.md` be fully human-readable with generated JSON, or should the JSON be authoritative for V0?
2. How aggressive should the default `autoFork` policy be for small tasks in `auto-light`, given that users can override it per project?
3. Which runtime should be second after OpenCode for product-observed fork-loop proof: Claude or Codex?
4. Should destroyed instances remain searchable in Workbench history by default, or only through TaskRoom records?

## 12. Implementation Implication

The next implementation plan should target **Realtime Fork/Handoff TaskRoom MVP**, not another static roster/projection layer.

It should implement:

- AgentInstance model;
- ForkRecord model;
- HandoffRecord refinement;
- policy precedence and parser/index behavior;
- user-configurable team policy;
- OpenCode producer for builder/reviewer fork loop;
- Workbench/TUI active team view;
- release eval with separate projection, fork, handoff, continuity, result-return, and evolution-handoff gates;
- negative controls for static projection, missing ForkRecord closure, parent-roleplay, adapter-only proof, wake-content leakage, and missing reviewer continuity.
