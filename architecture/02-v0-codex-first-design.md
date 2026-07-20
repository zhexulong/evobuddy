# V0 设计：Codex-first Context-Bearing Agent Fork

## 1. V0 目标

V0 主要证明一件事：

> 在一个明确的上下文点，Context Tree 能调用一个真正带有该点上下文的 agent，并把它的结果挂回树中。

V0 不做通用文档系统，不做知识库，不做全平台抽象，不做自动 branch suggestion。

但 V0 需要同时建立一个对照后端：

> 如果已知 Codex runtime 如何从 stored history / rollout / compaction replacement 组装派生 agent 的上下文，Context Tree 可以编译一个专用 context packet，并用 eval 比较它与 native spawn 的差距。

这个 packet 不是 design doc，也不是人工 summary；它是为了派生 agent 使用而生成的上下文编译产物。

第一目标平台是 Codex，因为 `01-platform-capability-survey.md` 显示它有最强的 thread/rollout/history fork 能力：

- app-server `thread/fork`；
- `thread/rollback` / rollout reconstruction；
- MultiAgent v1 `spawn_agent(fork_context=true)`；
- MultiAgent v2 `spawn_agent(fork_turns="all")`；
- stored thread history / rollout path。

但 V0 必须明确：这是 **filtered stored-history fork**，不是模型 KV/cache、provider prompt cache 或任意 live hidden state fork。

## 2. V0 场景

核心场景：

```text
设计阶段完成，当前 live agent 准备进入 implementation plan。
在进入 plan 之前，当前 agent 直接复用自己的 native spawn/subagent 链路，
派生一个继承当前上下文的 reviewer/planner agent。
派生 agent 基于同一设计上下文审查或指导下一步。
主 agent 通过 wait/agent-result 接收结果，再决定如何进入 writing-plans。
```

这里的 reviewer/planner prompt **不是子 agent 自己生成的**。它由请求方提供：

```text
当前 agent / ctree tool 选择 purpose 和目标节点
Context Tree 用模板生成 reviewerPrompt
spawn_agent(message=reviewerPrompt, fork_context=true) 或 fork_turns=all
子 agent 只执行该 prompt，并在 final answer 中返回 review 结果
父 agent 通过 multi-agent runtime 的 wait/result 拿到子 agent final answer
```

因此 V0 主路径不是“母 agent 输出命令行，子 agent 读取命令行输出”。主路径是 agent runtime 内部的 subagent 调用和结果回收。

抽象拓扑：

```text
P = design context node
C = current workflow node, usually same as P in v0
R = forked reviewer/planner node

R spawned-from P
R reviews/guides C
C requested R
```

V0 可以先把 `P == C`，即“当前 live agent 从自己的当前上下文点 spawn reviewer/planner”。后续再支持“下游 C 请求从上游 P spawn/fork 一个 reviewer 来 review C”。

如果要支持下游主动请求上游 review，理想形态仍然是：

```text
下游 agent 调用 ctree.reviewParent(parentNodeId, purpose)
ctree 选择 parent node 对应的最佳恢复路径
优先：在可用 runtime 中 native spawn context-bearing subagent
回退：app-server thread/fork + turn/start reviewer prompt
reviewer final answer 作为 tool/subagent result 返回给下游 agent
```

## 3. checkpoint 的产品语义

在 V0 中，`checkpoint` 不表示“保存一个文件”。

它表示：

```text
当前 agent 声明这里是一个可复用/可分叉上下文点，
并立即或随后创建一个 context-bearing forked agent。
```

所以 V0 的主要动作是：

```text
checkpoint-by-native-spawn
```

即当前 live agent 认为这里需要 review/plan guidance 时，直接调用 native subagent/spawn 能力。

不是：

```text
checkpoint-then-later-maybe-spawn
```

这符合用户指出的边界：agent 调用 checkpoint 一般指调用一个具有对应上下文的 subagent / forked agent。

## 4. 最小数据模型

### ContextNode

