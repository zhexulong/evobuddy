# WorkBuddy-style TUI Workbench 设计

## 0. 结论

Context Tree 的下一层用户表层应先做 **TUI workbench**，并高度参考 WorkBuddy-style 的 `Assistant / Experts / Skills / Connectors / Automations` 心智。但它不应把 eval proof taxonomy 直接暴露成主 UI，也不应退回到 tree / graph / artifact browser。

最合适的用户第一层是：

```text
我有一组可复用 experts；
每个 expert 擅长某类工作；
同一个 expert 可以同时或反复服务多个 parent agent / subagent / task；
我可以看到这些 expert 最近承接了哪些任务、结果是否返回、是否需要继续处理。
```

因此 TUI 的产品对象不是 `proof tier`，也不是 `runtime agent instance`，而是：

```text
Expert identity -> many Tasks / MemberTaskRuns -> result + runtime facet + trace
```

这里的 `Expert` 对应当前 contract 中的稳定 `memberName` / `TeamMemberProfile`，例如 `skill-designer`、`live-eval-checker`、`architecture-reviewer`。它不是一个常驻单实例 agent。多个 parent agent、多个 subagent、多个 runtime session 都可以在不同 activation point 调用同一个 expert，并产生多个 task runs。Runtime instance 是某次 task run 的执行细节，不是 roster 的主对象。

## 1. 为什么不是普通 team UI

WorkBuddy / coworker UI 的直觉是对的：用户想看到 experts / coworkers，而不是上下文继承图。但 Context Tree 和普通 team UI 有一个关键差异：

```text
普通 team UI：一个 teammate 通常被理解成一个人或一个常驻 agent。
Context Tree：一个 expert 是稳定职责身份；每次调用会产生一个 runtime instance / task run。
```

例如：

- 主 agent A 让 `skill-designer` 审查一个 skill plan；
- 主 agent B 同时让 `skill-designer` 设计另一个 skill；
- 一个 implementation subagent 也让 `skill-designer` 检查 SKILL.md trigger wording；
- 这三次都应显示为同一个 expert 的不同 tasks / instances，而不是三个不同 members。

这意味着 UI 必须避免两个错误：

1. **把 runtime instance 当成 member。** `runtimeAgentId`、child process id、thread id 都只是一次执行的实例标识。
2. **把 expert 当成单一会话。** `skill-designer` 可以有多个历史 run，也可以被多个 parent 同时调用；它的连续性来自 profile、role memory、recent runs、material selection 与 result feedback，而不是固定 session。
3. **把 Expert / Instance / Task 做成三层主导航。** V0 主模型只应是 `Expert -> TaskRun[]`；runtime instance 只是某个 task run 的 `runtime` / `trace` facet。

## 2. 名词分层

### Expert

用户可见的稳定专家身份。等价于当前系统里的 `memberName` / `TeamMemberProfile.name`。

UI 必须区分稳定 key 和展示名：

```text
expertKey: skill-designer          # 用于聚合和 artifact lookup
displayName: Skill Designer        # 用户看到的名称
shortTitle: Skill workflow design  # roster 里的职责摘要
```

如果 profile 没有 `displayName`，TUI 可以把 `memberName` humanize 成展示名，但不得改变聚合 key。

字段示例：

```text
name: skill-designer
role: Skill workflow design
description: Reviews and designs Codex/Superpowers skills and trigger rules.
specialties: skill trigger rules, skill/rule separation, proof discipline
memory: role history, corrections, examples, standards
```

Expert 是 roster 的主对象。

### Expert Instance

一次 expert 被某个 parent / requester 调用后产生的运行实例。它可能对应：

- native subagent / teammate；
- explicit member executor；
- sidecar executor；
- future runtime bridge；
- retained fixture / test harness。

实例字段示例：

```text
instanceId: runtime child id / process ref / synthetic run id
expertName: skill-designer
requestedBy: parent thread / subagent / user
activationPoint: parent turn / task / checkpoint / artifact
startedAt / completedAt
runtimeSurface: codex cli / opencode / sidecar / fixture
```

Expert Instance 是 task detail 的 runtime facet，不是 roster 主身份，也不是 V0 的独立列表对象。TUI 可以在 task detail 中显示 instance id / runtime surface / process ref，但不应让用户先选择 instance 再选择 task。

### Task / MemberTaskRun

