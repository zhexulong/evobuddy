# Three Runtime Native Buddy Surface MVP V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the MVP product path where OpenCode, Claude Code, and Codex expose the same Context Tree Buddy/member functionality through each runtime's native subagent surface, with baseline sync, parent-owned invocation, result return, runtime evidence, Workbench visibility, install/doctor UX, and release eval parity. Completion of this plan must mean the product is releasable; blocked runtime proof is an honest stop state, not completion.

**Architecture:** Context Tree owns stable Buddy baseline provisioning and evidence sidecars; parent agents own dynamic task prompts; each runtime owns native subagent execution. This plan adds a three-runtime native Buddy proof layer over the already-planned baseline and invocation migrations: OpenCode `task` child sessions, Claude Code subagents, and Codex native subagent/spawn/fork-side surface are all treated as required MVP surfaces. Adapter/CLI invocation remains compatibility/fallback only and cannot satisfy the three-runtime release gate. The same plan also closes product packaging: `ctree` setup/sync/doctor/workbench/import commands, project state layout, runtime instruction installation, user docs, and a from-empty-project release acceptance run.

**Tech Stack:** Node.js ESM, `node:test`, existing baseline projection/install CLIs, existing OpenCode/Codex/Claude session corpus exporters, SHA-256 digest helpers, runtime transcript/DB/session exporters, existing EvoBuddy release-grade provenance validators, no new external service dependency.

**Source design:** `docs/superpowers/specs/2026-07-13-subagent-baseline-and-invocation-design.md` plus local primary-source runtime notes. Codex is not treated as unknown: the local `../codex` source contains multi-agent/subagent surfaces including `spawn_agent`, `fork_turns`, wait/message handlers, `thread_manager.spawn_subagent`, and parent/child spawn events. Task 0 must retain a current primary-source + live-probe discovery artifact for OpenCode, Claude Code, and Codex, and later proof tasks must implement the discovered surfaces rather than downgrade Codex to adapter/fallback proof.

**Depends on:**
- `docs/superpowers/plans/2026-07-13-subagent-baseline-projection-migration-v0.md`
- `docs/superpowers/plans/2026-07-13-invocation-artifact-schema-migration-v0.md`

## Global Constraints

- Completion means releasable product: all release gates in Tasks 8-10 must pass with fresh evidence. A `blocked` result is honest, but it means the plan is not complete and the product is not releasable.
- Three-runtime MVP means OpenCode, Claude Code, and Codex all pass the same product capability gates; no runtime may be marked pass via adapter-only, fixture-only, retained-only, or projection-only evidence.
- Runtime-native Buddy execution must be proven by the host runtime's own subagent/child-session/spawn/task surface, not by `invoke-buddy`, `invoke-member`, a shell command, a handcrafted JSON artifact, or agent prose.
- Codex is not optional and must be implemented against the real local Codex surface. At minimum, discovery must inspect `../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs`, `../codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs`, `../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/wait.rs`, `../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/send_message.rs`, `../codex/codex-rs/core/src/thread_manager.rs`, and related `SpawnAgentForkMode` / parent-child event code. If the live runtime surface name differs from `spawn_agent` / `wait_agent` / `fork_turns`, implement the actual current surface; do not mark Codex complete through app-server `thread/fork`, retained artifacts, or adapter fallback.
- Claude Code is not optional. If Claude Code subagent transcript/export shape differs from OpenCode/Codex, implement a runtime-specific exporter and normalize it into the same proof schema.
- OpenCode is not special except as the first implementation reference. OpenCode task proof must not use a more permissive gate than Claude or Codex.
- Baseline sync proves only definition installation. Invocation/result proof requires parent-child runtime evidence and parent-observed result return.
- Dynamic invocation prompt is parent-owned. Context Tree may record or digest it, but must not reintroduce `member-m[1]` or require answer canaries.
- Buddy/member/subagent answers must not be forced to output canaries, JSON, markdown sections, or proof text solely for provenance.
- Evidence must come from runtime exporters, sidecars around a wrapper fallback, or host parsers for machine-parsed maintenance turns. For this plan's release gate, only runtime-native exporter evidence may satisfy native execution.
- Adapter fallback remains useful for degraded UX but must be labeled `fallback-adapter` and cannot pass the three-runtime MVP release eval.
- All product roots must include exporter manifest refs, source transcript/session refs, digest closure, baseline digest, invocation prompt digest when observable, child runtime identity, result return evidence, and known losses.
- Release eval must be an eval -> correction -> re-eval loop. Do not convert blocked/missing runtime evidence into pass by weakening gates.
- Natural use is in scope and release-blocking: for each runtime, one proof may be an authorized mechanism proof that explicitly asks the parent to use the native subagent surface, but the release gate also requires a natural-use proof where the user asks for the work without naming `ctree`, `invoke-buddy`, `spawn_agent`, `wait_agent`, `task`, `subagent`, or any adapter/native mechanism command. The parent agent must select the synced Buddy through the runtime-native surface from installed definitions/instructions.
- Product entry is in scope: `ctree` CLI/bin, setup, sync, doctor, Workbench/import visibility, runtime instructions, and release docs must be present and tested.
- Cold-start/discovery/evolution are release-integrated at the product-surface level: existing candidate import/evolution mechanisms must remain reachable and visible, but this plan does not redesign their algorithms.
- Release reports must separate `baselineProjectionPass`, `nativeMechanismPass`, and `naturalUsePass`. Three-runtime MVP completion requires all three statuses to pass for OpenCode, Claude Code, and Codex.
- Runtime visibility is part of the product, not just proof: setup/doctor must verify that each parent runtime can see the installed Buddy definition/instruction entrypoint needed for natural use.
- No commits unless the user explicitly asks.

---

## Concrete Examples

### Example 1: One Buddy, Three Native Runtime Calls

- **Example:** The project has confirmed Buddy `skill-designer` with active role memory `Prefer symptom-driven trigger review before implementation details.` Baseline sync writes OpenCode, Claude Code, and Codex definitions. A parent agent in each runtime asks the native Buddy/subagent to review a short plan.
- **Expected result:** Each runtime produces a product root with the same product fields: `memberName: "skill-designer"`, matching `baselineDigest`, `actualSurface: "runtime-native-subagent"`, runtime-specific `runtimeSurface`, parent session id, child session/spawn id, invocation prompt digest or observed prompt ref, parent-observed result, and exporter digest closure.
- **Verification:** `npm run context-tree:run-three-runtime-buddy-surface-release-eval -- --project <temp-project> --member skill-designer --out <out> --require-runtimes opencode,claude,codex` writes `three-runtime-buddy-surface-release-report.json` with all three runtime statuses `pass`.
- **Failure signal:** Any runtime passes through CLI adapter output, projection-only baseline files, retained fixture, or an answer self-claim without observed parent-child runtime evidence.
- **If it fails:** Fix the runtime exporter/proof validator or native invocation instructions. Do not weaken the release gate.

