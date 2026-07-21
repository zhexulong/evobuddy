# Codex Evolution Buddy Routing Surface Design

## 0. Conclusion

Codex natural-use for `evolution-buddy` is currently blocked not because the
runtime-native proof gate is too strict, but because the Codex-visible routing
surface still presents `evolution-buddy` mainly as a **good fit for a topic**
rather than an **operational default executor** for a narrow class of durable
evolution work.

The corrected design is:

```text
mechanism-clean user prompt
  + repeated corrected or hard-case signal
  + durable project-behavior question
  + proof-boundary / routing / return-contract recurrence
    -> Codex-visible routing surface marks this class as route-by-default
       to evolution-buddy unless a reject condition applies
    -> Codex chooses native buddy routing from installed runtime definitions
    -> proof remains naturalUse because the user prompt never names the mechanism
```

The immediate design decision is:

- keep `naturalUse` fail-closed on mechanism-named prompts;
- upgrade Codex-facing guidance from **advisory fit** to **route obligation with
  explicit reject conditions** for a narrow class of durable-evolution tasks;
- keep the user prompt mechanism-clean and natural-language only;
- update the Codex-visible parent instructions, preset description, activation
  hints, and strong-fit examples so Codex treats this class as independent
  specialist-context work instead of a concise local recommendation task.

This is a routing-surface correction, not a proof-semantic weakening.

## 1. Problem

Current evidence is consistent across the reviewed live Codex runs:

1. The only prompt that produced native `evolution_buddy` spawn was the
   mechanism-named run at `2026-07-17T01:16:27`, which explicitly said to
   “use the best native Buddy if appropriate”.
2. Every mechanism-clean rerun stayed local.
3. Mechanism-clean reruns consistently framed `evolution-buddy` as the
   **subject of a concise recommendation**:
   - behavior change
   - operating-rule change
   - return-contract change
   - buddy routing improvement
4. Codex's own resumed explanation confirms the threshold failure:
   it interpreted “buddy routing” as the subject of the answer, not as the
   mechanism for producing the answer.

The current synced routing surface therefore tells Codex:

- what `evolution-buddy` is about;
- several strong-fit examples;
- that `evolution-buddy` should be considered after repeated or corrected work.

But it does **not** tell Codex strongly enough that a narrow class of repeated,
durable behavior-change tasks should leave the parent's local judgment path and
be routed to `evolution-buddy` by default.

## 2. Design Goal

The routing surface should answer:

```text
When a mechanism-clean user task presents a repeated durable-evolution signal,
should Codex treat evolution-buddy as merely relevant context,
or as the default independent specialist route?
```

The design target is:

```text
default independent specialist route,
unless the task matches a narrow reject condition
```

Success here does not guarantee immediate live Codex natural-use pass, but it
does create the missing product surface that the current threshold evidence says
Codex is relying on.

## 3. Product Boundary

### 3.1 This Design Does

- change Codex-facing routing guidance so a narrow task class becomes
  route-by-default rather than merely a strong fit;
- preserve natural-use semantics by keeping user prompts mechanism-clean;
- define positive route conditions and explicit reject conditions;
- align the preset metadata, parent instructions, and role memory around the
  same routing obligation;
- create a specifiable behavior contract for future live Codex reruns.

### 3.2 This Design Does Not

- weaken `naturalUse` proof semantics;
- relabel mechanism-named prompts as natural-use;
- add fake task metadata to the user prompt;
- keep runtime-internal mechanism vocabulary in parent-facing routing guidance
  when that vocabulary can be isolated to proof/export/runtime-observation docs;
- force direct adapter invocation, `spawn_agent`, `wait_agent`, `task`, or
  `subagent` wording into user-visible prompts;
- claim that one more prompt retry alone is a sufficient fix.

### 3.3 Proof-Hygiene Boundary

Parent-facing Codex routing guidance should not carry runtime-internal terms
unless they are strictly necessary for user-visible routing behavior.

That means the implementation should prefer this split:

- **parent-facing routing guidance**
  - consequence-pattern routing rules;
  - route obligation and reject conditions;
  - Buddy fit and return expectations.
- **runtime/proof/export docs**
  - native spawn terminology;
  - hook/runtime-internal symbols;
  - exporter/proof pipeline vocabulary;
  - fallback adapter boundary details.

