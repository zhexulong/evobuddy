# Buddy / Skill Co-Evolution Design

Product preset authority: bundled Buddy behavior lives in
`src/presets/buddies/<buddy>/BUDDY.md`, with preset registry metadata in
`src/presets/buddies/registry.json`. Fixtures remain retained test data only;
they are not authoritative product definitions.

## 0. Conclusion

Evobuddy should not evolve only `Buddy` / member definitions. It must also evolve the SOP-backed knowledge and skills that those Buddies use.

The corrected model is:

```text
real work / user correction / repeated run pattern
  -> Evolution Buddy reviews source-backed inputs
  -> one or more source-bound improvement candidates are created
  -> target decision chooses where the learning belongs:
       stable fact / reusable SOP / ordinary skill-from-SOP
       existing Buddy profile / routing / skill / memory / capability
       proposed new skill / proposed new Buddy / discard
  -> versioned patch is proposed, applied, projected, and evaluated
```

This keeps the product centered on native Buddy/subagent use while avoiding two opposite mistakes: forcing every learning into member memory, and creating a new Buddy for every reusable pattern. Most durable reusable behavior should first become a concise SOP under knowledge. Skills and Buddies are execution/projection surfaces over that SOP-backed substrate: some learnings change **who should do the work**, others change **when a Buddy/skill should trigger**, **how a reusable procedure should be performed**, **what stable fact or preference should be remembered**, or **which existing Buddy capability should be refined**. Buddy creation remains intentionally high-friction.

## 1. Problem

Current Evobuddy design can learn from Buddy runs and patch a Buddy. That is not enough.

Real project feedback often has three shapes:

1. **Buddy-specific learning**
   - Example: `skill-designer` should always check whether a skill trigger is symptom-driven before reviewing implementation details.
   - Best target: `buddy-skill` or `buddy-routing`.

2. **Ordinary skill learning**
   - Example: when writing any skill, separate “rules about the skill” from “the skill content itself”.
   - Best target: an ordinary skill such as `writing-skills` or a project skill template.

3. **Cross-surface SOP learning**
   - Example: when designing a skill-related feature, both `skill-designer` and the generated skill authoring instructions should require contract references to be loaded only when implementing/calling the writeback entrypoint.
   - Best target: a SOP under `knowledge/sops/`, referenced by both Buddy and skill patches.

If Evobuddy only patches Buddies, skills become stale. If it only patches skills, Buddy role boundaries, routing, and project-specific expertise do not improve. The product value is the co-evolution loop over SOP-backed knowledge, skills, and Buddies.

## 2. Design Goal

Evobuddy should answer:

```text
Given a real observed improvement signal, what durable thing should change?
```

Possible answers:

```text
change or create a stable fact in knowledge/facts.md
change or create a reusable SOP in knowledge/sops/
change an existing skill that references a SOP
change an existing Buddy that references one or more SOPs
create a proposed new skill from a SOP
create a proposed new Buddy backed by SOPs
mark the signal as not durable / discard
```

The system should not assume that “memory” is the destination. Memory is only one possible target. It should also not assume that “new Buddy” is the destination. A Buddy is a runtime-visible execution role and therefore a high-cost artifact.

## 2.1 Ontology Boundary: SOP-First Knowledge Substrate, Not A Schema Taxonomy

The corrected V0 model follows GenericAgent's memory discipline and Trellis's repo-local Markdown style: keep a small durable knowledge substrate, then project executable surfaces from it when useful.

Canonical project sources are:

```text
.evobuddy/knowledge/
  index.md        # L1-style minimum sufficient pointer index; no how-to dump
  facts.md        # L2-style stable facts, preferences, conventions; short
  sops/           # L3-style reusable task methods / validated procedures

.evobuddy/skills/   # Skill definitions that reference SOPs
.evobuddy/buddies/  # Buddy definitions that reference SOPs
```

Non-sources of truth:

```text
.evobuddy/projections/   # generated runtime output/proof only
raw sessions             # owned by runtimes / agents, not copied into Evobuddy V0
journals / workspaces    # not an Evobuddy durable layer in V0
evidence/ buckets        # not a separate durable ontology root in V0
```

Rules:

- A reusable method defaults to `knowledge/sops/<name>.md`.
- A stable fact, project convention, preference, or boundary defaults to `knowledge/facts.md`, kept short. If it becomes a procedure, migrate it to a SOP and leave only a pointer/fact.
- `knowledge/index.md` is only a trigger/navigation layer, like GenericAgent's L1: it points to facts/SOPs/Buddies/skills and does not contain detailed instructions.
- A skill is an agent-loadable trigger and workflow surface over one or more SOPs. It should not become an orphan copy of the SOP.
- A Buddy is a runtime-visible independent execution role. Its `BUDDY.md` contains role, boundary, trigger, return contract, and references to SOPs. Its “how to do the work” content should live in SOPs unless the behavior is truly role-specific.
- Source support should be recorded as minimal source pointers inside the changed Markdown or mutation log. Do not create a product-level `.evobuddy/evidence/` store in V0.

This is a deliberate correction from treating `knowledge`, `workflow`, `skill`, `practice`, and `Buddy` as parallel ontologies. For V0, SOP is the common reusable behavior substrate; skills and Buddies are projections/execution forms over it.

`facts.md` is a single file in V0 because GenericAgent's L2 analog is a compact fact layer, not an upfront taxonomy. Split into `facts/` only after real growth pressure produces a clear non-invented split rule.