### Example 2: Codex Native Surface Is Real, Not App-Server Thread/Fork Relabeling

- **Example:** Codex parent agent calls its current native subagent/spawn/fork-side surface for `skill-designer` and receives a child answer.
- **Expected result:** Codex proof records the actual current Codex surface name and runtime ids, proves parent/child relationship, proves the child saw or was launched from the synced `skill_designer` definition/baseline, and proves the result returned to the parent agent. App-server `thread/fork`, retained native-spawn artifacts, fresh-thread summaries, and searchable-history fallbacks remain negative controls.
- **Verification:** `node --test test/core/codex-native-buddy-surface-proof.test.mjs test/cli/export-codex-native-buddy-surface-proof-cli.test.mjs` plus the live correction loop in Task 9.
- **Failure signal:** Codex pass is derived from app-server thread/fork, retained artifact ingest, direct shell output, or a prior context-fork eval that did not observe a native Buddy/subagent call.
- **If it fails:** Return to Codex surface discovery and exporter implementation; if current runtime lacks observable native Buddy calls, report release blocked.

### Example 3: Claude Code Subagent Has Equal Capability

- **Example:** Claude Code parent agent uses the generated `.claude/agents/skill-designer.md` subagent definition to delegate the same review task.
- **Expected result:** Claude proof records the subagent definition digest, parent-child/subagent invocation boundary, invocation prompt/result transcript refs, parent-observed result return, and baseline digest equality with OpenCode/Codex.
- **Verification:** `node --test test/core/claude-native-buddy-surface-proof.test.mjs test/cli/export-claude-native-buddy-surface-proof-cli.test.mjs` plus the live correction loop in Task 9.
- **Failure signal:** Claude pass is only a generated `.claude/agents/*.md` file, a manual transcript, or an adapter command invoked by the parent.
- **If it fails:** Fix Claude exporter/proof parser or mark release blocked; do not ship three-runtime MVP.

### Example 4: Natural Use Without Naming Context Tree Or Native Mechanisms

- **Example:** In each runtime, the user asks the parent agent: `Review this implementation plan for weak assumptions and return a concise verdict.` The user does not mention Context Tree, `ctree`, `invoke-buddy`, native task/spawn/subagent commands, or `skill-designer`. The project has already run setup/sync and installed runtime instructions/definitions.
- **Expected result:** The parent agent chooses the synced `skill-designer` Buddy/member through that runtime's native subagent surface, sends the task prompt, receives the result, and the exporter records runtime-native parent-child evidence. The release report marks `naturalUsePass: true` for that runtime.
- **Verification:** Task 9 live eval writes natural-use proof roots for OpenCode, Claude Code, and Codex, and `run-three-runtime-buddy-surface-release-eval` rejects any proof whose prompt names adapter/native mechanism commands.
- **Failure signal:** The proof only passes when the prompt explicitly tells the parent to use `task`, `spawn_agent`, `subagent`, `invoke-buddy`, or a prepared Context Tree adapter.
- **If it fails:** Fix runtime instructions/definition visibility or natural-use exporter classification. Do not relabel authorized mechanism proof as natural use.

### Invariants

- Same product capability across runtimes: setup/sync/doctor, baseline sync, native invocation, result return, runtime proof, Workbench visibility, and release report.
- Same normalized proof schema across runtimes, with runtime-specific evidence nested under `runtimeEvidence`.
- Same negative controls across runtimes: projection-only, adapter-only, retained-only, summary-only, answer-canary-only, self-claim-only, and mechanism-named prompt cannot pass natural use.
- Runtime-specific mechanics may differ, but user-visible capability and release gate semantics must be identical.
- Release status is three-layered: baseline projection, native mechanism, and natural use must be reported separately and all must pass for release.

---

## File Structure

Create:

- `src/core/runtime-native-buddy-surface-proof.mjs`: shared normalized schema, digest helpers, cross-runtime validators, negative-control classifier.
- `test/core/runtime-native-buddy-surface-proof.test.mjs`
- `src/core/opencode-native-buddy-surface-proof.mjs`: OpenCode proof adapter over existing OpenCode task proof primitives.
- `src/core/claude-native-buddy-surface-proof.mjs`: Claude Code subagent transcript/session proof parser and validator.
- `src/core/codex-native-buddy-surface-proof.mjs`: Codex native subagent/spawn surface proof parser and validator.
- `test/core/opencode-native-buddy-surface-proof.test.mjs`
- `test/core/claude-native-buddy-surface-proof.test.mjs`
- `test/core/codex-native-buddy-surface-proof.test.mjs`
- `scripts/context-tree/probe-three-runtime-buddy-surfaces.mjs`: discovers current native surface observability for OpenCode, Claude, and Codex from primary sources plus live probes.
- `scripts/context-tree/export-claude-native-buddy-surface-proof.mjs`
- `scripts/context-tree/export-codex-native-buddy-surface-proof.mjs`
- `scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs`: finalizes one runtime product root from a normalized proof.
- `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`: release eval/correction-loop entrypoint.
- `scripts/context-tree/run-product-release-readiness-eval.mjs`: from-empty-project product readiness eval covering install/setup/sync/native proof/workbench/docs.
- CLI tests for each new script under `test/cli/`.
- `docs/contracts/runtime-native-buddy-surface-proof-contract.md`
- `test/docs/runtime-native-buddy-surface-proof-contract.test.mjs`
- `docs/three-runtime-buddy-surface-mvp.md`
- `docs/reports/three-runtime-native-surface-discovery.md`: retained human-readable summary of the primary-source/live discovery artifact.

Modify:

- `package.json`: add package scripts for probe/export/finalize/release eval and ensure `bin.ctree` points to the product CLI entrypoint.
- `scripts/context-tree/ctree.mjs`: add `ctree buddies native probe|export|finalize|release-eval` dispatchers.
- `src/eval/evobuddy-runtime-natural-use.mjs`: consume normalized runtime-native proof for all three runtimes.
- `src/eval/evobuddy-release-grade-provenance.mjs`: require normalized proof closure for native execution claims.
- `src/install/opencode-member-instructions.mjs`: keep OpenCode instructions aligned with native-first / adapter-fallback wording.
- Add `src/install/claude-member-instructions.mjs` and `src/install/codex-member-instructions.mjs` if no runtime-specific instruction installers exist.
- Existing tests in `test/eval`, `test/install`, and `test/cli` where execution tier, Workbench/import visibility, CLI bin behavior, or release-grade provenance is asserted.

