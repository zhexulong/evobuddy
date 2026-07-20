# Member Need Gate Cold Start V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace keyword-based cold-start member discovery with a Magic Context-style member-need gate that reads genuine user evidence, builds semantic role-need windows, asks a dreamer-shaped extractor to propose candidates, and proves the behavior through an eval -> correction -> re-eval loop.

**Architecture:** Keep raw session export and product invocation unchanged. Cold-start discovery gets a new private pipeline: `SessionCorpusScan -> MemberNeedGate -> MemberNeedWindow -> MemberCandidateExtractor -> HostValidator -> MemberProfileCandidate | candidateCount: 0`. Deterministic code may clean evidence, render bounded gate inputs, parse gate verdicts, build windows from flagged ordinals, and validate extractor output; deterministic code must not infer member names, role names, routing, or responsibilities from fixed topic vocabulary or `review/check` keyword hits.

**Tech Stack:** Node.js ESM, `node:test`, existing `scripts/context-tree/*` CLIs, existing JSON artifact reports, Magic Context reference code in `ref/magic-context`.

## Global Constraints

- Do not reintroduce `KNOWN_MEMBER_NAMES`, `CLUSTER_TERMS`, `TOPIC_TERMS`, `ROLE_TERMS`, or topic-to-member mappings.
- Do not use `review/check/inspect/audit/检查/审查` as the primary unnamed window trigger. These terms may appear in fixtures and diagnostics, but not as the product window owner.
- Do not treat workflow wrappers as user role-need evidence. `[search-mode]`, `[analyze-mode]`, `<command-instruction>`, `<user-task>`, Ralph Loop text, and delegate boilerplate remain audit/context material unless a later segment-level design explicitly extracts a task payload.
- Do not treat `candidateCount: 0` as blocked when a real session corpus is available and the discovery pipeline completed. Zero candidates must include gate, extractor, and host-validator diagnostics.
- Do not count marker-only rows such as `<!-- OMO_INTERNAL_INITIATOR -->` as genuine user evidence or gate input. They may appear in raw audit digests, but not in `genuineUserMessageCount`, gate line counts, role-need windows, or candidate evidence refs.
- Do not let fail-closed default gate/extractor adapters prove semantic discovery. They can prove hygiene and diagnostic plumbing only. Any semantic candidate discovery proof, or semantic zero-candidate proof, requires non-default gate/extractor adapters with retained input/output artifacts.
- Do not make product live success depend on a fixed candidate name. Live eval may assert candidate quality and evidence shape, not exact name.
- Do not let explicit product invocation proof substitute for cold-start discovery proof.
- No commits unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Stable Role Need Without Review Keywords

- **Example:** Two or more genuine root user lines across sessions repeatedly ask for the same kind of expert judgment without using `review`, `checker`, `member`, or an explicit member name. Example wording: `每次做 live eval 结论前都要先区分 retained、hermetic、live、product proof，不要只看 pass` and `看 capability report 时先判断 proof tier 和 evidence path，再说是否通过`.
- **Expected result:** MemberNeedGate flags those lines, a role-need window is created, the extractor proposes one candidate with source-backed role/routing/responsibilities, and HostValidator accepts it as an unconfirmed `MemberProfileCandidate` with `defaultExpert: false`.
- **Verification:** Hermetic eval report contains `candidateCount > 0`, `gateDiagnostics.flaggedLineCount >= 2`, `evidenceRefs` pointing only to genuine user lines or allowed segments, and no fixed expected candidate name.
- **Failure signal:** Candidate creation requires `review/check` terms, exact member names, fixed topic maps such as `eval -> eval-reviewer`, or workflow wrapper text.
- **If it fails:** Fix the gate/extractor/validator implementation; do not weaken the eval by asserting a fixed canned name.

### Example 2: Topic Repetition Is Not Enough

- **Example:** Multiple genuine user lines mention `eval`, `plan`, or `implementation`, but they only describe one-off tasks and do not express a reusable role need.
- **Expected result:** Discovery completes with `candidateCount: 0`, `reason` states that no stable member need was found, and diagnostics show gate/extractor/host validator ran.
- **Verification:** Hermetic negative eval passes with `candidateCount: 0` and no candidate manifests.
- **Failure signal:** A candidate appears because a topic word repeated.
- **If it fails:** Tighten the gate prompt, extractor prompt, or HostValidator; do not add a forbidden topic blacklist as the main fix.

### Example 3: Workflow Wrapper Stays Out Of Evidence

