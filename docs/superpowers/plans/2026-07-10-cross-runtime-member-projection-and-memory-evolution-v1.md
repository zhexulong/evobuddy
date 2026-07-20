# Cross-Runtime Member Projection and Memory Evolution V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the V1 cross-runtime stable member mainline: confirmed member profiles project to native runtime definitions, per-call invocation packets are delivered with evidence, member results return to the parent agent, role memory evolves from retrospective evidence, workspace-session-derived cold start can produce confirmable member/profile candidates, and Workbench/eval prove the main flow without any docs-only roster discovery layer.

**Architecture:** Keep runtime subagent/custom-agent execution owned by the host runtime. Context Tree owns stable member identity, runtime definition generation, per-call invocation packet artifacts, packet delivery/result-return evidence, member run ledger records, retrospective memory lifecycle records, workspace-session-derived profile/member candidates, and Workbench/eval projections. There is no separate product layer that scans docs and creates roster suggestions. Repo/workspace session history, run ledgers, eval reports, and conversation records are evidence/materials used inside explicit profile creation, import/migration, invocation, retrospective memory maintenance, or workspace-session-derived cold start.

**Tech Stack:** Node.js ESM, `node:test`, existing Context Tree JSON artifact writers/readers, existing `TeamMemberProfile`, `MemberTaskRun`, `MemberContextRender`, explicit-member executor artifacts, Workbench TUI renderer, and deterministic SHA-256 digests.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-10-cross-runtime-member-projection-and-memory-evolution-design.md`.
- Do not implement a new generic subagent runtime.
- Do not make skill or plugin the member identity.
- Do not treat runtime native memory as cross-runtime truth; Context Tree owns member memory.
- Do not add an independent authorization product concept; member invocation follows runtime subagent semantics.
- Do not claim natural autonomous native spawn as V1 success.
- Do not let the parent agent be the default long-term memory classifier.
- Runtime agent definition is not packet delivery; full invocation support requires packet delivery, result-return, and writeback evidence.
- `memberName` is the stable expert identity. Runtime child/session ids are task runtime facets only.
- `member-m[0]` must not contain task-local target material, temporary search results, unpromoted candidates, or low-confidence feedback.
- `RoleMemoryCandidate` may only be created from host-applied retrospective learning, explicit user remember requests, import/migration with evidence, or eval correction loop evidence.
- `returnedTo: parent-agent` requires observable parent-visible result evidence; files, Workbench visibility, and retained artifacts alone are insufficient.
- Workbench first-level UI uses work language (`Experts`, `Tasks`, `Returned`, `Used context`) and must not expose proof taxonomy labels as the main user surface.
- Do not create docs-only roster-suggestion product code or require docs-only roster-suggestion evals. Repo/workspace user session history may produce confirmable member/profile candidates through the same retrospective/host-apply lifecycle; project docs alone must not create default Experts by discovery.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Runtime Projection Is Definition-Only

- **Example:** Given a confirmed `skill-designer` profile, generate Claude Code, OpenCode, and Codex definitions.
- **Expected result:** Generated files are deterministic and include stable identity/routing/return-to-parent/packet-use instructions, but do not include a current task target or claim that any member saw task materials.
- **Verification:** `node --test test/core/member-runtime-projection.test.mjs test/cli/generate-member-projections-cli.test.mjs`.
- **Failure signal:** Projection output embeds `targetRefs`, a current task prompt, or records `model-visible` material evidence.
- **If it fails:** Fix projection generator or contract tests; do not move task-local data into agent definitions.

### Example 2: Explicit Member Invocation Delivers a Packet and Returns to Parent

- **Example:** Parent asks `skill-designer` to review a SKILL.md trigger design.
- **Expected result:** Context Tree writes `member-invocation-packet.json`, `member-context-render.json`, `material-selection-report.json`, delivery evidence, `member-task-run.json`, and a parent-visible result record. Reviewer target material is model-visible or has read/expand evidence. `returnedTo: parent-agent` is supported by a transcript/API/tool/adapter observation.
- **Verification:** `node --test test/core/member-invocation-packet.test.mjs test/core/member-task-request.test.mjs test/core/member-task-run-record.test.mjs test/eval/explicit-member-activation-artifact.test.mjs` plus the final e2e eval task.
- **Failure signal:** Only a runtime definition exists, packet delivery is missing, mounted-only target material is accepted as reviewer success, or result return is inferred from a file.
- **If it fails:** Fix packet delivery/writeback validation or explicit-member adapter; do not weaken material visibility or returned-to gates.

### Example 3: Feedback Becomes Durable Memory Only Through Retrospective

- **Example:** After a `skill-designer` result, the user says the trigger must not assume the agent knows it is a loop-controller.
- **Expected result:** The feedback window is retained as raw evidence; retrospective output distills an actionable learning; host validation routes it to pending review or active `skill-designer` memory; the next run can prove whether that memory was model-visible.
- **Verification:** `node --test test/core/member-retrospective-memory.test.mjs test/core/member-role-memory.test.mjs test/eval/member-system-e2e.test.mjs`.
- **Failure signal:** The user sentence is copied verbatim into durable memory, the parent agent directly creates a candidate from ordinary chat, or the memory enters `member-m[0]` before host-applied promotion.
- **If it fails:** Fix retrospective parser/validator or candidate creation boundary; do not make the main agent a memory classifier.

### Example 4: Workbench Presents Work, Trace Presents Proof

- **Example:** Render the Workbench for a product explicit member run.
- **Expected result:** First-level views show `Experts`, `Tasks`, `Status: Returned`, `Run kind`, `Returned to: parent-agent`, `Result`, and `Used context`. Trace contains parent invocation, delivery, result-return, visibility, digest, fixture/live/source classification, and known losses.
- **Verification:** `node --test test/core/member-workbench-view-model.test.mjs test/report/member-workbench-terminal.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs`.
- **Failure signal:** First-level output shows `MECHANISM PASS`, `PRODUCT PASS`, `authorized-explicit-member-activation`, or hides delivery/result-return losses.
- **If it fails:** Fix Workbench view-model/renderer/eval checks; do not rewrite artifacts to make the UI pass.

### Example 5: Workspace-Session-Derived Cold Start, Not Docs-Only Discovery

- **Example:** Multiple prior root user sessions in the same repo/workspace repeatedly ask for skill trigger design review, correct rule/skill separation, and reject assumptions that an agent knows it is a loop-controller. Project docs also mention skill design and eval work.
- **Expected result:** Workspace-session-derived cold start emits a `MemberProfileCandidate` for `skill-designer` with project/workspace identity, multi-session refs, signal kinds, confidence, and supporting docs/run refs. It is not a default Expert until host/user confirmation. Docs-only material without session/import/run evidence creates no Expert and no `member-m[0]` memory.
- **Verification:** Cold-start tests prove workspace-session-derived candidates are retained as candidates; subagent/hidden child sessions are excluded by default; registry/Workbench tests prove only confirmed profiles appear as Experts; docs-only fixtures do not create Experts or `member-m[0]` memory.
- **Failure signal:** Docs-only material creates default Experts, or session-derived candidate learning enters active role memory without host-applied confirmation/promotion.
- **If it fails:** Fix cold-start candidate gating, registry filtering, or memory promotion validation; do not weaken docs-only non-authority.

### Invariants

- Invariant 1: `memberName` is the stable identity; runtime ids are never roster keys.
- Invariant 2: Runtime projection is an entry point, not evidence.
- Invariant 3: Packet delivery, material visibility, result return, and writeback evidence are separate facts.
- Invariant 4: Only active host-applied memory may enter `member-m[0]`.
- Invariant 5: Parent-agent return cannot be inferred from files, fixtures, or Workbench visibility alone.
- Invariant 6: Workbench first-level copy stays product/work-oriented; proof taxonomy stays in Trace/eval artifacts.
- Invariant 7: Cold start is workspace-session-derived lifecycle bootstrap, not single-session picking and not docs-only discovery; unconfirmed candidates cannot create default Experts or durable baseline memory.

## File Structure

Create:
- `docs/contracts/member-runtime-projection-contract.md`: product contract for generated runtime definitions and registry mapping.
- `docs/contracts/member-invocation-packet-contract.md`: product contract for `member-invocation-packet.json`, delivery evidence, and result-return evidence.
- `src/core/member-runtime-projection.mjs`: deterministic Claude/OpenCode/Codex definition generator.
- `scripts/context-tree/generate-member-projections.mjs`: CLI for generating projections to an output directory or runtime project directories.
- `src/core/member-invocation-packet.mjs`: validates and creates per-call packet artifacts and delivery evidence records.
- `src/core/member-result-return-evidence.mjs`: validates parent-visible result-return evidence.
- `src/core/member-retrospective-memory.mjs`: feedback-window detection, retrospective learning parsing/validation, candidate/active-memory routing helpers.
- `src/core/member-session-cold-start.mjs`: workspace-session-derived role signal extraction, member profile candidate creation, root-session filtering, scan frontier/watermark accounting, docs-only non-authority gating.
- `scripts/context-tree/run-member-retrospective-memory.mjs`: CLI for retained feedback-to-memory runs.
- `scripts/context-tree/run-member-session-cold-start.mjs`: CLI for retained session-derived cold-start candidate runs.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`: full product eval with correction-loop-friendly report output.
- Tests under `test/core/`, `test/cli/`, `test/docs/`, and `test/eval/` named in the tasks below.