Do not modify in this plan:

- Baseline compiler semantics except through already-required per-material doctor fixes.
- Invocation artifact schema except to consume V2 fields produced by the prerequisite migration.
- Evolution/Dream proposal algorithms except release eval integration and product-surface reachability checks.

---

### Task 0: Three-Runtime Native Surface Discovery From Primary Sources And Live Probe

**Files:**
- Create: `docs/contracts/runtime-native-buddy-surface-proof-contract.md`
- Create: `test/docs/runtime-native-buddy-surface-proof-contract.test.mjs`
- Create: `scripts/context-tree/probe-three-runtime-buddy-surfaces.mjs`
- Create: `test/cli/probe-three-runtime-buddy-surfaces-cli.test.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/ctree.mjs`

**Example:** implements Examples 1-4; preserves Invariants 1-5

**Interfaces:**
- Produces CLI: `npm run context-tree:probe-three-runtime-buddy-surfaces -- --project <project> --out <out> --require-runtimes opencode,claude,codex`
- Produces artifact: `<out>/three-runtime-native-surface-discovery.json`
- Produces compatibility artifact: `<out>/three-runtime-buddy-surface-probe.json` if existing consumers need the old name
- Produces dispatcher: `ctree buddies native probe --project <project> --out <out> --require-runtimes opencode,claude,codex`

- [ ] **Step 1: Write failing contract doc tests**

Assert the contract contains these exact concepts:

```js
assert.match(text, /OpenCode.*Claude Code.*Codex/s);
assert.match(text, /same product capability|same functionality/i);
assert.match(text, /projection-only.*cannot.*pass/i);
assert.match(text, /adapter-only.*cannot.*pass/i);
assert.match(text, /Codex.*not optional|Codex.*required/i);
assert.match(text, /spawn_agent.*fork_turns|fork_turns.*spawn_agent/s);
assert.match(text, /naturalUsePass.*nativeMechanismPass|nativeMechanismPass.*naturalUsePass/s);
assert.match(text, /runtime-native-subagent/);
assert.match(text, /parent.*child.*result return/i);
```

Run:

```bash
node --test test/docs/runtime-native-buddy-surface-proof-contract.test.mjs
```

Expected: FAIL because the contract does not exist yet.

- [ ] **Step 2: Write the contract**

The contract must define normalized proof fields:

```json
{
  "proofKind": "runtime-native-buddy-surface-proof",
  "schemaVersion": "runtime-native-buddy-surface-proof-v1",
  "runtime": "opencode|claude|codex",
  "memberName": "skill-designer",
  "runtimeAgentName": "skill-designer|skill_designer|...",
  "actualSurface": "runtime-native-subagent",
  "runtimeSurface": "opencode-task|claude-subagent|codex-native-subagent",
  "proofLayer": "nativeMechanism|naturalUse",
  "baselineProjectionPass": true,
  "nativeMechanismPass": true,
  "naturalUsePass": true,
  "baselineDigest": "sha256:...",
  "baselineDefinitionRef": "...",
  "baselineDefinitionDigest": "sha256:...",
  "parentSessionRef": "...",
  "childSessionRef": "...",
  "parentChildLink": { "kind": "runtime-parent-child-link", "parentId": "...", "childId": "..." },
  "invocationPromptRef": "...",
  "invocationPromptDigest": "sha256:...",
  "resultReturn": { "returnedTo": "parent-agent", "resultRef": "...", "resultDigest": "sha256:..." },
  "exporterManifestRef": "...",
  "exporterManifestDigest": "sha256:...",
  "sourceTranscriptRef": "...",
  "sourceTranscriptDigest": "sha256:...",
  "negativeControls": {
    "adapterOnly": false,
    "projectionOnly": false,
    "retainedOnly": false,
    "summaryOnly": false,
    "answerCanaryOnly": false,
    "selfClaimOnly": false,
    "mechanismNamedPrompt": false
  },
  "knownLosses": []
}
```

The contract must say runtime-specific names are allowed only inside `runtimeSurface` / `runtimeEvidence`; release status uses the same normalized fields for all three runtimes. It must define `proofLayer` and require release reports to expose `baselineProjectionPass`, `nativeMechanismPass`, and `naturalUsePass`; natural-use proof must fail when `negativeControls.mechanismNamedPrompt` is true.

- [ ] **Step 3: Implement primary-source discovery probe**

The probe must:

1. Emit `observed|blocked|unsupported` per runtime and per proof layer: `baselineProjection`, `nativeMechanism`, and `naturalUse`.
2. Never return `pass`; probe is not proof.
3. For Codex, inspect local primary sources and record exact evidence refs for:
   - `../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs`;
   - `../codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs`;
   - `../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/wait.rs`;
   - `../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/send_message.rs`;
   - `../codex/codex-rs/core/src/thread_manager.rs`;
   - `SpawnAgentForkMode`, `fork_turns`, parent-child spawn begin/end events, child thread/agent ids, and role/application hooks.
4. For Codex live probing, record whether `spawn_agent`, wait/completion, fork mode, child result, and parent-observed result are visible in the current runtime/exporter surface. If a live probe is unavailable, Codex status is `blocked` with reason `codex-live-native-surface-not-observed`; do not erase the primary-source finding.
5. For Claude and OpenCode, record definition paths, runtime invocation/subagent surfaces, exporter inputs, parent-child relation fields, and known missing fields.
6. Write `docs/reports/three-runtime-native-surface-discovery.md` summarizing what surface will be implemented for each runtime and what evidence fields are required for proof.

- [ ] **Step 4: Add CLI tests**

Test cases:

1. Requires `--project`, `--out`, and `--require-runtimes`.
2. Writes discovery and probe artifacts with all required runtimes.
3. Fails if `--require-runtimes` omits Codex.
4. Does not mark probe result as proof.
5. Includes Codex primary-source refs for `spawn_agent`, `fork_turns`, wait/message, and `thread_manager.spawn_subagent`.
6. Includes separate `baselineProjection`, `nativeMechanism`, and `naturalUse` discovery statuses.
7. `ctree buddies native probe` dispatches to the same script.

Run:

```bash
node --test test/docs/runtime-native-buddy-surface-proof-contract.test.mjs test/cli/probe-three-runtime-buddy-surfaces-cli.test.mjs
```

Expected: PASS.

---

### Task 1: Shared Runtime-Native Buddy Proof Validator

**Files:**
- Create: `src/core/runtime-native-buddy-surface-proof.mjs`
- Create: `test/core/runtime-native-buddy-surface-proof.test.mjs`

