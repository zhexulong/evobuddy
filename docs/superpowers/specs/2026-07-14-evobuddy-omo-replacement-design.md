# EvoBuddy OMO Replacement Design

## 0. Conclusion

EvoBuddy should not be framed as a proof shim or a Buddy add-on under Oh My OpenAgent (OMO). The stronger product direction is:

```text
EvoBuddy: a Buddy-native, evidence-backed, self-evolving agent organization system.
```

The important correction is that EvoBuddy must **not** assume a fixed parent orchestrator is always required. For strong models, OMO/Superpowers-style workflow injection can help, be redundant, or hurt by adding context noise and rigid process. EvoBuddy should therefore treat parent orchestration as a hypothesis to measure, not as a default product dependency.

EvoBuddy replaces OMO only if it can cover the user value OMO provides:

- useful parent-agent discipline when the model/project actually needs it;
- natural specialist/Buddy use;
- verification before completion;
- accumulated project learning;
- continuity and recovery;
- review and release evidence.

But EvoBuddy's replacement advantage should come from something OMO does not provide well:

```text
project-specific Buddies, skills, memories, practices, and loop harnesses
that evolve from real user work and are backed by durable evidence.
```

If a runtime only succeeds because OMO injected extra orchestration wording, that is compatibility evidence, not EvoBuddy-first product success.

## 1. Problem Statement

The current Buddy work proved an important boundary:

1. Claude Code and Codex can pass mechanism and natural-use paths under the current native Buddy surface model.
2. OpenCode can route to a real synced Buddy in live runs when wording is close enough.
3. OpenCode strict `naturalUse` still blocks when proof export depends on a prepared invocation packet / child prompt that is too mechanism-shaped.
4. OMO-hosted OpenCode behavior is strongly shaped by injected orchestration behavior such as exploration, verification discipline, and default subagent habits.

So the real question is not "how do we slightly improve the OpenCode parent instructions?" The real question is:

```text
How does EvoBuddy become the system users keep instead of OMO?
```

A fixed parent orchestrator is one possible answer, but not the default answer. We must first test whether strong models plus EvoBuddy's dynamic Buddy substrate already produce enough natural collection, routing, verification, and improvement behavior.

## 2. Product Position

### 2.1 One Sentence

```text
EvoBuddy is the Buddy-native evolution layer for coding agents: it gives projects durable expert Buddies, evolving skills/practices, and evidence-backed improvement loops.
```

### 2.2 User Mental Model

Users should experience EvoBuddy as:

```text
I have a roster of expert Buddies.
The agent can use them when useful.
Their results come back cleanly.
The project learns from real work.
Useful repeated workflows can become durable practices or loop Buddies.
Every claim about routing, execution, and improvement is evidence-backed.
```

This is broader than "invoke a child specialist" but narrower than "install a universal fixed workflow prompt." EvoBuddy owns the durable Buddy/evolution substrate. Any orchestration discipline should either be minimal affordance or an evolved project-specific practice.

### 2.3 Non-Goals

EvoBuddy is not:

- a better phrasing pack for OMO;
- a hidden daemon that silently edits Buddies;
- a CLI-only proof runner;
- a fake native-routing layer that relabels adapter calls as runtime-native success;
- a mandatory fixed parent workflow prompt that all users must carry even when the model does not need it.

## 3. Why OMO Feels Strong

OMO is strong because it gives users an operational system, not merely specialist prompts. The observed and documented strengths that matter are:

1. **Planning/execution separation**: planner, critic, executor, and read-only specialists have distinct roles.
2. **Intent-aware routing**: the parent layer decides whether to explore, implement, review, or verify before acting.
3. **Category-based delegation**: different tasks route to different specialists and models.
4. **Verification culture**: completion claims are gated by checks such as diagnostics, tests, and explicit review.
5. **Continuation discipline**: the system tries hard not to stop halfway.
6. **Background parallelism**: exploration and reference gathering happen concurrently.
7. **Accumulated wisdom**: earlier findings influence later task execution.

Users perceive OMO as better than a plain runtime because it behaves like a disciplined engineering organization.

The open question is whether this discipline still needs static injection for strong models, or whether EvoBuddy's evolving project substrate is enough for the agent to discover and use the right structure naturally.

## 4. Replacement Thesis

EvoBuddy should replace OMO by combining three things:

```text
Buddy-native project substrate
  +
durable evolution of Buddies / skills / practices / loop harnesses
  +
runtime-observed proof
  =
EvoBuddy replacement advantage
```

The product should **not** start by copying OMO's static parent prompt. Instead it should evaluate these levels:

1. **No-orchestrator baseline**: install Buddy roster, runtime projections, recent updates, and evolution-buddy; no extra workflow prompt.
2. **Light affordance**: minimal parent-facing note that project Buddies exist, recent updates exist, and long/repeated work may call evolution-buddy.
3. **Evolved loop harness**: project/user-specific practices or loop Buddies created from repeated real behavior.
4. **Preset orchestrator**: only if evidence shows the first three are insufficient.

This turns orchestration from a product assumption into an evolvable project artifact.

## 5. Core Product Architecture

### 5.1 Layer 1: Buddy Substrate, Not Mandatory Parent Orchestrator

EvoBuddy's default layer is a visible, project-local Buddy substrate:

- confirmed Buddy roster;
- Buddy definitions, skills, memory, routing hints, and return contracts;
- recent updates;
- visible evolution-buddy;
- runtime projections into OpenCode, Claude Code, and Codex.

The parent agent may use these naturally. EvoBuddy should not initially impose a complete "correct parent behavior" prompt unless evaluation proves it is needed.

### 5.2 Layer 2: Minimal Parent Affordance

A small parent-facing instruction may be useful, but it must remain an affordance, not a rigid workflow. It may say:

- this project has EvoBuddy Buddies;
- use native runtime Buddy/subagent mechanisms when a Buddy clearly fits;
- check recent updates when behavior may have changed;
- after long, repeated, or corrected work, consider asking evolution-buddy whether a durable improvement is warranted.

It must not define a universal plan/explore/verify loop unless that loop has become an explicit evolved practice.

### 5.3 Layer 3: Evolved Practices and Loop Harnesses

If users repeatedly work in a stable pattern, evolution-buddy may propose durable orchestration artifacts such as:

- `.evobuddy/practices/eval-correction-loop.md`;
- `.evobuddy/practices/release-proof-loop.md`;
- `.evobuddy/practices/skill-design-loop.md`;
- a dedicated loop Buddy such as `release-proof-buddy` or `skill-design-loop-buddy`;
- Buddy-specific skill updates that make one expert behave better in its domain.

These are the EvoBuddy version of "orchestration," but they are:

- project-specific;
- user-shaped;
- versioned;
- visible in Workbench;
- reversible;
- eligible for future evolution.

### 5.4 Layer 4: Buddy Roster and Routing

The product-facing surface remains Buddy-first:

- preset and user-confirmed Buddy roster;
- per-Buddy profile, skill, routing, memory, return contract;
- runtime projection into OpenCode, Claude Code, and Codex;
- parent-visible result return;
- BuddyRun-compatible ledger.

`buddyName` remains the stable product identity. Routing and invocation remain separate from proof claims.

### 5.5 Layer 5: Execution Policy and Honest Actuals

EvoBuddy should adopt the execution-policy boundary already defined in repo contracts:

- desired policy says what semantics the product wanted;
- actual execution says what actually happened;
- only evidence can claim runtime-native Buddy execution.

This is critical for beating OMO honestly. The product must never win by overstating its runtime surface.

### 5.6 Layer 6: Evolution Buddy and Durable Writeback

`evolution-buddy` is a visible product Buddy, not a hidden subsystem. It owns:

- target decision;
- patch proposal;
- risk classification;
- pending/apply/revert lifecycle;
- recent-update summaries;
- creation of new Buddy candidates;
- creation or refinement of project practices / loop harnesses;
- self-evolution proposals for EvoBuddy itself.

Unlike OMO's accumulated wisdom, EvoBuddy stores learning as versioned, source-backed, durable changes.

### 5.7 Layer 7: Release-Grade Provenance

Every important EvoBuddy claim must reduce to runtime/exporter/digest-bound evidence:

- routing decision evidence;
- observed parent-agent call evidence;
- invocation packet and context materialization evidence;
- Buddy result return evidence;
- evolution proposal evidence;
- applied-version consumption evidence;
- practice/loop-harness creation or use evidence.

This is the moat. OMO is perceived as disciplined; EvoBuddy should be disciplined when useful, self-improving, and auditable.

## 6. Replacement Capability Matrix

### 6.1 Capabilities EvoBuddy Must Match When Needed

EvoBuddy replacement is not credible unless it can match OMO-class behavior on tasks where that behavior matters:

1. parent-side intent classification;
2. planning versus execution separation;
3. specialist delegation with clear boundaries;
4. background exploration/reference gathering;
5. verification-before-completion behavior;
6. continuation/resume discipline;
7. review workflow before release claims.

But these should be measured, not blindly injected. If a strong model naturally performs them with only the EvoBuddy substrate, EvoBuddy should avoid adding static workflow prompt mass.

