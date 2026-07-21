# Codex Context Fork E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Context Tree v0 的第一个可执行证明：Codex-first capability eval harness + 最小树/manifest 模型，用重复 E2E canary 证明 context-bearing fork 的真实保真度边界。

**Architecture:** 先实现 capability eval，而不是产品 UI、知识库或文档化系统。实现分为四层：平台无关 graph/manifest、Codex app-server protocol/evidence adapter、capability runner/report、live harness。mock transport 只能证明 runner 语义；live transport 必须从 Codex app-server event、thread/turn read、rollout/ref、或测试 provider request capture 中获得证据，否则 verdict 必须是 `inconclusive`。

**Tech Stack:** Node.js 20+ ESM, `node:test`, `node:assert/strict`, newline-delimited JSON, Codex app-server JSON-RPC over stdio. 不引入运行时依赖。

## Global Constraints

- Context Tree v0 只做 Codex-first context-bearing fork 能力证明，不做文档化系统、知识库、prompt assembler、自动 branch suggestion 或产品 UI。
- `context` 不能等同于完整 transcript；报告必须区分 model-visible evidence、session/rollout record、prompt assembly/envelope 和 workspace state。
- adapter 总是使用当前平台可实现的最强路径；调用 schema 不暴露“偏好/最低/最强”这类保真度选择字段。
- summary-only 只能作为 negative control 或兼容降级，不能被标记为 Context Tree 成功路径。
- live eval 不能只看 reviewer 输出；若没有 request-level 或 rollout-level evidence，case verdict 必须是 `inconclusive`。
- product eval 必须在 capability eval 之后；本计划只实现 capability eval 和最小 graph registry，产品 workflow eval 仅保留 fixture 边界。
- 文件、git diff、未跟踪文件属于 workspace/environment state，不属于 context body；它们只能作为 target/evidence refs 进入 manifest。
- 不在真实用户会话上执行 destructive rollback；rollback case 必须基于 eval 创建的临时 thread 或 forked thread。
- 当前 workspace 可能不是 git repo；commit 步骤是可选收尾。如果 `git status` 返回 `not a git repository`，在 task log 记录 `Commit skipped: workspace has no initialized git repository.`。

---

## Concrete Examples

### Example 1: User 和 Assistant Canary 证明 native fork 继承父历史

- **Example:** eval 创建 parent thread，早期 user message 写入 `PROJECT_CODEWORD = CTREE-USER-<seed>`；assistant final answer 确认 `设计选择：Strategy-B` 与 `CTREE-DECISION-<seed>`；forked reviewer prompt 不包含 canary 值，只询问此前 codeword 和设计选择。
- **Expected result:** `native-thread-fork` positive case 为 `pass`；`current-boundary-spawn` positive case 只有在可触达真实 MultiAgent spawn surface 时才可能 `pass`。fresh thread、summary-only negative controls 必须被 blocked；`fork_turns:none` negative control 只属于 MultiAgent spawn surface，若 harness 触达不了该 surface，记录 `inconclusive:spawn-surface-unavailable`。
- **Verification:** mock mode 证明 runner 不泄漏 expected answers；live mode 默认输出到 `/tmp/codex-context-fork-live-<seed>/capability-matrix.json`（或显式传入 repo 外 `--out`），positive case 必须同时有 reviewer answer evidence 和 request/rollout evidence。
- **Failure signal:** positive 和 negative 都答对，或 prompt/request 包含 expected canary，说明测试泄漏；positive 答对但没有 request/rollout evidence，则 verdict 是 `inconclusive`，不能 pass。
- **If it fails:** 返回 implementation 修正 prompt construction、evidence capture 或 negative controls；如果 Codex app-server 无法暴露足够证据，则更新 architecture caveat。

### Example 2: Tool-result Canary 收敛为 pass 或 known loss

- **Example:** parent thread 通过 eval-controlled tool 或 `thread/inject_items` 写入一对 raw Responses item：`function_call` + `function_call_output`，其中 output 包含 `TOOL_RESULT_SECRET = CTREE-TOOL-<seed>`；后续 user prompt 不复述该值；forked reviewer 被问此前工具结果 secret。
- **Expected result:** report 必须给出结构化 `capabilityFinding`：`inherits-tool-result`、`known-loss:tool-result-filtered` 或 `inconclusive:no-request-evidence`。不能把普通 user message 当作 tool result。
- **Verification:** mock test 覆盖 inherits / filtered / no-evidence 三种分支；live report 的 `knownLosses`、`capabilityFinding` 与 `caseId=tool-result-canary` verdict 一致。
- **Failure signal:** tool-result case 只写自然语言失败原因；或 test 通过的原因是 user prompt 泄漏了 tool canary。
- **If it fails:** 返回 implementation，修正 tool item injection、rollout parsing 和 `classifyToolResultFinding()`。

### Example 3: Rollback Canary 不污染 forked reviewer