- **Example:** OpenCode user rows contain `[search-mode]`, `[analyze-mode]`, Ralph Loop, delegate boilerplate, and `<user-task>` text that mentions a plausible member.
- **Expected result:** The raw source remains auditable, but discovery evidence excludes wrapper segments and does not build a candidate from them.
- **Verification:** Live report shows `excludedWorkflowWrapperCount > 0`, scanned/gate input has no wrapper text, and no accepted candidate evidence ref points to wrapper-only content.
- **Failure signal:** A candidate like `previous-agent-rationale-reviewer` appears from workflow prompt material.
- **If it fails:** Fix evidence hygiene or segment attribution before touching candidate extraction.

### Example 4: Non-Default Semantic Discovery Proof

- **Example:** A hermetic or live-derived corpus contains genuine user lines that express a reusable role need without explicit member names or `review/check` keywords. The run uses non-default gate and extractor adapters whose prompt inputs, raw outputs, parsed outputs, and adapter kinds are retained in artifacts.
- **Expected result:** The report either produces accepted candidates from those non-default adapters, or records a semantic zero-candidate decision from those non-default adapters. It does not classify fail-closed default output as semantic discovery.
- **Verification:** Report contains `gateDiagnostics.adapterKind !== "fail-closed-default"`, `extractorDiagnostics.adapterKind !== "fail-closed-default"`, prompt/output artifact refs for both adapters, and either `semanticCandidateDiscovery.status: "pass"` or `semanticZeroCandidate.status: "pass"`.
- **Failure signal:** A run with default adapters is labeled as semantic discovery, or a candidate appears without retained adapter input/output evidence.
- **If it fails:** Fix adapter execution/reporting or lower the claim to diagnostic-only; do not weaken report gates.

### Example 5: Agent-Wiki-Lab Live Eval Is A Correction Loop

- **Example:** Run cold-start live eval against the existing `../agent-wiki-lab` multi-session corpus export.
- **Expected result:** The report honestly passes either with high-quality candidates produced by non-default gate/extractor adapters, or with `candidateCount: 0` plus completed gate/extractor/validator diagnostics. The result must not be a false positive from wrappers or fixed vocabulary. If fail-closed adapters are used, the result is a hygiene/diagnostic pass only, not a semantic discovery effectiveness proof. A separate non-default positive proof from Example 4 is still required before this plan can claim member-need discovery works.
- **Verification:** `/tmp/.../member-session-cold-start-live-eval-report.json` and aggregate `member-system-e2e-report.json` pass strict quality gates.
- **Failure signal:** Report passes while candidate evidence is wrapper, duplicate template digest, topic-only, or deterministic keyword scaffold; or report blocks/fails because the pipeline did not actually run.
- **If it fails:** Enter the correction loop in Task 4.

### Invariants

- Invariant 1: Cold-start discovery produces unconfirmed candidates only; it never confirms, syncs, invokes, or makes a default Expert.
- Invariant 2: HostValidator is the only boundary that can promote extractor output to `MemberProfileCandidate`.
- Invariant 3: Runtime/product invocation artifacts are separate from cold-start discovery artifacts.
- Invariant 4: Raw transcript/audit material may be retained, but accepted candidate evidence must be source-attributed to genuine user evidence or an explicitly allowed segment kind.
- Invariant 5: Gate verdict ordinals refer to rendered gate line ordinals, not source message ordinals. Every rendered gate line must carry both `lineOrdinal` and source `{ sessionId, ordinal, ref, digest }` so cross-session windows cannot bind the wrong source message.

---

## File Structure

- Create `src/core/member-need-gate.mjs`: pure functions for rendering gate input, parsing gate verdicts, and constructing member-need windows from flagged ordinals.
- Create `src/core/member-need-prompts.mjs`: prompts for the cheap member-need gate and deeper candidate extractor. These are prompt contracts, not deterministic keyword rules.
- Create `src/core/member-candidate-extractor.mjs`: extractor proposal schema/validation plus a fail-closed default extractor. Product/live semantic discovery must use a non-default host/model adapter or be reported as zero-candidate diagnostic only.
- Create `src/core/member-need-agent-adapters.mjs`: adapter contracts and retained-artifact helpers for non-default gate/extractor execution. V0 may use an injected test/CLI adapter, but reports must retain prompt input, raw output, parsed output, and adapter kind before making any semantic discovery claim.
- Modify `src/core/member-session-cold-start.mjs`: replace keyword window creation with gate/extractor orchestration while preserving scan/evidence hygiene and existing artifact shape where practical.
- Modify `src/core/member-candidate-dreamer.mjs`: keep explicit named scaffolds honest, but ensure accepted semantic candidates come from extractor output and HostValidator.
- Modify `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`: add quality gates for gate/extractor diagnostics and candidate evidence source shape.
- Modify `scripts/context-tree/run-member-system-e2e-eval.mjs`: require cold-start live reports to include gate/extractor/host-validator diagnostics for both candidate and zero-candidate passes.
- Modify tests under `test/core`, `test/eval`, `test/cli`, and `test/quality` for positive/negative/window hygiene coverage.
- No product invocation scripts should be modified except aggregate eval quality checks if needed.