### 6.2 Capabilities EvoBuddy Must Exceed

EvoBuddy should exceed OMO in these areas:

1. **Durable learning**: not just session wisdom, but auditable patch/writeback.
2. **Runtime-proof honesty**: strict blocked-vs-fail semantics for native-use claims.
3. **Buddy identity continuity**: stable Buddy objects across runs, projections, patches, and rollbacks.
4. **Cross-runtime product semantics**: one Buddy model spanning OpenCode, Claude Code, and Codex.
5. **Traceable evolution**: show exactly why behavior changed and where it now lives.
6. **User/project-shaped orchestration**: repeated workflows become practices or loop Buddies instead of fixed global prompt rules.

## 7. Orchestration Hypotheses To Test

### 7.1 Hypothesis A: No-Orchestrator Is Enough

Strong models may naturally collect context, choose Buddies, verify work, and request improvements when EvoBuddy exposes the right roster, definitions, updates, and skills.

**Success evidence:** natural-use runs show relevant Buddy use, good context collection, result integration, and verification without OMO-style workflow injection.

**Product consequence:** do not build a fixed parent orchestrator. Keep EvoBuddy lightweight and evolution-driven.

### 7.2 Hypothesis B: Light Affordance Is Enough

The model may only need a short reminder that EvoBuddy exists and how to discover current Buddies/updates.

**Success evidence:** light-affordance runs outperform no-orchestrator on routing and verification without inheriting OMO-like rigidity.

**Product consequence:** ship a minimal instruction installer / runtime projection note, not a full workflow harness.

### 7.3 Hypothesis C: Evolved Loop Harness Beats Static Prompt

Some projects/users may need repeated loops, but those loops should be created from real use: eval-correction, release-proof, skill-design, implementation-review, etc.

**Success evidence:** after evolution-buddy creates a practice or loop Buddy, the second similar task improves in routing, context use, verification, or user correction rate.

**Product consequence:** make loop harnesses durable EvoBuddy artifacts.

### 7.4 Hypothesis D: Preset Orchestrator Is Needed

If no-orchestrator, light affordance, and evolved loops all fail on important tasks, EvoBuddy may need a preset orchestrator Buddy/practice.

**Success evidence:** a preset orchestrator materially improves task completion and verification without hiding routing/proof ownership.

**Product consequence:** ship a preset orchestrator as an optional/evolvable Buddy or practice, not as a non-removable hidden prompt.

## 8. OpenCode Boundary

### 8.1 Current Diagnosis

OpenCode is not blocked because Buddy routing is impossible. It is blocked because the current strict natural-use proof path still depends on a prepared invocation/export mechanism that leaves mechanism-shaped residue.

In other words:

```text
runtime routing is partially real;
current proof acquisition path is not yet product-clean enough.
```

### 8.2 Product Interpretation

This should be represented as:

- **mechanism pass**: achievable now;
- **runtime-selected Buddy evidence**: partially demonstrated now;
- **strict EvoBuddy-first natural-use pass**: still blocked until product-clean proof acquisition exists;
- **OMO-hosted compatibility success**: useful evidence, but a separate tier.

### 8.3 Rule

Do not fix this by strengthening OMO-specific parent wording and then calling the result EvoBuddy natural-use success.

If additional orchestration text is needed, it should become one of:

- minimal EvoBuddy parent affordance;
- an evolved practice;
- an evolved loop Buddy;
- an optional preset orchestrator with its own evidence tier.

It must not be hidden OMO prompt glue.

## 9. Product Surfaces

### 9.1 Canonical Naming

All product-facing naming must follow the preset constraints:

- product name: `EvoBuddy`;
- CLI/bin: `evobuddy` only;
- state root: `.evobuddy/` only;
- no new product-facing `Context Tree`, `context-tree`, `ctree`, or `.context-tree/` surface.

### 9.2 Primary Surfaces

EvoBuddy should expose:

1. **Buddy roster surface**: which Buddies exist and why.
2. **Natural runtime surface**: runtime-native Buddy/subagent definitions where supported.
3. **Evolution surface**: pending/applied Buddy, skill, memory, and practice changes.
4. **Workbench surface**: tasks, runs, pending improvements, applied changes, recent updates, trace/evidence.
5. **Release/readiness surface**: one aggregate gate for product truth.

The CLI remains necessary, but it is not the product's primary story.

## 10. Benchmark Design

### 10.1 Comparison Arms

For replacement credibility, run the same task set through:

1. **Plain runtime baseline**: no EvoBuddy, no OMO.
2. **EvoBuddy no-orchestrator**: roster/projections/recent updates/evolution-buddy only.
3. **EvoBuddy light affordance**: same as above plus minimal parent-facing note.
4. **EvoBuddy evolved loop harness**: after a practice/loop Buddy has been created from prior work.
5. **OMO-hosted compatibility**: OMO present, EvoBuddy available.
6. **OMO only**: OMO present, no EvoBuddy.

### 10.2 Task Types

Use real or realistic tasks that expose OMO's strengths:

- implementation plan review;
- skill/Buddy definition improvement;
- release proof review;
- eval failure diagnosis and correction loop;
- feature implementation requiring specialist review;
- second similar task after an evolved practice exists.

### 10.3 Metrics

Measure product behavior, not just artifact existence:

- relevant Buddy selected without explicit user naming;
- sufficient context gathered before Buddy call;
- Buddy result returned to and used by parent agent;
- verification performed before completion claim;
- unnecessary workflow overhead avoided;
- evolution-buddy creates or rejects durable improvements appropriately;
- second similar task improves after applying a Buddy/skill/practice/loop patch;
- evidence tier is honest: pass, fail, blocked, compatibility, retained, or mechanism.

### 10.4 Acceptance Standard

A fixed orchestrator should not be added unless the benchmark shows:

- no-orchestrator and light-affordance behavior are insufficient;
- evolved loop harness is insufficient or too slow for common cold-start cases;
- a preset orchestrator improves real task outcomes without unacceptable context overhead or rigidity.

## 11. Design Invariants

1. EvoBuddy is a replacement product candidate, not a Buddy-only extension under OMO.
2. A fixed parent orchestrator is not assumed; it is an evaluated option.
3. `evolution-buddy` remains a visible Buddy with its own definition file and risk policy.
4. Orchestration can be represented as evolved practices or loop Buddies.
5. Routing, desired execution, actual execution, and proof authority remain separate concepts.
6. Product success cannot depend on OMO-only prompt strengthening.
7. OMO-hosted success and EvoBuddy-native success are distinct evidence tiers.
8. Runtime projections are definition-only and never execution proof.
9. Release-grade proof is runtime/exporter/digest-bound or it does not pass.
10. Durable evolution writes active state under `.evobuddy/`, not only eval artifacts.
11. High-risk evolution remains pending without explicit user apply.
12. Product-facing naming is EvoBuddy-only.

## 12. Implementation Direction

### 12.1 Near-Term

1. Finish the three-runtime native Buddy MVP honestly, with OpenCode strict natural-use still allowed to remain `blocked`.
2. Split OpenCode evidence tiers into:
   - mechanism/native-surface compatibility;
   - runtime-selected Buddy evidence;
   - strict EvoBuddy-first natural-use;
   - OMO-hosted compatibility.
3. Implement the EvoBuddy product preset, durable evolution store, recent-update feed, and Workbench surface.
4. Define and run the no-orchestrator / light-affordance / evolved-loop benchmark before implementing a fixed parent orchestrator.
5. Continue renaming/state migration toward `evobuddy` / `.evobuddy/` product surfaces.

### 12.2 Next Product Slice

The next major spec/plan stack should cover:

- natural Buddy use benchmark without OMO prompt injection;
- minimal parent affordance, if needed;
- evolved practice / loop harness representation;
- how evolution-buddy decides between Buddy patch, skill patch, practice patch, loop Buddy, new Buddy, or discard;
- how loop/practice use feeds BuddyRun and EvolutionPatch evidence;
- comparison against OMO-hosted compatibility without treating it as EvoBuddy-native success.

### 12.3 Acceptance Standard

EvoBuddy replacement credibility requires all of the following:

- users can rely on EvoBuddy for useful Buddy use and learning, not just manual Buddy invocation;
- any orchestration discipline is either unnecessary, minimal, evolved, or explicitly optional with evidence;
- OpenCode/Claude/Codex product paths are described with honest actual evidence;
- durable evolution materially improves future Buddy or practice behavior;
- release/readiness reports can distinguish blocked, fail, pass, and compatibility tiers without ambiguity.

## 13. Bottom Line

The winning story is not:

```text
"EvoBuddy helps OMO call a Buddy."
```

It is also not automatically:

```text
"EvoBuddy ships a better fixed parent prompt than OMO."
```

The winning story is:

```text
"EvoBuddy gives coding agents a visible, durable, self-improving Buddy organization.
If orchestration is needed, it evolves from real project work instead of being
hardcoded as universal prompt discipline."
```

That is the bar required to justify asking users to remove OMO and keep EvoBuddy instead.