### Trellis Boundary: Keep Index/Projection, Do Not Copy The Harness

Trellis is an important reference, but not the product model to clone. Its strongest reusable pattern is:

```text
project-local Markdown sources
  -> compact session-start index / current-state injection
  -> runtime-specific agents / skills / commands
  -> read full details on demand
```

Evobuddy should keep that pattern:

- inject a compact `.evobuddy/knowledge/index.md` summary, not all SOP bodies;
- project Buddies to runtime-native surfaces such as `.opencode/agents/`, `.claude/agents/`, and `.codex/agents/`;
- project Skills to runtime-native skill surfaces where supported;
- keep generated runtime files as projections, not source of truth;
- protect user edits with managed-block / hash / skip semantics instead of overwriting local changes.

Evobuddy should not copy Trellis's full workflow harness as the default product:

- no mandatory plan/implement/check/debug/dispatch phase chain;
- no project-wide journal/workspace layer in V0;
- no large always-injected workflow document;
- no assumption that every task should enter the same multi-agent pipeline.

With stronger frontier models, a fixed workflow harness can become context tax and behavioral drag. Evobuddy's advantage should be smaller and more adaptive: it remembers and evolves the project's own SOPs, Skills, and Buddies from real use, while letting the parent agent stay the natural first surface.

## 2.2 Reference-Derived Corrections

External reference systems suggest six corrections to this design:

1. **Do not evolve on every interesting turn.**
   MemSkill evolves from representative hard cases, not from every trace. Acontext learns when a task is complete or failed. Evobuddy should therefore form candidates at task/outcome or maintenance boundaries, with explicit hard-case selection for retrospective runs.

2. **Separate selection quality from artifact quality conceptually, but defer extra trigger probes.**
   Claude Code skill evals distinguish “did the skill trigger?” from “was the output better?”. Evobuddy should preserve this as a diagnostic model, but current implementation plans should not add extra model/runtime calls solely to test skill trigger quality. Near-term evals should rely on already-observed natural runs, direct invocation, and projection/behavior evidence.

3. **Skill descriptions and listing budget are product-critical, but release-hardening scope.**
   Claude Code relies heavily on skill/subagent descriptions for routing and may truncate skill listings under budget pressure. Evobuddy should treat description patches as first-class routing changes. Dedicated should-trigger / should-not-trigger prompt suites are useful later, but are not part of the immediate implementation path because they add extra runtime/model calls.

4. **Memory should have decay, protection, and reinforcement.**
   OpenCode Working Memory keeps durable memories selective, protects explicit memories, lets weak memories fade, and rejects noisy replacements. Buddy memory patches should not be binary “active forever” writes.

5. **Skill memory should stay inspectable and portable.**
   Acontext stores learned skills as plain Markdown files and retrieves by explicit skill tools/progressive disclosure rather than opaque vector-only memory. Evobuddy should keep learned skill/Buddy changes file-backed, reviewable, versioned, and projection-friendly.

6. **Trellis-style workflow should be selectively adopted, not copied whole.**
   Trellis demonstrates useful runtime projection, compact index injection, managed templates, and file-backed agent definitions. Evobuddy should reuse those architectural patterns, but its product edge is self-evolving capability, not a fixed workflow harness.

## 3. Product Boundary

### 3.1 Parent Agent Remains First Surface

The user works in the normal parent agent session. The parent agent may notice:

- a Buddy missed something;
- the user corrected a repeated behavior;
- a task repeatedly needs the same external reusable procedure;
- a skill or Buddy is too broad;
- a skill or Buddy is over-triggering;
- a new reusable procedure seems to exist.

The parent agent should invoke `evolution-buddy` as a native Buddy/subagent when the signal is substantial enough. The `evolution-buddy` proposes durable changes; it does not silently rewrite active definitions.

### 3.1.1 Product Differentiation From Trellis

Trellis gives agents a preset engineering process. Evobuddy gives agents a living capability layer.

```text
Trellis:
  preset workflow + preset agents + spec/index injection

Evobuddy:
  preset Buddies + project SOPs + project Skills
  + evolution-buddy deciding what should change after real use
  + runtime-native projection across OpenCode / Claude / Codex
```

Therefore Evobuddy should not compete by adding a larger fixed workflow. It should compete by:

- using less always-on context;
- letting the parent agent choose naturally;
- keeping reusable methods as SOPs that can be loaded on demand;
- turning repeated user/project feedback into versioned SOP/Skill/Buddy patches;
- preventing Buddy proliferation through fact/SOP/skill/existing-Buddy downgrades;
- keeping three-runtime projections equivalent without forcing one runtime's format onto another.

### 3.2 Workbench Is Management Surface

Workbench shows:

```text
Pending Improvements
Applied Patches
Affected Buddies
Affected Skills
Evidence
Version / Rollback
```

Workbench does not become the first approval gate for normal work. It is for review, inspection, editing, rollback, and import/setup.

### 3.3 No Audit-Shaped Agent Output

Neither Buddy nor skill output should be forced to include canaries, proof sections, JSON, or special phrases solely for evidence.

Evidence comes from:

- runtime transcript/exporter;
- parent-call record;
- BuddyRun / SkillRun sidecars;
- patch proposal artifacts;
- projection doctor/eval;
- behavior regression eval.

Agent answers should serve the task.

## 4. Core Concepts

### 4.1 Improvement Signal