Modify:
- `package.json`: add scripts for projection generation, retrospective memory, session-derived cold start, and final member-system eval.
- `src/core/team-member-profile.mjs`: preserve existing required fields and keep runtime projection metadata outside the profile truth model unless the implementation needs a private helper type.
- `docs/contracts/team-member-profile-contract.md`: document that runtime projection metadata is generated output, not profile evidence.
- `src/core/context-tree-artifacts.mjs`: write `member-invocation-packet.json` and delivery/result-return evidence artifacts when V1 invocation lifecycle fields are present.
- `src/core/member-task-request.mjs`: produce packet artifacts and lifecycle trace entries for packet preparation/delivery.
- `src/core/member-task-run-record.mjs`: validate packet refs, delivery evidence, and result-return evidence when V1 claims are present.
- `src/core/explicit-member-task-run-record.mjs`: record explicit-member delivery/result-return evidence and reject unsupported parent-agent return claims.
- `src/eval/explicit-member-activation-artifact.mjs`: enforce packet delivery and result-return evidence for product explicit member pass.
- `src/core/member-role-memory.mjs`: enforce candidate creation-source boundaries and host-applied promotion semantics.
- `src/core/member-workbench-artifacts.mjs`, `src/core/member-workbench-view-model.mjs`, `src/report/member-workbench-terminal.mjs`: surface packet/delivery/memory/cold-start candidate evidence correctly and ignore docs-only material as Expert authority.
- Existing docs in `docs/codex-context-fork-eval.md`, `docs/codex-native-spawn-acceptance-runbook.md`, and relevant contracts when behavior changes.

---

### Task 1: Runtime Projection Contract and Generator

**Files:**
- Create: `docs/contracts/member-runtime-projection-contract.md`
- Create: `src/core/member-runtime-projection.mjs`
- Create: `test/core/member-runtime-projection.test.mjs`
- Create: `test/docs/member-runtime-projection-contract.test.mjs`
- Modify: `docs/contracts/team-member-profile-contract.md`
- Modify: `src/core/team-member-profile.mjs`
- Modify: `test/core/team-member-profile.test.mjs`

**Example:** implements Example 1; preserves Invariants 1, 2, 3

**Interfaces:**
- Consumes: `validateTeamMemberProfile(profile)` and resolved registry entries from `src/core/team-member-profile.mjs`.
- Produces:
  - `validateRuntimeProjectionConfig(input): RuntimeProjectionConfig`
  - `generateMemberRuntimeProjections({ profile, memberName, generatorVersion, runtimeNames? }): RuntimeProjectionBundle`
  - `renderCodexAgentToml(projection): string`
  - `renderClaudeAgentMarkdown(projection): string`
  - `renderOpenCodeAgentMarkdown(projection): string`

- [ ] **Step 1: Write the projection contract doc test**

Create `test/docs/member-runtime-projection-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-runtime-projection-contract.md', 'utf8');

describe('member runtime projection contract', () => {
  it('states definition is not packet delivery or material visibility evidence', () => {
    assert.match(text, /definition is not packet delivery/i);
    assert.match(text, /does not prove.*model-visible/i);
    assert.match(text, /memberName.*runtimeAgentName/i);
  });
});
```

- [ ] **Step 2: Write the failing generator tests**

Create `test/core/member-runtime-projection.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMemberRuntimeProjections,
  renderClaudeAgentMarkdown,
  renderCodexAgentToml,
  renderOpenCodeAgentMarkdown,
} from '../../src/core/member-runtime-projection.mjs';

const profile = {
  name: 'skill-designer',
  description: 'Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility.',
  role: 'Skill Designer',
  responsibilities: ['Review skill trigger rules'],
  standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
  roleMemoryRefs: ['docs/role-memory/skill-designer.json'],
  activationHints: ['skill design'],
  negativeActivationHints: ['runtime implementation'],
};

describe('member runtime projection', () => {
  it('generates deterministic Claude/OpenCode/Codex definitions without task-local material', () => {
    const first = generateMemberRuntimeProjections({ memberName: 'skill-designer', profile, generatorVersion: 'test-v1' });
    const second = generateMemberRuntimeProjections({ memberName: 'skill-designer', profile, generatorVersion: 'test-v1' });
    assert.deepEqual(first, second);

    const codex = renderCodexAgentToml(first.codex);
    assert.match(codex, /name = "skill_designer"/);
    assert.match(codex, /developer_instructions/);
    assert.doesNotMatch(codex, /targetRefs|current task target|model-visible/i);

    const claude = renderClaudeAgentMarkdown(first.claude);
    assert.match(claude, /^---\n/m);
    assert.match(claude, /Use the Context Tree invocation packet/i);
    assert.doesNotMatch(claude, /targetRefs|current task target|model-visible/i);

    const opencode = renderOpenCodeAgentMarkdown(first.opencode);
    assert.match(opencode, /mode:\s*subagent/i);
    assert.match(opencode, /return.*parent agent/i);
  });
});
```

- [ ] **Step 3: Run tests to verify red**

Run: `node --test test/docs/member-runtime-projection-contract.test.mjs test/core/member-runtime-projection.test.mjs`

Expected: FAIL because the contract and generator module do not exist.

- [ ] **Step 4: Write the contract and minimal generator**

Create `docs/contracts/member-runtime-projection-contract.md` with these required sections:

```markdown
# Member Runtime Projection Contract

Runtime projection turns a confirmed `TeamMemberProfile` into native runtime definition files. A definition is not packet delivery and does not prove model-visible materials.

## Required Boundaries

- `memberName` remains the stable Context Tree identity.
- Runtime names such as Codex `skill_designer` are mapped names, not replacements for `memberName`.
- Generated definitions contain stable role/routing/return-to-parent/packet-use instructions.
- Generated definitions must not include task-local target materials, m[1] deltas, or evidence claims.
- Full invocation support requires separate `member-invocation-packet.json`, delivery evidence, result-return evidence, and `MemberTaskRun` writeback.
- Runtime-specific syntax must be grounded in current runtime docs/manuals or existing survey artifacts. If a field is uncertain, the generated projection must carry `knownLosses` or `compatibility: "unverified"` rather than claiming installable support.
```

