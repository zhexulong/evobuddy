# Subagent Checkpoint Review Extension 设计

> 状态：本设计已被 `architecture/08-context-bearing-subagent-api-design.md`
> 修正。当前核心不是先定义 checkpoint packet / reviewer packet，也不是
> 设计 context-bearing subagent/oracle API，而是先证明 designer
> checkpoint-fork reviewer 相比 doc-only reviewer 在真实 review 任务中
> 有质量或效率增益。

## 1. 目标

本设计定义一个广义的 **Subagent / Checkpoint Review Extension**。

它不是 Trellis extension，也不是完整 Context Tree 产品。它是一个可以插入不同 agent loop / workflow harness 的横切能力：

```text
在关键 loop boundary 创建 checkpoint
→ 编译 reviewer/checker/reflector/planner 所需上下文
→ 派生或调用 subagent
→ 将审查/反思/规划结果回流给当前 loop
```

它服务三类场景：

1. **review**：设计、实现、计划进入下一阶段前，派生独立 reviewer。
2. **loop correction**：agent loop 失败、卡住、反复 retry 前，派生 reflector/debugger。
3. **checkpoint handoff**：在 context 可能被污染、压缩或丢失前，固化边界并供后续 subagent 使用。

## 2. 非目标

V0 不做：

- 完整 Context Tree graph 产品；
- 通用知识库 / 向量检索系统；
- 替代 Trellis / Superpowers / CCG；
- 自动 branch suggestion；
- 完整 runtime replay；
- 跨平台 session manager；
- GUI；
- 保证 native fork 一定可用。

V0 只做：

```text
checkpoint packet + review invocation + host adapter contract
```

## 3. 核心抽象

### 3.1 Host

Host 是承载 agent loop 的系统，例如：

- Trellis；
- Superpowers；
- CCG workflow；
- Codex native agent；
- OpenCode；
- Claude Code；
- 自定义 loop harness。

Host 负责提供：

```text
当前 loop/task/session 位置
当前阶段边界
可用 staged docs / artifacts
可用 subagent/spawn 能力
结果回流方式
```

Extension 不拥有 host 的 workflow，只在边界处插入。

### 3.2 Checkpoint

Checkpoint 是一个 loop boundary 的可审查上下文锚点。

```ts
type Checkpoint = {
  id: string
  host: string
  createdAt: string

  loopRef?: string
  taskRef?: string
  sessionRef?: string
  phase?: string
  boundary: string

  sourceRefs: ResourceRef[]
  targetRefs: ResourceRef[]

  packetRef?: ResourceRef
  nativeForkRef?: ResourceRef
  knownLosses: string[]
}
```

重要语义：

```text
checkpoint 不是“保存全部对话”。
checkpoint 是“这里值得被另一个 subagent 从某种上下文视角审查/反思/规划”。
```

### 3.3 Checkpoint Packet

Packet 是 checkpoint 的 node-local 上下文包。

它不等于长期 specs，也不等于普通 summary。它只服务当前边界和派生 subagent。

```ts
type CheckpointPacket = {
  id: string
  checkpointId: string
  title: string
  createdAt: string

  boundary: {
    host: string
    phase?: string
    reason: string
    beforeAction?: string
    afterAction?: string
  }

  context: {
    stableDocs: ResourceRef[]
    taskArtifacts: ResourceRef[]
    decisions: ContextNote[]
    exclusions: ContextNote[]
    transientPreferences: ContextNote[]
    observations: ContextNote[]
    toolResultRefs: ResourceRef[]
    openQuestions: ContextNote[]
  }

  target: {
    kind: "design" | "plan" | "implementation" | "diff" | "loop-state" | string
    refs: ResourceRef[]
    reviewQuestion: string
  }

  fidelity: {
    contextMode: ContextMode
    sourceBoundary?: string
    transformLayers: string[]
    knownLosses: string[]
  }
}

type ContextNote = {
  text: string
  provenance?: ResourceRef
  confidence?: "explicit" | "inferred" | "uncertain"
}

type ContextMode =
  | "staged-docs"
  | "checkpoint-packet"
  | "native-fork"
  | "mounted-session-record"
  | "summary-only"
```

### 3.4 ReviewInvocation

ReviewInvocation 记录一次 subagent 审查/反思/规划调用。

```ts
type ReviewInvocation = {
  id: string
  checkpointId: string
  createdAt: string

  reviewerKind:
    | "reviewer"
    | "checker"
    | "reflector"
    | "planner"
    | "debugger"

  contextMode: ContextMode
  promptRef?: ResourceRef
  subagentRef?: ResourceRef
  resultRef?: ResourceRef

  status: "created" | "running" | "completed" | "failed" | "inconclusive"
  blockingIssues?: ReviewIssue[]
}

type ReviewIssue = {
  severity: "critical" | "high" | "medium" | "low"
  title: string
  evidence?: ResourceRef[]
  recommendation?: string
}
```