This is not because product instructions are currently part of the
`mechanismNamedPrompt` classifier. The current validator derives that control
from the prompt text, not from installed instructions. The point is to reduce
product-surface contamination and keep natural-use routing guidance legible and
clean.

## 4. Threshold Findings That Motivate The Design

### 4.1 What Crossed The Threshold

The reviewed `01:16:27` run crossed the threshold only because the prompt made
buddy use operational:

```text
use the best native Buddy if appropriate
```

That is enough for native routing, but it is mechanism-named and therefore not
eligible for `naturalUse` closure.

### 4.2 What Did Not Cross The Threshold

The mechanism-clean runs did not spawn even when they named durable-evolution
topics, including:

- durable EvoBuddy behavior change
- operating-rule or return-contract change
- buddy routing improvement
- release-proof confusion / shipping-proof vs retained-eval correction

Common pattern:

- concise recommendation requested;
- local judgment was sufficient;
- no operational indication that the task should leave the parent's local path.

### 4.3 Structural Conclusion

This is a routing-surface design problem, not a validator bug and not evidence
that Codex native buddy routing is impossible.

## 5. Approaches Considered

### 5.1 Approach A — Stronger Advisory Wording Only

Keep the current “consider / strong fit” model, but make examples sharper.

**Pros**

- smallest diff;
- low risk of over-routing.

**Cons**

- likely repeats current failure mode;
- still leaves the parent free to treat the task as local concise judgment;
- does not operationalize the distinction found in the threshold evidence.

### 5.2 Approach B — Route Obligation With Reject Conditions

Upgrade the Codex-visible surface so a narrow consequence pattern becomes
route-by-default unless an explicit reject condition applies.

**Pros**

- directly addresses the observed threshold gap;
- keeps the user prompt mechanism-clean;
- preserves honest natural-use semantics;
- creates a clear behavior contract for future tests and live reruns.

**Cons**

- requires careful wording so it does not over-trigger;
- requires the preset metadata, parent instructions, and role memory to agree.

### 5.3 Approach C — Structured Eligibility Metadata

Introduce an explicit structured routing flag or classification block.

**Pros**

- strongest mechanical control.

**Cons**

- larger product change;
- risks moving away from natural runtime routing toward artificial scaffolding;
- unnecessary before trying a cleaner operational routing surface.

## 6. Recommended Direction

Adopt **Approach B**.

The key product rule should be:

```text
For Codex, when a task presents repeated corrected or hard-case work and asks
for one durable project-behavior change to Buddies, skills, routing,
return contracts, or proof-boundary handling, route to evolution-buddy by
default unless the task is docs-only, formatting-only, or a single ordinary
specialist task.
```

That means the routing surface should stop at “default route” and not escalate
to “always route”. The reject conditions are part of the product behavior, not
just cautionary prose.

## 7. Behavior Contract

### 7.1 Positive Route Conditions

Codex should prefer native `evolution-buddy` routing when all of the following
are materially present:

1. **Repeatedness or correction signal**
   - repeated hard case
   - repeated user correction
   - repeated release-proof confusion
   - completed/corrected work revealing durable improvement need

2. **Durable project-behavior target**
   - change to buddy routing
   - change to return contract
   - change to proof-boundary handling
   - change to skill guidance
   - change to existing buddy update surface

3. **Independent specialist-context value**
   - task is not just “give one opinion”;
   - task benefits from source-backed classification, risking, validation, and
     rollback framing consistent with `evolution-buddy` output.

### 7.2 Reject Conditions

Codex should stay local when the task is:

- a docs-only rewrite without behavior change;
- proof report formatting only;
- a single ordinary specialist task;
- a one-off recommendation with no repeated durable signal;
- a task whose only output need is brief local phrasing rather than durable
  routing / behavior evolution.

### 7.3 Invariants

- user prompt remains mechanism-clean;
- no user-visible requirement to mention `spawn_agent`, `wait_agent`, `task`,
  `subagent`, or adapter commands;
- `naturalUse` still fails closed when the user prompt names the mechanism;
- route obligation must stay narrow enough that ordinary review/debug/design
  tasks are not swallowed by `evolution-buddy`.

## 8. Surfaces To Change

The routing obligation should be expressed consistently in these product-owned
surfaces:

1. `src/install/codex-member-instructions.mjs`
   - change from “Consider `evolution-buddy`...” to a route-by-default rule with
     reject conditions.