Important boundary: a fail-closed default gate/extractor is acceptable for core tests and zero-candidate diagnostics, but it is not a product discovery proof. Any live report that claims semantic candidate discovery or semantic no-need discovery must record a non-default gate/extractor adapter and the adapter's input/output artifact refs. A pass produced only by fail-closed defaults must be labeled `diagnosticZeroCandidate`, not `semanticZeroCandidate`.

---

## Task 1: MemberNeedGate Input, Verdict, And Window Builder

**Files:**

- Create: `src/core/member-need-gate.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`
- Create or modify: `test/core/member-need-gate.test.mjs`

**Example:** implements Example 1, Example 2, Example 3; preserves Invariant 4

**Interfaces:**

- Produces `renderMemberNeedGateLines(messages)` where `messages` are scan messages and output is an array of `{ lineOrdinal, sourceOrdinal, ref, text, sessionId, digest }`. `lineOrdinal` is the 1-based ordinal rendered to the gate prompt and parsed from the model verdict. `sourceOrdinal` is the original message ordinal used only for audit/source refs.
- Produces `parseMemberNeedGateVerdict(text)` returning `{ hit: boolean, ordinals: number[] }`.
- Produces `buildMemberNeedWindowsFromGate({ scan, gateVerdict, radius })` returning `{ windows, diagnostics }`.
- Consumed by `deriveMemberSessionColdStart()` in Task 2.

- [ ] **Step 1: Write failing tests for Magic Context-style gate parsing**

Create `test/core/member-need-gate.test.mjs` with tests equivalent to Magic Context's friction gate parser, but named for member need:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemberNeedWindowsFromGate,
  parseMemberNeedGateVerdict,
  renderMemberNeedGateLines,
} from '../../src/core/member-need-gate.mjs';

function msg(sessionId, ordinal, text, extra = {}) {
  return {
    role: 'user',
    sessionId,
    ordinal,
    ref: `session:${sessionId}:message:${ordinal}`,
    digest: `sha256:${sessionId}-${ordinal}`,
    text,
    evidenceSourceKind: 'genuine-user-message',
    ...extra,
  };
}