## 4. Lifecycle

### 4.1 Boundary detection

V0 不做复杂自动判断。触发来源按优先级：

1. host workflow 明确阶段转换；
2. agent 显式声明 checkpoint；
3. 用户显式请求 review/checkpoint；
4. loop failure / repeated retry；
5. compaction/context-loss 前置 hook。

典型边界：

```text
design approved → before implementation plan
implementation plan complete → before execution
implementation complete → before review
check failed → before debug retry
loop repeated failure → before reflection
context compact imminent → before continuation
```

### 4.2 Packet compilation

Packet 编译分三层：

```text
host staged context
+ boundary-local notes
+ optional runtime/session evidence
```

#### Layer A: staged context

例如：

- Trellis specs / PRD / design / implement / JSONL；
- Superpowers spec / plan / review output；
- CCG workflow artifacts；
- repo docs / changed files / diff。

#### Layer B: boundary-local notes

只对当前 checkpoint 有意义：

- 本阶段关键决策；
- 已排除方案；
- 用户临时偏好；
- 中间探索结论；
- 当前 reviewer 应重点检查什么；
- 不应污染长期 specs 的约束。

#### Layer C: optional runtime evidence

如果 host/platform 可用：

- sessionRef；
- transcriptRef；
- toolResultRefs；
- compact/prune state；
- native fork id；
- known losses。

V0 可以先只记录 refs，不做完整 replay。

### 4.3 Subagent invocation

根据 host 能力选择 contextMode：

```text
native-fork > checkpoint-packet > staged-docs > mounted-session-record > summary-only
```

但这个优先级不是绝对。若 staged docs 更干净、native fork 噪音太大，host 可以选择 staged-docs 或 checkpoint-packet。

Reviewer prompt 模板：

```md
你是由 Subagent Checkpoint Review Extension 派生的 <reviewerKind>。

你正在审查一个 loop boundary：<boundary>。

上下文模式：<contextMode>
已知损失：<knownLosses>

请基于提供的 checkpoint packet / staged docs / inherited context 审查目标：
<target>

输出：
1. blocking / high issues
2. evidence
3. recommended correction
4. unknowns
5. 是否允许当前 loop 进入下一阶段
```

### 4.4 Result return

结果回流方式由 host 决定：

- 作为当前 agent 的 tool result；
- 写入 task artifact；
- 写入 review result 文件；
- 阻塞下一阶段；
- 仅 advisory。

V0 推荐默认：

```text
review result 写入 artifact + 摘要作为当前 agent 输入
```

## 5. Host Adapter Contract

### 5.1 Host 提供的最小接口

```ts
type HostAdapter = {
  name: string

  getPosition(): HostPosition
  collectStagedContext(input: BoundaryInput): Promise<ResourceRef[]>
  createPacket(input: PacketInput): Promise<ResourceRef>
  invokeSubagent(input: ReviewInvokeInput): Promise<ReviewInvocation>
  attachResult(input: AttachResultInput): Promise<void>
}
```

### 5.2 HostPosition

```ts
type HostPosition = {
  host: string
  loopRef?: string
  taskRef?: string
  sessionRef?: string
  phase?: string
  cwd?: string
  activeArtifacts?: ResourceRef[]
}
```

### 5.3 Adapter 能力声明

```ts
type HostCapabilities = {
  stagedDocs: boolean
  checkpointPacket: boolean
  nativeFork: boolean
  mountedSessionRecord: boolean
  subagentResultReturn: "tool-result" | "file" | "manual" | "unknown"
}
```

## 6. Adapter sketches

### 6.1 Trellis adapter

Host context:

```text
.trellis/tasks/<task>/task.json
.trellis/tasks/<task>/prd.md
.trellis/tasks/<task>/design.md
.trellis/tasks/<task>/implement.md
.trellis/tasks/<task>/implement.jsonl
.trellis/tasks/<task>/check.jsonl
.trellis/spec/**
```

Packet location:

```text
.trellis/tasks/<task>/reviewer-packets/<checkpoint-id>.md
.trellis/tasks/<task>/review-results/<invocation-id>.md
```

Integration:

```text
planning complete → create packet → add packet to check/review context
before check → reviewer/checker reads packet + existing JSONL
```

Trellis adapter 不需要成为 Trellis fork；它只是以 Trellis artifacts 作为 staged context。

### 6.2 Superpowers adapter

Host context:

```text
brainstorming spec
implementation plan
review feedback
current repo diff
```

Packet location：

```text
docs/superpowers/checkpoints/<checkpoint-id>.md
```

