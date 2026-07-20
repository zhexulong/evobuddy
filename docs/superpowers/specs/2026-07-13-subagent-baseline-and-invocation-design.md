# Subagent Baseline and Invocation Design

## 0. Conclusion

Context Tree should stop modeling subagent context as `member-m[0]` plus `member-m[1]` rendered into every child prompt.

The corrected model is:

```text
subagent baseline:
  stable member identity, role memory, responsibilities, standards, routing semantics
  delivered by runtime subagent definition / projection

invocation prompt:
  dynamic task context supplied by the parent agent at call time
  delivered by the normal parent -> subagent prompt/task mechanism

Context Tree evidence:
  records which baseline was installed, which invocation prompt/result was observed,
  and whether delivery was native, wrapper-mediated, or only intended
```

`member-m[1]` should not remain a core product abstraction. It duplicates the parent agent's task prompt responsibility and makes Context Tree appear to own dynamic task context that should belong to the parent agent.

The durable Context Tree contribution is **subagent provisioning**, not Magic Context-style session context management:

```text
Dream / curator maintains role memory
  -> Context Tree compiles a subagent baseline
  -> runtime projection writes the baseline into the subagent definition
  -> parent agent supplies dynamic task prompt normally
  -> Context Tree records baseline + invocation evidence
```

The product center is therefore:

```text
confirmed Buddy/member profile + role memory
  -> runtime-native subagent definition baseline
  -> parent agent naturally calls that subagent for a task
  -> Context Tree observes/records what happened when runtime evidence is available
```

Wrapper-mediated invocation remains useful for runtimes that do not expose enough native hooks, but it is a compatibility/evidence path. It must not become the product story that Context Tree "runs" the Buddy by forcing every call through a CLI-shaped adapter.

## 1. Background

The earlier lifecycle design borrowed Magic Context terminology and used `member-m[0]` and `member-m[1]` as prompt-rendered sections. That was useful for proving material visibility in a hermetic evaluation, but it is not the right long-term product model for Context Tree.

Magic Context is a **session context compiler**. It owns the harness message transform and injects stable memory directly into `m[0]` while placing recent deltas in `m[1]`. It can do this because OpenCode/Pi expose deep runtime hooks such as message transforms, system prompt transforms, tool registry mutation, and background child-session execution.

Context Tree is different. It serves reusable subagents / members / Buddies. The stable role memory should be part of the subagent definition itself, not a repeated section in every task prompt. The dynamic per-call request should remain the parent agent's prompt to the subagent.

## 2. Correct Ownership Model

### 2.0 Hard Constraint: No Audit-Shaped Agent Output

Context Tree must not require an agent, subagent, Buddy, member, reviewer, or planner to output any special content, section, schema, phrase, proof canary, markdown structure, JSON shape, or natural-language format **solely** for review, provenance, audit, evidence recording, or proof convenience.

This constraint applies to both product behavior and implementation plans.

Allowed:

```text
host-side sidecars that record evidence
runtime/proxy/provider observations
machine-parser prompts where host code directly parses the result
test-only canaries inside explicitly scoped tests or fixtures
task-natural output instructions requested by the parent/user
```

Not allowed:

```text
reviewer/Buddy/member output templates whose purpose is auditability
forcing final answers to repeat proof canaries in normal product paths
requiring Markdown/natural-language/JSON solely so provenance is easier to inspect
making agent self-report a substitute for runtime delivery/result evidence
```

The ownership rule is:

```text
Agent output serves the task and parent agent.
Sidecars and runtime observations serve provenance.
```

If a future design needs structured output, it must name the host parser or product consumer that requires that structure. Otherwise the structure is presumed to violate this constraint.

### 2.1 Context Tree Owns Subagent Baseline

Context Tree owns the stable identity and memory that make a subagent reusable:

```text
Subagent baseline:
  member name
  role
  routing description
  responsibilities
  standards
  active role memory content
  negative activation hints
  baseline digest
  source refs / memory refs for audit sidecars
```

This baseline should be compiled by Context Tree and written into runtime-native subagent definition files.

Target runtime projection examples:

```text
OpenCode: agents/<member>.md
Claude Code: .claude/agents/<member>.md
Codex: .codex/agents/<member>.toml
```

The baseline is analogous to Magic Context's directly visible memory, but the delivery surface is different:

```text
Magic Context stable memory -> injected into primary session m[0]
Context Tree role memory -> written into subagent definition baseline
```

### 2.2 Parent Agent Owns Dynamic Task Context

The parent agent owns the dynamic content of a specific task:

```text
Dynamic invocation context:
  what to do now
  why this subagent is being called now
  current target files / refs
  specific constraints from the user
  desired answer shape if the task naturally requires it
  return-to-parent expectation
```

Context Tree should not introduce `member-m[1]` as a parallel owner of that information. If a parent agent calls a subagent, the prompt it sends is already the dynamic invocation context.

Context Tree may record this prompt, digest it, and bind it to proof artifacts. It should not pretend to author or own it unless the parent explicitly calls a Context Tree wrapper/tool that generates the subagent invocation.

### 2.3 Runtime Evidence Owns Proof

Evidence records what happened; it must not drive agent output format or role behavior.

Context Tree should record:

```text
baseline delivery:
  definition path
  baseline digest
  role memory refs and content digests
  projection/install report

invocation delivery:
  parent session id
  child session id
  parent-child relation
  observed prompt digest if available
  task/ref metadata if parent supplied it through Context Tree

result return:
  parent-observed result
  runtime/tool transcript refs
```

It should not ask the subagent to output audit sections or proof canaries as a normal product requirement.

### 2.4 Parent Agent Is the First Product Surface

The user should experience Buddies as normal subagents available to the parent agent, not as a separate Context Tree console that must be used for ordinary work.

Preferred product flow:

```text
Context Tree syncs baseline definitions
parent agent sees/uses runtime-native subagent definitions
parent agent decides whether to call a Buddy
runtime dispatches the subagent
Context Tree sidecars/exporters observe definition, invocation, and result evidence
```

Fallback product flow:

```text
parent agent calls a Context Tree wrapper/tool
wrapper checks baseline state and dispatches through the strongest available runtime path
wrapper records delivery/result evidence
```

The fallback flow can be product-grade when it is parent-observed and digest-bound, but product copy must label it as wrapper-mediated. It must not be called runtime-native subagent execution unless the runtime child/subagent boundary is actually observed.

### 2.5 Evidence Producers Are Host/Runtime Components

Any proof artifact required by eval must come from one of these sources:

```text
runtime exporter / observer
Context Tree sidecar around a wrapper/tool call
host parser for a machine-parsed maintenance turn
test-only fixture in explicitly non-product evals
```

The following are not product proof sources:

```text
agent prose saying it called a Buddy
subagent final answer repeating a canary
handwritten JSON standing in for runtime evidence
direct shell output not observed by the parent runtime
projection files without an invocation/result observation
```

This keeps evidence generation out of the agent's task answer. If Context Tree needs structured evidence, the host/runtime sidecar must capture or parse it.

## 3. Updated Product Shape

### 3.1 Baseline Sync

Context Tree should provide a baseline sync/install operation:

```text
ctree subagents sync
ctree members project
ctree buddies project
```

The exact command name can be decided later. The product behavior is:

```text
read confirmed member profile
read active role memory
compile subagent baseline
write runtime projection / subagent definition
write baseline install report
```

The generated runtime definition must contain materialized role memory content, not only refs.

Current `member-runtime-projection.mjs` only lists `roleMemoryRefs`. That is insufficient for the corrected design. Refs can remain for traceability, but the subagent must see the actual baseline content in its definition.

### 3.2 Invocation

There are two valid invocation modes.

#### Native Parent Invocation

The parent agent calls the runtime-native subagent/task directly.

```text
parent agent selects subagent
parent agent writes task prompt
runtime dispatches child session
Context Tree observes child session later if runtime evidence is available
```

In this mode Context Tree does not guarantee dynamic prompt content. It only guarantees baseline provisioning if the subagent definition was synced.

#### Context Tree Wrapper Invocation

The parent agent calls a Context Tree-owned wrapper/tool.

```text
parent calls Context Tree wrapper/tool with member + task + optional refs
wrapper checks or syncs baseline
wrapper dispatches runtime subagent or prepares runtime-native prompt
wrapper records prompt/result evidence
```

This mode can guarantee more evidence because Context Tree owns the invocation surface. It still should not revive `member-m[1]` as a separate context abstraction. The wrapper's dynamic input is just the invocation prompt/request.

### 3.3 Maintenance / Dream / Evolution Invocation

Maintenance work should also use the same ownership model.

Correct flow:

```text
parent/user/runtime trigger asks for Buddy refresh/discovery/evolution
parent agent or scheduler starts a dedicated maintenance Buddy/subagent turn
maintenance Buddy inspects eligible history/artifacts
host parser extracts candidate baseline/memory/definition changes when needed
Context Tree records proposal, source refs, and approval/apply evidence
baseline sync recompiles affected runtime definitions
```

