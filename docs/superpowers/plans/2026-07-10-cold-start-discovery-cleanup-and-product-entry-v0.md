# Cold Start Discovery Cleanup and Product Entry V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理 cold-start discovery 中的 hardcoded member vocabulary / shallow pattern shortcut / synthetic transcript pollution；参考 Magic Context 的 retrospective/dreamer pipeline，把 cold-start 从“关键词命中 demo”升级为“真实 session evidence → role-need window → candidate manifest → host validation → suggested expert”的产品路径；同时保留并验证最小产品入口 `invoke-member` + parent-call transcript + fresh product aggregate proof。

**Architecture:** 本计划不改变已经证明的 product invocation/finalizer 主链路；它修的是 cold-start discovery 质量和产品入口封装。核心原则：产品路径不能内置 `skill-designer` / `eval-runner` / `telemetry-reviewer` 等候选答案表，也不能内置 `eval/proof/report/graph/...` 这类固定 topic vocabulary 来决定会产生什么 member；不能把 handoff/system-reminder/tool output 当真实用户证据，不能用 regex 命中直接冒充 member discovery。Regex 只允许作为 cheap candidate-window prefilter；最终 `MemberProfileCandidate` 必须走三层边界：`RoleNeedWindow`（可由 deterministic/pattern prefilter 建立，但不能凭固定领域词表定名/定角色）→ `MemberCandidateManifest`（dreamer-shaped, source-backed）→ `HostValidator`（唯一能提升为候选 Expert 的地方）。用户确认/重命名/加入已有 Expert/丢弃仍通过 Workbench/setup-import 或 agent-mediated mutation，不在 cold-start 中自动 durable 写入。

**Non-goals / proof boundaries:**

- 本计划不允许用 fixed topic vocabulary 伪装成 Dreamer。Deterministic V0 只能做证据清洗、窗口切分、source coverage 统计、显式 member mention/import/run corroboration 处理；对未命名 role 的语义归纳必须走 dreamer-shaped extractor。真实 session corpus 可用时，`candidateCount: 0` 既不是可接受 fallback，也不天然是 implementation failure；它必须出现在一个已完成的 discovery pass 中，并由 dreamer/host-validator 诊断说明为什么没有形成候选。不要新增 `no-candidate` 状态。
- 本计划不把 explicit product invocation 里的 `skill-designer` 当作 discovery 结果；那是显式选择的 member，用来验证产品入口链路。
- 本计划不把 retained fixture、自报告 invocation artifact、Workbench render 当 product proof；fresh product proof 仍必须来自 observed parent-call transcript + finalizer + aggregate eval。

**Magic Context references to inspect before coding:**

- `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/retrospective-raw-provider.ts`
- `ref/magic-context/packages/pi-plugin/src/dreamer/retrospective-raw-provider-pi.ts`
- `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/retrospective-learnings.ts`
- `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/task-prompts.ts`
- `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/task-registry.ts`

Borrow these patterns:

- root project session filtering;
- genuine typed user text extraction;
- synthetic/tool-output exclusion;
- bounded oldest-first scan;
- watermark / overlap / truncation frontier;
- cheap gate before expensive extraction;
- host apply validation, idempotence, raw-quote/source-overlap rejection.

Do **not** copy:

- Magic Context project/user memory taxonomy as member profile taxonomy;
- direct memory write as cold-start confirmation;
- any fixed member-name vocabulary.

## Global Constraints

- Do not add `nameSource` / name provenance fields in this slice.
- Remove hardcoded member-name discovery from product/live cold-start code.
- Remove hardcoded topic/role discovery from product/live cold-start code. Disallow constants such as `CLUSTER_TERMS = ['eval', 'proof', ...]` or mappings such as `graph + evidence -> graph-reviewer`.
- Fixture tests may mention explicit member names only when the fixture user text explicitly contains those names.
- Product/live cold-start eval must not assert a fixed candidate name.
- Product/live cold-start eval must not pass from pattern/regex evidence alone.
- Product/live cold-start eval must not pass from fixed topic vocabulary alone.
- `MemberProfileCandidate.defaultExpert` remains `false`.
- Candidate extraction alone does not confirm, sync, or invoke a member.
- Product invocation proof remains explicit member activation, not native spawn.
- Workbench display remains product UI, not proof source.
- No commits unless user explicitly asks.

---

## Concrete Examples

### Example 1: Hardcoded Vocabulary Is Gone

- **Example:** Search product source for `KNOWN_MEMBER_NAMES`, `eval-runner`, `telemetry-reviewer`, and `skill trigger -> skill-designer` style mappings.
- **Expected result:** Product cold-start code has no fixed candidate-name list or topic-to-member mapping. Tests may keep explicit fixture names only in test data.
- **Failure signal:** `src/core/member-session-cold-start.mjs` or related product code contains a candidate answer table.

### Example 2: Synthetic Handoff Text Does Not Create Candidate Evidence

- **Example:** A real session contains `[search-mode]`, `/handoff`, `<system-reminder>`, `OMO_INTERNAL_INITIATOR`, background task messages, and long handoff summaries mentioning eval/proof repeatedly.
- **Expected result:** These are excluded or marked non-genuine and cannot satisfy root-user evidence. The scan report records exclusion counts/reasons.
- **Failure signal:** A candidate is created mainly from handoff/system-reminder/background task text.

### Example 3: Role Cluster Produces Suggested Expert Without Fixed Name Assertion

- **Example:** Multiple genuine root user messages repeatedly ask to review eval reports, proof tiers, and correction-loop closure.
- **Expected result:** Cold-start creates at least one `MemberProfileCandidate` with role/routing/responsibilities/evidence refs, `defaultExpert: false`, and enough root session evidence. The exact `memberName` is not asserted in live eval.
- **Failure signal:** Live eval passes because the name equals a preset expected name, or because regex matched `eval` in synthetic text.