```ts
type ContextNode = {
  id: string
  platform: "codex"
  sessionRef: string        // Codex thread id
  rolloutRef?: string       // rollout path if known
  turnRef?: string          // stable turn boundary if known
  label: string             // user label > platform title/recap > generated label
  createdAt: string
  manifestId?: string
}
```

V0 不加入 `role`、`status`、`returnRef`、`forkMode` 等字段。

原因：

- `role` 属于 edge/spawn purpose，不属于 node 本体；
- `status` 只有做 session manager 时才需要；
- `returnRef` 只有做 handoff/return 机制时才需要；
- `forkMode` 属于 manifest 的恢复路径，不属于 node 固定属性。

### ContextEdge

```ts
type ContextEdge = {
  id: string
  kind:
    | "spawned-from"
    | "requested-by"
    | "reviews"
    | "guides"
  fromNodeId: string
  toNodeId: string
  createdAt: string
  manifestId?: string
}
```

示例：

```text
R spawned-from P
R requested-by C
R reviews C
```

### CaptureManifest

```ts
type CaptureManifest = {
  id: string
  platform: "codex"
  recoveryMethod:
    | "codex-spawn-agent-full-history"
    | "codex-thread-fork"
    | "codex-compiled-context-packet"
    | "codex-thread-rollback-plus-fork"
    | "codex-mounted-rollout-record"
  sourceThreadId: string
  spawnedThreadId?: string
  rolloutRef?: string
  boundary:
    | "current-stable-turn"
    | "interrupted-snapshot"
    | "rollback-boundary"
    | "unknown"
  codexApi:
    | "multiagent-v1-fork_context"
    | "multiagent-v2-fork_turns"
    | "app-server-thread-fork"
    | "manual-tui-fork"
  transformLayers?: ContextTransformLayer[]
  knownLosses: string[]
evidenceRefs: ResourceRef[]
}
```

Codex `knownLosses` 初始应包括可验证项，而不是笼统写“可能损失”：

```text
- no model KV/cache
- no provider prompt cache
- forked rollout filters reasoning items
- forked rollout filters tool outputs unless platform includes them in surviving response items
- compaction replacement history may replace raw pre-compaction turns
- mid-turn fork uses interrupted snapshot semantics
```

具体列表要由 live eval 确认后收紧。

## 5. Codex adapter 路径

### 5.1 当前上下文点：native checkpoint-by-spawn（主路径）

首选路径是 live agent 直接复用平台自身的 subagent/spawn 链路：

```text
当前 Codex agent 调用 spawn_agent
  v1: fork_context=true
  v2: fork_turns="all"
```

这条路径最重要，因为它满足产品体验：当前 agent 不退出界面、不要求用户运行外部命令，直接派生一个 context-bearing reviewer，并通过 runtime 的 wait/result 回收结果。

但当前 eval harness 需要单独写明一个 proof boundary：V0 架构主路径仍然是 live agent runtime 内部 native spawn；现有 Node CLI `eval:codex:live` 只能通过 app-server surface 跑 `thread/*` 能力，不能直接调用同一 runtime 的 `spawn_agent` / `wait_agent`。因此当前 native-spawn capability report 里的 `pass`，如果来自 artifact ingestion，证明的是“真实 live parent agent 已经跑出 native spawn，并被 retained artifact 正确带回 report”，而不是“同一个 app-server eval 进程内直接完成了 native spawn”。

派生 agent 的 `reviewerPrompt` 由当前 agent / Context Tree tool 生成并作为 initial message 传给子 agent；子 agent 不负责“发现自己该 review 什么”。典型 prompt：

```text
你是 Context Tree 在 design-complete -> before-implementation-plan 边界派生的 reviewer/planner。
你应基于 forked parent context 审查当前设计是否足以进入 implementation plan。
不要假设你只是收到摘要；请使用你继承的上下文。
输出：blocking/high issues、plan guidance、unknowns。
```

Context Tree 记录：

```text
sourceThreadId = 当前 thread
spawnedThreadId = 新 agent/thread id（如果 runtime 暴露）
recoveryMethod = codex-spawn-agent-full-history
codexApi = multiagent-v1-fork_context 或 multiagent-v2-fork_turns
boundary = current-stable-turn 或 interrupted-snapshot
resultRef = 子 agent final answer / wait_agent result
```