describe('member need gate', () => {
  it('parses fail-safe y/n verdicts with ordinals only from verdict line', () => {
    assert.deepEqual(parseMemberNeedGateVerdict('n'), { hit: false, ordinals: [] });
    assert.deepEqual(parseMemberNeedGateVerdict('yes: 2, 5'), { hit: true, ordinals: [2, 5] });
    assert.deepEqual(parseMemberNeedGateVerdict('yes, maybe line 3'), { hit: false, ordinals: [] });
    assert.deepEqual(parseMemberNeedGateVerdict('analysis 2026\ny: 4'), { hit: true, ordinals: [4] });
  });

  it('renders only genuine user evidence lines', () => {
    const lines = renderMemberNeedGateLines([
      msg('s1', 1, '每次判断 eval 报告前先区分 proof tier'),
      msg('s1', 2, '', { evidenceSourceKind: 'tool-output-like-user-row' }),
      msg('s1', 3, '[search-mode] workflow wrapper', { excludedWorkflowWrapperCount: 1 }),
    ]);
    assert.deepEqual(lines.map((line) => line.lineOrdinal), [1]);
    assert.deepEqual(lines.map((line) => line.sourceOrdinal), [1]);
    assert.equal(lines[0].text, '每次判断 eval 报告前先区分 proof tier');
  });

  it('does not render marker-only internal initiator rows as genuine gate lines', () => {
    const lines = renderMemberNeedGateLines([
      msg('s1', 1, '<!-- OMO_INTERNAL_INITIATOR -->'),
      msg('s1', 2, '<!-- OMO_INTERNAL_INITIATOR -->\n'),
      msg('s1', 3, '真正的用户要求：以后判断报告前先区分 proof tier'),
    ]);
    assert.deepEqual(lines.map((line) => line.lineOrdinal), [1]);
    assert.deepEqual(lines.map((line) => line.sourceOrdinal), [3]);
  });

  it('builds bounded windows around flagged ordinals without keyword triggers', () => {
    const scan = {
      projectIdentity: 'project:/repo',
      scannedMessages: [
        msg('a', 1, '先做普通任务'),
        msg('a', 2, '每次做 live eval 结论前都要区分 retained、hermetic、live、product proof'),
        msg('a', 3, '不要只看 pass'),
        msg('b', 1, '看 capability report 时先判断 proof tier 和 evidence path'),
      ],
    };
    const lines = renderMemberNeedGateLines(scan.scannedMessages);
    const result = buildMemberNeedWindowsFromGate({ scan, gateLines: lines, gateVerdict: { hit: true, ordinals: [2, 4] }, radius: 1 });
    assert.equal(result.windows.length, 1);
    assert.equal(result.windows[0].nameKind, 'semantic-member-need');
    assert.equal(result.windows[0].promotionEligibility.canCreateCandidate, false);
    assert.equal(result.windows[0].messages.some((message) => /live eval/.test(message.text)), true);
    assert.equal(result.diagnostics.flaggedLineCount, 2);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
node --test test/core/member-need-gate.test.mjs
```

Expected: FAIL because `src/core/member-need-gate.mjs` does not exist.

- [ ] **Step 3: Implement `src/core/member-need-gate.mjs`**

Implementation requirements:

- Copy the fail-safe verdict parsing shape from Magic Context's `parseFrictionGateVerdict`, adapted to `y:` / `yes:` / `n` / `no`.
- Render only non-empty user messages with `evidenceSourceKind === "genuine-user-message"` and no workflow-wrapper exclusion count.
- Rendered `lineOrdinal` values must be dense 1-based ordinals over the filtered gate input. Do not reuse source message ordinals as gate verdict ordinals.
- Exclude marker-only internal initiator rows, including exactly `<!-- OMO_INTERNAL_INITIATOR -->` with surrounding whitespace. They must not appear in gate input or `genuineUserMessageCount` once Task 2 updates scan diagnostics.
- Do not inspect topic words to choose windows.
- Build one window per gate run in V0, using flagged rendered line ordinals plus `radius` surrounding genuine user lines.
- Set `promotionEligibility.canCreateCandidate = false`; Task 2's extractor owns candidate proposal.
- Include diagnostics: `gateRun: true`, `lineCount`, `flaggedLineCount`, `windowCount`, `reason`.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node --test test/core/member-need-gate.test.mjs
```

Expected: PASS.

---

## Task 2: Replace Keyword Windows With Gate + Extractor Boundary

**Files:**

- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `src/core/member-candidate-dreamer.mjs`
- Create: `src/core/member-need-prompts.mjs`
- Create: `src/core/member-candidate-extractor.mjs`
- Create: `src/core/member-need-agent-adapters.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`
- Modify: `test/core/member-candidate-dreamer.test.mjs`
- Modify: `test/quality/no-hardcoded-member-discovery.test.mjs`

**Example:** implements Example 1 and Example 2; preserves Invariant 1 and Invariant 2

**Interfaces:**

- Consumes Task 1's `buildMemberNeedWindowsFromGate()`.
- Produces `deriveMemberSessionColdStart({ corpus, projectIdentity, memberNeedGate, candidateExtractor, ... })`.
- Produces candidate manifests only from accepted extractor proposals or explicit clean named-member scaffolds.
- Produces adapter diagnostics shaped as `{ adapterKind, inputArtifactRef, rawOutputArtifactRef, parsedOutputArtifactRef, parseErrors, semanticClaim }`. `semanticClaim` is `false` for fail-closed defaults.

- [ ] **Step 1: Write failing tests for semantic positive and topic-only negative**

Add tests to `test/core/member-session-cold-start.test.mjs`:

```js
it('creates a candidate from semantic member need without review keywords or fixed topic mapping', () => {
  const result = deriveMemberSessionColdStart({
    corpus: corpusFixture({
      sessions: [
        { sessionId: 'need-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [
          { role: 'user', text: '每次做 live eval 结论前都要先区分 retained、hermetic、live、product proof，不要只看 pass' },
        ] },
        { sessionId: 'need-b', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [
          { role: 'user', text: '看 capability report 时先判断 proof tier 和 evidence path，再说是否通过' },
        ] },
      ],
    }),
    projectIdentity: 'project:/repo/agent-wiki-lab',
    memberNeedGate: () => ({ hit: true, ordinals: [1, 2], reason: 'semantic reusable member need', adapterKind: 'test-semantic-gate', semanticClaim: true }),
    candidateExtractor: ({ windows }) => ({
      extractorRun: true,
      adapterKind: 'test-semantic-extractor',
      semanticClaim: true,
      proposals: [{
        memberName: 'proof-tier-evaluator',
        role: 'Proof tier evaluation specialist',
        routingDescription: 'Use when deciding whether eval artifacts prove retained, hermetic, live, or product-grade success.',
        responsibilities: [
          'Classify evidence tier before accepting a report verdict.',
          'Reject pass claims that rely on unrelated proof paths or wrapper text.',
        ],
        evidenceRefs: windows[0].messages.map((message) => ({ kind: 'session-message', ref: message.ref, digest: message.digest })),
      }],
    }),
  });

  assert.equal(result.profileCandidates.candidates.length, 1);
  assert.equal(result.profileCandidates.candidates[0].defaultExpert, false);
  assert.equal(result.pipelineDiagnostics.gateDiagnostics.flaggedLineCount, 2);
  assert.equal(result.pipelineDiagnostics.gateDiagnostics.adapterKind, 'test-semantic-gate');
  assert.equal(result.pipelineDiagnostics.dreamerDiagnostics.extractorRun, true);
  assert.equal(result.pipelineDiagnostics.dreamerDiagnostics.adapterKind, 'test-semantic-extractor');
});

it('does not create a candidate from repeated topic-only lines', () => {
  const result = deriveMemberSessionColdStart({
    corpus: corpusFixture({
      sessions: [
        { sessionId: 'topic-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '继续做 eval plan' }] },
        { sessionId: 'topic-b', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: 'implementation eval 继续' }] },
      ],
    }),
    projectIdentity: 'project:/repo/agent-wiki-lab',
    memberNeedGate: () => ({ hit: false, ordinals: [], reason: 'topic-only, no reusable role need', adapterKind: 'test-semantic-gate', semanticClaim: true }),
    candidateExtractor: () => ({ extractorRun: true, adapterKind: 'test-semantic-extractor', semanticClaim: true, proposals: [], zeroProposalReason: 'no reusable role need' }),
  });

  assert.equal(result.profileCandidates.candidates.length, 0);
  assert.equal(result.pipelineDiagnostics.discoveryCompleted, true);
  assert.equal(result.pipelineDiagnostics.gateDiagnostics.gateRun, true);
  assert.equal(result.pipelineDiagnostics.zeroCandidateKind, 'semanticZeroCandidate');
});

it('classifies fail-closed zero-candidate as diagnostic-only, not semantic discovery', () => {
  const result = deriveMemberSessionColdStart({
    corpus: corpusFixture({
      sessions: [
        { sessionId: 'need-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '每次做 live eval 结论前都要先区分 retained、hermetic、live、product proof' }] },
      ],
    }),
    projectIdentity: 'project:/repo/agent-wiki-lab',
  });

  assert.equal(result.profileCandidates.candidates.length, 0);
  assert.equal(result.pipelineDiagnostics.zeroCandidateKind, 'diagnosticZeroCandidate');
  assert.equal(result.pipelineDiagnostics.gateDiagnostics.adapterKind, 'fail-closed-default');
});

it('does not count internal initiator marker-only rows as genuine scan messages', () => {
  const result = deriveMemberSessionColdStart({
    corpus: corpusFixture({
      sessions: [
        { sessionId: 'marker-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '<!-- OMO_INTERNAL_INITIATOR -->' }] },
        { sessionId: 'real-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '以后判断报告前先区分 proof tier' }] },
      ],
    }),
    projectIdentity: 'project:/repo/agent-wiki-lab',
  });

  assert.equal(result.scan.scanDiagnostics.genuineUserMessageCount, 1);
  assert.equal(result.scan.scannedMessages.some((message) => message.text.includes('OMO_INTERNAL_INITIATOR')), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/core/member-session-cold-start.test.mjs test/core/member-candidate-dreamer.test.mjs
```

Expected: FAIL because `deriveMemberSessionColdStart()` does not accept gate/extractor injection and still uses keyword windows.

- [ ] **Step 3: Add prompt contracts for non-keyword gate and extractor**

Create `src/core/member-need-prompts.mjs` with two exported builders:

- `buildMemberNeedGatePrompt({ lines })`
- `buildMemberCandidateExtractorPrompt({ window })`

`buildMemberNeedGatePrompt()` must instruct the model to flag reusable member/expert/team-role needs, not topic mentions. It must include negative examples for topic-only lines and workflow wrappers. It must require one-line output: `n` or `y: <ordinals>`.

`buildMemberCandidateExtractorPrompt()` must instruct the model to output JSON with:

```json
{
  "proposals": [
    {
      "memberName": "kebab-case-name",
      "role": "short role",
      "routingDescription": "when to use this member",
      "responsibilities": ["one", "two"],
      "evidenceRefs": [{ "ref": "session:...", "digest": "sha256:..." }],
      "whyReusable": "why this is not a one-off task",
      "negativeSignals": []
    }
  ]
}
```

The prompt must say zero proposals is valid. It must forbid fixed topic-to-name mappings and raw source quote copying.

- [ ] **Step 4: Implement extractor proposal schema**

Create `src/core/member-candidate-extractor.mjs` with:

- `normalizeExtractorProposal(proposal, window)`
- `buildManifestFromExtractorProposal({ proposal, window, projectIdentity })`
- `runDefaultMemberCandidateExtractor({ windows })` returning `{ extractorRun: true, adapterKind: 'fail-closed-default', proposals: [] }` when no host/model extractor is injected.

Rules:

- Proposal must include `memberName`, `role`, `routingDescription`, `responsibilities`, and `evidenceRefs`.
- Proposal evidence refs must be a subset of window message refs.
- Proposal text must pass existing raw quote/source overlap validation in `validateMemberCandidateManifest()`.
- Default extractor must not synthesize candidates from topics. It may return zero proposals honestly.
- A live report that uses `adapterKind: 'fail-closed-default'` may pass only as completed zero-candidate diagnostics; it must not be described as semantic candidate discovery.

- [ ] **Step 4a: Implement non-default adapter contract helpers**

Create `src/core/member-need-agent-adapters.mjs` with pure helpers that let the CLI/live runner retain adapter evidence without depending on a specific runtime yet:

- `createGateAdapterRecord({ adapterKind, prompt, rawOutput, parsedOutput, artifactRefs })`
- `createExtractorAdapterRecord({ adapterKind, prompt, rawOutput, parsedOutput, artifactRefs })`
- `adapterCanSupportSemanticClaim(record)` returning `true` only when `adapterKind !== 'fail-closed-default'` and input/raw/parsed artifact refs are present.

Tests must assert that fail-closed records cannot support semantic claims, while injected non-default records with artifact refs can.

- [ ] **Step 5: Replace keyword window ownership in `deriveMemberSessionColdStart()`**

Modify `src/core/member-session-cold-start.mjs`:

- Keep `createSessionCorpusScan()` and evidence hygiene.
- Render gate lines from scan messages.
- Call injected `memberNeedGate({ lines, scan, prompt })` when supplied; otherwise use a conservative default gate that returns `hit: false`, `adapterKind: 'fail-closed-default'`, and diagnostics `defaultGate: true` until a real model-backed adapter is supplied by the live runner or host integration.
- Build semantic windows from gate verdict.
- Pass windows to injected/default extractor.
- Build candidate manifests only from extractor proposals.
- Classify zero-candidate runs as `semanticZeroCandidate` only when both gate and extractor report `semanticClaim: true` and non-default adapter kinds. Otherwise classify as `diagnosticZeroCandidate`.
- Preserve explicit clean user-named member scaffolds only if existing tests require them, but mark them `dreamerExtractorRun: false` and do not let them satisfy semantic live discovery gates.
- Remove or quarantine the unnamed `review/check/inspect/audit` window path. If retained, it must be diagnostic-only and must not produce candidate proposals.

- [ ] **Step 6: Strengthen quality guard tests**

Update `test/quality/no-hardcoded-member-discovery.test.mjs` to fail if product discovery files contain:

- a primary unnamed-window regex built around `review|check|inspect|audit`;
- `roleFromWindow()` or `routingFromWindow()` used for accepted semantic candidates;
- `dreamerExtractorRun: true` on deterministic scaffolds;
- fixed topic role mapping.
- live semantic candidate pass when `adapterKind: 'fail-closed-default'`.

Do not fail on test fixture strings that explicitly contain these words.

- [ ] **Step 7: Run focused tests**

Run:

```bash
node --test \
  test/core/member-need-gate.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/core/member-candidate-dreamer.test.mjs \
  test/quality/no-hardcoded-member-discovery.test.mjs
```

Expected: PASS.

---

## Task 3: Live Eval Quality Contract For Gate, Extractor, And Host Validator

**Files:**

- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs` or existing aggregate eval tests

**Example:** observes Example 1, Example 2, Example 3, Example 4; preserves all invariants

**Interfaces:**

- Consumes Task 2's pipeline diagnostics.
- Produces live reports with `evidenceQuality.gateDiagnostics`, `evidenceQuality.extractorDiagnostics`, and stricter zero-candidate/candidate quality gates.
- Produces explicit semantic proof classification: `semanticCandidateDiscovery`, `semanticZeroCandidate`, or `diagnosticZeroCandidate`. Aggregate eval may pass diagnostic plumbing, but release evidence must not confuse it with semantic discovery effectiveness.

- [ ] **Step 1: Add failing live eval tests for diagnostic requirements**

Update `test/eval/member-session-cold-start-live-eval.test.mjs` with cases asserting:

- candidate pass requires `gateDiagnostics.gateRun === true`, `flaggedLineCount > 0`, `dreamerDiagnostics.extractorRun === true`, and `hostValidatorDiagnostics.acceptedCount > 0`;
- candidate pass requires non-default `gateDiagnostics.adapterKind` and non-default `extractorDiagnostics.adapterKind`;
- candidate pass requires retained gate/extractor `inputArtifactRef`, `rawOutputArtifactRef`, and `parsedOutputArtifactRef`;
- zero-candidate pass requires gate/extractor/host validator all ran and `candidateCount === 0`;
- zero-candidate pass may use fail-closed adapters only when the report explicitly says this is a completed diagnostic pass, not semantic discovery effectiveness proof;
- semantic zero-candidate pass requires non-default gate/extractor adapters and retained input/output refs, even when `candidateCount === 0`;
- a report cannot pass from legacy keyword diagnostics only;
- workflow wrapper input produces no candidate and records wrapper exclusions.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test test/eval/member-session-cold-start-live-eval.test.mjs test/eval/member-system-e2e.test.mjs
```

Expected: FAIL until reports and aggregate checks include the new diagnostics.

- [ ] **Step 3: Update live eval report quality gates**

Modify `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`:

- Add `gateDiagnostics` and `extractorDiagnostics` to `evidenceQuality`.
- Record `adapterKind`, input prompt artifact refs, parsed output refs, and parse/validation errors for gate and extractor.
- Record raw output artifact refs for gate and extractor. A parsed-only record is insufficient for semantic proof.
- Add `discoveryProofKind` with one of `semanticCandidateDiscovery`, `semanticZeroCandidate`, or `diagnosticZeroCandidate`.
- Candidate pass requires candidate evidence refs to resolve to allowed genuine evidence refs.
- Candidate pass must reject `roleRoutingSource: explicit-clean-user-identity-scaffold` for semantic discovery success unless the test specifically invokes explicit-name mode.
- Candidate pass must reject default/fail-closed adapters.
- Zero-candidate pass requires completed gate/extractor/host-validator diagnostics, not just an empty array.
- Keep `blocked` only for missing/unreadable external source or limited single-session source.

- [ ] **Step 4: Update aggregate eval gate**

Modify `scripts/context-tree/run-member-system-e2e-eval.mjs`:

- Require cold-start live reports to contain gate/extractor/host-validator diagnostics.
- Preserve `productObserved` separation.
- For `candidateCount: 0`, require a `zeroCandidateReason` generated after gate/extractor ran.
- For `candidateCount > 0`, require at least one candidate with non-default expert, valid evidence refs, and no workflow-wrapper/source-overlap failures.
- For `candidateCount > 0`, require non-default gate/extractor adapter evidence refs.
- Preserve the difference between `diagnosticZeroCandidate` and semantic discovery. Aggregate `coldStartLiveObserved.status: "pass"` may be true for diagnostic plumbing, but the report must expose `semanticDiscovery.status: "not-proven"` unless non-default adapter evidence exists.

- [ ] **Step 5: Run focused eval tests**

Run:

```bash
node --test \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/eval/member-system-e2e.test.mjs
```

Expected: PASS.

---

## Task 4: Final Hermetic + Agent-Wiki-Lab Live Eval Correction Loop

**Files:**

- Modify only if failures require it: files touched by Tasks 1-3
- Update if present: `.superpowers/sdd/progress.md`

**Example:** verifies Example 1, Example 2, Example 3, Example 4

- [ ] **Step 1: Run the focused cold-start/product test bundle**

Run:

```bash
node --test \
  test/core/member-need-gate.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/core/member-candidate-dreamer.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/eval/member-system-e2e.test.mjs \
  test/quality/no-hardcoded-member-discovery.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run hermetic retained cold-start eval**

Run:

```bash
npm run context-tree:eval-member-session-cold-start -- --out /tmp/context-tree-member-need-gate-hermetic
```

Expected: report exists at `/tmp/context-tree-member-need-gate-hermetic/member-session-cold-start-eval-report.json`. Existing retained explicit-name behavior may remain, but it must not be used as proof of semantic live discovery.

- [ ] **Step 4: Run non-default semantic positive proof**

Run a positive proof before the agent-wiki-lab corpus check. Use a hermetic or live-derived corpus with genuine user lines that express reusable member need without explicit member names or `review/check` keywords. The command may use a test/CLI non-default adapter, but it must retain gate/extractor prompt input, raw output, and parsed output artifacts.

Minimum command shape:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /tmp/context-tree-member-need-positive-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-need-gate-positive-proof \
  --gate-adapter fixture-semantic-gate \
  --extractor-adapter fixture-semantic-extractor
```

Expected:

- report path: `/tmp/context-tree-member-need-gate-positive-proof/member-session-cold-start-live-eval-report.json`;
- `discoveryProofKind: "semanticCandidateDiscovery"`;
- `candidateCount > 0`;
- `evidenceQuality.gateDiagnostics.adapterKind !== "fail-closed-default"`;
- `evidenceQuality.extractorDiagnostics.adapterKind !== "fail-closed-default"`;
- gate/extractor input, raw output, and parsed output artifact refs exist and point to files;
- accepted candidate evidence refs are genuine user lines and do not rely on fixed expected candidate name.

If this command cannot be supported by the existing CLI, the implementation is incomplete. Do not skip directly to an agent-wiki-lab `candidateCount: 0` diagnostic pass.

- [ ] **Step 5: Run agent-wiki-lab live cold-start eval**

If a fresh merged corpus does not exist, export or merge the `../agent-wiki-lab` sessions using existing scripts. Prefer the existing multi-session corpus path when available. Then run:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /tmp/context-tree-agent-wiki-lab-session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-member-need-gate-live \
  --max-correction-attempts 3
```

Expected:

- report path: `/tmp/context-tree-agent-wiki-lab-member-need-gate-live/member-session-cold-start-live-eval-report.json`;
- `mode: "live"`;
- `source: "session-corpus-export"`;
- `evidenceQuality.gateDiagnostics.status: "pass"`;
- `evidenceQuality.extractorDiagnostics.status: "pass"`;
- `evidenceQuality.pipelineDiagnostics.status: "pass"`;
- if `candidateCount > 0`, every accepted candidate has genuine evidence refs, non-default gate/extractor adapter refs, and no wrapper/topic-only/source-overlap failures;
- if `candidateCount === 0` with non-default adapters, report `discoveryProofKind: "semanticZeroCandidate"` and state that gate/extractor/host-validator completed and found no stable member need;
- if `candidateCount === 0` with fail-closed adapters, report `discoveryProofKind: "diagnosticZeroCandidate"` and do not claim semantic discovery effectiveness.

- [ ] **Step 6: Run aggregate eval with the live report**

Run:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-system-member-need-gate-live \
  --cold-start-live-report /tmp/context-tree-agent-wiki-lab-member-need-gate-live/member-session-cold-start-live-eval-report.json
```

Expected:

- aggregate report: `/tmp/context-tree-member-system-member-need-gate-live/member-system-e2e-report.json`;
- `verdict: "pass"`;
- `coldStartLiveObserved.status: "pass"`;
- `semanticDiscovery.status` reflects the live report proof kind and is not `"pass"` for fail-closed diagnostic-only runs;
- `productObserved.status: "not-run"` unless a product root is explicitly supplied.

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, exact failing gate, and candidate/evidence refs.
2. Classify the root cause: evidence hygiene defect, gate defect, extractor defect, HostValidator defect, eval/report defect, environment/transient failure, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn wrapper/topic-only evidence into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original failing live or aggregate command. Expected: PASS, or the same honest external blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying candidate, source refs, gate diagnostics, or quality gates did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human design decision is needed, or an external source/exporter prerequisite is unavailable.

- [ ] **Step 8: Record final status**

If `.superpowers/sdd/progress.md` is being used for this workstream, append:

- focused test command and result;
- full test result;
- live report path and status;
- aggregate report path and verdict;
- whether live result produced candidates or completed with `candidateCount: 0`;
- whether the live gate/extractor used non-default adapters or fail-closed diagnostic adapters;
- whether semantic discovery was proven by `semanticCandidateDiscovery` or `semanticZeroCandidate`, or only diagnostic plumbing was proven by `diagnosticZeroCandidate`;
- any open product proof boundary.

---

## Self-Review Notes

- This plan intentionally does not implement segment-level `<user-task>` extraction. It keeps wrapper material out of evidence and leaves task-payload extraction for a later design because re-admitting wrapper payload too early would reopen the v0 false-positive class.
- This plan intentionally allows `candidateCount: 0` when the gate/extractor/validator completed. The goal is semantic discovery quality, not forcing a candidate from every corpus. However, candidate-positive discovery proof requires non-default gate/extractor adapters; fail-closed adapters can only prove hygiene and diagnostic plumbing.
- This plan does not alter explicit product invocation. Product proof remains the observed parent-call transcript/finalizer path from earlier plans.