### Example 3a: User-Role Tool/Search Output Is Not Genuine Evidence

- **Example:** A root user-role row contains raw Tavily/search JSON, pasted browser results, file output, stdout/stderr, stack traces, or tool-result shaped blocks. This can happen when a runtime stores handoff/search/tool material inside the parent transcript with `role: "user"`.
- **Expected result:** The scan may retain source refs and digests for diagnostics, but the material is not counted as `genuineUserEvidence`, cannot appear in accepted candidate `evidenceRefs`, and increments an excluded diagnostic such as `excludedToolOutputCount` or `excludedSearchOutputCount`.
- **Failure signal:** A ref such as `session:15793a6b-5e20-4919-9afe-c2e99606fdc5:message:130` containing raw Tavily/search JSON is marked `evidenceSourceKind: "genuine-user-message"` and helps an accepted candidate satisfy source coverage.

### Example 3b: Rejected Regex-Only Windows Are Healthy Diagnostics

- **Example:** The corpus produces weak regex/pattern windows such as `user`, `for-human-in-the-loop`, or `graph-source-reviewer`, and the host validator rejects them as regex-only or insufficiently grounded.
- **Expected result:** `noRegexOnlyPass` remains `pass` as long as no accepted candidate depends on regex-only evidence. Rejected regex-only windows are recorded as diagnostics, not as a release-blocking failure.
- **Failure signal:** Live eval fails solely because rejected regex-only windows exist, even though the accepted candidate has source-backed role/routing grounding.

### Example 4: Fresh Product Entry Still Passes

- **Example:** In an OpenCode parent session rooted at `/home/prosumer/agent/agent-wiki-lab`, parent agent invokes a member via product entry; exporter observes the parent-visible command/result; finalizer writes fresh product root; aggregate eval passes with fresh product root.
- **Expected result:** `productObserved.status: "pass"`, `freshProductRoot: true`, native spawn fields remain false/not-run, and cold-start discovery returns `pass` with source-backed dreamer/host-validator diagnostics. The pass may contain zero or more candidates; zero candidates is represented by `candidateCount: 0`, not by a separate `no-candidate` status. Explicit invocation proof and cold-start discovery are separate gates; the former cannot substitute for the latter in this plan.
- **Failure signal:** retained fixture root or self-reported `invoke-member` output alone satisfies product proof.

---

## Task 0: Preflight and Reference Review

**Files:** Read-only unless runbook notes need correction.

- [ ] **Step 1: Inspect current tainted surfaces**

Run:

```bash
rg -n "KNOWN_MEMBER_NAMES|skill trigger|superpowers skill|eval-runner|telemetry-reviewer|roleForMember|Evaluation runner|Skill design reviewer|memberName\\s*!==\\s*['\\\"]skill-designer" \
  src/core src/adapters scripts/context-tree test/core test/eval test/adapters test/cli \
  --glob '!**/node_modules/**'
```

Classify hits:

- product cold-start/discovery/validator path: must be removed or generalized;
- fixtures/tests with explicit user mention: allowed;
- explicit product invocation fixtures: allowed where the route explicitly uses a chosen member.

Do not use a repo-wide `skill-designer` grep as a quality gate. Historical plans, contracts, fixtures, and explicit invocation scenarios are allowed to mention concrete member names; the gate exists to prevent product discovery code from containing answer tables.

- [ ] **Step 2: Inspect Magic Context reference**

Run:

```bash
sed -n '1,360p' ref/magic-context/packages/plugin/src/features/magic-context/dreamer/retrospective-raw-provider.ts
sed -n '1,220p' ref/magic-context/packages/pi-plugin/src/dreamer/retrospective-raw-provider-pi.ts
sed -n '1,260p' ref/magic-context/packages/plugin/src/features/magic-context/dreamer/retrospective-learnings.ts
rg -n "FRICTION_GATE|RETROSPECTIVE|readRetrospectiveScanWindow|extractGenuineUserText|synthetic|source_overlap|raw_quote" \
  ref/magic-context/packages/plugin/src/features/magic-context/dreamer \
  ref/magic-context/packages/plugin/src/hooks \
  ref/magic-context/packages/pi-plugin/src/dreamer
```

Implementation report must list which parts were copied/adapted vs rewritten.

---

## Task 1: Purge Hardcoded Member Discovery and Add Guard Tests

**Files:**

- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `src/adapters/explicit-member-parent-call-record.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`
- Modify: `test/adapters/explicit-member-parent-call-record.test.mjs`
- Modify: `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`
- Create: `test/quality/no-hardcoded-member-discovery.test.mjs`

**Example:** implements Example 1.

- [ ] **Step 1: Add quality guard test**

Create `test/quality/no-hardcoded-member-discovery.test.mjs`.

It must scan only product cold-start/discovery/validator files, not all docs or historical plans. Minimum scan set:

- `src/core/member-session-cold-start.mjs`;
- `src/core/member-candidate-dreamer.mjs` when created;
- `src/core/opencode-session-corpus-export.mjs`;
- `src/adapters/explicit-member-parent-call-record.mjs`;
- `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`;
- `scripts/context-tree/run-member-system-e2e-eval.mjs`;
- product-facing cold-start tests that should enforce invariants.

It must fail if those product paths contain:

- `KNOWN_MEMBER_NAMES`;
- `CLUSTER_TERMS`, `TOPIC_TERMS`, `ROLE_TERMS`, or equivalent fixed topic vocabulary used to generate member names/roles;
- hardcoded discovery mapping from `superpowers skill` / `skill trigger` to `skill-designer`;
- hardcoded role map `eval-runner -> Evaluation runner`;
- hardcoded topic-role map such as `eval/proof/report -> eval-reviewer` or `graph/evidence -> graph-reviewer`;
- `memberName !== 'skill-designer'` product validator invariant.

