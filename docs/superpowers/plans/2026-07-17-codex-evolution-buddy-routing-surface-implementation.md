# Codex Evolution Buddy Routing Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Codex treat a narrow repeated durable-evolution task class as route-by-default to `evolution-buddy` without weakening `naturalUse`, then close the current release blocker with a fresh Codex natural-use proof or an honest retained blocker.

**Architecture:** Change the Codex-facing routing surface at the source-of-truth layer (`codex-member-instructions`, `evolution-buddy.json`, `evolution-buddy/BUDDY.md`) so the generated parent instructions and `.codex` TOML agree on an operational trigger with reject conditions. Verify the change through focused render/projection tests, then run a live Codex correction loop using the existing exporter/proof path instead of adding a new harness.

**Tech Stack:** Node.js ESM, repo-local preset projection, Codex CLI session export, native-buddy proof validators, node:test.

## Global Constraints

- Keep `naturalUse` fail-closed on mechanism-named prompts.
- Do not weaken proof semantics or relabel mechanism-guided evidence as natural-use.
- Parent-facing Codex routing guidance should avoid runtime-internal mechanism vocabulary when that vocabulary can live in proof/export/runtime-observation docs instead.
- Treat the synced `.codex/agents/evolution_buddy.toml` description as a core routing signal, not a passive mirror.
- Add negative controls for docs-only rewrite and single ordinary specialist task so `evolution-buddy` does not become an over-routing sink.
- Fresh Codex natural-use proof must pass, or the correction loop remains open and release closure remains blocked.
- Preserve the existing project constraint: subagent-driven, no worktree.

---

## Concrete Examples

### Example 1: Repeated release-proof confusion should route

- **Example:** `Repeated corrected release-proof work shows that retained eval outputs keep being mistaken for shipping proof. Decide the durable project-behavior change that should prevent recurrence.`
- **Expected result:** Mechanism-clean prompt, Codex routes to native `evolution_buddy`, exported proof remains eligible for `naturalUse`.
- **Verification:** Live Codex run + `export-codex-session-corpus.mjs` + `export-codex-native-buddy-surface-proof.mjs --proof-layer naturalUse` pass.
- **Failure signal:** Codex stays local and returns a concise recommendation with no native spawn evidence.
- **If it fails:** Return to implementation correction loop unless runtime-capability absence is demonstrated honestly.

### Example 2: Docs-only rewrite should stay local

- **Example:** `Rewrite this proof summary for clarity and shorten the wording.`
- **Expected result:** No `evolution_buddy` spawn; local answer remains correct.
- **Verification:** Negative-control test covering routing hints and generated surfaces.
- **Failure signal:** Route-by-default wording causes `evolution-buddy` to appear eligible for pure wording cleanup.
- **If it fails:** Return to implementation because reject conditions are too weak.

### Example 3: Ordinary specialist fix should stay local

- **Example:** `Fix this concrete failing test in the existing runtime proof exporter.`
- **Expected result:** No `evolution_buddy` spawn; ordinary bounded specialist work remains local or routes elsewhere.
- **Verification:** Negative-control test covering preset hints and generated Codex surfaces.
- **Failure signal:** `evolution-buddy` becomes a generic sink for normal implementation/debugging work.
- **If it fails:** Return to implementation because the route class is too broad.

### Invariants

- Invariant 1: User-visible prompts remain mechanism-clean.
- Invariant 2: Parent-facing routing guidance avoids runtime-internal mechanism vocabulary.
- Invariant 3: Generated `.codex` TOML, parent instructions, preset JSON, and `BUDDY.md` must agree semantically.
- Invariant 4: Release stays blocked until fresh Codex natural-use proof passes or a real runtime limitation is proven.

## File Structure

- Modify: `src/install/codex-member-instructions.mjs` — remove runtime-internal mechanism wording from parent-facing guidance; add narrow route-by-default rule and reject conditions.
- Modify: `src/presets/buddies/evolution-buddy.json` — convert description/activation hints into operational triggers; align negative hints to reject conditions.
- Modify: `src/presets/buddies/evolution-buddy/BUDDY.md` — make this task class explicitly task-owned by `evolution-buddy` while keeping concise return shape.
- Modify: `test/install/codex-member-instructions.test.mjs` — flip expectations away from mechanism-word contamination and toward obligation/reject-condition wording.
- Modify: `test/core/buddy-presets.test.mjs` — assert operational trigger language and negative controls.
- Modify: `test/product/evobuddy-parent-affordance.test.mjs` — preserve “light affordance only” while allowing narrow route-by-default wording for `evolution-buddy` rather than globally forbidding it.
- Create: `test/install/codex-evolution-buddy-routing-surface.test.mjs` — assert generated `.codex/agents/evolution_buddy.toml` and installed/synced Codex parent instructions stay consistent and preserve Examples 1-3 / Invariants 1-3.
- Modify generated outputs via sync (do not hand-edit): `.codex/agents/evolution_buddy.toml`, `.evobuddy/instructions/codex-parent-instructions.md`.