**Example:** implements Example 1; preserves Invariants 1-5

**Interfaces:**
- Produces `normalizeRuntimeNativeBuddySurfaceProof(input): object`
- Produces `validateRuntimeNativeBuddySurfaceProof(input, options?: { requiredRuntime?: string, requiredMemberName?: string, expectedBaselineDigest?: string, requiredProofLayer?: 'nativeMechanism'|'naturalUse' }): { status: 'pass'|'fail', issues: string[], proof?: object }`
- Produces `digestRuntimeNativeBuddySurfaceProof(proof): string`
- Produces `classifyNativeBuddyNegativeControls(input): object`

- [ ] **Step 1: Write failing validator tests**

Cases:

1. Valid OpenCode/Claude/Codex shaped proofs normalize into the same top-level schema.
2. Missing parent-child link fails.
3. Missing result return fails.
4. Missing baseline digest or definition digest fails.
5. `actualSurface !== "runtime-native-subagent"` fails for release.
6. `adapterOnly`, `projectionOnly`, `retainedOnly`, `summaryOnly`, `answerCanaryOnly`, or `selfClaimOnly` fails.
7. Runtime mismatch fails.
8. Member mismatch fails.
9. Digest changes when source transcript digest changes.
10. Digest does not include absolute output directory paths unless those paths are explicit source refs.
11. `proofLayer: "nativeMechanism"` may use a mechanism-named authorization prompt, but `proofLayer: "naturalUse"` fails when the user/parent prompt names `ctree`, `invoke-buddy`, `spawn_agent`, `wait_agent`, `task`, or `subagent` as an instruction.
12. Release validators expose `baselineProjectionPass`, `nativeMechanismPass`, and `naturalUsePass` separately.

- [ ] **Step 2: Implement validator**

Implementation requirements:

- Use stable JSON digesting.
- Require non-empty string refs and SHA-256-like digest strings.
- Require exactly one of `runtime: "opencode" | "claude" | "codex"`.
- Allow runtime-specific fields only under `runtimeEvidence`.
- Require `proofLayer` to be `nativeMechanism` or `naturalUse`; product roots may include both, but natural use cannot be inferred from mechanism proof.
- Return all issues; do not throw for validation failures except malformed non-object input.

- [ ] **Step 3: Run focused tests**

```bash
node --test test/core/runtime-native-buddy-surface-proof.test.mjs
```

Expected: PASS.

---

### Task 2: OpenCode Native Proof Adapter Uses Shared Schema

**Files:**
- Create: `src/core/opencode-native-buddy-surface-proof.mjs`
- Create: `test/core/opencode-native-buddy-surface-proof.test.mjs`
- Modify: `src/core/opencode-native-buddy-task-proof.mjs` only if needed to expose reusable parsed fields.
- Modify: `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
- Modify: `test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs`

**Example:** implements Example 1; preserves Invariants 1-5

**Interfaces:**
- Produces `createOpenCodeNativeBuddySurfaceProof(input): RuntimeNativeBuddySurfaceProof`
- Consumes existing OpenCode task proof artifacts and baseline install report.
- Emits normalized `runtime: "opencode"`, `runtimeSurface: "opencode-task"`.

- [ ] **Step 1: Add failing tests for normalized OpenCode proof**

Cases:

1. Existing OpenCode task child-session proof becomes normalized runtime-native proof.
2. Missing child `parent_id` fails.
3. Missing invocation packet/prompt digest visibility fails.
4. Adapter command transcript fails as `adapterOnly`.
5. Generated baseline definition without invocation fails as `projectionOnly`.

- [ ] **Step 2: Implement OpenCode adapter**

Map fields:

```js
{
  runtime: 'opencode',
  runtimeSurface: 'opencode-task',
  parentSessionRef: opencodeProof.parentSessionRef,
  childSessionRef: opencodeProof.childSessionRef,
  parentChildLink: { kind: 'opencode-session-parent-id', parentId, childId },
  invocationPromptRef: opencodeProof.childPromptRef,
  invocationPromptDigest: opencodeProof.childPromptDigest,
  resultReturn: opencodeProof.parentObservedResult,
  runtimeEvidence: { opencodeTaskProofRef, dbDigest, sessionPartRefs }
}
```

- [ ] **Step 3: Update exporter CLI**

`context-tree:export-opencode-native-buddy-task-proof` should optionally write both:

- legacy OpenCode-specific proof for compatibility;
- normalized `runtime-native-buddy-surface-proof.json` for release eval.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/core/opencode-native-buddy-surface-proof.test.mjs test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs
```

Expected: PASS.

---

### Task 3: Claude Code Native Subagent Proof Adapter

**Files:**
- Create: `src/core/claude-native-buddy-surface-proof.mjs`
- Create: `test/core/claude-native-buddy-surface-proof.test.mjs`
- Create: `scripts/context-tree/export-claude-native-buddy-surface-proof.mjs`
- Create: `test/cli/export-claude-native-buddy-surface-proof-cli.test.mjs`
- Modify: `src/core/claude-session-corpus-export.mjs`
- Modify: `scripts/context-tree/export-claude-session-corpus.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/ctree.mjs`

**Example:** implements Example 3; preserves Invariants 1-5

**Interfaces:**
- Produces `createClaudeNativeBuddySurfaceProof(input): RuntimeNativeBuddySurfaceProof`
- CLI: `npm run context-tree:export-claude-native-buddy-surface-proof -- --session-corpus <corpus> --baseline-report <report> --member skill-designer --out <out>`
- Emits normalized `runtime: "claude"`, `runtimeSurface: "claude-subagent"`.

- [ ] **Step 1: Add fixture-backed failing tests**

Create minimal Claude session-corpus fixtures in the test file, not retained product fixtures. Include:

1. Parent message delegates to subagent `skill-designer`.
2. Child/subagent transcript has parent linkage or runtime subagent marker.
3. Child prompt or subagent metadata references generated `.claude/agents/skill-designer.md` baseline digest.
4. Parent receives child result.

Negative cases:

- generated `.claude/agents/*.md` only;
- manual transcript with no parent-child relation;
- parent text says it called subagent but no child/subagent event;
- adapter command named in prompt.

- [ ] **Step 2: Extend Claude corpus export if needed**

Ensure `export-claude-session-corpus` preserves:

- parent session id / turn id;
- subagent invocation event or child transcript id;
- subagent name;
- prompt text/digest;
- result returned to parent;
- exporter manifest digest.

If the real Claude export lacks one field, record it as `knownLosses` and make release proof `blocked`, not pass.