An input event that may justify durable learning.

Examples:

```text
user correction
parent-agent correction
failed eval followed by fix
repeated successful run pattern
repeated over-trigger or under-trigger
explicit user request: "remember this for this Buddy/skill"
long task whose reusable SOP/procedure was validated
```

Rejected sources:

```text
tool output mistaken as user evidence
workflow wrapper prompt
docs-only inference without run/user evidence
single unvalidated preference
agent speculation not tied to a run or user message
```

Signals do not directly become candidates. They first enter an outcome-bound queue:

```text
task completed
task failed
BuddyRun returned and was accepted/rejected
user correction arrived after result
maintenance window selected representative hard cases
```

This avoids per-turn memory churn and follows the common pattern in Acontext and MemSkill: learning happens after an outcome can be judged, or from a curated hard-case batch.

### 4.2 Practice Candidate

A source-bound candidate extracted from one or more improvement signals.

Shape:

```text
PracticeCandidate
  candidateId
  observedPattern
  sourceRefs
  sourceKind
  affectedSurfaces
  targetSuggestion
  positiveRule
  negativeRule
  examples
  counterExamples
  risk
  confidence
  status
```

`PracticeCandidate` is not itself a patch. It is the shared upstream object used to decide whether to patch a Buddy, a skill, both, or nothing.

### 4.3 Target Decision

The first product-critical decision made by `evolution-buddy`.

```text
TargetDecision
  candidateId
  primaryTargetKind
  primaryTargetRef
  secondaryTargets
  rejectedTargets
  reason
  risk
```

Allowed `primaryTargetKind`:

```text
knowledge-fact
knowledge-sop
buddy-profile
buddy-routing
buddy-skill
buddy-memory
buddy-return-contract
ordinary-skill
new-skill
new-buddy
discard
```

Rules:

- A candidate has exactly one primary target.
- If both Buddy and skill should change, primary target is normally `knowledge-sop`; the SOP is then referenced by versioned Buddy and skill patches.
- `new-buddy` and `new-skill` create proposed assets only; they do not become active silently.
- `new-buddy` is the last resort, not the default. The decision must reject `knowledge-fact`, `knowledge-sop`, `ordinary-skill`, `buddy-skill`, `buddy-routing`, and existing Buddy capability before proposing a new Buddy.
- `discard` is a valid durable outcome and records why the signal should not recur.

### 4.4 Buddy Proliferation Control

Buddy is the most expensive artifact because it is visible to the parent agent and the runtime's routing surface. Too many Buddies create context noise, ambiguous routing, duplicated responsibilities, and a worse user experience.

Evobuddy should therefore prefer the smallest durable artifact that preserves value:

```text
one-off run note -> no durable Evobuddy source change
fact / preference / decision -> knowledge/facts.md
ordered repeated operation -> knowledge/sops/<name>.md
agent-loadable reusable method -> skill that references SOP
improvement to an existing role -> existing Buddy skill/routing/memory/capability referencing SOPs
stable independent execution role -> proposed new Buddy backed by SOPs
```

New Buddy proposals must include a short `BuddyUtilityCase`:

```text
whyNotFact
whyNotSop
whyNotSkill
whyNotExistingBuddyCapability
independentContextWindowBenefit
stableResponsibilityBoundary
expectedParentTrigger
expectedReturnContract
expectedUsageEvidence
```

If this case is weak, the target must be downgraded to `knowledge-fact`, `knowledge-sop`, `ordinary-skill`, an existing Buddy capability, or `discard`.

The Buddy registry should distinguish visibility levels:

```text
active
available
archived
```

- `active`: default parent-agent routing surface; keep small and stable.
- `available`: defined and searchable, but not high-priority/default-injected.
- `archived`: retained for provenance/rollback, not offered for normal routing.

Registry budgets are product guidance, not hard schema requirements:

```text
activeBuddyBudget: 5-12
availableBuddyWarningThreshold: 20
definitionContextBudget: bounded per projection
```

When over budget, `evolution-buddy` should prefer merge, downgrade, archive, or capability consolidation before creating another Buddy.

### 4.5 Existing Buddy Capability

Many reusable patterns should become a capability of an existing Buddy instead of a new Buddy.

Example:

```text
verification-buddy
  capability: live eval proof loop
  capability: product-observed proof audit
  capability: retained artifact quarantine
```

This can be represented with existing target kinds such as `buddy-skill`, `buddy-routing`, or `buddy-memory`; it does not require a separate top-level schema in V1. The design point is that parent agents should see a stable role with richer internal capability, not a growing list of tiny specialists.

### 4.6 SOP As Common Substrate

A SOP is the source-level reusable method that can be referenced by multiple artifacts. This replaces a separate `shared-practice` durable type in V0.

Example:

```text
knowledge/sops/skill-trigger-boundary-review.md:
  "Skill-related work must separate trigger/rule design from implementation details."

Referenced by:
  - skill-designer BUDDY.md: review trigger/rule separation first
  - writing-skills SKILL.md: checklist item points to the SOP
  - skill-designer routing: call when task changes trigger/rule contract
```

The SOP is not a runtime artifact by itself. Buddy and skill patches remain versioned and revertible, but they should point back to the SOP instead of copying divergent bodies.

### 4.7 Hard-Case Buffer

A bounded queue of cases where the current Buddy/skill system did poorly or produced ambiguous outcomes.

