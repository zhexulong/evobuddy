# Subagent / Checkpoint Extension 定位：服务 review 与 loop harness

> 状态：本定位已被 `architecture/08-context-bearing-subagent-api-design.md`
> 修正。本文仍可作为“为什么不是完整 Context Tree / 不是 Trellis
> extension”的历史背景，但当前 V0 的主对象是 context-bearing subagent/oracle
> API；checkpoint packet 只是 fallback / audit 后端之一。

## 1. 修正后的定位

本项目不应定位为 Trellis extension。

更准确的定位是：

```text
一个广义的 subagent / checkpoint extension，
用于在 agent loop 的关键边界创建可审查、可恢复、可派生的上下文点，
并把这些点交给 reviewer / checker / reflector / planner subagent 使用。
```

它可以集成 Trellis、Superpowers、CCG、Codex native spawn、OpenCode、Claude Code 等 harness，但不属于任何一个 harness。

Trellis 是一个重要 baseline，因为它证明 staged docs / task artifacts / per-agent JSONL 能解决大量工程上下文问题；但我们的目标不是扩展 Trellis 本身，而是抽象出一个可以插入不同 loop harness 的 checkpoint/review 能力。

## 2. Loop agent / agent loop 的含义

通用定义可以概括为：

```text
agent loop = perceive / reason / plan / act / observe / reflect 的循环，
每一轮把当前状态与观察结果组装进模型输入，
让 agent 选择下一步行动，直到任务完成或触发停止条件。
```

常见形式：

```text
Think / Plan
→ Act / Tool call
→ Observe / Tool result
→ Reflect / Adjust
→ Repeat
```

因此，本项目真正插入的位置不是“文档系统”，而是 loop 的边界：

```text
before plan
before implementation
after observation
before retry
before final review
after failed loop
before compaction / context loss
```

在这些边界，extension 可以：

1. 固化 checkpoint；
2. 编译 reviewer packet；
3. 派生 subagent；
4. 记录 review/reflect result；
5. 把结果反馈给当前 loop。

## 3. 为什么不是 Trellis extension

Trellis 解决的是：

```text
当前 task 在当前 stage 应读取哪些 specs / PRD / design / research / JSONL context？
```

我们的目标是：

```text
在一个 agent loop 的关键边界，
应该如何创建一个可供 subagent 审查/反思/规划的 checkpoint，
并尽量保留该边界的上下文语义？
```

二者关系：

| 维度 | Trellis | Subagent / Checkpoint Extension |
|---|---|---|
| 主体 | task/spec workflow | loop boundary / checkpoint / subagent review |
| 上下文来源 | staged docs, JSONL, task artifacts | staged docs + node packet + runtime/session refs + optional native fork |
| 主要问题 | 当前任务应读什么 | 何时停下来审查、从哪个边界审查、审查结果如何回流 |
| 生命周期 | task lifecycle | agent loop lifecycle |
| 产物 | PRD/design/implement/check JSONL | checkpoint packet / reviewer packet / review result |
| 适配对象 | 多平台 coding tools | 多种 loop harness / workflow systems |

所以 Trellis 是一个 adapter / host / baseline，不是产品边界。

## 4. 核心对象不再是 Context Tree，而是 Checkpointed Review Loop

原来的 Context Tree 容易把系统推向完整 node/edge graph 产品。

现在应收窄成：

```text
Checkpointed Review Loop
```

核心对象：

```ts
type Checkpoint = {
  id: string
  host: "trellis" | "superpowers" | "codex" | "opencode" | "claude-code" | string
  loopId?: string
  taskRef?: string
  sessionRef?: string
  boundary: string
  createdAt: string
  packetRef?: string
  nativeForkRef?: string
  knownLosses?: string[]
}

type ReviewInvocation = {
  id: string
  checkpointId: string
  targetRef: string
  reviewerKind: "reviewer" | "checker" | "reflector" | "planner"
  contextMode: "staged-docs" | "checkpoint-packet" | "native-fork" | "mounted-session-record" | "summary-only"
  promptRef?: string
  resultRef?: string
}
```

这不是完整 tree database，只是 loop boundary 上的 checkpoint + subagent invocation record。

## 5. 三种上下文模式

### 5.1 Staged-docs mode

适合 Trellis / Superpowers / CCG 这类流程：

```text
specs + task docs + design/plan + checklists + research
→ reviewer/checker subagent
```

这是最低复杂度主路径，也是跨 harness baseline。