- [ ] **Step 3: Implement Claude proof adapter and CLI**

The CLI must fail closed when:

- `--member` does not match the subagent name;
- baseline digest does not match the generated `.claude/agents/<member>.md` digest/report;
- result return cannot be observed;
- transcript is not exporter-produced.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/core/claude-native-buddy-surface-proof.test.mjs test/cli/export-claude-native-buddy-surface-proof-cli.test.mjs test/cli/export-claude-session-corpus-cli.test.mjs
```

Expected: PASS.

---

### Task 4: Codex Native Buddy Surface Proof Adapter

**Files:**
- Create: `src/core/codex-native-buddy-surface-proof.mjs`
- Create: `test/core/codex-native-buddy-surface-proof.test.mjs`
- Create: `scripts/context-tree/export-codex-native-buddy-surface-proof.mjs`
- Create: `test/cli/export-codex-native-buddy-surface-proof-cli.test.mjs`
- Modify: `src/core/codex-session-corpus-export.mjs`
- Modify: `scripts/context-tree/export-codex-session-corpus.mjs`
- Modify: `src/adapters/codex-runtime-native-spawn.mjs`
- Modify: `src/adapters/codex-native-spawn.mjs` only if reusable parsing is needed.
- Modify: `package.json`
- Modify: `scripts/context-tree/ctree.mjs`

**Example:** implements Example 2; preserves Invariants 1-5

**Interfaces:**
- Produces `createCodexNativeBuddySurfaceProof(input): RuntimeNativeBuddySurfaceProof`
- CLI: `npm run context-tree:export-codex-native-buddy-surface-proof -- --session-corpus <corpus> --baseline-report <report> --member skill-designer --out <out>`
- Emits normalized `runtime: "codex"`, `runtimeSurface: "codex-native-subagent"` or the exact discovered Codex surface name from Task 0.

- [ ] **Step 1: Add failing Codex proof tests**

Positive fixture shape must be modeled on the real local Codex multi-agent surface discovered in Task 0, not invented field names and not app-server thread/fork. Required fields include the current concrete surface names and refs:

```json
{
  "runtime": "codex",
  "surface": "spawn_agent-v2-with-fork_turns-or-discovered-name",
  "forkMode": "fork_turns:all|fork_turns:last-n|none",
  "parentTurnRef": "...",
  "spawnOrSubagentCallRef": "...",
  "waitOrCompletionRef": "...",
  "childThreadOrAgentRef": "...",
  "childFinalAnswerRef": "...",
  "baselineDefinitionRef": ".codex/agents/skill_designer.toml",
  "agentTypeOrRoleRef": "skill_designer-or-discovered-role-name",
  "baselineDigest": "sha256:...",
  "resultReturnedToParentRef": "..."
}
```

Negative cases:

1. app-server `thread/fork` only;
2. retained native-spawn artifact only;
3. direct CLI/shell output;
4. searchable-history fallback;
5. child answer without parent result return;
6. parent claim without runtime spawn/subagent event.

- [ ] **Step 2: Extend Codex corpus/exporter**

`export-codex-session-corpus` must preserve enough current Codex evidence to reconstruct the native Buddy call:

- parent turn id;
- native subagent/spawn call item with actual tool/surface name;
- wait/completion item if the surface uses wait;
- child agent/thread id;
- child final answer ref;
- parent-observed return/result ref;
- `.codex/agents/<member>.toml` baseline definition digest/ref and any required Codex skill/hook/config refs that make the definition visible to the parent runtime;
- exporter manifest digest.

If the current Codex runtime exposes a different native surface name than `spawn_agent` / `wait_agent`, preserve that name exactly and map it to normalized `runtime-native-subagent` only through the validator.

- [ ] **Step 3: Implement Codex adapter and CLI**

Rules:

- Do not accept `src/eval/codex-context-fork-runner.mjs` success as Codex native Buddy proof.
- Do not accept app-server `thread/fork` as native Buddy proof.
- Do not accept retained `record-native-spawn` artifacts without a same-run parent runtime transcript/exporter manifest.
- Require the child answer to be read from the child runtime identity and returned to the parent agent.
- Require the proof to record fork mode (`fork_turns` / full-history equivalent / none) and whether the role/agent type came from the synced Codex definition.
- Add a negative control where `spawn_agent` exists but the child is not associated with the synced `skill_designer` definition; this must fail Buddy proof.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/core/codex-native-buddy-surface-proof.test.mjs test/cli/export-codex-native-buddy-surface-proof-cli.test.mjs test/cli/export-codex-session-corpus-cli.test.mjs test/adapters/codex-runtime-native-spawn.test.mjs
```

Expected: PASS.

---

### Task 5: Unified Runtime-Native Product Root Finalizer

**Files:**
- Create: `scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs`
- Create: `test/cli/finalize-runtime-native-buddy-product-root-cli.test.mjs`
- Modify: `src/eval/evobuddy-runtime-natural-use.mjs`
- Modify: `src/eval/evobuddy-release-grade-provenance.mjs`
- Modify: `test/eval/evobuddy-runtime-natural-use.test.mjs`
- Modify: `test/eval/evobuddy-release-grade-provenance.test.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/ctree.mjs`

**Example:** implements Example 1; preserves Invariants 1-5

**Interfaces:**
- CLI: `npm run context-tree:finalize-runtime-native-buddy-product-root -- --runtime-proof <proof> --out <product-root>`
- Dispatcher: `ctree buddies native finalize --runtime-proof <proof> --out <product-root>`
- Product root fields: `buddy-summary.json`, `runtime-native-buddy-surface-proof.json`, `member-task-run.json` compatibility projection if needed, `product-observed-proof-ref.json`.

- [ ] **Step 1: Add failing finalizer tests**

Cases:

1. Valid OpenCode proof finalizes product root.
2. Valid Claude proof finalizes product root.
3. Valid Codex proof finalizes product root.
4. Adapter-only proof fails.
5. Projection-only proof fails.
6. Baseline digest mismatch fails.
7. Missing parent result return fails.
8. Product root records runtime-specific details without changing normalized top-level semantics.
9. Mechanism proof finalizes as `proofLayer: "nativeMechanism"` and cannot satisfy natural-use release.
10. Natural-use proof with mechanism-named prompt fails.

- [ ] **Step 2: Implement finalizer**

The finalizer should:

- call `validateRuntimeNativeBuddySurfaceProof()`;
- write `runtime-native-buddy-surface-proof.json`;
- write a product summary with `actualSurface: "runtime-native-subagent"` and `proofLayer`;
- write proof ref digests for runtime proof, baseline definition, source transcript, exporter manifest, invocation prompt, and result;
- optionally project a `MemberTaskRun` compatibility record without reviving `member-m[1]` authority.