Create `src/core/member-runtime-projection.mjs` with deterministic renderers. Keep implementation dependency-free and use stable key order. Keep runtime syntax decisions narrow and documented in generated metadata; tests should verify definition boundaries and mapping, not encourage unverified runtime claims.

- [ ] **Step 5: Run focused projection tests**

Run: `node --test test/docs/member-runtime-projection-contract.test.mjs test/core/member-runtime-projection.test.mjs test/core/team-member-profile.test.mjs`

Expected: PASS.

---

### Task 2: Projection CLI and Registry Mapping Artifact

**Files:**
- Create: `scripts/context-tree/generate-member-projections.mjs`
- Create: `test/cli/generate-member-projections-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 1; preserves Invariants 1, 2

**Interfaces:**
- Consumes: `generateMemberRuntimeProjections()` from Task 1 and `loadTeamMemberRegistry()`.
- Produces CLI: `npm run context-tree:generate-member-projections -- --registry <registry.json> --out <dir> [--member <memberName>]`.

- [ ] **Step 1: Write failing CLI tests**

Create `test/cli/generate-member-projections-cli.test.mjs` that creates a temp registry/profile, runs the CLI, and asserts:

```js
assert.equal(result.status, 0);
assert.match(readFileSync(join(out, '.codex/agents/skill_designer.toml'), 'utf8'), /name = "skill_designer"/);
assert.match(readFileSync(join(out, '.claude/agents/skill-designer.md'), 'utf8'), /Use the Context Tree invocation packet/i);
assert.match(readFileSync(join(out, 'agents/skill-designer.md'), 'utf8'), /mode:\s*subagent/i);
assert.deepEqual(JSON.parse(readFileSync(join(out, 'context-tree-member-runtime-projections.json'), 'utf8')).members[0].memberName, 'skill-designer');
```

- [ ] **Step 2: Run CLI test to verify red**

Run: `node --test test/cli/generate-member-projections-cli.test.mjs`

Expected: FAIL because CLI/script does not exist.

- [ ] **Step 3: Implement CLI and npm script**

Add to `package.json`:

```json
"context-tree:generate-member-projections": "node scripts/context-tree/generate-member-projections.mjs"
```

The CLI must write only under `--out`, create runtime subdirectories, and write `context-tree-member-runtime-projections.json` with `memberName`, runtime file refs, runtime agent names, generator version, and known losses.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/cli/generate-member-projections-cli.test.mjs test/core/member-runtime-projection.test.mjs`

Expected: PASS.

---

### Task 3: Member Invocation Packet Artifact

**Files:**
- Create: `docs/contracts/member-invocation-packet-contract.md`
- Create: `src/core/member-invocation-packet.mjs`
- Create: `test/docs/member-invocation-packet-contract.test.mjs`
- Create: `test/core/member-invocation-packet.test.mjs`
- Modify: `src/core/context-tree-artifacts.mjs`
- Modify: `src/core/member-task-request.mjs`
- Modify: `test/core/member-task-request.test.mjs`

**Example:** implements Example 2; preserves Invariants 3, 4

**Interfaces:**
- Consumes: prepared request data from `prepareMemberTaskRequest()`.
- Produces:
  - `createMemberInvocationPacket(input): MemberInvocationPacket`
  - `validateMemberInvocationPacket(input): MemberInvocationPacket`
  - artifact path `member-invocation-packet.json` for every V1 invocation lifecycle request

- [ ] **Step 1: Write contract and core tests first**

Tests must assert that a packet includes:

```js
{
  kind: 'member-invocation-packet',
  memberName: 'skill-designer',
  memberTaskRequestRef: '/tmp/run/member-task-request.json',
  memberContextRenderRef: '/tmp/run/member-context-render.json',
  materialSelectionReportRef: '/tmp/run/material-selection-report.json',
  task: { kind: 'review', question: 'Review trigger wording.' },
  expectedResultReturn: 'parent-agent',
  preparedChildInput: { kind: 'prompt-text', text: 'Review the target material and return to parent-agent.' },
  preparedChildInputDigest: 'sha256:prepared-child-input-digest',
  m0Refs: ['profile:skill-designer'],
  m1Refs: ['target:skill-plan'],
  targetRefs: ['target:skill-plan'],
  writeback: { expectedResultReturn: 'parent-agent' }
}
```

and rejects packets missing `preparedChildInputDigest`, `memberContextRenderRef`, or `materialSelectionReportRef`.

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/docs/member-invocation-packet-contract.test.mjs test/core/member-invocation-packet.test.mjs`

Expected: FAIL because contract/module does not exist.

- [ ] **Step 3: Implement packet module and artifact writer support**

Add `memberInvocationPacket` support to `writeContextTreeManifestArtifacts()` in `src/core/context-tree-artifacts.mjs`. Update `prepareMemberTaskRequest()` with a deterministic artifact-path plan before constructing either the request or packet:

```text
outputDir/member-task-request.json
outputDir/member-invocation-packet.json
outputDir/member-context-render.json
outputDir/material-selection-report.json
```

The request and packet may reference these precomputed paths, but digest fields must not include mutable self-references that change after write. Do not create an implicit circular digest between request and packet.

Implementation may use either:

1. **single-pass planned refs**: precompute all paths, build request with `memberInvocationPacketRef`, build packet with `memberTaskRequestRef`, then write both once; or
2. **explicit two-phase write**: write draft artifacts, backpatch refs, recompute only declared non-self digests, and write a `pathPlanningDigest`/`backpatchReason` proving the final refs are intentional.

Prefer single-pass planned refs unless existing helpers make it impractical. Preserve existing return fields and add:

```js
memberInvocationPacket,
memberInvocationPacketPath,
```

The packet must reference request/render/selection artifacts rather than duplicating them as authority. It may duplicate `preparedChildInput` and `preparedChildInputDigest` because those are the concrete deliverable bytes, but the request remains the activation authority and the render/selection artifacts remain the context layout authority.

- [ ] **Step 4: Update request tests**

Extend `test/core/member-task-request.test.mjs` to assert:

- packet file exists;
- `prepared.request.memberInvocationPacketRef` equals the returned packet path;
- packet `memberTaskRequestRef` equals the returned request path;
- request and packet digests remain stable across two identical preparations;
- no digest changes when only absolute output directory changes and refs are recorded as artifact refs rather than digest authority, unless the contract explicitly includes absolute refs in the digest input.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-invocation-packet.test.mjs test/core/context-tree-artifacts.test.mjs test/core/member-task-request.test.mjs`

Expected: PASS.

---

### Task 4: Packet Delivery Evidence and Result-Return Evidence

**Files:**
- Create: `src/core/member-result-return-evidence.mjs`
- Create: `test/core/member-result-return-evidence.test.mjs`
- Modify: `src/core/member-invocation-packet.mjs`
- Modify: `src/core/member-task-run-record.mjs`
- Modify: `src/core/explicit-member-task-run-record.mjs`
- Modify: `test/core/member-task-run-record.test.mjs`

**Example:** implements Example 2; preserves Invariants 3, 5

**Interfaces:**
- Produces:
  - `createPacketDeliveryEvidence(input): PacketDeliveryEvidence`
  - `validatePacketDeliveryEvidence(input): PacketDeliveryEvidence`
  - `validateResultReturnEvidence(input): ResultReturnEvidence`
  - `assertParentAgentReturnSupported({ returnedTo, evidenceRefs, resultReturnEvidence }): void`