The maintenance Buddy is allowed to produce task-natural recommendations or machine-parsed proposals when the host parser requires them. It should not update durable baseline memory silently, and it should not inject per-call `m1` prompt content into future invocations.

Evolution therefore changes one of these durable surfaces:

```text
Buddy/member profile
role memory
routing/negative routing hints
subagent baseline definition
projection/install state
```

It does not change a hidden session context transform owned by Context Tree.

### 3.4 Discovery and Dream

Dream/curator mechanisms should maintain baseline quality:

```text
discover recurring member need
promote confirmed role memory
verify role memory against source refs
merge duplicate role memories
archive stale role memories
recompile affected subagent baseline
write updated runtime definition
```

Dream should not generate per-call task prompts. It cannot know future task-specific context and should not own dynamic invocation content.

## 4. Superseded Current Design

The following current-design assumptions should be superseded.

### 4.1 `member-m[1]` as Required Prompt Section

Current behavior:

```text
preparedChildInput.text must include:
  member-m[0]: stable member baseline
  member-m[1]: activation delta
```

Corrected behavior:

```text
runtime subagent definition contains subagent baseline
parent invocation prompt contains dynamic task context
preparedChildInput, when present, records the invocation prompt/request only
```

The current validation that rejects prepared input without `member-m[0]` and `member-m[1]` should be removed or replaced.

### 4.2 `finalM1Refs` as Product Contract

Current behavior:

```text
material-selection-report.finalM1Refs
member-context-render.m1Refs
member-context-render.deltaMaterials
member-context-render.deltaDigest
member-invocation-packet.m1Refs
```

Corrected behavior:

```text
baseline refs/materials belong to subagent baseline install
dynamic task refs belong to parent-supplied invocation metadata
searchable/source-only refs remain accounting or sidecar material
```

`finalM1Refs` may remain temporarily as a compatibility alias during migration, but it should not be used as a product concept.

### 4.3 Context Tree as Dynamic Task Prompt Owner

Current behavior makes Context Tree appear responsible for activation delta. That overlaps with the parent agent's responsibility.

Corrected behavior:

```text
Parent agent owns dynamic task prompt.
Context Tree owns baseline provisioning and evidence.
```

If the parent calls a Context Tree wrapper/tool, the wrapper owns the mechanics of delivery and evidence. It does not create a separate conceptual layer called `m1`.

### 4.4 Canary-Based Output Requirements

Current lifecycle code can require visible proof canaries to be repeated in final answers. That was useful for tests but should not be a normal product design.

Corrected behavior:

```text
Runtime/provider/input evidence proves delivery.
Subagent output should remain task-natural.
Canaries are test fixtures only, not product behavior.
```

## 5. Proposed Data Model Changes

### 5.1 New / Renamed Concepts

Use these names instead of `m0` / `m1` in product-facing docs and code where possible:

```text
subagentBaseline
baselineRefs
baselineDigest
baselineDefinitionPath
baselineDelivery
invocationPrompt
invocationPromptDigest
parentSuppliedTaskContext
targetRefs
searchableRefs
sourceOnlyRefs
```

### 5.2 Baseline Install Report

A baseline install report should capture:

```json
{
  "reportKind": "context-tree-subagent-baseline-install-report",
  "memberName": "skill-designer",
  "runtime": "opencode",
  "definitionPath": "agents/skill-designer.md",
  "profileRef": ".context-tree/.../profile.json",
  "baselineRefs": ["memory:role:..."],
  "baselineDigest": "sha256:...",
  "generatorVersion": "context-tree-subagent-baseline-v1",
  "projectionOnly": true
}
```

`projectionOnly: true` remains important. Installing a subagent baseline does not prove any task ran.

### 5.3 Invocation Record

An invocation record should capture what the parent or wrapper supplied:

```json
{
  "memberName": "skill-designer",
  "expectedBaselineDigest": "sha256:...",
  "parentSuppliedTaskContext": {
    "promptDigest": "sha256:...",
    "targetRefs": ["docs/plan.md"]
  },
  "deliveryKind": "native-subagent-prompt",
  "resultReturn": "parent-agent"
}
```

This record does not need `m1Refs`.

### 5.4 Observed Runtime Turn

When routing, maintenance, discovery, or evolution proof depends on a model decision, use a shared observed-turn record instead of ad hoc JSON.

Minimum shape:

```json
{
  "artifactKind": "observed-runtime-turn",
  "runtime": "opencode",
  "captureKind": "runtime-observer-export",
  "projectIdentity": "/workspace/project",
  "sourceThreadId": "ses_...",
  "turnId": "msg_...",
  "partId": "prt_...",
  "phase": "buddy-baseline-maintenance",
  "requestRef": "request.txt",
  "requestDigest": "sha256:...",
  "answerRef": "answer.txt",
  "answerDigest": "sha256:...",
  "observedAt": "2026-07-13T00:00:00.000Z"
}
```

Rules:

- `requestRef` and `answerRef` must resolve to bytes whose digests match the record.
- `sourceThreadId`, `turnId`, and `partId` must come from runtime/exporter evidence when product proof is claimed.
- `phase` must say what the turn was used for, such as `buddy-routing`, `buddy-baseline-maintenance`, `memory-curation`, or `evolution-proposal`.
- Product evals may consume this record, but normal Buddy/subagent answers should not be shaped around it.

### 5.5 Baseline Change Proposal

Dream/curator/evolution output should become a proposal before it changes durable baseline state.

Minimum shape:

```json
{
  "proposalKind": "baseline-change-proposal",
  "buddyName": "skill-designer",
  "targetSurface": "role-memory",
  "operation": "update",
  "sourceTurnRef": "observed-runtime-turn.json",
  "sourceTurnDigest": "sha256:...",
  "sourceRefs": ["opencode-session:..."],
  "summary": "Prefer symptom-driven trigger review before implementation details.",
  "proposedContent": "...",
  "riskLevel": "low",
  "status": "proposed"
}
```

Allowed target surfaces:

```text
profile
role-memory
routing-hints
negative-routing-hints
baseline-definition
```

Applying a proposal writes a mutation/apply record and then triggers baseline sync. It should not patch invocation prompts or resurrect `member-m[1]`.

## 6. Concrete Examples

### Example 1: Confirmed Member Baseline Installation

- **Example:** `skill-designer` is a confirmed member with active role memory and runtime projection enabled for OpenCode.
- **Expected result:** `agents/skill-designer.md` contains the member role, responsibilities, activation hints, negative activation hints, and materialized active role memory content. A baseline install report records the definition path and baseline digest.
- **Verification:** Read the generated definition file and baseline install report. The definition must contain role memory content, not only `roleMemoryRefs`.
- **Failure signal:** The runtime definition lists memory refs but the subagent cannot see the memory content without a separate search or prompt section.
- **If it fails:** Fix baseline projection, not invocation prompt rendering.

### Example 2: Parent-Owned Dynamic Invocation

- **Example:** The parent agent calls `skill-designer` with `Review docs/plan.md for weak assumptions.`
- **Expected result:** The task prompt is treated as parent-supplied dynamic context. Context Tree records its digest and target refs when observable, but does not classify the prompt as `member-m[1]`.
- **Verification:** Invocation artifacts contain prompt/task metadata without required `member-m[1]` sections.
- **Failure signal:** Any validation fails because the prompt lacks `member-m[1]`.
- **If it fails:** Remove `member-m[1]` validation and update lifecycle tests.

### Example 3: Wrapper-Mediated Invocation

- **Example:** The parent calls a future Context Tree wrapper/tool with member name, task text, and target refs.
- **Expected result:** The wrapper checks the installed baseline digest, dispatches or prepares the runtime subagent invocation, and records delivery/result evidence. It does not create a separate `m1` product layer.
- **Verification:** The wrapper output links baseline digest, invocation prompt digest, child session evidence if available, and result return evidence.
- **Failure signal:** Wrapper-generated artifacts claim dynamic context ownership beyond the task prompt/request supplied to the wrapper.
- **If it fails:** Correct wrapper artifact naming and evidence semantics.

## 7. Implementation Impact

This design document does not implement changes, but it identifies the required code updates.

Before any implementation plan is written for this design, the planner must first perform a violation scan for the hard constraint in Section 2.0.

The implementation plan may not start with code tasks. It must first include a findings section that lists:

```text
all current files that require agent/subagent/Buddy/member/reviewer output format or content for review/provenance/audit
which findings are real violations versus acceptable machine-parser/test-only paths
recommended change for each real violation
which changes are required before implementation versus safe to defer
```

Only after that scan and recommendation section may the plan define implementation tasks. This prevents implementation machinery from preserving obsolete proof-canary or audit-template behavior as product contract.

Any existing implementation plan that centers `BuddyExecutionPolicy`, `member-m[0]` / `member-m[1]`, or adapter-first invocation must be re-reviewed against this document before further implementation. Those plans may remain useful as compatibility/provenance slices, but they are not the latest product design unless they explicitly adopt baseline provisioning and parent-owned invocation.

### 7.1 Runtime Projection