### 5.2 Checkpoint-packet mode

适合临时但重要、又不应进入长期 specs 的上下文：

```text
boundary metadata
+ decisions
+ exclusions
+ transient user preferences
+ relevant observations/tool-result references
+ known losses
+ review target
→ checkpoint/reviewer packet
```

这是本项目最有价值的新增层。

它不是 Trellis 专属；Trellis 可以把它放进 `.trellis/tasks/<task>/reviewer-packets/`，Superpowers 可以把它放进 spec/plan sidecar，Codex 可以把它放进 eval/report artifact。

### 5.3 Native-fork mode

适合支持 runtime fork/spawn 的平台：

```text
parent live agent
→ native spawn/fork reviewer
→ reviewer result
```

它是强 fidelity 优化，但不是产品唯一主线。native fork 结果也应被记录成 checkpoint/review invocation 的一种 contextMode。

## 6. 它服务哪些 harness

### Trellis

插入点：

```text
planning complete → before implement
implement complete → before check
check failed → before debug/retry
finish-work → before PR
```

使用方式：

```text
读取 Trellis staged docs + JSONL；
额外生成 checkpoint packet；
把 packet 加进 review/check context。
```

### Superpowers

插入点：

```text
brainstorming design approved → before writing-plans
implementation plan complete → before executing-plans
implementation complete → before requesting-code-review
review feedback received → before fixing
```

使用方式：

```text
在 skill transition 前创建 checkpoint；
派生 reviewer/checker/planner subagent；
把结果作为下一 skill 的输入。
```

### CCG / other workflow harness

插入点：

```text
phase transition
loop retry
reflection boundary
handoff boundary
```

使用方式：

```text
host 提供 current phase/task/session refs；
extension 负责 packet + subagent invocation + result return。
```

### Native coding agents

Codex / Claude Code / OpenCode 可以作为 host：

```text
如果有 native spawn/fork：优先 native-fork mode；
如果没有：staged-docs / checkpoint-packet mode；
如果只能挂载 transcript：mounted-session-record mode。
```

## 7. 需要澄清的设计问题

1. **checkpoint 由谁创建？**
   - host workflow 在阶段边界创建；
   - agent 自主声明；
   - 用户显式请求；
   - 或失败/loop 检测自动触发。

2. **packet 是谁写？**
   - 当前 agent；
   - extension 根据模板生成；
   - reviewer 反向补充；
   - 或从 session/runtime artifacts 编译。

3. **subagent 是谁调用？**
   - host harness 的 subagent system；
   - platform native spawn；
   - CLI/background worker；
   - app-server thread fork。

4. **结果如何回流？**
   - 作为当前 agent 的 tool result；
   - 写入 task artifact；
   - 写入 review result；
   - 阻塞继续执行；
   - 或仅作为 advisory。

5. **是否需要 tree？**
   - V0 不需要完整 tree；
   - 只需要 checkpoint ancestry / review target refs；
   - 如果未来出现多个历史 checkpoint 选择问题，再升级 tree。

## 8. 当前应做什么

下一步不是 Trellis extension，也不是完整 Context Tree。

下一步应写一个通用设计：

```text
Subagent Checkpoint Review Extension
```

它定义：

- host adapter contract；
- checkpoint packet schema；
- review invocation lifecycle；
- contextMode 分类；
- Trellis / Superpowers / native Codex 的三个 adapter sketch；
- 何时从 staged docs 升级到 packet / native fork；
- 如何避免污染长期 docs；
- 如何服务 review loop / reflection loop / retry loop。

## 9. 最小 V0

V0 可以只有：

```text
1. host boundary trigger
2. checkpoint packet file
3. reviewer prompt template
4. subagent invocation record
5. review result attachment
```

不做：

```text
完整 tree database
自动 branch suggestion
跨平台 session manager
全量 runtime replay
复杂 graph UI
```

## 10. 参考

- AI Agent Loop: https://outcomeschool.com/blog/ai-agent-loop
- Oracle: What Is the AI Agent Loop: https://blogs.oracle.com/developers/what-is-the-ai-agent-loop-the-core-architecture-behind-autonomous-ai-systems
- Iterative Plan–Observe–Reflect Cycle: https://www.emergentmind.com/topics/iterative-plan-observe-reflect-cycle
- Loop Engineering: https://www.mindstudio.ai/blog/what-is-loop-engineering-ai-coding-agents
- Trellis staged context sufficiency: `architecture/05-trellis-staged-context-sufficiency.md`