```text
HardCase
  sourceRunRef
  expectedOutcomeRef
  observedOutcomeRef
  failureKind
  repeatedCount
  difficultyScore
  representativeCluster
```

Uses:

- repeated failures become stronger evolution candidates;
- similar failures are clustered before `evolution-buddy` reviews them;
- one-off weak signals can be discarded without being forgotten entirely;
- live eval failures and user corrections enter the same improvement path.

This is not a new product surface. It is the maintenance input queue for `evolution-buddy`.

### 4.8 Protected Rule

Some rules should resist automatic replacement:

```text
explicit user preference
security/correctness invariant
release-grade proof invariant
organization-managed skill/Buddy rule
```

Protected rules can still be superseded, but only by an explicit patch that names the prior rule and explains why replacement is safe. Ordinary retrospective consolidation should reinforce, reference, or propose an edit; it should not silently overwrite protected rules.

## 5. Target Selection Rules

### 5.1 Knowledge Fact

Use when the learning is a stable fact, preference, decision, pitfall, or project convention that should be remembered but does not define a reusable procedure or execution role.

Examples:

- This project treats product proof as runtime/exporter/digest-bound evidence, not report prose.
- The user dislikes schema unless it closes a proof or product boundary.
- A previous release eval failed because retained artifacts were mistaken for product-observed proof.

Storage:

```text
.evobuddy/knowledge/facts.md
```

Facts must stay short, source-backed by minimal pointers, deduplicated, and eligible for supersession. They should not be stuffed into every Buddy definition. Buddies and skills may reference them when relevant. If a fact grows into steps, commands, checks, or a correction loop, move the procedure into `knowledge/sops/` and leave a short pointer in `facts.md` only if useful.

### 5.2 Knowledge SOP

Use when the learning is an ordered repeated operation, validated method, checklist, command family, correction loop, or reusable task technique. This is the default target for most durable behavior learning.

Examples:

- How to run live eval -> inspect failure -> fix -> rerun -> record final proof.
- How to export a runtime session corpus and distinguish retained, hermetic, live, product, and product-observed artifacts.
- How to perform a release-grade provenance closure check.
- How to write a skill trigger that is symptom-driven rather than implementation-detail driven.

Storage:

```text
.evobuddy/knowledge/sops/<name>.md
```

SOP patches should be plain, inspectable, concise, and callable by an existing Buddy or skill. A SOP may later justify a new skill or Buddy only after repeated use shows the need for a separate trigger or independent execution role.

### 5.3 Buddy Profile

Use when the learning changes who the Buddy is for.

Examples:

- rename `eval-runner` to `eval-proof-reviewer`;
- clarify that `skill-designer` reviews trigger/rule boundaries, not every doc edit;
- split a too-broad Buddy into two proposed Buddy profiles.

### 5.4 Buddy Routing

Use when the learning changes when the parent agent should call the Buddy.

Positive example:

```text
When an implementation plan changes SKILL.md trigger conditions, call skill-designer.
```

Negative example:

```text
Do not call skill-designer for typo-only changes in unrelated docs.
```

This directly addresses the user's negative-learning example: if history shows the work is consistently “A”, the routing should de-prioritize non-A paths. But over-narrowing is a risk: the patch must include counterexamples or an escape condition so the Buddy can still be called when a future task genuinely crosses the boundary.

Routing patches must update both:

```text
description / trigger language
negative trigger language
```

This matters because runtime-native systems often use the description as the first discovery signal. A perfect body instruction cannot compensate for a vague or over-broad description.

### 5.5 Buddy Skill

Use when the learning changes how one Buddy performs its role.

Examples:

- `skill-designer` must read Superpowers writing-skills guidance before judging trigger text.
- `eval-proof-reviewer` must distinguish retained, hermetic, live, product, and product-observed proof.

### 5.6 Buddy Memory

Use when the learning is project/user-specific context that helps a Buddy but should not change the general workflow.

Examples:

- `verification-buddy` should load the project's product-proof fact/SOP before judging release readiness.
- `skill-designer` should remember this project's preference for symptom-driven trigger wording.

Buddy memory should be versioned and source-bound. It should not become a dumping ground for all feedback.

Buddy memory also needs retention state:

```text
pending
active
reinforced
decaying
protected
superseded
rejected
archived
```

This borrows the useful part of memory systems such as Magic Context and OpenCode Working Memory: durable context should be consolidated, verified, deduplicated, allowed to fade, and protected when explicitly user-authored or correctness-critical.

### 5.7 Ordinary Skill

Use when the learning changes an agent-loadable reusable SOP independent of a Buddy identity.

Examples:

- A skill authoring SOP should require symptom-driven trigger descriptions.
- A plan-review skill should require live eval -> correction -> rerun loop for product claims.

Ordinary skill patches should remain useful even if no Buddy exists.

Skill patches must preserve progressive disclosure:

- description says when to load the skill;
- `SKILL.md` body stays focused on trigger and usage, and links to SOP details instead of copying them;
- heavy references/scripts remain in linked files;
- learned examples should not bloat the always-loaded trigger layer;
- if a rule must always apply, it may belong in project instructions or deterministic hooks rather than an on-demand skill.

### 5.8 New Skill

Use when repeated successful work reveals a reusable SOP that needs its own skill trigger and is not covered by an existing skill.

Examples:

- “runtime-native subagent surface discovery” becomes a skill if it repeatedly requires the same primary-source scan, live probe, and projection doctor steps.
- “release-grade provenance validation” becomes a skill if it generalizes beyond one Buddy.