父子通信语义：

```text
父 agent -> spawn_agent(message=reviewerPrompt, fork_context=true/fork_turns=all)
子 agent -> final answer
父 agent -> wait_agent / tool result 读取 final answer
Context Tree -> 将 result 挂到 R reviews/guides C edge
```

### 5.2b 编译上下文包：可审计强 fallback / 对照路径

除 native spawn 外，V0 还应定义 Codex 的 compiled-context backend：

```text
source thread / rollout
+ stable boundary
+ Codex rollout reconstruction / keep_forked_rollout_item 语义
+ compaction replacement history
+ turn context / previous turn settings（若可用）
+ reviewerPrompt
→ codex compiled context packet
→ reviewer agent
```

它有两个用途：

1. **能力对照**：比较 native spawn reviewer 与 compiled packet reviewer 是否能恢复同一批 canary。
2. **历史/审计路径**：当 native live spawn 不可用、或需要从历史节点恢复时，提供可检查、可 diff 的上下文产物。

当前实现状态下，还要区分两层：

- **implementation proof / retained-artifact proof**：native spawn 在 live agent runtime 内发生，结果被保留为 artifact，再由 eval harness ingest；
- **same-process live surface proof**：eval harness 自己就能直接调用 native spawn。

V0 已实现并证明前者；后者仍受限于 Codex live app-server surface 当前不暴露 native spawn。

这个后端必须明确 target：

```text
native-current-context = 复现 Codex 当前/该边界会发送给派生 agent 的 filtered stored history
max-raw-record        = 从 rollout/session store 尽可能恢复更多 raw evidence
```

V0 默认应使用 `native-current-context`。`max-raw-record` 只能用于审计/调查，不能静默冒充 parent 当时模型可见上下文。

### 5.2 历史节点或 native spawn 不可用时：thread/fork + turn/start（回退路径）

用于从已有 `ContextNode` 派生，或 native spawn surface 暂不可用时回退：

```text
thread/fork(sourceThreadId)
turn/start(forkedThreadId, reviewer/planner prompt)
```

如果 app-server 可用，这是比 TUI `/fork` 更可测的路径。但它不是理想主 UX：它需要 harness 代为创建 forked thread、启动 reviewer turn、收集结果，再把结果作为 tool output 返回给当前 agent。

这条路径可以回答“从 parent thread fork reviewer 之后能不能跑”：可以跑，但通信不是子 agent 主动给母 agent 发消息，而是 harness 等待 forked reviewer turn 完成，然后把 reviewer final answer 作为 ctree tool result 返回给调用方。

### 5.3 rewind-like 历史边界

如果需要从“某个早期 user turn 之前/之后”派生：

```text
source thread -> rollback/fork to stable boundary -> fork reviewer/planner
```

注意：rollback 改变 source thread 语义，V0 不应直接在真实用户 session 上 destructive rollback。应优先使用临时/ephemeral fork 后再 rollback，或者使用 Codex 支持的 fork snapshot / truncate-before boundary。

## 6. Control surface

V0 不要求用户退出 agent UI。主入口应该是当前 agent 可直接调用的能力，而不是用户手动跑 slash/CLI。

可接受入口按优先级排序：

1. **Native subagent spawn（主 UX）**
   ```text
   spawn_agent(message=reviewerPrompt, fork_context=true)
   # 或 v2: spawn_agent(message=reviewerPrompt, fork_turns="all")
   wait_agent(spawnedAgentId)
   ```
   当前 agent 自己复用平台 spawn 链路。Context Tree 只负责生成 reviewerPrompt、记录 node/edge/manifest/result。

2. **Agent tool call / MCP wrapper**
   ```text
   ctree.review_parent({ parentNodeId?, purpose })
   ctree.spawn_context_agent({ purpose, target })
   ```
   wrapper 内部优先选择 native spawn；只有 native spawn 不可用或目标是历史节点时，才回退到 app-server `thread/fork + turn/start`。