2. `src/presets/buddies/evolution-buddy.json`
   - tighten `description`;
   - refine `activationHints` toward consequence-pattern language;
   - keep `negativeActivationHints` aligned with reject conditions.

3. `src/presets/buddies/evolution-buddy/BUDDY.md`
   - strengthen the scope/routing language so strong-fit examples are clearly
     route-worthy, not just contextually relevant.

4. generated outputs after sync
    - `.codex/agents/evolution_buddy.toml`
    - `.evobuddy/instructions/codex-parent-instructions.md`

### 8.1 TOML Description Is A Core Routing Surface

For Codex, the synced `.codex/agents/evolution_buddy.toml` description is a
core routing signal, not a passive mirror.

The implementation should therefore treat:

- TOML `description`
- TOML `developer_instructions` activation hints
- generated parent instructions
- source preset description / activation / role memory

as one routing contract that must agree semantically.

The TOML `description` should become an operational trigger for the narrow
route-by-default class, not just a topical summary of what `evolution-buddy`
knows about.

## 9. Behavior Evaluation

### 9.1 Should Route Example

```text
Repeated corrected release-proof work shows that retained eval outputs keep
being mistaken for shipping proof. Decide the durable project-behavior change
that should prevent recurrence.
```

Expected result:

- mechanism-clean prompt;
- Codex chooses native `evolution_buddy` route;
- exported proof remains eligible for `naturalUse`.

### 9.2 Should Stay Local Example

```text
Rewrite this proof summary for clarity and shorten the wording.
```

Expected result:

- no `evolution_buddy` spawn;
- local answer remains correct.

### 9.2.1 Negative Control — Docs-Only Rewrite

```text
Rewrite this proof summary for clarity and shorten the wording.
```

Expected result:

- no `evolution_buddy` spawn;
- local answer remains correct;
- no route-obligation wording causes over-trigger.

### 9.2.2 Negative Control — Ordinary Specialist Task

```text
Fix this concrete failing test in the existing runtime proof exporter.
```

Expected result:

- no `evolution_buddy` spawn;
- ordinary specialist/debugging route remains available;
- route obligation does not turn `evolution-buddy` into a generic sink.

### 9.3 Failure Signals

- mechanism-clean repeated durable-evolution prompt still yields local concise
  recommendation with no spawn;
- revised routing obligation causes obvious over-trigger on ordinary review or
  formatting tasks;
- generated Codex surfaces disagree about what constitutes a route obligation.

### 9.4 Observable Evidence

- synced `.codex` and `.evobuddy` outputs contain consistent obligation wording;
- live Codex rerun shows `spawn_agent` / parent-child evidence without
  mechanism-named prompt terms;
- exported Codex natural-use proof passes without weakening the validator.

### 9.5 Correction Path

If the first post-design live rerun still stays local, the next correction
should not be another arbitrary prompt rewrite. It should inspect whether:

- the obligation wording is still too advisory;
- the route class is too broad or too narrow;
- the Codex-visible `.toml` description and parent instructions disagree;
- `evolution-buddy` output shape still looks optional rather than task-owned.

## 10. Testing And Verification Plan

At implementation time, verification should cover:

1. unit tests for rendered Codex parent instructions;
2. preset tests for `evolution-buddy` description / activation / negative hints;
3. sync output checks for generated `.codex` and `.evobuddy` files;
4. focused live Codex rerun with mechanism-clean prompt chosen from the
   `should route` class above;
5. exporter + proof validation using the existing
   `export-codex-session-corpus.mjs` and
   `export-codex-native-buddy-surface-proof.mjs` path.

### 10.1 Release-Blocker Requirement

For the current closure effort, fresh Codex natural-use proof is not optional
hardening. It is a release blocker.

Implementation and follow-up eval must therefore treat this condition as
mandatory:

```text
fresh Codex naturalUse proof must pass,
or the correction loop remains open and release closure remains blocked.
```

If routing-surface changes land and Codex natural-use is still blocked, the
result is not “good enough because the wording improved”. The correct outcome is
another correction loop with retained failure evidence, unless runtime-capability
absence is demonstrated honestly.

## 11. Non-Overclaim Boundary

This design does not claim that the next live run will certainly pass. It claims
that the current product routing surface is underspecified for the natural-use
threshold that Codex is actually applying, and that this routing-surface change
is the correct next fix to test before any further proof-semantic changes.