### Task 1: Rewrite parent-facing Codex routing guidance

**Files:**
- Modify: `src/install/codex-member-instructions.mjs`
- Test: `test/install/codex-member-instructions.test.mjs`

**Example:** preserves Invariant 1 | preserves Invariant 2 | implements Example 1

**Interfaces:**
- Consumes: `renderCodexMemberInstructions({ registry?, updateSummaryRef? }) => string`
- Produces: Updated parent-instruction text contract for Codex, still installed by `installCodexMemberInstructions({ projectRoot })`

- [ ] **Step 1: Write the failing test expectations for clean parent guidance**

Replace the mechanism-word assertions in `test/install/codex-member-instructions.test.mjs` with expectations like:

```js
assert.match(text, /\.codex\/agents\/<member>\.toml/i);
assert.match(text, /route to `evolution-buddy` by default|default route to evolution-buddy/i);
assert.match(text, /docs-only rewrite without behavior change/i);
assert.match(text, /single ordinary specialist task/i);
assert.doesNotMatch(text, /apply_role_to_config|apply_spawn_agent_runtime_overrides|apply_requested_spawn_agent_model_overrides|HOOK_EVENT_NAMES/i);
assert.doesNotMatch(text, /spawn_agent-style collaboration/i);
assert.doesNotMatch(text, /fallback adapter/i);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test "test/install/codex-member-instructions.test.mjs"`

Expected: FAIL because current text still contains runtime-internal mechanism wording and does not contain narrow route-by-default wording.

- [ ] **Step 3: Update `renderCodexMemberInstructions()` with the exact new routing contract**

Replace the current mechanism-heavy paragraph block in `src/install/codex-member-instructions.mjs` with wording shaped like:

```js
return `# EvoBuddy Buddies

This project has EvoBuddy Buddies available through Codex's native Buddy surface.

Synced Buddy definitions live at \.codex/agents/<member>.toml and are the normal Buddy surface for Codex.

Use a Buddy when a task clearly benefits from an independent specialist context. Keep the parent agent as the user-facing owner, and use the Buddy result as input to the parent answer.

Write a normal consequential task description for the fitting Buddy. The parent supplies the task prompt, and the Buddy should return the result to the parent rather than creating proof sections or repeated canaries.

Active Buddies:

${activeBuddyLines(registry).join('\n')}

Check recent updates when behavior may have changed. Recent EvoBuddy updates may be summarized at \`${updateSummaryRef}\` when present.

Route to \`evolution-buddy\` by default when repeated, corrected, hard-case, or completed work points to one durable project-behavior change for Buddies, skills, routing, return contracts, or proof-boundary handling.

Keep the task local when it is a docs-only rewrite without behavior change, proof report formatting only, a single ordinary specialist task, or a one-off recommendation without a repeated durable signal.

Do not treat these instructions as proof that a Buddy was used. Runtime/exporter evidence is required for product proof.

Do not instruct the model to repeat canaries, emit proof sections, or name adapter mechanisms when testing natural Buddy routing.
`;
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test "test/install/codex-member-instructions.test.mjs"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/codex-member-instructions.mjs test/install/codex-member-instructions.test.mjs
git commit -m "feat: tighten codex evolution routing guidance"
```

### Task 2: Convert the evolution-buddy preset into an operational trigger

**Files:**
- Modify: `src/presets/buddies/evolution-buddy.json`
- Modify: `src/presets/buddies/evolution-buddy/BUDDY.md`
- Test: `test/core/buddy-presets.test.mjs`
- Test: `test/product/evobuddy-preset-roster-product.test.mjs`

**Example:** implements Example 1 | implements Example 2 | implements Example 3 | preserves Invariant 3

**Interfaces:**
- Consumes: Product preset loader/resolver in `src/core/buddy-presets.mjs`
- Produces: Updated preset profile and role memory that drive synced runtime surfaces

- [ ] **Step 1: Write failing preset assertions for operational trigger language**

Extend `test/core/buddy-presets.test.mjs` with expectations like:

```js
assert.match(member.profile.description, /route by default|default route|repeated corrected|durable project-behavior/i);
assert.ok(member.profile.activationHints.some((hint) => /repeated corrected|proof-boundary handling|durable project-behavior/i.test(hint)));
assert.ok(member.profile.negativeActivationHints.some((hint) => /docs-only rewrite|single ordinary specialist task/i.test(hint)));
```

Add role-memory coverage in `test/product/evobuddy-preset-roster-product.test.mjs` for `evolution-buddy`:

```js
if (name === 'evolution-buddy') {
  assert.match(content, /task-owned by evolution-buddy|route by default/i);
  assert.match(content, /docs-only|ordinary specialist task/i);
}
```

- [ ] **Step 2: Run the focused preset tests to verify they fail**

Run: `node --test "test/core/buddy-presets.test.mjs" "test/product/evobuddy-preset-roster-product.test.mjs"`

Expected: FAIL because the current preset is still topical and the role memory does not yet say this class is task-owned by `evolution-buddy`.

- [ ] **Step 3: Update the preset JSON and `BUDDY.md` with exact operational wording**

Use wording shaped like:

```json
{
  "description": "Route by default when repeated corrected or hard-case work reveals one durable project-behavior change to Buddies, skills, routing, return contracts, or proof-boundary handling.",
  "activationHints": [
    "repeated corrected durable-evolution work",
    "durable project-behavior change",
    "release-proof confusion or proof-boundary handling recurrence",
    "shipping proof vs retained eval separation",
    "routing or return-contract correction"
  ],
  "negativeActivationHints": [
    "single ordinary specialist task",
    "docs-only rewrite without behavior change",
    "proof report formatting only",
    "one-off recommendation without repeated durable signal"
  ]
}
```

In `src/presets/buddies/evolution-buddy/BUDDY.md`, adjust `## Scope` so it says this narrow class is task-owned by `evolution-buddy`, while preserving concise return shape and reject conditions.