- [ ] **Step 3: Wire evals**

`evobuddy-runtime-natural-use` and release-grade provenance should accept `--runtime-native-buddy-surface-proof` or product roots finalized from it for all three runtimes.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/cli/finalize-runtime-native-buddy-product-root-cli.test.mjs test/eval/evobuddy-runtime-natural-use.test.mjs test/eval/evobuddy-release-grade-provenance.test.mjs
```

Expected: PASS.

---

### Task 6: Runtime Instruction Installers And Natural Use Guidance

**Files:**
- Modify: `src/install/opencode-member-instructions.mjs`
- Create or modify: `src/install/claude-member-instructions.mjs`
- Create or modify: `src/install/codex-member-instructions.mjs`
- Modify: `src/install/member-projection-installer.mjs`
- Modify: `scripts/context-tree/install-member-projections.mjs`
- Modify: `test/install/opencode-member-instructions.test.mjs`
- Create: `test/install/claude-member-instructions.test.mjs`
- Create: `test/install/codex-member-instructions.test.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`

**Example:** implements Examples 1-4; preserves Invariants 1-5

**Interfaces:**
- Produces install report fields: `runtimeInstructions.{opencode,claude,codex}` with refs/digests.
- Instructions tell parent agents when to call Buddy, not how to fake evidence.

- [ ] **Step 1: Add failing instruction tests**

For each runtime, assert instructions:

1. mention synced native Buddy/subagent definitions as normal surface;
2. say parent supplies the task prompt;
3. say return result to parent;
4. do not instruct the Buddy to repeat canaries or output proof sections;
5. do not tell the parent to use `invoke-buddy` as the normal path;
6. label adapter/CLI fallback as fallback only;
7. make the installed Buddy visible/discoverable by the parent runtime's native subagent mechanism;
8. for Codex, reference the actual discovered surface from Task 0 rather than a generic TOML file if additional skills/hooks/config are required.

- [ ] **Step 2: Implement runtime-specific installers**

Outputs:

- OpenCode: project instruction fragment for native task/subagent use.
- Claude Code: instruction fragment referencing `.claude/agents/<member>.md` subagent definitions.
- Codex: instruction fragment referencing `.codex/agents/<member>.toml` or the current Codex subagent surface discovered in Task 0.

If Codex requires skills/hooks/config to expose agent definitions, install those as part of Codex projection and record refs/digests.

- [ ] **Step 3: Update doctor**

Doctor must verify instruction files exist and contain native-first/fallback-labeled wording for all three runtimes. It must also verify the runtime visibility entrypoints recorded by Task 0: OpenCode task/subagent instructions, Claude subagent definitions, and Codex `.codex/agents` plus any required skill/hook/config surface. Missing Codex/Claude/OpenCode visibility entrypoints are release-blocking for MVP.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/install/opencode-member-instructions.test.mjs test/install/claude-member-instructions.test.mjs test/install/codex-member-instructions.test.mjs test/cli/install-member-projections-cli.test.mjs
```

Expected: PASS.

---

### Task 7: Three-Runtime Release Eval CLI

**Files:**
- Create: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
- Create: `test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/ctree.mjs`
- Modify: `docs/three-runtime-buddy-surface-mvp.md`

**Example:** observes Examples 1-4; preserves Invariants 1-5

**Interfaces:**
- CLI: `npm run context-tree:run-three-runtime-buddy-surface-release-eval -- --project <project> --member <member> --out <out> --require-runtimes opencode,claude,codex --product-root-<runtime> <mechanism-root> --natural-root-<runtime> <natural-root>`
- Dispatcher: `ctree buddies native release-eval --project <project> --member <member> --out <out> --require-runtimes opencode,claude,codex`
- Report: `<out>/three-runtime-buddy-surface-release-report.json`

- [ ] **Step 1: Add failing release eval tests**

Cases:

1. Passes only when OpenCode, Claude, and Codex product roots all validate as runtime-native.
2. Missing Codex proof blocks/fails release even if OpenCode and Claude pass.
3. Adapter-only Codex proof fails.
4. Projection-only Claude proof fails.
5. OpenCode native pass does not imply Claude/Codex pass.
6. `--require-runtimes opencode,claude` is rejected for MVP mode.
7. Report records per-runtime `status`, `baselineProjectionPass`, `nativeMechanismPass`, `naturalUsePass`, `proofRef`, `proofDigest`, and `knownLosses`.
8. Mechanism proof without natural-use proof blocks release.
9. Natural-use proof fails if the user prompt names Context Tree adapter commands or native mechanism commands.

- [ ] **Step 2: Implement eval aggregator**

The aggregator should:

- read product roots or proof refs from runtime-specific subdirectories;
- call shared validator for each runtime;
- require all three runtimes by default;
- produce top-level `verdict: "pass" | "fail" | "blocked"`;
- compute and expose `baselineProjectionPass`, `nativeMechanismPass`, and `naturalUsePass` for each runtime and top-level aggregate;
- list exact blocked/missing runtime evidence;
- never synthesize proof from generated files alone.

- [ ] **Step 3: Add docs**

`docs/three-runtime-buddy-surface-mvp.md` should explain:

- product story: Buddy as native subagent in all three runtimes;
- setup/sync/doctor flow;
- native proof flow;
- adapter fallback boundary;
- release eval command;
- what `blocked` means.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs test/core/runtime-native-buddy-surface-proof.test.mjs
```

Expected: PASS.

---

### Task 8: Product Entry, Workbench, And Release Readiness Surface

**Files:**
- Modify: `scripts/context-tree/ctree.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/install-member-projections.mjs`
- Modify: `scripts/context-tree/render-member-workbench.mjs`
- Modify: `scripts/context-tree/run-member-setup-import.mjs` if product import/setup wiring is not reachable from `ctree`
- Create: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Create: `test/cli/run-product-release-readiness-eval-cli.test.mjs`
- Modify: `test/cli/ctree-cli.test.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`
- Modify: `test/cli/render-member-workbench-cli.test.mjs` if present, otherwise create focused coverage around the existing workbench command
- Modify: `README.md`
- Create or modify: `docs/release-mvp.md`
- Modify: `.gitignore` only if generated project-state outputs need to be excluded

**Example:** observes Examples 1-4; preserves Invariants 1-5

**Interfaces:**
- Product CLI must expose: `ctree setup`, `ctree doctor`, `ctree buddies sync`, `ctree buddies native probe`, `ctree buddies native release-eval`, `ctree workbench`, and `ctree members import`.
- Project state layout must be documented and created when needed: `.context-tree/registry.json`, `.context-tree/runs/`, `.context-tree/imports/`, `.context-tree/mutations/`, `.context-tree/release/`.
- Readiness eval CLI: `npm run context-tree:run-product-release-readiness-eval -- --project <project> --out <out> --require-runtimes opencode,claude,codex`.

- [ ] **Step 1: Add failing product-entry tests**

Cases:

1. `node scripts/context-tree/ctree.mjs --help` lists setup, doctor, buddies sync, buddies native, workbench, and members import.
2. `package.json` exposes a `bin.ctree` entrypoint or an equivalent release CLI entrypoint.
3. `ctree setup --project <tmp>` creates `.context-tree/registry.json`, `.context-tree/runs/`, `.context-tree/imports/`, `.context-tree/mutations/`, and `.context-tree/release/` without requiring runtime proof.
4. `ctree doctor --project <tmp>` reports missing runtime proof as release-blocking but does not claim failure of setup.
5. `ctree buddies sync` delegates to baseline projection/install and records all three runtime definition refs.
6. `ctree workbench --project <tmp>` can render confirmed Buddy profiles and native run evidence once product roots exist.
7. `ctree members import` can surface candidate/import state through the existing setup/import mechanism; it must not create durable memory without the existing agent/user-confirmed mutation path.

- [ ] **Step 2: Implement CLI dispatch and state layout**

Implementation requirements:

- Keep command wrappers thin; they should delegate to existing scripts/modules.
- Do not make Workbench the primary task execution surface. Parent agent remains first product surface.
- Do not make CLI adapter invocation the normal Buddy execution path.
- State files must be deterministic JSON and safe to inspect.
- Mutations must append to the existing mutation log shape rather than rewriting history.

- [ ] **Step 3: Add release docs**

`README.md` and `docs/release-mvp.md` must document:

- install/setup command;
- how to sync Buddies to OpenCode, Claude Code, and Codex;
- how a parent agent should use native Buddies;
- how to run doctor;
- how to open Workbench/import;
- how to run three-runtime release eval;
- explicit fallback boundary: adapter works as fallback but does not satisfy native MVP release.

- [ ] **Step 4: Add product readiness eval**

`run-product-release-readiness-eval` must fail unless all are true:

1. prerequisites completed: baseline projection migration and invocation artifact schema migration gates pass;
2. `ctree setup` creates product state;
3. `ctree buddies sync` creates three runtime definitions containing baseline content;
4. `ctree doctor` passes setup/sync/per-material baseline validation;
5. native mechanism product roots for OpenCode, Claude Code, and Codex exist and validate;
6. natural-use product roots for OpenCode, Claude Code, and Codex exist and validate;
7. Workbench renders the Buddy and all three native mechanism + natural-use task runs;
8. docs/readme mention all release commands;
9. adapter-only/product fallback roots are rejected for native MVP release;
10. mechanism-named prompts are rejected for natural-use release.

- [ ] **Step 5: Run focused tests**

```bash
node --test test/cli/ctree-cli.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs test/cli/install-member-projections-cli.test.mjs
```

Expected: PASS.

---

### Task 9: Live Eval -> Correction -> Re-Eval Loop For All Three Runtimes

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Write live outputs under `/tmp/context-tree-three-runtime-buddy-surface-live-<timestamp>/`
- No source changes unless correction loop finds implementation/eval defects.

**Example:** observes Examples 1-4; preserves Invariants 1-5

- [ ] **Step 1: Prepare temp project**

Create a temp project with:

- confirmed `skill-designer` profile;
- role memory content `Prefer symptom-driven trigger review before implementation details.`;
- baseline sync outputs for OpenCode, Claude, and Codex;
- runtime instructions installed.

Run:

```bash
npm run context-tree:generate-member-projections -- --registry "$TMP/members/registry.json" --out "$TMP/project" --member skill-designer
npm run context-tree:install-member-projections -- doctor --registry "$TMP/members/registry.json" --project "$TMP/project" --member skill-designer --report-out "$TMP/doctor-report.json"
```

Expected: doctor pass and per-material content validation pass for all three runtime definitions.

- [ ] **Step 2: Run runtime surface probe**

```bash
npm run context-tree:probe-three-runtime-buddy-surfaces -- --project "$TMP/project" --out "$TMP/probe" --require-runtimes opencode,claude,codex
```

Expected: probe writes observed or blocked details for all three. Probe cannot satisfy release pass.

- [ ] **Step 3: Produce real OpenCode native mechanism proof**

Use a real OpenCode parent-agent session rooted at the temp project. This mechanism run may explicitly authorize the parent to use OpenCode native task/subagent execution, but must not use `invoke-buddy`.

Then export/finalize:

```bash
npm run context-tree:export-opencode-native-buddy-task-proof -- --project "$TMP/project" --member skill-designer --out "$TMP/opencode-proof"
npm run context-tree:finalize-runtime-native-buddy-product-root -- --runtime-proof "$TMP/opencode-proof/runtime-native-buddy-surface-proof.json" --out "$TMP/product/opencode"
```

Expected: OpenCode product root validates as runtime-native with `proofLayer: "nativeMechanism"`.

- [ ] **Step 3b: Produce real OpenCode natural-use proof**

Use a separate real OpenCode parent-agent session rooted at the temp project. The user prompt must ask for the review task without naming Context Tree, `ctree`, `invoke-buddy`, native task, spawn, or subagent commands. The parent must choose the synced `skill-designer` Buddy through installed native runtime guidance. Export/finalize to `$TMP/product/opencode-natural`.

Expected: OpenCode natural-use root validates with `proofLayer: "naturalUse"` and no mechanism-named prompt.

- [ ] **Step 4: Produce real Claude Code native mechanism proof**

Use a real Claude Code parent-agent session rooted at the temp project. This mechanism run may explicitly authorize use of the generated Claude subagent definition.

Then export/finalize:

```bash
npm run context-tree:export-claude-native-buddy-surface-proof -- --project "$TMP/project" --member skill-designer --out "$TMP/claude-proof"
npm run context-tree:finalize-runtime-native-buddy-product-root -- --runtime-proof "$TMP/claude-proof/runtime-native-buddy-surface-proof.json" --out "$TMP/product/claude"
```

Expected: Claude product root validates as runtime-native with `proofLayer: "nativeMechanism"`. If Claude transcript export is unavailable, retain blocked evidence; the plan is not complete and the product is not releasable until this passes or the user changes the release requirement.

- [ ] **Step 4b: Produce real Claude Code natural-use proof**

Use a separate real Claude Code parent-agent session. The user prompt must not name Context Tree, `ctree`, adapter commands, or subagent/native mechanism commands. The parent must choose the synced `skill-designer` subagent from installed definitions/instructions. Export/finalize to `$TMP/product/claude-natural`.

Expected: Claude natural-use root validates with `proofLayer: "naturalUse"`.

- [ ] **Step 5: Produce real Codex native mechanism proof**

Use a real Codex parent-agent session rooted at the temp project. This mechanism run may explicitly authorize the parent to use the discovered Codex native multi-agent surface for `skill-designer` (for example `spawn_agent` with the required `fork_turns` / role fields if Task 0 discovers that surface), but must not use app-server `thread/fork` or `invoke-buddy`.

Then export/finalize:

```bash
npm run context-tree:export-codex-native-buddy-surface-proof -- --project "$TMP/project" --member skill-designer --out "$TMP/codex-proof"
npm run context-tree:finalize-runtime-native-buddy-product-root -- --runtime-proof "$TMP/codex-proof/runtime-native-buddy-surface-proof.json" --out "$TMP/product/codex"
```

Expected: Codex product root validates as runtime-native with `proofLayer: "nativeMechanism"`, actual discovered surface name, fork mode, child runtime identity, and result return. If Codex surface discovery contradicts the expected surface, update the Codex exporter/tests to the actual surface and rerun. If no native Codex Buddy surface can be observed, retain blocked evidence; the plan is not complete and the product is not releasable until this passes or the user changes the release requirement.

- [ ] **Step 5b: Produce real Codex natural-use proof**

Use a separate real Codex parent-agent session. The user prompt must not name Context Tree, `ctree`, `invoke-buddy`, `spawn_agent`, `wait_agent`, `task`, `subagent`, `/fork`, or mechanism commands. The parent must choose the synced `skill-designer` Buddy through Codex's installed runtime definitions/instructions. Export/finalize to `$TMP/product/codex-natural`.

Expected: Codex natural-use root validates with `proofLayer: "naturalUse"`, the discovered Codex surface, and no mechanism-named prompt.

- [ ] **Step 6: Run three-runtime release eval**

```bash
npm run context-tree:run-three-runtime-buddy-surface-release-eval -- --project "$TMP/project" --member skill-designer --out "$TMP/release" --require-runtimes opencode,claude,codex --product-root-opencode "$TMP/product/opencode" --product-root-claude "$TMP/product/claude" --product-root-codex "$TMP/product/codex" --natural-root-opencode "$TMP/product/opencode-natural" --natural-root-claude "$TMP/product/claude-natural" --natural-root-codex "$TMP/product/codex-natural"
```

Expected:

```json
{
  "verdict": "pass",
  "runtimes": {
    "opencode": { "status": "pass", "baselineProjectionPass": true, "nativeMechanismPass": true, "naturalUsePass": true },
    "claude": { "status": "pass", "baselineProjectionPass": true, "nativeMechanismPass": true, "naturalUsePass": true },
    "codex": { "status": "pass", "baselineProjectionPass": true, "nativeMechanismPass": true, "naturalUsePass": true }
  }
}
```

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, proof artifact path, exporter manifest, transcript/session ref, DB digest, and exact validator issue.
2. Classify the root cause: implementation defect, exporter/proof validator defect, runtime capability missing, environment/transient failure, unclear requirement, or design mismatch.
3. For implementation or validator defects, write or update a failing regression test that fails for the retained failure before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn real missing runtime evidence into pass.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the same runtime proof export/finalize command. Expected: PASS or the same honest blocked result with retained evidence.
7. Rerun the three-runtime release eval. Expected: PASS only when all three runtime mechanism roots and all three natural-use roots validate.
8. Run product readiness eval from Task 8 after the three-runtime release eval passes. Expected: PASS.
9. If a runtime mechanism proof passes but natural-use proof fails, fix runtime instructions/visibility or natural-use classification; do not mark release complete.
10. If Codex proof fails, first compare against Task 0 primary-source discovery and update the Codex exporter to the actual surface before considering any block.
11. Update `.superpowers/sdd/progress.md` with the exact artifact paths and final status.
12. Repeat until release eval and product readiness eval pass. If a human decision or repeated external runtime capability block remains, mark the implementation blocked, not complete.

---

### Task 10: Final Verification Bundle

Run:

```bash
node --test \
  test/docs/runtime-native-buddy-surface-proof-contract.test.mjs \
  test/core/runtime-native-buddy-surface-proof.test.mjs \
  test/core/opencode-native-buddy-surface-proof.test.mjs \
  test/core/claude-native-buddy-surface-proof.test.mjs \
  test/core/codex-native-buddy-surface-proof.test.mjs \
  test/cli/probe-three-runtime-buddy-surfaces-cli.test.mjs \
  test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs \
  test/cli/export-claude-native-buddy-surface-proof-cli.test.mjs \
  test/cli/export-codex-native-buddy-surface-proof-cli.test.mjs \
  test/cli/finalize-runtime-native-buddy-product-root-cli.test.mjs \
  test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs \
  test/eval/evobuddy-runtime-natural-use.test.mjs \
  test/eval/evobuddy-release-grade-provenance.test.mjs