用户理解为“这个 expert 承接的一件事”。工程上就是 `MemberTaskRun`。

Task 是 WorkBuddy-style surface 的第二主对象，字段示例：

```text
title: Review explicit member activation path
expert: skill-designer
requester: parent-agent
status: Returned / Working / Needs input / Blocked
result: short summary
returnedTo: parent-agent
runKind: Live run / Local harness / Test run / Retained run
```

`runKind` 是用户可见的来源类型，不是 proof tier。它用来避免把 test-only 或 source-writer 运行误读成真实现场工作，但不应替代 `Returned / Working / Blocked` 这类工作状态。

### Trace

审计层。包含 parent invocation、executor observation、material selection、digest chain、known losses、native/natural route honesty。

Trace 默认折叠，不应成为首页主语言。

## 3. WorkBuddy-style 信息架构

TUI 顶层建议采用类似 WorkBuddy 的信息架构，但用 Context Tree 语义落地：

```text
Assistant | Experts | Tasks | Skills | Context | Activity
```

这是长期信息架构，不等于 V0 必须实现全部 tab。V0 只实现：

```text
Experts | Tasks | Detail | Trace
```

`Assistant / Skills / Context / Activity` 先作为 detail panel 的信息来源或后续 tab，不进入首个实现范围。

### Assistant

当前主 agent / current workspace 的概览：

- 当前工作目标；
- 最近调用过哪些 experts；
- 哪些 expert result 已返回但尚未应用；
- 哪些 task blocked 或需要用户决策。

V0 可以只读，不需要直接控制 agent。

### Experts

默认入口。显示稳定 experts，而不是 runtime instances。

每行展示：

```text
Expert name | Role | Current load | Last task | Availability
```

示例：

```text
skill-designer        Skill workflow design       2 active / 14 total   Returned 3m ago
live-eval-checker     Runtime validation          1 active / 8 total    Blocked
architecture-reviewer Architecture decisions      idle / 5 total        Available
```

`2 active` 表示这个 expert 当前有两个实例 / task run，不表示有两个不同 experts。

### Tasks

按任务而不是按 artifact 展示。

状态词应使用工作语义：

```text
Assigned
Working
Returned
Applied
Needs input
Needs review
Blocked
Failed
Archived
```

不要在第一层显示 `MECHANISM PASS`、`PRODUCT PENDING`、`nativeSpawnPass` 这类内部 proof 状态。

### Skills

展示 expert 可做的动作和对应触发语义：

```text
Consult
Review current plan
Check eval report
Design skill
Diagnose blocked runtime
Continue previous task
```

这些是 action kinds / task templates，不是新的 member 身份。

### Context

展示专家可用的上下文资源，但不默认展开材料细节：

- role profile；
- role memory；
- standards refs；
- recent relevant runs；
- project materials；
- connectors / runtime source paths。

这里参考 WorkBuddy 的 Connectors / Skills 心智，但 Context Tree 的 Context 页面必须保留材料可见性分层：model-visible、mounted、searchable、source-only、unknown。

### Activity

时间线：

- expert 被谁调用；
- 任务何时开始 / 返回；
- 结果是否回到 parent；
- 用户是否继续追问；
- role memory 是否发生候选更新。

Activity 是操作历史，不是 proof dashboard。

## 4. TUI 布局

### 4.1 默认 workbench

```text
Context Tree Workbench

┌ Experts ──────────────────────┐ ┌ Tasks ─────────────────────────────────────────┐
│ skill-designer        2 active │ │ Returned  skill-designer   Review skill plan   │
│ live-eval-checker     blocked  │ │ Working   skill-designer   Check trigger rules │
│ architecture-reviewer idle     │ │ Blocked   live-eval-checker Codex live run     │
└────────────────────────────────┘ └───────────────────────────────────────────────┘

┌ Selected Expert ─────────────────────────────────────────────────────────────────┐
│ skill-designer                                                                  │
│ Role: Skill workflow design                                                     │
│ Good for: skill trigger rules, rule/skill separation, review wording             │
│ Recent memory: avoid overclaiming retained artifacts as live proof               │
│ Actions: Consult | Review current task | Continue previous task                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Expert detail

```text
Expert: skill-designer

Profile
  Role: Skill workflow design
  Responsibilities: review skills, design trigger rules, enforce proof discipline