Allowed exceptions:

- `fixtures/`;
- `test/` fixture input strings where the user explicitly says the name;
- explicit product invocation fixtures/configs where the caller selected a member;
- docs/contracts/historical plans are not part of this guard.

- [ ] **Step 2: Remove hardcoded cold-start vocabulary**

Implementation rules:

- Delete `KNOWN_MEMBER_NAMES`.
- Delete fixed topic vocabulary such as `CLUSTER_TERMS = ['eval', 'proof', 'report', ...]` from product/live discovery.
- Delete topic-to-member rules such as `skill trigger -> skill-designer`.
- Delete fixed `roleForMember()` mappings in live/product extraction.
- Keep only:
  - normalization;
  - generic blacklist for obvious non-member references (`docs`, `src`, `test`, `v1`, `app`, etc.);
  - explicit mentions from user-authored text, e.g. `@eval-reviewer`, `let eval reviewer review`, `让 eval reviewer 审查`;
  - generic structure detectors that identify possible windows without naming the role, such as repeated correction/delegation/review intent, multi-session recurrence, or import/run corroboration.

For unnamed role discovery, deterministic code may decide **whether a source-backed window exists**, but it must not decide **what the member is called** or **which domain the role represents** from a fixed topic list. That naming/role/routing proposal belongs to the dreamer-shaped extractor output plus host validation.

- [ ] **Step 3: Generalize explicit parent call validator**

`parseParentCallRecord` / `validateParentCallRecord` must not require `memberName === "skill-designer"` globally.

Use one of:

```js
validateParentCallRecord(record, { expectedMemberName })
```

or:

```js
parseParentCallRecord(record, { expectedMemberName })
```

Rules:

- If `expectedMemberName` is provided, require exact match.
- If not provided, require non-empty kebab-case member name and resolved member id.
- Existing fixture tests should pass `expectedMemberName: "skill-designer"` when they need that invariant.

- [ ] **Step 4: Run focused tests**

```bash
node --test \
  test/quality/no-hardcoded-member-discovery.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/adapters/explicit-member-parent-call-record.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs
```

---

## Task 2: Magic-Context-Style Genuine Session Scan

**Files:**

- Modify: `src/core/opencode-session-corpus-export.mjs`
- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `test/core/opencode-session-corpus-export.test.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`

**Example:** implements Example 2.

- [ ] **Step 1: Add failing tests for synthetic filtering**

Tests must cover exclusion of:

- `<system-reminder>`;
- `[BACKGROUND TASK COMPLETED]`;
- `[ALL BACKGROUND TASKS COMPLETE]`;
- `<auto-slash-command>`;
- `/handoff` generated summaries;
- `<!-- OMO_INTERNAL_INITIATOR -->`;
- assistant/tool output text;
- synthetic OpenCode parts.
- raw Tavily/search result JSON or browser/search-output shaped text stored under a user-role row;
- pasted file-output/stdout/stderr/stack-trace shaped blocks stored under a user-role row.

These may be recorded as excluded diagnostics but cannot count as `genuineUserEvidence`.

- [ ] **Step 2: Implement genuine user text extraction**

Mirror Magic Context’s `extractGenuineUserText()` idea. This must primarily happen at the corpus exporter boundary, not as a late cold-start cleanup pass. If `opencode-session-corpus-export` has already flattened assistant/tool output into `message.text`, later discovery code cannot reliably prove the evidence was genuine user text.

- only user role;
- only non-synthetic text parts;
- strip/ignore system-reminder and auto-slash-command blocks;
- ignore raw tool output;
- classify user-role text that structurally looks like tool/search/file output as non-genuine before candidate evidence is built;
- keep source refs and digests for excluded material.
- do not concatenate assistant/tool output into user message text;
- if tool rows are useful for diagnostics, retain only metadata/digests, not raw output content, and never count it as candidate evidence.

Do not equate `role === "user"` with `evidenceSourceKind: "genuine-user-message"`. A runtime can store generated search/tool/file material in a user-role row after handoff, shell capture, or pasted transcript. Classification must inspect source metadata when present and content shape when metadata is missing.

Minimum content-shape rejects:

- Tavily/search JSON keys such as `query`, `results`, `title`, `url`, `content`, `score`, `raw_content` in a JSON object/array dominated by search-result entries;
- repeated URL/title/content result blocks;
- stdout/stderr/tool-result labels;
- stack traces and traceback blocks;
- file-output/write/apply-patch shaped blobs;
- fenced machine-output blocks where the surrounding user text does not contain a natural-language instruction.

Cold-start scan report should include:

```json
{
  "scanDiagnostics": {
    "genuineUserMessageCount": 0,
    "excludedSyntheticCount": 0,
    "excludedHandoffCount": 0,
    "excludedToolOutputCount": 0,
    "excludedSearchOutputCount": 0
  }
}
```

Use the original four field names in `scan.scanDiagnostics` for compatibility. `excludedSearchOutputCount` may be added, but search/browser/file-output shaped material must at minimum be counted under `excludedToolOutputCount` so existing gates can fail closed.

Accepted candidate evidence refs must resolve to scan messages with:

```json
{ "evidenceSourceKind": "genuine-user-message" }
```

and must also pass content-shape checks. A ref containing raw Tavily/search JSON must fail before or during manifest validation; it must not be accepted and then discovered only by aggregate eval.

- [ ] **Step 3: Preserve and prove bounded scan semantics**

Do not regress:

- root session filtering;
- subagent/hidden exclusion;
- oldest-first capped scan;
- watermark;
- overlap;
- truncation frontier;
- selected user-message part scan only.

Add explicit tests for:

- `priorWatermark` excludes older messages from the since/evidence portion;
- overlap messages may be included as context but must not advance the watermark or satisfy repeated-evidence thresholds by themselves;
- global message cap records `truncationFrontier` before the first dropped message;
- per-session cap records `truncationFrontier` / saturation and does not advance the watermark past unread siblings;
- excluded subagent/hidden sessions appear in diagnostics but cannot supply candidate evidence.

- [ ] **Step 4: Run focused tests**

```bash
node --test \
  test/core/opencode-session-corpus-export.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs
```

---

## Task 3: Role-Need Gate and Candidate Manifest Extraction

**Files:**

- Create: `src/core/member-candidate-dreamer.mjs`
- Modify: `src/core/member-session-cold-start.mjs`
- Create: `test/core/member-candidate-dreamer.test.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`

**Example:** implements Example 3.

**Interfaces:**

```js
export function buildMemberNeedWindows({ scan }) {}
export function buildMemberCandidateManifest({ window }) {}
export function validateMemberCandidateManifest(input) {}
export function manifestToMemberProfileCandidate(manifest) {}
```

Required boundary:

```text
genuine session scan
  -> buildMemberNeedWindows()        // cheap deterministic/pattern prefilter only
  -> buildMemberCandidateManifest()  // dreamer-shaped source-backed role proposal
  -> validateMemberCandidateManifest()
  -> manifestToMemberProfileCandidate()
```

Only the final `manifestToMemberProfileCandidate()` output may enter `profileCandidates`. A regex/pattern match, a role-need window, or an unvalidated manifest is not a candidate.

- [ ] **Step 1: Add tests for role-need windows**

Tests must prove:

- regex/patterns only create windows, not final members;
- fixed topic vocabularies are rejected by quality tests and cannot create unnamed role candidates;
- repeated genuine root evidence is required;
- subagent-only evidence creates no candidate;
- docs-only creates no candidate/default Expert;
- synthetic/handoff evidence creates no candidate;
- tool/search/file-output shaped user-role evidence creates no accepted candidate evidence;
- explicit user-named member can produce that name;
- generated role cluster can produce a candidate only when supplied by a dreamer-shaped extractor output or explicit import/run corroboration, not by hardcoded topic words.

- [ ] **Step 2: Implement Magic-Context-style window + dreamer-shaped extractor boundary**

V0 may keep deterministic pieces, but only for evidence hygiene and cheap gating. It must be explicitly documented as a conservative fallback, not as equivalent to the full Magic Context Dreamer. It must be shaped like Magic Context’s host-applied dreamer output:

```json
{
  "manifestKind": "member-profile-candidate-manifest",
  "memberName": "kebab-case-generated-or-explicit",
  "role": "short role label",
  "routingDescription": "when to use this member",
  "responsibilities": ["..."],
  "evidenceRefs": [],
  "evidenceCoverage": {
    "rootSessionCount": 2,
    "messageCount": 4
  },
  "confidence": 0.0,
  "negativeSignals": []
}
```

No `nameSource` field in this slice.

Implementation guidance:

- Explicit names:
  - if genuine user text explicitly says `@name` or names a role in a delegation phrase, normalize it.
- Unnamed/generated names:
  - do not derive names from a fixed vocabulary such as eval/proof/report/graph/evidence.
  - do not use a deterministic domain keyword table to turn repeated text into `*-reviewer`.
  - use one of two paths only:
    1. dreamer-shaped extractor output that reads the window and proposes `memberName`, `role`, `routingDescription`, and `responsibilities`; or
    2. explicit import/run corroboration that already carries a proposed member identity.
  - if neither path is implemented, the plan is incomplete; do not invent a member and do not close live cold-start by merely reporting zero candidates when the session corpus is available.
- Role/routing:
  - summarize responsibilities from evidence windows.
  - avoid raw user quote copying.
  - do not copy long source phrases; apply source-overlap/raw-quote rejection like Magic Context.

- [ ] **Step 3: Host validator**

Reject candidate manifest when:

- evidence refs are empty;
- root-session count below threshold and no import/run corroboration;
- evidence is synthetic/handoff-only;
- any accepted evidence ref resolves to tool/search/file-output shaped material, even if the runtime stored it with role `user`;
- `memberName` is a generic blocked term;
- role/routing are empty;
- manifest is mostly raw quote, date/session-local wording, or high source-overlap;
- manifest was produced solely from regex terms without source-backed responsibility/routing summary;
- manifest was produced from a fixed topic vocabulary rather than dreamer-shaped extraction or explicit import/run identity;
- candidate would become `defaultExpert: true`.

Rejected regex-only or weakly grounded windows must remain visible in validation diagnostics, but they must not make the entire live eval fail when they are correctly rejected. `noRegexOnlyPass` means: **no accepted candidate passed using regex-only evidence**. It does not mean: **the corpus produced zero rejected regex-only windows**.

- [ ] **Step 4: Run focused tests**

```bash
node --test \
  test/core/member-candidate-dreamer.test.mjs \
  test/core/member-session-cold-start.test.mjs
```

---

## Task 4: Re-run Agent-Wiki-Lab Cold-Start Live Eval With Quality Gates

**Files:**

- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs`

**Example:** implements Examples 2 and 3.

- [ ] **Step 1: Update live eval gates**

Live cold-start pass conditions:

- `mode: "live"`;
- `source: "session-corpus-export"`;
- at least one candidate;
- `defaultExpert: false`;
- candidate has role/routing/responsibilities;
- candidate has >= 2 root session refs or explicit import/run corroboration;
- counted evidence excludes synthetic/handoff/tool-output text;
- counted evidence excludes tool/search/file-output shaped material stored under user-role rows;
- report contains excluded subagent/synthetic diagnostics;
- report contains candidate manifest validation status / rejection reasons;
- no candidate can pass from regex/pattern evidence alone;
- no candidate can pass from fixed topic vocabulary alone;
- no fixed candidate name assertion;
- `noRegexOnlyPass` inspects accepted candidate manifests only. Rejected regex-only windows are expected diagnostics and do not fail the gate.

Add a regression fixture based on the observed failure shape:

- accepted candidate name may be arbitrary, for example `ai-agents`;
- one candidate evidence ref contains raw Tavily/search JSON such as `session:15793a6b-5e20-4919-9afe-c2e99606fdc5:message:130`;
- expected result before the fix is `candidateEvidenceRefsAreGenuine.status: "fail"` and `countedEvidenceExcludesNonGenuine.status: "fail"`;
- expected result after the fix is that this ref is excluded before acceptance, and the dreamer-shaped extractor still attempts to derive candidates from the remaining genuine source-backed windows.

Add a separate regression fixture where rejected windows include names like `user`, `for-human-in-the-loop`, and `graph-source-reviewer`. Expected: the rejected entries are retained, but `evidenceQuality.noRegexOnlyPass.status` is `pass` unless the accepted candidate itself has `negativeSignals: ["regex-only"]` or non-source-backed summary.

Add a quality regression for the observed `candidateCount: 0` after pollution cleanup:

- It is not acceptable for the implementation to recover candidates by reintroducing fixed `CLUSTER_TERMS` such as `eval/proof/report`.
- It is also not acceptable to stop at `candidateCount: 0` merely because deterministic extraction found no fixed topic/member hit. Implement the Magic-Context-style extractor boundary: pass source-backed windows to a dreamer-shaped summarizer, validate its manifest, and reject raw quote/source-overlap/fixed-vocabulary outputs.
- `candidateCount: 0` is allowed only inside a `pass` report where the dreamer-shaped extractor and host validator completed and recorded source-backed diagnostics explaining why no stable member role need was promoted. It is not an acceptable fallback for missing unnamed-role extraction.
- The live report should distinguish `no role-need window found`, `window found but no dreamer extractor available`, and `manifest rejected by host validator`; do not collapse all three into only `no session-derived profile candidate found`.

- [ ] **Step 2: Re-run real agent-wiki-lab cold-start**

Use the existing merged export or regenerate it after exporter changes:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-cold-start-live-clean
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /tmp/context-tree-agent-wiki-lab-merged-session-export/session-corpus-export.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-cold-start-live-clean \
  --max-correction-attempts 3
```

Expected: with the current `agent-wiki-lab` corpus, the cold-start discovery pipeline must pass without hardcoded member names or fixed topic vocabularies. A passing result may contain accepted candidate(s), or it may contain `candidateCount: 0` with completed dreamer/host-validator diagnostics. Missing unnamed-role extraction is an implementation failure; a completed zero-candidate discovery pass is not.

- [ ] **Step 3: Aggregate with previous fresh product root**

If a fresh product root is available:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-agent-wiki-lab-member-system-clean-cold-start \
  --product-root /tmp/context-tree-agent-wiki-lab-product-root-rooted-20260710T070210Z \
  --cold-start-live-report /tmp/context-tree-agent-wiki-lab-cold-start-live-clean/member-session-cold-start-live-eval-report.json \
  --require-fresh-product-root
```

Expected:

- productObserved remains pass;
- coldStartLiveObserved must pass as a discovery pipeline for this cold-start/product polish slice when the real `agent-wiki-lab` corpus is available. Pass may mean accepted candidate(s), or `candidateCount: 0` with completed dreamer/host-validator diagnostics;
- fail closed if candidate evidence is polluted or fixed-vocabulary based;
- do not weaken product proof or reintroduce hardcoded shortcuts to force a pass.

---

## Task 5: Minimal Product Entry Polish and Live Eval Task

**Files:**

- Create: `scripts/context-tree/ctree.mjs`
- Create or modify: `src/core/context-tree-project-state.mjs`
- Create or modify: `src/install/opencode-member-instructions.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/invoke-member.mjs`
- Modify: `scripts/context-tree/finalize-invoke-member-product-root.mjs`
- Modify: `scripts/context-tree/install-member-projections.mjs`
- Modify: `scripts/context-tree/run-member-setup-import.mjs`
- Modify: `scripts/context-tree/render-member-workbench.mjs`
- Create: `test/cli/ctree-cli.test.mjs`
- Create or modify: `test/core/context-tree-project-state.test.mjs`
- Create or modify: `test/install/opencode-member-instructions.test.mjs`
- Modify: `test/cli/invoke-member-cli.test.mjs`
- Modify: `test/cli/finalize-invoke-member-product-root-cli.test.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`
- Modify: `test/cli/run-member-setup-import-cli.test.mjs`
- Modify: `test/cli/render-member-workbench-cli.test.mjs`
- Modify: `docs/codex-native-spawn-acceptance-runbook.md` only if the final product-entry command changes existing documented invocation commands

**Example:** implements Example 4.

- [ ] **Step 0: Product polish scope is explicit**

This task must close the minimal product entry polish, not only the eval plumbing:

1. `ctree` CLI/bin: `setup`, `doctor`, `members invoke`, `members import`, `workbench`.
2. Project state layout under the target project: `.context-tree/registry.json`, `.context-tree/runs/`, `.context-tree/imports/`, `.context-tree/mutations.jsonl` or equivalent mutation log.
3. Agent-facing instruction installer, OpenCode first: install/update runtime instructions that explain when and how the parent agent should call members.
4. Workbench setup/import: show cold-start candidates and support Confirm / Rename / Add to existing Expert / Discard through the shared mutation API, then sync runtime projections.
5. Release eval: hermetic tests, OpenCode local live proof, retained regression, and explicit blocked states when runtime/session evidence is unavailable.

If any item is intentionally deferred, the final report must mark it `blocked` or `deferred` with a reason; do not imply product polish is complete.

- [ ] **Step 1: Add minimal product CLI aliases**

Expose these commands through a stable package bin named `ctree`:

```bash
ctree setup --project /home/prosumer/agent/agent-wiki-lab --runtime opencode
ctree doctor
ctree members import --project /home/prosumer/agent/agent-wiki-lab
ctree members invoke <memberName> --task <text> --project <path>
ctree members import --action <json> --candidates <path> --registry <path> ...
ctree workbench
```

Implementation contract:

- `scripts/context-tree/ctree.mjs` is a thin dispatcher only; it must not own member discovery, memory policy, product proof policy, or hidden routing.
- `ctree setup` initializes/validates project state layout and installs runtime projection/instructions for the selected runtime. V0 required runtime is OpenCode; Codex/Claude may be `not-implemented` without blocking OpenCode proof.
- `ctree members import` delegates to existing setup/cold-start/import commands and writes candidate artifacts, not confirmed durable members.
- `ctree members import --action ...` may delegate to `run-member-setup-import.mjs` for Confirm / Rename / Add to existing Expert / Discard. Do not add separate `confirm` / `rename` commands unless they fully pass through the required registry/candidate/source-ref inputs; avoid half-interactive mutation shortcuts in V0.
- `ctree members invoke` delegates to `scripts/context-tree/invoke-member.mjs`.
- `ctree workbench` delegates to `scripts/context-tree/render-member-workbench.mjs`.
- `ctree doctor` checks required scripts, package scripts, writable output path, and prints a JSON summary.
- `package.json` adds `"bin": { "ctree": "scripts/context-tree/ctree.mjs" }`.

Add `test/cli/ctree-cli.test.mjs` with deterministic tests for:

- unknown command exits non-zero with usage text;
- `ctree setup --help` documents project state layout and OpenCode instruction install;
- `ctree doctor --json` exits 0 and reports dispatcher wiring;
- `ctree members invoke --help` shows the delegated command shape without invoking a member;
- `ctree members import --help` says candidates remain unconfirmed;
- `ctree members import --help` documents that confirmation/rename/add-to-existing/discard require explicit setup-import action inputs and are not automatic durable writes;
- dispatcher tests must not require OpenCode/Codex/Claude live runtime.

- [ ] **Step 1a: Project state layout**

Implement or harden a single project-state resolver used by setup/import/invoke/workbench:

```text
<project>/.context-tree/
  registry.json
  runs/
  imports/
  mutations.jsonl
  projections/
  instructions/
