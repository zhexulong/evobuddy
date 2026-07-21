# OpenCode Natural-Use Skill-Designer Authority Repair V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover a release-grade OpenCode `naturalUse` proof for `skill-designer` without weakening the release gate by first isolating scenario-wording effects, then repairing the authoritative EvoBuddy member surface only if neutral wording still misroutes.

**Architecture:** Treat the current OpenCode `oracle` natural-use artifact as a valuable negative control, not a bug. Phase 1 changes only the OpenCode natural-use parent prompt and capture artifacts so we can test whether a real skill-design review request naturally routes to `skill-designer`. Prepared invocation packets may be produced as exporter/matching anchors, but they must not be handed to the parent agent as instructions for natural-use routing. If neutral parent wording still misroutes, Phase 2 repairs the actual EvoBuddy authority chain—preset registry, preset profile/definition, seeded `.evobuddy` registry, and regenerated runtime projections—rather than hand-editing `.opencode/agents/skill-designer.md`.

**Tech Stack:** Node.js ESM, `node:test`, EvoBuddy preset loader/state seeding, member projection installer, OpenCode session-corpus export CLI, OpenCode native Buddy task prepare/export/finalize CLIs, release/readiness CLIs, JSON reports under `.evobuddy/` and `/tmp`.

**Current proof status as of 2026-07-15:** The no-OMO OpenCode natural-use run now proves the product routing point: with OMO/global workflow injection removed, OpenCode naturally selected `skill-designer` for the skill-design review scenario and the natural-runtime-route exporter produced passing proof artifacts. The current successful proof bundle is:

- Proof: `/tmp/evobuddy-release-grade-live-20260715/opencode-no-omo-natural-use/natural-root-opencode/opencode-native-buddy-task-proof.json`
- Summary: `/tmp/evobuddy-release-grade-live-20260715/opencode-no-omo-natural-use/natural-root-opencode/opencode-native-buddy-task-proof-summary.json`
- Runtime-native proof: `/tmp/evobuddy-release-grade-live-20260715/opencode-no-omo-natural-use/natural-root-opencode/runtime-native-buddy-surface-proof.json`

The summary reports `status: "pass"`. The runtime-native proof reports `runtime: "opencode"`, `proofLayer: "naturalUse"`, `memberName: "skill-designer"`, `runtimeAgentName: "skill-designer"`, `baselineProjectionPass: true`, `nativeMechanismPass: true`, `naturalUsePass: true`, `negativeControls.mechanismNamedPrompt: false`, and `knownLosses: []`. This closes the OpenCode no-OMO natural-use proof slice.

**Aggregate MVP closure as of 2026-07-15:** The three-runtime release evaluator has now been rerun with the no-OMO OpenCode natural-use root and passed. The saved release report is `/tmp/evobuddy-release-grade-live-20260715/release-out/three-runtime-buddy-surface-release-report.json`; it reports `verdict: "pass"`, `aggregate.baselineProjectionPass: true`, `aggregate.nativeMechanismPass: true`, and `aggregate.naturalUsePass: true`. The `opencode`, `claude`, and `codex` runtime entries each report `status: "pass"`, `baselineProjectionPass: true`, `nativeMechanismPass: true`, `naturalUsePass: true`, `issues: []`, `blockedReasons: []`, and `knownLosses: []`. The release evaluator points OpenCode natural use at `/tmp/evobuddy-release-grade-live-20260715/opencode-no-omo-natural-use/natural-root-opencode/runtime-native-buddy-surface-proof.json`.

The product readiness evaluator has also been rerun and passed. The saved readiness report is `/tmp/evobuddy-release-grade-live-20260715/readiness-out/product-release-readiness-report.json`; it reports `verdict: "pass"`, `gates.releaseReport.status: "pass"`, `gates.productObservedProof.status: "pass"`, `gates.durableApply.status: "pass"`, and `gates.naturalUseBenchmark.status: "pass"`. This closes the release-grade MVP proof boundary for no-OMO three-runtime Buddy projection, native mechanism, natural use, durable apply, and readiness. OMO-hosted routing compatibility remains a separate follow-up track and is not part of this MVP pass claim.

## Global Constraints

- Keep the current OpenCode failing natural-use artifact as an explicit negative control; do not overwrite `/tmp/evobuddy-release-grade-live-20260714/natural-root-opencode/runtime-native-buddy-surface-proof.json`.
- Do not weaken the release gate, validator, or proof taxonomy to accept `oracle` when the requested member is `skill-designer`.
- Phase 1 is prompt-only: no registry, preset, projection, or runtime-definition edits are allowed before the prompt-only recapture result is known.
- Phase 1 parent prompt must not instruct OpenCode to use a prepared Buddy prompt, child task prompt, adapter command, or named mechanism. Prepared files are allowed only as exporter/matching anchors after the runtime has produced evidence.
- If Phase 1 still routes to `oracle` or another wrong Buddy, stop prompt tuning and move to Phase 2 authority repair.
- Do not hand-edit `.opencode/agents/skill-designer.md` as the final fix. The authoritative path is `src/presets/buddies/*` → `.evobuddy/registry.json` → projection/sync outputs.
- Fix the active `skill-designer` surface through authoritative preset/profile/definition sources only; retained `fixtures/` files remain test data, not product authority.
- Phase 2 must remove fixture-derived role-memory drift from the active runtime definition path; active projections must not depend on unreadable `fixtures/docs/...` paths.
- Claude and Codex proof roots stay unchanged throughout Phase 1 and Phase 2 unless a later verification command proves they regressed.
- Do not commit unless the user explicitly asks.