# Use the fresh live root produced by Task 9. Example:
# export TMP=/tmp/context-tree-three-runtime-buddy-surface-live-<timestamp>
npm run context-tree:run-product-release-readiness-eval -- --project "$TMP/project" --out "$TMP/product-readiness" --require-runtimes opencode,claude,codex --release-report "$TMP/release/three-runtime-buddy-surface-release-report.json"

npm test

git diff --check
```

Expected:

- focused tests pass;
- full `npm test` passes;
- `git diff --check` clean;
- three-runtime release eval has a fresh live run recorded in `.superpowers/sdd/progress.md`;
- product readiness eval passes from a fresh temp project;
- OpenCode, Claude Code, and Codex all have runtime-native Buddy mechanism proof and natural-use proof;
- no release artifact status is `blocked`, `not-run`, `retained-only`, `projection-only`, `adapter-only`, or `mechanism-only`;
- each runtime reports `baselineProjectionPass`, `nativeMechanismPass`, and `naturalUsePass`;
- Workbench/import/setup/doctor docs and CLI entrypoints are present and tested.

---

## Out Of Scope / Next Plans

- Quality eval comparing Buddy answer quality across runtimes.
- Quality-scored autonomous routing comparison across models. Natural parent-agent Buddy use is in scope; quality scoring of when the agent chooses a Buddy without any release-run instruction is not.
- Evolution/Dream daily scheduler. This plan only ensures native Buddy execution can consume synced baseline definitions.
- Replacing runtime-specific exporters with a universal telemetry API.