- [ ] **Step 1: Write failing evidence tests**

Create `test/core/member-result-return-evidence.test.mjs` with cases:

```js
assert.doesNotThrow(() => validateResultReturnEvidence({
  kind: 'member-result-return-evidence',
  returnedTo: 'parent-agent',
  evidenceKind: 'parent-transcript',
  evidenceRef: './observed-parent-call-transcript.json',
  resultDigest: 'sha256:abc',
}));

assert.throws(() => assertParentAgentReturnSupported({
  returnedTo: 'parent-agent',
  evidenceRefs: [{ kind: 'file', ref: './member-output.json' }],
}), /parent-agent.*return.*evidence/i);
```

Accepted parent return evidence kinds: `parent-transcript`, `runtime-wait-result`, `tool-return`, `adapter-parent-call-record`. Rejected as sole support: `file`, `workbench`, `retained-artifact`, `fixture`.

Packet delivery evidence is separate from packet preparation. It must include:

```js
{
  kind: 'member-packet-delivery-evidence',
  deliveryKind: 'native-subagent-prompt' | 'custom-agent-task' | 'tool-return-call' | 'sidecar-call' | 'mounted-packet' | string,
  deliveryAuthority: 'runtime-observed' | 'adapter-observed' | 'test-fixture' | 'retained-artifact' | string,
  runtimeSurface: 'codex' | 'claude-code' | 'opencode' | 'sidecar' | string,
  memberInvocationPacketRef: './member-invocation-packet.json',
  deliveredInputDigest: 'sha256:...',
  evidenceRef: './runtime-observation.json'
}
```

`preparedChildInputDigest` alone is preparation evidence, not delivery evidence. `deliveryAuthority: 'test-fixture'` or `'retained-artifact'` can satisfy hermetic tests but cannot by itself satisfy product-observed live proof.

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/core/member-result-return-evidence.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement evidence module**

Implement strict validators and exported accepted/rejected kind sets. Do not infer parent return from generic `evidenceRefs` unless one accepted kind is present. Do not infer packet delivery from the existence of `member-invocation-packet.json`; require delivery evidence unless the caller explicitly asks for definition/preparation-only validation.

- [ ] **Step 4: Enforce in `MemberTaskRun` validation**

Modify `src/core/member-task-run-record.mjs` so when `result.returnedTo === 'parent-agent'`, V1 lifecycle runs require at least one accepted result-return evidence ref. Preserve V0 compatibility for records without lifecycle claims by warning only in readers, not breaking old retained artifacts.

- [ ] **Step 5: Update explicit member record path**

Modify `src/core/explicit-member-task-run-record.mjs` to write packet delivery evidence and result-return evidence from explicit executor/parent invocation artifacts. It must not claim parent-agent return from output files alone.

- [ ] **Step 6: Run focused tests**

Run: `node --test test/core/member-result-return-evidence.test.mjs test/core/member-task-run-record.test.mjs test/eval/explicit-member-activation-artifact.test.mjs`

Expected: PASS.

---

### Task 5: Explicit Member Product Path Requires Packet Delivery and Parent Return

**Files:**
- Modify: `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
- Modify: `src/eval/explicit-member-activation-artifact.mjs`
- Modify: `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`
- Modify: `test/eval/explicit-member-activation-artifact.test.mjs`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`

**Example:** implements Example 2; preserves Invariants 3, 5, 6

**Interfaces:**
- Consumes packet/evidence fields from Tasks 3 and 4.
- Produces stricter explicit member product proof gating.

- [ ] **Step 1: Write regression tests for missing packet and fake parent return**

Add tests in `test/eval/explicit-member-activation-artifact.test.mjs`:

```js
it('fails product explicit member activation without member-invocation-packet evidence', async () => {
  const fixture = buildExplicitMemberFixture();
  delete fixture.request.memberInvocationPacketRef;
  const result = await explicitMemberActivationCaseResultFromArtifact(fixture.artifact, { artifactRoot: fixture.root });
  assert.equal(result.status, 'fail');
  assert.match(result.failureReason, /member-invocation-packet|packet delivery/i);
});

it('fails parent-agent returnedTo when only file evidence exists', async () => {
  const fixture = buildExplicitMemberFixture();
  fixture.run.result.returnedTo = 'parent-agent';
  fixture.run.evidenceRefs = [{ kind: 'file', ref: './explicit-member-executor-output.json' }];
  const result = await explicitMemberActivationCaseResultFromArtifact(fixture.artifact, { artifactRoot: fixture.root });
  assert.equal(result.status, 'fail');
  assert.match(result.failureReason, /parent-agent.*return/i);
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/eval/explicit-member-activation-artifact.test.mjs test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`

Expected: FAIL because current proof path does not require packet delivery evidence.

- [ ] **Step 3: Update runner and artifact evaluator**

Modify the explicit runner to include `memberInvocationPacketPath`, packet delivery evidence, and result-return evidence in generated artifacts. Modify evaluator to require them for `authorized-explicit-member-activation` product pass. Retained fixtures may need migration; update only fixtures used as product-positive tests, and keep negative fixture tests negative.

- [ ] **Step 4: Update docs**

Document that explicit product proof now requires `member-invocation-packet.json`, packet delivery evidence, and accepted parent-return evidence. State that native/natural tiers remain separate.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs test/eval/explicit-member-activation-artifact.test.mjs test/docs/runtime-native-spawn-shapes.test.mjs`

Expected: PASS.

---

### Task 6: Role Memory Candidate Boundary and Host-Applied Promotion

**Files:**
- Modify: `docs/contracts/member-role-memory-contract.md`
- Modify: `src/core/member-role-memory.mjs`
- Modify: `test/docs/member-role-memory-contract.test.mjs`
- Modify: `test/core/member-role-memory.test.mjs`

**Example:** implements Example 3; preserves Invariant 4

**Interfaces:**
- Extends `RoleMemoryCandidate` with `creationSource` and `sourceAuthority` while keeping old fields readable with compatibility warnings where needed.
- Produces `validateCandidateCreationBoundary(candidate)`.

- [ ] **Step 1: Write contract/test updates**

Add contract language requiring candidate creation from only: `retrospective-learning`, `explicit-remember`, `import-migration`, `eval-correction-loop`.

Add tests:

```js
assert.doesNotThrow(() => validateRoleMemoryCandidate(validCandidate({
  creationSource: 'retrospective-learning',
  sourceAuthority: 'host-applied',
  sourceRefs: ['./feedback-window.json'],
})));

assert.throws(() => validateRoleMemoryCandidate(validCandidate({
  creationSource: 'parent-agent-observation',
  sourceAuthority: 'agent-guessed',
})), /candidate creation boundary/i);
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/docs/member-role-memory-contract.test.mjs test/core/member-role-memory.test.mjs`

Expected: FAIL because candidate boundary fields/validation are absent.

- [ ] **Step 3: Implement validation**

Update `validateRoleMemoryCandidate()` to require non-empty `sourceRefs`, accepted creation source, and accepted source authority for new V1 records. Preserve older fixture compatibility by allowing missing fields only when `metadata.compatibilityMode === 'legacy-v0'` and never treating such records as baseline eligible.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/core/member-role-memory.test.mjs test/docs/member-role-memory-contract.test.mjs test/eval/member-context-lifecycle.test.mjs`

Expected: PASS.

---

### Task 7: Member Retrospective Feedback-to-Memory V0