- [ ] **Step 4: Run the focused preset tests to verify they pass**

Run: `node --test "test/core/buddy-presets.test.mjs" "test/product/evobuddy-preset-roster-product.test.mjs"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presets/buddies/evolution-buddy.json src/presets/buddies/evolution-buddy/BUDDY.md test/core/buddy-presets.test.mjs test/product/evobuddy-preset-roster-product.test.mjs
git commit -m "feat: make evolution buddy routing operational"
```

### Task 3: Synchronize generated Codex surfaces and add consistency tests

**Files:**
- Modify: `test/product/evobuddy-parent-affordance.test.mjs`
- Create: `test/install/codex-evolution-buddy-routing-surface.test.mjs`
- Generated by sync: `.codex/agents/evolution_buddy.toml`
- Generated by sync: `.evobuddy/instructions/codex-parent-instructions.md`

**Example:** implements Example 1 | implements Example 2 | implements Example 3 | preserves Invariant 2 | preserves Invariant 3

**Interfaces:**
- Consumes: `renderCodexMemberInstructions()`, synced preset projection outputs, `node scripts/evobuddy/evobuddy.mjs buddies sync --project <path> --json`
- Produces: A stable test seam for generated Codex-visible routing surfaces

- [ ] **Step 1: Write failing consistency tests for parent affordance and synced outputs**

In `test/product/evobuddy-parent-affordance.test.mjs`, narrow the global ban so `evolution-buddy` may be route-by-default without letting the whole parent instruction surface turn into a fixed workflow. Replace the broad `delegate by default` ban with a narrower assertion such as:

```js
assert.doesNotMatch(content, /always plan|always explore|planner.*critic.*executor|Sisyphus-high|Prometheus/i);
assert.match(content, /route to `evolution-buddy` by default|default route to evolution-buddy/i);
```

Create `test/install/codex-evolution-buddy-routing-surface.test.mjs` with checks like:

```js
assert.match(toml, /description = ".*route by default.*durable project-behavior/i);
assert.match(toml, /docs-only rewrite without behavior change/i);
assert.match(toml, /single ordinary specialist task/i);
assert.doesNotMatch(parent, /apply_role_to_config|HOOK_EVENT_NAMES|spawn_agent-style collaboration|fallback adapter/i);
```

- [ ] **Step 2: Run the focused product tests to verify they fail**

Run: `node --test "test/product/evobuddy-parent-affordance.test.mjs" "test/install/codex-evolution-buddy-routing-surface.test.mjs"`

Expected: FAIL because the current synced outputs and affordance test still reflect the old advisory / mechanism-heavy wording.

- [ ] **Step 3: Sync Buddies and verify generated outputs change as intended**

Run: `node scripts/evobuddy/evobuddy.mjs buddies sync --project "/home/prosumer/agent/context-tree" --json`

Expected: PASS with updated generated files, including:

```text
.codex/agents/evolution_buddy.toml
.evobuddy/instructions/codex-parent-instructions.md
```

After sync, verify by inspection that:

- TOML `description` is an operational trigger, not just a topic summary;
- TOML activation hints contain the route class and negative controls;
- parent instructions are mechanism-clean and use the same route class.

- [ ] **Step 4: Run the focused product tests to verify they pass**

Run: `node --test "test/product/evobuddy-parent-affordance.test.mjs" "test/install/codex-evolution-buddy-routing-surface.test.mjs"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/product/evobuddy-parent-affordance.test.mjs test/install/codex-evolution-buddy-routing-surface.test.mjs .codex/agents/evolution_buddy.toml .evobuddy/instructions/codex-parent-instructions.md
git commit -m "test: lock codex routing surface consistency"
```