Integration:

```text
brainstorming approved → before writing-plans
writing-plans completed → before executing-plans
implementation completed → before requesting-code-review
```

Result return:

```text
review result 作为下一 skill 的输入，并写入 docs/superpowers/checkpoints/results/
```

### 6.3 Codex native adapter

Host context:

```text
current Codex session / thread / rollout refs
```

Modes:

1. `native-fork`：若当前 agent 可调用 native spawn/fork；
2. `checkpoint-packet`：写 packet 并用普通 subagent / current agent 读取；
3. `mounted-session-record`：挂载 rollout/session record。

V0 不承诺完整 replay，只记录 fidelity：

```text
filtered stored-history fork
not KV/cache
tool result visibility unknown unless tested
```

### 6.4 Generic file adapter

最低通用模式：

```text
input: boundary label + target refs + staged doc refs
output: checkpoint packet markdown + review prompt markdown
```

适合任何 harness 手动或半自动调用。

## 7. Data layout

V0 推荐 host-local artifact，而不是中心数据库。

通用布局：

```text
.checkpoints/
  checkpoints.jsonl
  packets/
    <checkpoint-id>.md
    <checkpoint-id>.json
  invocations/
    <invocation-id>.json
  results/
    <invocation-id>.md
```

Host 可以映射到自己的目录：

```text
Trellis: .trellis/tasks/<task>/reviewer-packets/
Superpowers: docs/superpowers/checkpoints/
Generic: .checkpoints/
```

## 8. Packet 内容模板

```md
# Checkpoint Packet: <title>

## Boundary

- Host:
- Phase:
- Boundary:
- Before action:
- Reason:

## Target

- Kind:
- Refs:
- Review question:

## Stable context refs

- ...

## Task artifacts

- ...

## Decisions

- ...

## Exclusions

- ...

## Transient preferences

- ...

## Observations / tool evidence

- ...

## Known losses

- ...

## Reviewer instructions

- Check for blocking/high issues.
- Prefer evidence over speculation.
- If context is insufficient, say exactly what is missing.
- Do not treat this packet as long-term project law.
```

## 9. Safety / pollution control

关键原则：

```text
长期 specs 放稳定规则；
task docs 放当前任务目标和设计；
checkpoint packet 放边界局部上下文；
review result 放审查输出；
只有经过 update-spec / human review 才能升格进长期 specs。
```

Packet 必须显式标注：

```text
Do not treat as long-term rule.
```

避免把临时偏好、失败探索、一次性约束污染长期文档。

## 10. 成功标准

V0 成功不是证明 native fork 完美，而是证明：

1. host 能在明确 boundary 创建 checkpoint；
2. checkpoint packet 能承载 staged docs 不适合承载的临时上下文；
3. reviewer/checker/reflector 能读取 packet 并产出结果；
4. 结果能回流到当前 loop；
5. contextMode 和 knownLosses 可见；
6. 不引入完整 graph/product 复杂度。

## 11. 下一步执行建议

### Step 1：冻结旧定位

把当前方向从：

```text
Context Tree / Trellis extension
```

冻结为：

```text
Subagent Checkpoint Review Extension
```

### Step 2：写 implementation plan

计划文件建议：

```text
docs/superpowers/plans/2026-07-05-subagent-checkpoint-review-extension.md
```

V0 实现范围：

```text
src/core/checkpoint-packet.ts 或 .mjs
src/core/review-invocation.ts
src/adapters/generic-file-adapter.ts
src/adapters/superpowers-adapter.ts 或 trellis-adapter sketch
templates/checkpoint-packet.md
templates/reviewer-prompt.md
test/core/*
```

### Step 3：先做 generic file adapter

不要一开始绑定 Trellis 或 Codex。

先实现：

```text
create checkpoint packet from explicit inputs
create review prompt from packet
record review result
```

### Step 4：再选第一个 host adapter

建议优先级：

1. **Superpowers adapter**：最贴近当前 repo 的设计 → plan → review loop；低外部依赖。
2. **Trellis adapter**：作为 staged-docs 强 baseline；适合后续对比。
3. **Codex native adapter**：作为 fidelity upgrade；等核心 packet 生命周期稳定后再做。

### Step 5：保留 eval 问题，但不要阻塞 V0

V0 先证明 workflow 是否顺畅。

之后再比较：

```text
staged-docs vs checkpoint-packet vs native-fork
```

## 12. 当前决策

当前推荐路线：

```text
做 Subagent Checkpoint Review Extension V0，
先 generic file adapter + Superpowers boundary，
再接 Trellis staged-docs baseline，
最后再考虑 Codex native fork adapter。
```

这既保留了一开始“从关键上下文点派生 reviewer”的目标，也避免过早构建完整 Context Tree。