**Files:**
- Create: `src/core/member-retrospective-memory.mjs`
- Create: `test/core/member-retrospective-memory.test.mjs`
- Create: `scripts/context-tree/run-member-retrospective-memory.mjs`
- Create: `test/cli/run-member-retrospective-memory-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 3; preserves Invariants 4, 5

**Interfaces:**
- Produces:
  - `detectMemberFeedbackWindow(input): FeedbackWindow | null`
  - `parseRetrospectiveLearningXml(text): RetrospectiveLearning[]`
  - `validateRetrospectiveLearning(learning, sourceUserTexts): RetrospectiveLearning`
  - `routeRetrospectiveLearning({ learning, memberName, sourceRefs, confidence }): RoutedLearning`
  - CLI `npm run context-tree:run-member-retrospective-memory -- --input <feedback-window.json> --out <dir>`.

- [ ] **Step 1: Write failing core tests**

Create `test/core/member-retrospective-memory.test.mjs` with concrete tests for these cases:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMemberFeedbackWindow,
  parseRetrospectiveLearningXml,
  routeRetrospectiveLearning,
  validateRetrospectiveLearning,
} from '../../src/core/member-retrospective-memory.mjs';

describe('member retrospective memory', () => {
  it('detects user correction after a member run and produces a feedback window', () => {
    const window = detectMemberFeedbackWindow({
      memberTaskRun: { id: 'run-1', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' } },
      followingMessages: [
        { role: 'user', text: 'trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。', messageId: 'msg-1' },
      ],
    });
    assert.equal(window.memberName, 'skill-designer');
    assert.equal(window.sourceRefs[0], 'member-task-run:run-1');
    assert.equal(window.userMessageRefs[0], 'message:msg-1');
  });

  it('parses distilled retrospective learning XML', () => {
    const learnings = parseRetrospectiveLearningXml('<learnings><learning route="member-memory" memberName="skill-designer" type="role_rule">Write skill triggers from the ordinary agent-work perspective.</learning></learnings>');
    assert.equal(learnings.length, 1);
    assert.equal(learnings[0].memberName, 'skill-designer');
    assert.equal(learnings[0].content, 'Write skill triggers from the ordinary agent-work perspective.');
  });

  it('rejects raw user quotes, dates, anger text, and high source overlap', () => {
    assert.throws(() => validateRetrospectiveLearning({ content: 'User said "trigger 不能写成 loop-controller"', route: 'member-memory', memberName: 'skill-designer' }, []), /quote|transcribe/i);
    assert.throws(() => validateRetrospectiveLearning({ content: 'On 2026-07-10 the user corrected trigger wording.', route: 'member-memory', memberName: 'skill-designer' }, []), /date/i);
    assert.throws(() => validateRetrospectiveLearning({ content: 'Stop ignoring the user again and again.', route: 'member-memory', memberName: 'skill-designer' }, []), /frustration|anger/i);
  });

  it('routes member-specific trigger learning to skill-designer candidate with host-applied boundary', () => {
    const routed = routeRetrospectiveLearning({
      learning: { route: 'member-memory', memberName: 'skill-designer', type: 'role_rule', content: 'Write skill triggers from the ordinary agent-work perspective.' },
      sourceRefs: ['feedback-window:fw-1'],
      confidence: 0.88,
    });
    assert.equal(routed.kind, 'role-memory-candidate');
    assert.equal(routed.creationSource, 'retrospective-learning');
    assert.equal(routed.sourceAuthority, 'host-applied');
  });

  it('does not create durable memory for ordinary one-off requests', () => {
    const window = detectMemberFeedbackWindow({
      memberTaskRun: { id: 'run-2', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' } },
      followingMessages: [{ role: 'user', text: 'Now review another file.', messageId: 'msg-2' }],
    });
    assert.equal(window, null);
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/core/member-retrospective-memory.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement deterministic V0 helpers**

Implement XML-like parser compatible with Magic Context-style `<learnings>` blocks. Reuse the same conservative principles from `architecture/14-magic-context-memory-deep-dive.md`: distill, do not transcribe; reject dates/raw quotes/frustration markers/high source overlap; zero learnings is acceptable.

- [ ] **Step 4: Implement CLI**

The CLI reads a feedback-window artifact and either writes:

```text
member-retrospective-learning.json
role-memory-candidate.json
member-dreamer-run.json
```

or writes `member-retrospective-learning.json` with `route: "discard"` and a reason. It must not mutate active memory directly unless invoked with an explicit `--promote-active` flag and host-applied evidence fields.

- [ ] **Step 5: Add npm script**

Add:

```json
"context-tree:run-member-retrospective-memory": "node scripts/context-tree/run-member-retrospective-memory.mjs"
```

- [ ] **Step 6: Run focused tests**

Run: `node --test test/core/member-retrospective-memory.test.mjs test/cli/run-member-retrospective-memory-cli.test.mjs test/core/member-role-memory.test.mjs`

Expected: PASS.

---

### Task 8: Memory Maintenance Manifests and Baseline Fold Evidence

**Files:**
- Modify: `src/core/member-role-memory.mjs`
- Create: `test/core/member-role-memory-maintenance.test.mjs`
- Modify: `src/core/member-context-render.mjs`
- Modify: `test/core/member-context-render.test.mjs`
- Modify: `docs/contracts/member-context-render-contract.md`
- Modify: `docs/contracts/member-role-memory-contract.md`

**Example:** implements Example 3; preserves Invariant 4

**Interfaces:**
- Produces:
  - `validateVerifyRoleMemoryManifest(input)`
  - `validateClassifyRoleMemoryManifest(input)`
  - `applyHostRoleMemoryMutations({ memories, candidates, manifest, appliedBy }): { memories, mutationLog }`
  - baseline fold reason validation for `MemberContextRender.foldReason`.

- [ ] **Step 1: Write failing maintenance tests**

Tests must verify:

- classify manifest can set `defaultVisibility: 'm0'` only for active memory;
- archive/supersede requires mutation log;
- pending candidate cannot enter `m0Refs`;
- baseline fold requires explicit `foldReason` when m[0] changes because of memory promotion.

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/core/member-role-memory-maintenance.test.mjs test/core/member-context-render.test.mjs`

Expected: FAIL for missing maintenance helpers or missing fold validation.

- [ ] **Step 3: Implement host-applied maintenance helpers**

Keep manifest validation read-only: agent outputs are proposals; host apply creates mutation logs. Do not add scheduler/storage engine in this task.

- [ ] **Step 4: Tighten context render validation**