Current instances
  Working   parent-thread-42   Check trigger wording
  Returned  parent-thread-38   Review explicit member activation path

Recent tasks
  Returned  Review explicit member activation path       result returned to parent
  Returned  Review SKILL.md rule separation              result returned to parent
  Blocked   Validate Codex native spawn skill wrapper     runtime surface missing

Memory
  Active: evidence-backed review wording
  Active: contract refs are loaded only when implementing/calling writeback
  Pending: user prefers symptom-driven skill descriptions
```

这里的 `Current instances` 是从 active task runs 派生的运行细节摘要。实现层不要为它建立独立的顶层 collection；它应复用 `TaskRun.runtime` 或 trace fields。

### 4.3 Task detail

```text
Task: Review explicit member activation path
Expert: skill-designer
Requester: parent-agent / parent-thread-review-1
Status: Returned
Run kind: Local harness
Returned to: parent-agent

Result
  Agent-runtime explicit member answer: ...

Used context
  Role memory: skill-designer-corrections.md
  Target material: codex-native-spawn-acceptance-runbook.md
  Activation context: parent turn parent-turn-review-1

Trace  [collapsed by default]
```

### 4.4 Trace drawer

Trace drawer 可以显示内部 proof，但语言仍应是用户可解释的：

```text
Trace
  Parent call: observed / source-writer / fixture / missing
  Executor: agent-runtime-parent-invocation-harness
  Result returned: parent-agent
  Material path: prepared prompt
  Digests: aligned
  Native spawn: not claimed
  Natural spawn: not claimed

Limitations
  testEligibilityOnly=true
  parent source is cli-parent-source-writer
```

不要把 trace 状态提升成第一层 task 状态。第一层 task 状态仍是 `Returned` / `Blocked` / `Needs input`。

## 5. 多实例模型

多实例是 Context Tree 区别于简单 team roster 的核心。

### 5.1 一个 expert 可以同时有多个 active instances

示例：

```text
skill-designer
  instance A: parent agent asks for skill implementation plan review
  instance B: implementation subagent asks for trigger wording check
  instance C: live-eval subagent asks whether the result overclaims
```

UI 不应把 A/B/C 展示成三个 `skill-designer`。正确方式是：

```text
skill-designer    3 active
```

展开后看到三条 task runs。每条 task run 的 detail 里再显示 runtime instance 信息，例如 child thread、process ref、executor kind 或 synthetic run id。

### 5.2 一个 parent / subagent 可以调用多个 experts

示例：

```text
parent-thread-42
  -> skill-designer: review SKILL.md
  -> live-eval-checker: verify live run output
  -> architecture-reviewer: judge product boundary