- **Example:** eval thread 先写入 `SURVIVING = CTREE-SURVIVE-<seed>`，再写入 `ROLLED_BACK = CTREE-ROLLBACK-<seed>`；在 eval-owned ephemeral fork 上调用 `thread/rollback` 后再 fork reviewer。
- **Expected result:** reviewer 能回答 surviving canary，不能回答 rolled-back canary；report 记录 `recoveryMethod=codex-thread-rollback-plus-fork` 和 `boundary=rollback-boundary`。
- **Verification:** mock transport 测试请求顺序必须是 source `thread/fork` 创建临时线程、对临时线程 `thread/rollback`、再从临时线程 `thread/fork` 或 `turn/start` 启动 reviewer；live report 不能出现 source thread 被 rollback 的证据。
- **Failure signal:** adapter 直接 rollback 原 source thread；或 rolled-back canary 出现在 forked request/rollout evidence 中。
- **If it fails:** 返回 design/implementation，收紧 rollback flow。

### Example 4: Compaction Canary 证明 replacement history 边界

- **Example:** 构造 pre-compact raw canary、compact summary canary、post-compact canary，然后 fork reviewer 检查三类内容是否进入 forked model-visible history。
- **Expected result:** report 明确记录 `transformLayers`，并区分 `inherits-precompact-raw`、`inherits-compact-summary`、`inherits-postcompact-tail`、`known-loss:precompact-raw-replaced`。
- **Verification:** mock test 覆盖 raw lost / summary kept / tail kept；live eval 若无法稳定触发 compaction，case verdict 为 `inconclusive` 且 `failureReason=compaction trigger unavailable`。
- **Failure signal:** compaction case 被省略，或把 summary-only handoff 当成 compaction proof。
- **If it fails:** 返回 implementation；若平台无法稳定触发，保留 inconclusive artifact，不宣称 V0 capability proven。

### Example 5: Capability Eval 和 Product Eval 分离

- **Example:** 本计划实现 `capability-matrix.json`，但不运行 design-before-plan A/B/C 产品比较。
- **Expected result:** `<out>/capability-matrix.json` 中只包含平台能力 case；live mode 默认 `<out>` 在 `/tmp/codex-context-fork-live-<seed>`，显式 `--out` 应位于 repo 外；`workflow-eval-report.json` 不由本 harness 生成。
- **Verification:** test 确认 report `reportKind === "codex-context-fork-capability"`，fixture README 明确 product eval 是后续阶段。
- **Failure signal:** runner 把 reviewer 是否发现 high issue 当作 capability pass 条件。
- **If it fails:** 返回 plan/implementation，删除 product-scoring 逻辑，保留 fixture skeleton。

### Invariants

- Invariant 1: Context Tree 成功路径必须是 context-bearing fork/copy/replay，不是 summary handoff。
- Invariant 2: 所有 case 都必须显式记录 actual recovery method、source/forked thread id、evidence refs、known losses。
- Invariant 3: 没有 request-level 或 rollout-level evidence 的 live case 不能标记为 `pass`。
- Invariant 4: eval/debug artifacts 不是产品行为真源；它们只证明或反驳平台能力。
- Invariant 5: V0 必须同时覆盖历史节点 `thread/fork + turn/start` 和当前上下文点 `spawn_agent(fork_context=true)` / `spawn_agent(fork_turns="all")` 的能力边界；若当前平台无法从外部 harness 调用 spawn path，必须把它记录为 `inconclusive:spawn-surface-unavailable`。

## File Structure

```text
package.json
src/
  core/
    ids.mjs
    graph-store.mjs
    manifest.mjs
  adapters/
    codex-app-server-client.mjs
    codex-protocol.mjs
    codex-evidence.mjs
    codex-context-fork.mjs
  eval/
    canaries.mjs
    report.mjs
    verdicts.mjs
    codex-context-fork-runner.mjs
scripts/
  eval/
    codex-context-fork-e2e.mjs
test/
  core/
    graph-store.test.mjs
    manifest.test.mjs
  adapters/
    codex-app-server-client.test.mjs
    codex-protocol.test.mjs
    codex-evidence.test.mjs
    codex-context-fork.test.mjs
  eval/
    canaries.test.mjs
    report.test.mjs
    verdicts.test.mjs
    codex-context-fork-runner.test.mjs
    codex-context-fork-cli.test.mjs
evals/
  fixtures/
    codex-context-fork/
      README.md
  reports/
    .gitkeep
docs/
  codex-context-fork-eval.md
```

Responsibilities:

- `src/core/ids.mjs`: deterministic id helpers for nodes, edges, manifests, eval runs.
- `src/core/graph-store.mjs`: in-memory graph registry with JSON persistence hooks; not a session manager.
- `src/core/manifest.mjs`: runtime validation and construction for `CaptureManifest`.
- `src/adapters/codex-app-server-client.mjs`: JSON-RPC client abstraction for mock transport and stdio transport.
- `src/adapters/codex-protocol.mjs`: normalized Codex app-server method parameters and protocol discovery.
- `src/adapters/codex-evidence.mjs`: event/turn/rollout/request evidence collection and classification.
- `src/adapters/codex-context-fork.mjs`: Codex-specific operations: start thread, fork thread, rollback ephemeral fork, current-boundary spawn probe, start reviewer turn.
- `src/eval/canaries.mjs`: canary generation, prompt construction, prompt leak audit.
- `src/eval/verdicts.mjs`: verdict gates and capability finding classification.
- `src/eval/report.mjs`: machine-readable capability report builder and writer.
- `src/eval/codex-context-fork-runner.mjs`: orchestrates case matrix; owns capability eval flow, not product workflow scoring.
- `scripts/eval/codex-context-fork-e2e.mjs`: CLI wrapper for mock/live modes.

## Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `evals/reports/.gitkeep`
- Create: `evals/fixtures/codex-context-fork/README.md`
- Create directories from File Structure.

**Example:** preserves Invariant 4

**Interfaces:**
- Produces:
  - `npm test`
  - `npm run eval:codex:mock`
  - `npm run eval:codex:live -- --codex-bin <path>`

- [ ] **Step 1: Create package manifest**

```json
{
  "name": "context-tree",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"test/**/*.test.mjs\"",
    "eval:codex:mock": "node scripts/eval/codex-context-fork-e2e.mjs --mode mock",
    "eval:codex:live": "node scripts/eval/codex-context-fork-e2e.mjs --mode live"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create directories**

```bash
mkdir -p src/core src/adapters src/eval scripts/eval test/core test/adapters test/eval evals/fixtures/codex-context-fork evals/reports docs
touch evals/reports/.gitkeep
```

Expected: command exits with status `0`.

- [ ] **Step 3: Create fixture boundary doc**

Write `evals/fixtures/codex-context-fork/README.md`:

```markdown
# Codex Context Fork Fixtures

This directory is reserved for fixed product workflow fixtures used after the Codex capability matrix is proven.

The current implementation only builds capability evals:

- native thread/session fork inheritance
- current-boundary spawn inheritance when reachable
- negative controls
- tool-result visibility or known loss
- compaction and rollback boundaries

Product workflow evals such as `design-complete -> before-implementation-plan` must not run until the capability report can distinguish inherited context from summary handoff.
```

- [ ] **Step 4: Verify scaffold**

```bash
npm test
```

Expected: no tests found or missing test files. This failure is acceptable until Task 2.

- [ ] **Step 5: Optional commit**

If `git status --short` succeeds:

```bash
git add package.json evals/fixtures/codex-context-fork/README.md evals/reports/.gitkeep
git commit -m "chore: scaffold context tree eval project"
```

If it fails with `not a git repository`, record:

```text
Commit skipped: workspace has no initialized git repository.
```

## Task 2: Core Graph Store

**Files:**
- Create: `src/core/ids.mjs`
- Create: `src/core/graph-store.mjs`
- Test: `test/core/graph-store.test.mjs`

**Example:** preserves Invariant 2

**Interfaces:**
- Produces:
  - `makeId(prefix, seed): string`
  - `makeRunId(now?: Date): string`
  - `createGraphStore(options?: { now?: () => string }): GraphStore`
  - `GraphStore.addNode(input): ContextNode`
  - `GraphStore.addEdge(input): ContextEdge`
  - `GraphStore.getNode(id): ContextNode | undefined`
  - `GraphStore.toJSON(): { nodes: ContextNode[], edges: ContextEdge[] }`

- [ ] **Step 1: Write failing tests**

Test requirements:

- `makeId("node", "Codex Thread A") === "node-codex-thread-a"`.
- Node shape contains `id`, `platform`, `sessionRef`, optional `rolloutRef`, optional `turnRef`, `label`, `createdAt`, optional `manifestId`.
- Node shape does not contain `role`, `status`, `returnRef`, or `forkMode`.
- Edge kinds are exactly `spawned-from`, `requested-by`, `reviews`, `guides`.
- Unknown node ids are rejected.

- [ ] **Step 2: Implement minimal graph store**

Implementation constraints:

- Use `Map` internally.
- Preserve insertion order in `toJSON()`.
- Validate every required string with a shared helper.
- Reject duplicate node and edge ids.

- [ ] **Step 3: Verify**

```bash
node --test test/core/graph-store.test.mjs
```

Expected: PASS.

## Task 3: Capture Manifest Validation

**Files:**
- Create: `src/core/manifest.mjs`
- Test: `test/core/manifest.test.mjs`

**Example:** implements Example 2 | preserves Invariant 2 | preserves Invariant 3 | preserves Invariant 5

**Interfaces:**
- Produces:
  - `createCaptureManifest(input): CaptureManifest`
  - valid verdicts: `"pass" | "fail" | "inconclusive"`
  - valid recovery methods:
    - `"codex-spawn-agent-full-history"`
    - `"codex-thread-fork"`
    - `"codex-thread-rollback-plus-fork"`
    - `"codex-mounted-rollout-record"`
    - `"summary-only"`

- [ ] **Step 1: Write failing tests**

Test requirements:

- Manifest records `recoveryMethod`, `sourceThreadId`, optional `spawnedThreadId`, optional `rolloutRef`, `boundary`, `codexApi`, `transformLayers`, `knownLosses`, `evidenceRefs`.
- Non-summary successful paths must have at least one evidence ref.
- `summary-only` is allowed only when `negativeControl: true` or `compatFallback: true`.
- Unknown `recoveryMethod`, `boundary`, `codexApi`, or evidence kind is rejected.

- [ ] **Step 2: Implement validation**

Use exact supported values:

```js
const RECOVERY_METHODS = new Set([
  "codex-spawn-agent-full-history",
  "codex-thread-fork",
  "codex-thread-rollback-plus-fork",
  "codex-mounted-rollout-record",
  "summary-only"
]);