3. **Codex skill / command wrapper**
   在 superpowers `brainstorming -> writing-plans` 边界前显式调用。它应包装 native spawn，而不是要求用户退出界面。

4. **app-server eval harness**
   用于自动测试和 fallback，不作为用户主 UX。

V0 不做用户主路径：

```text
/ctree review-from-parent
```

除非只是调试命令。

## 7. Live eval / 强 E2E 测试设计

用户指出 eval 不能只靠我们自己不断试错。因此 V0 必须内建一个强 E2E harness，能重复验证“forked agent 是否真的拥有目标上下文”。

### 7.1 Eval 原则

1. **黑盒优先**：验证 forked agent 的实际行为和实际 model request，而不是只相信 manifest。
2. **白盒辅助**：读取 Codex rollout / app-server event / request capture 来解释结果。
3. **对照组必须存在**：至少比较 native spawn / thread fork 与 summary handoff。
4. **canary 必须不可从 prompt 推断**：否则 agent 可能靠测试 prompt 猜对。
5. **测试应可重复**：每次生成唯一 canary，记录 seed、thread id、rollout path、request log。
6. **不因单次成功宣称通过**：要跑多 case、多轮、含 compaction / rollback / tool result。

### 7.2 Eval Harness 形态

```text
scripts/eval/codex-context-fork-e2e.mjs
```

职责：

```text
1. 启动 Codex app-server、native multi-agent eval surface，或测试 provider harness
2. 创建 parent thread / live parent agent context
3. 注入多种 canary context
4. 分别测试 native spawn reviewer、compiled context packet reviewer 与 app-server thread/fork reviewer
5. 要求 reviewer 回答只能由 inherited context 得出的检查题
6. 捕获 forked/spawned agent 的实际 request / rollout / response
7. 对照 fresh thread、summary-only、fork_turns=none baseline
8. 输出 machine-readable capability-matrix.json
```

report shape：

```ts
type EvalReport = {
  runId: string
  codexVersion?: string
  cases: EvalCaseResult[]
  summary: {
    nativeSpawnPass: boolean
    compiledContextPass: boolean
    threadForkPass: boolean
    summaryBaselinePass: boolean
    regressions: string[]
    inconclusive: string[]
  }
}

type EvalCaseResult = {
  caseId: string
  sourceThreadId: string
  forkedThreadId?: string
  method: string
  expectedCanaries: string[]
  forbiddenCanaries?: string[]
  observedAnswer: string
  requestEvidenceRefs: string[]
  rolloutEvidenceRefs: string[]
  verdict: "pass" | "fail" | "inconclusive"
  failureReason?: string
}
```

### 7.3 Canary 分类

至少需要这些 canary：

#### A. User-message canary

父线程早期用户消息中放入：

```text
PROJECT_CODEWORD = CTREE-USER-<random>
```

forked reviewer 不在 prompt 中看到 codeword，只被问：

```text
之前用户给这个设计起过一个隐藏 codeword。是什么？
```

预期：native spawn 或 thread fork 能答，fresh thread / summary-only 不能答。

#### B. Assistant-final canary

父线程中让 assistant 生成并确认：

```text
设计选择：采用 Strategy-B，拒绝 Strategy-A。
原因码：CTREE-DECISION-<random>
```

forked reviewer 被问：

```text
此前确认的设计选择和原因码是什么？
```

验证 assistant final answer 是否进入 forked history。

#### C. Tool-result canary

父线程通过工具读取或生成一段结果：

```text
TOOL_RESULT_SECRET = CTREE-TOOL-<random>
```

然后不在后续用户 prompt 复述。

forked reviewer 被问：

```text
之前工具结果中的 secret 是什么？
```

这个 case 很关键，因为 01 调研指出 Codex fork 可能过滤 tool outputs。结果可能是 fail 或 inconclusive，但必须被记录为 known loss。

#### D. Compaction canary

构造长上下文触发 compact，确保：

```text
pre-compact raw canary
compact summary canary
post-compact canary
```

fork 后检查：

- raw pre-compact 是否丢失；
- compact summary 是否存在；
- post-compact 是否存在。