## Phase Gates

- **Phase 1 stop condition:** stop after Task 0 only when the fresh OpenCode natural root proves `observedRuntimeAgentName === "skill-designer"`, `negativeControls.mechanismNamedPrompt === false`, and `naturalUsePass === true`, and the one-shot release/readiness rerun no longer fails because of OpenCode natural-use.
- **Phase 1 escalation condition:** if the fresh mechanism-clean prompt still routes to `oracle` or another wrong Buddy, or if the root still fails member identity despite clean prompt evidence, start Task 1 immediately.
- **Phase 1 skip rule:** if Task 0 succeeds and the one-shot release/readiness rerun no longer fails because of OpenCode natural-use, stop the implementation and skip Tasks 1-3.
- **Phase 2 stop condition:** stop after Task 3 only when the post-repair OpenCode natural root passes and the rerun release/readiness reports no longer fail because of OpenCode natural-use.
- **Human-escalation condition:** if Task 3 still misroutes after authoritative repair and correction-loop fixes, retain the fresh evidence and ask for a product-routing decision instead of weakening the gate or continuing prompt iteration.

---

## Concrete Examples

### Example 1: Prompt-only recapture succeeds

- **Example:** A fresh OpenCode natural-use run uses a mechanism-clean skill-design review prompt, OpenCode naturally routes to `skill-designer`, the exported proof shows `negativeControls.mechanismNamedPrompt === false`, and the rerun release/readiness reports pass with the new OpenCode natural root.
- **Expected result:** The fresh OpenCode natural root records `observedRuntimeAgentName: "skill-designer"`, `proofLayer: "naturalUse"`, and `naturalUsePass: true`, while Claude/Codex remain unchanged.
- **Verification:** Exported proof JSON under `/tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/` plus successful reruns of `npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- ...` and `npm run evobuddy:run-product-release-readiness-eval -- ...`.
- **Failure signal:** The neutral prompt still routes to `oracle` or another wrong Buddy, or the proof root still fails for mechanism naming or missing parent return.
- **If it fails:** Keep the new artifact as evidence and move immediately to Phase 2 authority repair. Do not keep rewriting prompts.

### Example 2: Prompt-only recapture still misroutes and triggers authority repair

- **Example:** A fresh OpenCode natural-use run uses the neutral skill-design prompt, but the exported proof still shows `observedRuntimeAgentName !== "skill-designer"`.
- **Expected result:** The run is retained as evidence that wording alone is insufficient, and the implementation proceeds to authoritative preset/registry/projection repair.
- **Verification:** `opencode-native-buddy-task-proof-summary.json` and `runtime-native-buddy-surface-proof.json` under the new `/tmp` run root show a clean prompt (`mechanismNamedPrompt === false`) but still fail member identity.
- **Failure signal:** The implementation tries to “fix” the problem by editing `.opencode/agents/skill-designer.md` directly or by broadening the release gate.
- **If it fails:** Revert to the authoritative path: preset registry/profile/definition, `evobuddy setup`, and `evobuddy buddies sync`.

### Example 3: Authority repair restores an authoritative `skill-designer` runtime surface

- **Example:** `skill-designer` becomes a bundled preset member, the seeded `.evobuddy/registry.json` includes it, regenerated projections include it across runtimes, and the active OpenCode definition no longer points at fixture-derived unreadable role-memory sources.
- **Expected result:** Fresh setup/sync outputs include both `evolution-buddy` and `skill-designer`; generated `.opencode/agents/skill-designer.md` contains the broadened skill-review trigger language and no `fixtures/docs/...` known-loss path.
- **Verification:** Focused Node tests pass and `npm run evobuddy:setup -- --project /home/prosumer/agent/context-tree --runtime opencode` plus `npm run evobuddy:buddies-sync -- --project /home/prosumer/agent/context-tree` regenerate `.evobuddy/registry.json` and `context-tree-member-runtime-projections.json` with `skill-designer` present.
- **Failure signal:** `skill-designer` appears only in generated runtime files but not in the preset registry, project registry, or runtime-projection mapping.
- **If it fails:** Fix the preset authority sources and rerun setup/sync; do not patch generated files manually.

### Invariants