New skill creation must include:

- trigger symptoms;
- SOP reference and concise skill body;
- references/progressive disclosure boundary;
- negative triggers;
- at least one behavior eval.

New skill proposals should prefer plain Markdown / file-backed representation so users can inspect, edit, version, and project them across runtimes. Opaque vector-only learned skills are out of scope for V1.

### 5.9 Existing Buddy Capability

Use when a reusable pattern belongs inside an existing Buddy's domain but does not justify another top-level Buddy.

Examples:

- `verification-buddy` gains a `live eval proof loop` capability backed by a SOP and product-proof fact refs.
- `exploration-buddy` gains a `runtime session corpus survey` capability.
- `skill-designer` gains a `trigger wording audit` capability.

Implementation may encode this as `buddy-skill`, `buddy-routing`, and referenced SOP/fact patches. The product rule is what matters: prefer capability consolidation over Buddy proliferation.

### 5.10 New Buddy

Use only when evidence shows a stable independent execution role that existing Buddies should not absorb.

Required conditions:

- repeated or explicit user-backed demand;
- clear responsibility boundary;
- independent context window reduces parent-agent or existing-Buddy burden;
- stable parent-agent trigger;
- explicit return contract;
- existing Buddy capability, SOP, ordinary skill, and fact were considered and rejected;
- proposed visibility starts as `available` unless the user explicitly asks to activate it or release evidence proves it should be active.

Examples:

- A project repeatedly needs a dedicated runtime exporter maintainer that is independent from verification and exploration.
- A long-running domain specialist repeatedly consumes its own context and produces a parent-visible result that existing Buddies should not own.

Anti-examples:

- A single command sequence: create or update a SOP.
- A repeated checklist inside an existing role: update that Buddy's capability.
- A fact or preference: update `knowledge/facts.md`.
- A broadly useful method: create or update an ordinary skill.

### 5.11 Cross-Surface SOP

Use when a rule should be the common source for both Buddy and skill updates. In V0 this is not a separate `shared-practice` artifact. It is a SOP under `knowledge/sops/` with downstream Buddy/skill references.

This avoids divergence:

```text
Buddy says one thing.
Skill says another.
Projection generates a third.
```

Cross-surface SOP patches must generate downstream patch records so each affected artifact is still versioned and revertible.

### 5.12 Discard

Use when the signal is not durable.

Discard reasons:

- one-off task instruction;
- noisy or synthetic source;
- already covered by active skill/Buddy;
- too broad to apply safely;
- no observed future value;
- conflicts with a stronger existing rule.

Discard records should be searchable so the same weak candidate is not repeatedly proposed.

## 6. Positive and Negative Learning

### 6.1 Positive Learning

Positive learning adds or strengthens a behavior.

Example:

```text
User repeatedly asks for "live eval -> correction -> rerun" when product proof is claimed.
```

Possible targets:

- `eval-proof-reviewer` buddy-skill: check for correction loop.
- `writing-plans` ordinary skill: include correction-loop task when plan claims product/live proof.
- SOP: product proof requires eval correction loop.

### 6.2 Negative Learning

Negative learning removes, narrows, or de-prioritizes behavior.

Example:

```text
Tasks mentioning "skill" are often only typo/documentation edits.
Calling skill-designer every time is too broad.
```

Patch:

```text
buddy-routing:
  add anti-trigger for typo-only or formatting-only edits
  keep trigger when semantics of trigger/rule/contract changes
```

Guardrails:

- negative rules must include an exception path;
- they must not hide the Buddy from clearly relevant tasks;
- eval must include at least one positive case and one negative case.

## 7. Lifecycle

### 7.1 Capture

```text
parent agent observes signal
  -> optionally explains "this may be durable"
  -> invokes evolution-buddy
```

Capture should prefer real session/user/BuddyRun evidence. It must exclude tool output, workflow wrapper prompts, and synthetic eval text unless the eval is explicitly marked non-product.

Capture should normally wait until an outcome boundary:

```text
Buddy/skill run returned
user accepted/rejected/corrected the result
eval failed or passed with inspectable output
long task completed and parent agent can summarize what was reusable
```

Mid-task capture is allowed only for explicit user requests such as “remember this” or “update this Buddy/skill rule”.

### 7.2 Candidate Formation

`evolution-buddy` reads bounded evidence windows and creates `PracticeCandidate`.

It should not read the entire project history by default. For retrospective maintenance it may use time-ordered session/event windows, with safe frontier metadata:

```text
selectedEventCount
unreadEventCount
safeFrontier
watermark
```

For retrospective maintenance, candidate formation should use representative hard cases:

```text
collect failed / corrected / repeated cases
cluster similar cases
select representatives by repetition and severity
ask evolution-buddy to propose candidates from representatives
```

This avoids the failure mode where a long session with many similar messages creates many duplicate candidate patches.

### 7.3 Target Decision

`evolution-buddy` decides where the learning belongs.

The decision must explicitly answer:

```text
Is this about who should do the work?
Is this about when the Buddy should be called?
Is this about how a reusable SOP should be performed?
Is this only a fact, preference, decision, or pitfall?
Is this project/user memory?
Is this a new reusable skill?
Can an existing Buddy absorb this as a capability?
Why is a new Buddy better than a fact, SOP, skill, or existing Buddy capability?
Is this too weak/noisy and should be discarded?
```