这验证 `codex-compaction-replacement-history` 的真实边界。

#### E. Rollback canary

父线程中加入：

```text
SURVIVING = CTREE-SURVIVE-<random>
ROLLED_BACK = CTREE-ROLLBACK-<random>
```

rollback 后 fork。

预期：

- forked reviewer 能看到 surviving；
- 不能看到 rolled_back。

这验证 rollback reconstruction 和 boundary selection。

#### F. Current-boundary spawn canary

在当前 agent 准备进入 implementation plan 之前，通过 `spawn_agent(fork_turns="all")` 派生 reviewer。

预期 reviewer 能回答设计阶段早期 canary，而不是只看到 spawn prompt。

### 7.4 Negative controls

每个 positive case 至少有一个 negative control：

```text
fresh thread + same reviewer prompt
summary-only thread + sanitized summary
fork with fork_turns="none"
fork with last-N smaller than canary turn
```

通过标准：

```text
positive 能答对，negative 答不出或明确 unknown。
```

如果 negative 也答对，说明 canary 泄漏到 prompt/report 中，case 无效。

### 7.5 Request-level oracle

只看 reviewer 输出不够。必须捕获 request-level evidence：

- forked model request 中是否含 canary；
- source rollout 是否含 canary；
- forked rollout 是否含 canary；
- canary 是以 user / assistant / tool / compaction summary 哪种形态出现；
- prompt 中是否意外泄漏 expected answer。

如果无法捕获 provider request，则 case 只能是 `inconclusive`，不能 pass。

### 7.6 Strong E2E 通过门槛

V0 不要求所有 canary pass。它要求：

1. **User-message canary pass**；
2. **Assistant-final canary pass**；
3. **Negative controls fail as expected**；
4. **Tool-result canary 给出确定 verdict**：pass 或 known loss，不能模糊；
5. **Compaction case 给出确定 transform layer**；
6. **Rollback case pass**；
7. report 记录 source/forked thread id、request evidence、rollout evidence。

如果只做到“forked reviewer 看起来懂上下文”，不算通过。

### 7.7 Live eval 与产品 eval 分离

需要两层 eval：

#### Capability eval

证明平台能力边界：

```text
这个 fork/spawn 方法到底继承了哪些上下文成分？
```

必须分开记录两类能力：

```text
native-spawn capability:
  当前 live agent 调用 spawn_agent(fork_context=true / fork_turns=all) 后，
  spawned reviewer 是否在实际 model request 中继承 parent context。

app-server-thread-fork capability:
  harness 用 thread/fork + turn/start 派生 reviewer 后，
  forked reviewer 是否在实际 model request 中继承 source thread history。

compiled-context capability:
  harness 读取 source rollout/thread store 并编译 context packet 后，
  reviewer 是否获得与 native-current-context 等价的关键信息。
```

输出：

```text
capability-matrix.json
```

#### Product eval

证明 Context Tree 工作流收益：

```text
design-complete -> before-plan forked reviewer
是否比 linear continuation / summary handoff 更早发现 high issue？
```

输出：

```text
workflow-eval-report.json
```

Product eval 不能在 capability eval 未通过时运行，否则会把平台能力不确定性混入产品判断。

## 8. Product eval：如何证明比手动开新对话 + 写总结更好

V0 产品 eval 使用固定任务夹具，不靠随便聊天试错。

### 8.1 Fixture 结构

```text
evals/fixtures/design-before-plan/<case-id>/
├── seed.md                  # 用户需求和隐藏约束生成规则
├── repo/                    # 小型代码仓库或伪仓库
├── expected-issues.json     # 应该发现的 high/critical issue
├── distractors.md           # 容易误导 summary 的信息
└── oracle.md                # 判分规则，不给 agent 看
```

### 8.2 三组对照

```text
A. Linear continuation
   同一 agent 设计后继续写 plan。

B. Manual summary handoff
   新 thread 只收到设计总结/摘要。

C. Context Tree fork
   从 design context fork reviewer/planner。

D. Context Tree compiled-context packet
   从同一 design context 编译专用上下文包，再派生 reviewer/planner。
```