const BOUNDARIES = new Set([
  "current-stable-turn",
  "interrupted-snapshot",
  "rollback-boundary",
  "compaction-boundary",
  "unknown"
]);

const CODEX_APIS = new Set([
  "multiagent-v1-fork_context",
  "multiagent-v2-fork_turns",
  "app-server-thread-fork",
  "app-server-thread-inject-items",
  "manual-tui-fork",
  "mock"
]);

const EVIDENCE_KINDS = new Set([
  "reviewer-answer",
  "json-rpc-event",
  "turn-read",
  "rollout",
  "model-request",
  "prompt-audit",
  "protocol-discovery"
]);
```

- [ ] **Step 3: Verify**

```bash
node --test test/core/manifest.test.mjs
```

Expected: PASS.

## Task 4: Canary Generation And Prompt Leak Audit

**Files:**
- Create: `src/eval/canaries.mjs`
- Test: `test/eval/canaries.test.mjs`

**Example:** implements Examples 1-4

**Interfaces:**
- Produces:
  - `createCanarySet(seed): CanarySet`
  - `buildReviewerPrompt(caseId): string`
  - `buildSummaryOnlyPrompt(caseId, sanitizedSummary): string`
  - `auditPromptForLeaks(prompt, canarySet): { leaked: boolean, leaks: string[] }`
  - `expectedCanariesForCase(caseId, canarySet): string[]`
  - `forbiddenCanariesForCase(caseId, canarySet): string[]`

- [ ] **Step 1: Write failing tests**

Test requirements:

- `createCanarySet("seed-a")` yields:
  - `CTREE-USER-seed-a`
  - `CTREE-DECISION-seed-a`
  - `CTREE-TOOL-seed-a`
  - `CTREE-PRECOMPACT-seed-a`
  - `CTREE-COMPACT-SUMMARY-seed-a`
  - `CTREE-POSTCOMPACT-seed-a`
  - `CTREE-SURVIVE-seed-a`
  - `CTREE-ROLLBACK-seed-a`
- Reviewer prompts contain `unknown` and `do not guess`.
- Reviewer prompts do not contain any expected canary values.
- Summary-only prompts reject canary-bearing summaries with `prompt leak detected`.

- [ ] **Step 2: Implement canary helpers**

Implementation constraints:

- Normalize seed with `String(seed).replace(/[^A-Za-z0-9_-]/g, "-")`.
- `buildReviewerPrompt()` accepts exactly:
  - `user-assistant-canary`
  - `tool-result-canary`
  - `rollback-canary`
  - `compaction-canary`
  - `current-boundary-spawn-canary`
  - `negative-fresh-thread`
  - `negative-summary-only`
  - `negative-fork-turns-none`
- Unknown case ids throw `unsupported caseId`.

- [ ] **Step 3: Verify**

```bash
node --test test/eval/canaries.test.mjs
```

Expected: PASS.

## Task 5: Capability Report And Verdict Gates

**Files:**
- Create: `src/eval/verdicts.mjs`
- Create: `src/eval/report.mjs`
- Test: `test/eval/verdicts.test.mjs`
- Test: `test/eval/report.test.mjs`

**Example:** implements Examples 1-5 | preserves Invariant 3

**Interfaces:**
- Produces:
  - `classifyToolResultFinding(caseResult): string`
  - `classifyCompactionFinding(caseResult): string[]`
  - `applyEvidenceGate(caseResult, { mode }): EvalCaseResult`
  - `createCapabilityReport(input): EvalReport`
  - `writeCapabilityReport(report, outputDir): Promise<string>`

- [ ] **Step 1: Write failing verdict tests**

Test requirements:

- Live positive native fork cases with no `model-request` or `rollout` evidence become `inconclusive` with `failureReason="no request or rollout evidence"`; the explicit searchable-history fallback is separate and requires `history-search` evidence.
- Mock cases may pass using mock-visible state, but report must mark evidence refs as `mock`.
- Tool result finding returns:
  - `inherits-tool-result`
  - `known-loss:tool-result-filtered`
  - `inconclusive:no-request-evidence`
- Compaction finding returns exact transform layer strings from observed evidence.
- Negative control where forbidden canary appears becomes `fail` with `failureReason="negative control leaked canary"`.

- [ ] **Step 2: Write failing report tests**

Test requirements:

- `reportKind === "codex-context-fork-capability"`.
- `workflowEvalIncluded === false`.
- Summary contains `nativeForkPass`, `spawnPass`, `summaryBaselinePass`, `regressions`, `inconclusive`.
- `summaryBaselinePass` must not contribute to Context Tree success.
- `writeCapabilityReport()` writes `capability-matrix.json`.

- [ ] **Step 3: Implement verdict and report modules**

Implementation constraints:

- `applyEvidenceGate()` must not treat generic JSON-RPC request/response logs as model request evidence.
- Evidence kind `json-rpc-event` is useful for debugging but insufficient for live pass by itself.
- A standard live fork/spawn `pass` requires:
  - reviewer answer evidence, and
  - at least one of `model-request` or `rollout` evidence that demonstrates the inherited context boundary.
- An explicitly labeled `searchable-history` live fallback may pass only with `history-search` evidence for the mounted/searchable material; it must not be reported as native fork or native spawn proof.
- `turn-read` evidence is useful corroboration for stored fork history, but by itself is not enough to prove model-visible context in live mode.

- [ ] **Step 4: Verify**

```bash
node --test test/eval/verdicts.test.mjs test/eval/report.test.mjs
```

Expected: PASS.

## Task 6: Codex App-Server JSON-RPC Client

**Files:**
- Create: `src/adapters/codex-app-server-client.mjs`
- Test: `test/adapters/codex-app-server-client.test.mjs`

**Example:** technical-only

**Interfaces:**
- Produces:
  - `createJsonRpcClient({ transport, clientInfo, capabilities? }): JsonRpcClient`
  - `client.initialize(): Promise<object>`
  - `client.request(method, params): Promise<object>`
  - `client.notify(method, params): void`
  - `client.getObservedMessages(): object[]`
  - `client.close(): void`
  - `createStdioCodexTransport({ codexBin, args }): Transport`

- [ ] **Step 1: Write failing tests**

Test requirements:

- Client sends `initialize`, then `initialized`.
- Client records `direction: "out"` and `direction: "in"` JSON-RPC messages.
- Client handles server-initiated requests by exposing `onServerRequest(callback)` and responding through `respond(id, result)`.
- Stdio transport serializes one JSON object per line.
- `close()` terminates the child process if one exists.

- [ ] **Step 2: Implement JSON-RPC client**

Implementation constraints:

- Do not assume every incoming message with `id` is a response; if it has `method`, it is a server-initiated request.
- Store observed messages for debugging only; do not let later verdict code count them as model-visible evidence.
- Initialize live clients with `capabilities.experimentalApi = true` so experimental app-server fields/methods are available when supported.

- [ ] **Step 3: Verify**

```bash
node --test test/adapters/codex-app-server-client.test.mjs
```

Expected: PASS.

## Task 7: Codex Protocol Discovery And Normalization

**Files:**
- Create: `src/adapters/codex-protocol.mjs`
- Test: `test/adapters/codex-protocol.test.mjs`

**Example:** preserves Invariant 3

**Interfaces:**
- Consumes:
  - `JsonRpcClient.request()`
- Produces:
  - `discoverCodexProtocol(client): Promise<CodexProtocolCapabilities>`
  - `buildThreadStartParams({ cwd, model }): object`
  - `buildTurnStartParams({ threadId, input, cwd, model, outputSchema }): object`
  - `buildThreadForkParams({ threadId, ephemeral, excludeTurns }): object`
  - `buildSpawnProbeParams({ prompt, forkTurns }): object | { unsupported: "spawn_surface" }`
  - `buildThreadInjectItemsParams({ threadId, items }): object`

- [ ] **Step 1: Write failing tests**

Test requirements:

- `buildThreadStartParams()` uses app-server thread fields: `sandbox: "workspace-write"` or experimental `permissions`; it must not use `sandboxPolicy`, which belongs to `turn/start`.
- `buildTurnStartParams()` serializes text input as `[{ type: "text", text }]`.
- `buildTurnStartParams()` may use `sandboxPolicy` only for turn-scoped overrides; if it emits one, it must use the full app-server `SandboxPolicy` shape, such as `type: "workspaceWrite"` plus required `writableRoots`, `networkAccess`, `excludeTmpdirEnvVar`, and `excludeSlashTmp` fields. Prefer omitting turn sandbox overrides unless the eval needs them.
- `buildThreadForkParams()` never emits `forkTurns` / `fork_turns`; app-server `thread/fork` supports `excludeTurns`, not MultiAgent fork controls.
- `buildSpawnProbeParams({ forkTurns: "none" })` is only used for a real MultiAgent spawn surface. If that surface is not reachable from the harness, it returns `{ unsupported: "spawn_surface" }`.
- `discoverCodexProtocol()` records whether `thread/inject_items`, `thread/read`, `thread/turns/list`, `thread/fork.excludeTurns`, and detached review/spawn surfaces appear supported. It must not report `thread/fork.forkTurns` as an app-server capability.

- [ ] **Step 2: Implement protocol module**

Implementation constraints:

- Prefer static known app-server methods first:
  - `thread/start`
  - `thread/fork`
  - `thread/rollback`
  - `turn/start`
  - `thread/read`
  - `thread/turns/list`
  - `thread/inject_items`
- Discovery may probe with harmless invalid ids and classify JSON-RPC method-not-found vs validation errors.
- Discovery result must be emitted as evidence kind `protocol-discovery`.

- [ ] **Step 3: Verify**

```bash
node --test test/adapters/codex-protocol.test.mjs
```

Expected: PASS.

## Task 8: Codex Evidence Collector

**Files:**
- Create: `src/adapters/codex-evidence.mjs`
- Test: `test/adapters/codex-evidence.test.mjs`

**Example:** implements Examples 1-4 | preserves Invariant 3

**Interfaces:**
- Consumes:
  - `JsonRpcClient.getObservedMessages()`
  - app-server event notifications
  - `thread/read` / `thread/turns/list` responses when available
  - rollout paths when returned by app-server
  - optional test provider request log path
- Produces:
  - `createEvidenceCollector({ client, protocol, runDir }): EvidenceCollector`
  - `collector.waitForTurnCompleted(threadId, turnId): Promise<TurnCompletion>`
  - `collector.collectReviewerAnswer(threadId, turnId): Promise<EvidenceRef[]>`
  - `collector.collectThreadEvidence(threadId, canarySet): Promise<EvidenceRef[]>`
  - `collector.collectModelRequestEvidence(canarySet): Promise<EvidenceRef[]>`
  - `collector.auditPrompt(prompt, canarySet): EvidenceRef`

- [ ] **Step 1: Write failing tests**

Test requirements:

- `waitForTurnCompleted()` resolves only after `turn/completed`.
- `collectReviewerAnswer()` extracts agent text from `item/agentMessage/delta`, `item/completed`, or `thread/read` fallback.
- `collectThreadEvidence()` distinguishes evidence kinds:
  - `turn-read`
  - `rollout`
  - `json-rpc-event`
- `collectModelRequestEvidence()` returns `[]` when no provider request capture exists.
- Evidence refs include enough data to reproduce the decision: `kind`, `ref`, `threadId`, optional `turnId`, `contains`, `missing`, `itemsView`.

- [ ] **Step 2: Implement evidence collector**

Implementation constraints:

- JSON-RPC observed messages are debug evidence only unless they contain app-server item/turn notifications with reviewer output.
- A `turn-read` evidence ref shows stored thread reconstruction only. It can corroborate a standard live fork verdict but cannot satisfy that live pass evidence gate without `model-request` or `rollout` evidence. If the case is explicitly reported as a searchable-history fallback, the success-capable evidence is `history-search`, not raw `turn-read` alone.
- A `model-request` evidence ref counts for live pass only when it came from a test provider request log, not from our own outgoing `turn/start` prompt.
- Rollout evidence must be read from a returned rollout path or app-server thread metadata; if the live harness cannot access it, return no rollout evidence and let verdict become inconclusive.

- [ ] **Step 3: Verify**

```bash
node --test test/adapters/codex-evidence.test.mjs
```

Expected: PASS.

## Task 9: Codex Context Fork Adapter

**Files:**
- Create: `src/adapters/codex-context-fork.mjs`
- Test: `test/adapters/codex-context-fork.test.mjs`

**Example:** implements Examples 1-4 | preserves Invariants 1-3

**Interfaces:**
- Consumes:
  - protocol builders from Task 7
  - evidence collector from Task 8
  - `createCaptureManifest()` from Task 3
- Produces:
  - `startEvalThread(client, protocol, { cwd, model, canaries }): Promise<{ threadId, evidenceRefs }>`
  - `injectToolResultCanary(client, protocol, { threadId, canaries }): Promise<EvidenceRef[]>`
  - `forkReviewerFromThread(client, protocol, input): Promise<ForkResult>`
  - `rollbackEphemeralThenFork(client, protocol, input): Promise<ForkResult>`
  - `probeCurrentBoundarySpawn(client, protocol, input): Promise<ForkResult | InconclusiveResult>`

- [ ] **Step 1: Write failing adapter tests**

Test requirements:

- `forkReviewerFromThread()` calls `thread/fork`, then `turn/start`, then waits for `turn/completed`.
- `rollbackEphemeralThenFork()` never calls `thread/rollback` on the source thread.
- `injectToolResultCanary()` uses `thread/inject_items` with paired raw Responses API items when supported; if unsupported, returns `inconclusive:tool-injection-unavailable`.
- The tool-result fixture must inject exactly:
  ```json
  [
    {
      "type": "function_call",
      "name": "ctree_eval_tool",
      "arguments": "{\"caseId\":\"tool-result-canary\"}",
      "call_id": "ctree_tool_<seed>"
    },
    {
      "type": "function_call_output",
      "call_id": "ctree_tool_<seed>",
      "output": "TOOL_RESULT_SECRET = CTREE-TOOL-<seed>"
    }
  ]
  ```
- `probeCurrentBoundarySpawn()` returns `inconclusive:spawn-surface-unavailable` when no app-server reachable spawn surface exists.
- Manifest `knownLosses` starts with verifiable Codex losses:
  - `no model KV/cache`
  - `no provider prompt cache`
  - `forked rollout may filter reasoning items`
  - `forked rollout may filter tool outputs`

- [ ] **Step 2: Implement adapter**

Implementation constraints:

- Use `thread/fork` for historical-node eval.
- Use `thread/inject_items` only for eval-owned threads.
- If `thread/inject_items` is unavailable, do not fake tool result with a user message; mark the case inconclusive.
- Current-boundary spawn is only passable when the harness can invoke an actual Codex spawn surface with `fork_context=true` or `fork_turns="all"`. If external app-server cannot do that, emit inconclusive case rather than omitting it.
- `negative-fork-turns-none` is only run through the same real spawn surface. Do not emulate it with app-server `thread/fork`; app-server `thread/fork` has no `forkTurns` / `fork_turns` parameter.

- [ ] **Step 3: Verify**

```bash
node --test test/adapters/codex-context-fork.test.mjs
```

Expected: PASS.

## Task 10: Capability Eval Runner With Mock Mode

**Files:**
- Create: `src/eval/codex-context-fork-runner.mjs`
- Test: `test/eval/codex-context-fork-runner.test.mjs`

**Example:** implements Examples 1-5

**Interfaces:**
- Produces:
  - `runCodexContextForkCapabilityEval({ client, protocol, evidenceCollector, seed, cwd, mode, runDir }): Promise<EvalReport>`
  - case ids:
    - `user-assistant-canary`
    - `negative-fresh-thread`
    - `negative-summary-only`
    - `negative-fork-turns-none`
    - `tool-result-canary`
    - `rollback-canary`
    - `compaction-canary`
    - `current-boundary-spawn-canary`

- [ ] **Step 1: Write failing runner tests**

Test requirements:

- Mock positive user/assistant fork passes and negative controls are blocked.
- Mock tool-result case can be configured to inherit or filter tool output.
- Mock compaction case records transform layers.
- Mock rollback case preserves surviving canary and excludes rolled-back canary.
- Mock current-boundary spawn case passes only when mock client supports spawn full-history.
- Live mode with no `model-request` or `rollout` evidence marks positive cases inconclusive even if `turn-read` evidence exists.
- Runner never uses expected canaries from test code to synthesize reviewer answer.

- [ ] **Step 2: Implement runner**

Implementation constraints:

- Every case must call `auditPromptForLeaks()` before starting the reviewer turn.
- Every case must attach:
  - `sourceThreadId`
  - `forkedThreadId` when applicable
  - `method`
  - `expectedCanaries`
  - `forbiddenCanaries`
  - `observedAnswer`
  - `evidenceRefs`
  - `knownLosses`
  - `verdict`
  - optional `failureReason`
  - optional `capabilityFinding`
- Negative controls use the same reviewer question but different recovery path.
- Product workflow scoring is not implemented.

- [ ] **Step 3: Verify**

```bash
node --test test/eval/codex-context-fork-runner.test.mjs
```

Expected: PASS.

## Task 11: CLI Wrapper And Live Transport Boundary

**Files:**
- Create: `scripts/eval/codex-context-fork-e2e.mjs`
- Test: `test/eval/codex-context-fork-cli.test.mjs`

**Example:** observes Examples 1-5 | preserves Invariant 3

**Interfaces:**
- Produces:
  - CLI args: `--mode mock|live`, `--seed <seed>`, `--out <dir>`, `--codex-bin <path>`, `--model <model>`, `--provider-log <path>`
  - report path printed as `capability report: <path>`

- [ ] **Step 1: Write failing CLI smoke tests**

Test requirements:

- Mock CLI writes `capability-matrix.json`.
- Live CLI exits nonzero with clear error if `codex app-server` cannot start.
- Live CLI may write a report with inconclusive cases; it must not print `capability proven` unless strong E2E gate passes.

- [ ] **Step 2: Implement CLI**

Implementation constraints:

- Mock mode uses scripted mock client, mock protocol, and mock evidence collector.
- Live mode starts `codex app-server --listen stdio://`.
- Live mode calls `discoverCodexProtocol()` before running cases.
- Live mode passes `provider-log` to evidence collector only when supplied.
- Always close transport in `finally`.