### 7.4 Patch Proposal

The target decision produces one or more patches:

```text
KnowledgeFactPatch
KnowledgeSopPatch
BuddyPatch
SkillPatch
NewSkillProposal
NewBuddyProposal
DiscardRecord
```

Each patch records:

```text
sourceRefs
beforeRef
afterProposal
diffSummary
risk
validationPlan
status
```

### 7.5 Apply

Apply is versioned and reversible.

Rules:

- Explicit user instruction may apply directly but still writes mutation log.
- Agent-proposed durable changes should be explained to the user before apply when visible in the parent session.
- Low-risk memory/searchable updates may remain pending or m[1]-like until promoted.
- Active Buddy/skill/projection changes require version bump and projection refresh.
- Protected rules require explicit supersede/revert metadata before replacement.
- Memory-like changes can decay or be reinforced; skill/profile/routing changes require explicit patch versions.

### 7.6 Projection

After apply:

```text
canonical Buddy / Skill / SOP source
  -> runtime projections
  -> projection doctor
  -> natural-use or behavior eval
```

For Buddy changes, regenerate OpenCode / Claude Code / Codex native subagent definitions.

For skill changes, regenerate installed skill files or project-local skill projections according to the existing installer/sync contract.

Projection must preserve runtime-native capability fields where the runtime supports them:

```text
tools / disallowed tools
permission mode
hooks
model / effort
preloaded skills
memory scope
background / isolation hints
```

These fields are not decorative. In subagent systems, they are part of the reason a reusable Buddy is safer and more reliable than prompt-only delegation.

### 7.7 Behavior Verification

A patch is not product-proven merely because it was written.

It should be verified by a behavior eval appropriate to the target:

- Buddy routing patch: parent agent calls or does not call the Buddy in natural scenarios.
- Buddy skill patch: Buddy output changes on a comparable task.
- Skill patch: an agent using the skill follows or loads the referenced SOP.
- Shared practice patch: both Buddy and skill projections reflect the same source rule.
- Negative patch: positive and negative controls both behave correctly.

## 8. Relationship to Existing Evobuddy Design

This design extends the existing Evobuddy loop; it should not create an unrelated patch system.

Reuse:

```text
Buddy / BuddyRun
Evolution Buddy
EvolutionPatch
mutation log
runtime projection doctor/eval
Workbench pending patch surface
```

Add only the missing layer:

```text
PracticeCandidate
  -> TargetDecision
  -> existing patch records with targetKind/sourceCandidateId
```

Implementation rule:

- if an existing `EvolutionPatch` can represent the change, extend it instead of adding a parallel `SkillPatch` ledger;
- if an existing mutation log can record the apply/revert event, reuse it;
- if a field only exists to make reports look complete and does not close a product/eval boundary, do not add it;
- product evidence must remain separate from Buddy/skill output.

This keeps co-evolution from becoming an over-schema system while still making the crucial target decision explicit.

## 9. Data Model

Keep schema minimal and source-bound.

### 9.1 Practice Candidate

```json
{
  "kind": "practice-candidate",
  "candidateId": "pc_...",
  "observedPattern": "Repeated product-proof reviews require live eval correction loop.",
  "sourceRefs": ["buddy-run:...", "user-message:..."],
  "sourceKind": "user-feedback|buddy-run|eval-correction|retrospective",
  "targetSuggestion": "knowledge-sop",
  "positiveRule": "Require correction rerun before claiming live/product proof.",
  "negativeRule": "Do not require this for purely retained/hermetic tests.",
  "examples": [],
  "counterExamples": [],
  "risk": "over-narrowing|overfitting|duplicated-rule|stale-context",
  "confidence": "low|medium|high",
  "status": "candidate|decided|discarded|patched"
}
```

### 9.2 Target Decision

```json
{
  "kind": "target-decision",
  "candidateId": "pc_...",
  "primaryTargetKind": "knowledge-sop",
  "primaryTargetRef": "sop:product-proof-correction-loop",
  "secondaryTargets": [
    "buddy-skill:eval-proof-reviewer",
    "ordinary-skill:writing-plans"
  ],
  "rejectedTargets": [
    {
      "targetKind": "knowledge-fact",
      "reason": "A fact record would not make agents run the correction SOP."
    },
    {
      "targetKind": "new-buddy",
      "reason": "The existing eval-proof-reviewer/verification Buddy can own this capability."
    },
    {
      "targetKind": "buddy-memory",
      "reason": "This is a SOP rule, not project-specific memory."
    }
  ],
  "reason": "The learning affects both review Buddy behavior and plan-writing skill behavior, so the SOP should be the shared source referenced by both patches."
}
```

### 9.3 Patch Records

Patch records should reuse the existing `EvolutionPatch` family where possible. Do not invent parallel ledgers if the existing mutation log can represent the change.

Add only the fields needed to distinguish target:

```text
targetKind
targetRef
sourceCandidateId
sharedPracticeRef
```

## 10. User Experience

### 10.1 Skill Improvement

```text
User: 这个 skill plan 还是没写 live eval->纠错 loop。

Parent agent: 我会让 evolution-buddy 判断这是不是 durable SOP rule。

evolution-buddy:
  This should patch the plan-writing skill, not only eval-proof-reviewer memory.

Parent agent:
  建议更新 writing-plans 相关 skill：产品/live proof plan 必须包含 eval->纠错->重跑任务。
  同时给 eval-proof-reviewer 加一条检查规则。是否应用？
```