```

Rules:

- `registry.json` is the confirmed member registry for the project.
- `imports/` stores cold-start/import candidate bundles and source manifests.
- `runs/` stores member invocation/product artifacts or stable refs to them.
- `mutations.jsonl` records Confirm / Rename / Add to existing Expert / Discard and memory/profile lifecycle mutations with source refs/digests.
- `projections/` and `instructions/` store generated runtime-facing files/manifests, or refs to runtime-native locations such as OpenCode `agents/`.
- Commands may still accept explicit `--out` for eval/debug, but product defaults should land under `.context-tree/`.

Tests must verify idempotent setup, no destructive overwrite of existing registry/mutation log, and stable path resolution from any current working directory.

- [ ] **Step 1b: Agent-facing instruction installer, OpenCode first**

Install/update OpenCode-facing instructions that tell the parent agent:

- what a member is;
- when to call `ctree members invoke`;
- how to choose a confirmed member from registry/projection routing descriptions;
- how to import cold-start candidates without confirming them automatically;
- how to explain durable Confirm / Rename / Add to existing Expert / Discard to the user before applying mutation;
- how to return the member result to the current parent-agent conversation.

This installer must not claim it can force the model to call members. It provides runtime instructions/projections only. Product proof still comes from observed parent-agent call transcripts.

Add deterministic tests that inspect the installed OpenCode instruction/projection text for:

- clear trigger language for member invocation;
- no hardcoded `skill-designer` discovery rule;
- no hidden authorization concept beyond normal subagent/tool-call style user-visible action;
- explicit statement that candidates remain unconfirmed until mutation.

- [ ] **Step 1c: Workbench setup/import sync projection**

Extend setup/import/workbench flow so after a candidate action:

- Confirm creates/updates confirmed registry entry and writes mutation log;
- Rename updates candidate identity and preserves evidence refs;
- Add to existing Expert records candidate evidence as pending profile notes for the target member;
- Discard records rejection reason/source refs;
- projection sync is run or clearly queued after registry-changing actions.

The Workbench surface should show candidates and actions, not proof-tier jargon. Tests should verify that Workbench and agent-mediated mutation path share the same mutation API/log.

- [ ] **Step 2: Product entry live eval**

Run in a real OpenCode parent session rooted at `/home/prosumer/agent/agent-wiki-lab`:

This product-entry proof may use an existing explicitly selected member such as `skill-designer`. That member name is not a cold-start discovery assertion and must not be used by cold-start live eval gates.

```bash
node /home/prosumer/agent/context-tree/scripts/context-tree/invoke-member.mjs \
  --member-name skill-designer \
  --task "Review the current product entry proof and return a concise verdict to the parent agent." \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-member-invocation-clean
```

Then export/finalize/aggregate:

```bash
npm run context-tree:export-opencode-parent-call-transcript -- \
  --db /home/prosumer/.local/share/opencode/opencode.db \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call-clean/observed-parent-call-transcript.json

npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root /tmp/context-tree-agent-wiki-lab-member-invocation-clean \
  --observed-parent-call-transcript /tmp/context-tree-agent-wiki-lab-parent-call-clean/observed-parent-call-transcript.json \
  --out /tmp/context-tree-agent-wiki-lab-product-root-clean

npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-agent-wiki-lab-member-system-clean-product \
  --product-root /tmp/context-tree-agent-wiki-lab-product-root-clean \
  --cold-start-live-report /tmp/context-tree-agent-wiki-lab-cold-start-live-clean/member-session-cold-start-live-eval-report.json \
  --require-fresh-product-root
```

Expected:

- `productObserved.status: "pass"`;
- `freshProductRoot: true`;
- `coldStartLiveObserved.status: "pass"` when the real `agent-wiki-lab` session corpus is available;
- `productObserved: pass` alone proves only the explicit invocation path and cannot close this cold-start/product-polish plan;
- cold-start discovery is the setup/import entry for this plan and must not be replaced by explicit invocation proof;
- no native spawn overclaim;
- self-reported `invoke-member` evidence alone does not pass without parent-call transcript.

- [ ] **Step 3: Product-polish OpenCode local live eval**

Run a live eval that covers the user-facing product polish flow, not only the existing invoke/finalize aggregate:

```text
ctree setup --project /home/prosumer/agent/agent-wiki-lab --runtime opencode
  -> verify .context-tree/ layout
  -> verify OpenCode instructions/projections install report
ctree members import --project /home/prosumer/agent/agent-wiki-lab
  -> verify cold-start candidate bundle under .context-tree/imports/
ctree members import --action <Confirm|Rename|Add to existing Expert|Discard json> ...
  -> verify shared mutation log under .context-tree/mutations.jsonl
  -> verify registry update or candidate status update
  -> verify projection sync or queued projection-sync report
ctree members invoke <confirmed-member> --task <text> --project /home/prosumer/agent/agent-wiki-lab
  -> run from a real OpenCode parent-agent session
  -> export observed parent-call transcript
  -> finalize product root
  -> aggregate eval
```

The report must include separate statuses:

- `setup.status: "pass" | "blocked" | "fail"`;
- `projectState.status: "pass" | "blocked" | "fail"`;
- `instructionInstall.status: "pass" | "blocked" | "fail"`;
- `coldStartImport.status: "pass" | "blocked" | "fail"` where `pass` may include `candidateCount: 0` only with completed dreamer/host-validator diagnostics, and `blocked` is valid only when session corpus input is unavailable;
- `setupImportAction.status: "pass" | "blocked" | "fail"` where `pass` may record that there is no candidate action to apply after a completed discovery pass, and `blocked` is valid only when input is unavailable;
- `projectionSync.status: "pass" | "blocked" | "fail"`;
- `memberInvoke.status: "pass" | "blocked" | "fail"`;
- `productObserved.status: "pass" | "blocked" | "fail"`.

With the real `agent-wiki-lab` session corpus available, cold-start import/action must pass through the Magic-Context-style extractor and host validator. Do not backfill with hardcoded candidates to force pass, and do not hide extractor absence as blocked or as a zero-candidate pass.

- [ ] **Step 4: If product-entry or product-polish live eval fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, product root path, observed parent-call transcript path, or exact exporter/finalizer error.
2. Classify the root cause: dispatcher wiring defect, project-state defect, instruction installer defect, setup/import mutation defect, projection sync defect, invocation artifact defect, parent-call exporter defect, finalizer/eval defect, environment/runtime mismatch, or unclear product requirement.
3. For dispatcher/state/installer/import/projection/invocation/finalizer/eval defects, write or update a failing regression test in the matching file from this task before changing implementation.
4. Implement the smallest fix at the root cause. Do not change aggregate gates to accept self-reported `invoke-member` evidence as product proof.
5. Rerun the focused test for the fixed layer. Expected: PASS.
6. Rerun the original live product-entry/product-polish command sequence. Expected: PASS, or the same honest blocked result if the runtime does not expose the required session evidence.
7. Compare new artifacts with the retained failure. If the observed product artifact did not change, do not claim the live product path is fixed.

- [ ] **Step 5: Release eval bundle**

Run and retain a release-style bundle covering:

- hermetic CLI/state/import/invocation tests;
- retained regression fixtures for product root and cold-start rejection/blocked cases;
- OpenCode local live proof for setup/project-state/instruction-install/import/setup-import-action/projection-sync/invoke/finalize/aggregate when real session evidence is available;
- explicit blocked states when OpenCode DB/session export/parent-call transcript is unavailable.

The final aggregate report must distinguish:

- `hermetic: pass`;
- `retainedRegression: pass`;
- `opencodeLocalLive: pass | blocked | fail`;
- `productPolishLive: pass | blocked | fail`;
- `productObserved: pass | blocked | fail`;
- `coldStartLiveObserved: pass | blocked | fail`.

Release readiness rule:

- `productObserved: pass` with a fresh observed parent-call product root proves the explicit member invocation path only.
- This plan is not complete unless cold-start discovery completes on the real available session corpus as `pass` with completed dreamer/host-validator diagnostics, regardless of whether `candidateCount` is zero or positive, or the report proves the runtime/session corpus input itself is unavailable. A blocked/fail caused by missing unnamed-role extraction or fixed-vocabulary rejection is an implementation failure for this plan.
- Cold-start discovery is part of the product polish release target here, not an optional follow-up.

---

## Task 5A: Magic-Context-Style Cold-Start Fix Loop

**Files:** Analysis first, then implementation. Do not stop at diagnosis when the real session corpus is available.

- Read/inspect: `/tmp/context-tree-agent-wiki-lab-cold-start-live-clean/member-session-cold-start-live-eval-report.json`
- Read/inspect: `/tmp/context-tree-agent-wiki-lab-ctree-member-system-product/member-system-e2e-report.json`
- Read/inspect: `src/core/member-session-cold-start.mjs`
- Read/inspect: `src/core/member-candidate-dreamer.mjs`
- Read/inspect: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Read/inspect: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Create/update: `.superpowers/sdd/task-5a-cold-start-failure-analysis.md`

**Goal:** Turn the current `agent-wiki-lab` live cold-start report into a completed discovery result by implementing the Magic-Context-style unnamed-role extraction path. The result may contain accepted candidate(s), or it may contain `candidateCount: 0` with completed diagnostics; it may not be missing-extractor fallback. Preserve the explicit product invocation pass, but do not treat it as a substitute for cold-start discovery.

- [ ] **Step 1: Classify the failing layer**

Check and record whether the failure is caused by:

- insufficient genuine root messages;
- role windows not being built;
- manifest validator rejection;
- session corpus selection/filtering being too strict;
- insufficient repeated role evidence in `agent-wiki-lab` itself;
- aggregate/product gate mismatch despite live report diagnostics.

For the known post-pollution-cleanup state, `candidateCount: 0` with `genuineUserMessageCount` around 169 and `excludedToolOutputCount` around 71 means the system has enough real input to run unnamed-role extraction. Treat the current result as an extractor gap unless a completed dreamer/host-validator pass proves the remaining genuine user text has no stable member role need.

- [ ] **Step 2: Inspect evidence counts and gate status**

Record at minimum:

- `sessionCorpusScan.scanDiagnostics.genuineUserMessageCount`;
- excluded synthetic/handoff/tool-output counts;
- included/excluded session counts;
- role window / candidate existence;
- `liveSessionDerivedCandidate.evidenceCoverage.rootSessionCount`;
- `liveSessionDerivedCandidate.sourceEvidenceSummary`;
- `candidateManifestValidation.accepted` and `.rejected` summary;
- `evidenceQuality.countedEvidenceExcludesNonGenuine.status`;
- `evidenceQuality.candidateEvidenceRefsAreGenuine.status`;
- aggregate `coldStartLiveObserved.reason`.

- [ ] **Step 3: Implement Magic-Context-style extractor, not a fallback**

Implement the missing unnamed-role path by following Magic Context's pattern:

- cheap gate identifies candidate windows from genuine user text without naming a domain from a fixed vocabulary;
- dreamer-shaped extractor receives bounded source windows and proposes `MemberCandidateManifest` with `memberName`, `role`, `routingDescription`, `responsibilities`, `evidenceRefs`, and `evidenceCoverage`;
- host validator applies raw-quote/source-overlap/date/frustration/non-genuine/fixed-vocabulary rejection;
- accepted output remains candidate-only, not confirmed/durable;
- rejected output is retained with reasons.

Do **not** restore `eval-runner`, `skill-designer`, `telemetry-reviewer`, `CLUSTER_TERMS`, or any fixed member-name/topic shortcut to recover a pass.

- [ ] **Step 4: Re-run live eval until pass or true external input block**

After implementing the extractor, rerun:

```bash
node --test test/core/member-candidate-dreamer.test.mjs test/core/member-session-cold-start.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs
```

Then rerun the real `agent-wiki-lab` cold-start live eval and aggregate eval. Completion requires `coldStartLiveObserved.status: "pass"` with completed dreamer/host-validator diagnostics, unless the session corpus/export itself is unavailable. If the extractor emits no candidate without such diagnostics while genuine root-user evidence is substantial, continue the correction loop; do not close the plan as blocked.

---

## Task 6: Final Verification

- [ ] **Step 1: Focused bundle**

```bash
node --test \
  test/quality/no-hardcoded-member-discovery.test.mjs \
  test/core/opencode-session-corpus-export.test.mjs \
  test/core/context-tree-project-state.test.mjs \
  test/core/member-candidate-dreamer.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/install/opencode-member-instructions.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/adapters/explicit-member-parent-call-record.test.mjs \
  test/cli/ctree-cli.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/run-member-setup-import-cli.test.mjs \
  test/cli/render-member-workbench-cli.test.mjs \
  test/cli/invoke-member-cli.test.mjs \
  test/cli/finalize-invoke-member-product-root-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs
```

- [ ] **Step 2: Full suite and static checks**

```bash
npm test
git diff --check
```

Run LSP diagnostics on changed `src/core`, `src/adapters`, `scripts/context-tree`, and changed tests.

- [ ] **Step 3: Artifact inspection**

Inspect:

- clean cold-start report;
- candidate manifests;
- role-need windows and manifest validation/rejection reasons;
- excluded synthetic/handoff diagnostics;
- watermark / overlap / truncation frontier diagnostics;
- `.context-tree/` project state layout and mutation log;
- OpenCode instruction/projection install report;
- Workbench setup/import action report;
- product-polish OpenCode local live eval report;
- product root finalizer summary;
- aggregate report.

Confirm:

- no hardcoded member discovery in product source;
- cold-start candidate is not confirmed/default;
- evidence is genuine root-user/session backed;
- regex/pattern matches appear only as window prefilters, not final candidate proof;
- fresh product proof remains valid;
- retained fixtures are not used as fresh proof.
- product polish items are either implemented or explicitly marked blocked/deferred.

- [ ] **Step 4: Final report**

Report:

```text
implemented:
- hardcoded member discovery purge
- genuine session scan
- role-need candidate manifest
- ctree CLI/bin
- project state layout
- OpenCode agent-facing instruction installer
- Workbench setup/import projection sync
- release eval bundle
- product-polish OpenCode local live eval
- clean agent-wiki-lab cold-start live eval
- minimal product entry live eval

verified:
- focused tests: <count>
- npm test: <count>
- git diff --check: clean

fresh evidence:
- cold-start clean report: <path>
- product root: <path>
- aggregate report: <path>

boundaries:
- no hardcoded candidate names
- no synthetic/handoff evidence counted
- no regex-only candidate
- explicit product invocation member name is not discovery evidence
- no native spawn claim
- no retained fixture as fresh proof
```