- [ ] **Step 3: Verify**

```bash
node --test test/eval/codex-context-fork-cli.test.mjs
npm run eval:codex:mock -- --seed seed-a --out /tmp/context-tree-evals/mock-seed-a
```

Expected:

```text
capability report: /tmp/context-tree-evals/mock-seed-a/capability-matrix.json
```

## Task 12: Documentation Link And Usage Notes

**Files:**
- Modify: `architecture/02-v0-codex-first-design.md`
- Create: `docs/codex-context-fork-eval.md`

**Example:** preserves Invariant 1 | preserves Invariant 4

**Interfaces:**
- Produces:
  - one command for mock eval
  - one command for live eval
  - explanation of pass/fail/inconclusive
  - explanation that eval artifacts are not product truth

- [ ] **Step 1: Create usage doc**

Write `docs/codex-context-fork-eval.md` with:

````markdown
# Codex Context Fork Eval

This harness measures Codex context-fork capability for Context Tree v0.

It does not prove the full product workflow. It only answers which context ingredients survive the current Codex fork/spawn paths.

Run mock mode:

```bash
npm run eval:codex:mock -- --seed seed-a --out /tmp/context-tree-evals/mock-seed-a
```

Run live mode:

```bash
npm run eval:codex:live -- --codex-bin codex
```