- Invariant 1: Negative controls stay retained and honest; a wrong-Buddy natural-use run remains a fail, not a pass.
- Invariant 2: Generated runtime definition files are outputs, never the authority surface.
- Invariant 3: Mechanism-clean natural-use and authoritative Buddy registration are distinct checks; Phase 1 can satisfy only the first.

---

## File Structure

- Modify `docs/superpowers/plans/2026-07-15-opencode-natural-use-skill-designer-authority-repair-v0.md` only for later status updates if needed; this plan is the execution spec.
- Modify `test/core/buddy-presets.test.mjs`: cover bundled `skill-designer` preset loading and seeding.
- Modify `test/core/evobuddy-project-state.test.mjs`: verify `ensureEvobuddyProjectState()` seeds both bundled Buddies and remains idempotent.
- Modify `test/install/member-projection-installer.test.mjs`: verify preset-backed `skill-designer` projections include the broadened runtime wording and avoid fixture-derived path drift.
- Create `src/presets/buddies/skill-designer.json`: authoritative bundled preset profile for `skill-designer`.
- Create `src/presets/buddies/skill-designer/BUDDY.md`: authoritative bundled Buddy definition/role-memory source for `skill-designer`.
- Modify `src/presets/buddies/registry.json`: add `skill-designer` to bundled preset membership.
- Use `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`, `scripts/context-tree/export-opencode-session-corpus.mjs`, `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`, `scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs`, `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`, and `scripts/context-tree/run-product-release-readiness-eval.mjs` as-is during capture/rerun tasks.

---

### Task 0: Run the prompt-only OpenCode natural-use recapture

**Files:**
- Use: `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`
- Use: `scripts/context-tree/export-opencode-session-corpus.mjs`
- Use: `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
- Use: `scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs`
- Use: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
- Use: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-prepared/`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-corpus/`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/release-out/three-runtime-buddy-surface-release-report.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/readiness-out/product-release-readiness-report.json`

**Example:** implements Example 1; observes Example 2; preserves Invariants 1 and 3

**Interfaces:**
- Consumes: existing OpenCode DB `/home/prosumer/.local/share/opencode/opencode.db`, existing mechanism root `/tmp/evobuddy-release-grade-live-20260714/product-root-opencode`, existing Claude/Codex roots under `/tmp/evobuddy-release-grade-live-20260714/`, and baseline report `/tmp/evobuddy-release-grade-live-20260714/recovered-skill-designer-live-baseline/context-tree-subagent-baseline-install-report.json`
- Produces: one fresh OpenCode natural-use proof bundle proving either prompt-only success, prompt-only insufficiency, or an exporter capability gap when natural runtime evidence cannot be matched to a prepared anchor without changing the parent prompt

- [ ] **Step 1: Prepare an OpenCode matching-anchor bundle without using it as the parent prompt**

Run:

```bash
mkdir -p /tmp/evobuddy-release-grade-live-20260715
npm run context-tree:prepare-opencode-native-buddy-task -- --buddy-name skill-designer --task "Review the skill plan and SKILL.md trigger wording for whether it follows our symptom-driven skill-design standards. Focus on whether the skill should trigger only in implementation/calling situations, whether the description names concrete symptoms, and whether contract/reference material stays out of normal runtime use." --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-prepared --target-ref /home/prosumer/agent/context-tree/docs/skills/context-tree-skill-rules.md --target-ref /home/prosumer/agent/context-tree/docs/role-memory/skill-designer-corrections.md --json
```

Expected: `/tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-prepared/` contains `member-invocation-packet.json`, `opencode-native-buddy-task-prompt.txt`, and `opencode-native-buddy-task-preparation.json`. This prepared bundle is an exporter/matching anchor only. It must not be used as the parent-agent instruction in Step 3.

- [ ] **Step 2: Verify the parent prompt is mechanism-clean before any live run**

Use this exact parent prompt text for Step 3:

```text
Review the skill plan and SKILL.md trigger wording for whether it follows our symptom-driven skill-design standards. Focus on whether the skill should trigger only in implementation or calling situations, whether the description names concrete symptoms, and whether contract or reference material stays out of normal runtime use. Return the review in this conversation.
```

Confirm the parent prompt does **not** contain any of these mechanism/proof strings:

```txt
subagent
invoke-buddy
invoke-member
ctree
scripts/context-tree
spawn_agent
wait_agent
proof
oracle
prepared OpenCode Buddy review prompt
child task prompt
```

Expected: the parent prompt stays in plain skill-review language. Do not run Step 3 if the parent prompt contains any forbidden mechanism/proof string. Do not apply this check to `opencode-native-buddy-task-prompt.txt`; that file is a prepared anchor and may contain packet/task vocabulary that is not visible as the parent routing instruction.

- [ ] **Step 3: Run one fresh OpenCode parent session with only the natural parent prompt**

Run one fresh OpenCode parent session from `/home/prosumer/agent/context-tree` with only the natural parent prompt from Step 2. Use:

```bash
opencode run --dir "/home/prosumer/agent/context-tree" --title "Skill review natural clean 20260715" "Review the skill plan and SKILL.md trigger wording for whether it follows our symptom-driven skill-design standards. Focus on whether the skill should trigger only in implementation or calling situations, whether the description names concrete symptoms, and whether contract or reference material stays out of normal runtime use. Return the review in this conversation."
```

Immediately after the run completes, record:

1. the returned parent session id from the CLI output or session listing,
2. every child session id created by that parent run,
3. the exact parent session title `Skill review natural clean 20260715`.

If the CLI output does not print session ids, resolve them explicitly with:

```bash
opencode run --dir "/home/prosumer/agent/context-tree" --continue
```

and record the current session id shown by the runtime. Then export the fresh corpus manifest once with just the parent id:

```bash
npm run context-tree:export-opencode-session-corpus -- --db /home/prosumer/.local/share/opencode/opencode.db --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-corpus-scan --session-id <parent-session-id>
```

Read `/tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-corpus-scan/session-corpus-export-manifest.json` and collect every child session id linked to that parent. Delete or ignore this scan root afterward. Do not start a second natural-use scenario.

Expected: one fresh parent session exists and the runtime chooses whichever Buddy it finds most natural. The live parent prompt must not mention prepared prompts, child task prompts, `skill-designer` selection mechanics, adapters, or proof language.

- [ ] **Step 4: Export only the captured OpenCode sessions into a fresh corpus root**

Run, substituting the recorded ids from Step 3. Repeat `--session-id` once for the parent and once for **every** captured child session id; do not assume exactly two children.

```bash
npm run context-tree:export-opencode-session-corpus -- --db /home/prosumer/.local/share/opencode/opencode.db --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-corpus --session-id <parent-session-id> --session-id <child-session-id-1> --session-id <child-session-id-2> --session-id <child-session-id-3-if-present>
```

Expected: `/tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-corpus/session-corpus-export.json` and `session-corpus-export-manifest.json` exist and cover only the fresh capture.

- [ ] **Step 5: Export the fresh OpenCode natural-use proof bundle**

Run:

```bash
npm run context-tree:export-opencode-native-buddy-task-proof -- --capability-root /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-corpus --prepared-root /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-prepared --project-identity /home/prosumer/agent/context-tree --baseline-report /tmp/evobuddy-release-grade-live-20260714/recovered-skill-designer-live-baseline/context-tree-subagent-baseline-install-report.json --buddy-name skill-designer --out /tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/opencode-native-buddy-task-proof.json --runtime-native-out /tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/runtime-native-buddy-surface-proof.json --proof-layer naturalUse
```

Expected: all three files exist under `/tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/` when the exporter can match the natural runtime evidence to the prepared anchor:

```txt
opencode-native-buddy-task-proof.json
opencode-native-buddy-task-proof-summary.json
runtime-native-buddy-surface-proof.json
```

If the exporter cannot match the natural parent session because the runtime did not use the prepared anchor, retain the corpus and exporter error as an exporter capability gap. Do not rerun Step 3 with a parent prompt that instructs OpenCode to use the prepared prompt. A capability gap here means the current exporter cannot prove natural-use from fully natural OpenCode routing without extra matching support.

- [ ] **Step 6: Stop after Phase 1 only if the new natural root proves prompt-only success**

Read `/tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/runtime-native-buddy-surface-proof.json` and confirm all of the following:

```json
{
  "proofLayer": "naturalUse",
  "negativeControls": { "mechanismNamedPrompt": false },
  "runtimeEvidence": { "observedRuntimeAgentName": "skill-designer" },
  "naturalUsePass": true
}
```

If any one of these checks fails, retain the artifact set and continue to Task 1. Do not keep iterating prompt wording past this point.

- [ ] **Step 7: If and only if Step 6 passes, finalize the OpenCode natural root and rerun release/readiness once**

Run:

```bash
npm run context-tree:finalize-opencode-native-buddy-product-root -- --prepared-root /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-prepared --native-task-proof /tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/opencode-native-buddy-task-proof.json --out /tmp/evobuddy-release-grade-live-20260715/natural-root-opencode/finalized
npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- --project /home/prosumer/agent/context-tree --member skill-designer --out /tmp/evobuddy-release-grade-live-20260715/release-out --require-runtimes opencode,claude,codex --product-root-opencode /tmp/evobuddy-release-grade-live-20260714/product-root-opencode --natural-root-opencode /tmp/evobuddy-release-grade-live-20260715/natural-root-opencode --product-root-claude /tmp/evobuddy-release-grade-live-20260714/product-root-claude --natural-root-claude /tmp/evobuddy-release-grade-live-20260714/natural-root-claude --product-root-codex /tmp/evobuddy-release-grade-live-20260714/product-root-codex --natural-root-codex /tmp/evobuddy-release-grade-live-20260714/natural-root-codex
npm run evobuddy:run-product-release-readiness-eval -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/readiness-out --require-runtimes opencode,claude,codex --release-report /tmp/evobuddy-release-grade-live-20260715/release-out/three-runtime-buddy-surface-release-report.json --natural-use-benchmark-report /tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/evobuddy-natural-use-benchmark-report.json
```