### 10.2 Buddy Narrowing

```text
User: 不要每次 docs typo 都找 skill-designer。

Parent agent:
  这是 skill-designer routing 的 negative learning。
  我会提一个 anti-trigger：typo-only/format-only docs edits 不触发 skill-designer；
  但涉及 trigger/rule/contract 语义变化仍触发。
```

### 10.3 New Skill Proposal

```text
Parent agent:
  最近三次 release-grade proof 都重复执行相同 provenance validation SOP。
  evolution-buddy 建议创建新 skill: release-provenance-validator。
  它仍是 proposed，不会自动安装为 active skill。
```

### 10.4 New Buddy Downgrade

```text
Parent agent:
  最近几次 live eval 都忘了正确 command。
  evolution-buddy 先建议不要创建 live-eval-command-buddy：
  这是一条 SOP + verification-buddy capability，而不是独立执行角色。

Suggested patches:
  - SOP: knowledge/sops/live-eval-proof-loop.md
  - verification-buddy capability/routing: reference the SOP when judging live/product proof
  - fact: retained/hermetic/live/product/product-observed proof boundary
```

### 10.5 New Buddy Proposal

```text
Parent agent:
  最近多次 runtime exporter 维护任务都需要独立上下文、专门工具边界、固定返回契约，
  且 verification-buddy / exploration-buddy 都不应承担实现责任。

evolution-buddy:
  建议创建 available Buddy: runtime-exporter-maintainer。
  BuddyUtilityCase 说明为什么不是 fact/SOP/skill/existing Buddy capability。
```

## 11. Eval Design

### 11.1 Target Decision Eval

Cases:

```text
Fact / preference / decision -> knowledge-fact
Ordered repeated operation -> knowledge-sop
Buddy identity correction -> buddy-profile
Buddy over-trigger -> buddy-routing
Buddy missed review step -> buddy-skill
Project/user preference -> buddy-memory
Reusable SOP needing agent-loadable trigger -> ordinary-skill
Repeated SOP needing its own trigger -> new-skill
Reusable pattern inside existing role -> existing Buddy capability via buddy-skill/routing/memory
Stable independent execution role -> proposed new-buddy with BuddyUtilityCase
Cross-cutting reusable rule -> knowledge-sop referenced by Buddy and skill
Noisy one-off -> discard
```

Pass:

- target decision chooses correct primary target;
- rejected alternatives include reasons;
- `new-buddy` decisions reject smaller artifacts first and include a BuddyUtilityCase;
- no candidate directly writes active artifacts.

### 11.2 Positive / Negative Learning Eval

Positive case:

```text
Repeated demand for B in task A -> B becomes checklist/rule in the right target.
```

Negative case:

```text
Task pattern always means A, not C/D -> C/D are narrowed or anti-triggered,
without blocking future true C/D examples.
```

Pass:

- positive control uses new rule;
- negative control avoids over-trigger;
- exception case still triggers when it should.

### 11.3 Deferred Skill Selection Eval

Goal: eventually prove the updated skill description/routing makes the skill load in the right situations.

This eval is **deferred** for the current implementation cycle because it requires extra fresh runtime/model calls whose only purpose is trigger measurement. Do not include it in the near-term MVP implementation plan unless the user explicitly reopens this scope.

Near-term substitute:

```text
use already-observed natural runs
verify direct invocation still works
verify projection includes updated description/routing text
verify behavior changes when the skill/Buddy is actually used
```

Future release-hardening eval:

Run realistic prompts in fresh sessions:

```text
with skill enabled
with skill disabled or name-only
with old description
with new description
```

Pass:

- should-trigger prompts invoke the skill;
- should-not-trigger prompts do not invoke it;
- direct invocation still works;
- description/listing budget does not truncate away the key trigger wording;
- the eval distinguishes “skill was discovered” from “skill output was good”.

### 11.4 Skill Patch Behavior Eval

Flow:

```text
agent uses old skill -> misses criterion
evolution-buddy proposes skill patch
patch applied
agent uses updated skill on comparable task -> follows new criterion
```

Pass:

- observed behavior changes due to updated skill projection;
- not merely because test prompt mentioned the answer.

### 11.5 Buddy Patch Behavior Eval

Flow:

```text
parent natural task -> Buddy run before patch
feedback/evolution patch
projection refresh
parent natural task after patch -> Buddy behavior/routing changes
```

Pass:

- runtime-native Buddy definition reflects new version;
- parent agent naturally uses or avoids Buddy according to routing;
- result returns to parent agent.

### 11.6 Capability Projection Eval

Goal: prove Buddy evolution did not lose runtime-native safety/capability metadata.

Pass:

- OpenCode / Claude Code / Codex projections retain equivalent role, trigger, memory, and return-to-parent content;
- supported runtime capability fields are preserved or intentionally marked unsupported;
- per-material doctor validates literal included role memory, not just whole-file digest;
- forged projection reports fail.

### 11.7 Cross-Surface SOP Eval

Flow:

```text
SOP patch applied
  -> Buddy projection references or includes the affected rule
  -> skill projection references or includes the affected rule
  -> both behavior evals pass
```

Pass:

- one SOP source drives multiple versioned downstream patches;
- rollback removes or supersedes all affected projections consistently;
- Buddy and skill bodies do not drift into separate copied versions of the same rule.

