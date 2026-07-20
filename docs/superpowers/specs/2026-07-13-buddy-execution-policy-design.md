# Buddy Execution Policy Design

## 0. Conclusion

`BuddyExecutionPolicy` is the missing contract between Buddy routing and Buddy invocation. Routing decides **which Buddy** should be used and why; execution policy describes the **desired invocation semantics**; the adapter executes the strongest currently supported path; evidence records the **actual invocation path**.

V1 should not build full OpenCode / Codex / Claude adapter runtime selection. V1 should keep the existing backend path through `createBuddyProductInvocation()` -> `createMemberProductInvocation()`, resolve and record desired policy, and honestly record actual execution as the current CLI/tool-sidecar adapter path:

```text
actualSurface: cli-adapter
runtimeSurface: cli-called-by-agent
nativeSubagent: false
parentObservationStatus: unverified
reason: native-buddy-execution-not-integrated
```

The core invariant is: **desired policy may request native Buddy semantics, but only actual evidence may claim native Buddy execution.**

## 1. Background Judgment

Context Tree already has strong separation for member identity, invocation artifacts, and product proof:

```text
TeamMemberProfile / BuddyProfile
  -> host model routing decision
  -> createBuddyProductInvocation()
  -> createMemberProductInvocation()
  -> delivery evidence / result return evidence / MemberTaskRun
  -> release-grade provenance gates
```

The current gap is not Buddy selection. The gap is that the code has no explicit policy object for desired execution semantics before the invocation falls into the hardcoded adapter backend.

The current backend in `src/core/member-product-invocation.mjs` records:

```text
deliveryKind: tool-sidecar-call
runtimeSurface: cli-called-by-agent
visibility: runtime-input-observed
nativeSpawn.status: not-run
nativeSpawn.runtimeNativeSubagentSpawn: false
```

Those facts are valid for adapter-observed product proof, but they must not be relabeled as runtime-native Buddy execution. The policy layer exists to preserve that distinction while leaving room for future same-runtime native/tool integrations.

## 2. Product Positioning

### 2.1 One Sentence

```text
BuddyExecutionPolicy records what execution semantics the product wanted, while BuddyExecutionActual records what execution path actually happened.
```

### 2.2 User Mental Model

A parent agent or runtime should be able to call a Buddy without manually choosing a model, runtime, or adapter every time. The user-facing mental model is:

```text
Use this Buddy for this task.
Prefer native Buddy execution if available.
Fall back honestly if not.
Show what actually happened.
```

This keeps low-configuration invocation while avoiding product copy that says a CLI adapter call was a native Buddy call.

## 3. Design Boundary

### 3.1 Buddy Routing

Routing decides `buddyName` and why that Buddy matched the task.

Current routing evidence remains based on profile hints and host-model selection:

```text
Buddy routing:
  decide buddyName
  record why this Buddy was selected
  do not decide runtime/model/surface
```

The routing artifact should not own execution semantics. A routing pass may say `member-bootstrap-curator` is the right Buddy. It must not prove whether that Buddy ran as an OpenCode native subagent, a tool-mediated call, or a CLI adapter.

### 3.2 BuddyExecutionPolicy

Policy decides desired invocation semantics:

```text
BuddyExecutionPolicy:
  desiredSurface
  fallbackOrder
  resultReturn
  contextContinuity
  evidenceRequirement
```

Policy is intent, not proof. A desired surface of `runtime-native-subagent` means the system should prefer native Buddy execution when supported. It does not mean native execution occurred.

### 3.3 Invocation Adapter

The invocation adapter executes the strongest available supported path:

```text
Invocation adapter:
  inspect desired policy
  inspect available backend support
  execute current strongest supported path
  return actual execution facts
```

V1 keeps the current adapter path. It may read desired policy and attach it to output, but it should not perform full runtime adapter selection. Future work can add same-runtime OpenCode, Claude Code, or Codex adapters behind this boundary.

### 3.4 Evidence

Evidence records actual path, not desired path:

```text
Evidence:
  actualSurface
  runtimeSurface
  nativeSubagent
  parentObserved
  parentObservationStatus
  parentCallEvidenceRef
  parentCallEvidenceDigest
  observedTranscriptRef
  observedTranscriptDigest
  reason
```

Evidence is the only place allowed to claim actual native execution. If the adapter fell back to CLI, evidence must say CLI. Raw invocation code must not self-upgrade `parentObserved`; only a product finalizer or release-grade eval may set `parentObserved: true` after binding exporter / parent-call / transcript proof.