Expected: release and readiness both pass, or the only remaining blocker is outside OpenCode natural-use. If the rerun still fails for OpenCode natural-use after Step 6 was judged pass, treat that mismatch as a verification defect and investigate before changing prompts or authority.

---

### Task 1: Add `skill-designer` to the authoritative EvoBuddy preset surface

**Files:**
- Modify: `src/presets/buddies/registry.json`
- Create: `src/presets/buddies/skill-designer.json`
- Create: `src/presets/buddies/skill-designer/BUDDY.md`
- Modify: `test/core/buddy-presets.test.mjs`
- Modify: `test/core/evobuddy-project-state.test.mjs`

**Example:** implements Example 3; preserves Invariants 2 and 3

**Interfaces:**
- Consumes: bundled preset loader in `src/core/buddy-presets.mjs` and project-state seeding in `src/core/evobuddy-project-state.mjs`
- Produces: an authoritative bundled `skill-designer` member that seeds into new `.evobuddy/registry.json` files without using fixtures

- [ ] **Step 1: Add failing preset-loader tests for authoritative `skill-designer` membership**

Extend `test/core/buddy-presets.test.mjs` with assertions like. Keep registry-entry assertions separate from resolved-profile assertions because `loadProductBuddyPresetRegistry()` returns registry entries and `resolveProductBuddyPreset()` returns the resolved profile payload:

```js
it('loads skill-designer from bundled preset sources outside fixtures', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  const member = registry.members.find((entry) => entry.name === 'skill-designer');
  assert.ok(member);
  assert.equal(member.profileRef, './skill-designer.json');
  assert.equal(member.definitionRef, './skill-designer/BUDDY.md');
  assert.equal(member.sourceKind, 'product-preset');
  assert.doesNotMatch(member.profileRef, /fixtures/);
});

it('resolves skill-designer through the normal preset profile path', async () => {
  const resolved = await resolveProductBuddyPreset('skill-designer');
  assert.equal(resolved.memberName, 'skill-designer');
  assert.equal(resolved.profile.role, 'Skill Designer');
  assert.match(resolved.profile.description, /skill plan|SKILL\.md|trigger wording/i);
  assert.deepEqual(resolved.profile.roleMemoryRefs, ['preset:product/skill-designer/BUDDY.md']);
});

it('seeds both bundled presets into an empty project registry', async () => {
  const seeded = await seedMissingProductBuddyPresets({ registry: { version: '1', members: [] } });
  assert.deepEqual(seeded.added, ['evolution-buddy', 'skill-designer']);
  assert.equal(seeded.registry.members.some((member) => member.name === 'skill-designer'), true);
});
```

- [ ] **Step 2: Run the focused preset/project-state tests and verify red failure**

Run:

```bash
node --test test/core/buddy-presets.test.mjs test/core/evobuddy-project-state.test.mjs
```

Expected before implementation: FAIL because bundled presets currently contain only `evolution-buddy`.

- [ ] **Step 3: Add `skill-designer` to the bundled preset registry and profile**

Update `src/presets/buddies/registry.json` so it contains both preset entries:

```json
{
  "version": "1",
  "members": [
    {
      "name": "evolution-buddy",
      "aliases": ["evo-buddy"],
      "resolvedMemberId": "preset-evolution-buddy",
      "profileRef": "./evolution-buddy.json",
      "definitionRef": "./evolution-buddy/BUDDY.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-13"
    },
    {
      "name": "skill-designer",
      "aliases": ["skill-reviewer"],
      "resolvedMemberId": "preset-skill-designer",
      "profileRef": "./skill-designer.json",
      "definitionRef": "./skill-designer/BUDDY.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-15"
    }
  ]
}
```

Create `src/presets/buddies/skill-designer.json` with a broadened authoritative profile:

```json
{
  "name": "skill-designer",
  "description": "Use when reviewing skill plans, SKILL.md trigger wording, symptom-driven descriptions, implementation/calling boundaries, and contract/reference material hygiene for runtime-visible Buddy or skill definitions.",
  "role": "Skill Designer",
  "responsibilities": [
    "Review skill trigger wording against symptom-driven standards",
    "Check implementation versus calling-boundary language",
    "Keep contract/reference material out of normal runtime use",
    "Recommend narrow wording fixes for Buddy and skill routing surfaces"
  ],
  "standardsRefs": [
    "docs/skills/context-tree-skill-rules.md"
  ],
  "roleMemoryRefs": [
    "buddies/skill-designer/BUDDY.md"
  ],
  "activationHints": [
    "skill plan review",
    "SKILL.md trigger wording",
    "symptom-driven description",
    "implementation or calling boundary",
    "contract pointer hygiene"
  ],
  "negativeActivationHints": [
    "proof verdict only",
    "runtime native spawn debugging only",
    "generic architecture oracle review"
  ]
}
```