### 8.3 评价指标

- 是否发现 expected high/critical issue；
- 是否引用正确上下文依据；
- 是否避免已排除方案；
- 是否保留用户临时偏好；
- 是否识别设计阶段隐含约束；
- 是否产生错误 invented context；
- 额外 token / wall time 成本。

### 8.4 判分方式

不能只让同一个 agent 自评。

至少需要：

```text
1. deterministic oracle check：关键词、结构化 issue id、forbidden claims；
2. independent judge：另一个 reviewer agent，只看 outputs + oracle，不看实验组标签；
3. artifact audit：检查 prompt/request 是否泄漏 expected issue。
```

最终报告必须把：

```text
platform capability evidence
product workflow evidence
```

分开写。

## 9. V0 文件/模块建议

```text
architecture/
  00-overview.md
  01-platform-capability-survey.md
  02-v0-codex-first-design.md

src/
  core/
    graph-store.ts
    manifest.ts
  adapters/
    codex-app-server.ts
    codex-thread-fork.ts
  eval/
    codex-context-fork-e2e.ts
    report.ts

evals/
  fixtures/
  reports/
```

V0 可以先不实现完整 CLI。先实现 eval harness 与最小 graph store。

## 10. 实现顺序

1. **Native spawn capability probe（优先）**
   - 在 live agent 内调用 `spawn_agent(fork_context=true)` 或 `fork_turns="all"`；
   - 用 canary 验证 spawned reviewer 是否继承当前 parent context；
   - 用 `wait_agent` / final result 验证子 agent 结果能回到父 agent；
   - 输出 native-spawn capability report。

2. **app-server thread/fork capability probe（fallback / historical）**
   - 用 app-server 或可控测试 harness 创建 parent/forked thread；
   - 跑 canary matrix；
   - 输出 thread-fork capability report。

3. **Codex compiled-context packet probe（强 fallback / 对照）**
   - 从同一个 source thread/rollout 读取 stored history；
   - 按 Codex fork/compaction 语义生成 context packet；
   - 用 canary matrix 与 native spawn / thread fork / summary-only 对照；
   - 输出 compiled-context capability report。

4. **最小 graph registry**
   - 记录 node/edge/manifest；
   - 不做 session manager。

5. **checkpoint-by-native-spawn adapter**
   - 当前 context spawn reviewer；
   - 记录 spawned agent/thread id 和 wait/result。

6. **thread/fork fallback adapter**
   - 从历史 ContextNode fork reviewer；
   - 将 reviewer final answer 作为 tool result 返回调用方。

7. **design-before-plan workflow fixture**
   - 固定 2-3 个设计任务；
   - 跑 A/B/C/D 对照。

8. **写 capability matrix 到架构文档**
   - 收紧 fidelity 定义；
   - 删除未被证明的能力宣称。

## 11. V0 非通过条件

以下情况不能宣称 V0 成功：

- 只在人工聊天里看起来 reviewer 有帮助；
- 只比较 summary 与 fork 的主观质量；
- 没有 negative control；
- 没有 request-level 或 rollout-level evidence；
- tool-result / compaction / rollback 边界不清楚；
- 产品 eval 把 capability failure 当成 reviewer failure；
- summary-only 被包装成 context fork。

## 12. 当前推荐

下一步先不要写产品 UI。

优先补 native spawn eval，因为它最接近目标 UX：

```text
当前 live agent -> spawn_agent(fork_context=true / fork_turns=all) -> reviewer
reviewer final answer -> wait_agent/tool result -> 当前 live agent
```

同时保留并继续运行 app-server fallback eval：

```text
scripts/eval/codex-context-fork-e2e.mjs
```

目标不是一次证明 Context Tree 全部成立，而是生成两张能力矩阵：

```text
Codex native-spawn capability matrix
Codex app-server thread-fork capability matrix
```

只有这些 matrix 证明哪些 context 成分能继承、哪些会丢失，V0 的数据模型和 fidelity 文档才不会继续停留在猜测层。

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