Ensure `createMemberContextRender()` rejects `m0Refs` classified as candidate refs for V1 lifecycle renders. Add an optional `materialClassifications` input shaped as `{ ref: string, lifecycleStatus: 'active' | 'candidate' | 'searchable' | 'source-only' | 'profile' }[]`; when supplied, production code must reject any `m0Refs` whose classification is not `active` or `profile`. Older V0/retained render paths without lifecycle classifications must remain readable and may emit warnings, but must not claim V1 lifecycle pass.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-role-memory-maintenance.test.mjs test/core/member-role-memory.test.mjs test/core/member-context-render.test.mjs test/docs/member-context-render-contract.test.mjs`

Expected: PASS.

---

### Task 8A: Session-Derived Cold Start Candidate Pipeline

**Files:**
- Create: `src/core/member-session-cold-start.mjs`
- Create: `scripts/context-tree/run-member-session-cold-start.mjs`
- Create: `scripts/context-tree/eval-member-session-cold-start.mjs`
- Create: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Create: `test/core/member-session-cold-start.test.mjs`
- Create: `test/cli/run-member-session-cold-start-cli.test.mjs`
- Create: `test/eval/member-session-cold-start-eval.test.mjs`
- Create: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Modify: `package.json`
- Modify: `docs/contracts/member-role-memory-contract.md`

**Example:** implements Example 5; preserves Invariants 4 and 7

**Interfaces:**
- Consumes retained user session corpus / transcript snippets grouped by repo/workspace identity, existing MemberTaskRun ledger refs, eval correction refs, optional docs as supporting evidence, and a live/exported runtime session corpus for product/live evaluation.
- Produces `session-corpus-scan.json`, `session-role-signals.json`, `member-profile-candidates.json`, and optional `role-memory-candidates.json`.
- Does not mutate default Experts, active role memory, or `member-m[0]` unless a separate confirmation/promotion flow is explicitly invoked.

- [ ] **Step 1: Write failing cold-start tests**

Add tests asserting:

- repeated evidence across multiple root user sessions creates a `SessionRoleSignal` and `MemberProfileCandidate` for `skill-designer`;
- the candidate carries project/workspace identity, multiple session refs, signal kinds, confidence, and supporting docs/run refs;
- subagent/hidden child sessions are excluded by default even if their task prompts contain skill/eval words;
- scan output records watermark, overlap count, max sessions/messages caps, and truncation frontier when capped;
- docs-only material with no session/import/run lifecycle evidence creates no profile candidate;
- extracted role learnings remain `candidate` or `pending`, not `active`;
- parent-agent guessed memory without retained session evidence is rejected.

Add `test/eval/member-session-cold-start-eval.test.mjs` asserting the eval report contains:

```js
{
  sessionDerivedCandidate: {
    status: 'pass',
    memberName: 'skill-designer',
    defaultExpert: false,
    sessionRefs: 'present',
    sessionCount: 'multiple',
    projectIdentity: 'present'
  },
  docsOnlyNegative: {
    status: 'pass',
    defaultExpert: false,
    profileCandidate: false,
    activeMemory: false
  },
  memoryBoundary: {
    status: 'pass',
    candidateOnly: true,
    rawQuoteRejected: true
  },
  issues: []
}
```

Add `test/eval/member-session-cold-start-live-eval.test.mjs` asserting the live eval report distinguishes:

```js
{
  mode: 'live' | 'blocked',
  source: 'runtime-observer-export' | 'session-corpus-export' | 'session-store-export' | 'blocked',
  liveSessionDerivedCandidate: { status: 'pass' | 'fail' | 'blocked' },
  correctionLoop: { status: 'pass' | 'not-needed' | 'blocked' | 'failed', attempts: Number },
  issues: []
}
```

Live pass requires a real exported parent/user session or runtime transcript containing the relevant session evidence. Retained fixtures cannot satisfy live pass.

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/core/member-session-cold-start.test.mjs test/cli/run-member-session-cold-start-cli.test.mjs test/eval/member-session-cold-start-eval.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs`

Expected: FAIL because the cold-start module/CLI does not exist.

- [ ] **Step 3: Implement signal extraction and validation**

Implement a conservative extractor inspired by Magic Context retrospective:

```text
repo/workspace session corpus
  -> root-session filtering
  -> bounded feedback/delegation windows with caps/watermark/overlap/frontier
  -> SessionRoleSignal[]
  -> MemberProfileCandidate[]
  -> optional RoleMemoryCandidate[]
  -> host validation
```

The extractor may use deterministic fixture parsing in V1 tests. It must not require a live LLM to pass hermetic tests. If a future LLM/agent pass is added, it must emit a manifest and host code must apply validation.

Required gates:

- at least two root user-session refs, or one explicit user-named member plus one corroborating run/session ref, for every profile candidate;
- docs refs are supporting evidence only;
- candidate memberName must come from repeated role signal or explicit user naming;
- subagent/hidden child sessions must not satisfy repeated user-session evidence;
- scan metadata must record project/workspace identity, included/excluded session counts, cap values, watermark, overlap, and truncation frontier;
- generated memory text must be distilled, not raw user quote;
- no candidate enters default registry or `member-m[0]` without confirmation/promotion.

- [ ] **Step 4: Add CLI**

Add:

```json
"context-tree:run-member-session-cold-start": "node scripts/context-tree/run-member-session-cold-start.mjs",
"context-tree:eval-member-session-cold-start": "node scripts/context-tree/eval-member-session-cold-start.mjs",
"context-tree:eval-member-session-cold-start:live": "node scripts/context-tree/run-live-member-session-cold-start-eval.mjs"
```

CLI input accepts retained JSON fixtures with a session corpus, per-session metadata (`sessionId`, `projectIdentity`, `isSubagent`, `updatedAt`, messages), and optional docs/run refs, writes:

```text
session-corpus-scan.json
session-role-signals.json
member-profile-candidates.json
role-memory-candidates.json
cold-start-summary.json
```

The eval CLI writes:

```text
member-session-cold-start-eval-report.json
positive/session-corpus-scan.json
positive/session-role-signals.json
positive/member-profile-candidates.json
positive/role-memory-candidates.json
negative-docs-only/cold-start-summary.json
```

The report must distinguish:

- `session-derived-positive`: session evidence creates a candidate;
- `docs-only-negative`: docs/supporting material alone creates no candidate or default Expert;
- `memory-boundary`: candidate memory is not active and raw quote copying is rejected.

The live eval CLI accepts:

```text
--runtime-observer-export <path>
--session-corpus-export <path>
--session-store-export <path>
--project-identity <identity>
--out <dir>
--max-correction-attempts <n>
```

It writes:

```text
member-session-cold-start-live-eval-report.json
live-input-source.json
attempt-<n>/session-role-signals.json
attempt-<n>/member-profile-candidates.json
attempt-<n>/role-memory-candidates.json
attempt-<n>/session-corpus-scan.json
attempt-<n>/issues.json
```

If no live/exported runtime session is available, it must exit with an honest blocked report, not a pass. A blocked report is acceptable for environment diagnosis but does not close the product/live proof.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-session-cold-start.test.mjs test/cli/run-member-session-cold-start-cli.test.mjs test/eval/member-session-cold-start-eval.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs test/core/member-role-memory.test.mjs`

Expected: PASS.

- [ ] **Step 6: Run retained cold-start eval command**

Run:

```bash
npm run context-tree:eval-member-session-cold-start -- --out /tmp/context-tree-member-session-cold-start-eval
```

Expected: command exits 0 and writes `/tmp/context-tree-member-session-cold-start-eval/member-session-cold-start-eval-report.json` with `sessionDerivedCandidate.status: "pass"`, `docsOnlyNegative.status: "pass"`, `memoryBoundary.status: "pass"`, and `issues: []`.

- [ ] **Step 7: Run live cold-start eval**

Run with a real exported repo/workspace session corpus when available. This is the preferred path for real repos such as `agent-wiki-lab`, because the signal may span multiple user sessions:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /path/to/agent-wiki-lab-session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval \
  --max-correction-attempts 3
```

If only a runtime observer export is available, use it only when it represents a real multi-session or project-scoped export rather than a handcrafted marker:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --runtime-observer-export "$RUNTIME_OBSERVER_EXPORT_PATH" \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval \
  --max-correction-attempts 3
```

If neither corpus nor observer export exists, but a real session-store export is available, use it as a corpus source. Single-session exports are allowed only as limited evidence; they cannot prove repeated cross-session signal unless the report marks that limitation:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-store-export /path/to/exported-session.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval \
  --max-correction-attempts 3
```

Expected with valid live/exported session corpus evidence: command exits 0 and writes `member-session-cold-start-live-eval-report.json` with `liveSessionDerivedCandidate.status: "pass"`, `correctionLoop.status: "pass"` or `"not-needed"`, session corpus scan metadata, and `issues: []`.

Expected without a live/exported session corpus or usable session-store source: command exits 0 with `mode: "blocked"`, `liveSessionDerivedCandidate.status: "blocked"`, and a reason naming the missing source. This does not close live proof.