### Task 4: Run the release-blocking Codex naturalUse correction loop

**Files:**
- Evidence output dir: `/tmp/opencode/evobuddy-evolution-buddy-live-20260717/codex-natural-route-obligation`
- Uses existing scripts: `scripts/context-tree/export-codex-session-corpus.mjs`, `scripts/context-tree/export-codex-native-buddy-surface-proof.mjs`
- Re-check release gate inputs after proof generation

**Example:** implements Example 1 | observes Example 1 | preserves Invariant 1 | preserves Invariant 4

**Interfaces:**
- Consumes: Updated synced Codex surfaces, live Codex CLI run, existing corpus exporter, existing proof exporter
- Produces: Fresh Codex natural-use proof or retained blocking evidence for the next correction cycle

- [ ] **Step 1: Run one mechanism-clean should-route Codex turn**

Run:

```bash
"/home/prosumer/.nvm/versions/node/v24.11.1/bin/codex" exec "Repeated corrected release-proof work shows that retained eval outputs keep being mistaken for shipping proof. Decide the durable project-behavior change that should prevent recurrence." 
```

Expected: Command returns a session id and completes without naming the mechanism in the user prompt.

- [ ] **Step 2: Export the fresh Codex session corpus**

Run:

```bash
node scripts/context-tree/export-codex-session-corpus.mjs --codex-home "/home/prosumer/.codex" --project-identity "/home/prosumer/agent/context-tree" --baseline-report "/home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json" --out "/tmp/opencode/evobuddy-evolution-buddy-live-20260717/codex-natural-route-obligation/corpus"
```

Expected: PASS and writes `session-corpus-export.json` plus manifest.

- [ ] **Step 3: Export the Codex naturalUse proof from the fresh corpus**

Run:

```bash
node scripts/context-tree/export-codex-native-buddy-surface-proof.mjs --session-corpus "/tmp/opencode/evobuddy-evolution-buddy-live-20260717/codex-natural-route-obligation/corpus/session-corpus-export.json" --baseline-report "/home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json" --member "evolution-buddy" --proof-layer "naturalUse" --out "/tmp/opencode/evobuddy-evolution-buddy-live-20260717/codex-natural-route-obligation/runtime-native-buddy-surface-proof.json"
```

Expected: PASS, with native parent-child evidence, returned-to-parent evidence, and no `mechanismNamedPrompt` failure.

- [ ] **Step 4: If proof export fails, run the correction loop**

For each failure:

1. Retain the failing evidence: Codex session id, exporter stdout/stderr, corpus manifest path, proof export error, and any generated proof JSON.
2. Classify the root cause: routing-surface defect, generated-surface mismatch, exporter/proof defect, live runtime no-trigger, or demonstrated runtime limitation.
3. Write or update a failing regression test for routing-surface or proof defects before changing code.
4. Implement the minimal root-cause fix. Do not weaken gates or relabel mechanism-guided evidence.
5. Run the focused test for that fix. Expected: PASS.
6. Rerun Step 1 through Step 3. Expected: PASS, or the same honest blocked result with better retained evidence.
7. Compare the new evidence to the original failure. If the underlying native routing behavior did not change, do not claim closure.
8. Repeat until fresh Codex natural-use proof passes, a human decision is needed, or a real runtime-capability absence is demonstrated honestly.

- [ ] **Step 5: Re-run the release-facing evaluation inputs only after fresh Codex naturalUse proof exists**

Run the same release/readiness chain already used for this slice, with the new Codex natural root substituted into the existing OpenCode/Claude passing chain.

Expected: Only claim closure if the release and readiness reports now pass honestly. If Codex natural-use is still blocked, release stays blocked.

- [ ] **Step 6: Record the live evidence location and closure state**

Record in the task notes or handoff:

```text
/tmp/opencode/evobuddy-evolution-buddy-live-20260717/codex-natural-route-obligation
```

Expected: the retained evidence path, final proof verdict, and release-blocker state are captured explicitly. Do not try to commit `/tmp` artifacts into the repo.

## Self-Review Checklist

- Spec coverage: Tasks 1-3 implement the parent-guidance, preset, TOML-core-signal, and negative-control requirements; Task 4 implements the release-blocking live proof loop.
- Example verification: Example 1 is tied to Task 4; Examples 2 and 3 are tied to Tasks 2 and 3; invariants are preserved across tasks.
- Placeholder scan: No TBD/TODO placeholders remain; each task names exact files and commands.
- Architecture ownership: The plan keeps routing ownership in product-facing guidance/preset surfaces and keeps mechanism vocabulary in exporter/proof paths rather than promoting support machinery into product contract.