## 4. Core Product Objects

### 4.1 BuddyExecutionPolicy

Desired invocation semantics for one Buddy call. V1 keeps the field set intentionally small:

```text
desiredSurface
fallbackOrder
resultReturn
contextContinuity
evidenceRequirement
```

Recommended V1 shape:

```json
{
  "desiredSurface": "runtime-native-subagent",
  "fallbackOrder": ["runtime-native-subagent", "agent-tool", "cli-adapter"],
  "resultReturn": "parent-agent",
  "contextContinuity": "materialized-buddy-context",
  "evidenceRequirement": "release-grade-parent-observed"
}
```

Field meaning:

| Field | Meaning |
| --- | --- |
| `desiredSurface` | Preferred invocation semantics for this call. This is a desired value, not observed evidence. |
| `fallbackOrder` | Desired degradation order when stronger paths are not available. The selected fallback must be recorded separately as actual evidence. |
| `resultReturn` | Where the Buddy result should return. V1 default is `parent-agent`. |
| `contextContinuity` | How Buddy context should be carried into execution. V1 default is `materialized-buddy-context`. |
| `evidenceRequirement` | Minimum evidence envelope the product wants. It does not assert that evidence was satisfied. |

Initial enum values:

```text
desiredSurface:
  runtime-native-subagent
  agent-tool
  cli-adapter

resultReturn:
  parent-agent

contextContinuity:
  materialized-buddy-context

evidenceRequirement:
  release-grade-parent-observed
```

### 4.2 BuddyExecutionActual

Observed execution facts for one Buddy call:

```json
{
  "actualSurface": "cli-adapter",
  "runtimeSurface": "cli-called-by-agent",
  "nativeSubagent": false,
  "parentObserved": false,
  "parentObservationStatus": "unverified",
  "reason": "native-buddy-execution-not-integrated"
}
```

Field meaning:

| Field | Meaning |
| --- | --- |
| `actualSurface` | The path that actually executed. |
| `runtimeSurface` | The best observed runtime or adapter surface label for the call. V1 may emit the existing `cli-called-by-agent` label until normalized parent runtime identity is plumbed. |
| `nativeSubagent` | Whether a native subagent boundary was actually observed. |
| `parentObserved` | Whether the parent-agent observation chain has been verified by external runtime/exporter evidence. Raw invocation cannot set this to `true` by itself. |
| `parentObservationStatus` | `unverified`, `exporter-verified`, or `missing`. V1 raw invocation should emit `unverified`; product finalization may upgrade it. |
| `parentCallEvidenceRef` / `parentCallEvidenceDigest` | Optional proof ref and digest for the parent call record that upgrades `parentObserved`. |
| `observedTranscriptRef` / `observedTranscriptDigest` | Optional proof ref and digest for the observed parent-agent transcript/export. |
| `reason` | Short explanation for the selected actual path, especially fallback. |

V1 raw invocation is expected to be:

```json
{
  "actualSurface": "cli-adapter",
  "nativeSubagent": false,
  "parentObserved": false,
  "parentObservationStatus": "unverified",
  "reason": "native-buddy-execution-not-integrated"
}
```

After release-grade product finalization binds real runtime/exporter evidence, the same call may be upgraded to:

```json
{
  "actualSurface": "cli-adapter",
  "runtimeSurface": "cli-called-by-agent",
  "nativeSubagent": false,
  "parentObserved": true,
  "parentObservationStatus": "exporter-verified",
  "parentCallEvidenceRef": "product/parent-call-record.json",
  "parentCallEvidenceDigest": "sha256:...",
  "observedTranscriptRef": "product/observed-parent-call-transcript.json",
  "observedTranscriptDigest": "sha256:...",
  "reason": "native-buddy-execution-not-integrated"
}
```

This is still not a native Buddy/subagent claim. It is a parent-observed adapter-backed Buddy call.

### 4.3 BuddyExecutionResolution

The resolved call-level record that pairs desired policy with actual evidence:

```json
{
  "buddyName": "member-bootstrap-curator",
  "routingRef": "routing-decision.json",
  "policy": {
    "desiredSurface": "runtime-native-subagent",
    "fallbackOrder": ["runtime-native-subagent", "agent-tool", "cli-adapter"],
    "resultReturn": "parent-agent",
    "contextContinuity": "materialized-buddy-context",
    "evidenceRequirement": "release-grade-parent-observed"
  },
  "actual": {
    "actualSurface": "cli-adapter",
    "runtimeSurface": "cli-called-by-agent",
    "nativeSubagent": false,
    "parentObserved": false,
    "parentObservationStatus": "unverified",
    "reason": "native-buddy-execution-not-integrated"
  }
}
```

This object must be written in a way that downstream reports cannot accidentally bypass:

- `invoke-buddy-summary.json.executionResolution` embeds the full policy / actual pair.
- `member-task-run.json` or its BuddyRun projection carries the same execution actual, or a digest/ref to the Buddy summary resolution.
- product finalization writes `executionResolutionRef` and `executionResolutionDigest` into the product proof chain when claiming parent-observed release-grade status.

The summary is the local call record. Product proof is a later provenance-bound view of that call, not the same authority level.

## 5. Resolution Order

`createBuddyProductInvocation()` is the right V1 insertion point because it is the Buddy layer immediately before the member invocation backend.

Policy should resolve in this order, from broadest default to most specific override:

```text
Context Tree default policy
  -> project policy
  -> runtime policy
  -> Buddy/profile policy
  -> invocation input override
```

V1 can implement only the default policy and optional input override, while the design keeps room for project/runtime/profile defaults.

The call flow becomes:

```text
host model selects buddyName
  -> createBuddyProductInvocation(input)
  -> materialize applied Buddy version if present
  -> resolve desired BuddyExecutionPolicy
  -> call existing createMemberProductInvocation backend
  -> derive actual BuddyExecutionActual from returned artifacts
  -> write policy + actual into invoke-buddy-summary.json and BuddyRun-compatible output
  -> product finalizer may upgrade parent observation only after exporter/provenance binding
```

## 6. V1 Implementation Boundary

V1 should be documentation- and contract-first, then a narrow code pass.

### 6.0 OpenCode Task Evidence Baseline

OpenCode already creates a parent-child evidence boundary when the parent agent invokes the native `task` tool: the child session records `session.parent_id`, and the child session's first user message is the prompt the child received. Context Tree should treat that as the first-class OpenCode handoff evidence before introducing any new review/context packet format.

The OpenCode session corpus exporter now emits this directly on each exported session:

```json
{
  "sessionId": "child-session-id",
  "isSubagent": true,
  "parentSessionId": "parent-session-id",
  "promptLineage": {
    "kind": "opencode-task-child-prompt",
    "parentSessionId": "parent-session-id",
    "receivedPromptText": "the filtered child prompt text"
  }
}
```

Root sessions use `promptLineage.kind: "root-user-prompt"` with `parentSessionId: null`. This keeps child prompts available for audit and reviewer anti-bias checks while preserving the existing rule that subagent rows are excluded from root-user candidate evidence.

### 6.1 V1 Should Do

- Define `BuddyExecutionPolicy` as desired semantics.
- Define `BuddyExecutionActual` as observed execution facts.
- Resolve desired policy in `createBuddyProductInvocation()`.
- Keep current backend path through `createMemberProductInvocation()`.
- Record actual execution as CLI/tool-sidecar when that is what happened.
- Attach desired and actual execution records to Buddy summary, BuddyRun-compatible output, and product proof refs.
- Keep raw invocation `parentObserved` unverified until a real parent-call/exporter transcript is bound.
- Add tests proving desired native semantics do not create a native evidence claim.

### 6.2 V1 Should Not Do

- Do not build full adapter runtime selection.
- Do not start OpenCode / Codex / Claude Code child agents from policy resolution.
- Do not let `desiredSurface: runtime-native-subagent` imply `nativeSubagent: true`.
- Do not let raw CLI invocation imply `parentObserved: true` without exporter/provenance refs.
- Do not rewrite routing to be a programmatic router.
- Do not call CLI adapter execution `Native Buddy call` in evidence or product copy.

## 7. Surface and Proof Taxonomy

### 7.1 Desired Surface

| desiredSurface | Meaning |
| --- | --- |
| `runtime-native-subagent` | Prefer a same-runtime native subagent / agent boundary. |
| `agent-tool` | Prefer a tool-mediated path inside the parent runtime. |
| `cli-adapter` | Accept the explicit Context Tree CLI adapter path. |

### 7.2 Actual Surface