- [ ] **Step 8: Live eval -> correction -> rerun loop**

If the live eval returns `fail`, report `issues[]` is non-empty, or the report is `blocked` for any reason other than missing live/exported session source:

1. Retain the live report, input source digest, failing attempt artifacts, and exact issue text.
2. Classify root cause: extraction defect, validation defect, fixture mismatch, live source insufficiency, product requirement mismatch, or environment block.
3. Add or update a regression test that reproduces the failure from the retained live input or a minimized fixture.
4. Fix the extractor/validator/reporting at the root cause. Do not weaken docs-only non-authority or promotion gates to pass.
5. Run the focused regression tests. Expected: PASS.
6. Rerun the live eval command against the same live input source. Expected: PASS, or a narrower honest blocked reason if the source is insufficient.
7. Repeat up to `--max-correction-attempts`. If still failing after the configured attempts, leave the report failed with retained evidence and do not claim product/live cold-start proof.

If the only blocked reason is missing `--session-corpus-export` / `RUNTIME_OBSERVER_EXPORT_PATH` / `--session-store-export`, record that as an environment/source prerequisite. Do not mark the task complete as product/live proof, but do not run a code correction loop for absent input.

---

### Task 9: Workbench Integration for Packet, Return, Memory, Cold-Start Candidates, and Docs-Only Non-Authority Boundary

**Files:**
- Modify: `src/core/member-workbench-artifacts.mjs`
- Modify: `src/core/member-workbench-view-model.mjs`
- Modify: `src/report/member-workbench-terminal.mjs`
- Modify: `test/core/member-workbench-artifacts.test.mjs`
- Modify: `test/core/member-workbench-view-model.test.mjs`
- Modify: `test/report/member-workbench-terminal.test.mjs`
- Modify: `docs/contracts/member-workbench-tui-contract.md`

**Example:** implements Example 4 and Example 5 boundary; preserves Invariants 1, 3, 5, 6, 7

**Interfaces:**
- Consumes new artifacts: `member-invocation-packet.json`, packet delivery evidence, result-return evidence, retrospective memory artifacts, session-derived cold-start candidate artifacts, and optional docs-only fixtures.
- Produces Workbench model fields under Trace/details without making them artifact authority.

- [ ] **Step 1: Write failing Workbench tests**

Add tests asserting:

- first-level task shows `Returned to: parent-agent` only when accepted result-return evidence exists;
- missing packet delivery makes task `Needs review` and Trace shows `Packet delivery: missing`;
- memory candidates appear in Trace/Context detail, not as active role memory;
- session-derived `MemberProfileCandidate` records appear as candidates/review items, not default Experts until confirmed;
- docs-only materials, if present in fixtures, are not grouped as Experts by default;
- forbidden proof labels remain absent from first-level output.

- [ ] **Step 2: Run tests to verify red**

Run: `node --test test/core/member-workbench-artifacts.test.mjs test/core/member-workbench-view-model.test.mjs test/report/member-workbench-terminal.test.mjs`

Expected: FAIL for missing packet/return/cold-start-candidate/docs-only-authority boundary handling.

- [ ] **Step 3: Update artifact reader and view model**

Load packet/evidence/memory/cold-start artifacts from the run directory when those files exist, and record warnings when a V1 lifecycle run references them but they are missing. If session-derived profile candidates are present but unconfirmed, show them as candidates/review items, not default Experts. If docs-only materials are present without confirmed profile/import/session/run lifecycle evidence, treat them as source/material trace only and never as default Experts. Keep Workbench read-only. Derive first-level status from work facts; put proof details in Trace.

- [ ] **Step 4: Update terminal renderer**

Add concise Trace lines:

```text
Packet delivery: observed | missing | definition-only
Result return: parent-agent observed | file-only | unknown
Memory: active | pending review | searchable only
Cold start: candidate | confirmed | none
Docs: material only | profile evidence | no expert authority
```

