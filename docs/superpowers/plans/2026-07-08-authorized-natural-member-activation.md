# Authorized Natural Member Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the real authorized member path for `skill-designer`: a natural user-facing member task is explicitly authorized to run through native spawn, the child result returns to the parent, Context Tree writes `MemberTaskRun` plus lifecycle artifacts, and eval reports `lifecycleVerdict.status = "pass"` with `summary.acceptanceTiers["authorized-natural-native-spawn"] = "pass"`.

**Architecture:** Reuse the existing member lifecycle pipeline instead of extending retained-artifact-only proof. Build a dedicated opt-in runner around `runRuntimeNativeSpawnPipeline()` so the authorized path produces the same `member-task-request.json`, `member-task-run.json`, `member-context-render.json`, and `material-selection-report.json` that the existing natural/member lifecycle path already knows how to validate. Keep “authorized-natural-member-activation” as an eval case/scenario name only; do not introduce a new product primitive beyond `MemberTaskRun` and the existing acceptance-tier vocabulary.

**Tech Stack:** Node.js ESM, existing Codex app-server client/evidence collector, `runRuntimeNativeSpawnPipeline()`, existing native-spawn eval ingest, Node test runner, JSON artifact fixtures, Context Tree docs/runbooks.

## Global Constraints

- The success path must fill the existing tier key `authorized-natural-native-spawn`; do not create a new acceptance tier id.
- The new scenario must prove a **real authorized usage path**, not another retained-artifact-only proof.
- The new scenario must use `memberName = "skill-designer"` and must prove `memberTaskRun.result.returnedTo === "parent-agent"`.
- The new scenario must end with `lifecycleVerdict.status === "pass"` and `lifecycleVerdict.checked === true`.
- The authorized member-activation case must reject these substitutes: retained-artifact-only proof, summary-only proof, provider-forced proof, and post-hoc member relabeling.
- Do not introduce a new `MemberActivation` runtime/product object. `MemberTaskRun` remains the ledger.
- Reuse `runRuntimeNativeSpawnPipeline()` for the member lifecycle path; do not duplicate lifecycle writeback logic into a second bespoke pipeline.
- Keep hermetic tests hermetic. Opt-in live verification must run from a dedicated command and must not be required by `npm test`.
- Do not broaden this slice into `natural-skill-request` or `natural-provider-driven-native-spawn`. Those remain later phases.
- This slice does **not** prove automatic member routing. It proves authorized explicit member task execution from a natural user-facing task. The runner/config may select `memberName = "skill-designer"` explicitly; automatic routing remains out of scope.
- If external context from `../design-review-bdd-lab` or session `019e88d9-120b-7e41-9e7c-333e05094257` is useful, treat it as prompt/reference input only, never as a test dependency.

---

## Concrete Examples

### Example 1: Authorized Natural Member Activation Pass

- **Example:** A user-level task asks for a design-review-style analysis suitable for `skill-designer`, the caller explicitly selects/authorizes the `skill-designer` member, the runtime uses the authorized native spawn path, the child result returns to the parent, and the run writes `member-task-request.json`, `member-task-run.json`, `member-context-render.json`, and `material-selection-report.json`.
- **Expected result:** The eval case `authorized-natural-member-activation` passes with `acceptanceTier.id === "authorized-natural-native-spawn"`, `memberName === "skill-designer"`, `memberTaskRun.result.returnedTo === "parent-agent"`, `materialSelectionMode` in a native-spawn/native-fork mode, `lifecycleVerdict.status === "pass"`, and `summary.acceptanceTiers["authorized-natural-native-spawn"] === "pass"`.
- **Verification:** `node --test test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs test/cli/run-authorized-member-activation-e2e-cli.test.mjs` plus an opt-in live rerun command from the new script.
- **Failure signal:** The case passes from a provider-forced artifact, a retained-only fixture, a run without `member-task-run.json`, a run without lifecycle refs, a run whose `returnedTo` is not `parent-agent`, or a run whose tier is anything except `authorized-natural-native-spawn`.
- **If it fails:** Fix the authorized runner or the case-specific lifecycle/oracle checks. Do not loosen the oracle.

### Invariants