| actualSurface | Meaning | Native claim allowed? |
| --- | --- | --- |
| `runtime-native-subagent` | A runtime-native Buddy/subagent boundary was observed and validated. | Yes |
| `agent-tool` | Parent runtime invoked Buddy through a tool/API bridge. | No, unless native child evidence is also present |
| `cli-adapter` | Context Tree CLI/tool-sidecar adapter executed. | No |

`actualSurface: "cli-adapter"` can still be product-grade when a real parent-agent call is observed. Product-grade and native are separate claims.

### 7.3 Evidence Requirement

| evidenceRequirement | Meaning |
| --- | --- |
| `release-grade-parent-observed` | Parent-agent observation, transcript/exporter or equivalent provenance, result returned to parent, and no unsupported relabeling. |

The product proof tier is derived from actual evidence, not desired policy.

`runtimeSurface: "cli-called-by-agent"` is not enough to satisfy this requirement by itself. Release-grade parent observation requires a digest-bound parent-call record, observed transcript/export, or equivalent runtime observer artifact.

For EvoBuddy release-grade loop claims, the same rule applies to every loop edge. A report may pass only when the required runtime/exporter artifacts exist and their digests close over the observed bytes:

- first Buddy call: exporter manifest, DB/session digest, parent-call record, observed transcript, and invoke summary execution resolution;
- routing decision: observed host-model turn ref and digest-bound model output, not a transcript self-claim;
- evolution proposal: runtime/model output ref and digest-bound proposal bytes;
- second Buddy call: exporter manifest, parent-call record, observed transcript, and applied-version invocation summary;
- materialization: `materialized-buddy-context.json`, model-visible context digest, and a reverse reference from the second observed call.

If any required real artifact is absent, unreadable, digest-mismatched, or only represented by a retained/test object, the release-grade live eval result must be `blocked` or `fail` according to the defect. It must never pass by trusting summary fields, transcript prose, retained fixtures, direct shell output, or desired execution policy.

## 8. Behavior Evaluation

### Example 1: Desired native path falls back honestly to CLI adapter

- **Example:** Policy requests `desiredSurface: "runtime-native-subagent"`, but V1 has no OpenCode native Buddy adapter integrated.
- **Expected result:** Invocation succeeds through current backend and records `actualSurface: "cli-adapter"`, `nativeSubagent: false`, `parentObservationStatus: "unverified"`, and a reason such as `native-buddy-execution-not-integrated`.
- **Verification:** Regression asserts the Buddy summary contains both the desired policy and the actual execution record, and no native proof field is true.
- **Failure signal:** Summary or report says this was a native Buddy call.
- **If it fails:** Fix evidence derivation and product copy; do not weaken the policy desired value.

### Example 2: CLI adapter is explicitly desired

- **Example:** Policy requests `desiredSurface: "cli-adapter"` with `fallbackOrder: ["cli-adapter"]`.
- **Expected result:** Invocation uses the current backend and records `actualSurface: "cli-adapter"`, `nativeSubagent: false`, and `parentObserved: false` / `parentObservationStatus: "unverified"` until product finalization binds exporter evidence.
- **Verification:** Regression asserts desired and actual match, while proof tier still remains adapter-level rather than native.
- **Failure signal:** Matching desired/actual CLI path is promoted to `runtime-native-subagent`.
- **If it fails:** Fix proof tier classification.

### Example 3: Future native adapter becomes available

- **Example:** A later OpenCode same-runtime native adapter satisfies `runtime-native-subagent`.
- **Expected result:** Adapter records `actualSurface: "runtime-native-subagent"`, `nativeSubagent: true`, and native evidence refs. Policy code does not need to be redefined.
- **Verification:** Native evidence gates validate runtime-native boundary before the product claim is shown.
- **Failure signal:** Native claim appears without native child/session evidence.
- **If it fails:** Reject the actual record or downgrade to `agent-tool` / `cli-adapter`.

### Example 4: Parent observation is missing

- **Example:** Adapter executes a Buddy but does not produce parent-observed return evidence.
- **Expected result:** `parentObserved: false`; release-grade policy compliance is blocked or failed depending on missing evidence.
- **Verification:** Provenance gate checks `resultReturn: "parent-agent"` against result-return evidence plus exporter / parent-call / transcript refs.
- **Failure signal:** Release-grade pass despite no parent observation.
- **If it fails:** Tighten compliance validation; do not infer parent observation from policy.

## 9. Rejection Rules

Reject or block a policy/evidence record when:

- `actualSurface` is `runtime-native-subagent` and `nativeSubagent` is not `true`.
- `nativeSubagent` is `true` but no native runtime evidence refs exist.
- `desiredSurface` is used as proof of actual execution.
- `fallbackOrder` omits the recorded `actualSurface` without an explicit override reason.
- `evidenceRequirement: "release-grade-parent-observed"` is paired with `parentObserved: false` and still marked pass.
- raw `invoke-buddy` / `invoke-member` output sets `parentObserved: true` without `parentCallEvidenceRef` and `observedTranscriptRef` or equivalent runtime observer refs.
- CLI/tool-sidecar execution is labeled as `Native Buddy call`.
- direct test-process CLI execution is treated as parent-agent observed product proof.
- a release-grade EvoBuddy loop passes while any required exporter/transcript/parent-call/routing/proposal/materialized-context artifact is missing or not digest-bound to the observed runtime bytes.

## 10. Implementation Surfaces

Likely files for the first implementation pass:

- `src/core/buddy-execution-policy.mjs`: new schema helpers for desired policy and actual execution records.
- `src/core/buddy-product-invocation.mjs`: resolve policy before calling `createMemberProductInvocation()`; add desired/actual execution records to Buddy summary.
- `src/core/member-product-invocation.mjs`: expose enough current backend facts to derive `actualSurface: "cli-adapter"`, `nativeSubagent: false`, `parentObserved: false`, and `parentObservationStatus: "unverified"` without changing execution.
- `src/core/buddy-run-ledger.mjs`: project execution policy/actual fields into BuddyRun view if needed.
- `src/eval/evobuddy-release-grade-provenance.mjs`: add compliance checks between desired policy and actual evidence before release-grade product pass.
- `test/core/buddy-product-invocation.test.mjs`: prove V1 desired native policy falls back honestly to CLI adapter.

## 11. Implementation Decomposition

### Plan A: Contract and Summary Wiring

- Add `buddy-execution-policy.mjs` with validation/default helpers.
- Resolve default desired policy in `createBuddyProductInvocation()`.
- Derive actual execution from current member invocation summary.
- Write both records into `invoke-buddy-summary.json.executionResolution`.
- Keep raw `parentObserved` unverified unless product evidence is already bound.
- Add focused tests.

This is the recommended first implementation because it establishes the boundary without changing execution behavior.

### Plan B: BuddyRun Projection

- Extend `memberTaskRunToBuddyRunView()` to include desired/actual execution fields.
- Keep compatibility with existing `MemberTaskRun` artifacts.
- Preserve a digest/ref back to `invoke-buddy-summary.executionResolution` when projection would duplicate fields.
- Add ledger/read tests.

This should follow Plan A once summary shape is stable.

### Plan C: Provenance Compliance Gate

- Add policy compliance validation to release-grade eval.
- Fail or block records where desired/evidence claims are internally inconsistent.
- Keep release-grade product loop strict: policy intent is never enough for pass.
- Require parent observation upgrade refs before `evidenceRequirement: "release-grade-parent-observed"` can pass.

This depends on Plan A/B records being emitted, but it is still part of the first product-grade implementation train. V1 is not releasable as product proof until this gate exists.

### Plan D: Runtime Adapter Selection

- Add same-runtime adapter capability detection.
- Prefer runtime-native subagent, then agent tool, then CLI adapter.
- Keep cross-runtime fallback explicit and evidence-labeled.

This is intentionally out of V1.

## 12. Design Invariants

- Routing decides who; policy decides desired semantics; adapter executes; evidence records actual facts.
- Desired policy is never proof.
- Actual evidence is the only source for native Buddy claims.
- V1 must keep the current backend honest: CLI/tool-sidecar path remains CLI/tool-sidecar evidence.
- `fallbackOrder` is desired degradation order, not proof that fallback occurred correctly.
- `evidenceRequirement` states the wanted evidence envelope, not that the envelope was satisfied.
- A missing native adapter is a fallback reason, not a native failure.
- Same-runtime native execution should be preferred when implemented; silent cross-runtime fallback should not be default.

## 13. Non-Goals

- Full OpenCode / Codex / Claude Code adapter runtime selection.
- New MCP server semantics.
- Programmatic replacement for host-model Buddy routing.
- Model alias/category policy beyond the minimal execution surface fields.
- Native subagent proof without runtime-native evidence artifacts.
- Changing release-grade provenance gates to accept desired policy as proof.