Optional provider request capture:

```bash
npm run eval:codex:live -- --seed live-a --out /tmp/context-tree-evals/live-a --codex-bin codex --provider-log /path/to/provider-requests.jsonl
```

Verdicts:

- `pass`: expected inherited context is observed and success-path evidence supports it: request/rollout evidence for standard live fork/spawn, or `history-search` evidence for an explicitly labeled searchable-history fallback. `turn-read` may corroborate stored reconstruction but is not sufficient by itself in live mode.
- Live request/rollout evidence with `toolsOffered: true` records that tool schemas were available, but schema exposure alone is not a blocker. Actual reviewer tool use (`toolsUsed: true`) or model-visible tool result content (`toolResultExposed: true`) downgrades the live verdict to `inconclusive`.
- `fail`: expected inheritance did not happen, or a negative control leaked canaries.
- `inconclusive`: the harness could not capture enough evidence to prove or disprove the case.

The report is an eval artifact. It is not the Context Tree source of truth and does not replace platform session records.
````

- [ ] **Step 2: Link from architecture**

Append to `architecture/02-v0-codex-first-design.md`:

````markdown
## 13. Implementation Plan Link

The first implementation plan is:

```text
docs/superpowers/plans/2026-07-04-codex-context-fork-e2e.md
```

The executable eval usage note is:

```text
docs/codex-context-fork-eval.md
```

This keeps v0 implementation focused on Codex capability evidence before product workflow claims.
````

- [ ] **Step 3: Verify docs**

```bash
rg -n "summary-only.*success|完整 transcript.*模型上下文|full transcript" architecture docs/codex-context-fork-eval.md
```

Expected: no matches claiming summary-only or full transcript equals model context. Matches that explicitly deny equivalence are acceptable after inspection.

## Task 13: Final Verification Gate

**Files:**
- Verify: all files from Tasks 1-12.

**Example:** observes Examples 1-5

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: PASS across all test files.

- [ ] **Step 2: Run mock capability eval**

```bash
npm run eval:codex:mock -- --seed seed-a --out /tmp/context-tree-evals/mock-seed-a
```

Expected:

```text
capability report: /tmp/context-tree-evals/mock-seed-a/capability-matrix.json
```

Inspect:

```bash
node -e "const r=require('/tmp/context-tree-evals/mock-seed-a/capability-matrix.json'); console.log(r.reportKind, r.summary)"
```

Expected output includes:

```text
codex-context-fork-capability
```

- [ ] **Step 3: Run live capability eval when Codex app-server is available**

```bash
npm run eval:codex:live -- --codex-bin codex
```

Acceptable outcomes:

```text
capability report: /tmp/codex-context-fork-live-<random-seed>/capability-matrix.json
```

or a clear startup/auth/platform error from `codex app-server`.

If live run writes a report but cases are `inconclusive`, do not mark v0 capability proven. Record:

```text
Live eval completed but capability remains inconclusive.
Blocking reason: <failureReason values from report>
```

- [ ] **Step 4: Strong E2E gate**

V0 capability is proven only if the live report satisfies all of:

- user-message canary pass
- assistant-final canary pass
- fresh thread / summary-only / fork-turns-none negative controls blocked
- tool-result canary has `inherits-tool-result` or `known-loss:tool-result-filtered`
- compaction case has transform-layer finding or explicit inconclusive caveat
- rollback canary pass
- current-boundary spawn case pass or explicit `spawn-surface-unavailable` caveat
- every live pass has reviewer-answer evidence and matching success-path support: `model-request`/`rollout` for standard live fork/spawn, or `history-search` for an explicitly labeled searchable-history fallback

- [ ] **Step 5: Optional commit**

If `git status --short` succeeds:

```bash
git add package.json src test scripts evals docs architecture
git commit -m "feat: add codex context fork capability eval"
```

If no git repository exists, record the skip line from Task 1.