- Invariant 1: `MemberTaskRun` remains the product execution ledger; “authorized-natural-member-activation” is an eval/scenario label only.
- Invariant 2: Lifecycle closure must be read from `lifecycleVerdict` / `nativeSpawnLifecyclePass`, not from `nativeSpawnPass` alone.
- Invariant 3: `authorized-natural-native-spawn` must not be satisfiable by provider-forced or retained-artifact-only shortcuts.
- Invariant 4: `memberTaskRun.result.returnedTo === "parent-agent"` is required proof; parent continuation beyond that is out of scope.
- Invariant 5: This scenario proves explicit authorized member execution, not automatic member routing.

## File Structure

- Create `scripts/context-tree/run-authorized-member-activation-e2e.mjs`: new opt-in live runner for the authorized member activation scenario.
- Create `test/cli/run-authorized-member-activation-e2e-cli.test.mjs`: hermetic CLI coverage for the new runner’s argument gates, artifact output, and eval ingest.
- Modify `src/eval/canaries.mjs`: add the new eval case id and reviewer prompt wiring.
- Modify `src/eval/native-spawn-artifact.mjs`: add case-specific validation for `authorized-natural-member-activation` so it cannot pass from forbidden proof modes.
- Modify `test/eval/native-spawn-artifact.test.mjs`: add positive/negative case-level oracle tests for the new eval case.
- Modify `test/eval/report.test.mjs`: assert the authorized tier + lifecycle summary shape for the new scenario.
- Create `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/acceptance-proof.json` and companion lifecycle artifacts after the first successful live run, then check them in as retained regression fixtures.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`: document the new opt-in runner, its scope, and the “not provider-forced” boundary.

## Task 1: Add the Authorized Member Activation Eval Vocabulary and Oracle Guards

**Files:**
- Modify: `src/eval/canaries.mjs`
- Modify: `src/eval/native-spawn-artifact.mjs`
- Modify: `test/eval/native-spawn-artifact.test.mjs`
- Modify: `test/eval/report.test.mjs`

**Example:** implements Example 1 and preserves Invariants 1-5

**Interfaces:**
- Consumes: existing native-spawn artifact case-result flow from `nativeSpawnCaseResultFromArtifact(artifact, options)`.
- Produces: a new case id `authorized-natural-member-activation` whose artifacts can be evaluated with the same report pipeline.

- [ ] **Step 1: Add failing eval tests for the new case id and its required pass shape using inline temp artifacts.**

  Extend `test/eval/native-spawn-artifact.test.mjs` with a dedicated describe block:

  ```js
  function createAuthorizedMemberActivationBundle(overrides = {}) {
    const bundle = createLifecycleBundle({
      request: { expectedResultReturn: 'parent-agent' },
      run: {
        memberName: 'skill-designer',
        result: {
          resultRef: './spawn-result.json',
          returnedTo: 'parent-agent',
          summary: 'authorized member result',
        },
      },
      artifact: {
        caseId: 'authorized-natural-member-activation',
        acceptanceMode: 'authorized-natural-native-spawn',
        acceptanceTier: { id: 'authorized-natural-native-spawn' },
        providerForcedLiveProof: false,
        deterministicProviderProof: false,
      },
      ...overrides,
    });
    return bundle;
  }

  it('passes authorized-natural-member-activation only when the artifact proves the member lifecycle path', async () => {
    const bundle = createAuthorizedMemberActivationBundle();
    const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
      canaries: createCanarySet('authorized-member-live'),
      mode: 'mock',
    });

    assert.equal(result.caseId, 'authorized-natural-member-activation');
    assert.equal(result.acceptanceTier?.id, 'authorized-natural-native-spawn');
    assert.equal(result.verdict, 'pass');
    assert.equal(result.lifecycleVerdict?.status, 'pass');
    assert.equal(result.lifecycleVerdict?.checked, true);
    assert.deepEqual(result.lifecycleVerdict?.issues, []);
  });

  it('fails authorized-natural-member-activation when the artifact is provider-forced or retained-only', async () => {
    const bundle = createAuthorizedMemberActivationBundle({
      artifact: {
        providerForcedLiveProof: true,
        deterministicProviderProof: true,
      },
    });
    const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
      canaries: createCanarySet('authorized-member-live'),
      mode: 'mock',
    });

    assert.equal(result.verdict, 'fail');
    assert.match(result.failureReason, /provider-forced|retained|authorized-natural-member-activation/i);
  });

  it('fails authorized-natural-member-activation when returnedTo is not parent-agent', async () => {
    const bundle = createAuthorizedMemberActivationBundle({
      run: {
        result: {
          resultRef: './spawn-result.json',
          returnedTo: 'child-agent',
          summary: 'wrong target',
        },
      },
    });
    const result = await nativeSpawnCaseResultFromArtifact(bundle.artifact, {
      canaries: createCanarySet('authorized-member-live'),
      mode: 'mock',
    });

    assert.equal(result.verdict, 'fail');
    assert.match(result.failureReason, /returnedTo|parent-agent/i);
  });
  ```

  `createLifecycleBundle()` must be a test-local helper in `test/eval/native-spawn-artifact.test.mjs` or an existing helper already defined in that file. Do not depend on the checked-in `authorized-natural-member-activation-positive` fixture in Task 1; that fixture is created only after the first successful live run. If no helper exists, create temp files with `mkdtempSync`, `writeFileSync`, and `rmSync` inside this test file so the initial red failure is about unsupported case/oracle behavior, not about a missing retained fixture.

  Extend `test/eval/report.test.mjs` with:

  ```js
  it('marks authorized-natural-native-spawn pass only from the authorized member activation case', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-natural-member-activation',
        verdict: 'pass',
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        acceptanceTier: { id: 'authorized-natural-native-spawn' },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'multiagent-v1-fork_context',
        },
      })],
    });

    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
    assert.equal(report.summary.nativeSpawnLifecyclePass, true);
  });
  ```

- [ ] **Step 2: Run the focused eval tests and verify they fail for the intended reason.**

  Run: `node --test test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs`

  Expected: FAIL because `authorized-natural-member-activation` is not yet a known case and the case-specific guards do not exist. It must not fail because a checked-in fixture bundle is missing.

- [ ] **Step 3: Add the new case id to `src/eval/canaries.mjs`.**

  Extend the case vocabulary:

  ```js
  const VALID_CASE_IDS = [
    ...,
    'authorized-natural-member-activation',
  ];

  const CASE_EXPECTED_KEYS = {
    ...,
    'authorized-natural-member-activation': ['survive'],
  };
  ```

  Add a reviewer prompt that stays canary-clean but encodes the member path question:

  ```js
  case 'authorized-natural-member-activation':
    return [
      'Question: Which exact CTREE-* identifiers are visible for the delegated member task result returned from the authorized native-spawn boundary?',
      'Answer with exact identifiers only, or "unknown".',
      'Do not guess and do not use tools.',
    ].join('\n');
  ```

- [ ] **Step 4: Add case-specific proof guards in `src/eval/native-spawn-artifact.mjs`.**

  After the lifecycle verdict is computed, add a dedicated validator for the new case:

  ```js
  function validateAuthorizedNaturalMemberActivation(artifact, memberTaskRun) {
    const issues = [];
    if (artifact?.acceptanceTier?.id !== 'authorized-natural-native-spawn') {
      issues.push('authorized-natural-member-activation requires acceptanceTier.id=authorized-natural-native-spawn');
    }
    if (artifact?.acceptanceMode !== 'authorized-natural-native-spawn') {
      issues.push('authorized-natural-member-activation requires acceptanceMode=authorized-natural-native-spawn');
    }
    if (artifact?.providerForcedLiveProof === true || artifact?.deterministicProviderProof === true) {
      issues.push('authorized-natural-member-activation must not use provider-forced or deterministic provider proof');
    }
    if (memberTaskRun?.memberName !== 'skill-designer') {
      issues.push('authorized-natural-member-activation requires memberName=skill-designer');
    }
    if (memberTaskRun?.result?.returnedTo !== 'parent-agent') {
      issues.push('authorized-natural-member-activation requires result.returnedTo=parent-agent');
    }
    if (memberTaskRun?.materialSelectionMode === 'summary-only') {
      issues.push('authorized-natural-member-activation must not use summary-only material selection');
    }
    return issues;
  }
  ```

  Wire this only for `caseId === 'authorized-natural-member-activation'`. Merge its issues into `lifecycleVerdict.issues`, and if any exist, force `status: 'fail'`.

- [ ] **Step 5: Re-run the focused eval tests.**

  Run: `node --test test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs`

  Expected: PASS.

## Task 2: Build a Dedicated Opt-In Authorized Member Activation Runner on the Existing Pipeline

**Files:**
- Create: `scripts/context-tree/run-authorized-member-activation-e2e.mjs`
- Modify: `package.json`
- Create: `test/cli/run-authorized-member-activation-e2e-cli.test.mjs`

**Example:** implements Example 1 and preserves Invariants 1-5

**Interfaces:**
- Consumes: `runRuntimeNativeSpawnPipeline({...})` from `src/adapters/codex-native-spawn-pipeline.mjs` using the same top-level input shape as `scripts/context-tree/run-natural-native-spawn-e2e.mjs` (`client`, `protocol`, `outputDir`, `sourceThreadId`, `requesterNodeId`, `baseCheckpointId`, `checkpointAnchor`, `checkpointLabel`, `checkpointPurpose`, `role`, `memberName`, `registryRef`, `question`, `targetRefs`, `roleHistoryRefs`, `requestedMaterials`, `returnedTo`, `requiredRoleHistoryCanaries`, `requiredTargetMaterialCanaries`, and prompt inputs).
- Produces: a run directory with `acceptance-proof.json`, `member-task-request.json`, `member-task-run.json`, `member-context-render.json`, `material-selection-report.json`, and `eval/capability-matrix.json`.

- [ ] **Step 1: Write failing CLI tests for the new runner.**

  Create `test/cli/run-authorized-member-activation-e2e-cli.test.mjs` with three initial tests:

  ```js
  const CONFIG_FIXTURE = join(REPO_ROOT, 'evals', 'fixtures', 'member-task-runs', 'authorized-natural-member-activation-config.json');

  it('rejects runs missing --authorized or CTREE_AUTHORIZED_NATIVE_SPAWN=1', () => {
    const result = runCli(['--out', runDir]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /authorized/i);
  });

  it('writes member lifecycle artifacts and eval output for the authorized member activation fixture path', () => {
    const result = runCli([
      '--fixture-mode',
      '--authorized',
      '--out', runDir,
      '--config', CONFIG_FIXTURE,
    ], {
      env: { ...process.env, CTREE_AUTHORIZED_NATIVE_SPAWN: '1' },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(runDir, 'member-task-request.json')), true);
    assert.equal(existsSync(join(runDir, 'member-task-run.json')), true);
    assert.equal(existsSync(join(runDir, 'member-context-render.json')), true);
    assert.equal(existsSync(join(runDir, 'material-selection-report.json')), true);

    const report = JSON.parse(readFileSync(join(runDir, 'eval', 'capability-matrix.json'), 'utf8'));
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
  });

  it('records result.returnedTo as parent-agent in the authorized member activation path', () => {
    const run = JSON.parse(readFileSync(join(runDir, 'member-task-run.json'), 'utf8'));
    assert.equal(run.memberName, 'skill-designer');
    assert.equal(run.result.returnedTo, 'parent-agent');
  });
  ```

- [ ] **Step 2: Run the new CLI test and verify it fails.**

  Run: `node --test test/cli/run-authorized-member-activation-e2e-cli.test.mjs`

  Expected: FAIL because the runner does not exist.

- [ ] **Step 3: Implement `scripts/context-tree/run-authorized-member-activation-e2e.mjs` as a thin pipeline wrapper.**

  Start from the structure of `run-natural-native-spawn-e2e.mjs`, but keep the authorization gates from `run-autonomous-native-spawn-experiment.mjs`:

  ```js
  if (!argv.authorized) {
    throw new Error('authorized member activation requires --authorized');
  }
  if (process.env.CTREE_AUTHORIZED_NATIVE_SPAWN !== '1') {
    throw new Error('authorized member activation requires CTREE_AUTHORIZED_NATIVE_SPAWN=1');
  }
  ```

  Build the pipeline call with the same checkpoint/writeback inputs used by `run-natural-native-spawn-e2e.mjs` plus the required native-spawn record fields:

  ```js
  const pipelineResult = await runRuntimeNativeSpawnPipeline({
    ...config,
    client,
    protocol,
    outputDir: runDir,
    sourceThreadId,
    model: config.model,
    cwd: config.cwd ?? REPO_ROOT,
    parentPrompt: config.parentPrompt,
    prompt: config.childPrompt,
    requesterNodeId: config.requesterNodeId,
    baseCheckpointId: config.baseCheckpointId,
    checkpointAnchor: config.checkpointAnchor,
    checkpointLabel: config.checkpointLabel,
    checkpointPurpose: config.checkpointPurpose,
    role: config.role ?? 'reviewer',
    memberName: 'skill-designer',
    registryRef: config.registryRef,
    taskKind: 'review',
    question: config.question,
    targetRefs: config.targetRefs,
    roleHistoryRefs: config.roleHistoryRefs,
    requestedMaterials: config.requestedMaterials,
    returnedTo: 'parent-agent',
    requiredRoleHistoryCanaries: config.requiredRoleHistoryCanaries,
    requiredTargetMaterialCanaries: config.requiredTargetMaterialCanaries,
  });
  ```

  Construct the acceptance proof the same way `run-natural-native-spawn-e2e.mjs` does: derive evidence refs from `result.contextTree.spawnRunManifest.evidenceRefs`, derive the checkpoint anchor from `result.contextTree.checkpointManifest.anchor`, and use the pipeline return object directly. Do **not** read `pipelineResult.artifact`; `runRuntimeNativeSpawnPipeline()` does not return an `artifact` object. Also do not spread any existing artifact after setting `caseId` / `acceptanceMode` / `acceptanceTier`, because that can silently overwrite the authorized proof fields.

  ```js
  function proofEvidenceRefs(result) {
    const evidenceRefs = result.contextTree?.spawnRunManifest?.evidenceRefs;
    return Array.isArray(evidenceRefs) ? evidenceRefs : [];
  }

  function proofCheckpointAnchor(result) {
    const anchor = result.contextTree?.checkpointManifest?.anchor;
    return anchor && typeof anchor === 'object' && !Array.isArray(anchor) ? anchor : undefined;
  }

  const acceptanceProof = {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'authorized-natural-member-activation',
    acceptanceMode: 'authorized-natural-native-spawn',
    acceptanceTier: {
      id: 'authorized-natural-native-spawn',
      mechanism: 'authorized-natural',
      scope: 'real-task-member-activation',
      runtimeNativeSpawn: true,
      autonomousTrigger: false,
      defaultRegression: false,
      productRole: 'ux-experiment',
    },
    sourceThreadId: pipelineResult.sourceThreadId,
    checkpointAnchor: proofCheckpointAnchor(pipelineResult),
    spawnedAgentId: pipelineResult.childThreadId,
    childThreadId: pipelineResult.childThreadId,
    observableChildId: pipelineResult.childThreadId,
    forkMode: pipelineResult.forkMode,
    reviewerPrompt: pipelineResult.preparedMemberRequest?.requestPromptText ?? config.childPrompt,
    observedAnswer: pipelineResult.observedAnswer,
    waitCompletion: pipelineResult.waitCompletion,
    artifactRefs: {
      outputDir: runDir,
      checkpointManifestPath: pipelineResult.artifactRefs.checkpointManifestPath,
      spawnRunManifestPath: pipelineResult.artifactRefs.spawnRunManifestPath,
      spawnResultManifestPath: pipelineResult.artifactRefs.spawnResultManifestPath,
      memberTaskRequestPath: pipelineResult.artifactRefs.memberTaskRequestPath,
      memberTaskRunPath: pipelineResult.artifactRefs.memberTaskRunPath,
    },
    evidenceRefs: proofEvidenceRefs(pipelineResult),
    materialSelectionMode: pipelineResult.contextTree.spawnRunManifest.materialSelectionMode,
    fidelity: pipelineResult.contextTree.spawnRunManifest.fidelity,
  };
  ```

- [ ] **Step 4: Ingest the new proof into eval and write `capability-matrix.json`.**

  At the end of the new script, mirror `run-natural-native-spawn-e2e.mjs`: write `acceptance-proof.json`, then call `scripts/eval/codex-context-fork-e2e.mjs` with `--mode mock --acceptance-proof <path>` so the script always produces `eval/capability-matrix.json` from the same ingest path the repo already trusts.

  ```js
  writeFileSync(acceptanceProofPath, `${JSON.stringify(acceptanceProof, null, 2)}\n`, 'utf8');

  const evalResult = runNodeScript(EVAL_CLI, [
    '--mode', 'mock',
    '--seed', deriveEvalSeed(acceptanceProof.observedAnswer),
    '--out', join(runDir, 'eval'),
    '--acceptance-proof', acceptanceProofPath,
  ]);
  if (evalResult.status !== 0) throw new Error(`eval ingest failed: ${evalResult.stderr || evalResult.stdout}`.trim());
  ```

  Ensure the resulting `member-task-run.json` already carries `result.returnedTo = 'parent-agent'` via the pipeline, rather than patching it after the fact.

- [ ] **Step 5: Add a concrete config fixture and re-run the CLI tests.**

  Create `evals/fixtures/member-task-runs/authorized-natural-member-activation-config.json` with the minimum runnable shape:

  ```json
  {
    "registryRef": "fixtures/member-task-runs/skill-designer-registry.json",
    "requesterNodeId": "node-parent",
    "baseCheckpointId": "cp-authorized-member-activation",
    "checkpointAnchor": {
      "turnId": "authorized-parent-turn",
      "createdAt": "2026-07-08T12:34:56.000Z"
    },
    "checkpointLabel": "authorized member activation boundary",
    "checkpointPurpose": "authorized delegated member review",
    "role": "reviewer",
    "question": "Review the delegated design-analysis path and return the member result to the parent agent.",
    "targetRefs": ["docs/codex-native-spawn-acceptance-runbook.md"],
    "roleHistoryRefs": ["docs/role-memory/skill-designer-corrections.md"],
    "requestedMaterials": ["docs/codex-native-spawn-acceptance-runbook.md"],
    "requiredRoleHistoryCanaries": ["ROLE-CANARY-live-member"],
    "requiredTargetMaterialCanaries": ["TARGET-CANARY-live-member"],
    "parentPrompt": "The user authorized delegation to skill-designer. Use the native spawn path to delegate this review task and return the result to the parent agent.",
    "childPrompt": "Review the delegated design-analysis path using the provided member context.",
    "childAnswer": "{\"answer\":\"known\",\"values\":[\"CTREE-SURVIVE-live-member-path\",\"ROLE-CANARY-live-member\",\"TARGET-CANARY-live-member\"]}"
  }
  ```

  Update the CLI test to point `--config` at this fixture path instead of an undefined `fixtureConfig` variable.

- [ ] **Step 6: Add an npm script and re-run the CLI tests.**

  In `package.json` add:

  ```json
  "context-tree:run-authorized-member-activation": "node scripts/context-tree/run-authorized-member-activation-e2e.mjs"
  ```

  Run: `node --test test/cli/run-authorized-member-activation-e2e-cli.test.mjs`

  Expected: PASS.

## Task 3: Capture a Checked-In Authorized Positive Fixture and Add Non-Overclaim Guards

**Files:**
- Create: `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/acceptance-proof.json`
- Create: `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/member-task-request.json`
- Create: `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/member-task-run.json`
- Create: `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/member-context-render.json`
- Create: `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/material-selection-report.json`
- Modify: `test/eval/native-spawn-artifact.test.mjs`
- Modify: `test/cli/run-authorized-member-activation-e2e-cli.test.mjs`

**Example:** observes Example 1 and preserves Invariants 2-5

**Interfaces:**
- Consumes: the first successful output directory from `run-authorized-member-activation-e2e.mjs`.
- Produces: a retained positive bundle for hermetic regression tests plus explicit forbidden-mode negatives.

- [ ] **Step 1: Add failing fixture-based tests that distinguish authorized-member proof from the other proof modes.**

  Extend `test/eval/native-spawn-artifact.test.mjs` with:

  ```js
  it('parses the checked-in authorized-natural-member-activation fixture bundle', async () => {
    const fixture = loadAuthorizedMemberActivationFixture();
    const result = await nativeSpawnCaseResultFromArtifact(fixture.artifact, {
      canaries: createCanarySet('authorized-member-live'),
      mode: 'mock',
    });

    assert.equal(result.caseId, 'authorized-natural-member-activation');
    assert.equal(result.acceptanceTier?.id, 'authorized-natural-native-spawn');
    assert.equal(result.lifecycleVerdict?.status, 'pass');
  });

  it('fails when the authorized fixture is relabeled post hoc to a different member', async () => {
    const fixture = loadAuthorizedMemberActivationFixture({
      run: { memberName: 'different-member' },
    });
    const result = await nativeSpawnCaseResultFromArtifact(fixture.artifact, {
      canaries: createCanarySet('authorized-member-live'),
      mode: 'mock',
    });

    assert.equal(result.verdict, 'fail');
    assert.match(result.failureReason, /skill-designer|post-hoc|memberName/i);
  });
  ```

- [ ] **Step 2: Run focused tests and verify failure until the fixture bundle exists.**

  Run: `node --test test/eval/native-spawn-artifact.test.mjs test/cli/run-authorized-member-activation-e2e-cli.test.mjs`

  Expected: FAIL because the checked-in authorized fixture bundle does not exist yet.

- [ ] **Step 3: Run the opt-in live command and capture the first successful output as the checked-in positive bundle.**

  Run:

  ```bash
  CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
  node scripts/context-tree/run-authorized-member-activation-e2e.mjs \
    --authorized \
    --config "evals/fixtures/member-task-runs/authorized-natural-member-activation-config.json" \
    --out "/tmp/opencode/authorized-member-activation/out"
  ```

  Expected live report assertions before copying:

  ```js
  assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
  assert.equal(report.summary.nativeSpawnLifecyclePass, true);
  assert.equal(report.summary.lifecycleVerdicts[0].caseId, 'authorized-natural-member-activation');
  assert.equal(report.summary.lifecycleVerdicts[0].status, 'pass');
  assert.equal(report.summary.lifecycleVerdicts[0].checked, true);
  assert.equal(report.summary.lifecycleVerdicts[0].issueCount, 0);
  ```

  After the command succeeds, copy these exact files into `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/`:

  ```text
  acceptance-proof.json
  member-task-request.json
  member-task-run.json
  member-context-render.json
  material-selection-report.json
  ```

  Normalize only volatile ids/timestamps that existing fixture policy already allows. Do not normalize away:

  - `acceptanceTier.id`
  - `memberName`
  - `result.returnedTo`
  - `baselineDigest`
  - `deltaDigest`
  - `memberContextRenderRef`
  - `materialSelectionReportRef`

- [ ] **Step 4: Add explicit forbidden-proof assertions in CLI tests.**

  Extend `test/cli/run-authorized-member-activation-e2e-cli.test.mjs` with these checks against the report and run artifacts:

  ```js
  assert.equal(report.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
  assert.equal(run.materialSelectionMode === 'summary-only', false);
  assert.equal(run.result.returnedTo, 'parent-agent');
  assert.equal(run.memberContextRenderRef.endsWith('member-context-render.json'), true);
  assert.equal(run.materialSelectionReportRef.endsWith('material-selection-report.json'), true);
  ```

- [ ] **Step 5: Re-run the focused tests.**

  Run: `node --test test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs test/cli/run-authorized-member-activation-e2e-cli.test.mjs`

  Expected: PASS.

## Task 4: Document the New Runner and the Proof Boundary

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `test/docs/runtime-native-spawn-shapes.test.mjs`

**Example:** preserves Example 1 and Invariants 2-5

**Interfaces:**
- Consumes: the new runner CLI and its checked-in fixture bundle from Task 3.
- Produces: docs that explain what this path proves and what it does not prove.

- [ ] **Step 1: Add failing docs assertions for the new runner and its boundary.**

  Extend `test/docs/runtime-native-spawn-shapes.test.mjs` with:

  ```js
  it('documents the authorized member activation runner without conflating it with provider-forced proof', () => {
    const text = readFileSync('docs/codex-native-spawn-acceptance-runbook.md', 'utf8');
    assert.match(text, /run-authorized-member-activation-e2e/i);
    assert.match(text, /authorized-natural-member-activation/i);
    assert.match(text, /result\.returnedTo.*parent-agent/i);
    assert.match(text, /not provider-forced|must not use provider-forced/i);
  });
  ```

- [ ] **Step 2: Run the docs test and verify failure.**

  Run: `node --test test/docs/runtime-native-spawn-shapes.test.mjs`

  Expected: FAIL because the docs do not mention the new runner yet.

- [ ] **Step 3: Update the runbook and eval docs.**

  In `docs/codex-native-spawn-acceptance-runbook.md`, add a section that explicitly states:

  ```md
  `run-authorized-member-activation-e2e.mjs` proves the authorized member lifecycle path:
  real task -> authorized native spawn -> skill-designer member result -> MemberTaskRun/render/report -> lifecycleVerdict pass -> returnedTo parent-agent.

  This path must not be satisfied by provider-forced proof, retained-artifact-only proof, summary-only proof, or post-hoc member relabeling.
  ```

  In `docs/codex-context-fork-eval.md`, add the new case id and note that lifecycle closure for this path is read from `summary.nativeSpawnLifecyclePass` plus `summary.lifecycleVerdicts`, not from `summary.nativeSpawnPass` alone.

- [ ] **Step 4: Re-run docs tests.**

  Run: `node --test test/docs/runtime-native-spawn-shapes.test.mjs`

  Expected: PASS.

## Task 5: Final Verification and Opt-In Live Proof Capture

**Files:**
- Modify only what previous tasks require.

**Example:** verifies Example 1

**Interfaces:**
- Consumes: the new runner, checked-in fixture bundle, and updated eval/oracle tests.
- Produces: a checked-in plan-complete state plus a reproducible live command.

- [ ] **Step 1: Run the focused regression cluster.**

  Run:

  ```bash
  node --test test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs test/cli/run-authorized-member-activation-e2e-cli.test.mjs test/docs/runtime-native-spawn-shapes.test.mjs
  ```

  Expected: exit code `0`.

- [ ] **Step 2: Run the full suite.**

  Run: `npm test`

  Expected: exit code `0`; no failing Node test cases.

- [ ] **Step 3: Run diff hygiene.**

  Run: `git diff --check`

  Expected: no output.

- [ ] **Step 4: Run the new opt-in live command and verify the exact success signals.**

  Before the live run, copy the checked-in config fixture to a temp location and, if needed, rewrite any relative paths to absolute paths rooted at the repo:

  ```bash
  mkdir -p "/tmp/opencode/authorized-member-activation"
  cp "evals/fixtures/member-task-runs/authorized-natural-member-activation-config.json" "/tmp/opencode/authorized-member-activation/config.json"
  ```

  Run:

  ```bash
  CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
  node scripts/context-tree/run-authorized-member-activation-e2e.mjs \
    --authorized \
    --config "/tmp/opencode/authorized-member-activation/config.json" \
    --out "/tmp/opencode/authorized-member-activation/out"
  ```

  Expected artifacts:

  ```text
  /tmp/opencode/authorized-member-activation/out/acceptance-proof.json
  /tmp/opencode/authorized-member-activation/out/member-task-request.json
  /tmp/opencode/authorized-member-activation/out/member-task-run.json
  /tmp/opencode/authorized-member-activation/out/member-context-render.json
  /tmp/opencode/authorized-member-activation/out/material-selection-report.json
  /tmp/opencode/authorized-member-activation/out/eval/capability-matrix.json
  ```

  Expected report assertions:

  ```js
  assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
  assert.equal(report.summary.nativeSpawnLifecyclePass, true);
  assert.deepEqual(report.summary.lifecycleVerdicts, [{
    caseId: 'authorized-natural-member-activation',
    status: 'pass',
    checked: true,
    issueCount: 0,
  }]);
  ```

- [ ] **Step 5: Verify the retained positive bundle remains in sync with the live proof boundary.**

  If Task 3 already captured the fixture bundle, do not overwrite it automatically. Compare the latest live output with the retained bundle for the non-normalized contract fields:

  ```text
  acceptanceTier.id
  caseId
  memberName
  result.returnedTo
  baselineDigest
  deltaDigest
  memberContextRenderRef
  materialSelectionReportRef
  lifecycleVerdict.status
  ```

  If the latest live run differs only in volatile ids/timestamps, leave the fixture as-is and record the latest `/tmp/opencode/authorized-member-activation/out` path in the implementation summary. If a non-normalized contract field differs, update the fixture intentionally and rerun the focused tests from Step 1.

## Closure status

- **Repo ready:** yes.
- **Hermetic/retained lifecycle proof:** pass.
- **Repo-side prompt/material/canary wiring defects:** fixed.
- **Fresh live authorized path:** blocked.

Blocking evidence:

- `/tmp/opencode/authorized-member-activation/out/native-spawn-observation-diagnostic.json`
- `/tmp/opencode/authorized-member-activation/out-attempt-2/native-spawn-observation-diagnostic.json`
- `/tmp/opencode/authorized-member-activation/out-explicit-authorized/native-spawn-observation-diagnostic.json`

Each of those fresh live runs observed a large JSON-RPC stream but zero `collabAgentToolCall` items, so the authorized natural live path did not establish runtime native spawn in the current runtime/model behavior.

Non-overclaim closure:

- Do **not** mark `authorized-natural-native-spawn` pass from these live runs.
- Do **not** treat the checked-in retained fixture or `--fixture-mode` success as product live success.

Next product route:

- Keep `authorized-natural-native-spawn` as a future live UX tier.
- Move the main product path to **`authorized-explicit-member-activation`**: user/agent authorization remains required, but Context Tree runner/tool/sidecar explicitly executes the member activation path and preserves the same lifecycle/result-return/material-proof oracle.