### 11.8 Hard-Case Evolution Eval

Goal: prove retrospective evolution is driven by representative hard cases, not regex/fallback candidate generation.

Flow:

```text
input contains repeated corrected failures and noisy one-off messages
hard-case buffer selects representative failure clusters
evolution-buddy proposes one candidate per durable cluster
noisy one-off messages become discard records
```

Pass:

- repeated hard case produces candidate;
- one-off noisy case is discarded;
- duplicate clusters do not create duplicate active patches;
- source refs exclude tool output and workflow wrapper prompts.

### 11.9 Release-Grade Live Eval Loop

Every implementation plan for this design should include:

```text
run live/product eval
inspect failure
fix implementation or design gap
rerun live/product eval
record final proof or honest blocker
```

Product pass requires observed runtime/session artifacts, not retained fixtures alone.

If evidence fails, correction route depends on the failed boundary:

```text
wrong target decision
  -> fix evolution-buddy instructions / target-decision examples / candidate source selection

right target but wrong patch
  -> fix patch generator or target-specific patch contract

patch applied but projection missing
  -> fix Buddy/skill projection or installer/doctor

projection correct but behavior unchanged
  -> fix runtime delivery, natural-use routing, or skill/Buddy wording

behavior changed only because eval prompt leaked the desired answer
  -> fix eval; this is not product proof
```

This prevents a failed co-evolution eval from being misreported as “candidate generated” success.

## 12. Non-Goals

V1 does not:

- automatically rewrite active skills in a hidden background loop;
- treat every user correction as durable memory;
- create new Buddies or skills without proposed/pending state;
- create a new Buddy when a fact, SOP, ordinary skill, or existing Buddy capability is sufficient;
- treat raw evidence, sessions, journals, or generated projections as durable Evobuddy source of truth;
- require extra fresh runtime/model calls solely to measure skill trigger hit rate;
- require all runtimes to share identical file format;
- force Buddy answers into audit JSON;
- make Workbench the only path to approve change;
- rely on docs-only extraction as product proof;
- use CLI wrapper invocation as the main user experience;
- require users to adopt a fixed Trellis-style plan/implement/check/debug workflow;
- inject full workflow/SOP bodies into the parent prompt when an index pointer and on-demand read are enough.

## 13. Invariants

1. `.evobuddy/knowledge/index.md`, `.evobuddy/knowledge/facts.md`, and `.evobuddy/knowledge/sops/` are the durable knowledge substrate in V0.
2. `facts.md` stays short; procedural content belongs in `knowledge/sops/`.
3. A Buddy is a stable runtime-visible execution role; a skill is an agent-loadable trigger/workflow surface.
4. SOP-first does not mean SOP-only: active Buddy and skill definitions should reference SOPs when they depend on reusable methods; thin role/trigger shells may omit SOP refs only when the behavior is local and not yet a reusable procedure.
5. Buddy creation is high-friction and last-resort; existing Buddy capability, SOP, skill, and fact targets are considered first.
6. The same source signal may affect multiple artifacts, but final patches remain target-specific and point back to the SOP/fact source where appropriate.
7. `evolution-buddy` decides target before proposing patch content.
8. `discard` is a first-class outcome.
9. Active changes are versioned, source-bound, and reversible.
10. Positive learning and negative learning both need behavior evals.
11. Product proof comes from runtime/exporter/sidecar evidence, not agent self-report.
12. Parent agent is the first product surface; Workbench is management and audit.
13. Index injection is discovery memory, not execution surface; Buddy/Skill projections are execution surfaces, not canonical knowledge.
14. Evobuddy must remain an adaptive capability layer, not a mandatory fixed workflow harness.
15. The value of Evobuddy is not just that Buddies exist, but that Buddies, skills, and SOP-backed knowledge improve from real use without becoming an unreviewable prompt soup or an unbounded Buddy roster.

## 14. Reference Systems

These references informed the corrections above:

- **MemSkill**: controller / executor / designer, representative hard-case evolution, skill bank refinement, rollback/early-stop framing.
  - https://arxiv.org/abs/2602.02474
  - https://viktoraxelsen.github.io/MemSkill
- **Acontext**: task completion/failure as learning trigger, distillation into Markdown skill files, skill agent deciding existing vs new skill, progressive disclosure via `get_skill` / `get_skill_file`.
  - https://github.com/memodb-io/Acontext
- **Magic Context**: background dreamer, consolidate / verify / archive stale / improve memory quality, user memory promotion, cache-aware context management.
  - https://github.com/cortexkit/opencode-magic-context
- **OpenCode Working Memory**: explicit memory triggers, quality guards, protected memories, decay/reinforcement, read-only TUI inspection.
  - https://github.com/sdwolf4103/opencode-working-memory
- **Claude Code skills/subagents**: description-driven discovery, progressive disclosure, skill eval with enabled/disabled baselines, subagent frontmatter fields including tools, skills, hooks, memory, model, and permissions.
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/sub-agents
- **Trellis**: compact session-start index injection, project-local Markdown guidance, runtime-specific agent/skill projections, and managed template/update protection. Evobuddy keeps these patterns but does not copy the fixed workflow harness as the product core.
  - https://github.com/mindfold-ai/Trellis
- **GenericAgent**: L1/L2/L3 memory discipline, SOP/script as reusable method layer, no-execution-no-memory, and minimum sufficient pointer.
  - https://github.com/lsdefine/GenericAgent