```

TUI 的 Tasks 页可以按 requester 分组，显示一个 parent loop 里的多个 expert results。

### 5.3 同一个 task 可以继续同一个 expert，也可以新建 instance

用户操作 `Continue previous task` 时，不应暗示一定恢复同一个 runtime session。UI 应表达为：

```text
Continue with skill-designer
```

而不是：

```text
Resume agent process 123
```

工程上可以选择：

- resume same runtime instance；
- spawn a new instance with previous task/run context；
- use role memory + selected prior runs；
- use future Magic Context / Dreamer materialization。

用户看到的是同一个 expert 的连续工作，不是底层 runtime session 复活。

## 6. 主状态语义

TUI 第一层状态必须是工作状态，不是 proof 状态。

推荐 task statuses：

| Status | 含义 |
| --- | --- |
| `Assigned` | 已创建 task，尚未观察到执行开始 |
| `Working` | 有 active runtime instance 或 executor observation started |
| `Returned` | expert 有结果并返回到 requester / parent |
| `Applied` | parent 后续 turn 明确采纳或处理了结果 |
| `Needs input` | expert 需要用户或 parent 进一步材料 |
| `Needs review` | 结果返回但 trace/material 有明显问题，需要人看 |
| `Blocked` | runtime / permission / context source 不可用 |
| `Failed` | 执行失败或 artifact 不可解释 |
| `Archived` | 历史任务，不再需要操作 |

内部 proof 映射到 trace，而不是主状态：

| 内部事实 | 主 UI | Trace |
| --- | --- | --- |
| fixture mechanism pass | `Returned` 或 `Test run` 标记 | Parent call: fixture |
| parent source writer eligibility | `Returned` | Parent call: source-writer; test-only |
| product-grade explicit activation | `Returned` | Parent call: observed |
| native spawn not claimed | 不显示 | Native spawn: not claimed |
| material proof missing | `Needs review` | Missing role/target material |
| result not returned to parent | `Needs review` 或 `Blocked` | returnedTo mismatch |

`MECHANISM PASS / PRODUCT PENDING / PRODUCT PASS` 这类状态只适合 debug/proof view，不适合作为 WorkBuddy-style TUI 的主 copy。

## 7. V0 范围

V0 TUI 应是 read-only workbench：

```bash
npm run context-tree:tui -- --input <run-root-or-aggregate-root>
```

输入可以是：

- 单个 run root；
- aggregate acceptance root；
- 未来的 workspace ledger root。

V0 必须支持：

1. Experts roster；
2. Tasks list；
3. Expert detail；
4. Task detail；
5. Trace drawer；
6. 多实例折叠/展开；
7. artifact path 展示/复制；
8. filter by expert / status / requester。

V0 不承诺跨平台打开文件或启动 GUI。需要打开 artifact 时，先显示路径并支持复制；后续再按宿主环境接入 open command。

V0 不做：

- live runtime invocation；
- direct member chat；
- memory editor；
- graph editor；
- automatic routing UI；
- full PM / kanban / workforce platform；
- Web dashboard。

## 8. 后续交互能力

等 read-only TUI 稳定后，再考虑交互：

### Consult expert

用户从 Experts 页选择 expert，然后发起 task。工程上仍走：

```text
prepare member task -> host runtime / adapter executes -> record MemberTaskRun
```

TUI 不应直接成为唯一 runtime owner。

### Continue task

用户从 Task detail 继续找同一 expert。UI 语义是连续 expert，不承诺同一 runtime session。

### Ask another expert

用户可以把一个 task result 转给另一个 expert，例如：

```text
skill-designer result -> live-eval-checker checks whether proof is enough
```

这会产生新的 `MemberTaskRun`，并通过 work-product dependency edge 连接。

### Apply result

parent agent 或用户把 expert result 应用到当前工作。后续可以记录 `Applied`，但 V0 只读时可以从 artifacts 推断或不显示。

## 9. 和现有 Member Surface V0 的关系

`docs/member-surface-v0.md` 是 static HTML/report surface，偏 artifact report。TUI workbench 是它的产品化下一层：

```text
Member Surface V0: deterministic report over artifacts
TUI Workbench V0: WorkBuddy-style member/task work surface over the same artifacts
```

两者应共享 view model 能力，但默认语言不同：

- static report 可以保留 execution/material proof 字段；
- TUI 默认使用 expert/task/result/status 语言；
- trace drawer 可以复用 evidence drawer 的原始数据。

## 10. 设计原则

1. **Expert identity first.** roster 按 `memberName` 聚合，不按 runtime instance 聚合。
2. **Instances are plural.** 一个 expert 可以有多个 active / historical instances。
3. **Tasks are user-visible.** `MemberTaskRun` 在 UI 里叫 task / run，不叫 activation proof。
4. **Trace is expandable.** provenance、fidelity、digest、known losses 默认折叠。
5. **Proof taxonomy stays internal.** eval/pass/tier 只在 trace/debug view 出现。
6. **No fake persistence claim.** `Continue with expert` 不承诺恢复同一 runtime session。
7. **No runtime ownership overclaim.** TUI 可以触发 adapter，但不声称自己拥有 native subagent runtime。
8. **WorkBuddy mental model, Context Tree boundary.** 表层像 coworker workbench，底层仍是 context-bearing member task evidence。

## 11. 首个实现建议

下一份 implementation plan 不应做完整 UI 产品，而应做一个窄切片：

```text
WorkBuddy-style TUI read-only workbench V0
```

成功标准：

1. 输入一个真实 run root，TUI 显示一个 expert 和其 task；
2. 输入 aggregate root，TUI 按 expert 聚合多个 tasks；
3. 同一个 expert 的多个 runtime instances 不会被误显示成多个 experts；
4. task 第一层显示 `Returned / Blocked / Needs review` 等工作状态；
5. trace drawer 才显示 parent source、executor observation、material path、digest、native/natural not claimed；
6. 当前 fixture / source-writer / product-grade 三种 proof 都能映射为同一个 WorkBuddy-style task UI，只在 trace 里解释差异。