The source JSON should keep the relative source ref `buddies/skill-designer/BUDDY.md`; tests that inspect the *loaded preset* or *seeded registry* must expect the normalized form `preset:product/skill-designer/BUDDY.md` because `seedMissingProductBuddyPresets()` rewrites it during preset loading.

- [ ] **Step 4: Create the authoritative `skill-designer` Buddy definition**

Create `src/presets/buddies/skill-designer/BUDDY.md` with this minimum structure and wording:

```markdown
---
name: skill-designer
description: Use when reviewing skill plans, SKILL.md trigger wording, symptom-driven descriptions, implementation/calling boundaries, and contract/reference material hygiene for runtime-visible Buddy or skill definitions.
---

# Skill Designer

## Overview

Skill Designer reviews runtime-visible skill and Buddy wording so parent agents choose the right specialist in the right situations.

## Scope

Use this Buddy when the work is about SKILL.md trigger wording, symptom-driven routing descriptions, implementation versus calling boundaries, or keeping contract/reference material out of normal runtime use. Do not use it for generic proof verdicts or broad architecture-oracle reviews.

## Responsibilities

- Review skill plan and SKILL.md trigger wording.
- Check whether descriptions name concrete symptoms instead of mechanism-only cues.
- Check whether runtime-visible wording points to the right implementation/calling situations.
- Keep contract and reference material out of normal runtime answers unless explicitly requested.
- Return concise wording corrections to the parent agent.

## Operating Rules

1. Prefer evidence-backed review wording.
2. Favor symptom-driven trigger language over mechanism-driven trigger language.
3. Keep routing cues concrete and reviewer-usable.
4. Do not turn proof contracts or adapter mechanics into normal runtime user guidance.
5. Return findings to the parent agent without claiming product proof.

## Return Shape

Return a concise parent-agent answer with the strongest wording issue, the recommended correction, and one short rationale.

## Common Mistakes

- Treating proof-boundary review as the same task as skill-design review.
- Using mechanism names as the main trigger cues.
- Leaving contract-pointer material in ordinary runtime wording.
```

This step intentionally carries forward the live correction note from `docs/role-memory/skill-designer-corrections.md` (“Prefer evidence-backed review wording.”) into the authoritative preset definition so active projections stop depending on fixture-derived role-memory paths.

- [ ] **Step 5: Update project-state tests to seed both bundled Buddies**

Extend `test/core/evobuddy-project-state.test.mjs` with assertions like:

```js
it('seeds both evolution-buddy and skill-designer into a new project registry', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-two-presets-'));
  try {
    const state = await ensureEvobuddyProjectState({ projectRoot: root });
    const registry = readJson(state.registryPath);
    assert.equal(registry.members.some((member) => member.name === 'evolution-buddy'), true);
    assert.equal(registry.members.some((member) => member.name === 'skill-designer'), true);
    assert.deepEqual(state.presetSeeding.added, ['evolution-buddy', 'skill-designer']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Also update the idempotence case so `presetSeeding.preserved` contains both names after the second setup call.

- [ ] **Step 6: Run the focused authority tests**

Run:

```bash
node --test test/core/buddy-presets.test.mjs test/core/evobuddy-project-state.test.mjs
```

Expected: PASS.

---

### Task 2: Regenerate live registry/projections from authority and verify `skill-designer` is no longer orphaned

**Files:**
- Modify: `test/install/member-projection-installer.test.mjs`
- Uses: `scripts/evobuddy/evobuddy.mjs`
- Uses: `scripts/context-tree/install-member-projections.mjs`
- Writes: `.evobuddy/registry.json`
- Writes: `context-tree-member-runtime-projections.json`
- Writes: `context-tree-member-projection-install-report.json`
- Writes: `.opencode/agents/skill-designer.md`

**Example:** implements Example 3; preserves Invariants 2 and 3

**Interfaces:**
- Consumes: bundled presets from Task 1 and projection sync/doctor paths in `src/install/member-projection-installer.mjs`
- Produces: a regenerated project-local `skill-designer` runtime definition that is authority-backed instead of stray runtime residue

- [ ] **Step 1: Add a projection-installer regression test for preset-backed `skill-designer` content**

Extend `test/install/member-projection-installer.test.mjs` with a new case that uses a seeded project registry rather than the local `writeRegistryFixture(...)` helper:

```js
it('sync writes an authority-backed skill-designer projection without fixture path drift', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ctree-preset-skill-designer-'));
  try {
    await ensureEvobuddyProjectState({ projectRoot: root });
    const registryRef = join(root, '.evobuddy/registry.json');
    const report = await syncMemberProjections({ registryRef, projectRoot: root, memberName: 'skill-designer' });
    const opencodePath = join(root, '.opencode/agents/skill-designer.md');
    const content = readFileSync(opencodePath, 'utf8');
    assert.equal(report.summary.status, 'pass');
    assert.match(content, /SKILL\.md trigger wording|symptom-driven/i);
    assert.match(content, /Prefer evidence-backed review wording\./);
    assert.doesNotMatch(content, /fixtures\/docs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: After Task 1 lands, run the projection-installer test and verify it now passes**

Run:

```bash
node --test test/install/member-projection-installer.test.mjs
```

Expected after Task 1 implementation: PASS because the seeded project registry now contains `skill-designer` and the projection output is authority-backed.

- [ ] **Step 3: Reseed and resync the real project from authoritative presets**

Run:

```bash
npm run evobuddy:setup -- --project /home/prosumer/agent/context-tree --runtime opencode
npm run evobuddy:buddies-sync -- --project /home/prosumer/agent/context-tree
npm run evobuddy:buddies-doctor -- --project /home/prosumer/agent/context-tree --member skill-designer --report-out /tmp/evobuddy-release-grade-live-20260715/skill-designer-projection-doctor.json
```

Expected:

```txt
.evobuddy/registry.json includes skill-designer
context-tree-member-runtime-projections.json includes skill-designer
.opencode/agents/skill-designer.md is regenerated from authority
```

- [ ] **Step 4: Verify the regenerated live files are authority-backed**

Read these files and confirm all checks:

```txt
/home/prosumer/agent/context-tree/.evobuddy/registry.json
/home/prosumer/agent/context-tree/context-tree-member-runtime-projections.json
/home/prosumer/agent/context-tree/.opencode/agents/skill-designer.md
```

Expected checks:

```txt
registry contains both evolution-buddy and skill-designer
projection mapping contains a skill-designer member block
OpenCode definition contains the broadened skill-review wording
OpenCode definition does not mention fixtures/docs as a role-memory source
```

- [ ] **Step 5: Run the focused projection and authority tests**

Run:

```bash
node --test test/core/buddy-presets.test.mjs test/core/evobuddy-project-state.test.mjs test/install/member-projection-installer.test.mjs
```

Expected: PASS.

---

### Task 3: Re-run the OpenCode natural-use capture after authority repair, then use the correction loop

**Files:**
- Use: `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`
- Use: `scripts/context-tree/export-opencode-session-corpus.mjs`
- Use: `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
- Use: `scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs`
- Use: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
- Use: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/release-out-authority-repaired/three-runtime-buddy-surface-release-report.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260715/readiness-out-authority-repaired/product-release-readiness-report.json`

**Example:** corrects Example 2; observes Example 1; preserves Invariants 1-3

**Interfaces:**
- Consumes: the authoritative preset/projection state from Tasks 1-2 and the exact same mechanism-clean parent prompt text from Task 0
- Produces: the final OpenCode natural root used for release/readiness handoff, or a retained exporter capability gap if fully natural routing cannot be matched to the prepared anchor

- [ ] **Step 1: Re-run the mechanism-clean OpenCode capture with explicit post-repair paths**

Run the same neutral skill-design scenario as Task 0, but write to explicit post-repair paths:

```bash
mkdir -p /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired
npm run context-tree:prepare-opencode-native-buddy-task -- --buddy-name skill-designer --task "Review the skill plan and SKILL.md trigger wording for whether it follows our symptom-driven skill-design standards. Focus on whether the skill should trigger only in implementation/calling situations, whether the description names concrete symptoms, and whether contract/reference material stays out of normal runtime use." --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/prepared --target-ref /home/prosumer/agent/context-tree/docs/skills/context-tree-skill-rules.md --target-ref /home/prosumer/agent/context-tree/docs/role-memory/skill-designer-corrections.md --json
opencode run --dir "/home/prosumer/agent/context-tree" --title "Skill review natural repaired 20260715" "Review the skill plan and SKILL.md trigger wording for whether it follows our symptom-driven skill-design standards. Focus on whether the skill should trigger only in implementation or calling situations, whether the description names concrete symptoms, and whether contract or reference material stays out of normal runtime use. Return the review in this conversation."
npm run context-tree:export-opencode-session-corpus -- --db /home/prosumer/.local/share/opencode/opencode.db --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/corpus-scan --session-id <post-repair-parent-session-id>
npm run context-tree:export-opencode-session-corpus -- --db /home/prosumer/.local/share/opencode/opencode.db --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/corpus --session-id <post-repair-parent-session-id> --session-id <post-repair-child-session-id-1> --session-id <post-repair-child-session-id-2> --session-id <post-repair-child-session-id-3-if-present>
npm run context-tree:export-opencode-native-buddy-task-proof -- --capability-root /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/corpus --prepared-root /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/prepared --project-identity /home/prosumer/agent/context-tree --baseline-report /tmp/evobuddy-release-grade-live-20260714/recovered-skill-designer-live-baseline/context-tree-subagent-baseline-install-report.json --buddy-name skill-designer --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/natural-root-opencode/opencode-native-buddy-task-proof.json --runtime-native-out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/natural-root-opencode/runtime-native-buddy-surface-proof.json --proof-layer naturalUse
```

Expected: this run isolates authority repair without changing the neutral skill-design parent prompt. Use the `corpus-scan` manifest exactly as in Task 0 to enumerate the child session ids before the full corpus export. Claude and Codex inputs remain frozen at their existing July 14 roots. Do not instruct the parent agent to use the prepared prompt or child task prompt.

- [ ] **Step 2: Verify the post-repair OpenCode natural root reaches the required pass shape**

Read the fresh `runtime-native-buddy-surface-proof.json` and confirm:

```json
{
  "proofLayer": "naturalUse",
  "runtimeEvidence": { "observedRuntimeAgentName": "skill-designer" },
  "negativeControls": { "mechanismNamedPrompt": false },
  "naturalUsePass": true
}
```

Expected: PASS. If `observedRuntimeAgentName` still differs, retain the artifact and report the remaining blocker honestly; do not weaken the gate.

- [ ] **Step 3: Finalize the repaired OpenCode natural root and rerun release/readiness**

Run:

```bash
npm run context-tree:finalize-opencode-native-buddy-product-root -- --prepared-root /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/prepared --native-task-proof /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/natural-root-opencode/opencode-native-buddy-task-proof.json --out /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/finalized-product-root
npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- --project /home/prosumer/agent/context-tree --member skill-designer --out /tmp/evobuddy-release-grade-live-20260715/release-out-authority-repaired --require-runtimes opencode,claude,codex --product-root-opencode /tmp/evobuddy-release-grade-live-20260714/product-root-opencode --natural-root-opencode /tmp/evobuddy-release-grade-live-20260715/opencode-natural-skill-review-authority-repaired/natural-root-opencode --product-root-claude /tmp/evobuddy-release-grade-live-20260714/product-root-claude --natural-root-claude /tmp/evobuddy-release-grade-live-20260714/natural-root-claude --product-root-codex /tmp/evobuddy-release-grade-live-20260714/product-root-codex --natural-root-codex /tmp/evobuddy-release-grade-live-20260714/natural-root-codex
npm run evobuddy:run-product-release-readiness-eval -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260715/readiness-out-authority-repaired --require-runtimes opencode,claude,codex --release-report /tmp/evobuddy-release-grade-live-20260715/release-out-authority-repaired/three-runtime-buddy-surface-release-report.json --natural-use-benchmark-report /tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/evobuddy-natural-use-benchmark-report.json
```

Expected: release/readiness pass, or the remaining report clearly identifies a non-OpenCode blocker.

After the rerun, verify that the Claude and Codex proof refs in the release report still point to the unchanged July 14 roots:

```txt
/tmp/evobuddy-release-grade-live-20260714/natural-root-claude/runtime-native-buddy-surface-proof.json
/tmp/evobuddy-release-grade-live-20260714/natural-root-codex/runtime-native-buddy-surface-proof.json
```

If either runtime changed unexpectedly, stop and classify that as out-of-scope regression instead of continuing OpenCode repairs.

- [ ] **Step 4: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, proof path, prompt text, and observed child session title.
2. Classify the root cause: authority/preset defect, runtime selection defect, exporter capability gap, export/verification defect, or unrelated external blocker. Do not reopen prompt iteration after Phase 2 starts unless a retained artifact proves the supposedly unchanged parent prompt actually drifted on disk.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the defect. Do not weaken gates to turn a real wrong-Buddy routing failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original verification command that failed. Expected: PASS, or the same honest blocker with updated evidence.
7. Compare the new evidence to the old evidence. If the underlying runtime choice did not change, do not claim the problem is fixed.
8. Repeat until release/readiness passes, or the same runtime-selection blocker repeats and requires a human decision.

---

## Self-Review

- **Spec coverage:** The plan covers both phases the user requested: prompt-only recapture first, authority repair second only if prompt-only recapture still misroutes, while keeping prepared packets out of the parent natural-use prompt.
- **Example verification:** Example 1 covers prompt-only success, Example 2 covers prompt-only failure triggering escalation, and Example 3 covers authoritative repair. Each has explicit verification and failure signals.
- **Placeholder scan:** All remaining session-id placeholders are intentionally runtime-observed values, and the steps now include an explicit scan/export procedure for resolving them.
- **Type consistency:** The plan uses existing CLI/script names and report/proof file names already present in the repo.
- **Architecture ownership:** The plan explicitly keeps `.opencode/agents/skill-designer.md` as generated output, not authority, routes repair through `src/presets/buddies/*` → `.evobuddy/registry.json` → projections, and treats natural-use exporter matching as a capability boundary rather than a reason to feed prepared child prompts to the parent agent.