Update `src/core/member-runtime-projection.mjs` so runtime definitions materialize baseline content.

Current issue:

```text
Role memory refs are listed, but content is not compiled into the subagent definition.
```

Required direction:

```text
generateMemberRuntimeProjections(...) should accept compiled baseline materials
and render them into Codex / Claude / OpenCode definitions.
```

### 7.2 Member Task Request

Update `src/core/member-task-request.mjs` so `preparedChildInput` no longer requires `member-m[0]` or `member-m[1]` sections.

Current issue:

```text
validatePreparedChildInputText() rejects input without both sections.
```

Required direction:

```text
preparedChildInput should represent invocation prompt/request only.
Baseline visibility should be proven by baseline install/projection evidence.
```

### 7.3 Member Context Render

Update `src/core/member-context-render.mjs` or replace it with a baseline-oriented record.

Current issue:

```text
memberContextRender owns both m0Refs and m1Refs.
```

Required direction:

```text
baseline render/install records stable subagent definition content.
invocation records parent-supplied task prompt/material refs.
```

### 7.4 Material Selection Report

Update `src/core/material-selection-report.mjs` to remove `m1` as a product placement.

Current issue:

```text
placements include m0 and m1.
```

Required direction:

```text
placements should distinguish baseline, invocation-observed/requested, searchable,
source-only, mounted, rejected. If compatibility is needed, m1 remains internal only.
```

### 7.5 Tests and Evals

Update tests that assert `member-m[1]` must appear in prepared child input.

Known affected area:

```text
test/eval/member-context-lifecycle.test.mjs
```

New tests should assert:

```text
subagent definition includes baseline content
invocation prompt does not need member-m[1]
baseline digest and invocation prompt digest are recorded separately
```

### 7.6 Runtime Projection Installer

Update runtime projection so definitions are the main delivery surface for stable Buddy context.

Required direction:

```text
compile confirmed profile + role memory + routing hints into runtime definitions
write install report with baseline digest and definition path
make projection report explicit that it is projection-only
```

Tests should inspect generated OpenCode / Claude / Codex definition files and prove role memory content is visible without a separate invocation prompt section.

### 7.7 Wrapper Invocation Compatibility

Wrapper-mediated invocation may remain, but its artifacts must be renamed or reinterpreted around baseline/invocation ownership:

```text
expectedBaselineDigest
invocationPromptDigest
parentSuppliedTaskContext
deliveryKind
resultReturn
```

It must not require `member-m[1]`, `finalM1Refs`, or canary repetition. If a wrapper dispatches native subagent execution, native proof must come from runtime child-session evidence. If it only calls a CLI/tool adapter, reports must label it wrapper-mediated.

### 7.8 Maintenance Producer Tasks

Implementation plans for Dream/curator/evolution must include real producer tasks for:

```text
observed runtime turn export
baseline change proposal parsing/validation
proposal apply/reject/revert ledger
baseline resync after apply
product eval that proves the updated baseline appears in runtime definitions
```

They must not close product proof with retained proposal JSON or direct shell-only output.

## 8. Non-Goals

This design intentionally does not require:

- Magic Context integration.
- Reading Magic Context's SQLite database.
- Searching role memory at invocation time.
- Hooking every runtime-native subagent call transparently.
- Forcing reviewer/Buddy/member outputs into audit schemas.
- Requiring canary repetition in normal product output.
- Treating runtime projection as proof that a task was executed.

## 9. Open Questions

1. What should the public command be for baseline sync: `ctree subagents sync`, `ctree members project`, or `ctree members sync`?
2. Should baseline definition files embed full memory content by default, or use a capped/trimmed baseline budget with a baseline known-loss record?
3. Should wrapper-mediated invocation be the default fallback only when native task hooks are unavailable, or should some runtimes prefer wrapper-mediated calls for better evidence?
4. How should baseline updates be triggered: explicit command, dream/curator Buddy, runtime slash command, scheduled maintenance, or all of these as visible trigger sources?
5. Should compatibility fields (`m0Refs`, `m1Refs`, `deltaDigest`) be retained for one migration version or removed in one breaking change?
6. Which runtimes can export enough native child/subagent evidence to verify parent-owned invocation without a wrapper?

## 10. Final Design Statement

Context Tree should not reproduce Magic Context's `m0/m1` session context compiler. It should provide a subagent provisioning system:

```text
stable role memory -> subagent definition baseline
dynamic task request -> parent-supplied invocation prompt
proof/evidence -> Context Tree sidecars
```

This keeps Context Tree focused on reusable subagents and avoids turning parent-owned task prompts into an unnecessary `m1` abstraction.