Do not show acceptance-tier names in overview/task first screens.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-workbench-artifacts.test.mjs test/core/member-workbench-view-model.test.mjs test/report/member-workbench-terminal.test.mjs test/cli/render-member-workbench-cli.test.mjs`

Expected: PASS.

---

### Task 10: Documentation and Contract Alignment

**Files:**
- Modify: `docs/contracts/member-task-run-record-contract.md`
- Modify: `docs/contracts/member-context-render-contract.md`
- Modify: `docs/contracts/member-role-memory-contract.md`
- Modify: `docs/contracts/member-workbench-tui-contract.md`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Create or modify doc tests named by contract.

**Example:** observes Examples 1-5 boundaries; preserves Invariants 1-7

**Interfaces:**
- Consumes behavior implemented in Tasks 1-9.
- Produces docs that explain the product boundaries without making eval/support artifacts user-facing authority.

- [ ] **Step 1: Add doc tests for new required language**

Update doc tests to assert:

- projection definition is not packet delivery;
- `returnedTo: parent-agent` requires accepted evidence;
- candidate creation boundary excludes parent-agent guessed candidates;
- Workbench first-level forbidden labels remain forbidden;
- docs-only material cannot create default Experts or durable baseline memory.
- session-derived cold-start candidate behavior is documented: candidates require session evidence, remain unconfirmed by default, and do not enter `member-m[0]` before promotion.

- [ ] **Step 2: Run doc tests to verify red where docs lag**

Run: `node --test test/docs/*.test.mjs`

Expected: FAIL for docs not yet updated, or PASS if earlier tasks already updated all contract text.

- [ ] **Step 3: Update docs exactly to behavior**

Update contracts/runbooks to reflect implemented field names and evidence gates. Keep proof taxonomy in trace/eval docs, not Workbench first-level docs.

- [ ] **Step 4: Run doc tests**

Run: `node --test test/docs/*.test.mjs`

Expected: PASS.

---

### Task 11: Full Member System E2E Eval and Correction Loop

**Files:**
- Create: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Create: `test/cli/run-member-system-e2e-eval-cli.test.mjs`
- Create: `test/eval/member-system-e2e.test.mjs`
- Modify: `package.json`
- Create: `evals/reports/member-system-v1/README.md`

**Example:** observes and corrects Examples 1-5 boundaries; preserves Invariants 1-7

**Interfaces:**
- Consumes CLIs/modules from Tasks 1-10.
- Produces command: `npm run context-tree:eval-member-system-v1 -- --out <dir> [--fixture-root <dir>] [--product-root <dir>] [--cold-start-live-report <path>]`.

- [ ] **Step 1: Write failing eval tests**

`test/eval/member-system-e2e.test.mjs` must assert the hermetic report includes these cases:

```js
{
  projection: { status: 'pass' },
  packetDelivery: { status: 'pass' },
  explicitInvocation: { status: 'pass', returnedTo: 'parent-agent' },
  coldStartCandidate: { status: 'pass', defaultExpert: false },
  coldStartLiveObserved: { status: 'pass' | 'blocked' | 'not-run' },
  feedbackToMemory: { status: 'pass' },
  workbench: { status: 'pass' },
  negativeControls: {
    definitionOnlyIsNotInvocation: 'pass',
    mountedOnlyReviewerTargetIsWeak: 'pass',
    parentAgentReturnFromFileOnlyRejected: 'pass',
    parentGuessedCandidateRejected: 'pass',
    sessionCandidateNotBaselineUntilConfirmed: 'pass',
    docsOnlyMaterialNotDefaultExpert: 'pass'
  },
  productObserved: { status: 'not-run' }
}
```

Hermetic pass proves schema, gates, adapter behavior, and Workbench rendering. It does not prove a fresh live/product parent-agent invocation unless `--product-root` points to an observed product root with accepted parent-visible result-return evidence. It also does not prove live session-derived cold start unless `--cold-start-live-report` points to a live report with `liveSessionDerivedCandidate.status: "pass"`.

- [ ] **Step 2: Run eval tests to verify red**

Run: `node --test test/eval/member-system-e2e.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs`

Expected: FAIL because eval script does not exist.

- [ ] **Step 3: Implement eval CLI**

The eval CLI must create a temp hermetic scenario root with:

1. confirmed `skill-designer` profile and registry;
2. generated runtime projections;
3. prepared invocation packet for a trigger review task;
4. explicit-member execution artifact using existing executor harness or fixture mode;
5. packet delivery and parent-return evidence;
6. feedback window and retrospective learning artifact;
7. session-derived cold-start candidate artifacts;
8. optional live cold-start eval report reference;
9. Workbench render outputs;
10. optional docs-only negative artifact proving source material alone is not Expert authority;
11. negative-control artifacts.

The CLI must classify output mode explicitly:

```text
mode: hermetic
  - fixture/harness evidence allowed
  - productObserved.status must be not-run unless --product-root is supplied

mode: product-observed
  - requires --product-root
  - product root must contain observed parent-visible result-return evidence
  - fixture-only, retained-only, file-only, and workbench-only evidence cannot satisfy productObserved.status = pass

mode: live-cold-start-observed
  - requires --cold-start-live-report
  - report must be from `context-tree:eval-member-session-cold-start:live`
  - retained/hermetic cold-start report cannot satisfy coldStartLiveObserved.status = pass
```

If `--product-root` is omitted, the command can exit 0 with hermetic cases passing, but `productObserved.status` must be `not-run`, not `pass`.

If `--cold-start-live-report` is omitted, the command can exit 0 with hermetic cold-start cases passing, but `coldStartLiveObserved.status` must be `not-run`, not `pass`.

It writes:

```text
member-system-e2e-report.json
overview.txt
task.txt
trace.txt
artifacts/projection/context-tree-member-runtime-projections.json
artifacts/invocation/member-invocation-packet.json
artifacts/invocation/member-task-run.json
artifacts/cold-start/session-role-signals.json
artifacts/cold-start/member-profile-candidates.json
artifacts/cold-start/live-eval-report-ref.json
artifacts/memory/member-retrospective-learning.json
artifacts/workbench/overview.txt
```

- [ ] **Step 4: Add npm script**

Add:

```json
"context-tree:eval-member-system-v1": "node scripts/context-tree/run-member-system-e2e-eval.mjs"
```

- [ ] **Step 5: Run focused eval tests**

Run: `node --test test/eval/member-system-e2e.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs`

Expected: PASS.

- [ ] **Step 6: Run final product eval command**

Run:

```bash
npm run context-tree:eval-member-system-v1 -- --out /tmp/context-tree-member-system-v1-eval
```

Expected: command exits 0 and writes `/tmp/context-tree-member-system-v1-eval/member-system-e2e-report.json` with all hermetic positive cases `pass`, all negative controls `pass`, `productObserved.status: "not-run"` when `--product-root` is omitted, and `issues: []`.

Run an optional product-observed check only when a real observed product root is available:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-system-v1-product-eval \
  --product-root /path/to/observed/product/root
```

Expected with a valid product root: `productObserved.status: "pass"`. Expected without valid parent-visible result-return evidence: `productObserved.status: "fail"` or `blocked`, while hermetic cases may still pass.

Run a cold-start-live-observed aggregate check when the live cold-start eval report exists:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-system-v1-with-cold-start-live-eval \
  --cold-start-live-report /tmp/context-tree-member-session-cold-start-live-eval/member-session-cold-start-live-eval-report.json
```

Expected with a valid live cold-start pass report: `coldStartLiveObserved.status: "pass"` and `artifacts/cold-start/live-eval-report-ref.json` records the report path, digest, and `liveSessionDerivedCandidate.status`. Expected with a blocked live report: `coldStartLiveObserved.status: "blocked"`; hermetic cold-start may still pass, but live proof remains open.

#### Live prerequisite handoff for implementers

If final verification ends with:

```text
productObserved.status: "not-run"
coldStartLiveObserved.status: "not-run"
```

do not treat that as a code failure, and do not mark live/product proof pass. It means the required live inputs were not supplied.

To close `productObserved`, obtain a real observed product root from the explicit member product path. The root must contain parent-visible result-return evidence derived from an observed parent-agent call surface, not a seed, fixture, retained artifact, source-writer artifact, or Workbench projection. Then run:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-system-v1-product-eval \
  --product-root /path/to/observed/product/root
```

Acceptance: `member-system-e2e-report.json` records `productObserved.status: "pass"`. If it reports `fail` or `blocked`, retain the report and root artifacts, classify the reason, fix only real implementation/validation defects, and rerun against the same product root. If the product root is missing or not truly observed, keep `productObserved` open.

To close `coldStartLiveObserved`, first run the live cold-start eval against a real repo/workspace session corpus export. For real repos such as `agent-wiki-lab`, do not pick one session by hand when the relevant user signal spans multiple sessions:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /path/to/agent-wiki-lab-session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval \
  --max-correction-attempts 3
```

If a real project-scoped runtime observer export exists, it can also be used:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --runtime-observer-export "$RUNTIME_OBSERVER_EXPORT_PATH" \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval \
  --max-correction-attempts 3
```

or, if the observer/corpus export is not available but a real session-store export is available:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-store-export /path/to/exported-session.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval \
  --max-correction-attempts 3
```

Then aggregate it into the system eval:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-system-v1-with-cold-start-live-eval \
  --cold-start-live-report /tmp/context-tree-member-session-cold-start-live-eval/member-session-cold-start-live-eval-report.json
```

Acceptance: the live cold-start report records `liveSessionDerivedCandidate.status: "pass"`, includes session corpus scan metadata, and the aggregate system report records `coldStartLiveObserved.status: "pass"`. If the live report is `blocked` only because no corpus/observer/session export exists, record the missing source prerequisite and leave live proof open. If it is `fail`, or `blocked` for parser/validator/source-shape reasons, enter the live eval -> correction -> rerun loop in Task 8A before claiming closure.

Never satisfy either live field from retained fixtures, hermetic scenario roots, generated seed artifacts, Workbench output, or handwritten JSON. Those can support regression coverage, but live/product proof remains open until the appropriate observed input is supplied and accepted.

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, rendered Workbench text, or exact assertion error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 8: Run full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 9: Run formatting/diff check**

Run: `git diff --check`

Expected: no output.

## Self-Review Checklist for Implementers

- [ ] Every generated runtime definition remains definition-only and contains no task target material.
- [ ] Every product invocation pass has `member-invocation-packet.json`, delivery evidence, result-return evidence, `MemberContextRender`, material selection report, and `MemberTaskRun` writeback.
- [ ] Reviewer/checker tasks do not pass on mounted-only target material without read/model-visible evidence.
- [ ] Parent-agent return is never inferred from files, fixtures, retained artifacts, or Workbench display alone.
- [ ] Parent-agent guessed memory candidates are rejected.
- [ ] Session-derived cold-start candidates require retained session evidence and do not become default Experts before confirmation.
- [ ] Retrospective memory distills user feedback and rejects raw transcription.
- [ ] Active memory is the only baseline-eligible memory.
- [ ] Workbench first-level output does not show proof taxonomy labels.
- [ ] There is no docs-only cold-start suggestion path; docs-only material is not a default Expert or `member-m[0]` material without explicit profile/import/session/run lifecycle evidence.
- [ ] Final eval report and retained rendered text distinguish hermetic pass from product-observed pass and demonstrate the complete V1 mainline plus negative controls.
